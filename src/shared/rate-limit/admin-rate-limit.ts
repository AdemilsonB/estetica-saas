import { prisma } from '@/shared/database/prisma'

const DEFAULT_WINDOW_MS = 60 * 1000 // 1 minuto
const DEFAULT_MAX_PER_WINDOW = 120

export async function checkAdminRateLimit(params: {
  adminUserId: string
  action?: string
  maxPerWindow?: number
  windowMs?: number
}): Promise<{ allowed: boolean; remaining: number }> {
  const {
    adminUserId,
    action = 'admin_api',
    maxPerWindow = DEFAULT_MAX_PER_WINDOW,
    windowMs = DEFAULT_WINDOW_MS,
  } = params
  const windowStart = new Date(Date.now() - windowMs)

  const record = await prisma.adminRateLimit.findFirst({
    where: { adminUserId, action, windowStart: { gte: windowStart } },
  })

  if (!record) {
    await prisma.adminRateLimit.create({
      data: { adminUserId, action, count: 1, windowStart: new Date() },
    })
    return { allowed: true, remaining: maxPerWindow - 1 }
  }

  if (record.count >= maxPerWindow) {
    return { allowed: false, remaining: 0 }
  }

  await prisma.adminRateLimit.update({
    where: { id: record.id },
    data: { count: { increment: 1 } },
  })

  return { allowed: true, remaining: maxPerWindow - record.count - 1 }
}
