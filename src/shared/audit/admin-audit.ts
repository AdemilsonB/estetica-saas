import type { Prisma } from '@prisma/client'
import { prisma } from '@/shared/database/prisma'

function extractIp(request?: Request): string | undefined {
  if (!request) return undefined
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined
}

export async function logAdminAction(params: {
  adminUserId: string
  action: string
  targetType?: string
  targetId?: string
  metadata?: Record<string, unknown>
  request?: Request
}): Promise<void> {
  const { adminUserId, action, targetType, targetId, metadata, request } = params
  await prisma.adminAuditLog.create({
    data: {
      adminUserId,
      action,
      targetType,
      targetId,
      metadata: metadata as Prisma.InputJsonValue | undefined,
      ip: extractIp(request),
    },
  })
}
