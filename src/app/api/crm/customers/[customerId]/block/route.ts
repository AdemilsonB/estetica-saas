import { z } from 'zod'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { ensurePermission, PERMISSIONS } from '@/shared/auth/permissions'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { customerRepository } from '@/domains/crm/customer.repository'

const BlockSchema = z.object({
  reason: z.string().max(500).optional(),
})

type RouteContext = {
  params: Promise<{ customerId: string }>
}

export async function POST(req: Request, context: RouteContext) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(req)
    ensurePermission(session, PERMISSIONS.customers.edit)
    const { customerId } = await context.params
    const body = await req.json().catch(() => ({}))
    const { reason } = BlockSchema.parse(body)
    const customer = await customerRepository.block(session.tenantId, customerId, reason)
    return Response.json(customer)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(req)
    ensurePermission(session, PERMISSIONS.customers.edit)
    const { customerId } = await context.params
    const customer = await customerRepository.unblock(session.tenantId, customerId)
    return Response.json(customer)
  } catch (error) {
    return handleApiError(error)
  }
}
