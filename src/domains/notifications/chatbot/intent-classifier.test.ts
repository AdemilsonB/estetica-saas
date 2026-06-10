import { describe, it, expect } from 'vitest'
import { classifyIntent } from './intent-classifier'

describe('classifyIntent', () => {
  it('detecta BOOK para "quero agendar"', () => {
    expect(classifyIntent('quero agendar um horário')).toBe('BOOK')
  })
  it('detecta BOOK para "marcar horário" case-insensitive', () => {
    expect(classifyIntent('Quero Marcar um Horário')).toBe('BOOK')
  })
  it('detecta BOOK para "reservar"', () => {
    expect(classifyIntent('gostaria de reservar')).toBe('BOOK')
  })
  it('detecta CANCEL para "cancelar"', () => {
    expect(classifyIntent('preciso cancelar meu horário')).toBe('CANCEL')
  })
  it('detecta CANCEL para "não vou" normalizado', () => {
    expect(classifyIntent('não vou conseguir ir')).toBe('CANCEL')
  })
  it('detecta CANCEL para "nao vou" sem acento', () => {
    expect(classifyIntent('nao vou conseguir ir')).toBe('CANCEL')
  })
  it('detecta PRICE para "quanto custa"', () => {
    expect(classifyIntent('quanto custa um corte?')).toBe('PRICE')
  })
  it('detecta PRICE para "tabela"', () => {
    expect(classifyIntent('me manda a tabela')).toBe('PRICE')
  })
  it('detecta HOURS para "que horas abre"', () => {
    expect(classifyIntent('que horas abre hoje?')).toBe('HOURS')
  })
  it('detecta HOURS para "horário de funcionamento"', () => {
    expect(classifyIntent('qual o horário de funcionamento?')).toBe('HOURS')
  })
  it('retorna FALLBACK para mensagem sem intenção reconhecida', () => {
    expect(classifyIntent('oi tudo bem?')).toBe('FALLBACK')
  })
  it('retorna FALLBACK para texto vazio', () => {
    expect(classifyIntent('')).toBe('FALLBACK')
  })
})
