import type { Prisma } from '@prisma/client'

export function formatPrice(price: Prisma.Decimal | number): string {
  return Number(price).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  return remaining > 0 ? `${hours}h${remaining}min` : `${hours}h`
}
