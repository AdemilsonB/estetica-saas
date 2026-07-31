import { describe, it, expect } from 'vitest'
import {
  appointmentSlotSpan,
  appointmentSlotTimes,
  buildDaySlots,
  occupiesSlot,
  slotBucket,
  toDateInputLocal,
} from './day-slots'

describe('buildDaySlots', () => {
  it('gera slots de 30 em 30 min dentro do expediente', () => {
    expect(buildDaySlots({ open: '09:00', close: '11:00', active: true }, 30)).toEqual([
      '09:00', '09:30', '10:00', '10:30',
    ])
  })

  it('respeita um intervalo diferente de 30 min', () => {
    expect(buildDaySlots({ open: '09:00', close: '10:00', active: true }, 15)).toEqual([
      '09:00', '09:15', '09:30', '09:45',
    ])
  })

  it('não inclui o horário de fechamento', () => {
    expect(buildDaySlots({ open: '09:00', close: '09:30', active: true }, 30)).toEqual(['09:00'])
  })

  it('retorna vazio quando o dia está marcado como fechado', () => {
    expect(buildDaySlots({ open: '09:00', close: '18:00', active: false }, 30)).toEqual([])
  })

  it('retorna vazio quando não há horário de expediente configurado', () => {
    expect(buildDaySlots(undefined, 30)).toEqual([])
  })
})

describe('slotBucket', () => {
  it('agrupa um horário exato de slot nele mesmo', () => {
    expect(slotBucket('09:30', 30)).toBe('09:30')
  })

  it('agrupa um horário digitado manualmente na linha anterior', () => {
    expect(slotBucket('09:15', 30)).toBe('09:00')
    expect(slotBucket('09:44', 30)).toBe('09:30')
  })

  it('funciona com intervalo de 15 min', () => {
    expect(slotBucket('09:07', 15)).toBe('09:00')
    expect(slotBucket('09:16', 15)).toBe('09:15')
  })
})

describe('toDateInputLocal', () => {
  it('formata a data no fuso local, não em UTC', () => {
    // 23h30 de um dia em horário local — toISOString() em fuso negativo
    // avançaria pra data seguinte; a versão local não pode fazer isso.
    const d = new Date(2026, 6, 30, 23, 30)
    expect(toDateInputLocal(d)).toBe('2026-07-30')
  })

  it('preenche mês e dia com zero à esquerda', () => {
    const d = new Date(2026, 0, 5)
    expect(toDateInputLocal(d)).toBe('2026-01-05')
  })
})

describe('appointmentSlotSpan', () => {
  it('agendamento de exatamente 1 intervalo ocupa 1 linha', () => {
    expect(appointmentSlotSpan('2026-08-03T09:00:00', '2026-08-03T09:30:00', 30)).toBe(1)
  })

  it('agendamento de 4 horas num grid de 30min ocupa 8 linhas', () => {
    expect(appointmentSlotSpan('2026-08-03T09:00:00', '2026-08-03T13:00:00', 30)).toBe(8)
  })

  it('arredonda pra cima quando a duração não é múltipla do intervalo', () => {
    // 45min num grid de 30min precisa de 2 linhas, não 1,5.
    expect(appointmentSlotSpan('2026-08-03T09:00:00', '2026-08-03T09:45:00', 30)).toBe(2)
  })

  it('nunca retorna menos de 1 linha', () => {
    expect(appointmentSlotSpan('2026-08-03T09:00:00', '2026-08-03T09:10:00', 30)).toBe(1)
  })
})

describe('occupiesSlot', () => {
  it('desmarcado e não compareceu deixam o horário livre', () => {
    expect(occupiesSlot('CANCELLED')).toBe(false)
    expect(occupiesSlot('NO_SHOW')).toBe(false)
  })

  it('agendado, confirmado e concluído seguem ocupando o horário', () => {
    expect(occupiesSlot('SCHEDULED')).toBe(true)
    expect(occupiesSlot('CONFIRMED')).toBe(true)
    // Concluir o atendimento não devolve o horário para a grade.
    expect(occupiesSlot('COMPLETED')).toBe(true)
  })
})

describe('appointmentSlotTimes', () => {
  it('devolve todas as linhas da duração, não só a de início', () => {
    expect(appointmentSlotTimes('2026-08-03T09:00:00', '2026-08-03T10:30:00', 30)).toEqual([
      '09:00', '09:30', '10:00',
    ])
  })

  it('parte do bucket quando o horário não bate com a linha exata', () => {
    expect(appointmentSlotTimes('2026-08-03T09:15:00', '2026-08-03T09:45:00', 30)).toEqual([
      '09:00', '09:30',
    ])
  })

  it('não vaza para o dia seguinte', () => {
    expect(appointmentSlotTimes('2026-08-03T23:30:00', '2026-08-04T01:00:00', 30)).toEqual(['23:30'])
  })
})
