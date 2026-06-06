import { z } from 'zod'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { schedulingPolicyService } from '@/domains/scheduling/scheduling-policy.service'

const UpdatePolicySchema = z.object({
  paddingMinutes: z.number().int().min(0).max(120).optional(),
  minAdvanceMinutes: z.number().int().min(0).max(1440).optional(),
  maxAdvanceDays: z.number().int().min(1).max(365).optional(),
  allowPublicBooking: z.boolean().optional(),
})

export async function GET(req: Request) {
  try {
    const { tenantId } = await getSessionContext(req)
    const policy = await schedulingPolicyService.getPolicy(tenantId)
    return Response.json(policy)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(req: Request) {
  try {
    const { tenantId } = await getSessionContext(req)
    const body = await req.json()
    const data = UpdatePolicySchema.parse(body)
    const policy = await schedulingPolicyService.updatePolicy(tenantId, data)
    return Response.json(policy)
  } catch (error) {
    return handleApiError(error)
  }
}
