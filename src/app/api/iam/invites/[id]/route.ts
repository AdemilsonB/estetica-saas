import { iamService } from '@/domains/iam/iam.service'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { ForbiddenError } from '@/shared/errors'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    if (!session.isOwner) throw new ForbiddenError('Apenas o dono pode cancelar convites.')
    const { id } = await params
    await iamService.cancelInvite(session.tenantId, id)
    return new Response(null, { status: 204 })
  } catch (error) {
    return handleApiError(error)
  }
}
