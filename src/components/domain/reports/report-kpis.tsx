import { Skeleton } from '@/components/ui/skeleton'

export type KpiCard = {
  label: string
  value: string | number
}

type Props = {
  cards: KpiCard[]
  isLoading: boolean
}

export function ReportKpis({ cards, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/80 bg-white/85 p-5 shadow-sm">
            <Skeleton className="h-3 w-24 mb-3" />
            <Skeleton className="h-7 w-32" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border border-white/80 bg-white/85 p-5 shadow-sm"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {card.label}
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{card.value}</p>
        </div>
      ))}
    </div>
  )
}
