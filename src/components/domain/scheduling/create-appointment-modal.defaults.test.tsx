// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/components/domain/crm/create-customer-modal', () => ({
  CreateCustomerModal: () => null,
}))

// Stub do picker de serviço: um botão por serviço passado, dispara onSelect
// como se o usuário tivesse escolhido aquele serviço na UI real.
vi.mock('@/components/domain/services/service-picker-with-categories', () => ({
  ServicePickerWithCategories: ({
    services,
    onSelect,
  }: {
    services: { id: string; name: string }[]
    onSelect: (s: { type: 'service'; item: { id: string; name: string } }) => void
  }) => (
    <div>
      {services.map((s) => (
        <button key={s.id} type="button" onClick={() => onSelect({ type: 'service', item: s })}>
          stub-servico-{s.name}
        </button>
      ))}
    </div>
  ),
}))

vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ data: { id: 'u1', name: 'Ana Dona' } }),
}))
vi.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({ can: () => true, user: { id: 'u1' } }),
}))
vi.mock('@/hooks/scheduling/use-services', () => ({
  useServices: () => ({ data: [{ id: 'srv1', name: 'Corte', active: true, duration: 30, price: 10 }] }),
}))
vi.mock('@/hooks/scheduling/use-service-categories', () => ({ useServiceCategories: () => ({ data: [] }) }))
vi.mock('@/hooks/scheduling/use-packages', () => ({ usePackages: () => ({ data: [] }) }))
vi.mock('@/hooks/scheduling/use-promotions', () => ({ usePromotions: () => ({ data: [] }) }))

const { useProfessionalsByServiceMock } = vi.hoisted(() => ({
  useProfessionalsByServiceMock: vi.fn(() => ({ data: null })),
}))
vi.mock('@/hooks/iam/use-team', () => ({
  useTeamMembers: () => ({
    data: [
      { id: 'u1', name: 'Ana Dona', role: 'OWNER' },
      { id: 'p2', name: 'Bruna Cabelo', role: 'PROFESSIONAL' },
    ],
  }),
  useProfessionalsByService: (serviceId: string | null) => useProfessionalsByServiceMock(serviceId),
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

afterEach(() => {
  cleanup()
  useProfessionalsByServiceMock.mockReturnValue({ data: null })
})

function professionalSelectValue(): string | null {
  // O Select do shadcn/Radix mantém um <select> nativo escondido em sincronia
  // com o valor selecionado — é o jeito estável de checar o valor sem depender
  // de o dropdown ter sido aberto (o SelectContent só monta itens quando aberto).
  const hiddenSelect = document.querySelector('select[aria-hidden="true"]') as HTMLSelectElement | null
  return hiddenSelect?.value ?? null
}

describe('CreateAppointmentModal — default de profissional', () => {
  it('usa o profissional logado como default quando não veio de um clique na timeline', () => {
    render(<CreateAppointmentModal open onClose={() => {}} />)
    expect(professionalSelectValue()).toBe('u1')
  })

  it('usa o profissional vindo do clique na timeline (defaultProfessionalId) em vez do logado', () => {
    render(<CreateAppointmentModal open onClose={() => {}} defaultProfessionalId="p2" defaultTime="09:30" />)
    expect(professionalSelectValue()).toBe('p2')
    expect(screen.getByLabelText('Horário')).toHaveValue('09:30')
  })

  it('preenche a Data com o defaultDate recebido', () => {
    render(<CreateAppointmentModal open onClose={() => {}} defaultDate="2026-08-03" />)
    // Campo Data é um botão (Popover + Calendar) — o valor aplicado aparece
    // como texto formatado, não como .value de input.
    expect(screen.getByLabelText('Data')).toHaveTextContent('03 de ago. de 2026')
  })

  it('aplica a data assim que um dia é clicado no calendário, sem botão de confirmar', () => {
    render(<CreateAppointmentModal open onClose={() => {}} defaultDate="2026-08-03" />)

    fireEvent.click(screen.getByLabelText('Data'))
    fireEvent.click(screen.getByRole('button', { name: /10 de agosto/i }))

    // O botão já reflete o novo valor e o calendário fechou sozinho — sem
    // precisar de um segundo clique num "Confirmar".
    expect(screen.getByLabelText('Data')).toHaveTextContent('10 de ago. de 2026')
    expect(screen.queryByRole('button', { name: /10 de agosto/i })).not.toBeInTheDocument()
  })

  it('mantém o horário vindo do clique na grade depois de escolher o serviço', () => {
    // Regressão: o horário do slot clicado era apagado ao selecionar o
    // serviço — e como o serviço é escolhido DEPOIS de abrir o modal, o campo
    // sempre voltava vazio, anulando o pré-preenchimento da grade.
    render(
      <CreateAppointmentModal open onClose={() => {}} defaultProfessionalId="p2" defaultTime="09:30" />,
    )
    expect(screen.getByLabelText('Horário')).toHaveValue('09:30')

    fireEvent.click(screen.getByText('stub-servico-Corte'))

    expect(screen.getByLabelText('Horário')).toHaveValue('09:30')
  })

  it('troca pro profissional vinculado ao serviço quando só um está vinculado', () => {
    useProfessionalsByServiceMock.mockReturnValue({
      data: { filtered: true, professionals: [{ id: 'p2', name: 'Bruna Cabelo' }] },
    })

    render(<CreateAppointmentModal open onClose={() => {}} />)
    expect(professionalSelectValue()).toBe('u1') // default inicial, antes de escolher o serviço

    fireEvent.click(screen.getByText('stub-servico-Corte'))

    expect(professionalSelectValue()).toBe('p2')
  })

  it('limpa a seleção quando vários profissionais estão vinculados e o logado não é um deles', () => {
    useProfessionalsByServiceMock.mockReturnValue({
      data: {
        filtered: true,
        professionals: [
          { id: 'p2', name: 'Bruna Cabelo' },
          { id: 'p3', name: 'Carlos Camargo' },
        ],
      },
    })

    render(<CreateAppointmentModal open onClose={() => {}} />)
    fireEvent.click(screen.getByText('stub-servico-Corte'))

    // Um <select> nativo sem <option value=""> cai pra primeira opção por
    // padrão (semântica do próprio HTML) — a checagem confiável de "limpo"
    // aqui é o placeholder do trigger reaparecendo, não o <select> escondido.
    expect(screen.getByText('Selecionar profissional')).toBeInTheDocument()
  })

  it('mantém o profissional logado quando ninguém está vinculado ao serviço', () => {
    // filtered:false no mundo real vem com o fallback de todos os elegíveis
    // (inclui o próprio usuário logado), nunca lista vazia.
    useProfessionalsByServiceMock.mockReturnValue({
      data: {
        filtered: false,
        professionals: [
          { id: 'u1', name: 'Ana Dona' },
          { id: 'p2', name: 'Bruna Cabelo' },
        ],
      },
    })

    render(<CreateAppointmentModal open onClose={() => {}} />)
    fireEvent.click(screen.getByText('stub-servico-Corte'))

    expect(professionalSelectValue()).toBe('u1')
  })
})
