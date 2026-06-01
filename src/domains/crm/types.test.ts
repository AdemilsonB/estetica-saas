import { describe, it, expect } from 'vitest'
import { listCustomersSchema } from './types'

describe('listCustomersSchema', () => {
  it('aceita os novos filtros booleanos como string', () => {
    const result = listCustomersSchema.parse({ onlyVip: 'true', hasPendingDebt: 'false' })
    expect(result.onlyVip).toBe(true)
    expect(result.hasPendingDebt).toBe(false)
  })

  it('aceita birthdayMonth como número 1-12', () => {
    const result = listCustomersSchema.parse({ birthdayMonth: '6' })
    expect(result.birthdayMonth).toBe(6)
  })

  it('rejeita birthdayMonth fora do intervalo', () => {
    expect(() => listCustomersSchema.parse({ birthdayMonth: '13' })).toThrow()
  })

  it('aceita noAppointmentDays e minAvgTicket', () => {
    const result = listCustomersSchema.parse({ noAppointmentDays: '30', minAvgTicket: '100.5' })
    expect(result.noAppointmentDays).toBe(30)
    expect(result.minAvgTicket).toBe(100.5)
  })

  it('mantém defaults dos campos existentes', () => {
    const result = listCustomersSchema.parse({})
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(20)
  })
})
