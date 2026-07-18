import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/shared/database/prisma'
import * as usage from '@/domains/billing/usage.service'
import { getGrowthSignals } from './growth-signals.service'

vi.mock('@/shared/database/prisma', () => ({
  prisma: {
    capabilityInterestLog: { groupBy: vi.fn() },
    tenant: { findMany: vi.fn() },
  },
}))
vi.mock('@/domains/billing/usage.service', () => ({ getTenantUsage: vi.fn() }))

describe('getGrowthSignals', () => {
  beforeEach(() => vi.clearAllMocks())

  it('ranqueia capacidades bloqueadas e inclui só tenants fora de "ok"', async () => {
    vi.mocked(prisma.capabilityInterestLog.groupBy).mockResolvedValue([
      { capabilityKey: 'reports_advanced', _count: { _all: 12 } },
      { capabilityKey: 'whatsapp_premium', _count: { _all: 4 } },
    ] as never)
    vi.mocked(prisma.tenant.findMany).mockResolvedValue([
      { id: 't1', name: 'Salão A' },
      { id: 't2', name: 'Salão B' },
    ] as never)
    vi.mocked(usage.getTenantUsage).mockImplementation(async (tenantId: string) =>
      tenantId === 't1'
        ? ([{ limitKey: 'max_users', label: 'Usuários', current: 5, limit: 5, percent: 100, status: 'exceeded', kind: 'hard', unlimited: false }] as never)
        : ([{ limitKey: 'max_users', label: 'Usuários', current: 1, limit: 5, percent: 20, status: 'ok', kind: 'hard', unlimited: false }] as never),
    )

    const result = await getGrowthSignals()

    expect(result.topBlockedCapabilities[0]).toMatchObject({ key: 'reports_advanced', count: 12 })
    expect(result.topBlockedCapabilities[0].label).toBeTruthy()
    expect(result.tenantsNearLimit).toHaveLength(1)
    expect(result.tenantsNearLimit[0].tenantId).toBe('t1')
  })
})
