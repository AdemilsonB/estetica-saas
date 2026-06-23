type Props = {
  servicesCount: number
  minPrice: number | null
  avgDurationMinutes: number | null
  teamCount: number
}

function formatDuration(min: number): string {
  if (min < 60) return `${Math.round(min)}min`
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return m > 0 ? `${h}h${m}` : `${h}h`
}

export function VitrineStatsBar({ servicesCount, minPrice, avgDurationMinutes, teamCount }: Props) {
  const stats = [
    { label: 'Serviços', value: String(servicesCount) },
    ...(minPrice != null ? [{ label: 'A partir de', value: `R$${minPrice.toFixed(0)}` }] : []),
    ...(avgDurationMinutes != null ? [{ label: 'Duração', value: formatDuration(avgDurationMinutes) }] : []),
    ...(teamCount > 0 ? [{ label: 'Equipe', value: String(teamCount) }] : []),
  ]

  if (stats.length < 2) return null

  return (
    <div className="mx-auto mt-4 flex max-w-3xl items-center px-4">
      {stats.map((stat, i) => (
        <div key={stat.label} className="flex flex-1 items-center">
          {i > 0 && <div className="mr-0 h-6 w-px shrink-0 bg-border" />}
          <div className="flex-1 text-center">
            <p className="text-sm font-bold leading-none">{stat.value}</p>
            <p className="mt-1 text-[9px] uppercase tracking-wide text-muted-foreground">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
