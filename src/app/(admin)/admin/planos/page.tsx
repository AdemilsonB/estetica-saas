import Link from 'next/link'
import { prisma } from '@/shared/database/prisma'
import { PlanName } from '@prisma/client'
import { ChevronRight } from 'lucide-react'

const PLAN_COLORS: Record<PlanName, string> = {
  FREE: 'border-slate-200 bg-slate-50',
  STARTER: 'border-blue-200 bg-blue-50',
  PRO: 'border-violet-200 bg-violet-50',
  ENTERPRISE: 'border-amber-200 bg-amber-50',
}

export default async function AdminPlanosPage() {
  const plans = await prisma.plan.findMany({ orderBy: { displayOrder: 'asc' } })

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-950">Planos</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => (
          <Link
            key={plan.name}
            href={`/admin/planos/${plan.name}`}
            className={`flex flex-col rounded-xl border p-5 transition hover:shadow-sm ${PLAN_COLORS[plan.name as PlanName] ?? 'border-slate-200 bg-white'}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-slate-950">{plan.displayName}</p>
                <p className="mt-0.5 text-sm text-slate-500">
                  {Number(plan.price) > 0 ? `R$ ${Number(plan.price).toFixed(2)}/mês` : 'Grátis'}
                </p>
              </div>
              <ChevronRight className="size-4 text-slate-400" />
            </div>
            {plan.description && (
              <p className="mt-3 text-xs text-slate-500">{plan.description}</p>
            )}
            <span className={`mt-4 self-start rounded-full px-2 py-0.5 text-xs font-medium ${plan.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
              {plan.isActive ? 'Ativo' : 'Inativo'}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
