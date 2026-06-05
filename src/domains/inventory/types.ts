// src/domains/inventory/types.ts
import { z } from 'zod'
import { StockMovementType } from '@prisma/client'

export const createProductSchema = z.object({
  name: z.string().trim().min(2).max(100),
  categoryId: z.string().cuid().optional(),
  costPrice: z.number().nonnegative(),
  salePrice: z.number().positive(),
  stockQuantity: z.number().int().min(0).default(0),
  lowStockAlert: z.number().int().min(0).default(5),
  imageUrl: z.string().url().optional(),
})
export type CreateProductInput = z.infer<typeof createProductSchema>

export const updateProductSchema = createProductSchema.partial()
export type UpdateProductInput = z.infer<typeof updateProductSchema>

export const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(60),
})
export type CreateCategoryInput = z.infer<typeof createCategorySchema>

export const recordPurchaseSchema = z.object({
  quantity: z.number().int().min(1),
  unitPrice: z.number().nonnegative(),
  notes: z.string().trim().max(200).optional(),
})
export type RecordPurchaseInput = z.infer<typeof recordPurchaseSchema>

export const recordSaleSchema = z.object({
  quantity: z.number().int().min(1),
  unitPrice: z.number().nonnegative().optional(),
  customerId: z.string().cuid().optional(),
})
export type RecordSaleInput = z.infer<typeof recordSaleSchema>

export const appointmentProductsSchema = z.object({
  products: z.array(z.object({
    productId: z.string().cuid(),
    quantity: z.number().int().min(1),
  })),
  stockAction: z.enum(['deduct', 'restore', 'none']).default('none'),
})
export type AppointmentProductsInput = z.infer<typeof appointmentProductsSchema>

export const serviceTemplateSchema = z.object({
  products: z.array(z.object({
    productId: z.string().cuid(),
    quantity: z.number().int().min(1),
  })),
})
export type ServiceTemplateInput = z.infer<typeof serviceTemplateSchema>

export const listProductsSchema = z.object({
  name: z.string().trim().optional(),
  categoryId: z.string().cuid().optional(),
  lowStock: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})
export type ListProductsQuery = z.infer<typeof listProductsSchema>

export const listMovementsSchema = z.object({
  type: z.nativeEnum(StockMovementType).optional(),
  productId: z.string().cuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})
export type ListMovementsQuery = z.infer<typeof listMovementsSchema>
