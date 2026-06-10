import type { PgBoss, Job } from 'pg-boss'
import { prisma } from '@/shared/database/prisma'

export const DAILY_STATUS_JOB = 'daily-status'

export async function handleDailyStatus(_jobs: Job<Record<string, never>>[]): Promise<void> {
  const now = new Date()

  const tenants = await prisma.tenant.findMany({
    where: {
      dailyStatusEnabled: true,
      evolutionConnected: true,
      phone: { not: null },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      dailyStatusHour: true,
      timezone: true,
      evolutionInstanceId: true,
    },
  })

  for (const tenant of tenants) {
    if (!tenant.evolutionInstanceId || !tenant.phone) continue

    // Verificar se a hora local do tenant bate com dailyStatusHour
    const localHour = parseInt(
      new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone: tenant.timezone,
      }).format(now),
      10,
    )
    if (localHour !== tenant.dailyStatusHour) continue

    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(now)
    todayEnd.setHours(23, 59, 59, 999)

    const [total, confirmed, scheduled] = await Promise.all([
      prisma.appointment.count({
        where: { tenantId: tenant.id, startsAt: { gte: todayStart, lte: todayEnd } },
      }),
      prisma.appointment.count({
        where: {
          tenantId: tenant.id,
          startsAt: { gte: todayStart, lte: todayEnd },
          status: 'CONFIRMED',
        },
      }),
      prisma.appointment.count({
        where: {
          tenantId: tenant.id,
          startsAt: { gte: todayStart, lte: todayEnd },
          status: 'SCHEDULED',
        },
      }),
    ])

    const dateStr = new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      timeZone: tenant.timezone,
    }).format(now)

    const message = [
      `📅 *Resumo do dia — ${dateStr}*`,
      '',
      `Total de agendamentos: *${total}*`,
      `✅ Confirmados: ${confirmed}`,
      `⏳ Aguardando confirmação: ${scheduled}`,
    ].join('\n')

    const { evolutionProvider } = await import(
      '@/domains/notifications/providers/evolution.provider'
    )
    await evolutionProvider
      .sendRawText(tenant.evolutionInstanceId, tenant.phone, message)
      .catch(() => {})
  }
}

export async function registerDailyStatusJob(boss: PgBoss): Promise<void> {
  // Roda a cada hora — filtra internamente pelo dailyStatusHour do tenant
  await boss.schedule(DAILY_STATUS_JOB, '0 * * * *', {})
  boss.work(DAILY_STATUS_JOB, handleDailyStatus)
}
