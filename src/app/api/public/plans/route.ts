import { getPublicPlans } from '@/domains/billing/plan-catalog.service'
import { handleApiError } from '@/shared/http/handle-api-error'

export async function GET() {
  try {
    const plans = await getPublicPlans()
    return Response.json(plans)
  } catch (error) {
    return handleApiError(error)
  }
}
