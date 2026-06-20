import { Suspense } from 'react'
import { ReportSkeleton } from '@/components/domain/reports/report-skeleton'
import { FinanceiroClient } from './financeiro-client'

export const metadata = { title: 'Relatório Financeiro · Estética SaaS' }

export default function RelatorioFinanceiroPage() {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <FinanceiroClient />
    </Suspense>
  )
}
