export type BusinessHourEntry = { open: string; close: string; active: boolean }
export type BusinessHoursMap = Record<string, BusinessHourEntry>

const WEEKDAY_MAP: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const WEEKDAY_LABELS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export const WEEK_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

export function getWeekdayIndex(timezone: string, ref: Date = new Date()): number | null {
  const short = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(ref)
  return WEEKDAY_MAP[short] ?? null
}

export function isOpenNow(businessHours: unknown, timezone: string, ref: Date = new Date()): boolean {
  if (!businessHours || typeof businessHours !== 'object') return true

  try {
    const hours = businessHours as BusinessHoursMap
    const dayIndex = getWeekdayIndex(timezone, ref)
    if (dayIndex === null) return true

    const dayConfig = hours[String(dayIndex)]
    if (!dayConfig || !dayConfig.active) return false

    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(ref)
    const hourStr = parts.find((p) => p.type === 'hour')?.value
    const minuteStr = parts.find((p) => p.type === 'minute')?.value
    if (!hourStr || !minuteStr) return true

    const currentMinutes = timeToMinutes(`${hourStr}:${minuteStr}`)
    const openMinutes = timeToMinutes(dayConfig.open)
    const closeMinutes = timeToMinutes(dayConfig.close)
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes
  } catch {
    return true
  }
}

export function weekdayLabel(index: number, short = false): string {
  return (short ? WEEKDAY_LABELS_SHORT : WEEKDAY_LABELS)[index] ?? ''
}

export function formatHourRange(entry: BusinessHourEntry | undefined): string {
  if (!entry || !entry.active) return 'Fechado'
  return `${entry.open} – ${entry.close}`
}
