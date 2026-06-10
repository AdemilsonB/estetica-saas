'use client'

import { useQuery } from '@tanstack/react-query'

type PlanName = 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE'

const PLAN_LABELS: Record<PlanName, string> = {
  FREE: 'Free',
  STARTER: 'Starter',
  PRO: 'Pro',
  ENTERPRISE: 'Enterprise',
}

const PLAN_COLORS: Record<PlanName, string> = {
  FREE: 'bg-slate-100 text-slate-700',
  STARTER: 'bg-blue-100 text-blue-700',
  PRO: 'bg-violet-100 text-violet-700',
  ENTERPRISE: 'bg-amber-100 text-amber-700',
}

type AdminStatsData = {
  totalTenants: number
  recentCount: number
  countByPlan: Partial<Record<PlanName, number>>
}

async function fetchAdminStats(): Promise<AdminStatsData> {
  const res = await fetch('/api/admin/stats')
  if (!res.ok) throw new Error('Falha ao carregar estatísticas')
  return res.json()
}

export function AdminPlanDistribution() {
  const { data } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: fetchAdminStats,
    staleTime: 60_000,
  })

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-2xl font-bold text-slate-950">{data?.totalTenants ?? '—'}</p>
          <p className="mt-1 text-sm text-slate-500">Total de tenants</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-2xl font-bold text-slate-950">{data?.recentCount ?? '—'}</p>
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
              <p className="mt-2 text-xl font-bold text-slate-950">
                {data?.countByPlan[plan] ?? 0}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
