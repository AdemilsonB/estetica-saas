import { publicBookingRepository } from '@/domains/scheduling/public-booking.repository'
import { handleApiError } from '@/shared/http/handle-api-error'

export async function GET(
  _req: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params
    const tenant = await publicBookingRepository.findTenantBySlug(slug)
    const team = await publicBookingRepository.findPublicTeam(tenant.id)
    return Response.json(team)
  } catch (error) {
    return handleApiError(error)
  }
}
