import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { monthBoundsInTz, dayBoundsInTz } from '@/lib/dates'
import { prisma } from '@/shared/database/prisma'
import { ReportsService } from './reports.service'

const service = new ReportsService()

// O setup global mocka prisma como {}; aqui provemos os métodos usados.
// Relógio fixo: garante que o bound calculado no service e na asserção sejam
// idênticos (evita drift de milissegundos entre dois `new Date()`).
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'))
  Object.assign(prisma as unknown as Record<string, unknown>, {
    tenant: { findFirstOrThrow: vi.fn() },
    transaction: { findMany: vi.fn().mockResolvedValue([]) },
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ReportsService — período no timezone do tenant', () => {
  it('sem datas, usa o mês/dia atuais no fuso do tenant (não em UTC)', async () => {
    const tz = 'America/Sao_Paulo'
    vi.mocked(prisma.tenant.findFirstOrThrow).mockResolvedValue({ timezone: tz } as never)

    await service.getFinancialReport('t1', {})

    const call = vi.mocked(prisma.transaction.findMany).mock.calls[0][0] as {
      where: { paidAt: { gte: Date; lte: Date } }
    }
    expect(call.where.paidAt.gte).toEqual(monthBoundsInTz(tz).start)
    expect(call.where.paidAt.lte).toEqual(dayBoundsInTz(tz).end)
  })

  it('com datas explícitas, não consulta o timezone do tenant', async () => {
    await service.getFinancialReport('t1', {
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-31T23:59:59.000Z',
    })

    expect(prisma.tenant.findFirstOrThrow).not.toHaveBeenCalled()
  })
})
