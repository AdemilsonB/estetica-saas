import { describe, it, expect, vi, beforeAll } from 'vitest'
import { TransactionType } from '@prisma/client'
import { FINANCIAL_CATEGORIES } from '../categories'

vi.mock('../transaction.repository')
vi.mock('@/shared/events/event-bus')
vi.mock('@/shared/database/prisma')

import { registerFinancialSubscriptions } from '../subscriptions'
import { transactionRepository } from '../transaction.repository'
import { eventBus } from '@/shared/events/event-bus'
import { prisma } from '@/shared/database/prisma'

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

  it('payment_refunded cria INCOME com category SERVICE_REVERSAL e amounts negativos espelhando a transação original', async () => {
    const mockCreate = vi.mocked(transactionRepository.create)
    mockCreate.mockClear()
    const mockFindByAppointmentId = vi.fn().mockResolvedValue([
      { amount: 100, netAmount: 95, commissionAmount: 20, professionalId: 'prof-1' },
    ])
    Object.assign(transactionRepository, { findByAppointmentId: mockFindByAppointmentId })
    Object.assign(prisma, {
      appointment: {
        findUnique: vi.fn().mockResolvedValue({
          service: { name: 'Corte' },
          customer: { name: 'Ana' },
        }),
      },
    })

    await capturedHandlers['scheduling.appointment.payment_refunded']({
      tenantId: 'tenant-1',
      appointmentId: 'appt-1',
    })

    expect(mockFindByAppointmentId).toHaveBeenCalledWith('tenant-1', 'appt-1', {
      type: TransactionType.INCOME,
      category: FINANCIAL_CATEGORIES.SERVICE,
    })
    expect(mockCreate).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        appointmentId: 'appt-1',
        type: TransactionType.INCOME,
        category: FINANCIAL_CATEGORIES.SERVICE_REVERSAL,
        professionalId: 'prof-1',
      }),
    )
    const createArg = mockCreate.mock.calls[0][1]
    expect(Number(createArg.amount)).toBe(-100)
    expect(Number(createArg.netAmount)).toBe(-95)
    expect(Number(createArg.commissionAmount)).toBe(-20)
    expect(createArg.description).toContain('Corte')
  })

  it('payment_refunded não cria nada se não encontrar a transação original do agendamento', async () => {
    const mockCreate = vi.mocked(transactionRepository.create)
    mockCreate.mockClear()
    Object.assign(transactionRepository, { findByAppointmentId: vi.fn().mockResolvedValue([]) })

    await capturedHandlers['scheduling.appointment.payment_refunded']({
      tenantId: 'tenant-1',
      appointmentId: 'appt-999',
    })

    expect(mockCreate).not.toHaveBeenCalled()
  })
})
