// scripts/backfill-team-notification-preferences.mjs
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

// Único boolean legado com equivalente direto no modelo novo (ver "Decisão de
// escopo explícita" no plano). notifyOwnAppointments/notifyTeamAppointments
// continuam lidos direto do User pelo dispatcher — não migram para cá.
const EMAIL_EVENTS = [
  'appointment_created',
  'appointment_cancelled',
  'appointment_rescheduled',
  'appointment_no_show',
]

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, tenantId: true, notifyEmailAppointments: true },
  })

  let count = 0
  for (const user of users) {
    for (const eventType of EMAIL_EVENTS) {
      await prisma.userNotificationPreference.upsert({
        where: {
          tenantId_userId_eventType_channel: {
            tenantId: user.tenantId,
            userId: user.id,
            eventType,
            channel: 'EMAIL',
          },
        },
        update: {},
        create: {
          tenantId: user.tenantId,
          userId: user.id,
          eventType,
          channel: 'EMAIL',
          enabled: user.notifyEmailAppointments,
        },
      })
      count++
    }
  }
  console.log(`OK: ${count} preferências de e-mail migradas para ${users.length} usuário(s).`)
}

main()
  .catch((err) => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
