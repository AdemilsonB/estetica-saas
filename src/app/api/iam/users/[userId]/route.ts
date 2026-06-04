import { z } from 'zod'
import { iamService } from '@/domains/iam/iam.service'
import { ensurePermission, PERMISSIONS } from '@/shared/auth/permissions'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

const updateRoleSchema = z.object({ roleId: z.string().min(1) })

type Params = { params: Promise<{ userId: string }> }

export async function PATCH(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.users.manage)
    const { userId } = await params
    const { roleId } = await validateInput(request, updateRoleSchema)
    const user = await iamService.updateUserRoleById(session.tenantId, session.userId, userId, roleId)
    return Response.json(user)
  } catch (error) {
    return handleApiError(error)
  }
}
