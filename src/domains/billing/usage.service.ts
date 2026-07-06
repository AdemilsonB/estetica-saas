import { prisma } from '@/shared/database/prisma'
import { planLimitsService } from '@/domains/billing/plan-limits.service'
import { catalogServiceRepository } from '@/domains/scheduling/service.repository'
import { productRepository } from '@/domains/inventory/product.repository'
import { customerRepository } from '@/domains/crm/customer.repository'
import { appointmentRepository } from '@/domains/scheduling/appointment.repository'
import { notificationRepository } from '@/domains/notifications/notification.repository'
import { whatsAppQuotaService } from '@/domains/notifications/quota/whatsapp-quota.service'
import { LIMIT_REGISTRY, type LimitKey, type LimitKind } from '@/shared/permissions/limit-registry'

export type UsageStatus = 'ok' | 'warning' | 'exceeded'

export type UsageItem = {
  limitKey: LimitKey
  label: string
  current: number
  limit: number
  percent: number
  status: UsageStatus
  kind: LimitKind
  unlimited: boolean
}

async function getCurrentCount(tenantId: string, limitKey: LimitKey): Promise<number> {
  switch (limitKey) {
    case 'max_users':
      return prisma.user.count({ where: { tenantId } })
    case 'max_appointments_month':
      return appointmentRepository.countThisMonth(tenantId)
    case 'max_services':
      return catalogServiceRepository.count(tenantId)
    case 'max_products':
      return productRepository.count(tenantId)
    case 'max_customers':
      return customerRepository.count(tenantId)
    case 'max_whatsapp_month': {
      const { used } = await whatsAppQuotaService.getUsage(tenantId)
      return used
    }
    case 'max_email_month':
      return notificationRepository.countEmailsThisMonth(tenantId)
    default:
      throw new Error(`Limite sem contador de uso implementado: ${limitKey}`)
  }
}

const RELEVANT_LIMIT_KEYS: LimitKey[] = [
  'max_users',
  'max_appointments_month',
  'max_services',
  'max_products',
  'max_customers',
  'max_whatsapp_month',
  'max_email_month',
]

export async function getTenantUsage(tenantId: string): Promise<UsageItem[]> {
  return Promise.all(
    RELEVANT_LIMIT_KEYS.map(async (limitKey) => {
      const meta = LIMIT_REGISTRY[limitKey]
      const current = await getCurrentCount(tenantId, limitKey)
      const { status, percent, limit } = await planLimitsService.checkUsage(tenantId, limitKey, current)

      return {
        limitKey,
        label: meta.label,
        current,
        limit,
        percent,
        status,
        kind: meta.kind,
        unlimited: limit >= meta.unlimitedThreshold,
      }
    })
  )
}
