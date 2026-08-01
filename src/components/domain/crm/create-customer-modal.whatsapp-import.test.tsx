// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

vi.mock('@/hooks/settings/use-evolution-status', () => ({
  useEvolutionStatus: () => ({ data: { connected: true }, isLoading: false }),
  useEvolutionContacts: () => ({
    data: {
      contacts: [
        { phone: '5511999998888', name: 'Ana da Silva', profilePicUrl: null, inCrm: false },
        { phone: '5511988887777', name: 'Bruno Costa', profilePicUrl: null, inCrm: false },
      ],
      total: 2,
    },
    isLoading: false,
    isError: false,
  }),
}))

vi.mock('@/hooks/crm/use-import-contacts', () => ({
  useImportContacts: () => ({
    step: 'idle',
    contacts: [],
    error: null,
    reset: vi.fn(),
    pickFromVCards: vi.fn(),
    pickFromDevice: vi.fn(),
  }),
  supportsContactPicker: () => false,
}))

vi.mock('@/hooks/crm/use-customers', () => ({
  useCreateCustomer: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CreateCustomerModal } from './create-customer-modal'

afterEach(cleanup)

function Harness({ onLevel1OpenChange }: { onLevel1OpenChange: (open: boolean) => void }) {
  return (
    <Dialog open onOpenChange={onLevel1OpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
        </DialogHeader>
      </DialogContent>

      <CreateCustomerModal open onClose={() => {}} modal={false} onCreated={() => {}} />
    </Dialog>
  )
}

// Da mesma forma que o DismissableLayer usa `setTimeout(fn, 0)` pra so comecar
// a escutar pointerdown depois do tick de montagem (evita capturar o proprio
// clique que abriu a camada), o teste precisa ceder a real macrotask entre
// cada passo — senao os listeners nem chegam a ser registrados e o teste passa
// mesmo com um bug real presente (falso negativo).
function tick(ms = 10) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Simula o toque real de celular: pointerdown(pointerType=touch) -> pointerup -> click,
// que é exatamente a sequência que o navegador dispara num tap (diferente de
// userEvent.click, que por padrão simula mouse). O DismissableLayer do Radix trata
// touch de forma especial: adia a checagem de "clique fora" do pointerdown pro
// evento 'click' subsequente (via listener no document, uma vez só).
async function tap(element: Element) {
  fireEvent.pointerDown(element, { pointerType: 'touch', isPrimary: true })
  fireEvent.pointerUp(element, { pointerType: 'touch', isPrimary: true })
  fireEvent.click(element)
  await tick()
}

describe('Importar contato do WhatsApp dentro de Novo cliente (empilhado sobre Novo agendamento)', () => {
  it('mouse: preenche nome/telefone e mantem os 2 modais de baixo abertos', async () => {
    const user = userEvent.setup()
    const onLevel1OpenChange = vi.fn()
    render(<Harness onLevel1OpenChange={onLevel1OpenChange} />)

    await user.click(screen.getByText('Importar contato (WhatsApp ou celular)'))
    await user.click(screen.getByText('Do WhatsApp conectado'))
    await user.click(screen.getByText('Ana da Silva'))

    expect(onLevel1OpenChange).not.toHaveBeenCalledWith(false)
    expect(screen.getByText('Novo agendamento')).toBeInTheDocument()
    expect(screen.getByText('Novo cliente')).toBeInTheDocument()

    // querySelector direto (não getByLabelText): o hideOthers do nível 1 marca o
    // subtree do nível 2 como aria-hidden, e o RTL filtra queries por
    // acessibilidade — isso não afeta clique real no navegador (aria-hidden puro,
    // sem `inert`), então a query precisa ignorar esse filtro também.
    const nameInput = document.querySelector('input[placeholder="Nome completo"]') as HTMLInputElement
    const phoneInput = document.querySelector('input[placeholder="(00) 00000-0000"]') as HTMLInputElement
    expect(nameInput.value).toBe('Ana da Silva')
    expect(phoneInput.value).toBe('(11) 99999-8888')
  })

  /**
   * Bug real de produção: em toque (mobile — maioria do tráfego do Agendê), o
   * Radix adia a checagem de "clique fora" do pointerdown pro evento 'click'
   * seguinte, e cada dialog empilhado roda essa checagem na sua própria vez —
   * não todas juntas contra o mesmo estado do DOM. Escolher "Do WhatsApp
   * conectado" e depois um contato dispara mudanças de etapa que desmontam o
   * próprio elemento tocado antes da checagem dos níveis de cima rodar; um nó
   * desconectado não é filho de nenhum branch registrado, então o Radix
   * concluía (errado) que o clique foi "fora" e fechava "Novo cliente" em
   * cascata, resetando nome/telefone no meio do fluxo — sem erro nem toast.
   * Corrigido em `onInteractOutside` de `DialogContent` (ver dialog.tsx).
   */
  it('touch: preenche nome/telefone e mantem os 2 modais de baixo abertos', async () => {
    const onLevel1OpenChange = vi.fn()
    render(<Harness onLevel1OpenChange={onLevel1OpenChange} />)
    await tick()

    await tap(screen.getByText('Importar contato (WhatsApp ou celular)'))
    await tap(screen.getByText('Do WhatsApp conectado'))
    await tap(screen.getByText('Ana da Silva'))

    expect(onLevel1OpenChange).not.toHaveBeenCalledWith(false)
    expect(screen.getByText('Novo agendamento')).toBeInTheDocument()
    expect(screen.getByText('Novo cliente')).toBeInTheDocument()

    const nameInput = document.querySelector('input[placeholder="Nome completo"]') as HTMLInputElement
    expect(nameInput?.value).toBe('Ana da Silva')
  })

  it('a busca filtra a lista de contatos do WhatsApp por nome', async () => {
    const user = userEvent.setup()
    render(<Harness onLevel1OpenChange={vi.fn()} />)

    await user.click(screen.getByText('Importar contato (WhatsApp ou celular)'))
    await user.click(screen.getByText('Do WhatsApp conectado'))

    expect(screen.getByText('Ana da Silva')).toBeInTheDocument()
    expect(screen.getByText('Bruno Costa')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Buscar por nome ou número...'), 'bruno')

    expect(screen.queryByText('Ana da Silva')).not.toBeInTheDocument()
    expect(screen.getByText('Bruno Costa')).toBeInTheDocument()
  })

  it('a lista de contatos rola num único container flex (sem overflow-y-auto duplicado)', async () => {
    const user = userEvent.setup()
    render(<Harness onLevel1OpenChange={vi.fn()} />)

    await user.click(screen.getByText('Importar contato (WhatsApp ou celular)'))
    await user.click(screen.getByText('Do WhatsApp conectado'))

    // DialogContent do PickContactModal não pode mais rolar sozinho — só a
    // lista, ou toque/busca ficam quebrados por causa do scroll aninhado
    // (regressão real de produção corrigida junto com este teste).
    const dialogContent = screen.getByText('Contatos do WhatsApp').closest('[data-slot="dialog-content"]')
    expect(dialogContent?.className).toContain('overflow-hidden')
    expect(dialogContent?.className).not.toContain('overflow-y-auto')

    const list = screen.getByText('Ana da Silva').closest('.overflow-y-auto')
    expect(list).not.toBeNull()
    expect(list?.className).toContain('flex-1')
    expect(list?.className).toContain('min-h-0')
  })

  it('o botão "Importar contato" usa a cor de fundo de seleção (accent) configurada no tenant', () => {
    render(<Harness onLevel1OpenChange={vi.fn()} />)

    const button = screen.getByText('Importar contato (WhatsApp ou celular)').closest('button')
    expect(button?.className).toContain('bg-accent')
    expect(button?.className).toContain('text-accent-foreground')
  })
})
