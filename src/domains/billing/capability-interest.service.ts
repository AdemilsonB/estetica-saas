import { prisma } from '@/shared/database/prisma'
import { getCapability } from '@/shared/permissions/capability-registry'

/**
 * Registra o interesse de um tenant numa capacidade bloqueada (upsell).
 * Ignora silenciosamente chaves fora do registry — o log é sinal de crescimento,
 * não uma operação crítica, e não deve derrubar o fluxo do cliente.
 */
export async function logCapabilityInterest(tenantId: string, capabilityKey: string): Promise<void> {
  if (!getCapability(capabilityKey)) return
  await prisma.capabilityInterestLog.create({
    data: { tenantId, capabilityKey },
  })
}
