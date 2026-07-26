// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { CustomerMessageEditor } from './customer-message-editor'
import type { CustomerMessageTemplateItem } from '@/hooks/settings/use-customer-message-templates'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// @testing-library/react não limpa o DOM sozinho neste projeto (globals do vitest
// desligado) — sem isto, renders de testes anteriores vazam para o assert seguinte.
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function buildItem(overrides: Partial<CustomerMessageTemplateItem> = {}): CustomerMessageTemplateItem {
  return {
    event: 'appointment_created',
    channel: 'WHATSAPP',
    label: 'Agendamento criado',
    description: 'Enviada quando você marca um horário pelo painel.',
    nature: 'transactional',
    variables: ['cliente', 'servico'],
    subject: null,
    body: 'Olá, {{cliente}}!',
    mediaUrl: null,
    isCustom: false,
    defaultBody: 'Olá, {{cliente}}!',
    defaultSubject: null,
    ...overrides,
  }
}

describe('CustomerMessageEditor', () => {
  it('o chip insere a variável no corpo e a prévia reflete o texto digitado', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const item = buildItem()

    render(<CustomerMessageEditor open item={item} onOpenChange={() => {}} />, { wrapper })

    // Uma prévia (mobile) + uma prévia (desktop) coexistem no DOM em jsdom — checamos as duas.
    expect(screen.getAllByText('Olá, Maria Silva!').length).toBeGreaterThan(0)

    const chip = screen.getByRole('button', { name: '{{servico}}' })
    await userEvent.click(chip)

    const textarea = screen.getByLabelText('Mensagem') as HTMLTextAreaElement
    expect(textarea.value).toContain('{{servico}}')
    // A prévia interpola a variável recém-inserida (PREVIEW_DATA.servico = "Escova").
    await waitFor(() => {
      expect(screen.getAllByText((_, el) => el?.textContent?.includes('Escova') ?? false).length).toBeGreaterThan(0)
    })
  })

  it('mostra "Restaurar padrão" quando isCustom e restaura o texto ao confirmar', async () => {
    const item = buildItem({ isCustom: true, body: 'Texto personalizado do dono do salão.' })
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({}) }))
    vi.stubGlobal('fetch', fetchMock)

    render(<CustomerMessageEditor open item={item} onOpenChange={() => {}} />, { wrapper })

    expect(screen.getAllByText('Texto personalizado do dono do salão.').length).toBeGreaterThan(0)

    await userEvent.click(screen.getByRole('button', { name: 'Restaurar padrão' }))
    await userEvent.click(screen.getByRole('button', { name: 'Restaurar' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/notifications/customer-templates/appointment_created/WHATSAPP'),
        expect.objectContaining({ method: 'DELETE' }),
      )
    })

    const textarea = screen.getByLabelText('Mensagem') as HTMLTextAreaElement
    await waitFor(() => expect(textarea.value).toBe(item.defaultBody))
  })

  it('não mostra "Restaurar padrão" quando o template não é personalizado', () => {
    vi.stubGlobal('fetch', vi.fn())
    const item = buildItem({ isCustom: false })

    render(<CustomerMessageEditor open item={item} onOpenChange={() => {}} />, { wrapper })

    expect(screen.queryByRole('button', { name: 'Restaurar padrão' })).not.toBeInTheDocument()
  })
})
