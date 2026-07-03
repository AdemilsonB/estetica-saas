import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { KpiDelta } from '@/domains/reports/analytics-utils'

export type KpiCard = {
  label: string
  value: string | number
  delta?: KpiDelta
  deltaUnit?: '%' | 'pp'
  // Para métricas em que subir é ruim (ex: despesa), inverte a cor.
  invertDeltaColor?: boolean
}

type Props = {
  cards: KpiCard[]
  isLoading: boolean
}

function DeltaBadge({ card }: { card: KpiCard }) {
  if (card.delta === undefined || card.delta === null) return null
  const up = card.delta >= 0
  const good = card.invertDeltaColor ? !up : up
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <p
      className={cn(
        'mt-1 flex items-center gap-0.5 text-xs font-medium',
        card.delta === 0 ? 'text-slate-400' : good ? 'text-emerald-600' : 'text-rose-600',
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      {Math.abs(card.delta)}
      {card.deltaUnit === 'pp' ? ' p.p.' : '%'}
      <span className="ml-1 font-normal text-slate-400">vs. anterior</span>
    </p>
  )
}

export function ReportKpis({ cards, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm sm:p-5">
            <Skeleton className="mb-3 h-3 w-24" />
            <Skeleton className="h-7 w-32" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm sm:p-5"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {card.label}
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-950 sm:text-2xl">{card.value}</p>
          <DeltaBadge card={card} />
        </div>
      ))}
    </div>
  )
}
