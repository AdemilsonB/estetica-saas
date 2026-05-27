export function startOfDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

export function endOfDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(23, 59, 59, 999)
  return r
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
}

export function startOfWeek(d: Date): Date {
  const r = new Date(d)
  const day = r.getDay()
  const diff = day === 0 ? -6 : 1 - day // segunda-feira
  r.setDate(r.getDate() + diff)
  r.setHours(0, 0, 0, 0)
  return r
}

export function endOfWeek(d: Date): Date {
  const start = startOfWeek(d)
  const r = new Date(start)
  r.setDate(r.getDate() + 6)
  r.setHours(23, 59, 59, 999)
  return r
}

export function startOfPrevMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() - 1, 1, 0, 0, 0, 0)
}

export function endOfPrevMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 0, 23, 59, 59, 999)
}

export function defaultFrom(): Date {
  return startOfMonth(new Date())
}

export function defaultTo(): Date {
  return endOfDay(new Date())
}
