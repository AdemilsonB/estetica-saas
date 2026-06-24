import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { NotFoundError, ForbiddenError } from '@/shared/errors'
import { signImpersonationToken } from '@/shared/auth/impersonation'
import { logAdminAction } from '@/shared/audit/admin-audit'
import { prisma } from '@/shared/database/prisma'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  initializeDomainRuntime()
  try {
    const session = await getAdminContext(request)
    const { tenantId } = await params

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, isBlocked: true },
    })

    if (!tenant) throw new NotFoundError('Tenant')
    if (tenant.isBlocked) throw new ForbiddenError('Tenant bloqueado — impersonação não permitida.')

    const token = await signImpersonationToken({
      tenantId,
      adminId: session.userId,
    })

    await logAdminAction({
      adminUserId: session.userId,
      action: 'tenant.impersonated',
      targetType: 'Tenant',
      targetId: tenantId,
      request,
    })

    return Response.json({ token, tenantId, tenantName: tenant.name })
  } catch (error) {
    return handleApiError(error)
  }
}
