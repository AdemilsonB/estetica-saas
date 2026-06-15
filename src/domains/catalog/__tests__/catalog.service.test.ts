import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CatalogDomainService } from '../catalog.service'
import { CatalogItemNotFoundError } from '@/shared/errors'

vi.mock('../catalog-master-service.repository', () => ({
  catalogMasterServiceRepository: {
    findById: vi.fn(),
    list: vi.fn(),
    listCategories: vi.fn(),
  },
}))

vi.mock('../catalog-master-product.repository', () => ({
  catalogMasterProductRepository: {
    findById: vi.fn(),
    list: vi.fn(),
    listCategories: vi.fn(),
  },
}))

vi.mock('@/domains/scheduling/service.repository', () => ({
  catalogServiceRepository: {
    findByCatalogId: vi.fn(),
    create: vi.fn(),
  },
}))

vi.mock('@/domains/inventory/product.repository', () => ({
  productRepository: {
    findByCatalogId: vi.fn(),
    createFromCatalog: vi.fn(),
  },
}))

vi.mock('@/shared/database/prisma', () => ({
  prisma: {
    tenant: { update: vi.fn(), findUnique: vi.fn() },
  },
}))

import { catalogMasterServiceRepository } from '../catalog-master-service.repository'
import { catalogMasterProductRepository } from '../catalog-master-product.repository'
import { catalogServiceRepository } from '@/domains/scheduling/service.repository'
import { productRepository } from '@/domains/inventory/product.repository'
import { prisma } from '@/shared/database/prisma'
import { Prisma } from '@prisma/client'

const service = new CatalogDomainService()
beforeEach(() => vi.clearAllMocks())

describe('activateService', () => {
  const catalogItem = {
    id: 'catalog-svc-1',
    name: 'Corte Feminino',
    description: 'Corte profissional',
    imageUrl: null,
    suggestedDuration: 60,
    suggestedPrice: new Prisma.Decimal('80.00'),
    priceType: 'FIXED' as const,
  }

  it('lança CatalogItemNotFoundError quando item não existe no catálogo', async () => {
    vi.mocked(catalogMasterServiceRepository.findById).mockResolvedValue(null)

    await expect(
      service.activateService('t1', 'catalog-svc-1')
    ).rejects.toBeInstanceOf(CatalogItemNotFoundError)
  })

  it('retorna instância existente sem criar duplicata (idempotência)', async () => {
    vi.mocked(catalogMasterServiceRepository.findById).mockResolvedValue(catalogItem as any)
    const existingService = { id: 'svc-tenant-1', name: 'Corte Feminino' }
    vi.mocked(catalogServiceRepository.findByCatalogId).mockResolvedValue(existingService as any)

    const result = await service.activateService('t1', 'catalog-svc-1')

    expect(result).toBe(existingService)
    expect(catalogServiceRepository.create).not.toHaveBeenCalled()
  })

  it('cria Service do tenant quando item ainda não foi ativado', async () => {
    vi.mocked(catalogMasterServiceRepository.findById).mockResolvedValue(catalogItem as any)
    vi.mocked(catalogServiceRepository.findByCatalogId).mockResolvedValue(null)
    const created = { id: 'svc-new', name: 'Corte Feminino', catalogServiceId: 'catalog-svc-1' }
    vi.mocked(catalogServiceRepository.create).mockResolvedValue(created as any)

    const result = await service.activateService('t1', 'catalog-svc-1')

    expect(catalogServiceRepository.create).toHaveBeenCalledWith('t1', expect.objectContaining({
      name: 'Corte Feminino',
      duration: 60,
      catalogServiceId: 'catalog-svc-1',
    }))
    expect(result).toBe(created)
  })
})

describe('activateProduct', () => {
  const catalogProduct = {
    id: 'catalog-prod-1',
    name: 'Shampoo Profissional',
    imageUrl: null,
    suggestedPrice: new Prisma.Decimal('35.00'),
  }

  it('lança CatalogItemNotFoundError quando produto não existe no catálogo', async () => {
    vi.mocked(catalogMasterProductRepository.findById).mockResolvedValue(null)

    await expect(
      service.activateProduct('t1', 'catalog-prod-1')
    ).rejects.toBeInstanceOf(CatalogItemNotFoundError)
  })

  it('retorna instância existente sem criar duplicata (idempotência)', async () => {
    vi.mocked(catalogMasterProductRepository.findById).mockResolvedValue(catalogProduct as any)
    const existingProduct = { id: 'prod-tenant-1', name: 'Shampoo' }
    vi.mocked(productRepository.findByCatalogId).mockResolvedValue(existingProduct as any)

    const result = await service.activateProduct('t1', 'catalog-prod-1')

    expect(result).toBe(existingProduct)
    expect(productRepository.createFromCatalog).not.toHaveBeenCalled()
  })

  it('cria Product do tenant quando item ainda não foi ativado', async () => {
    vi.mocked(catalogMasterProductRepository.findById).mockResolvedValue(catalogProduct as any)
    vi.mocked(productRepository.findByCatalogId).mockResolvedValue(null)
    const created = { id: 'prod-new', name: 'Shampoo', catalogProductId: 'catalog-prod-1' }
    vi.mocked(productRepository.createFromCatalog).mockResolvedValue(created as any)

    await service.activateProduct('t1', 'catalog-prod-1')

    expect(productRepository.createFromCatalog).toHaveBeenCalledWith('t1', expect.objectContaining({
      name: 'Shampoo Profissional',
      catalogProductId: 'catalog-prod-1',
    }))
  })
})

describe('saveSegments', () => {
  it('atualiza segments do tenant', async () => {
    vi.mocked(prisma.tenant.update).mockResolvedValue({} as any)

    await service.saveSegments('t1', { segments: ['HAIR_SALON', 'BARBERSHOP'] })

    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { segments: ['HAIR_SALON', 'BARBERSHOP'] },
    })
  })
})

describe('completeOnboarding', () => {
  it('marca onboardingCompleted como true', async () => {
    vi.mocked(prisma.tenant.update).mockResolvedValue({} as any)

    await service.completeOnboarding('t1')

    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { onboardingCompleted: true },
    })
  })
})
