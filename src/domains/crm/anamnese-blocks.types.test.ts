import { describe, it, expect } from 'vitest'
import { capilarBlockSchema, anamneseBlocksSchema } from './anamnese-blocks.types'

describe('capilarBlockSchema', () => {
  it('aceita bloco capilar válido', () => {
    const result = capilarBlockSchema.safeParse({
      comprimento: 'ombro',
      tipoFio: 'cacheado',
      coloracao: { feito: true, quando: 'menos_30_dias' },
      objetivos: ['hidratar'],
    })
    expect(result.success).toBe(true)
  })

  it('aceita bloco capilar vazio', () => {
    const result = capilarBlockSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejeita valor inválido de comprimento', () => {
    const result = capilarBlockSchema.safeParse({ comprimento: 'joelho' })
    expect(result.success).toBe(false)
  })
})

describe('anamneseBlocksSchema', () => {
  it('aceita objeto com bloco capilar', () => {
    const result = anamneseBlocksSchema.safeParse({
      capilar: { comprimento: 'cintura', tipoFio: 'liso' },
    })
    expect(result.success).toBe(true)
  })

  it('aceita objeto vazio (nenhum bloco preenchido)', () => {
    const result = anamneseBlocksSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})
