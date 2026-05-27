import type { Transaction } from '@prisma/client'
import { TransactionType, Prisma } from '@prisma/client'

export function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'transaction-test-id',
    tenantId: 'tenant-test-id',
    appointmentId: null,
    type: TransactionType.INCOME,
    category: 'servico',
    description: 'Corte de cabelo',
    amount: new Prisma.Decimal('50.00'),
    paidAt: new Date('2026-01-01T00:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}
