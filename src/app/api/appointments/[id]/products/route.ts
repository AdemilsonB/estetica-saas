import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { ensurePermission } from '@/shared/auth/permissions'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { inventoryService } from '@/domains/inventory/inventory.service'
import { appointmentProductsSchema } from '@/domains/inventory/types'
import { prisma } from '@/shared/database/prisma'
import { NotFoundError } from '@/shared/errors'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, 'produtos', 'view')
    const { id } = await params
    const result = await inventoryService.getAppointmentProducts(session.tenantId, id)
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, 'produtos', 'edit')
    const { id } = await params
    const input = await validateInput(request, appointmentProductsSchema)

    const appointment = await prisma.appointment.findFirst({
      where: { id, tenantId: session.tenantId },
      select: { status: true },
    })
    if (!appointment) throw new NotFoundError('Atendimento')

    if (appointment.status === 'COMPLETED') {
      const result = await inventoryService.updateCompletedAppointmentProducts(
        session.tenantId,
        id,
        input.products,
        input.stockAction,
        session.userId,
      )
      return Response.json(result)
    }

    const result = await inventoryService.finalizeAppointmentProducts(
      session.tenantId,
      id,
      input,
      session.userId,
    )
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
