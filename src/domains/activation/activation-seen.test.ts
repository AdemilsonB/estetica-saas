import { describe, it, expect } from 'vitest'
import { mergeActivationStatusWithSeen, EMPTY_ACTIVATION_SEEN } from './activation-seen'
import type { ActivationStatus } from './types'

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

describe('mergeActivationStatusWithSeen', () => {
  it('sem nada visto, devolve o status real inalterado', () => {
    const s = status({ categorias: true })
    const merged = mergeActivationStatusWithSeen(s, EMPTY_ACTIVATION_SEEN)
    expect(merged).toEqual(s)
  })

  it('equipe visto marca equipe como concluído mesmo sem cargo customizado real', () => {
    const merged = mergeActivationStatusWithSeen(status(), { ...EMPTY_ACTIVATION_SEEN, equipe: true })
    expect(merged.equipe).toBe(true)
  })

  it('não sobrescreve equipe já verdadeiro por dado real', () => {
    const merged = mergeActivationStatusWithSeen(status({ equipe: true }), EMPTY_ACTIVATION_SEEN)
    expect(merged.equipe).toBe(true)
  })

  it('cada seção de configuracoes vista conta como concluída individualmente', () => {
    const merged = mergeActivationStatusWithSeen(status(), {
      ...EMPTY_ACTIVATION_SEEN,
      configuracoes: { dadosNegocio: true, horarios: true, branding: false, whatsapp: false },
    })
    expect(merged.configuracoes.dadosNegocio).toBe(true)
    expect(merged.configuracoes.horarios).toBe(true)
    expect(merged.configuracoes.branding).toBe(false)
    expect(merged.configuracoes.whatsapp).toBe(false)
    expect(merged.configuracoes.done).toBe(false)
  })

  it('configuracoes.done fica true quando as 4 seções foram vistas, mesmo sem dado real', () => {
    const merged = mergeActivationStatusWithSeen(status(), {
      equipe: false,
      configuracoes: { dadosNegocio: true, horarios: true, branding: true, whatsapp: true },
    })
    expect(merged.configuracoes.done).toBe(true)
  })

  it('categorias/servicos/clientes nunca são afetados por seen', () => {
    const merged = mergeActivationStatusWithSeen(status(), {
      equipe: true,
      configuracoes: { dadosNegocio: true, horarios: true, branding: true, whatsapp: true },
    })
    expect(merged.categorias).toBe(false)
    expect(merged.servicos).toBe(false)
    expect(merged.clientes).toBe(false)
  })
})
