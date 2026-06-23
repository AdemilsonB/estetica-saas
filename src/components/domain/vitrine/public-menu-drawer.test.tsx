// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'
import { PublicMenuDrawer } from './public-menu-drawer'

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
  window.HTMLElement.prototype.hasPointerCapture = vi.fn()
  window.HTMLElement.prototype.releasePointerCapture = vi.fn()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function mockLoggedInFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url.includes('/me')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ name: 'Ana Souza' }) })
      }
      if (url.includes('/favorites')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ favoriteServiceIds: [], favoritePackageIds: [] }),
        })
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve(null) })
    }),
  )
}

describe('PublicMenuDrawer', () => {
  it('cliente logado tem um link para a página completa do Portal do Cliente', async () => {
    mockLoggedInFetch()

    render(
      <PublicMenuDrawer
        tenantName="Beleza Atual"
        primaryColor="#7C3AED"
        slug="salao-teste"
        bookingBaseUrl="/agendar/salao-teste"
        services={[]}
        packages={[]}
        promotions={[]}
        products={[]}
        team={[]}
      />,
    )

    window.dispatchEvent(new Event('open-public-menu'))

    const link = await screen.findByRole('link', { name: /olá, ana/i })
    expect(link).toHaveAttribute('href', '/salao-teste/cliente')
  })
})
