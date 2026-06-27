import { describe, it, expect } from 'vitest'
import { validarCnpj } from './cnpj'

describe('validarCnpj', () => {
  it('aceita CNPJ válido sem máscara', () => {
    expect(validarCnpj('11222333000181')).toBe(true)
  })

  it('aceita CNPJ válido com máscara', () => {
    expect(validarCnpj('11.222.333/0001-81')).toBe(true)
  })

  it('rejeita dígito verificador incorreto', () => {
    expect(validarCnpj('11222333000182')).toBe(false)
  })

  it('rejeita sequência de dígitos repetidos', () => {
    expect(validarCnpj('11111111111111')).toBe(false)
    expect(validarCnpj('00000000000000')).toBe(false)
  })

  it('rejeita tamanho diferente de 14 dígitos', () => {
    expect(validarCnpj('1122233300018')).toBe(false)
    expect(validarCnpj('112223330001812')).toBe(false)
  })

  it('rejeita string vazia', () => {
    expect(validarCnpj('')).toBe(false)
  })
})
