import { describe, it, expect } from 'vitest'
import { calcularSugestaoPreco, type SugestaoPreco } from './price-suggestion'
import type { CapilarBlock } from './anamnese-blocks.types'

describe('calcularSugestaoPreco', () => {
  it('retorna null quando não há bloco capilar', () => {
    const result = calcularSugestaoPreco(100, {})
    expect(result).toBeNull()
  })

  it('retorna null quando comprimento não informado', () => {
    const result = calcularSugestaoPreco(100, { capilar: { produtos: [], photoUrls: [], objetivos: [] } })
    expect(result).toBeNull()
  })

  it('sugere acréscimo para cabelo longo (cintura)', () => {
    const capilar: CapilarBlock = {
      comprimento: 'cintura',
      produtos: [], photoUrls: [], objetivos: [],
    }
    const result = calcularSugestaoPreco(100, { capilar }) as SugestaoPreco
    expect(result).not.toBeNull()
    expect(result.valorSugerido).toBeGreaterThan(100)
    expect(result.ajustes).toHaveLength(1)
    expect(result.ajustes[0]!.motivo).toContain('Comprimento')
  })

  it('sugere acréscimo adicional para química recente', () => {
    const capilar: CapilarBlock = {
      comprimento: 'meio_costas',
      coloracao: { feito: true, quando: 'menos_30_dias' },
      produtos: [], photoUrls: [], objetivos: [],
    }
    const result = calcularSugestaoPreco(100, { capilar }) as SugestaoPreco
    expect(result.ajustes.length).toBeGreaterThanOrEqual(2)
    expect(result.ajustes.some(a => a.motivo.toLowerCase().includes('química'))).toBe(true)
  })

  it('não sugere acréscimo para nuca (comprimento curto)', () => {
    const capilar: CapilarBlock = {
      comprimento: 'nuca',
      produtos: [], photoUrls: [], objetivos: [],
    }
    const result = calcularSugestaoPreco(100, { capilar })
    // nuca = sem acréscimo, retorna sugestão com valor igual ao base
    expect(result?.valorSugerido).toBe(100)
    expect(result?.ajustes).toHaveLength(0)
  })
})
