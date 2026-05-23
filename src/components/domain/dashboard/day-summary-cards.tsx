'use client'

import { CalendarCheck, DollarSign, TrendingUp, Users } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppointments } from '@/hooks/scheduling/use-appointments'

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

export function DaySummaryCards() {
  const today = new Date()
  const { data: appointments = [], isLoading } = useAppointments({
    from: startOfDay(today).toISOString(),
    to: endOfDay(today).toISOString(),
  })

  const completed = appointments.filter((a) => a.status === 'COMPLETED')
  const pending = appointments.filter((a) =>
    ['SCHEDULED', 'CONFIRMED'].includes(a.status),
  )
  const totalRevenue = completed.reduce((sum, a) => sum + Number(a.price), 0)
  const avgTicket = completed.length > 0 ? totalRevenue / completed.length : 0

  const cards = [
    {
      label: 'Atendimentos hoje',
      value: isLoading ? '—' : String(appointments.length),
      sub: `${pending.length} pendentes`,
      icon: CalendarCheck,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Concluídos',
      value: isLoading ? '—' : String(completed.length),
      sub: 'hoje',
      icon: Users,
      color: 'text-emerald-600 bg-emerald-50',
    },
    {
      label: 'Receita do dia',
      value: isLoading
        ? '—'
        : `R$${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      sub: 'atendimentos concluídos',
      icon: DollarSign,
      color: 'text-rose-600 bg-rose-50',
    },
    {
      label: 'Ticket médio',
      value: isLoading
        ? '—'
        : `R$${avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      sub: 'por atendimento',
      icon: TrendingUp,
      color: 'text-purple-600 bg-purple-50',
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
                <Skeleton className="mt-1 h-3 w-32" />
              </>
            ) : (
              <>
                <p className="mt-4 text-2xl font-semibold text-slate-950">
                  {card.value}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{card.sub}</p>
              </>
            )}
            <p className="mt-3 text-xs font-medium text-slate-400">{card.label}</p>
          </div>
        )
      })}
    </div>
  )
}
