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

const templates: CustomerMessageTemplateItem[] = [
  {
    event: 'appointment_created',
    channel: 'WHATSAPP',
    label: 'Agendamento criado',
    description: 'Quando você marca um horário pelo painel.',
    nature: 'transactional',
    variables: ['cliente'],
    subject: null,
    body: 'Olá, {{cliente}}!',
    mediaUrl: null,
    isCustom: false,
    defaultBody: 'Olá, {{cliente}}!',
    defaultSubject: null,
  },
]

vi.mock('@/hooks/settings/use-customer-message-templates', async () => {
  const real = await vi.importActual<
    typeof import('@/hooks/settings/use-customer-message-templates')
  >('@/hooks/settings/use-customer-message-templates')
  return {
    ...real,
    useCustomerMessageTemplates: () => ({ data: templates, isLoading: false, isError: false }),
    useUpdateCustomerMessageTemplate: () => ({ mutate: vi.fn(), isPending: false }),
    useResetCustomerMessageTemplate: () => ({ mutate: vi.fn(), isPending: false }),
  }
})

vi.mock('@/hooks/settings/use-customer-message-settings', async () => {
  const real = await vi.importActual<
    typeof import('@/hooks/settings/use-customer-message-settings')
  >('@/hooks/settings/use-customer-message-settings')
  return {
    ...real,
    useCustomerMessageSettings: () => ({
      data: [
        {
          event: 'appointment_created',
          label: 'Agendamento criado',
          description: 'Quando você marca um horário pelo painel.',
          nature: 'transactional' as const,
          enabled: true,
          channels: ['WHATSAPP' as const],
          isCustom: false,
        },
      ],
      isLoading: false,
      isError: false,
    }),
    useUpdateCustomerMessageSetting: () => ({ mutate: vi.fn(), isPending: false }),
  }
})

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

afterEach(cleanup)

describe('CustomerMessageList', () => {
  it('abre o editor com o template do canal escolhido na matriz', async () => {
    render(<CustomerMessageList />, { wrapper })

    await userEvent.click(screen.getByRole('button', { name: 'Editar WhatsApp' }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Olá, {{cliente}}!')).toBeInTheDocument()
  })
})
