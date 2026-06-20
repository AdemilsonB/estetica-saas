import { Suspense } from 'react'
import { ReportSkeleton } from '@/components/domain/reports/report-skeleton'
import { ProdutosClient } from './produtos-client'

export const metadata = { title: 'Produtos & Estoque · Estética SaaS' }

export default function ProdutosPage() {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <ProdutosClient />
    </Suspense>
  )
}
