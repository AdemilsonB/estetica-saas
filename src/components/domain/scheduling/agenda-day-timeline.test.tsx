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
        dateLabel="Sexta-feira, 31 de julho"
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

  it('mostra a data na faixa que acompanha o scroll junto com os nomes dos profissionais', () => {
    render(
      <AgendaDayTimeline
        slots={['09:00']}
        columns={[
          { professionalId: 'p1', professionalName: 'Bruna' },
          { professionalId: 'p2', professionalName: 'Ademilson' },
        ]}
        appointmentsByProfessional={{}}
        slotIntervalMinutes={30}
        dateLabel="Sexta-feira, 31 de julho"
        canClickSlot={() => true}
        onSlotClick={vi.fn()}
        onAppointmentClick={vi.fn()}
        onConfirm={vi.fn()}
        onPay={vi.fn()}
        onEdit={vi.fn()}
      />,
    )

    expect(screen.getByText('Sexta-feira, 31 de julho')).toBeInTheDocument()
    expect(screen.getByText('Bruna')).toBeInTheDocument()
    expect(screen.getByText('Ademilson')).toBeInTheDocument()
  })

  it('não deixa clicar em slot vazio quando canClickSlot nega (sem permissão)', () => {
    const onSlotClick = vi.fn()
    render(
      <AgendaDayTimeline
        slots={['09:00']}
        columns={baseColumns}
        appointmentsByProfessional={{}}
        slotIntervalMinutes={30}
        dateLabel="Sexta-feira, 31 de julho"
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
        dateLabel="Sexta-feira, 31 de julho"
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
        slots={['09:00', '09:30', '10:00']}
        columns={baseColumns}
        appointmentsByProfessional={{ p1: [appt] }}
        slotIntervalMinutes={30}
        dateLabel="Sexta-feira, 31 de julho"
        canClickSlot={() => true}
        onSlotClick={vi.fn()}
        onAppointmentClick={vi.fn()}
        onConfirm={vi.fn()}
        onPay={vi.fn()}
        onEdit={vi.fn()}
      />,
    )

    // O card é desenhado na linha das 09:00 (bucket do início)...
    expect(screen.getByText('Maria')).toBeInTheDocument()
    // ...e a linha das 09:30 fica bloqueada, porque o atendimento só termina
    // 09:45 — invade a linha inteira. Antes ela seguia clicável e dava pra
    // marcar em cima de um horário ocupado.
    expect(screen.queryByLabelText('Novo agendamento às 09:30')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Novo agendamento às 10:00')).toBeInTheDocument()
  })

  it('um agendamento de várias horas bloqueia os slots seguintes só na coluna do profissional dele', () => {
    const appt = makeAppointment({ startsAt: '2026-08-03T09:00:00', endsAt: '2026-08-03T11:00:00' })
    const columns: TimelineColumn[] = [
      { professionalId: 'p1', professionalName: 'Bruna' },
      { professionalId: 'p2', professionalName: 'Ademilson' },
    ]

    render(
      <AgendaDayTimeline
        slots={['09:00', '09:30', '10:00', '10:30']}
        columns={columns}
        appointmentsByProfessional={{ p1: [appt], p2: [] }}
        slotIntervalMinutes={30}
        dateLabel="Sexta-feira, 31 de julho"
        canClickSlot={() => true}
        onSlotClick={vi.fn()}
        onAppointmentClick={vi.fn()}
        onConfirm={vi.fn()}
        onPay={vi.fn()}
        onEdit={vi.fn()}
      />,
    )

    // 2h de 30min = 4 linhas cobertas na coluna de p1 (09:00 é o card em si;
    // 09:30/10:00/10:30 ficam bloqueadas — só sobra o botão de p2 em cada horário).
    expect(screen.getAllByLabelText('Novo agendamento às 09:30')).toHaveLength(1)
    expect(screen.getAllByLabelText('Novo agendamento às 10:00')).toHaveLength(1)
    expect(screen.getAllByLabelText('Novo agendamento às 10:30')).toHaveLength(1)

    // O outro profissional (p2) não tem agendamento — todos os 4 slots dele continuam livres.
    const allSlotButtons = screen.getAllByLabelText(/Novo agendamento às/)
    expect(allSlotButtons).toHaveLength(4)
  })

  it('libera o horário quando o agendamento é desmarcado ou marcado como não compareceu', () => {
    const cancelado = makeAppointment({
      id: 'apt1',
      status: 'CANCELLED',
      startsAt: '2026-08-03T09:00:00',
      endsAt: '2026-08-03T11:00:00',
    })
    const noShow = makeAppointment({
      id: 'apt2',
      status: 'NO_SHOW',
      startsAt: '2026-08-03T11:00:00',
      endsAt: '2026-08-03T11:30:00',
      customer: { id: 'c2', name: 'Joana', phone: null, notes: null },
    })

    render(
      <AgendaDayTimeline
        slots={['09:00', '09:30', '10:00', '10:30', '11:00']}
        columns={baseColumns}
        appointmentsByProfessional={{ p1: [cancelado, noShow] }}
        slotIntervalMinutes={30}
        dateLabel="Sexta-feira, 31 de julho"
        canClickSlot={() => true}
        onSlotClick={vi.fn()}
        onAppointmentClick={vi.fn()}
        onConfirm={vi.fn()}
        onPay={vi.fn()}
        onEdit={vi.fn()}
      />,
    )

    // Nenhum dos dois ocupa horário (mesma regra do backend) — todas as
    // linhas voltam a ser slots vazios clicáveis e os cards somem da grade.
    expect(screen.getAllByLabelText(/Novo agendamento às/)).toHaveLength(5)
    expect(screen.queryByText('Maria')).not.toBeInTheDocument()
    expect(screen.queryByText('Joana')).not.toBeInTheDocument()
  })

  it('mantém o bloqueio de um atendimento já concluído', () => {
    const concluido = makeAppointment({
      status: 'COMPLETED',
      startsAt: '2026-08-03T09:00:00',
      endsAt: '2026-08-03T10:00:00',
    })

    render(
      <AgendaDayTimeline
        slots={['09:00', '09:30', '10:00']}
        columns={baseColumns}
        appointmentsByProfessional={{ p1: [concluido] }}
        slotIntervalMinutes={30}
        dateLabel="Sexta-feira, 31 de julho"
        canClickSlot={() => true}
        onSlotClick={vi.fn()}
        onAppointmentClick={vi.fn()}
        onConfirm={vi.fn()}
        onPay={vi.fn()}
        onEdit={vi.fn()}
      />,
    )

    // Concluir não devolve o horário: 09:00 e 09:30 seguem ocupados.
    expect(screen.getByText('Maria')).toBeInTheDocument()
    expect(screen.queryByLabelText('Novo agendamento às 09:30')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Novo agendamento às 10:00')).toBeInTheDocument()
  })

  it('junta num bloco só dois agendamentos que se sobrepõem começando em horários diferentes', () => {
    // Sem juntar, os dois viravam grid items sobrepostos na mesma coluna e um
    // desenhava por cima do outro.
    const longo = makeAppointment({
      id: 'apt1',
      startsAt: '2026-08-03T09:00:00',
      endsAt: '2026-08-03T11:00:00',
    })
    const dentro = makeAppointment({
      id: 'apt2',
      startsAt: '2026-08-03T10:00:00',
      endsAt: '2026-08-03T10:30:00',
      customer: { id: 'c2', name: 'Joana', phone: null, notes: null },
    })

    render(
      <AgendaDayTimeline
        slots={['09:00', '09:30', '10:00', '10:30', '11:00']}
        columns={baseColumns}
        appointmentsByProfessional={{ p1: [longo, dentro] }}
        slotIntervalMinutes={30}
        dateLabel="Sexta-feira, 31 de julho"
        canClickSlot={() => true}
        onSlotClick={vi.fn()}
        onAppointmentClick={vi.fn()}
        onConfirm={vi.fn()}
        onPay={vi.fn()}
        onEdit={vi.fn()}
      />,
    )

    // Os dois aparecem, mas dentro do mesmo bloco — só 11:00 fica livre.
    expect(screen.getByText('Maria')).toBeInTheDocument()
    expect(screen.getByText('Joana')).toBeInTheDocument()
    expect(screen.getAllByLabelText(/Novo agendamento às/)).toHaveLength(1)
    expect(screen.getByLabelText('Novo agendamento às 11:00')).toBeInTheDocument()
  })

  it('mantém dois agendamentos visíveis no mesmo horário quando há conflito autorizado', () => {
    const appt1 = makeAppointment({ id: 'apt1', startsAt: '2026-08-03T09:00:00', endsAt: '2026-08-03T09:30:00' })
    const appt2 = makeAppointment({
      id: 'apt2',
      startsAt: '2026-08-03T09:00:00',
      endsAt: '2026-08-03T09:30:00',
      customer: { id: 'c2', name: 'Joana', phone: null, notes: null },
    })

    render(
      <AgendaDayTimeline
        slots={['09:00']}
        columns={baseColumns}
        appointmentsByProfessional={{ p1: [appt1, appt2] }}
        slotIntervalMinutes={30}
        dateLabel="Sexta-feira, 31 de julho"
        canClickSlot={() => true}
        onSlotClick={vi.fn()}
        onAppointmentClick={vi.fn()}
        onConfirm={vi.fn()}
        onPay={vi.fn()}
        onEdit={vi.fn()}
      />,
    )

    expect(screen.getByText('Maria')).toBeInTheDocument()
    expect(screen.getByText('Joana')).toBeInTheDocument()
  })
})
