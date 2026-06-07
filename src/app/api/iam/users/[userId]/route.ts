import { z } from 'zod'
import { iamService } from '@/domains/iam/iam.service'
import { ensurePermission, PERMISSIONS } from '@/shared/auth/permissions'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

const updateMemberSchema = z.object({
  roleId: z.string().min(1).optional(),
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().optional(),
}).refine((d) => d.roleId || d.name || d.email, {
  message: 'Pelo menos um campo deve ser fornecido.',
})

type Params = { params: Promise<{ userId: string }> }

export async function PATCH(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.users.manage)
    const { userId } = await params
    const body = await validateInput(request, updateMemberSchema)

    if (body.roleId) {
      const user = await iamService.updateUserRoleById(
        session.tenantId,
        session.userId,
        userId,
        body.roleId,
      )
      return Response.json(user)
    }

    const user = await iamService.updateMember(session.tenantId, session.userId, userId, {
      name: body.name,
      email: body.email,
    })
    return Response.json(user)
  } catch (error) {
    return handleApiError(error)
  }
}
