// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { it, expect, vi, afterEach } from 'vitest'
import { CustomerHistoryClient } from './customer-history-client'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}))

vi.mock('@/components/domain/vitrine/vitrine-location-block', () => ({
  VitrineLocationBlock: ({
    address,
    googleBusinessUrl,
  }: {
    address: string
    googleBusinessUrl?: string | null
  }) => (
    <div>
      <span>{address}</span>
      {googleBusinessUrl && (
        <a href={googleBusinessUrl} target="_blank" rel="noopener noreferrer">
          Ver no Google ↗
        </a>
      )}
    </div>
  ),
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
      googleBusinessUrl={null}
      googleRating={null}
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
      googleBusinessUrl={null}
      googleRating={null}
      business={{ address: null, businessHours: null, todayWeekdayIndex: null, isOpenNow: true }}
    />,
  )

  expect(screen.queryByText('Informações')).not.toBeInTheDocument()
})

it('exibe o link "Ver no Google" quando googleBusinessUrl está preenchido', () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(null) }))

  render(
    <CustomerHistoryClient
      customer={customer}
      upcoming={[]}
      history={[]}
      slug="salao-teste"
      whatsappUrl={null}
      primaryColor="#7C3AED"
      googleBusinessUrl="https://g.page/salao-teste"
      googleRating={null}
      business={{
        address: 'Rua das Flores, 142 — Jardins, São Paulo',
        businessHours: null,
        todayWeekdayIndex: null,
        isOpenNow: false,
      }}
    />,
  )

  const link = screen.getByRole('link', { name: /ver no google/i })
  expect(link).toBeInTheDocument()
  expect(link).toHaveAttribute('href', 'https://g.page/salao-teste')
})
