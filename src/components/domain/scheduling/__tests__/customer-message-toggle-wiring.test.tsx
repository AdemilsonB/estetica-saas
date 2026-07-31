// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { CancelAppointmentModal } from '../cancel-appointment-modal'
import { ConfirmAppointmentModal } from '../confirm-appointment-modal'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock('@/hooks/notifications/use-customer-message-preview', () => ({
  useCustomerMessagePreview: () => ({
    data: {
      defaultEnabled: true,
      channels: ['WHATSAPP'],
      primaryChannel: 'WHATSAPP',
      preview: 'Olá, Maria! Seu agendamento foi cancelado.',
      blockedReason: null,
    },
    isLoading: false,
    isError: false,
  }),
}))

const mutate = vi.fn()

vi.mock('@/hooks/scheduling/use-appointments', async () => {
  const real = await vi.importActual<typeof import('@/hooks/scheduling/use-appointments')>(
    '@/hooks/scheduling/use-appointments',
  )
  return { ...real, useUpdateAppointmentStatus: () => ({ mutate, isPending: false }) }
})

vi.mock('@tanstack/react-query', async () => {
  const real = await vi.importActual<typeof import('@tanstack/react-query')>(
    '@tanstack/react-query',
  )
  return { ...real, useQuery: () => ({ data: null, isLoading: false }) }
})

const appointment = {
  id: 'a1',
  customerId: 'c1',
  professionalId: 'p1',
  serviceId: 's1',
  packageId: null,
  promotionId: null,
  startsAt: '2026-08-02T17:00:00.000Z',
  endsAt: '2026-08-02T17:45:00.000Z',
  status: 'SCHEDULED' as const,
  paymentStatus: 'PENDING' as const,
  notes: null,
  price: '80',
  confirmedPrice: null,
  customer: { id: 'c1', name: 'Maria Silva', phone: '11999990000', notes: null },
  professional: { id: 'p1', name: 'Ana' },
  service: { id: 's1', name: 'Escova', duration: 45 },
  package: null,
  promotion: null,
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

afterEach(() => {
  cleanup()
  mutate.mockClear()
})

describe('fiação do CustomerMessageToggle nos modais', () => {
  it('cancelar sem tocar no toggle não manda notify — o padrão do tenant decide', async () => {
    render(
      <CancelAppointmentModal appointment={appointment} open onClose={vi.fn()} />,
      { wrapper },
    )

    await userEvent.click(screen.getByRole('button', { name: /confirmar desmarcação/i }))

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a1', status: 'CANCELLED', notify: undefined }),
      expect.anything(),
    )
  })

  it('desligar o toggle manda notify false', async () => {
    render(
      <CancelAppointmentModal appointment={appointment} open onClose={vi.fn()} />,
      { wrapper },
    )

    await userEvent.click(screen.getByRole('switch'))
    await userEvent.click(screen.getByRole('button', { name: /confirmar desmarcação/i }))

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ notify: false }),
      expect.anything(),
    )
  })

  it('confirmar com o aviso desligado manda notify false — antes o switch não fazia nada', async () => {
    render(<ConfirmAppointmentModal appointment={appointment} open onClose={vi.fn()} />, {
      wrapper,
    })

    await userEvent.click(screen.getByRole('switch'))
    await userEvent.click(screen.getByRole('button', { name: /confirmar/i }))

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'CONFIRMED', notify: false }),
      expect.anything(),
    )
  })
})
