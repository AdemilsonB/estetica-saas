// src/components/domain/financial/day-summary.tsx
'use client'

import { DollarSign, TrendingUp, CalendarCheck } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useTransactions } from '@/hooks/financial/use-transactions'

type Props = {
  from: string
  to: string
}

export function FinancialDaySummary({ from, to }: Props) {
  const { data, isLoading, isError } = useTransactions({
    from,
    to,
    type: 'INCOME',
    pageSize: 100,
  })

  const transactions = data?.data ?? []
  const totalRevenue = transactions.reduce((sum, t) => {
    const n = Number(t.amount)
    return sum + (Number.isFinite(n) ? n : 0)
  }, 0)
  const avgTicket = transactions.length > 0 ? totalRevenue / transactions.length : 0

  const cards = [
    {
      label: 'Receita',
      value: `R$${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: 'text-emerald-600 bg-emerald-50',
    },
    {
      label: 'Transações',
      value: String(transactions.length),
      icon: CalendarCheck,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Ticket médio',
      value: `R$${avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      icon: TrendingUp,
      color: 'text-purple-600 bg-purple-50',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
      {cards.map((card, i) => {
        const Icon = card.icon
        return (
          <div
            key={card.label}
            className={`rounded-xl border border-white/80 bg-white/85 p-3 shadow-sm sm:p-4 ${
              i === cards.length - 1 ? 'col-span-2 sm:col-span-1' : ''
            }`}
          >
            <div className={`inline-flex rounded-lg p-1.5 ${card.color}`}>
              <Icon className="size-3.5" />
            </div>
            {isLoading ? (
              <>
                <Skeleton className="mt-2 h-5 w-20" />
                <Skeleton className="mt-1 h-3 w-16" />
              </>
            ) : isError ? (
              <p className="mt-2 text-xs text-slate-400">Erro</p>
            ) : (
              <p className="mt-2 truncate text-base font-semibold text-slate-950 sm:text-lg">{card.value}</p>
            )}
            <p className="mt-1 text-xs font-medium text-slate-400">{card.label}</p>
          </div>
        )
      })}
    </div>
  )
}
