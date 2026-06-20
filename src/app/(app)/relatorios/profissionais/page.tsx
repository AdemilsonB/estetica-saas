import { Suspense } from 'react'
import { ReportSkeleton } from '@/components/domain/reports/report-skeleton'
import { ProfissionaisClient } from './profissionais-client'

export const metadata = { title: 'Relatório de Profissionais · Estética SaaS' }

export default function RelatorioProfissionaisPage() {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <ProfissionaisClient />
    </Suspense>
  )
}
