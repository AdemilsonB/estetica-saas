import { z } from 'zod'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { ensurePermission } from '@/shared/auth/permissions'
import { handleApiError } from '@/shared/http/handle-api-error'
import { inventoryService } from '@/domains/inventory/inventory.service'

const adjustSchema = z.object({
  targetQuantity: z.number().int().min(0),
})

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, 'produtos', 'edit')
    const { id } = await params
    const body: unknown = await request.json()
    const { targetQuantity } = adjustSchema.parse(body)
    await inventoryService.adjustStock(session.tenantId, id, targetQuantity, session.userId)
    return Response.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
