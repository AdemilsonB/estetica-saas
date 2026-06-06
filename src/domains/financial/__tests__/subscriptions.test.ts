import { describe, it, expect, vi, beforeAll } from 'vitest'
import { TransactionType } from '@prisma/client'
import { FINANCIAL_CATEGORIES } from '../categories'

vi.mock('../transaction.repository')
vi.mock('@/shared/events/event-bus')
vi.mock('@/shared/database/prisma')

import { registerFinancialSubscriptions } from '../subscriptions'
import { transactionRepository } from '../transaction.repository'
import { eventBus } from '@/shared/events/event-bus'

describe('registerFinancialSubscriptions', () => {
  const capturedHandlers: Record<string, (payload: Record<string, unknown>) => Promise<void>> = {}

  beforeAll(() => {
    const mockCreate = vi.fn().mockResolvedValue({ id: 'tx-1' })
    const mockSubscribe = vi.fn((event: string, handler: (p: Record<string, unknown>) => Promise<void>) => {
      capturedHandlers[event] = handler
    })

    Object.assign(transactionRepository, { create: mockCreate })
    Object.assign(eventBus, { subscribe: mockSubscribe, publish: vi.fn() })

    registerFinancialSubscriptions()
  })

  it('stock.appointment_restore cria EXPENSE com category SUPPLY_REVERSAL e amount positivo', async () => {
    const mockCreate = vi.mocked(transactionRepository.create)
    mockCreate.mockClear()

    await capturedHandlers['stock.appointment_restore']({
      tenantId: 'tenant-1',
      appointmentId: 'appt-1',
      productName: 'Shampoo Belize',
      serviceName: 'Progressiva',
      customerName: 'Ana',
      quantity: 1,
      costPrice: 30,
      totalCost: 30,
      productId: 'prod-1',
    })

    expect(mockCreate).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        type: TransactionType.EXPENSE,
        category: FINANCIAL_CATEGORIES.SUPPLY_REVERSAL,
      }),
    )

    const createArg = mockCreate.mock.calls[0][1]
    expect(Number(createArg.amount)).toBeGreaterThan(0)
    expect(createArg.description).toContain('Shampoo Belize')
  })
})
