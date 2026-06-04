import { roleService } from '@/domains/iam/role.service'
import { createRoleSchema } from '@/domains/iam/role.schemas'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { ForbiddenError } from '@/shared/errors'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    const roles = await roleService.listRoles(session.tenantId)
    return Response.json(roles)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    if (!session.isOwner) throw new ForbiddenError('Apenas o dono pode criar cargos.')
    const input = await validateInput(request, createRoleSchema)
    const role = await roleService.createRole(session.tenantId, input)
    return Response.json(role, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
