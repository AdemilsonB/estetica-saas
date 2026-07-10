// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// Stub do modal de cliente: expõe um botão que dispara onCreated para simular criação.
vi.mock('@/components/domain/crm/create-customer-modal', () => ({
  CreateCustomerModal: ({
    open,
    onCreated,
  }: {
    open: boolean
    onClose: () => void
    onCreated?: (c: { id: string; name: string }) => void
  }) =>
    open ? (
      <button type="button" onClick={() => onCreated?.({ id: 'cli-9', name: 'Maria Nova' })}>
        stub-criar-cliente
      </button>
    ) : null,
}))

// Hooks usados pelo CreateAppointmentModal — stubs mínimos.
vi.mock('@/hooks/use-current-user', () => ({ useCurrentUser: () => ({ data: { id: 'u1' } }) }))
vi.mock('@/hooks/use-permissions', () => ({ usePermissions: () => ({ can: () => true, user: { id: 'u1' } }) }))
vi.mock('@/hooks/scheduling/use-services', () => ({ useServices: () => ({ data: [] }) }))
vi.mock('@/hooks/scheduling/use-service-categories', () => ({ useServiceCategories: () => ({ data: [] }) }))
vi.mock('@/hooks/scheduling/use-packages', () => ({ usePackages: () => ({ data: [] }) }))
vi.mock('@/hooks/scheduling/use-promotions', () => ({ usePromotions: () => ({ data: [] }) }))
vi.mock('@/hooks/iam/use-team', () => ({
  useTeamMembers: () => ({ data: [] }),
  useProfessionalsByService: () => ({ data: null }),
}))
vi.mock('@/hooks/settings/use-evolution-status', () => ({ useEvolutionStatus: () => ({ data: { connected: true } }) }))
vi.mock('@/hooks/crm/use-customers-search', () => ({ useCustomersSearch: () => ({ data: [], isLoading: false }) }))
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

afterEach(cleanup)

describe('CreateAppointmentModal — cadastro inline de cliente', () => {
  it('abre o cadastro empilhado e seleciona o cliente recém-criado', () => {
    render(<CreateAppointmentModal open onClose={() => {}} />)

    fireEvent.click(screen.getByLabelText('Novo cliente'))
    fireEvent.click(screen.getByText('stub-criar-cliente'))

    // O nome do cliente criado passa a preencher o campo de busca.
    expect(screen.getByDisplayValue('Maria Nova')).toBeInTheDocument()
  })
})
