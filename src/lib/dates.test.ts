import { describe, it, expect } from 'vitest'
import { dayBoundsInTz, monthBoundsInTz } from './dates'

describe('dayBoundsInTz', () => {
  it('retorna meia-noite BRT (UTC-3) como start para America/Sao_Paulo no inverno', async () => {
    // 2026-06-15 = inverno no Brasil = BRT = UTC-3
    const ref = new Date('2026-06-15T15:00:00Z') // 12:00 BRT, dia 15
    const { start, end } = dayBoundsInTz('America/Sao_Paulo', ref)
    expect(start.toISOString()).toBe('2026-06-15T03:00:00.000Z') // 00:00 BRT
    expect(end.toISOString()).toBe('2026-06-16T02:59:59.999Z')   // 23:59:59 BRT
  }, 10000)

  it('retorna limites idênticos ao UTC quando timezone é UTC', () => {
    const ref = new Date('2026-06-15T15:00:00Z')
    const { start, end } = dayBoundsInTz('UTC', ref)
    expect(start.toISOString()).toBe('2026-06-15T00:00:00.000Z')
    expect(end.toISOString()).toBe('2026-06-15T23:59:59.999Z')
  })

  it('não cruza o dia local quando o ref é às 23h BRT', async () => {
    // 23:00 BRT = 02:00 UTC do dia seguinte — o dia local ainda é o mesmo
    const ref = new Date('2026-06-16T02:00:00Z') // 23:00 BRT do dia 15
    const { start, end } = dayBoundsInTz('America/Sao_Paulo', ref)
    expect(start.toISOString()).toBe('2026-06-15T03:00:00.000Z') // ainda dia 15 BRT
    expect(end.toISOString()).toBe('2026-06-16T02:59:59.999Z')
  }, 10000)
})

describe('monthBoundsInTz', () => {
  it('retorna dia 1 às 00:00 BRT como start e último dia às 23:59 BRT como end', async () => {
    const ref = new Date('2026-06-15T15:00:00Z') // meio do mês, BRT
    const { start, end } = monthBoundsInTz('America/Sao_Paulo', ref)
    expect(start.toISOString()).toBe('2026-06-01T03:00:00.000Z') // 00:00 BRT junho 1
    expect(end.toISOString()).toBe('2026-07-01T02:59:59.999Z')   // 23:59:59 BRT junho 30
  }, 10000)

  it('retorna mês correto quando ref está no último dia do mês às 22h30 BRT', async () => {
    const ref = new Date('2026-07-01T01:30:00Z') // 22:30 BRT de 30/06
    const { start, end } = monthBoundsInTz('America/Sao_Paulo', ref)
    expect(start.toISOString()).toBe('2026-06-01T03:00:00.000Z') // ainda junho
    expect(end.toISOString()).toBe('2026-07-01T02:59:59.999Z')
  }, 10000)
})
