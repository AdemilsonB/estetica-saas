import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: 'email-123' }, error: null }),
    },
  })),
}))

import { EmailProvider } from './email.provider'
import { NotificationStatus } from '@prisma/client'

describe('EmailProvider', () => {
  let provider: EmailProvider

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key'
    process.env.EMAIL_FROM = 'noreply@agend.me'
    provider = new EmailProvider()
  })

  it('retorna SENT quando Resend responde sem erro', async () => {
    const result = await provider.send({
      to: 'cliente@email.com',
      subject: 'Confirmação',
      html: '<p>Olá</p>',
    })
    expect(result.status).toBe(NotificationStatus.SENT)
    expect(result.externalId).toBe('email-123')
    expect(result.provider).toBe('resend')
  })

  it('retorna FAILED quando Resend retorna erro', async () => {
    const { Resend } = await import('resend')
    vi.mocked(Resend).mockImplementationOnce(() => ({
      emails: {
        send: vi.fn().mockResolvedValue({ data: null, error: { message: 'Invalid API key' } }),
      },
    }))
    provider = new EmailProvider()
    const result = await provider.send({
      to: 'cliente@email.com',
      subject: 'Teste',
      html: '<p>Teste</p>',
    })
    expect(result.status).toBe(NotificationStatus.FAILED)
    expect(result.errorMessage).toContain('Invalid API key')
  })
})
