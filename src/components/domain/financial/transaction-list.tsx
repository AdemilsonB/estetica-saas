// src/components/domain/financial/transaction-list.tsx
'use client'

import { DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TransactionCard } from './transaction-card'
import { useTransactions } from '@/hooks/financial/use-transactions'
import type { TransactionType } from '@/hooks/financial/use-transactions'

type Props = {
  from?: string
  to?: string
  type?: TransactionType
  category?: string
  professionalId?: string
  page?: number
  pageSize?: number
  onPageChange?: (page: number) => void
}

export function TransactionList({
  from,
  to,
  type,
  category,
  professionalId,
  page = 1,
  pageSize = 20,
  onPageChange,
}: Props) {
  const { data, isLoading, isError, refetch } = useTransactions({
    from,
    to,
    type,
    category,
    professionalId,
    page,
    pageSize,
  })

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-600">Erro ao carregar transações.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
          Tentar novamente
        </Button>
      </div>
    )
  }

  if (!data || data.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 py-12 text-center">
        <DollarSign className="size-8 text-slate-300" />
        <p className="mt-3 text-sm text-slate-500">Nenhuma transação encontrada</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {data.data.map((t) => (
        <TransactionCard key={t.id} transaction={t} />
      ))}

      {totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            Anterior
          </Button>
          <span className="text-xs text-slate-500">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  )
}
