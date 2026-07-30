// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { AgendaDayTimeline, type TimelineColumn } from './agenda-day-timeline'
import type { Appointment } from '@/hooks/scheduling/use-appointments'

afterEach(cleanup)

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 'apt1',
    customerId: 'c1',
    professionalId: 'p1',
    serviceId: 'srv1',
    packageId: null,
    promotionId: null,
    // Sem "Z" de propósito — o Date interpreta como horário local, igual o
    // toHour() (toLocaleTimeString sem timeZone) lê de volta, então o teste
    // não depende do fuso horário de quem está rodando.
    startsAt: '2026-08-03T09:00:00',
    endsAt: '2026-08-03T09:30:00',
    status: 'SCHEDULED',
    paymentStatus: 'PENDING',
    notes: null,
    price: '50',
    confirmedPrice: null,
    customer: { id: 'c1', name: 'Maria', phone: null, notes: null },
    professional: { id: 'p1', name: 'Bruna' },
    service: { id: 'srv1', name: 'Corte', duration: 30 },
    package: null,
    promotion: null,
    ...overrides,
  }
}

const baseColumns: TimelineColumn[] = [{ professionalId: 'p1', professionalName: 'Bruna' }]

describe('AgendaDayTimeline', () => {
  it('chama onSlotClick com profissional e horário ao clicar num slot vazio', () => {
    const onSlotClick = vi.fn()
    render(
      <AgendaDayTimeline
        slots={['09:00', '09:30']}
        columns={baseColumns}
        appointmentsByProfessional={{}}
        slotIntervalMinutes={30}
        canClickSlot={() => true}
        onSlotClick={onSlotClick}
        onAppointmentClick={vi.fn()}
        onConfirm={vi.fn()}
        onPay={vi.fn()}
        onEdit={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByLabelText('Novo agendamento às 09:30'))
    expect(onSlotClick).toHaveBeenCalledWith('p1', '09:30')
  })

  it('não deixa clicar em slot vazio quando canClickSlot nega (sem permissão)', () => {
    const onSlotClick = vi.fn()
    render(
      <AgendaDayTimeline
        slots={['09:00']}
        columns={baseColumns}
        appointmentsByProfessional={{}}
        slotIntervalMinutes={30}
        canClickSlot={() => false}
        onSlotClick={onSlotClick}
        onAppointmentClick={vi.fn()}
        onConfirm={vi.fn()}
        onPay={vi.fn()}
        onEdit={vi.fn()}
      />,
    )

    // Sem permissão o botão nem ganha aria-label (não é anunciado como ação) e fica desabilitado.
    expect(screen.queryByLabelText('Novo agendamento às 09:00')).not.toBeInTheDocument()
    const slotButton = document.querySelector('button')
    expect(slotButton).toBeDisabled()
    if (slotButton) fireEvent.click(slotButton)
    expect(onSlotClick).not.toHaveBeenCalled()
  })

  it('mostra o agendamento existente no slot em vez do botão de slot vazio, e clique nele não dispara onSlotClick', () => {
    const onSlotClick = vi.fn()
    const onAppointmentClick = vi.fn()
    const appt = makeAppointment()

    render(
      <AgendaDayTimeline
        slots={['09:00']}
        columns={baseColumns}
        appointmentsByProfessional={{ p1: [appt] }}
        slotIntervalMinutes={30}
        canClickSlot={() => true}
        onSlotClick={onSlotClick}
        onAppointmentClick={onAppointmentClick}
        onConfirm={vi.fn()}
        onPay={vi.fn()}
        onEdit={vi.fn()}
      />,
    )

    expect(screen.getByText('Maria')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Maria'))

    expect(onAppointmentClick).toHaveBeenCalledWith(appt)
    expect(onSlotClick).not.toHaveBeenCalled()
  })

  it('agrupa um agendamento com horário fora do slot exato (ex.: 09:15) na linha anterior', () => {
    const appt = makeAppointment({ startsAt: '2026-08-03T09:15:00', endsAt: '2026-08-03T09:45:00' })

    render(
      <AgendaDayTimeline
        slots={['09:00', '09:30']}
        columns={baseColumns}
        appointmentsByProfessional={{ p1: [appt] }}
        slotIntervalMinutes={30}
        canClickSlot={() => true}
        onSlotClick={vi.fn()}
        onAppointmentClick={vi.fn()}
        onConfirm={vi.fn()}
        onPay={vi.fn()}
        onEdit={vi.fn()}
      />,
    )

    // 09:30 continua vazio e clicável — o agendamento das 09:15 caiu no bucket de 09:00.
    expect(screen.getByLabelText('Novo agendamento às 09:30')).toBeInTheDocument()
  })
})
