import { getSessionContext } from '@/shared/auth/session'
import { ensurePermission, PERMISSIONS } from '@/shared/auth/permissions'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { anamneseService } from '@/domains/crm/anamnese.service'
import { saveAnamneseProfessionalSchema } from '@/domains/crm/anamnese-blocks.types'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

type RouteContext = { params: Promise<{ customerId: string }> }

export async function GET(req: Request, { params }: RouteContext) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(req)
    ensurePermission(session, PERMISSIONS.customers.view)
    const { customerId } = await params
    const anamnese = await anamneseService.getByCustomer(session.tenantId, customerId)
    return Response.json(anamnese)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(req: Request, { params }: RouteContext) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(req)
    ensurePermission(session, PERMISSIONS.customers.edit)
    const { customerId } = await params
    const input = await validateInput(req, saveAnamneseProfessionalSchema)
    const anamnese = await anamneseService.saveByProfessional(
      session.tenantId,
      customerId,
      input.blockType,
      input.data,
    )
    return Response.json(anamnese)
  } catch (error) {
    return handleApiError(error)
  }
}
