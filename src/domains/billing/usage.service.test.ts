import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from '@/shared/test/prisma-mock'

vi.mock('@/domains/billing/plan-limits.service', () => ({
  planLimitsService: {
    checkUsage: vi.fn(),
  },
}))
vi.mock('@/domains/scheduling/service.repository', () => ({
  catalogServiceRepository: { count: vi.fn() },
}))
vi.mock('@/domains/inventory/product.repository', () => ({
  productRepository: { count: vi.fn() },
}))
vi.mock('@/domains/crm/customer.repository', () => ({
  customerRepository: { count: vi.fn() },
}))
vi.mock('@/domains/scheduling/appointment.repository', () => ({
  appointmentRepository: { countThisMonth: vi.fn() },
}))
vi.mock('@/domains/notifications/notification.repository', () => ({
  notificationRepository: { countEmailsThisMonth: vi.fn() },
}))
vi.mock('@/domains/notifications/quota/whatsapp-quota.service', () => ({
  whatsAppQuotaService: { getUsage: vi.fn() },
}))

import { getTenantUsage } from './usage.service'
import { planLimitsService } from '@/domains/billing/plan-limits.service'
import { catalogServiceRepository } from '@/domains/scheduling/service.repository'
import { productRepository } from '@/domains/inventory/product.repository'
import { customerRepository } from '@/domains/crm/customer.repository'
import { appointmentRepository } from '@/domains/scheduling/appointment.repository'
import { notificationRepository } from '@/domains/notifications/notification.repository'
import { whatsAppQuotaService } from '@/domains/notifications/quota/whatsapp-quota.service'

const TENANT_ID = 'tenant-abc'

describe('getTenantUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.user.count.mockResolvedValue(2)
    vi.mocked(catalogServiceRepository.count).mockResolvedValue(5)
    vi.mocked(productRepository.count).mockResolvedValue(7)
    vi.mocked(customerRepository.count).mockResolvedValue(30)
    vi.mocked(appointmentRepository.countThisMonth).mockResolvedValue(40)
    vi.mocked(notificationRepository.countEmailsThisMonth).mockResolvedValue(10)
    vi.mocked(whatsAppQuotaService.getUsage).mockResolvedValue({
      used: 3,
      limit: 500,
      resetDate: '2026-08-01',
    })

    vi.mocked(planLimitsService.checkUsage).mockImplementation(async (_tenantId, limitKey, current) => {
      if (limitKey === 'max_roles') {
        return { status: 'ok', percent: 0, limit: 999999, current }
      }
      return { status: 'ok', percent: 50, limit: 100, current }
    })
  })

  it('retorna um UsageItem para cada limite relevante com current/percent/status', async () => {
    const items = await getTenantUsage(TENANT_ID)

    const keys = items.map((i) => i.limitKey)
    expect(keys).toEqual([
      'max_users',
      'max_appointments_month',
      'max_services',
      'max_products',
      'max_customers',
      'max_whatsapp_month',
      'max_email_month',
    ])

    const users = items.find((i) => i.limitKey === 'max_users')!
    expect(users.current).toBe(2)
    expect(users.percent).toBe(50)
    expect(users.status).toBe('ok')
    expect(users.label).toBe('Máximo de usuários')
    expect(users.kind).toBe('hard')
    expect(users.unlimited).toBe(false)
  })

  it('usa a contagem ao vivo do WhatsAppQuotaService (used) como current', async () => {
    const items = await getTenantUsage(TENANT_ID)
    expect(whatsAppQuotaService.getUsage).toHaveBeenCalledWith(TENANT_ID)
    expect(planLimitsService.checkUsage).toHaveBeenCalledWith(TENANT_ID, 'max_whatsapp_month', 3)
  })

  it('marca unlimited=true quando o limite retornado por checkUsage é >= unlimitedThreshold', async () => {
    vi.mocked(planLimitsService.checkUsage).mockImplementation(async (_tenantId, limitKey, current) => {
      if (limitKey === 'max_users') {
        return { status: 'ok', percent: 0, limit: 999999, current }
      }
      return { status: 'ok', percent: 50, limit: 100, current }
    })

    const items = await getTenantUsage(TENANT_ID)
    const users = items.find((i) => i.limitKey === 'max_users')!
    expect(users.unlimited).toBe(true)
  })

  it('propaga status exceeded quando checkUsage retorna limite zero', async () => {
    vi.mocked(planLimitsService.checkUsage).mockImplementation(async (_tenantId, limitKey, current) => {
      if (limitKey === 'max_whatsapp_month') {
        return { status: 'exceeded', percent: 100, limit: 0, current }
      }
      return { status: 'ok', percent: 50, limit: 100, current }
    })

    const items = await getTenantUsage(TENANT_ID)
    const whatsapp = items.find((i) => i.limitKey === 'max_whatsapp_month')!
    expect(whatsapp.status).toBe('exceeded')
    expect(whatsapp.percent).toBe(100)
  })
})
