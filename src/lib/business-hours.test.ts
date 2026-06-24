import { describe, it, expect } from 'vitest'
import { isOpenNow, getWeekdayIndex, weekdayLabel, formatHourRange, type BusinessHoursMap } from './business-hours'

describe('getWeekdayIndex', () => {
  it('retorna o índice do dia da semana (0=domingo) no fuso informado', () => {
    const ref = new Date('2026-06-23T15:00:00Z') // terça-feira, 12:00 BRT
    expect(getWeekdayIndex('America/Sao_Paulo', ref)).toBe(2)
  })
})

describe('isOpenNow', () => {
  const hours: BusinessHoursMap = {
    '2': { open: '09:00', close: '20:00', active: true }, // terça
    '3': { open: '09:00', close: '20:00', active: false }, // quarta fechada
  }

  it('retorna true quando o horário atual está dentro do range de um dia ativo', () => {
    const ref = new Date('2026-06-23T15:00:00Z') // terça, 12:00 BRT
    expect(isOpenNow(hours, 'America/Sao_Paulo', ref)).toBe(true)
  })

  it('retorna false quando o horário atual está fora do range', () => {
    const ref = new Date('2026-06-23T23:30:00Z') // terça, 20:30 BRT — depois de fechar
    expect(isOpenNow(hours, 'America/Sao_Paulo', ref)).toBe(false)
  })

  it('retorna false quando o dia está marcado como inativo', () => {
    const ref = new Date('2026-06-24T15:00:00Z') // quarta, 12:00 BRT
    expect(isOpenNow(hours, 'America/Sao_Paulo', ref)).toBe(false)
  })

  it('retorna true (fail-open) quando businessHours é nulo ou inválido', () => {
    const ref = new Date('2026-06-23T15:00:00Z')
    expect(isOpenNow(null, 'America/Sao_Paulo', ref)).toBe(true)
    expect(isOpenNow(undefined, 'America/Sao_Paulo', ref)).toBe(true)
  })
})

describe('formatHourRange', () => {
  it('formata o intervalo de um dia ativo', () => {
    expect(formatHourRange({ open: '09:00', close: '18:00', active: true })).toBe('09:00 – 18:00')
  })

  it('retorna "Fechado" para dia inativo ou ausente', () => {
    expect(formatHourRange({ open: '09:00', close: '18:00', active: false })).toBe('Fechado')
    expect(formatHourRange(undefined)).toBe('Fechado')
  })
})

describe('weekdayLabel', () => {
  it('retorna o nome completo e a forma curta do dia pelo índice', () => {
    expect(weekdayLabel(2)).toBe('Terça')
    expect(weekdayLabel(2, true)).toBe('Ter')
    expect(weekdayLabel(0)).toBe('Domingo')
  })
})
