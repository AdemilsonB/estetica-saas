import { z } from 'zod'
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { adminRepository } from '@/domains/admin/admin.repository'
import { logAdminAction } from '@/shared/audit/admin-audit'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

const blockSchema = z.object({
  blocked: z.boolean(),
  reason: z.string().max(500).optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  initializeDomainRuntime()
  try {
    const session = await getAdminContext(request)
    const { tenantId } = await params
    const input = await validateInput(request, blockSchema)

    if (input.blocked) {
      await adminRepository.blockTenant(tenantId, input.reason)
    } else {
      await adminRepository.unblockTenant(tenantId)
    }

    await logAdminAction({
      adminUserId: session.userId,
      action: input.blocked ? 'tenant.blocked' : 'tenant.unblocked',
      targetType: 'Tenant',
      targetId: tenantId,
      metadata: { reason: input.reason },
      request,
    })

    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
