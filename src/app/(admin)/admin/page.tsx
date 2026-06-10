'use client'

import { useAdminMrr } from '@/hooks/admin/use-admin-mrr'
import { AdminPlanDistribution } from '@/components/admin/admin-plan-distribution'

export default function AdminOverviewPage() {
  const { data: mrrData } = useAdminMrr()

  const formatBRL = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-950">Visão Geral do Sistema</h1>

      {/* MRR / ARR */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">MRR</p>
          <p className="mt-1 text-2xl font-bold text-slate-950">
            {formatBRL(mrrData?.mrr ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">ARR</p>
          <p className="mt-1 text-2xl font-bold text-slate-950">
            {formatBRL(mrrData?.arr ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Assinaturas ativas</p>
          <p className="mt-1 text-2xl font-bold text-slate-950">
            {mrrData?.totalActivePaying ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Em trial</p>
          <p className="mt-1 text-2xl font-bold text-slate-950">
            {mrrData?.trialing ?? 0}
          </p>
        </div>
      </div>

      {/* Contadores gerais e distribuição por plano */}
      <AdminPlanDistribution />
    </div>
  )
}
