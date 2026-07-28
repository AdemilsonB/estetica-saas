import type { PgBoss, Job } from 'pg-boss'
import { prisma } from '@/shared/database/prisma'

export const BIRTHDAY_REMINDER_JOB = 'birthday-reminder'

export async function handleBirthdayReminder(_jobs: Job<Record<string, never>>[]): Promise<void> {
  const now = new Date()
  const month = now.getMonth() + 1
  const day = now.getDate()

  const customers = await prisma.$queryRaw<
    { id: string; tenantId: string; name: string; phone: string; birthdayMessage: string | null }[]
  >`
    SELECT c.id, c."tenantId", c.name, c.phone, t."birthdayMessage"
    FROM "Customer" c
    INNER JOIN "Tenant" t ON t.id = c."tenantId"
    WHERE c."birthDate" IS NOT NULL
      AND EXTRACT(MONTH FROM c."birthDate") = ${month}
      AND EXTRACT(DAY FROM c."birthDate") = ${day}
      AND c."consentGiven" = true
      AND c.phone IS NOT NULL
      AND t."birthdayEnabled" = true
      AND t."evolutionConnected" = true
  `

  if (customers.length === 0) return

  const { customerMessageDispatcher } = await import(
    '@/domains/notifications/customer-messages/customer-message-dispatcher.service'
  )

  for (const customer of customers) {
    await customerMessageDispatcher.dispatch({
      tenantId: customer.tenantId,
      event: 'birthday',
      customerId: customer.id,
      recipient: { phone: customer.phone, email: null },
      // `birthdayMessage` do tenant é a mensagem pontual: continua tendo precedência
      // sobre o template, como antes.
      message: customer.birthdayMessage ?? undefined,
      payload: { customerName: customer.name },
    })
  }
}

export async function registerBirthdayReminder(boss: PgBoss): Promise<void> {
  await boss.schedule(BIRTHDAY_REMINDER_JOB, '0 12 * * *', {})
  boss.work(BIRTHDAY_REMINDER_JOB, handleBirthdayReminder)
}
