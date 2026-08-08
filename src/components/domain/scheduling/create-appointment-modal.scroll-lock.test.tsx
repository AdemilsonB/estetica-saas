// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock('@/components/domain/services/service-picker-with-categories', () => ({
  ServicePickerWithCategories: () => null,
}))

vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ data: { id: 'u1', name: 'Ana Dona' } }),
}))
vi.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({ can: () => true, user: { id: 'u1' } }),
}))
vi.mock('@/hooks/scheduling/use-services', () => ({ useServices: () => ({ data: [] }) }))
vi.mock('@/hooks/scheduling/use-service-categories', () => ({ useServiceCategories: () => ({ data: [] }) }))
vi.mock('@/hooks/scheduling/use-packages', () => ({ usePackages: () => ({ data: [] }) }))
vi.mock('@/hooks/scheduling/use-promotions', () => ({ usePromotions: () => ({ data: [] }) }))
vi.mock('@/hooks/iam/use-team', () => ({
  useTeamMembers: () => ({ data: [{ id: 'u1', name: 'Ana Dona', role: 'OWNER' }] }),
  useProfessionalsByService: () => ({ data: null }),
}))
vi.mock('@/hooks/settings/use-evolution-status', () => ({
  useEvolutionStatus: () => ({ data: { connected: true } }),
  useEvolutionContacts: () => ({ data: { contacts: [], total: 0 }, isLoading: false, isError: false }),
}))
vi.mock('@/hooks/crm/use-customers-search', () => ({ useCustomersSearch: () => ({ data: [], isLoading: false }) }))
vi.mock('@/hooks/crm/use-customers', () => ({ useCreateCustomer: () => ({ mutate: vi.fn(), isPending: false }) }))
vi.mock('@/hooks/crm/use-import-contacts', () => ({
  useImportContacts: () => ({ step: 'idle', contacts: [], error: null, reset: vi.fn(), pickFromVCards: vi.fn(), pickFromDevice: vi.fn() }),
  supportsContactPicker: () => false,
}))
vi.mock('@/hooks/scheduling/use-availability', () => ({ useAvailableSlots: () => ({ data: [], isLoading: false }) }))
vi.mock('@/hooks/scheduling/use-appointments', () => ({ useCreateAppointment: () => ({ mutate: vi.fn(), isPending: false }) }))

import { CreateAppointmentModal } from './create-appointment-modal'

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

afterEach(() => {
  cleanup()
  document.body.removeAttribute('data-scroll-locked')
})

/**
 * Bug real de produção: com o Dialog raiz sempre `modal` (padrão do Radix), o
 * bloqueio global de scroll (react-remove-scroll, marcado por
 * `body[data-scroll-locked]`) intercepta wheel/touch no documento inteiro —
 * inclusive dentro do dialog empilhado "Novo cliente" e do "Contatos do
 * WhatsApp" dentro dele, que são portais irmãos, fora da subárvore que o
 * lock reconhece como rolável. O scroll deles fica preso sem responder a
 * mouse nem toque, apesar do CSS estar correto. Corrigido em
 * create-appointment-modal.tsx passando `modal={!newCustomerOpen}` ao Dialog
 * raiz — o lock global se desliga enquanto o filho empilhado está aberto.
 */
describe('CreateAppointmentModal — modal-lock não pode vazar pro dialog empilhado', () => {
  it('desliga o lock global de scroll do body enquanto "Novo cliente" está aberto, e religa ao fechar', async () => {
    const user = userEvent.setup()
    render(<CreateAppointmentModal open onClose={vi.fn()} />)

    expect(document.body).toHaveAttribute('data-scroll-locked')

    await user.click(screen.getByLabelText('Novo cliente'))
    expect(screen.getByText('Novo cliente')).toBeInTheDocument()
    expect(document.body).not.toHaveAttribute('data-scroll-locked')

    await user.keyboard('{Escape}')
  })
})
