export type BusinessHoursDay = { open: string; close: string; active: boolean }

// Local, não UTC — toISOString().slice(0,10) desloca o dia perto da meia-noite
// em fusos negativos (Brasil é UTC-3).
export function toDateInputLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function buildDaySlots(hours: BusinessHoursDay | undefined, intervalMinutes: number): string[] {
  if (!hours || !hours.active) return []
  const [openH, openM] = hours.open.split(':').map(Number)
  const [closeH, closeM] = hours.close.split(':').map(Number)
  const openMin = openH * 60 + openM
  const closeMin = closeH * 60 + closeM
  const result: string[] = []
  for (let t = openMin; t < closeMin; t += intervalMinutes) {
    const h = Math.floor(t / 60)
    const m = t % 60
    result.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }
  return result
}

// Agrupa um horário "HH:MM" na linha de 30 min (ou o intervalo configurado)
// em que ele começa. Um horário digitado manualmente (ex.: 09:15) cai na
// linha anterior (09:00).
export function slotBucket(time: string, intervalMinutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const totalMin = Math.floor((h * 60 + m) / intervalMinutes) * intervalMinutes
  const bh = Math.floor(totalMin / 60)
  const bm = totalMin % 60
  return `${String(bh).padStart(2, '0')}:${String(bm).padStart(2, '0')}`
}

// Quantas linhas de `intervalMinutes` um agendamento cobre na timeline,
// arredondado pra cima — nunca sub-bloquear o intervalo (ex.: 45min num grid
// de 30min precisa de 2 linhas, não 1,5).
export function appointmentSlotSpan(startsAt: string, endsAt: string, intervalMinutes: number): number {
  const durationMinutes = (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000
  return Math.max(1, Math.ceil(durationMinutes / intervalMinutes))
}
