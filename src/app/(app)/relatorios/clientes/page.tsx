import { Suspense } from 'react'
import { ReportSkeleton } from '@/components/domain/reports/report-skeleton'
import { FeatureLock } from '@/components/domain/billing/feature-lock'
import { ClientesClient } from './clientes-client'

export const metadata = { title: 'Relatório de Clientes · Estética SaaS' }

export default function RelatorioClientesPage() {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <FeatureLock capability="report_clientes">
        <ClientesClient />
      </FeatureLock>
    </Suspense>
  )
}
