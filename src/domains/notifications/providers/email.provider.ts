import { Resend } from 'resend'
import { NotificationStatus } from '@prisma/client'
import type { NotificationDeliveryResult } from '../types'

type SendEmailInput = {
  to: string
  subject: string
  html: string
}

export class EmailProvider {
  private client: Resend
  private from: string

  constructor() {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) throw new Error('RESEND_API_KEY não configurada')
    this.client = new Resend(apiKey)
    this.from = process.env.EMAIL_FROM ?? 'noreply@agend.me'
  }

  async send({ to, subject, html }: SendEmailInput): Promise<NotificationDeliveryResult> {
    try {
      const { data, error } = await this.client.emails.send({
        from: this.from,
        to,
        subject,
        html,
      })
      if (error || !data) {
        return {
          status: NotificationStatus.FAILED,
          errorMessage: error?.message ?? 'Erro desconhecido no Resend',
          provider: 'resend',
        }
      }
      return {
        status: NotificationStatus.SENT,
        externalId: data.id,
        provider: 'resend',
      }
    } catch (err) {
      return {
        status: NotificationStatus.FAILED,
        errorMessage: err instanceof Error ? err.message : 'Erro ao enviar email',
        provider: 'resend',
      }
    }
  }
}

let _instance: EmailProvider | null = null

export function getEmailProvider(): EmailProvider {
  if (!_instance) _instance = new EmailProvider()
  return _instance
}
