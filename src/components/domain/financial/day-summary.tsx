// src/components/domain/financial/day-summary.tsx
'use client'

import { useMemo } from 'react'
import { DollarSign, TrendingUp, CalendarCheck } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useTransactions } from '@/hooks/financial/use-transactions'

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

export function FinancialDaySummary() {
  const { from, to } = useMemo(() => {
    const today = new Date()
    return {
      from: startOfDay(today).toISOString(),
      to: endOfDay(today).toISOString(),
    }
  }, [])

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
      label: 'Receita do dia',
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
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div
            key={card.label}
            className="rounded-2xl border border-white/80 bg-white/85 p-5 shadow-sm"
          >
            <div className={`inline-flex rounded-xl p-2 ${card.color}`}>
              <Icon className="size-4" />
            </div>
            {isLoading ? (
              <>
                <Skeleton className="mt-4 h-7 w-24" />
                <Skeleton className="mt-1 h-3 w-28" />
              </>
            ) : isError ? (
              <p className="mt-4 text-sm text-slate-400">Erro ao carregar</p>
            ) : (
              <p className="mt-4 text-2xl font-semibold text-slate-950">{card.value}</p>
            )}
            <p className="mt-2 text-xs font-medium text-slate-400">{card.label}</p>
          </div>
        )
      })}
    </div>
  )
}
