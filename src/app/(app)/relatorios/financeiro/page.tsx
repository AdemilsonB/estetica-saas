import { Suspense } from 'react'
import { ReportSkeleton } from '@/components/domain/reports/report-skeleton'
import { FeatureLock } from '@/components/domain/billing/feature-lock'
import { FinanceiroClient } from './financeiro-client'

export const metadata = { title: 'Relatório Financeiro · Estética SaaS' }

export default function RelatorioFinanceiroPage() {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <FeatureLock capability="report_financeiro">
        <FinanceiroClient />
      </FeatureLock>
    </Suspense>
  )
}
