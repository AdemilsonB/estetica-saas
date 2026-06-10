import type { PgBoss, Job } from 'pg-boss'
import { prisma } from '@/shared/database/prisma'
import { NotificationChannel } from '@prisma/client'

export const SUBSCRIPTION_EXPIRY_WARNINGS_JOB = 'subscription:expiry-warnings'

export async function handleSubscriptionExpiryWarnings(
  _jobs: Job<Record<string, never>>[],
): Promise<void> {
  const now = new Date()

  // Buscar subscriptions em trial
  const trialSubs = await prisma.subscription.findMany({
    where: {
      status: 'TRIALING',
      trialEndsAt: { not: null },
    },
    select: {
      tenantId: true,
      trialEndsAt: true,
      tenant: {
        select: {
          name: true,
          evolutionConnected: true,
          evolutionInstanceId: true,
          users: {
            where: { role: 'OWNER' },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  })

  const pastDueSubs = await prisma.subscription.findMany({
    where: { status: 'PAST_DUE' },
    select: {
      tenantId: true,
      tenant: {
        select: {
          phone: true,
          evolutionConnected: true,
          evolutionInstanceId: true,
        },
      },
    },
  })

  const { notificationService } = await import('@/domains/notifications/notification.service')

  // Processar trials
  for (const sub of trialSubs) {
    if (!sub.trialEndsAt || !sub.tenant.evolutionConnected || !sub.tenant.evolutionInstanceId) continue

    const daysLeft = Math.ceil(
      (sub.trialEndsAt.getTime() - now.getTime()) / 86_400_000,
    )

    // Avisa em: 3 dias, 1 dia e no dia do vencimento (0 dias)
    if (daysLeft !== 3 && daysLeft !== 1 && daysLeft !== 0) continue

    // Buscar Owner para obter phone via Customer lookup
    const ownerUser = sub.tenant.users[0]
    if (!ownerUser) continue

    const ownerCustomer = await prisma.customer.findFirst({
      where: {
        tenantId: sub.tenantId,
        // Encontrar o cliente com mesmo email do owner
        email: {
          in: await prisma.user
            .findMany({ where: { id: ownerUser.id }, select: { email: true } })
            .then(users => users.map(u => u.email)),
        },
      },
      select: { id: true, phone: true, name: true },
    })

    if (!ownerCustomer?.phone) continue

    const templateMessage = daysLeft === 0
      ? 'Seu trial encerrou hoje. Ative seu plano para continuar usando todos os recursos.'
      : daysLeft === 1
        ? 'Seu trial encerra amanhã! Ative seu plano para não perder o acesso.'
        : `Seu trial encerra em ${daysLeft} dias. Ative seu plano para continuar.`

    await notificationService.logAndDispatch({
      tenantId: sub.tenantId,
      customerId: ownerCustomer.id,
      channel: NotificationChannel.WHATSAPP,
      template: 'subscription-warning',
      recipient: ownerCustomer.phone,
      provider: 'evolution',
      payload: {
        customerName: ownerCustomer.name,
        message: `${sub.tenant.name} — ${templateMessage}`,
        daysLeft,
      },
    })
  }

  // Processar PAST_DUE
  for (const sub of pastDueSubs) {
    if (!sub.tenant.evolutionConnected || !sub.tenant.phone) continue

    const { evolutionProvider } = await import(
      '@/domains/notifications/providers/evolution.provider'
    )
    await evolutionProvider
      .sendRawText(
        sub.tenant.evolutionInstanceId ?? '',
        sub.tenant.phone,
        `${sub.tenantId} — Pagamento pendente. Atualize seu cartão para evitar a suspensão do serviço.`,
      )
      .catch(() => {})
  }
}

export async function registerSubscriptionExpiryWarnings(boss: PgBoss): Promise<void> {
  // Roda todo dia às 12h UTC (9h Brasília)
  await boss.schedule(SUBSCRIPTION_EXPIRY_WARNINGS_JOB, '0 12 * * *', {})
  boss.work(SUBSCRIPTION_EXPIRY_WARNINGS_JOB, handleSubscriptionExpiryWarnings)
}
