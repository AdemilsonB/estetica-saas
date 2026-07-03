import { describe, it, expect, beforeEach } from 'vitest'
import { AppointmentStatus, TransactionType } from '@prisma/client'
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

function apt(status: AppointmentStatus, professional = { id: 'p1', name: 'Ana' }) {
  return {
    id: `apt-${Math.random()}`,
    status,
    professional,
    service: { id: 's1', name: 'Corte' },
  }
}

describe('ReportsService.getAppointmentsReport — variação e categoria', () => {
  beforeEach(() => {
    prismaMock.appointment.findMany.mockReset()
    prismaMock.appointment.groupBy.mockReset()
    prismaMock.tenant.findFirstOrThrow.mockResolvedValue({
      timezone: 'America/Sao_Paulo',
    } as never)
  })

  it('calcula variação de total, concluídos e taxa (p.p.) vs janela anterior', async () => {
    prismaMock.appointment.findMany.mockResolvedValue([
      apt(AppointmentStatus.COMPLETED),
      apt(AppointmentStatus.COMPLETED),
      apt(AppointmentStatus.CANCELLED),
    ] as never) // atual: 3 total, 2 concluídos, taxa 67%
    prismaMock.appointment.groupBy.mockResolvedValue([
      { status: AppointmentStatus.COMPLETED, _count: { _all: 1 } },
      { status: AppointmentStatus.CANCELLED, _count: { _all: 1 } },
    ] as never) // anterior: 2 total, 1 concluído, taxa 50%

    const report = await service.getAppointmentsReport('tenant-1', {})

    expect(report.kpis.variacao.total).toBe(50) // 3 vs 2
    expect(report.kpis.variacao.concluidos).toBe(100) // 2 vs 1
    expect(report.kpis.variacao.taxaConclusaoPp).toBe(17) // 67 - 50
  })

  it('repassa categoryId como filtro via service.categoryId', async () => {
    prismaMock.appointment.findMany.mockResolvedValue([] as never)
    prismaMock.appointment.groupBy.mockResolvedValue([] as never)

    await service.getAppointmentsReport('tenant-1', { categoryId: 'clx0categoria0000000000000', groupBy: 'profissional' })

    const call = prismaMock.appointment.findMany.mock.calls[0][0] as {
      where: { service?: { categoryId?: string } }
    }
    expect(call.where.service?.categoryId).toBe('clx0categoria0000000000000')
  })
})

describe('ReportsService.getCustomersReport — ranking paginado no banco', () => {
  const rawRow = {
    id: 'c1',
    clienteNome: 'Maria',
    atendimentos: 3,
    receita: 300,
    ticketMedio: 100,
    ultimoAtendimento: new Date('2026-06-20T14:00:00.000Z'),
  }

  beforeEach(() => {
    prismaMock.$queryRaw.mockReset()
    prismaMock.appointment.groupBy.mockReset()
    prismaMock.customer.count.mockReset()
    prismaMock.tenant.findFirstOrThrow.mockResolvedValue({
      timezone: 'America/Sao_Paulo',
    } as never)
  })

  it('retorna rows do banco com paginação e serializa datas', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([rawRow] as never) // ranking
      .mockResolvedValueOnce([{ total: 42 }] as never) // count distinct
    prismaMock.appointment.groupBy
      .mockResolvedValueOnce([{ customerId: 'c1', _count: { _all: 3 } }] as never) // atual
      .mockResolvedValueOnce([] as never) // anterior
    prismaMock.customer.count
      .mockResolvedValueOnce(5 as never) // novos atual
      .mockResolvedValueOnce(2 as never) // novos anterior

    const report = await service.getCustomersReport('tenant-1', { page: 2 })

    expect(report.rows[0]).toEqual({
      clienteId: 'c1',
      clienteNome: 'Maria',
      atendimentos: 3,
      receita: 300,
      ticketMedio: 100,
      ultimoAtendimento: '2026-06-20T14:00:00.000Z',
    })
    expect(report.total).toBe(42)
    expect(report.page).toBe(2)
    expect(report.pageSize).toBe(20)
  })

  it('calcula KPIs e variações a partir das agregações', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([{ total: 0 }] as never)
    prismaMock.appointment.groupBy
      .mockResolvedValueOnce([
        { customerId: 'c1', _count: { _all: 3 } },
        { customerId: 'c2', _count: { _all: 1 } },
      ] as never) // atual: 2 ativos, 1 com retorno
      .mockResolvedValueOnce([{ customerId: 'c9', _count: { _all: 2 } }] as never) // anterior: 1 ativo, 1 retorno
    prismaMock.customer.count
      .mockResolvedValueOnce(4 as never)
      .mockResolvedValueOnce(2 as never)

    const report = await service.getCustomersReport('tenant-1', {})

    expect(report.kpis.totalAtivos).toBe(2)
    expect(report.kpis.retorno).toBe(1)
    expect(report.kpis.novosNoPeriodo).toBe(4)
    expect(report.kpis.variacao.totalAtivos).toBe(100) // 2 vs 1
    expect(report.kpis.variacao.novosNoPeriodo).toBe(100) // 4 vs 2
    expect(report.kpis.variacao.retorno).toBe(0) // 1 vs 1
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
