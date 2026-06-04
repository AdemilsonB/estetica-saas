import { prisma } from '@/shared/database/prisma'
import { PlanName } from '@prisma/client'

export const dynamic = 'force-dynamic'

const PLAN_LABELS: Record<PlanName, string> = {
  FREE: 'Free', STARTER: 'Starter', PRO: 'Pro', ENTERPRISE: 'Enterprise',
}
const PLAN_COLORS: Record<PlanName, string> = {
  FREE: 'bg-slate-100 text-slate-700',
  STARTER: 'bg-blue-100 text-blue-700',
  PRO: 'bg-violet-100 text-violet-700',
  ENTERPRISE: 'bg-amber-100 text-amber-700',
}

export default async function AdminOverviewPage() {
  const [totalTenants, planCounts, recentCount] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.groupBy({ by: ['plan'], _count: { _all: true } }),
    prisma.tenant.count({
      where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    }),
  ])

  const countByPlan = Object.fromEntries(
    planCounts.map((r) => [r.plan, r._count._all])
  ) as Partial<Record<PlanName, number>>

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-950">Visão Geral do Sistema</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-2xl font-bold text-slate-950">{totalTenants}</p>
          <p className="mt-1 text-sm text-slate-500">Total de tenants</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-2xl font-bold text-slate-950">{recentCount}</p>
          <p className="mt-1 text-sm text-slate-500">Últimos 30 dias</p>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Distribuição por plano</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(Object.keys(PLAN_LABELS) as PlanName[]).map((plan) => (
            <div key={plan} className="rounded-lg border border-slate-100 p-4 text-center">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PLAN_COLORS[plan]}`}>
                {PLAN_LABELS[plan]}
              </span>
              <p className="mt-2 text-xl font-bold text-slate-950">{countByPlan[plan] ?? 0}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
