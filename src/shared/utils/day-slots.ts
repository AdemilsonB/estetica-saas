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
//
// A conta parte do INÍCIO DA LINHA (bucket), não do horário exato: um
// agendamento das 09:15 às 09:45 dura 30min, mas invade a linha das 09:30 e
// precisa de 2 linhas. Medir só a duração deixava essa linha clicável e
// permitia marcar em cima de um horário ocupado.
export function appointmentSlotSpan(startsAt: string, endsAt: string, intervalMinutes: number): number {
  const start = new Date(startsAt)
  const durationMinutes = (new Date(endsAt).getTime() - start.getTime()) / 60000
  const offsetFromBucket = (start.getHours() * 60 + start.getMinutes()) % intervalMinutes
  return Math.max(1, Math.ceil((offsetFromBucket + durationMinutes) / intervalMinutes))
}

// Status que deixam de ocupar o horário. Espelha exatamente a regra de
// conflito do backend (`appointment.repository.ts`, `notIn: [CANCELLED,
// NO_SHOW]`) — se a grade divergir disso, a UI mostra bloqueado enquanto o
// backend aceita agendar por cima.
export const SLOT_FREEING_STATUSES = ['CANCELLED', 'NO_SHOW'] as const

export function occupiesSlot(status: string): boolean {
  return !(SLOT_FREEING_STATUSES as readonly string[]).includes(status)
}

// Todos os horários de linha que um agendamento ocupa, do bucket de início
// até o fim da duração. Usado pra garantir que a timeline tenha linha pra
// cada slot coberto — sem isso, um agendamento que começa fora do expediente
// cria um buraco na grade e a matemática de span (que assume linhas de
// `intervalMinutes` uniformes) passa a bloquear o intervalo errado.
export function appointmentSlotTimes(
  startsAt: string,
  endsAt: string,
  intervalMinutes: number,
): string[] {
  const start = new Date(startsAt)
  const bucket = slotBucket(
    `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`,
    intervalMinutes,
  )
  const [bh, bm] = bucket.split(':').map(Number)
  const span = appointmentSlotSpan(startsAt, endsAt, intervalMinutes)

  const times: string[] = []
  for (let i = 0; i < span; i++) {
    const total = bh * 60 + bm + i * intervalMinutes
    if (total >= 24 * 60) break // não vaza pro dia seguinte
    times.push(
      `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`,
    )
  }
  return times
}
