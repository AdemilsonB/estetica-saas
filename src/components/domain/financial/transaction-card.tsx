// src/components/domain/financial/transaction-card.tsx
'use client'

import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Transaction } from '@/hooks/financial/use-transactions'

type Props = {
  transaction: Transaction
}

export function TransactionCard({ transaction }: Props) {
  const isIncome = transaction.type === 'INCOME'
  const amount = Number(transaction.amount)

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full',
          isIncome ? 'bg-emerald-50' : 'bg-red-50',
        )}
      >
        {isIncome ? (
          <ArrowUpCircle className="size-5 text-emerald-600" />
        ) : (
          <ArrowDownCircle className="size-5 text-red-600" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-950">
          {transaction.description}
        </p>
        <p className="text-xs text-slate-500">
          {transaction.paidAt
            ? new Date(transaction.paidAt).toLocaleString('pt-BR', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })
            : 'Sem data'}
          {' · '}
          {transaction.category}
        </p>
      </div>

      <span
        className={cn(
          'shrink-0 text-sm font-semibold',
          isIncome ? 'text-emerald-700' : 'text-red-700',
        )}
      >
        {isIncome ? '+' : '-'}R$
        {amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
      </span>
    </div>
  )
}
