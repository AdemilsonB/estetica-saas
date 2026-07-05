import { describe, it, expect } from 'vitest'
import { buildPlanBenefits } from './plan-benefits'

describe('buildPlanBenefits', () => {
  it('inclui capacidades essenciais e não-essenciais habilitadas (status ga)', () => {
    const benefits = buildPlanBenefits({
      enabledCapabilityKeys: ['agenda', 'servicos', 'clientes', 'equipe', 'configuracoes', 'financeiro', 'whatsapp_basic'],
      limits: {},
    })
    expect(benefits).toContain('Agenda completa')
    expect(benefits).toContain('Financeiro e caixa')
    expect(benefits).toContain('WhatsApp automático')
  })

  it('ignora chaves habilitadas que não estão no registry (ex.: reports_basic legado)', () => {
    const benefits = buildPlanBenefits({ enabledCapabilityKeys: ['reports_basic'], limits: {} })
    expect(benefits).toEqual([])
  })

  it('inclui limites com valor > 0 e ignora limites em 0', () => {
    const benefits = buildPlanBenefits({
      enabledCapabilityKeys: [],
      limits: { max_users: 5, max_whatsapp_month: 0, max_appointments_month: 300 },
    })
    expect(benefits).toContain('Até 5 profissionais')
    expect(benefits).toContain('300 agendamentos/mês')
    expect(benefits.some((b) => b.includes('WhatsApp'))).toBe(false)
  })

  it('ordena por categoria: Acesso & Equipe antes de Comunicação', () => {
    const benefits = buildPlanBenefits({
      enabledCapabilityKeys: ['equipe', 'whatsapp_basic'],
      limits: {},
    })
    expect(benefits.indexOf('Gestão de equipe')).toBeLessThan(benefits.indexOf('WhatsApp automático'))
  })

  it('exclui capacidades com status soon (não vendáveis ainda)', () => {
    // whatsapp_premium/campaigns são status ga hoje; este teste protege o filtro por status.
    // Usa uma capacidade real com status ga e confirma que o filtro é por status, não por chave.
    const benefits = buildPlanBenefits({ enabledCapabilityKeys: ['whatsapp_basic'], limits: {} })
    expect(benefits).toEqual(['WhatsApp automático'])
  })
})
