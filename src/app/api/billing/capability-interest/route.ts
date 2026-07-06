import { z } from 'zod'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { logCapabilityInterest } from '@/domains/billing/capability-interest.service'

const bodySchema = z.object({ capabilityKey: z.string().min(1) })

export async function POST(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    const { capabilityKey } = bodySchema.parse(await request.json())
    await logCapabilityInterest(session.tenantId, capabilityKey)
    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
