import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { PlanName } from '@prisma/client'
import { ReportsSidebar } from '@/components/domain/reports/reports-sidebar'
import { getServerTenantId } from '@/shared/auth/get-server-tenant-id'
import { featureGuard } from '@/domains/billing/feature-guard'
import { prisma } from '@/shared/database/prisma'

async function canAccessRelatorios(tenantId: string): Promise<boolean> {
  const { plan, status } = await featureGuard.getSubscriptionState(tenantId)
  const isActive = (['TRIALING', 'ACTIVE', 'PAST_DUE'] as string[]).includes(status)
  const effectivePlan: PlanName = isActive ? plan : PlanName.FREE

  const config = await prisma.planFeatureConfig.findFirst({
    where: { plan: effectivePlan, sectionKey: 'relatorios' },
    select: { enabled: true },
  })

  // Opt-out: sem entrada = habilitado por padrão
  return config?.enabled !== false
}

export default async function RelatoriosLayout({ children }: { children: ReactNode }) {
  const tenantId = await getServerTenantId()

  if (tenantId) {
    const allowed = await canAccessRelatorios(tenantId)
    if (!allowed) redirect('/agenda')
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Relatórios</h1>
        <p className="mt-1 text-sm text-slate-500">Análises detalhadas do seu negócio</p>
      </div>
      <div className="flex flex-col gap-6 md:flex-row md:gap-8">
        <aside className="w-full md:w-52 md:shrink-0">
          <ReportsSidebar />
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
