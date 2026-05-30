import type { Tenant } from '@prisma/client'
import { PlanName } from '@prisma/client'

export function makeTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: 'tenant-test-id',
    name: 'Salão Teste',
    slug: 'salao-teste',
    plan: PlanName.FREE,
    phone: null,
    address: null,
    whatsappEnabled: false,
    timezone: 'America/Sao_Paulo',
    whatsappTemplateConfig: null,
    businessHours: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}
