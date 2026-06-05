import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { ensurePermission } from '@/shared/auth/permissions'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { inventoryService } from '@/domains/inventory/inventory.service'
import { recordPurchaseSchema } from '@/domains/inventory/types'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, 'produtos', 'edit')
    const { id } = await params
    const input = await validateInput(request, recordPurchaseSchema)
    const result = await inventoryService.recordPurchase(
      session.tenantId,
      { ...input, productId: id },
      session.userId,
    )
    return Response.json(result, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
