export type KpiDelta = number | null

export function percentDelta(current: number, previous: number): KpiDelta {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

export function pointsDelta(currentPct: number, previousPct: number): number {
  return Math.round(currentPct - previousPct)
}

export function previousWindow(from: Date, to: Date): { from: Date; to: Date } {
  const duration = to.getTime() - from.getTime()
  return {
    from: new Date(from.getTime() - duration - 1),
    to: new Date(from.getTime() - 1),
  }
}

export type Granularity = 'day' | 'week' | 'month'

const DAY_MS = 86_400_000

export function granularityFor(from: Date, to: Date): Granularity {
  const days = (to.getTime() - from.getTime()) / DAY_MS
  if (days <= 31) return 'day'
  if (days <= 120) return 'week'
  return 'month'
}

// Enumera os buckets (YYYY-MM-DD) do intervalo no fuso do tenant, no mesmo
// alinhamento do date_trunc do PostgreSQL (semana inicia na segunda-feira).
// A iteração usa Date em UTC ao meio-dia para não sofrer com DST.
export function enumerateBuckets(
  from: Date,
  to: Date,
  granularity: Granularity,
  tz: string,
): string[] {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  })
  let cursor = new Date(`${fmt.format(from)}T12:00:00Z`)
  const end = new Date(`${fmt.format(to)}T12:00:00Z`)

  if (granularity === 'week') {
    const diasDesdeSegunda = (cursor.getUTCDay() + 6) % 7
    cursor = new Date(cursor.getTime() - diasDesdeSegunda * DAY_MS)
  }
  if (granularity === 'month') cursor.setUTCDate(1)

  const buckets: string[] = []
  while (cursor <= end) {
    buckets.push(cursor.toISOString().slice(0, 10))
    if (granularity === 'day') cursor = new Date(cursor.getTime() + DAY_MS)
    else if (granularity === 'week') cursor = new Date(cursor.getTime() + 7 * DAY_MS)
    else cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  return buckets
}
