// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { CustomerMessageSettingsMatrix } from './customer-message-settings-matrix'
import type { CustomerMessageSettingItem } from '@/hooks/settings/use-customer-message-settings'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const mutate = vi.fn()

vi.mock('@/hooks/settings/use-customer-message-settings', async () => {
  const real = await vi.importActual<typeof import('@/hooks/settings/use-customer-message-settings')>(
    '@/hooks/settings/use-customer-message-settings',
  )
  return {
    ...real,
    useCustomerMessageSettings: () => ({ data: itens, isLoading: false, isError: false }),
    useUpdateCustomerMessageSetting: () => ({ mutate, isPending: false }),
  }
})

const itens: CustomerMessageSettingItem[] = [
  {
    event: 'appointment_created',
    label: 'Agendamento criado',
    description: 'Quando você marca um horário pelo painel.',
    nature: 'transactional',
    enabled: true,
    channels: ['WHATSAPP'],
    isCustom: false,
  },
  {
    event: 'birthday',
    label: 'Aniversário',
    description: 'Parabéns no dia do aniversário.',
    nature: 'promotional',
    enabled: false,
    channels: [],
    isCustom: true,
  },
]

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

afterEach(() => {
  cleanup()
  mutate.mockClear()
})

describe('CustomerMessageSettingsMatrix', () => {
  it('mostra um cartão por evento com o switch refletindo o padrão do negócio', () => {
    render(<CustomerMessageSettingsMatrix onEditTemplate={vi.fn()} />, { wrapper })

    const cartaoCriado = screen.getByTestId('mensagem-cliente-appointment_created')
    expect(within(cartaoCriado).getByRole('switch')).toBeChecked()

    const cartaoAniversario = screen.getByTestId('mensagem-cliente-birthday')
    expect(within(cartaoAniversario).getByRole('switch')).not.toBeChecked()
  })

  it('desligar um evento salva enabled=false preservando os canais', async () => {
    render(<CustomerMessageSettingsMatrix onEditTemplate={vi.fn()} />, { wrapper })

    const cartao = screen.getByTestId('mensagem-cliente-appointment_created')
    await userEvent.click(within(cartao).getByRole('switch'))

    expect(mutate).toHaveBeenCalledWith(
      { event: 'appointment_created', enabled: false, channels: ['WHATSAPP'] },
      expect.anything(),
    )
  })

  it('marcar o canal e-mail salva os dois canais', async () => {
    render(<CustomerMessageSettingsMatrix onEditTemplate={vi.fn()} />, { wrapper })

    const cartao = screen.getByTestId('mensagem-cliente-appointment_created')
    await userEvent.click(within(cartao).getByRole('checkbox', { name: /e-mail/i }))

    expect(mutate).toHaveBeenCalledWith(
      { event: 'appointment_created', enabled: true, channels: ['WHATSAPP', 'EMAIL'] },
      expect.anything(),
    )
  })

  it('evento desligado não mostra os canais nem o botão de editar mensagem', () => {
    render(<CustomerMessageSettingsMatrix onEditTemplate={vi.fn()} />, { wrapper })

    const cartao = screen.getByTestId('mensagem-cliente-birthday')
    expect(within(cartao).queryByRole('checkbox', { name: /e-mail/i })).not.toBeInTheDocument()
  })

  it('marca visualmente as mensagens promocionais', () => {
    render(<CustomerMessageSettingsMatrix onEditTemplate={vi.fn()} />, { wrapper })
    expect(screen.getByText('Promocional')).toBeInTheDocument()
  })
})
