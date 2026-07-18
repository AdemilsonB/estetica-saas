import { prisma } from '@/shared/database/prisma'
import { SubscriptionStatus } from '@prisma/client'
import { getTenantUsage, type UsageItem } from '@/domains/billing/usage.service'
import { CAPABILITY_REGISTRY } from '@/shared/permissions/capability-registry'

export type BlockedCapabilitySignal = { key: string; label: string; count: number }
export type TenantNearLimitSignal = { tenantId: string; tenantName: string; items: UsageItem[] }
export type GrowthSignals = {
  topBlockedCapabilities: BlockedCapabilitySignal[]
  tenantsNearLimit: TenantNearLimitSignal[]
}

const INTEREST_WINDOW_DAYS = 90
const TOP_N = 10

// NOTA DE CUSTO: o scan de "perto do limite" é O(tenants ativos × limites). Na escala
// atual (dezenas de tenants) é irrelevante. Se a base crescer para centenas, migrar
// para leitura de UsageSnapshot pré-calculado em vez de recalcular por tenant aqui.
export async function getGrowthSignals(): Promise<GrowthSignals> {
  const since = new Date(Date.now() - INTEREST_WINDOW_DAYS * 24 * 60 * 60 * 1000)

  const grouped = await prisma.capabilityInterestLog.groupBy({
    by: ['capabilityKey'],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
    orderBy: { _count: { capabilityKey: 'desc' } },
    take: TOP_N,
  })

  const labelByKey = new Map(CAPABILITY_REGISTRY.map((c) => [c.key, c.label]))
  const topBlockedCapabilities: BlockedCapabilitySignal[] = grouped.map((g) => ({
    key: g.capabilityKey,
    label: labelByKey.get(g.capabilityKey) ?? g.capabilityKey,
    count: g._count._all,
  }))

  const activeStatuses: SubscriptionStatus[] = [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING]
  const tenants = await prisma.tenant.findMany({
    where: {
      subscription: { status: { in: activeStatuses } },
    },
    select: { id: true, name: true },
  })

  const tenantsNearLimit: TenantNearLimitSignal[] = []
  for (const t of tenants) {
    const items = await getTenantUsage(t.id)
    const flagged = items.filter((i) => i.status !== 'ok')
    if (flagged.length > 0) {
      tenantsNearLimit.push({ tenantId: t.id, tenantName: t.name, items: flagged })
    }
  }

  return { topBlockedCapabilities, tenantsNearLimit }
}
