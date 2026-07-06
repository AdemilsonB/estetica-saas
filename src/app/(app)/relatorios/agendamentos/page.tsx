import { Suspense } from 'react'
import { ReportSkeleton } from '@/components/domain/reports/report-skeleton'
import { FeatureLock } from '@/components/domain/billing/feature-lock'
import { AgendamentosClient } from './agendamentos-client'

export const metadata = { title: 'Relatório de Agendamentos · Estética SaaS' }

export default function RelatorioAgendamentosPage() {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <FeatureLock capability="report_agendamentos">
        <AgendamentosClient />
      </FeatureLock>
    </Suspense>
  )
}
