import { Suspense } from 'react'
import { ReportSkeleton } from '@/components/domain/reports/report-skeleton'
import { AgendamentosClient } from './agendamentos-client'

export const metadata = { title: 'Relatório de Agendamentos · Estética SaaS' }

export default function RelatorioAgendamentosPage() {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <AgendamentosClient />
    </Suspense>
  )
}
