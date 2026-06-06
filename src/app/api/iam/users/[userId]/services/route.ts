import { z } from 'zod'
import { iamService } from '@/domains/iam/iam.service'
import { ensurePermission, PERMISSIONS } from '@/shared/auth/permissions'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

const setServicesSchema = z.object({
  serviceIds: z.array(z.string().cuid()).max(100),
})

type Params = { params: Promise<{ userId: string }> }

export async function GET(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.users.view)
    const { userId } = await params
    const services = await iamService.getMemberServices(session.tenantId, userId)
    return Response.json(services.map((ps) => ps.service))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.users.manage)
    const { userId } = await params
    const { serviceIds } = await validateInput(request, setServicesSchema)
    const updated = await iamService.setMemberServices(session.tenantId, userId, serviceIds)
    return Response.json(updated.map((ps) => (ps as { service: { id: string; name: string } }).service))
  } catch (error) {
    return handleApiError(error)
  }
}
