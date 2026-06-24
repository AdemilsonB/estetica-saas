// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { CustomerHistoryClient } from './customer-history-client'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const customer = {
  id: 'cust-1',
  name: 'Ana Souza',
  cpf: '***.***.123-45',
  phone: '11999998888',
  email: 'ana@example.com',
  birthDate: null,
}

describe('CustomerHistoryClient', () => {
  it('destaca endereço e horário de funcionamento do negócio, com o dia atual marcado', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(null) }))

    render(
      <CustomerHistoryClient
        customer={customer}
        upcoming={[]}
        history={[]}
        slug="salao-teste"
        whatsappUrl={null}
        primaryColor="#7C3AED"
        business={{
          address: 'Rua das Flores, 142 — Jardins, São Paulo',
          businessHours: {
            '2': { open: '09:00', close: '20:00', active: true },
            '3': { open: '09:00', close: '20:00', active: true },
          },
          todayWeekdayIndex: 2,
          isOpenNow: true,
        }}
      />,
    )

    expect(screen.getByText('Rua das Flores, 142 — Jardins, São Paulo')).toBeInTheDocument()
    expect(screen.getByText('Aberto agora')).toBeInTheDocument()
    expect(screen.getByText('Terça')).toBeInTheDocument()
    expect(screen.getAllByText('09:00 – 20:00').length).toBeGreaterThan(0)
  })

  it('não mostra a seção de informações quando o negócio não tem endereço nem horário configurado', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(null) }))

    render(
      <CustomerHistoryClient
        customer={customer}
        upcoming={[]}
        history={[]}
        slug="salao-teste"
        whatsappUrl={null}
        primaryColor="#7C3AED"
        business={{ address: null, businessHours: null, todayWeekdayIndex: null, isOpenNow: true }}
      />,
    )

    expect(screen.queryByText('Informações')).not.toBeInTheDocument()
  })
})
