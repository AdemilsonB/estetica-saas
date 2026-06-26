import { Prisma } from '@prisma/client'
import { prisma } from '@/shared/database/prisma'

/**
 * Reivindica um evento de webhook do Stripe para processamento idempotente.
 *
 * Insere o `eventId` na tabela de eventos processados. Se já existir (re-entrega
 * do Stripe por retry de rede), a inserção viola a PK e a função retorna `false`,
 * sinalizando que o evento já foi tratado e deve ser ignorado.
 *
 * @returns `true` se este é o primeiro processamento (deve seguir), `false` se duplicado.
 */
export async function claimStripeEvent(eventId: string, type: string): Promise<boolean> {
  try {
    await prisma.processedStripeEvent.create({ data: { eventId, type } })
    return true
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return false
    }
    throw error
  }
}

/**
 * Libera a reivindicação de um evento (remove o registro), para que o Stripe
 * possa reprocessá-lo numa próxima re-entrega. Deve ser chamada quando o
 * processamento falha após a reivindicação ter sido feita.
 */
export async function releaseStripeEvent(eventId: string): Promise<void> {
  await prisma.processedStripeEvent.deleteMany({ where: { eventId } })
}
