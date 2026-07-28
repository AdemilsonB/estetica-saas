// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { CustomerMessageToggle } from './customer-message-toggle'

let previa = {
  defaultEnabled: true,
  channels: ['WHATSAPP'] as ('WHATSAPP' | 'EMAIL')[],
  primaryChannel: 'WHATSAPP' as const,
  preview: 'Olá, Maria! Seu agendamento foi criado.',
  blockedReason: null as string | null,
}

vi.mock('@/hooks/notifications/use-customer-message-preview', () => ({
  useCustomerMessagePreview: () => ({ data: previa, isLoading: false, isError: false }),
}))

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const base = {
  event: 'appointment_created',
  customerId: 'c1',
  message: '',
  onMessageChange: vi.fn(),
}

afterEach(() => {
  cleanup()
  previa = {
    defaultEnabled: true,
    channels: ['WHATSAPP'],
    primaryChannel: 'WHATSAPP',
    preview: 'Olá, Maria! Seu agendamento foi criado.',
    blockedReason: null,
  }
})

describe('CustomerMessageToggle', () => {
  it('com value undefined, exibe o padrão do negócio e o rotula', () => {
    render(<CustomerMessageToggle {...base} value={undefined} onChange={vi.fn()} />, { wrapper })

    expect(screen.getByRole('switch')).toBeChecked()
    expect(screen.getByText(/padrão do seu negócio: ligado/i)).toBeInTheDocument()
  })

  it('com padrão desligado, exibe desligado e rotula como desligado', () => {
    previa.defaultEnabled = false
    render(<CustomerMessageToggle {...base} value={undefined} onChange={vi.fn()} />, { wrapper })

    expect(screen.getByRole('switch')).not.toBeChecked()
    expect(screen.getByText(/padrão do seu negócio: desligado/i)).toBeInTheDocument()
  })

  it('o override do usuário vence o padrão', () => {
    render(<CustomerMessageToggle {...base} value={false} onChange={vi.fn()} />, { wrapper })

    expect(screen.getByRole('switch')).not.toBeChecked()
    expect(screen.getByText(/padrão do seu negócio: ligado/i)).toBeInTheDocument()
  })

  it('tocar no switch avisa o pai com o valor explícito', async () => {
    const onChange = vi.fn()
    render(<CustomerMessageToggle {...base} value={undefined} onChange={onChange} />, { wrapper })

    await userEvent.click(screen.getByRole('switch'))

    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('a prévia fica recolhida e expande sob demanda', async () => {
    render(<CustomerMessageToggle {...base} value={undefined} onChange={vi.fn()} />, { wrapper })

    expect(screen.queryByText(/Seu agendamento foi criado/)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /ver a mensagem/i }))

    expect(screen.getByText(/Seu agendamento foi criado/)).toBeInTheDocument()
  })

  it('bloqueado: switch desabilitado e motivo visível', () => {
    previa.blockedReason = 'Este cliente não tem telefone cadastrado.'
    render(<CustomerMessageToggle {...base} value={undefined} onChange={vi.fn()} />, { wrapper })

    expect(screen.getByRole('switch')).toBeDisabled()
    expect(screen.getByText(/não tem telefone cadastrado/i)).toBeInTheDocument()
  })

  it('bloqueado: o switch nunca aparece ligado — nunca um switch que não envia', () => {
    previa.blockedReason = 'O WhatsApp do seu negócio não está conectado.'
    render(<CustomerMessageToggle {...base} value={true} onChange={vi.fn()} />, { wrapper })

    expect(screen.getByRole('switch')).not.toBeChecked()
  })

  it('escrever outra mensagem devolve o texto ao pai', async () => {
    const onMessageChange = vi.fn()
    render(
      <CustomerMessageToggle
        {...base}
        onMessageChange={onMessageChange}
        value={undefined}
        onChange={vi.fn()}
      />,
      { wrapper },
    )

    await userEvent.click(screen.getByRole('button', { name: /ver a mensagem/i }))
    await userEvent.click(screen.getByRole('button', { name: /escrever outra mensagem/i }))
    await userEvent.type(screen.getByRole('textbox'), 'Oi')

    expect(onMessageChange).toHaveBeenCalled()
  })

  it('desligado, não oferece a prévia — não há mensagem para ver', () => {
    render(<CustomerMessageToggle {...base} value={false} onChange={vi.fn()} />, { wrapper })

    expect(screen.queryByRole('button', { name: /ver a mensagem/i })).not.toBeInTheDocument()
  })
})
