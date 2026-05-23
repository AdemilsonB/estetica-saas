// src/app/(app)/financeiro/page.tsx
'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FinancialDaySummary } from '@/components/domain/financial/day-summary'
import { TransactionList } from '@/components/domain/financial/transaction-list'
import { usePermissions } from '@/hooks/use-permissions'

function startOfDay(d: Date) {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

function endOfDay(d: Date) {
  const r = new Date(d)
  r.setHours(23, 59, 59, 999)
  return r
}

export default function FinanceiroPage() {
  const { can } = usePermissions()

  if (!can('financial:view')) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm font-medium text-red-700">
            Você não tem permissão para acessar o financeiro.
          </p>
        </div>
      </div>
    )
  }

  const today = new Date()
  const from = startOfDay(today).toISOString()
  const to = endOfDay(today).toISOString()

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          Financeiro
        </h1>
        <p className="mt-1 text-sm text-slate-500">Resumo do dia de hoje</p>
      </div>

      <FinancialDaySummary />

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-950">Transações de hoje</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/financeiro/transacoes" className="flex items-center gap-1 text-slate-500">
              Ver histórico <ArrowRight className="size-3" />
            </Link>
          </Button>
        </div>
        <TransactionList from={from} to={to} pageSize={10} />
      </div>
    </div>
  )
}
