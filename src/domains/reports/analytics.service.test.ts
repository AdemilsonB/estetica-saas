import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from '@/shared/test/prisma-mock'

vi.mock('@/domains/billing/feature-guard', () => ({
  FEATURES: { REPORTS_ADVANCED: 'reports_advanced' },
  featureGuard: {
    canAccess: vi.fn(),
    assertAccess: vi.fn(),
  },
}))

import { featureGuard } from '@/domains/billing/feature-guard'
import { AnalyticsService } from './analytics.service'

const service = new AnalyticsService()

const janela = {
  from: '2026-06-01T03:00:00.000Z',
  to: '2026-06-30T02:59:59.999Z',
}

beforeEach(() => {
  vi.mocked(featureGuard.canAccess).mockReset()
  vi.mocked(featureGuard.assertAccess).mockReset()
  prismaMock.tenant.findFirstOrThrow.mockResolvedValue({
    timezone: 'America/Sao_Paulo',
  } as never)
})

describe('AnalyticsService.getOverviewReport', () => {
  function mockQueries(opts: { canAccess: boolean }) {
    vi.mocked(featureGuard.canAccess).mockResolvedValue(opts.canAccess)
    // Ordem dos $queryRaw no service:
    // 1) receita atual  2) receita anterior  3) novos vs recorrentes atual
    // 4) novos vs recorrentes anterior  [5) série receita  6) série agendamentos]
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ receita: 1140, pagos: 10 }] as never)
      .mockResolvedValueOnce([{ receita: 1000, pagos: 10 }] as never)
      .mockResolvedValueOnce([{ total: 20, novos: 5 }] as never)
      .mockResolvedValueOnce([{ total: 20, novos: 4 }] as never)
    if (opts.canAccess) {
      prismaMock.$queryRaw
        .mockResolvedValueOnce([{ bucket: '2026-06-01', valor: 500 }] as never)
        .mockResolvedValueOnce([{ bucket: '2026-06-02', valor: 3 }] as never)
    }
    prismaMock.appointment.count
      .mockResolvedValueOnce(30 as never) // atual
      .mockResolvedValueOnce(25 as never) // anterior
  }

  it('monta KPIs com variação (% e p.p.)', async () => {
    mockQueries({ canAccess: false })

    const report = await service.getOverviewReport('tenant-1', janela)

    expect(report.kpis.faturamento).toBe(1140)
    expect(report.kpis.agendamentos).toBe(30)
    expect(report.kpis.ticketMedio).toBe(114) // 1140 / 10 pagos
    expect(report.kpis.novosPct).toBe(25) // 5 / 20
    expect(report.kpis.variacao.faturamento).toBe(14)
    expect(report.kpis.variacao.agendamentos).toBe(20)
    expect(report.kpis.variacao.novosPctPp).toBe(5) // 25 - 20
  })

  it('sem reports_advanced, series é null e não roda queries de série', async () => {
    mockQueries({ canAccess: false })

    const report = await service.getOverviewReport('tenant-1', janela)

    expect(report.series).toBeNull()
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(4)
  })

  it('com reports_advanced, preenche buckets vazios com zero', async () => {
    mockQueries({ canAccess: true })

    const report = await service.getOverviewReport('tenant-1', janela)

    expect(report.granularity).toBe('day')
    expect(report.series).not.toBeNull()
    const s = report.series!
    expect(s.find((p) => p.bucket === '2026-06-01')).toEqual({
      bucket: '2026-06-01', faturamento: 500, agendamentos: 0,
    })
    expect(s.find((p) => p.bucket === '2026-06-02')).toEqual({
      bucket: '2026-06-02', faturamento: 0, agendamentos: 3,
    })
    // todos os dias de junho até o 'to' presentes, mesmo sem dados
    expect(s.find((p) => p.bucket === '2026-06-15')?.faturamento).toBe(0)
  })
})
