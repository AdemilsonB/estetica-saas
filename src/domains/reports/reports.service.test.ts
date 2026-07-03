import { describe, it, expect, beforeEach } from 'vitest'
import { TransactionType } from '@prisma/client'
import { prismaMock } from '@/shared/test/prisma-mock'
import { ReportsService } from './reports.service'

const service = new ReportsService()

// Helpers para montar transações mínimas que o relatório consome.
function income(amount: number, netAmount: number | null, appointmentId = 'apt-1') {
  return {
    id: `tx-${Math.random()}`,
    type: TransactionType.INCOME,
    amount,
    netAmount,
    category: null,
    appointmentId,
    appointment: { professional: { id: 'p1', name: 'Ana' }, service: { id: 's1', name: 'Corte' } },
  }
}

describe('ReportsService.getFinancialReport — exatidão de netAmount', () => {
  beforeEach(() => {
    prismaMock.transaction.findMany.mockReset()
    // resolvePeriod busca o timezone do tenant quando não há datas explícitas.
    prismaMock.tenant.findFirstOrThrow.mockResolvedValue({
      timezone: 'America/Sao_Paulo',
    } as never)
  })

  it('usa netAmount (líquido) na receita, não amount (bruto)', async () => {
    // amount bruto 100, netAmount líquido 90 (ex: taxa de cartão de 10)
    prismaMock.transaction.findMany.mockResolvedValue([income(100, 90)] as never)

    const report = await service.getFinancialReport('tenant-1', {})

    expect(report.kpis.receita).toBe(90)
  })

  it('cai para amount quando netAmount é nulo (transações antigas)', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([income(80, null)] as never)

    const report = await service.getFinancialReport('tenant-1', {})

    expect(report.kpis.receita).toBe(80)
  })

  it('agrega receita por grupo também pelo líquido', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      income(100, 90),
      income(50, 45, 'apt-2'),
    ] as never)

    const report = await service.getFinancialReport('tenant-1', { groupBy: 'profissional' })

    const total = report.rows.reduce((s, r) => s + r.receita, 0)
    expect(total).toBe(135)
  })
})

describe('ReportsService.getFinancialReport — ticket médio, variação e categoria', () => {
  beforeEach(() => {
    prismaMock.transaction.findMany.mockReset()
    prismaMock.tenant.findFirstOrThrow.mockResolvedValue({
      timezone: 'America/Sao_Paulo',
    } as never)
  })

  it('calcula ticketMedio por grupo e expõe groupId', async () => {
    prismaMock.transaction.findMany
      .mockResolvedValueOnce([income(100, 90), income(50, 30, 'apt-2')] as never) // período atual
      .mockResolvedValueOnce([] as never) // período anterior

    const report = await service.getFinancialReport('tenant-1', {})

    const corte = report.rows.find((r) => r.label === 'Corte')
    expect(corte?.groupId).toBe('s1')
    expect(corte?.quantidade).toBe(2)
    expect(corte?.ticketMedio).toBe(60) // (90 + 30) / 2
  })

  it('calcula variação % dos KPIs vs janela anterior', async () => {
    prismaMock.transaction.findMany
      .mockResolvedValueOnce([income(120, 114)] as never) // atual: receita 114
      .mockResolvedValueOnce([income(100, 100)] as never) // anterior: receita 100

    const report = await service.getFinancialReport('tenant-1', {})

    expect(report.kpis.variacao.receita).toBe(14)
  })

  it('variação é null quando não há base no período anterior', async () => {
    prismaMock.transaction.findMany
      .mockResolvedValueOnce([income(100, 90)] as never)
      .mockResolvedValueOnce([] as never)

    const report = await service.getFinancialReport('tenant-1', {})

    expect(report.kpis.variacao.receita).toBeNull()
  })

  it('repassa categoryId como filtro via appointment.service', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([] as never)

    await service.getFinancialReport('tenant-1', { categoryId: 'clx0categoria0000000000000' })

    const call = prismaMock.transaction.findMany.mock.calls[0][0] as {
      where: { appointment?: { service?: { categoryId?: string } } }
    }
    expect(call.where.appointment?.service?.categoryId).toBe('clx0categoria0000000000000')
  })
})
