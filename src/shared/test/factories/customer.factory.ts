import type { Customer } from '@prisma/client'

export function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'customer-test-id',
    tenantId: 'tenant-test-id',
    name: 'Cliente Teste',
    phone: '11999999999',
    email: 'cliente@test.com',
    notes: null,
    tags: [],
    consentGiven: false,
    consentDate: null,
    consentOrigin: null,
    birthDate: null,
    cpf: null,
    isVip: false,
    vipUpdatedAt: null,
    isBlocked: false,
    blockedReason: null,
    blockedAt: null,
    deletedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}
