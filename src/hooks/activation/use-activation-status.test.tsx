// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useActivationStatus } from './use-activation-status'

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useActivationStatus', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          categorias: true,
          servicos: false,
          clientes: false,
          equipe: false,
          configuracoes: { dadosNegocio: false, horarios: false, branding: false, whatsapp: false, done: false },
        }),
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('busca /api/activation/status e devolve os dados', async () => {
    const { result } = renderHook(() => useActivationStatus(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(global.fetch).toHaveBeenCalledWith('/api/activation/status')
    expect(result.current.data?.categorias).toBe(true)
    expect(result.current.data?.servicos).toBe(false)
  })
})
