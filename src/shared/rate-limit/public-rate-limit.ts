import { prisma } from '@/shared/database/prisma'

const WINDOW_MS = 60 * 60 * 1000 // 1 hora

export async function checkRateLimit(params: {
  ip?: string
  phone?: string
  action: 'appointment'
  maxPerWindow: number
}): Promise<{ allowed: boolean; remaining: number }> {
  const { ip, phone, action, maxPerWindow } = params
  const windowStart = new Date(Date.now() - WINDOW_MS)

  const where = {
    action,
    windowStart: { gte: windowStart },
    ...(ip ? { ip } : {}),
    ...(phone ? { phone } : {}),
  }

  const record = await prisma.publicRateLimit.findFirst({ where })

  if (!record) {
    await prisma.publicRateLimit.create({
      data: { ip, phone, action, count: 1, windowStart: new Date() },
    })
    return { allowed: true, remaining: maxPerWindow - 1 }
  }

  if (record.count >= maxPerWindow) {
    return { allowed: false, remaining: 0 }
  }

  await prisma.publicRateLimit.update({
    where: { id: record.id },
    data: { count: { increment: 1 } },
  })

  return { allowed: true, remaining: maxPerWindow - record.count - 1 }
}
