import { describe, expect, it } from 'vitest'
import { formatBrazilianPhone } from './phone'

describe('formatBrazilianPhone', () => {
  it('formata celular de 11 dígitos', () => {
    expect(formatBrazilianPhone('11987654321')).toBe('(11) 98765-4321')
  })

  it('formata fixo de 10 dígitos', () => {
    expect(formatBrazilianPhone('1133334444')).toBe('(11) 3333-4444')
  })

  it('remove o DDI 55 antes de formatar', () => {
    expect(formatBrazilianPhone('5511987654321')).toBe('(11) 98765-4321')
    expect(formatBrazilianPhone('551133334444')).toBe('(11) 3333-4444')
  })

  it('devolve como veio quando não é padrão brasileiro', () => {
    expect(formatBrazilianPhone('14155550100')).toBe('(14) 15555-0100')
    expect(formatBrazilianPhone('123')).toBe('123')
  })
})
