import { describe, it, expect } from 'vitest'
import { normalizarTexto } from './normalizar-texto'

describe('normalizarTexto', () => {
  it('remove acentos', () => {
    expect(normalizarTexto('Não')).toBe('nao')
    expect(normalizarTexto('Acucar')).toBe('acucar')
    expect(normalizarTexto('café')).toBe('cafe')
  })

  it('converte para minúsculas', () => {
    expect(normalizarTexto('CONFIRMAR')).toBe('confirmar')
    expect(normalizarTexto('Cancelar')).toBe('cancelar')
  })

  it('remove espaços nas pontas', () => {
    expect(normalizarTexto('  sim  ')).toBe('sim')
    expect(normalizarTexto('\t confirmar \n')).toBe('confirmar')
  })

  it('colapsa múltiplos espaços em um', () => {
    expect(normalizarTexto('cancelar   inscricao')).toBe('cancelar inscricao')
    expect(normalizarTexto('não  quero  mais')).toBe('nao quero mais')
  })

  it('combina múltiplas normalizações', () => {
    expect(normalizarTexto('  Não  QUERO  ')).toBe('nao quero')
    expect(normalizarTexto(' Café COM Açúcar ')).toBe('cafe com acucar')
  })
})
