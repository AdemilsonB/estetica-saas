import { describe, it, expect, vi } from 'vitest'
import { buildPlanBenefits } from './plan-benefits'
import { CAPABILITY_GROUPS } from './capability-registry'

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

  it('exclui capacidades com status soon (não vendáveis ainda)', async () => {
    // Nenhuma capacidade real tem status 'soon' hoje — injeta uma via mock do registry
    // para provar de fato que o filtro por status exclui capacidades não-GA.
    vi.resetModules()
    vi.doMock('./capability-registry', () => ({
      CAPABILITY_REGISTRY: [
        { key: 'whatsapp_basic', label: 'WhatsApp Básico', category: 'capability', essential: false, benefitLabel: 'WhatsApp automático', status: 'ga', group: CAPABILITY_GROUPS.COMUNICACAO },
        { key: 'whatsapp_futuro', label: 'WhatsApp Futuro', category: 'capability', essential: false, benefitLabel: 'WhatsApp do futuro', status: 'soon', group: CAPABILITY_GROUPS.COMUNICACAO },
      ],
      CAPABILITY_GROUPS,
    }))

    const { buildPlanBenefits: buildPlanBenefitsMocked } = await import('./plan-benefits')
    const benefits = buildPlanBenefitsMocked({
      enabledCapabilityKeys: ['whatsapp_basic', 'whatsapp_futuro'],
      limits: {},
    })

    expect(benefits).toEqual(['WhatsApp automático'])
    expect(benefits).not.toContain('WhatsApp do futuro')

    vi.doUnmock('./capability-registry')
    vi.resetModules()
  })
})
