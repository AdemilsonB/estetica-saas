// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

afterEach(cleanup)

/**
 * Um Dialog aberto sobre outro precisa de `modal={false}` para não deixar
 * `aria-hidden` preso na raiz do app, mas o Radix não renderiza `DialogOverlay`
 * nesse modo — o de cima ficava sem fundo nenhum e os dois formulários apareciam
 * igualmente nítidos. `stacked` devolve o fundo escurecido.
 */
describe('DialogContent empilhado', () => {
  it('renderiza um fundo escurecido próprio quando modal={false}', () => {
    render(
      <Dialog open modal={false}>
        <DialogContent stacked>
          <DialogHeader>
            <DialogTitle>Novo cliente</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    )

    const backdrop = document.querySelector('[data-slot="dialog-stacked-backdrop"]')
    expect(backdrop).not.toBeNull()
    expect(backdrop?.className).toContain('bg-black/40')
    expect(backdrop?.className).toContain('backdrop-blur-sm')
  })

  it('fica acima do dialog de baixo', () => {
    render(
      <Dialog open modal={false}>
        <DialogContent stacked>
          <DialogHeader>
            <DialogTitle>Novo cliente</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    )

    const content = document.querySelector('[data-slot="dialog-content"]')
    expect(content?.className).toContain('z-60')
  })

  it('sem stacked, mantém o overlay padrão e não cria o fundo extra', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo agendamento</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    )

    expect(document.querySelector('[data-slot="dialog-stacked-backdrop"]')).toBeNull()
    expect(document.querySelector('[data-slot="dialog-overlay"]')).not.toBeNull()
    expect(screen.getByText('Novo agendamento')).toBeInTheDocument()
  })

  /**
   * Bug real: "Novo agendamento" > "Novo cliente" (empilhado) > "Importar contato"
   * (empilhado sobre o empilhado) — 3 níveis. Cada nível empilhado é renderizado
   * como filho JSX do `<Dialog>` de baixo, não como filho do `DialogContent` dele,
   * então o portal de um nível fica como IRMÃO de DOM do de baixo, nunca um
   * descendente. Sem o registro em `DismissableLayer.Branch`, o dismissable-layer
   * do Radix não reconhece o clique no nível mais interno como "dentro" dos níveis
   * acima e fecha os dois de uma vez — mesmo sem erro nem toast, o usuário só via
   * tudo fechar e voltar pra tela de trás.
   */
  it('clicar dentro do 3º nível empilhado não fecha os dialogs de baixo (bug do contato importado)', async () => {
    const user = userEvent.setup()
    const onOpenChangeNivel1 = vi.fn()
    const onOpenChangeNivel2 = vi.fn()

    render(
      <Dialog open onOpenChange={onOpenChangeNivel1}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo agendamento</DialogTitle>
          </DialogHeader>
        </DialogContent>

        <Dialog open modal={false} onOpenChange={onOpenChangeNivel2}>
          <DialogContent stacked>
            <DialogHeader>
              <DialogTitle>Novo cliente</DialogTitle>
            </DialogHeader>
          </DialogContent>

          <Dialog open modal={false}>
            <DialogContent stacked>
              <DialogHeader>
                <DialogTitle>Importar contato</DialogTitle>
              </DialogHeader>
              <button type="button">Ana da Silva</button>
            </DialogContent>
          </Dialog>
        </Dialog>
      </Dialog>,
    )

    // getByRole ignoraria o botão (o `hideOthers` do nível 1, modal, marca os
    // portais irmãos como aria-hidden para leitores de tela — não afeta clique
    // em navegador real, mas RTL filtra por acessibilidade). getByText não filtra.
    await user.click(screen.getByText('Ana da Silva'))

    expect(onOpenChangeNivel1).not.toHaveBeenCalledWith(false)
    expect(onOpenChangeNivel2).not.toHaveBeenCalledWith(false)
    expect(screen.getByText('Novo agendamento')).toBeInTheDocument()
    expect(screen.getByText('Novo cliente')).toBeInTheDocument()
  })
})
