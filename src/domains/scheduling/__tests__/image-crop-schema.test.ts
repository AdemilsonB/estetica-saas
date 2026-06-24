import { describe, it, expect } from 'vitest'
import { updateServiceSchema, updatePackageSchema, updatePromotionSchema } from '../types'

describe('updateServiceSchema — bounds de crop', () => {
  it('aceita cropX/cropY entre 0 e 1 e cropZoom entre 1 e 3', () => {
    const result = updateServiceSchema.safeParse({ imageCropX: 0.5, imageCropY: 0.5, imageCropZoom: 2 })
    expect(result.success).toBe(true)
  })

  it('rejeita cropX fora de 0–1', () => {
    expect(updateServiceSchema.safeParse({ imageCropX: 1.5 }).success).toBe(false)
    expect(updateServiceSchema.safeParse({ imageCropX: -0.1 }).success).toBe(false)
  })

  it('rejeita cropZoom fora de 1–3', () => {
    expect(updateServiceSchema.safeParse({ imageCropZoom: 0.5 }).success).toBe(false)
    expect(updateServiceSchema.safeParse({ imageCropZoom: 3.5 }).success).toBe(false)
  })

  it('aceita null nos 3 campos (reset explícito)', () => {
    const result = updateServiceSchema.safeParse({ imageCropX: null, imageCropY: null, imageCropZoom: null })
    expect(result.success).toBe(true)
  })
})

describe('updatePackageSchema / updatePromotionSchema — bounds de crop', () => {
  it('rejeita cropZoom fora de 1–3 no pacote', () => {
    expect(updatePackageSchema.safeParse({ imageCropZoom: 10 }).success).toBe(false)
  })

  it('rejeita cropY fora de 0–1 na promoção', () => {
    expect(updatePromotionSchema.safeParse({ imageCropY: 2 }).success).toBe(false)
  })
})
