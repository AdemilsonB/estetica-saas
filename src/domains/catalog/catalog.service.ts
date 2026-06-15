import { BusinessSegment } from '@prisma/client'
import { prisma } from '@/shared/database/prisma'
import { CatalogItemNotFoundError } from '@/shared/errors'
import { catalogMasterServiceRepository } from './catalog-master-service.repository'
import { catalogMasterProductRepository } from './catalog-master-product.repository'
import { catalogServiceRepository } from '@/domains/scheduling/service.repository'
import { productRepository } from '@/domains/inventory/product.repository'
import type { SaveSegmentsInput } from './types'

export class CatalogDomainService {
  async listServices(query: Parameters<typeof catalogMasterServiceRepository.list>[0]) {
    return catalogMasterServiceRepository.list(query)
  }

  async listProducts(query: Parameters<typeof catalogMasterProductRepository.list>[0]) {
    return catalogMasterProductRepository.list(query)
  }

  async listServiceCategories(segments?: Array<BusinessSegment>) {
    return catalogMasterServiceRepository.listCategories(segments)
  }

  async listProductCategories(segments?: Array<BusinessSegment>) {
    return catalogMasterProductRepository.listCategories(segments)
  }

  async activateService(tenantId: string, catalogServiceId: string) {
    const catalogItem = await catalogMasterServiceRepository.findById(catalogServiceId)
    if (!catalogItem) throw new CatalogItemNotFoundError(catalogServiceId)

    const existing = await catalogServiceRepository.findByCatalogId(tenantId, catalogServiceId)
    if (existing) return existing

    return catalogServiceRepository.create(tenantId, {
      name:             catalogItem.name,
      description:      catalogItem.description ?? undefined,
      imageUrl:         catalogItem.imageUrl ?? undefined,
      duration:         catalogItem.suggestedDuration,
      price:            catalogItem.suggestedPrice,
      priceType:        catalogItem.priceType,
      catalogServiceId: catalogItem.id,
      active:           true,
    })
  }

  async activateProduct(tenantId: string, catalogProductId: string) {
    const catalogItem = await catalogMasterProductRepository.findById(catalogProductId)
    if (!catalogItem) throw new CatalogItemNotFoundError(catalogProductId)

    const existing = await productRepository.findByCatalogId(tenantId, catalogProductId)
    if (existing) return existing

    return productRepository.createFromCatalog(tenantId, {
      name:             catalogItem.name,
      imageUrl:         catalogItem.imageUrl,
      salePrice:        catalogItem.suggestedPrice,
      catalogProductId: catalogItem.id,
    })
  }

  async deactivateService(tenantId: string, catalogServiceId: string): Promise<void> {
    await catalogServiceRepository.deleteByCatalogId(tenantId, catalogServiceId)
  }

  async deactivateProduct(tenantId: string, catalogProductId: string): Promise<void> {
    await productRepository.deleteByCatalogId(tenantId, catalogProductId)
  }

  async saveSegments(tenantId: string, input: SaveSegmentsInput) {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { segments: input.segments },
    })
  }

  async completeOnboarding(tenantId: string) {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { onboardingCompleted: true },
    })
  }

  async getTenantSegments(tenantId: string): Promise<Array<BusinessSegment>> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { segments: true },
    })
    return tenant?.segments ?? []
  }
}

export const catalogDomainService = new CatalogDomainService()
