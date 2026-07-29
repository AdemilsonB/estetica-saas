// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const mutate = vi.fn()
vi.mock('@/hooks/scheduling/use-appointments', () => ({
  useUpdateAppointmentStatus: () => ({ mutate, isPending: false }),
}))
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: null, isLoading: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))
vi.mock('@/components/domain/notifications/customer-message-toggle', () => ({
  CustomerMessageToggle: () => null,
}))

import { ConfirmAppointmentModal } from '@/components/domain/scheduling/confirm-appointment-modal'

const appointment = {
  id: 'apt-1',
  customerId: 'cli-1',
  customer: { name: 'Daniela Martins' },
  professional: { name: 'Ana' },
  service: { name: 'Corte Feminino' },
  price: '80.00',
} as never

afterEach(() => {
  cleanup()
  mutate.mockClear()
})

describe('ConfirmAppointmentModal — campo de valor', () => {
  it('abre com o preço do serviço já mascarado', () => {
    render(<ConfirmAppointmentModal appointment={appointment} open onClose={vi.fn()} />)
    expect(screen.getByLabelText(/Valor a cobrar/)).toHaveValue('80,00')
  })

  it('permite esvaziar o campo — não reintroduz um zero preso', () => {
    render(<ConfirmAppointmentModal appointment={appointment} open onClose={vi.fn()} />)
    const input = screen.getByLabelText(/Valor a cobrar/)
    fireEvent.change(input, { target: { value: '' } })
    expect(input).toHaveValue('')
  })

  it('bloqueia a confirmação enquanto o valor estiver vazio', () => {
    render(<ConfirmAppointmentModal appointment={appointment} open onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/Valor a cobrar/), { target: { value: '' } })

    const submit = screen.getByRole('button', { name: /Confirmar e enviar/ })
    expect(submit).toBeDisabled()

    fireEvent.click(submit)
    expect(mutate).not.toHaveBeenCalled()
  })

  it('aceita zero explícito e envia o valor numérico', () => {
    render(<ConfirmAppointmentModal appointment={appointment} open onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/Valor a cobrar/), { target: { value: '0' } })
    expect(screen.getByLabelText(/Valor a cobrar/)).toHaveValue('0,00')

    fireEvent.click(screen.getByRole('button', { name: /Confirmar e enviar/ }))
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ confirmedPrice: 0 }),
      expect.anything(),
    )
  })

  it('envia o valor digitado com os centavos formados da direita para a esquerda', () => {
    render(<ConfirmAppointmentModal appointment={appointment} open onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/Valor a cobrar/), { target: { value: '35098' } })
    expect(screen.getByLabelText(/Valor a cobrar/)).toHaveValue('350,98')

    fireEvent.click(screen.getByRole('button', { name: /Confirmar e enviar/ }))
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ confirmedPrice: 350.98 }),
      expect.anything(),
    )
  })
})
