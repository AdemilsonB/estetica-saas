// src/domains/inventory/product.repository.ts
import { Prisma } from '@prisma/client'
import { prisma } from '@/shared/database/prisma'
import type { CreateProductInput, UpdateProductInput, ListProductsQuery } from './types'

export class ProductRepository {
  async findById(tenantId: string, id: string) {
    return prisma.product.findFirst({ where: { id, tenantId, active: true }, include: { category: true } })
  }

  async findByCatalogId(tenantId: string, catalogProductId: string) {
    return prisma.product.findFirst({
      where: { tenantId, catalogProductId, active: true },
    })
  }

  async list(tenantId: string, filters: ListProductsQuery) {
    const { name, categoryId, lowStock, page = 1, pageSize = 20 } = filters

    const where: Prisma.ProductWhereInput = {
      tenantId,
      active: true,
      ...(name && { name: { contains: name, mode: 'insensitive' } }),
      ...(categoryId && { categoryId }),
    }

    const all = await prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: { name: 'asc' },
    })

    const filtered = lowStock ? all.filter(p => p.stockQuantity <= p.lowStockAlert) : all
    const total = filtered.length
    const skip = (page - 1) * pageSize
    const data = filtered.slice(skip, skip + pageSize)

    return { data, total, page, pageSize }
  }

  async create(tenantId: string, input: CreateProductInput) {
    return prisma.product.create({
      data: {
        tenantId,
        name: input.name,
        categoryId: input.categoryId,
        costPrice: new Prisma.Decimal(input.costPrice),
        salePrice: new Prisma.Decimal(input.salePrice ?? 0),
        stockQuantity: input.stockQuantity ?? 0,
        lowStockAlert: input.lowStockAlert ?? 5,
        imageUrl: input.imageUrl,
      },
      include: { category: true },
    })
  }

  async update(tenantId: string, id: string, input: UpdateProductInput) {
    await prisma.product.updateMany({
      where: { id, tenantId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
        ...(input.costPrice !== undefined && { costPrice: new Prisma.Decimal(input.costPrice) }),
        ...(input.salePrice !== undefined && { salePrice: new Prisma.Decimal(input.salePrice) }),
        ...(input.lowStockAlert !== undefined && { lowStockAlert: input.lowStockAlert }),
        ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl }),
      },
    })
    return prisma.product.findFirst({ where: { id, tenantId }, include: { category: true } })
  }

  async softDelete(tenantId: string, id: string) {
    return prisma.product.updateMany({ where: { id, tenantId }, data: { active: false } })
  }

  async incrementStock(tenantId: string, id: string, quantity: number) {
    return prisma.product.updateMany({
      where: { id, tenantId },
      data: { stockQuantity: { increment: quantity } },
    })
  }

  async decrementStock(tenantId: string, id: string, quantity: number) {
    return prisma.product.updateMany({
      where: { id, tenantId },
      data: { stockQuantity: { decrement: quantity } },
    })
  }

  // Categories
  async listCategories(tenantId: string) {
    return prisma.productCategory.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    })
  }

  async findCategoryById(tenantId: string, id: string) {
    return prisma.productCategory.findFirst({ where: { id, tenantId } })
  }

  async createCategory(tenantId: string, name: string) {
    return prisma.productCategory.create({ data: { tenantId, name } })
  }

  async deleteCategory(tenantId: string, id: string) {
    return prisma.productCategory.deleteMany({ where: { id, tenantId } })
  }

  async countProductsByCategory(tenantId: string, categoryId: string) {
    return prisma.product.count({ where: { tenantId, categoryId, active: true } })
  }

  // Service template
  async getServiceTemplate(tenantId: string, serviceId: string) {
    return prisma.serviceProduct.findMany({
      where: { tenantId, serviceId },
      include: { product: true },
    })
  }

  async saveServiceTemplate(tenantId: string, serviceId: string, products: Array<{ productId: string; quantity: number }>) {
    return prisma.$transaction(async (tx) => {
      await tx.serviceProduct.deleteMany({ where: { tenantId, serviceId } })
      if (products.length === 0) return []
      await tx.serviceProduct.createMany({
        data: products.map(p => ({ tenantId, serviceId, productId: p.productId, quantity: p.quantity })),
      })
      return tx.serviceProduct.findMany({
        where: { tenantId, serviceId },
        include: { product: true },
      })
    })
  }

  // Appointment products
  async getAppointmentProducts(tenantId: string, appointmentId: string) {
    return prisma.appointmentProduct.findMany({
      where: { tenantId, appointmentId },
      include: { product: true },
    })
  }

  async saveAppointmentProducts(tenantId: string, appointmentId: string, products: Array<{ productId: string; quantity: number }>) {
    await prisma.$transaction(async (tx) => {
      await tx.appointmentProduct.deleteMany({ where: { tenantId, appointmentId } })
      if (products.length > 0) {
        await tx.appointmentProduct.createMany({
          data: products.map(p => ({ tenantId, appointmentId, productId: p.productId, quantity: p.quantity })),
        })
      }
    })
  }
}

export const productRepository = new ProductRepository()
