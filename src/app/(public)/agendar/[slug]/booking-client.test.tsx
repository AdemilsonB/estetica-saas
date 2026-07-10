// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'
import { BookingClient } from './booking-client'
import type { TenantPublicData } from './types'

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
  window.HTMLElement.prototype.hasPointerCapture = vi.fn()
  window.HTMLElement.prototype.releasePointerCapture = vi.fn()
})

afterEach(() => cleanup())

const tenantData: TenantPublicData = {
  name: 'Salão Teste',
  slug: 'salao-teste',
  timezone: 'America/Sao_Paulo',
  services: [
    {
      id: 'srv-1',
      name: 'Corte Feminino',
      duration: 60,
      price: 80,
      priceType: 'FIXED',
      anamneseMode: 'NONE',
      anamneseBlocks: [],
      anamneseValidityDays: 0,
    },
  ],
  professionals: [
    { id: 'pro-1', name: 'Ana', avatarUrl: null, serviceIds: ['srv-1'] },
    { id: 'pro-2', name: 'Beatriz', avatarUrl: null, serviceIds: ['srv-1'] },
  ],
  packages: [],
  promotions: [],
  allowPublicBooking: true,
  maxAdvanceDays: 60,
  publicPageEnabled: true,
}

describe('BookingClient', () => {
  it('não mostra tela de identificação — assume cliente já autenticado pelo servidor', () => {
    render(
      <BookingClient
        tenantData={tenantData}
        customerId="cust-1"
        customerName="Maria"
        customerPhone="11999998888"
      />,
    )

    expect(screen.queryByText(/identifique-se/i)).not.toBeInTheDocument()
    expect(screen.getByText('Corte Feminino')).toBeInTheDocument()
  })

  it('pré-seleção de serviço via query param funciona sem depender de status de autenticação', async () => {
    render(
      <BookingClient
        tenantData={tenantData}
        customerId="cust-1"
        customerName="Maria"
        customerPhone="11999998888"
        preSelectServiceId="srv-1"
      />,
    )

    expect(await screen.findByText('Escolha o profissional')).toBeInTheDocument()
    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('Beatriz')).toBeInTheDocument()
  })
})
