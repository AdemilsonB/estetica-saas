import { unstable_cache } from 'next/cache'

import { NotFoundError } from '@/shared/errors/domain-error'

import { publicBookingRepository } from './public-booking.repository'

/**
 * Composição dos dados públicos da vitrine para Server Components.
 *
 * Antes, a página e o layout faziam `fetch` HTTP ao próprio backend (3-4
 * round-trips loopback por render, cada um re-resolvendo o tenant pelo slug).
 * Agora chamam o repositório diretamente, resolvendo o tenant uma única vez e
 * com cache de dados (ISR 300s) por slug, invalidável pela tag `vitrine:<slug>`.
 */

export const VITRINE_REVALIDATE_SECONDS = 300

export type PublicVitrineData = Awaited<ReturnType<typeof loadVitrine>>

async function loadVitrine(slug: string) {
  let tenant
  try {
    tenant = await publicBookingRepository.findTenantBySlug(slug)
  } catch (error) {
    if (error instanceof NotFoundError) return null
    throw error
  }

  const [services, professionals, packages, promotions, team, products] = await Promise.all([
    publicBookingRepository.findPublicServices(tenant.id),
    publicBookingRepository.findPublicProfessionals(tenant.id),
    publicBookingRepository.findPublicPackages(tenant.id),
    publicBookingRepository.findPublicPromotions(tenant.id),
    publicBookingRepository.findPublicTeam(tenant.id),
    publicBookingRepository.findPublicProducts(tenant.id),
  ])

  return {
    tenant: {
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
      whatsappContactEnabled: tenant.whatsappContactEnabled,
      googleBusinessUrl: tenant.googleBusinessUrl,
      googlePlaceId: tenant.googlePlaceId,
      segments: tenant.segments,
      createdAt: tenant.createdAt.toISOString(),
      services,
      professionals,
      packages,
      promotions,
      allowPublicBooking: tenant.schedulingPolicy?.allowPublicBooking ?? true,
      maxAdvanceDays: tenant.schedulingPolicy?.maxAdvanceDays ?? 60,
    },
    team,
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      salePrice: Number(p.salePrice),
      imageUrl: p.imageUrl,
      imageCropX: p.imageCropX,
      imageCropY: p.imageCropY,
      imageCropZoom: p.imageCropZoom,
      categoryName: p.category?.name ?? null,
    })),
  }
}

/**
 * Retorna todos os dados da vitrine (tenant + equipe + produtos), com cache de
 * dados por slug. Layout e página compartilham a mesma entrada de cache, então
 * o tenant é resolvido uma única vez por render. Retorna `null` se o slug não
 * existir (para o caller chamar `notFound()`).
 */
export function getPublicVitrine(slug: string): Promise<PublicVitrineData> {
  return unstable_cache(() => loadVitrine(slug), ['public-vitrine', slug], {
    revalidate: VITRINE_REVALIDATE_SECONDS,
    tags: [`vitrine:${slug}`],
  })()
}
