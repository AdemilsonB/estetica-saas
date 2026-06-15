import { z } from 'zod'
import { BusinessSegment } from '@prisma/client'

export const listCatalogServicesSchema = z.object({
  segments:   z.array(z.nativeEnum(BusinessSegment)).optional(),
  categoryId: z.string().cuid().optional(),
  name:       z.string().trim().optional(),
  page:       z.coerce.number().int().min(1).default(1),
  pageSize:   z.coerce.number().int().min(1).max(100).default(20),
})
export type ListCatalogServicesQuery = z.infer<typeof listCatalogServicesSchema>

export const listCatalogProductsSchema = z.object({
  segments:   z.array(z.nativeEnum(BusinessSegment)).optional(),
  categoryId: z.string().cuid().optional(),
  name:       z.string().trim().optional(),
  page:       z.coerce.number().int().min(1).default(1),
  pageSize:   z.coerce.number().int().min(1).max(100).default(20),
})
export type ListCatalogProductsQuery = z.infer<typeof listCatalogProductsSchema>

export const saveSegmentsSchema = z.object({
  segments: z.array(z.nativeEnum(BusinessSegment)).min(1, 'Selecione ao menos um segmento.'),
})
export type SaveSegmentsInput = z.infer<typeof saveSegmentsSchema>

// Shape esperado em metadata.variations (não enforçado pelo banco)
export type CatalogServiceVariation = {
  label: string
  suggestedDuration: number
  suggestedPrice: number
}

export type CatalogServiceMetadata = {
  tags?: string[]
  difficulty?: 'basico' | 'intermediario' | 'avancado'
  variations?: CatalogServiceVariation[]
  aiTips?: string
}

export type CatalogProductMetadata = {
  tags?: string[]
  brand?: string
  yield?: string
  composition?: string
}
