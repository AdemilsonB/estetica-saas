import { publicBookingRepository } from '@/domains/scheduling/public-booking.repository'
import { handleApiError } from '@/shared/http/handle-api-error'

export async function GET(
  _req: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params
    const tenant = await publicBookingRepository.findTenantBySlug(slug)
    const [services, professionals] = await Promise.all([
      publicBookingRepository.findPublicServices(tenant.id),
      publicBookingRepository.findPublicProfessionals(tenant.id),
    ])

    return Response.json({
      name: tenant.name,
      slug: tenant.slug,
      address: tenant.address,
      timezone: tenant.timezone,
      businessHours: tenant.businessHours,
      branding: tenant.brandingConfig,
      services,
      professionals,
      allowPublicBooking: tenant.schedulingPolicy?.allowPublicBooking ?? true,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
