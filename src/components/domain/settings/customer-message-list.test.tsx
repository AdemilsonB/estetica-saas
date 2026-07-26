// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { CustomerMessageList } from './customer-message-list'
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
    variables: ['cliente', 'servico', 'data', 'hora'],
    subject: null,
    body: 'Olá, {{cliente}}! Seu agendamento foi criado.',
    mediaUrl: null,
    isCustom: false,
    defaultBody: 'Olá, {{cliente}}! Seu agendamento foi criado.',
    defaultSubject: null,
    ...overrides,
  }
}

describe('CustomerMessageList', () => {
  it('renderiza os eventos vindos da API', async () => {
    const items: CustomerMessageTemplateItem[] = [
      buildItem(),
      buildItem({ channel: 'EMAIL', subject: 'Agendamento confirmado' }),
      buildItem({
        event: 'birthday',
        label: 'Aniversário',
        description: 'Enviada no aniversário do cliente.',
        nature: 'promotional',
      }),
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ items }) })),
    )

    render(<CustomerMessageList />, { wrapper })

    expect(await screen.findAllByText('Agendamento criado')).not.toHaveLength(0)
    expect(screen.getAllByText('Aniversário').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Promocional').length).toBeGreaterThan(0)
  })

  it('mostra o selo de personalizado quando isCustom', async () => {
    const items: CustomerMessageTemplateItem[] = [
      buildItem({ isCustom: true }),
      buildItem({ channel: 'EMAIL', subject: 'Assunto', isCustom: false }),
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ items }) })),
    )

    render(<CustomerMessageList />, { wrapper })

    expect((await screen.findAllByText('Personalizada')).length).toBeGreaterThan(0)
  })

  it('mostra estado de erro com botão de tentar de novo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, json: async () => ({}) })),
    )

    render(<CustomerMessageList />, { wrapper })

    expect(await screen.findByText(/Não foi possível carregar/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tentar de novo/i })).toBeInTheDocument()
  })

  it('abre o editor ao clicar em editar', async () => {
    const items: CustomerMessageTemplateItem[] = [buildItem()]
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ items }) })),
    )

    render(<CustomerMessageList />, { wrapper })

    const botoes = await screen.findAllByRole('button', { name: /Editar WhatsApp/i })
    await userEvent.click(botoes[0])

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })
})
