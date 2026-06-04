import { roleService } from '@/domains/iam/role.service'
import { updateRoleSchema } from '@/domains/iam/role.schemas'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { ForbiddenError } from '@/shared/errors'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

type Params = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    if (!session.isOwner) throw new ForbiddenError('Apenas o dono pode editar cargos.')
    const { id } = await params
    const input = await validateInput(request, updateRoleSchema)
    const role = await roleService.updateRole(session.tenantId, id, input)
    return Response.json(role)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    if (!session.isOwner) throw new ForbiddenError('Apenas o dono pode excluir cargos.')
    const { id } = await params
    await roleService.deleteRole(session.tenantId, id)
    return new Response(null, { status: 204 })
  } catch (error) {
    return handleApiError(error)
  }
}
