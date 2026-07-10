import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/shared/database/prisma'
import { activationRepository } from './activation.repository'

// O setup global mocka '@/shared/database/prisma' como {}. Injetamos os métodos aqui.
const prismaMock = prisma as unknown as {
  serviceCategory: { count: ReturnType<typeof vi.fn> }
  service: { count: ReturnType<typeof vi.fn> }
  customer: { count: ReturnType<typeof vi.fn> }
  role: { count: ReturnType<typeof vi.fn> }
  tenant: { findUnique: ReturnType<typeof vi.fn> }
  brandingConfig: { findUnique: ReturnType<typeof vi.fn> }
}

beforeEach(() => {
  prismaMock.serviceCategory = { count: vi.fn().mockResolvedValue(2) }
  prismaMock.service = { count: vi.fn().mockResolvedValue(3) }
  prismaMock.customer = { count: vi.fn().mockResolvedValue(0) }
  prismaMock.role = { count: vi.fn().mockResolvedValue(1) }
  prismaMock.tenant = {
    findUnique: vi.fn().mockResolvedValue({
      phone: '41999999999',
      address: 'Rua X',
      businessHours: { seg: {} },
      evolutionConnected: true,
    }),
  }
  prismaMock.brandingConfig = {
    findUnique: vi.fn().mockResolvedValue({ logoUrl: 'https://cdn/logo.png' }),
  }
})

describe('activationRepository.getActivationCounts', () => {
  it('filtra todas as contagens por tenantId com os critérios corretos', async () => {
    await activationRepository.getActivationCounts('t1')

    expect(prismaMock.serviceCategory.count).toHaveBeenCalledWith({ where: { tenantId: 't1', active: true } })
    expect(prismaMock.service.count).toHaveBeenCalledWith({ where: { tenantId: 't1', active: true } })
    expect(prismaMock.customer.count).toHaveBeenCalledWith({ where: { tenantId: 't1', deletedAt: null } })
    expect(prismaMock.role.count).toHaveBeenCalledWith({ where: { tenantId: 't1', isDefault: false } })
    expect(prismaMock.tenant.findUnique).toHaveBeenCalledWith({
      where: { id: 't1' },
      select: { phone: true, address: true, businessHours: true, evolutionConnected: true },
    })
    expect(prismaMock.brandingConfig.findUnique).toHaveBeenCalledWith({
      where: { tenantId: 't1' },
      select: { logoUrl: true },
    })
  })

  it('mapeia o resultado para ActivationCounts', async () => {
    const counts = await activationRepository.getActivationCounts('t1')
    expect(counts).toEqual({
      activeCategoryCount: 2,
      activeServiceCount: 3,
      activeCustomerCount: 0,
      customRoleCount: 1,
      tenant: {
        phone: '41999999999',
        address: 'Rua X',
        businessHours: { seg: {} },
        evolutionConnected: true,
      },
      logoUrl: 'https://cdn/logo.png',
    })
  })

  it('usa defaults seguros quando tenant/branding não existem', async () => {
    prismaMock.tenant.findUnique = vi.fn().mockResolvedValue(null)
    prismaMock.brandingConfig.findUnique = vi.fn().mockResolvedValue(null)

    const counts = await activationRepository.getActivationCounts('t1')
    expect(counts.tenant).toEqual({
      phone: null,
      address: null,
      businessHours: null,
      evolutionConnected: false,
    })
    expect(counts.logoUrl).toBeNull()
  })
})
