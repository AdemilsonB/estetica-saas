// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { ActivationStatus } from '@/domains/activation/types'

const mockStatus: ActivationStatus = {
  categorias: true,
  servicos: true,
  clientes: false,
  equipe: false,
  configuracoes: { dadosNegocio: false, horarios: false, branding: false, whatsapp: false, done: false },
}

vi.mock('./use-activation-status', () => ({
  useActivationStatus: () => ({ data: mockStatus, isSuccess: true }),
}))

import { useEffectiveActivationStatus } from './use-effective-activation-status'
import { useActivationSeenStore } from '@/stores/activation-seen.store'
import { EMPTY_ACTIVATION_SEEN } from '@/domains/activation/activation-seen'

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useEffectiveActivationStatus', () => {
  beforeEach(() => {
    localStorage.clear()
    useActivationSeenStore.setState({ seen: EMPTY_ACTIVATION_SEEN })
  })

  it('sem nada visto, devolve o status real e o expõe também como rawData', () => {
    const { result } = renderHook(() => useEffectiveActivationStatus(), { wrapper })
    expect(result.current.data?.equipe).toBe(false)
    expect(result.current.rawData?.equipe).toBe(false)
  })

  it('após marcar equipe como visto, data reflete concluído mas rawData continua o real', () => {
    useActivationSeenStore.getState().markEquipeSeen()
    const { result } = renderHook(() => useEffectiveActivationStatus(), { wrapper })
    expect(result.current.data?.equipe).toBe(true)
    expect(result.current.rawData?.equipe).toBe(false)
  })
})
