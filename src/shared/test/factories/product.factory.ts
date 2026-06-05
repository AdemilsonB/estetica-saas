import type { Product } from '@prisma/client'
import { Prisma } from '@prisma/client'

export function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'product-test-id',
    tenantId: 'tenant-test-id',
    name: 'Shampoo Profissional',
    categoryId: null,
    costPrice: new Prisma.Decimal('10.00'),
    salePrice: new Prisma.Decimal('25.00'),
    stockQuantity: 10,
    lowStockAlert: 5,
    active: true,
    imageUrl: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}
