// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { EvolutionConnection } from './evolution-connection'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function mockFetchByUrl(handlers: Record<string, unknown>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    const match = Object.keys(handlers).find((key) => url.includes(key))
    if (!match) throw new Error(`URL não mockada: ${url}`)
    return { ok: true, json: async () => handlers[match] }
  })
}

describe('EvolutionConnection', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('com status CONNECTING, busca o QR e o exibe (não fica preso no spinner ao recarregar)', async () => {
    const fetchMock = mockFetchByUrl({
      '/api/whatsapp/evolution/status': {
        instanceId: 'tenant-1',
        connected: false,
        status: 'CONNECTING',
        connectedAt: null,
        phone: null,
      },
      '/api/whatsapp/evolution/qrcode': { qrCode: 'data:image/png;base64,ABC123' },
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<EvolutionConnection onImportContacts={() => {}} />, { wrapper })

    // O QR precisa ser buscado no endpoint dedicado e renderizado
    const img = await screen.findByAltText('QR Code WhatsApp')
    expect(img).toHaveAttribute('src', 'data:image/png;base64,ABC123')

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/whatsapp/evolution/qrcode'),
      ),
    )

    // O usuário travado tem como recomeçar sem depender só de "Cancelar"
    expect(screen.getByRole('button', { name: /Gerar novo QR/i })).toBeInTheDocument()
  })

  it('não busca o QR quando já está CONNECTED', async () => {
    const fetchMock = mockFetchByUrl({
      '/api/whatsapp/evolution/status': {
        instanceId: 'tenant-1',
        connected: true,
        status: 'CONNECTED',
        connectedAt: new Date().toISOString(),
        phone: '+5541999999999',
      },
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<EvolutionConnection onImportContacts={() => {}} />, { wrapper })

    await screen.findByText(/WhatsApp conectado/i)
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/whatsapp/evolution/qrcode'),
    )
  })
})
