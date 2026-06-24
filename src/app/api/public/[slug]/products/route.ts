import { publicBookingRepository } from '@/domains/scheduling/public-booking.repository'
import { handleApiError } from '@/shared/http/handle-api-error'

export async function GET(
  _req: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params
    const tenant = await publicBookingRepository.findTenantBySlug(slug)
    const products = await publicBookingRepository.findPublicProducts(tenant.id)
    return Response.json(
      products.map((p) => ({
        id: p.id,
        name: p.name,
        salePrice: Number(p.salePrice),
        imageUrl: p.imageUrl,
        imageCropX: p.imageCropX,
        imageCropY: p.imageCropY,
        imageCropZoom: p.imageCropZoom,
        categoryName: p.category?.name ?? null,
      })),
    )
  } catch (error) {
    return handleApiError(error)
  }
}
