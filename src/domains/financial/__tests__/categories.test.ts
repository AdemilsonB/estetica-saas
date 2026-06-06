import { describe, it, expect } from 'vitest'
import { isReversal, FINANCIAL_CATEGORIES } from '../categories'

describe('isReversal', () => {
  it('retorna true para category SUPPLY_REVERSAL com amount positivo', () => {
    expect(isReversal(FINANCIAL_CATEGORIES.SUPPLY_REVERSAL, 30)).toBe(true)
  })

  it('retorna true para amount negativo (compatibilidade retroativa)', () => {
    expect(isReversal(FINANCIAL_CATEGORIES.SUPPLY_USE, -30)).toBe(true)
  })

  it('retorna false para despesa normal', () => {
    expect(isReversal(FINANCIAL_CATEGORIES.SUPPLY_USE, 30)).toBe(false)
  })

  it('retorna false para receita', () => {
    expect(isReversal(FINANCIAL_CATEGORIES.SERVICE, 100)).toBe(false)
  })
})
