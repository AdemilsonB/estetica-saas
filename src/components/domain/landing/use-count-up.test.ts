// src/components/domain/landing/use-count-up.test.ts
import { describe, it, expect } from 'vitest'
import { parseMetric, formatMetric } from './use-count-up'

describe('parseMetric', () => {
  it('separa prefixo, número e sufixo', () => {
    expect(parseMetric('+1.200')).toEqual({ prefix: '+', number: 1200, decimals: 0, suffix: '' })
    expect(parseMetric('98%')).toEqual({ prefix: '', number: 98, decimals: 0, suffix: '%' })
    expect(parseMetric('-40%')).toEqual({ prefix: '-', number: 40, decimals: 0, suffix: '%' })
    expect(parseMetric('24h')).toEqual({ prefix: '', number: 24, decimals: 0, suffix: 'h' })
  })

  it('trata decimal pt-BR', () => {
    expect(parseMetric('4,9')).toEqual({ prefix: '', number: 4.9, decimals: 1, suffix: '' })
  })

  it('retorna null quando não há número', () => {
    expect(parseMetric('sem número')).toBeNull()
  })
})

describe('formatMetric', () => {
  it('formata milhar e decimal em pt-BR', () => {
    expect(formatMetric(1200, 0)).toBe('1.200')
    expect(formatMetric(4.9, 1)).toBe('4,9')
    expect(formatMetric(98, 0)).toBe('98')
  })
})
