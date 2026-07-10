import { describe, it, expect } from 'vitest'
import { computeActivationStatus } from './activation.compute'
import type { ActivationCounts } from './types'

function baseCounts(overrides: Partial<ActivationCounts> = {}): ActivationCounts {
  return {
    activeCategoryCount: 0,
    activeServiceCount: 0,
    activeCustomerCount: 0,
    customRoleCount: 0,
    tenant: {
      phone: null,
      address: null,
      businessHours: null,
      evolutionConnected: false,
    },
    logoUrl: null,
    ...overrides,
  }
}

describe('computeActivationStatus', () => {
  it('marca tudo como pendente (false) quando o tenant está vazio', () => {
    const status = computeActivationStatus(baseCounts())
    expect(status.categorias).toBe(false)
    expect(status.servicos).toBe(false)
    expect(status.clientes).toBe(false)
    expect(status.equipe).toBe(false)
    expect(status.configuracoes.done).toBe(false)
    expect(status.configuracoes.dadosNegocio).toBe(false)
    expect(status.configuracoes.horarios).toBe(false)
    expect(status.configuracoes.branding).toBe(false)
    expect(status.configuracoes.whatsapp).toBe(false)
  })

  it('marca categorias/servicos/clientes/equipe como concluídos quando há contagem > 0', () => {
    const status = computeActivationStatus(
      baseCounts({
        activeCategoryCount: 2,
        activeServiceCount: 5,
        activeCustomerCount: 1,
        customRoleCount: 1,
      }),
    )
    expect(status.categorias).toBe(true)
    expect(status.servicos).toBe(true)
    expect(status.clientes).toBe(true)
    expect(status.equipe).toBe(true)
  })

  it('só marca configuracoes.done quando dados, horários, branding e whatsapp estão completos', () => {
    const status = computeActivationStatus(
      baseCounts({
        tenant: {
          phone: '41999999999',
          address: 'Rua X, 100',
          businessHours: { seg: { open: '09:00', close: '18:00' } },
          evolutionConnected: true,
        },
        logoUrl: 'https://cdn/logo.png',
      }),
    )
    expect(status.configuracoes.dadosNegocio).toBe(true)
    expect(status.configuracoes.horarios).toBe(true)
    expect(status.configuracoes.branding).toBe(true)
    expect(status.configuracoes.whatsapp).toBe(true)
    expect(status.configuracoes.done).toBe(true)
  })

  it('mantém configuracoes.done=false se apenas o whatsapp estiver desconectado', () => {
    const status = computeActivationStatus(
      baseCounts({
        tenant: {
          phone: '41999999999',
          address: 'Rua X, 100',
          businessHours: { seg: {} },
          evolutionConnected: false,
        },
        logoUrl: 'https://cdn/logo.png',
      }),
    )
    expect(status.configuracoes.dadosNegocio).toBe(true)
    expect(status.configuracoes.whatsapp).toBe(false)
    expect(status.configuracoes.done).toBe(false)
  })

  it('trata strings em branco como ausentes (phone/address/logo)', () => {
    const status = computeActivationStatus(
      baseCounts({
        tenant: { phone: '   ', address: '', businessHours: { seg: {} }, evolutionConnected: true },
        logoUrl: '   ',
      }),
    )
    expect(status.configuracoes.dadosNegocio).toBe(false)
    expect(status.configuracoes.branding).toBe(false)
  })
})
