// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { AppointmentDrawer } from '../appointment-drawer'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock('@/hooks/notifications/use-customer-message-preview', () => ({
  useCustomerMessagePreview: () => ({
    data: {
      defaultEnabled: true,
      channels: ['WHATSAPP'],
      primaryChannel: 'WHATSAPP',
      preview: 'Olá, Maria! Notamos que você não compareceu.',
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
  return {
    ...real,
    useUpdateAppointmentStatus: () => ({ mutate, isPending: false }),
    useRescheduleAppointment: () => ({ mutate: vi.fn(), isPending: false }),
    useRefundAppointment: () => ({ mutate: vi.fn(), isPending: false }),
  }
})

vi.mock('@/hooks/iam/use-team', () => ({ useTeamMembers: () => ({ data: [] }) }))
vi.mock('@/hooks/settings/use-evolution-status', () => ({
  useEvolutionStatus: () => ({ data: { connected: true } }),
}))
vi.mock('@/hooks/use-permissions', () => ({ usePermissions: () => ({ can: () => true }) }))
vi.mock('@/hooks/scheduling/use-availability', () => ({
  useAvailableSlots: () => ({ data: [], isLoading: false }),
}))

const appointment = {
  id: 'a1',
  customerId: 'c1',
  professionalId: 'p1',
  serviceId: 's1',
  packageId: null,
  promotionId: null,
  startsAt: '2026-08-02T17:00:00.000Z',
  endsAt: '2026-08-02T17:45:00.000Z',
  status: 'CONFIRMED' as const,
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

describe('no-show no drawer', () => {
  it('não registra nada só de clicar em "Não compareceu" — abre a confirmação', async () => {
    render(<AppointmentDrawer appointment={appointment} open onClose={vi.fn()} />, { wrapper })

    await userEvent.click(screen.getByRole('button', { name: /não compareceu/i }))

    expect(mutate).not.toHaveBeenCalled()
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
  })

  it('a confirmação avisa que o cliente será notificado e mostra o texto', async () => {
    render(<AppointmentDrawer appointment={appointment} open onClose={vi.fn()} />, { wrapper })

    await userEvent.click(screen.getByRole('button', { name: /não compareceu/i }))
    const dialogo = await screen.findByRole('alertdialog')

    expect(within(dialogo).getByRole('switch')).toBeInTheDocument()
    await userEvent.click(within(dialogo).getByRole('button', { name: /ver a mensagem/i }))
    // Regex específico para a prévia (não o texto genérico da AlertDialogDescription,
    // que também contém "não compareceu").
    expect(within(dialogo).getByText(/notamos que você não compareceu/i)).toBeInTheDocument()
  })

  it('confirmar sem tocar no toggle não manda notify', async () => {
    render(<AppointmentDrawer appointment={appointment} open onClose={vi.fn()} />, { wrapper })

    await userEvent.click(screen.getByRole('button', { name: /não compareceu/i }))
    const dialogo = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialogo).getByRole('button', { name: /^confirmar$/i }))

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'NO_SHOW', notify: undefined }),
      expect.anything(),
    )
  })

  it('desligar o aviso registra a falta sem mandar mensagem', async () => {
    render(<AppointmentDrawer appointment={appointment} open onClose={vi.fn()} />, { wrapper })

    await userEvent.click(screen.getByRole('button', { name: /não compareceu/i }))
    const dialogo = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialogo).getByRole('switch'))
    await userEvent.click(within(dialogo).getByRole('button', { name: /^confirmar$/i }))

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'NO_SHOW', notify: false }),
      expect.anything(),
    )
  })
})
