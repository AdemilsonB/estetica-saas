import { describe, it, expect } from 'vitest'
import { localDateTimeToUtc } from '@/lib/dates'

describe('localDateTimeToUtc', () => {
  it('converte 09:00 em America/Sao_Paulo para 12:00 UTC', () => {
    const result = localDateTimeToUtc('2026-06-04', '09:00', 'America/Sao_Paulo')
    expect(result.toISOString()).toBe('2026-06-04T12:00:00.000Z')
  })

  it('converte 00:00 em America/Sao_Paulo para 03:00 UTC', () => {
    const result = localDateTimeToUtc('2026-06-04', '00:00', 'America/Sao_Paulo')
    expect(result.toISOString()).toBe('2026-06-04T03:00:00.000Z')
  })

  it('converte 18:00 em America/Sao_Paulo para 21:00 UTC', () => {
    const result = localDateTimeToUtc('2026-06-04', '18:00', 'America/Sao_Paulo')
    expect(result.toISOString()).toBe('2026-06-04T21:00:00.000Z')
  })
})
