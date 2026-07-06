import type { ReactNode } from 'react'
import { ReportsSidebar } from '@/components/domain/reports/reports-sidebar'
import { FeatureLock } from '@/components/domain/billing/feature-lock'

export default function RelatoriosLayout({ children }: { children: ReactNode }) {
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
        <div className="min-w-0 flex-1">
          <FeatureLock capability="relatorios">{children}</FeatureLock>
        </div>
      </div>
    </div>
  )
}
