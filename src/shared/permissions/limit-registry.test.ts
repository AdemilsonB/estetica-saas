import { describe, it, expect } from 'vitest'
import { LIMIT_REGISTRY, getLimitsByGroup } from './limit-registry'

describe('limit-registry', () => {
  it('não contém mais max_units', () => {
    expect('max_units' in LIMIT_REGISTRY).toBe(false)
  })

  it('appointments_month é soft; users é hard', () => {
    expect(LIMIT_REGISTRY.max_appointments_month.kind).toBe('soft')
    expect(LIMIT_REGISTRY.max_users.kind).toBe('hard')
  })

  it('benefitLabel formata valor e "ilimitado" acima do threshold', () => {
    const m = LIMIT_REGISTRY.max_appointments_month
    expect(m.benefitLabel(300)).toBe('300 agendamentos/mês')
    expect(m.benefitLabel(m.unlimitedThreshold)).toBe('Agendamentos ilimitados')
  })

  it('getLimitsByGroup agrupa por categoria', () => {
    const groups = getLimitsByGroup()
    const acesso = groups['Acesso & Equipe']?.map(([k]) => k) ?? []
    expect(acesso).toContain('max_users')
  })

  it('inclui max_services/products/customers como hard nos grupos certos', () => {
    expect(LIMIT_REGISTRY.max_services.kind).toBe('hard')
    expect(LIMIT_REGISTRY.max_products.group).toBe('Catálogo & Estoque')
    expect(LIMIT_REGISTRY.max_customers.benefitLabel(2000)).toBe('2.000 clientes')
  })
})
