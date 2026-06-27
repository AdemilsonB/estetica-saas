import { publicBookingRepository } from '@/domains/scheduling/public-booking.repository'
import { handleApiError } from '@/shared/http/handle-api-error'

export async function GET(
  _req: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params
    const tenant = await publicBookingRepository.findTenantBySlug(slug)
    const [services, professionals, packages, promotions] = await Promise.all([
      publicBookingRepository.findPublicServices(tenant.id),
      publicBookingRepository.findPublicProfessionals(tenant.id),
      publicBookingRepository.findPublicPackages(tenant.id),
      publicBookingRepository.findPublicPromotions(tenant.id),
    ])

    return Response.json({
      name: tenant.name,
      slug: tenant.slug,
      phone: tenant.phone,
      address: tenant.address,
      timezone: tenant.timezone,
      businessHours: tenant.businessHours,
      branding: tenant.brandingConfig,
      bio: tenant.bio,
      instagramUrl: tenant.instagramUrl,
      coverImageUrl: tenant.coverImageUrl,
      whatsappEnabled: tenant.whatsappEnabled,
      segments: tenant.segments,
      createdAt: tenant.createdAt.toISOString(),
      services,
      professionals,
      packages,
      promotions,
      allowPublicBooking: tenant.schedulingPolicy?.allowPublicBooking ?? true,
      maxAdvanceDays: tenant.schedulingPolicy?.maxAdvanceDays ?? 60,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
