import { describe, it, expect } from 'vitest'
import {
  CAPABILITY_REGISTRY,
  getCapability,
  isEssential,
  getGateableCapabilities,
  ESSENTIAL_KEYS,
} from './capability-registry'

describe('capability-registry', () => {
  it('marca as 5 seções essenciais como essential e não gateáveis', () => {
    for (const key of ['agenda', 'servicos', 'clientes', 'equipe', 'configuracoes']) {
      expect(isEssential(key)).toBe(true)
    }
    expect(ESSENTIAL_KEYS).toEqual(
      expect.arrayContaining(['agenda', 'servicos', 'clientes', 'equipe', 'configuracoes']),
    )
  })

  it('não inclui multi_unit no registry ativo', () => {
    expect(getCapability('multi_unit')).toBeUndefined()
  })

  it('getGateableCapabilities exclui essenciais e status soon', () => {
    const keys = getGateableCapabilities().map((c) => c.key)
    expect(keys).not.toContain('agenda')
    expect(keys).toContain('relatorios')
    expect(keys).toContain('reports_advanced')
    for (const c of getGateableCapabilities()) {
      expect(c.essential).toBe(false)
      expect(c.status).toBe('ga')
    }
  })

  it('trata whatsapp_premium e campaigns como roadmap (soon), fora do gateável', () => {
    // Onda 0 — alinhamento da oferta: não vender chatbot/campanhas como ativos.
    expect(getCapability('whatsapp_premium')?.status).toBe('soon')
    expect(getCapability('campaigns')?.status).toBe('soon')
    const gateableKeys = getGateableCapabilities().map((c) => c.key)
    expect(gateableKeys).not.toContain('whatsapp_premium')
    expect(gateableKeys).not.toContain('campaigns')
  })

  it('toda capability tem label, benefitLabel e group não-vazios', () => {
    for (const c of CAPABILITY_REGISTRY) {
      expect(c.label.length).toBeGreaterThan(0)
      expect(c.benefitLabel.length).toBeGreaterThan(0)
      expect(c.group.length).toBeGreaterThan(0)
    }
  })

  it('reaproveita os labels de nav do NAV_REGISTRY para as seções de navegação', () => {
    const agenda = getCapability('agenda')
    expect(agenda?.category).toBe('nav')
    expect(agenda?.label).toBe('Agenda')
  })

  it('inclui as 4 capacidades de relatório com category report e gateáveis', () => {
    for (const key of ['report_visao_geral', 'report_financeiro', 'report_agendamentos', 'report_clientes']) {
      const cap = getCapability(key)
      expect(cap?.category).toBe('report')
      expect(cap?.essential).toBe(false)
    }
    const gateableKeys = getGateableCapabilities().map((c) => c.key)
    expect(gateableKeys).toContain('report_financeiro')
  })
})
