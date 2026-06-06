// src/domains/inventory/inventory.service.ts
import { Prisma } from '@prisma/client'
import { eventBus } from '@/shared/events/event-bus'
import {
  ProductNotFoundError,
  InsufficientStockError,
  CategoryHasProductsError,
  NotFoundError,
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
    const category = await productRepository.findCategoryById(tenantId, id)
    if (!category) throw new NotFoundError('Categoria')
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

    const totalAmount = new Prisma.Decimal(input.unitPrice).mul(input.quantity).toNumber()

    // MVP: incrementStock e create StockMovement são operações separadas sem transação.
    // Em caso de falha no create, o estoque permanece incrementado. Aceito para esta fase.
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
      payload: { tenantId, productId: product.id, productName: product.name, quantity: input.quantity, totalAmount },
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
    const totalAmount = new Prisma.Decimal(unitPrice).mul(input.quantity).toNumber()

    // MVP: decrementStock e create StockMovement são operações separadas sem transação.
    // Em caso de falha no create, o estoque permanece decrementado. Aceito para esta fase.
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
        productName: product.name,
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
    context: { serviceName: string; customerName: string },
  ) {
    // Busca todos os produtos em paralelo em vez de sequencialmente
    const products = await Promise.all(
      input.products.map(item => productRepository.findById(tenantId, item.productId))
    )

    // Valida todos antes de fazer qualquer escrita
    for (let i = 0; i < input.products.length; i++) {
      const product = products[i]
      const item = input.products[i]
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

  async updateCompletedAppointmentProducts(
    tenantId: string,
    appointmentId: string,
    newProducts: Array<{ productId: string; quantity: number }>,
    stockAction: 'apply' | 'none',
    createdByUserId: string,
    context: { serviceName: string; customerName: string } = { serviceName: '', customerName: '' },
  ) {
    const oldProducts = await productRepository.getAppointmentProducts(tenantId, appointmentId)
    const oldMap = new Map(oldProducts.map((p) => [p.productId, p.quantity]))
    const newMap = new Map(newProducts.map((p) => [p.productId, p.quantity]))

    if (stockAction === 'apply') {
      const allPids = new Set([...oldMap.keys(), ...newMap.keys()])

      type ProductRecord = NonNullable<Awaited<ReturnType<typeof productRepository.findById>>>
      const changes: Array<{ pid: string; diff: number; product: ProductRecord }> = []

      for (const pid of allPids) {
        const oldQty = oldMap.get(pid) ?? 0
        const newQty = newMap.get(pid) ?? 0
        const diff = newQty - oldQty
        if (diff === 0) continue

        const product = await productRepository.findById(tenantId, pid)
        if (!product) throw new ProductNotFoundError()
        if (diff > 0 && product.stockQuantity < diff) {
          throw new InsufficientStockError(product.stockQuantity, diff, product.name)
        }
        changes.push({ pid, diff, product })
      }

      for (const { pid, diff, product } of changes) {
        const costPrice = Number(product.costPrice ?? 0)
        const absDiff = Math.abs(diff)

        if (diff > 0) {
          await productRepository.decrementStock(tenantId, pid, diff)
          await stockRepository.create(tenantId, {
            productId: pid,
            type: 'ADJUSTMENT',
            quantity: -diff,
            appointmentId,
            createdByUserId,
          })
          eventBus.publish({
            type: 'stock.appointment_use',
            payload: {
              tenantId,
              productId: pid,
              productName: product.name,
              serviceName: context.serviceName,
              customerName: context.customerName,
              quantity: diff,
              costPrice,
              totalCost: costPrice * diff,
              appointmentId,
            },
          })
        } else {
          await productRepository.incrementStock(tenantId, pid, absDiff)
          await stockRepository.create(tenantId, {
            productId: pid,
            type: 'ADJUSTMENT',
            quantity: absDiff,
            appointmentId,
            createdByUserId,
          })
          eventBus.publish({
            type: 'stock.appointment_restore',
            payload: {
              tenantId,
              productId: pid,
              productName: product.name,
              serviceName: context.serviceName,
              customerName: context.customerName,
              quantity: absDiff,
              costPrice,
              totalCost: costPrice * absDiff,
              appointmentId,
            },
          })
        }
      }
    }

    await productRepository.saveAppointmentProducts(tenantId, appointmentId, newProducts)
    return productRepository.getAppointmentProducts(tenantId, appointmentId)
  }

  async listMovements(tenantId: string, filters: ListMovementsQuery) {
    return stockRepository.list(tenantId, filters)
  }
}

export const inventoryService = new InventoryService()
