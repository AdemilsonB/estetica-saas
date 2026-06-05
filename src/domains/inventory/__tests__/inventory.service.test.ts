import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InventoryService } from '../inventory.service'
import { InsufficientStockError, ProductNotFoundError, CategoryHasProductsError, NotFoundError } from '@/shared/errors'
import { makeProduct } from '@/shared/test/factories/product.factory'

vi.mock('../product.repository', () => ({
  productRepository: {
    findById: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    incrementStock: vi.fn(),
    decrementStock: vi.fn(),
    listCategories: vi.fn(),
    findCategoryById: vi.fn(),
    createCategory: vi.fn(),
    deleteCategory: vi.fn(),
    countProductsByCategory: vi.fn(),
    getServiceTemplate: vi.fn(),
    saveServiceTemplate: vi.fn(),
    getAppointmentProducts: vi.fn(),
    saveAppointmentProducts: vi.fn(),
  },
}))

vi.mock('../stock.repository', () => ({
  stockRepository: {
    create: vi.fn(),
    list: vi.fn(),
  },
}))

vi.mock('@/shared/events/event-bus', () => ({
  eventBus: { publish: vi.fn(), subscribe: vi.fn() },
}))

import { productRepository } from '../product.repository'
import { stockRepository } from '../stock.repository'
import { eventBus } from '@/shared/events/event-bus'

const service = new InventoryService()

beforeEach(() => vi.clearAllMocks())

describe('recordSale', () => {
  it('lança ProductNotFoundError quando produto não existe', async () => {
    vi.mocked(productRepository.findById).mockResolvedValue(null)
    await expect(service.recordSale('t1', { quantity: 2, productId: 'p1' }, 'u1')).rejects.toBeInstanceOf(ProductNotFoundError)
  })

  it('lança InsufficientStockError quando estoque insuficiente', async () => {
    vi.mocked(productRepository.findById).mockResolvedValue(makeProduct({ stockQuantity: 2 }))
    await expect(service.recordSale('t1', { quantity: 5, productId: 'p1' }, 'u1')).rejects.toBeInstanceOf(InsufficientStockError)
  })

  it('decrementa estoque e publica evento product.sold', async () => {
    const product = makeProduct({ stockQuantity: 10 })
    vi.mocked(productRepository.findById).mockResolvedValue(product)
    vi.mocked(productRepository.decrementStock).mockResolvedValue({} as any)
    vi.mocked(stockRepository.create).mockResolvedValue({} as any)

    await service.recordSale('t1', { quantity: 2, productId: product.id }, 'u1')

    expect(productRepository.decrementStock).toHaveBeenCalledWith('t1', product.id, 2)
    expect(eventBus.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'product.sold' }))
  })

  it('usa salePrice do produto quando unitPrice não é informado', async () => {
    const product = makeProduct({ stockQuantity: 10, salePrice: new (await import('@prisma/client')).Prisma.Decimal('25.00') })
    vi.mocked(productRepository.findById).mockResolvedValue(product)
    vi.mocked(productRepository.decrementStock).mockResolvedValue({} as any)
    vi.mocked(stockRepository.create).mockResolvedValue({} as any)

    await service.recordSale('t1', { quantity: 2, productId: product.id }, 'u1')

    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ totalAmount: 50 })
      })
    )
  })
})

describe('recordPurchase', () => {
  it('lança ProductNotFoundError quando produto não existe', async () => {
    vi.mocked(productRepository.findById).mockResolvedValue(null)
    await expect(service.recordPurchase('t1', { quantity: 5, unitPrice: 10, productId: 'p1' }, 'u1')).rejects.toBeInstanceOf(ProductNotFoundError)
  })

  it('incrementa estoque e publica evento stock.purchased', async () => {
    const product = makeProduct({ stockQuantity: 0 })
    vi.mocked(productRepository.findById).mockResolvedValue(product)
    vi.mocked(productRepository.incrementStock).mockResolvedValue({} as any)
    vi.mocked(stockRepository.create).mockResolvedValue({} as any)

    await service.recordPurchase('t1', { quantity: 10, unitPrice: 15, productId: product.id }, 'u1')

    expect(productRepository.incrementStock).toHaveBeenCalledWith('t1', product.id, 10)
    expect(eventBus.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'stock.purchased' }))
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ totalAmount: 150 })
      })
    )
  })
})

describe('deleteCategory', () => {
  it('lança NotFoundError quando categoria não existe', async () => {
    vi.mocked(productRepository.findCategoryById).mockResolvedValue(null)
    await expect(service.deleteCategory('t1', 'cat-inexistente')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('lança CategoryHasProductsError quando há produtos vinculados', async () => {
    vi.mocked(productRepository.findCategoryById).mockResolvedValue({ id: 'cat1', name: 'Cat', tenantId: 't1' } as any)
    vi.mocked(productRepository.countProductsByCategory).mockResolvedValue(3)
    await expect(service.deleteCategory('t1', 'cat1')).rejects.toBeInstanceOf(CategoryHasProductsError)
  })

  it('deleta categoria quando não há produtos', async () => {
    vi.mocked(productRepository.findCategoryById).mockResolvedValue({ id: 'cat1', name: 'Cat', tenantId: 't1' } as any)
    vi.mocked(productRepository.countProductsByCategory).mockResolvedValue(0)
    vi.mocked(productRepository.deleteCategory).mockResolvedValue({} as any)
    await service.deleteCategory('t1', 'cat1')
    expect(productRepository.deleteCategory).toHaveBeenCalledWith('t1', 'cat1')
  })
})

describe('finalizeAppointmentProducts', () => {
  it('lança ProductNotFoundError se produto não encontrado', async () => {
    vi.mocked(productRepository.findById).mockResolvedValue(null)
    await expect(
      service.finalizeAppointmentProducts('t1', 'appt1', { products: [{ productId: 'p1', quantity: 1 }] }, 'u1')
    ).rejects.toBeInstanceOf(ProductNotFoundError)
  })

  it('lança InsufficientStockError se estoque insuficiente', async () => {
    vi.mocked(productRepository.findById).mockResolvedValue(makeProduct({ stockQuantity: 1 }))
    await expect(
      service.finalizeAppointmentProducts('t1', 'appt1', { products: [{ productId: 'p1', quantity: 5 }] }, 'u1')
    ).rejects.toBeInstanceOf(InsufficientStockError)
  })
})

describe('deleteProduct', () => {
  it('lança ProductNotFoundError quando produto não existe', async () => {
    vi.mocked(productRepository.findById).mockResolvedValue(null)
    await expect(service.deleteProduct('t1', 'p1')).rejects.toBeInstanceOf(ProductNotFoundError)
  })
})
