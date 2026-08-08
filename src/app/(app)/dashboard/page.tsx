import { DashboardMetrics } from '@/components/domain/dashboard/dashboard-metrics'
import { UsageWidget } from '@/components/domain/billing/usage-widget'
import { ReviewsSummaryCard } from '@/components/domain/reviews/reviews-summary-card'
import { PendingCompletionCard } from '@/components/domain/scheduling/pending-completion-card'

export const metadata = { title: 'Dashboard · Estética SaaS' }

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-4 sm:space-y-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-950">
          Visão geral do dia
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-500">
          Resumo operacional · atualiza automaticamente a cada 30s
        </p>
      </div>

      <PendingCompletionCard />

      <DashboardMetrics />

      <div>
        <h2 className="mb-3 sm:mb-4 text-base sm:text-lg font-semibold text-slate-950">
          Uso do plano
        </h2>
        <UsageWidget />
      </div>

      <ReviewsSummaryCard />
    </div>
  )
}
