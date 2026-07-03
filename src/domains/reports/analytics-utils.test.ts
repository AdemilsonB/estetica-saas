import { describe, it, expect } from 'vitest'
import {
  percentDelta, pointsDelta, previousWindow, granularityFor, enumerateBuckets,
} from './analytics-utils'

describe('percentDelta', () => {
  it('calcula variação percentual arredondada', () => {
    expect(percentDelta(114, 100)).toBe(14)
    expect(percentDelta(90, 100)).toBe(-10)
  })
  it('retorna null quando período anterior é zero (sem base de comparação)', () => {
    expect(percentDelta(50, 0)).toBeNull()
  })
})

describe('pointsDelta', () => {
  it('retorna diferença em pontos percentuais', () => {
    expect(pointsDelta(80, 72)).toBe(8)
    expect(pointsDelta(60, 65)).toBe(-5)
  })
})

describe('previousWindow', () => {
  it('retorna janela de mesma duração imediatamente anterior', () => {
    const from = new Date('2026-06-01T00:00:00.000Z')
    const to = new Date('2026-06-30T23:59:59.999Z')
    const prev = previousWindow(from, to)
    expect(prev.to.getTime()).toBe(from.getTime() - 1)
    expect(prev.to.getTime() - prev.from.getTime()).toBe(to.getTime() - from.getTime())
  })
})

describe('granularityFor', () => {
  const d = (s: string) => new Date(s)
  it('dia para janelas de até 31 dias', () => {
    expect(granularityFor(d('2026-06-01'), d('2026-06-30'))).toBe('day')
  })
  it('semana para janelas de até 120 dias', () => {
    expect(granularityFor(d('2026-03-01'), d('2026-05-30'))).toBe('week')
  })
  it('mês acima de 120 dias', () => {
    expect(granularityFor(d('2026-01-01'), d('2026-12-31'))).toBe('month')
  })
})

describe('enumerateBuckets', () => {
  const tz = 'America/Sao_Paulo'
  it('dia: um bucket por dia do intervalo', () => {
    const buckets = enumerateBuckets(
      new Date('2026-06-01T03:00:00.000Z'), // 00:00 em SP
      new Date('2026-06-04T02:59:59.999Z'), // fim de 03/06 em SP
      'day', tz,
    )
    expect(buckets).toEqual(['2026-06-01', '2026-06-02', '2026-06-03'])
  })
  it('semana: buckets alinhados à segunda-feira (como date_trunc do Postgres)', () => {
    const buckets = enumerateBuckets(
      new Date('2026-06-03T03:00:00.000Z'), // quarta 03/06 em SP
      new Date('2026-06-16T03:00:00.000Z'),
      'week', tz,
    )
    expect(buckets[0]).toBe('2026-06-01') // segunda da semana de 03/06
    expect(buckets).toContain('2026-06-08')
    expect(buckets).toContain('2026-06-15')
  })
  it('mês: primeiro dia de cada mês', () => {
    const buckets = enumerateBuckets(
      new Date('2026-01-15T03:00:00.000Z'),
      new Date('2026-04-10T03:00:00.000Z'),
      'month', tz,
    )
    expect(buckets).toEqual(['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01'])
  })
})
