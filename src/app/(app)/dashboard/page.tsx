import { DashboardMetrics } from '@/components/domain/dashboard/dashboard-metrics'
import { AgendaDayView } from '@/components/domain/scheduling/agenda-day-view'

export const metadata = { title: 'Dashboard · Estética SaaS' }

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          Visão geral do dia
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Resumo operacional · atualiza automaticamente a cada 30s
        </p>
      </div>

      <DashboardMetrics />

      <div>
        <h2 className="mb-4 text-lg font-semibold text-slate-950">
          Agenda de hoje
        </h2>
        <AgendaDayView />
      </div>
    </div>
  )
}
