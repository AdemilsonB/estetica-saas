import { describe, it, expect } from 'vitest'
import { validarCpf } from './cpf'

describe('validarCpf', () => {
  it('aceita CPF válido sem máscara', () => {
    expect(validarCpf('11144477735')).toBe(true)
  })

  it('aceita CPF válido com máscara', () => {
    expect(validarCpf('111.444.777-35')).toBe(true)
  })

  it('rejeita dígito verificador incorreto', () => {
    expect(validarCpf('11144477736')).toBe(false)
  })

  it('rejeita sequência de dígitos repetidos', () => {
    expect(validarCpf('11111111111')).toBe(false)
    expect(validarCpf('00000000000')).toBe(false)
  })

  it('rejeita tamanho diferente de 11 dígitos', () => {
    expect(validarCpf('123456789')).toBe(false)
    expect(validarCpf('123456789012')).toBe(false)
  })

  it('rejeita string vazia', () => {
    expect(validarCpf('')).toBe(false)
  })
})
