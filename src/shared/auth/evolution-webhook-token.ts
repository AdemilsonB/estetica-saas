import { createHmac } from 'crypto'
import { env } from '@/shared/config/env'

// A Evolution API não assina os webhooks que envia (configureWebhook/configureMessagesWebhook
// só registram {url, events}, sem header nem secret) — por isso o token vai embutido na própria
// URL registrada, derivado por HMAC do instanceName (= tenantId) para não ser um segredo único
// compartilhado por todos os tenants.

export function createEvolutionWebhookToken(instanceName: string): string {
  if (!env.EVOLUTION_WEBHOOK_SECRET) {
    throw new Error('EVOLUTION_WEBHOOK_SECRET não configurada.')
  }
  return createHmac('sha256', env.EVOLUTION_WEBHOOK_SECRET).update(instanceName).digest('hex')
}

export function isValidEvolutionWebhookToken(instanceName: string, token: string): boolean {
  if (!env.EVOLUTION_WEBHOOK_SECRET || !instanceName || !token) return false
  return token === createHmac('sha256', env.EVOLUTION_WEBHOOK_SECRET).update(instanceName).digest('hex')
}
