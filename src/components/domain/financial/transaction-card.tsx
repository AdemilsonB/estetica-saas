// src/components/domain/financial/transaction-card.tsx
'use client'

import { ArrowUpCircle, ArrowDownCircle, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isReversal } from '@/domains/financial/categories'
import type { Transaction } from '@/hooks/financial/use-transactions'

const CATEGORY_BADGE: Record<string, { label: string; className: string }> = {
  'Serviço':               { label: 'Serviço',   className: 'bg-slate-100 text-slate-600' },
  'Venda de Produto':      { label: 'Venda',     className: 'bg-slate-100 text-slate-600' },
  'Compra de Estoque':     { label: 'Compra',    className: 'bg-slate-100 text-slate-600' },
  'Insumo de Atendimento': { label: 'Insumo',    className: 'bg-purple-50 text-purple-700' },
  'Despesa Variável':      { label: 'Variável',  className: 'bg-orange-50 text-orange-700' },
  'Despesa Fixa':          { label: 'Fixo',      className: 'bg-blue-50 text-blue-700' },
  'Cortesia':              { label: 'Cortesia',  className: 'bg-amber-50 text-amber-700' },
  'Estorno de Insumo':     { label: 'Estorno',   className: 'bg-amber-50 text-amber-700' },
}

type Props = {
  transaction: Transaction
}

export function TransactionCard({ transaction }: Props) {
  const isIncome = transaction.type === 'INCOME'
  const amount = Number(transaction.amount)
  const isReversalEntry = isReversal(transaction.category, amount)
  const isCredit = isIncome || isReversalEntry
  const displayAmount = Math.abs(amount)

  const badge = CATEGORY_BADGE[transaction.category]

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full',
          isIncome
            ? 'bg-emerald-50'
            : isReversalEntry
            ? 'bg-amber-50'
            : 'bg-red-50',
        )}
      >
        {isIncome ? (
          <ArrowUpCircle className="size-5 text-emerald-600" />
        ) : isReversalEntry ? (
          <RotateCcw className="size-5 text-amber-600" />
        ) : (
          <ArrowDownCircle className="size-5 text-red-600" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-950">
          {transaction.description}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          <p className="text-xs text-slate-500">
            {transaction.paidAt
              ? new Date(transaction.paidAt).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Sem data'}
          </p>
          {badge && (
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                badge.className,
              )}
            >
              {badge.label}
            </span>
          )}
        </div>
      </div>

      <span
        className={cn(
          'shrink-0 text-sm font-semibold',
          isIncome
            ? 'text-emerald-700'
            : isReversalEntry
            ? 'text-amber-700'
            : 'text-red-700',
        )}
      >
        {isCredit ? '+' : '−'}R$
        {displayAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
      </span>
    </div>
  )
}
