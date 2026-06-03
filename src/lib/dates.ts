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

export function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

// --- Helpers timezone-aware (usam Intl.DateTimeFormat — sem libs externas) ---

function tzOffsetMs(tz: string, at: Date): number {
  const utcMs = at.getTime();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(at);
  const p = (type: string) =>
    Number(parts.find((x) => x.type === type)!.value);
  const localMs = Date.UTC(
    p('year'), p('month') - 1, p('day'),
    p('hour'), p('minute'), p('second'),
  );
  return utcMs - localMs;
}

/**
 * Retorna {start, end} do dia de `date` no timezone informado.
 * Ex: dayBoundsInTz('America/Sao_Paulo') → start=03:00Z, end=próx.02:59Z
 */
export function dayBoundsInTz(tz: string, date: Date = new Date()): { start: Date; end: Date } {
  const offsetMs = tzOffsetMs(tz, date);
  const localDateStr = new Intl.DateTimeFormat('sv-SE', { timeZone: tz }).format(date);
  const [y, mo, d] = localDateStr.split('-').map(Number);
  return {
    start: new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0) + offsetMs),
    end: new Date(Date.UTC(y, mo - 1, d, 23, 59, 59, 999) + offsetMs),
  };
}

/**
 * Retorna {start, end} do mês de `date` no timezone informado.
 * Ex: monthBoundsInTz('America/Sao_Paulo') em junho → start=jun-01T03Z, end=jul-01T02:59Z
 */
export function monthBoundsInTz(tz: string, date: Date = new Date()): { start: Date; end: Date } {
  const offsetMs = tzOffsetMs(tz, date);
  const localDateStr = new Intl.DateTimeFormat('sv-SE', { timeZone: tz }).format(date);
  const [y, mo] = localDateStr.split('-').map(Number);
  const start = new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0, 0) + offsetMs);
  // fim do mês = início do próximo mês menos 1ms
  const end = new Date(new Date(Date.UTC(y, mo, 1, 0, 0, 0, 0) + offsetMs).getTime() - 1);
  return { start, end };
}
