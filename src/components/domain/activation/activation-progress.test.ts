import { describe, it, expect } from 'vitest'
import {
  buildActivationSteps,
  activationProgressPercent,
  shouldShowActivationCard,
} from './activation-progress'
import type { ActivationStatus } from '@/domains/activation/types'

function status(overrides: Partial<ActivationStatus> = {}): ActivationStatus {
  return {
    categorias: false,
    servicos: false,
    clientes: false,
    equipe: false,
    configuracoes: { dadosNegocio: false, horarios: false, branding: false, whatsapp: false, done: false },
    ...overrides,
  }
}

describe('buildActivationSteps', () => {
  it('devolve 5 passos na ordem Categorias → Serviços → Clientes → Equipe → Configurações', () => {
    const steps = buildActivationSteps(status())
    expect(steps.map((s) => s.key)).toEqual(['categorias', 'servicos', 'clientes', 'equipe', 'configuracoes'])
    expect(steps.every((s) => s.done === false)).toBe(true)
  })

  it('reflete configuracoes.done no passo de Configurações', () => {
    const steps = buildActivationSteps(
      status({ configuracoes: { dadosNegocio: true, horarios: true, branding: true, whatsapp: true, done: true } }),
    )
    expect(steps.find((s) => s.key === 'configuracoes')?.done).toBe(true)
  })
})

describe('activationProgressPercent', () => {
  it('retorna 0 quando nada foi feito', () => {
    expect(activationProgressPercent(status())).toBe(0)
  })

  it('retorna 40 com 2 de 5 passos concluídos', () => {
    expect(activationProgressPercent(status({ categorias: true, servicos: true }))).toBe(40)
  })

  it('retorna 100 quando todos os passos estão concluídos', () => {
    expect(
      activationProgressPercent(
        status({
          categorias: true,
          servicos: true,
          clientes: true,
          equipe: true,
          configuracoes: { dadosNegocio: true, horarios: true, branding: true, whatsapp: true, done: true },
        }),
      ),
    ).toBe(100)
  })
})

describe('shouldShowActivationCard', () => {
  it('esconde quando não há nenhuma pendência', () => {
    const full = status({
      categorias: true,
      servicos: true,
      clientes: true,
      equipe: true,
      configuracoes: { dadosNegocio: true, horarios: true, branding: true, whatsapp: true, done: true },
    })
    expect(shouldShowActivationCard({ status: full, dismissed: false })).toBe(false)
    expect(shouldShowActivationCard({ status: full, dismissed: true })).toBe(false)
  })

  it('mostra quando há pendência e não foi dispensado', () => {
    expect(shouldShowActivationCard({ status: status({ clientes: false }), dismissed: false })).toBe(true)
  })

  it('reaparece mesmo dispensado enquanto Clientes OU Serviços estiverem pendentes', () => {
    expect(shouldShowActivationCard({ status: status({ servicos: false }), dismissed: true })).toBe(true)
    expect(shouldShowActivationCard({ status: status({ clientes: false }), dismissed: true })).toBe(true)
  })

  it('permanece escondido quando dispensado e só os 3 não-críticos estão pendentes', () => {
    const onlyNonCritical = status({
      categorias: false,
      servicos: true,
      clientes: true,
      equipe: false,
      configuracoes: { dadosNegocio: false, horarios: false, branding: false, whatsapp: false, done: false },
    })
    expect(shouldShowActivationCard({ status: onlyNonCritical, dismissed: true })).toBe(false)
    expect(shouldShowActivationCard({ status: onlyNonCritical, dismissed: false })).toBe(true)
  })
})
