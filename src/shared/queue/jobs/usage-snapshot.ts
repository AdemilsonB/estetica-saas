import type { PgBoss, Job } from 'pg-boss'
import { prisma } from '@/shared/database/prisma'

export const USAGE_SNAPSHOT_JOB = 'usage-snapshot'

function formatPeriod(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

export async function handleUsageSnapshot(_jobs: Job<Record<string, never>>[]): Promise<void> {
  const now = new Date()

  // Captura o mês anterior (job roda no 1º do mês corrente)
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevYear = prevMonthDate.getFullYear()
  const prevMonth = prevMonthDate.getMonth()
  const period = formatPeriod(prevYear, prevMonth)

  const startOfPrevMonth = new Date(prevYear, prevMonth, 1)
  const endOfPrevMonth = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59, 999)

  const tenants = await prisma.tenant.findMany({ select: { id: true } })

  for (const tenant of tenants) {
    const [appointments, whatsapp, customers, users, services, products, emailMonth] = await Promise.all([
      prisma.appointment.count({
        where: { tenantId: tenant.id, createdAt: { gte: startOfPrevMonth, lte: endOfPrevMonth } },
      }),
      prisma.notificationLog.count({
        where: {
          tenantId: tenant.id,
          channel: 'WHATSAPP',
          createdAt: { gte: startOfPrevMonth, lte: endOfPrevMonth },
        },
      }),
      prisma.customer.count({ where: { tenantId: tenant.id } }),
      prisma.user.count({ where: { tenantId: tenant.id } }),
      prisma.service.count({ where: { tenantId: tenant.id } }),
      prisma.product.count({ where: { tenantId: tenant.id } }),
      prisma.notificationLog.count({
        where: {
          tenantId: tenant.id,
          channel: 'EMAIL',
          createdAt: { gte: startOfPrevMonth, lte: endOfPrevMonth },
        },
      }),
    ])

    const snapshots = [
      { limitKey: 'appointments_month', count: appointments },
      { limitKey: 'whatsapp_month', count: whatsapp },
      { limitKey: 'customers_total', count: customers },
      { limitKey: 'users_total', count: users },
      { limitKey: 'services_total', count: services },
      { limitKey: 'products_total', count: products },
      { limitKey: 'email_month', count: emailMonth },
    ]

    for (const snap of snapshots) {
      await prisma.usageSnapshot.upsert({
        where: {
          tenantId_limitKey_period: {
            tenantId: tenant.id,
            limitKey: snap.limitKey,
            period,
          },
        },
        create: { tenantId: tenant.id, limitKey: snap.limitKey, count: snap.count, period },
        update: { count: snap.count },
      })
    }
  }
}

export async function registerUsageSnapshotJob(boss: PgBoss): Promise<void> {
  // Roda no 1º dia de cada mês às 01:00 UTC
  await boss.schedule(USAGE_SNAPSHOT_JOB, '0 1 1 * *', {})
  boss.work(USAGE_SNAPSHOT_JOB, handleUsageSnapshot)
}
