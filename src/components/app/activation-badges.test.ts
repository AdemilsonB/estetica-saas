import { describe, it, expect } from 'vitest'
import { isSectionPending } from './activation-badges'
import type { ActivationStatus } from '@/domains/activation/types'

function status(overrides: Partial<ActivationStatus> = {}): ActivationStatus {
  return {
    categorias: true,
    servicos: true,
    clientes: true,
    equipe: true,
    configuracoes: { dadosNegocio: true, horarios: true, branding: true, whatsapp: true, done: true },
    ...overrides,
  }
}

describe('isSectionPending', () => {
  it('retorna false quando o status ainda não carregou', () => {
    expect(isSectionPending(undefined, 'servicos')).toBe(false)
  })

  it('Serviços fica pendente se categorias OU serviços estiverem pendentes', () => {
    expect(isSectionPending(status({ categorias: false }), 'servicos')).toBe(true)
    expect(isSectionPending(status({ servicos: false }), 'servicos')).toBe(true)
    expect(isSectionPending(status(), 'servicos')).toBe(false)
  })

  it('Clientes/Equipe refletem seus próprios critérios', () => {
    expect(isSectionPending(status({ clientes: false }), 'clientes')).toBe(true)
    expect(isSectionPending(status({ equipe: false }), 'equipe')).toBe(true)
    expect(isSectionPending(status(), 'clientes')).toBe(false)
  })

  it('Configurações usa configuracoes.done', () => {
    const s = status()
    s.configuracoes.whatsapp = false
    s.configuracoes.done = false
    expect(isSectionPending(s, 'configuracoes')).toBe(true)
  })

  it('seções sem critério de ativação nunca ficam pendentes', () => {
    expect(isSectionPending(status({ servicos: false }), 'agenda')).toBe(false)
    expect(isSectionPending(status({ servicos: false }), 'financeiro')).toBe(false)
    expect(isSectionPending(status({ servicos: false }), 'produtos')).toBe(false)
  })
})
