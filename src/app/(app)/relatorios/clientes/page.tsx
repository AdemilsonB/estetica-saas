import { Suspense } from 'react'
import { ReportSkeleton } from '@/components/domain/reports/report-skeleton'
import { ClientesClient } from './clientes-client'

export const metadata = { title: 'Relatório de Clientes · Estética SaaS' }

export default function RelatorioClientesPage() {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <ClientesClient />
    </Suspense>
  )
}
