// src/domains/inventory/inventory.service.ts
import { Prisma } from '@prisma/client'
import { eventBus } from '@/shared/events/event-bus'
import {
  ProductNotFoundError,
  InsufficientStockError,
  CategoryHasProductsError,
} from '@/shared/errors'
import { productRepository } from './product.repository'
import { stockRepository } from './stock.repository'
import type {
  CreateProductInput,
  UpdateProductInput,
  RecordPurchaseInput,
  RecordSaleInput,
  AppointmentProductsInput,
  ServiceTemplateInput,
  ListProductsQuery,
  ListMovementsQuery,
} from './types'

export class InventoryService {
  async listProducts(tenantId: string, filters: ListProductsQuery) {
    return productRepository.list(tenantId, filters)
  }

  async createProduct(tenantId: string, input: CreateProductInput) {
    return productRepository.create(tenantId, input)
  }

  async updateProduct(tenantId: string, id: string, input: UpdateProductInput) {
    const product = await productRepository.findById(tenantId, id)
    if (!product) throw new ProductNotFoundError()
    return productRepository.update(tenantId, id, input)
  }

  async deleteProduct(tenantId: string, id: string) {
    const product = await productRepository.findById(tenantId, id)
    if (!product) throw new ProductNotFoundError()
    return productRepository.softDelete(tenantId, id)
  }

  async listCategories(tenantId: string) {
    return productRepository.listCategories(tenantId)
  }

  async createCategory(tenantId: string, name: string) {
    return productRepository.createCategory(tenantId, name)
  }

  async deleteCategory(tenantId: string, id: string) {
    const count = await productRepository.countProductsByCategory(tenantId, id)
    if (count > 0) throw new CategoryHasProductsError()
    return productRepository.deleteCategory(tenantId, id)
  }

  async recordPurchase(
    tenantId: string,
    input: RecordPurchaseInput & { productId: string },
    createdByUserId: string,
  ) {
    const product = await productRepository.findById(tenantId, input.productId)
    if (!product) throw new ProductNotFoundError()

    const totalAmount = input.quantity * input.unitPrice

    await productRepository.incrementStock(tenantId, product.id, input.quantity)

    const movement = await stockRepository.create(tenantId, {
      productId: product.id,
      type: 'PURCHASE',
      quantity: input.quantity,
      unitPrice: new Prisma.Decimal(input.unitPrice),
      totalAmount: new Prisma.Decimal(totalAmount),
      notes: input.notes,
      createdByUserId,
    })

    eventBus.publish({
      type: 'stock.purchased',
      payload: { tenantId, productId: product.id, quantity: input.quantity, totalAmount },
    })

    return movement
  }

  async recordSale(
    tenantId: string,
    input: RecordSaleInput & { productId: string },
    createdByUserId: string,
  ) {
    const product = await productRepository.findById(tenantId, input.productId)
    if (!product) throw new ProductNotFoundError()

    if (product.stockQuantity < input.quantity) {
      throw new InsufficientStockError(product.stockQuantity, input.quantity)
    }

    const unitPrice = input.unitPrice ?? Number(product.salePrice)
    const totalAmount = input.quantity * unitPrice

    await productRepository.decrementStock(tenantId, product.id, input.quantity)

    const movement = await stockRepository.create(tenantId, {
      productId: product.id,
      type: 'SALE',
      quantity: -input.quantity,
      unitPrice: new Prisma.Decimal(unitPrice),
      totalAmount: new Prisma.Decimal(totalAmount),
      createdByUserId,
    })

    eventBus.publish({
      type: 'product.sold',
      payload: {
        tenantId,
        productId: product.id,
        quantity: input.quantity,
        totalAmount,
        customerId: input.customerId,
      },
    })

    return movement
  }

  async getServiceTemplate(tenantId: string, serviceId: string) {
    return productRepository.getServiceTemplate(tenantId, serviceId)
  }

  async saveServiceTemplate(tenantId: string, serviceId: string, input: ServiceTemplateInput) {
    return productRepository.saveServiceTemplate(tenantId, serviceId, input.products)
  }

  async finalizeAppointmentProducts(
    tenantId: string,
    appointmentId: string,
    input: AppointmentProductsInput,
    createdByUserId: string,
  ) {
    for (const item of input.products) {
      const product = await productRepository.findById(tenantId, item.productId)
      if (!product) throw new ProductNotFoundError()
      if (product.stockQuantity < item.quantity) {
        throw new InsufficientStockError(product.stockQuantity, item.quantity)
      }
    }

    await productRepository.saveAppointmentProducts(tenantId, appointmentId, input.products)

    for (const item of input.products) {
      await productRepository.decrementStock(tenantId, item.productId, item.quantity)
      await stockRepository.create(tenantId, {
        productId: item.productId,
        type: 'APPOINTMENT_USE',
        quantity: -item.quantity,
        appointmentId,
        createdByUserId,
      })
    }

    return productRepository.getAppointmentProducts(tenantId, appointmentId)
  }

  async getAppointmentProducts(tenantId: string, appointmentId: string) {
    return productRepository.getAppointmentProducts(tenantId, appointmentId)
  }

  async listMovements(tenantId: string, filters: ListMovementsQuery) {
    return stockRepository.list(tenantId, filters)
  }
}

export const inventoryService = new InventoryService()
