export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}min`
}

export function minutesToHHMM(minutes: number): string {
  const h = Math.floor(Math.max(0, minutes) / 60)
  const m = Math.max(0, minutes) % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Retorna null para entradas inválidas. Mínimo de 5min e máximo de 480min (8h)
// conforme validação do servidor. Aceita formato "HH:MM" ou minutos inteiros.
export function hhmmToMinutes(value: string): number | null {
  const trimmed = value.trim()
  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10)
    return n >= 5 && n <= 480 ? n : null
  }
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  if (m >= 60) return null
  const total = h * 60 + m
  return total >= 5 && total <= 480 ? total : null
}
