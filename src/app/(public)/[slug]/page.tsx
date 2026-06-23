import { notFound } from 'next/navigation'
import { VitrineHero } from '@/components/domain/vitrine/vitrine-hero'
import { VitrineServicesList } from '@/components/domain/vitrine/vitrine-services-list'
import { VitrinePackagesSection } from '@/components/domain/vitrine/vitrine-packages-section'
import { VitrinePromotionsSection } from '@/components/domain/vitrine/vitrine-promotions-section'
import { VitrineProductsSection } from '@/components/domain/vitrine/vitrine-products-section'
import { PublicMenuDrawer } from '@/components/domain/vitrine/public-menu-drawer'
import { VitrineTeam } from '@/components/domain/vitrine/vitrine-team'
import { WhatsAppIcon } from '@/components/domain/vitrine/vitrine-icons'
import { VitrineStatsBar } from '@/components/domain/vitrine/vitrine-stats-bar'
import { VitrineLocationBlock } from '@/components/domain/vitrine/vitrine-location-block'
import { VitrineInteractionProvider } from '@/components/domain/vitrine/vitrine-interaction-context'

type TenantData = {
  name: string
  slug: string
  phone?: string | null
  whatsappEnabled?: boolean
  bio?: string | null
  instagramUrl?: string | null
  coverImageUrl?: string | null
  address?: string | null
  segments: string[]
  createdAt: string
  branding?: {
    logoUrl?: string | null
    primaryColor?: string | null
    accentColor?: string | null
    backgroundColor?: string | null
    foregroundColor?: string | null
  } | null
  services: {
    id: string; name: string; duration: number; price: number
    priceType: 'FIXED' | 'STARTING_FROM' | 'RANGE' | 'ON_CONSULTATION'
    priceMin?: number | null; priceMax?: number | null
    imageUrl?: string | null; description?: string | null; categoryName?: string | null
    anamneseMode: 'NONE' | 'OPTIONAL' | 'REQUIRED'
  }[]
  packages: {
    id: string; name: string; description?: string | null; imageUrl?: string | null
    price: number; duration: number; services: { id: string; name: string }[]
  }[]
  promotions: {
    id: string; name: string; description?: string | null; imageUrl?: string | null
    discountType: 'PERCENTAGE' | 'FIXED'; discountValue: number; endsAt?: string | null
    services: { id: string; name: string; duration: number; originalPrice: number }[]
  }[]
  allowPublicBooking: boolean
}

type TeamMember = {
  id: string; name: string; role: string; avatarUrl?: string | null
  bio?: string | null; serviceIds?: string[]
}
type Product = {
  id: string; name: string; salePrice: number; imageUrl?: string | null; categoryName?: string | null
}

type BusinessHourEntry = { open: string; close: string; active: boolean }
type BusinessHoursMap = Record<string, BusinessHourEntry>

function isOpenNow(businessHours: unknown, timezone: string): boolean {
  if (!businessHours || typeof businessHours !== 'object') return true
  try {
    const hours = businessHours as BusinessHoursMap
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false,
    })
    const parts = formatter.formatToParts(new Date())
    const weekdayShort = parts.find((p) => p.type === 'weekday')?.value
    const hourStr = parts.find((p) => p.type === 'hour')?.value
    const minuteStr = parts.find((p) => p.type === 'minute')?.value
    if (!weekdayShort || !hourStr || !minuteStr) return true
    const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
    const dayIndex = weekdayMap[weekdayShort]
    if (dayIndex === undefined) return true
    const dayConfig = hours[String(dayIndex)]
    if (!dayConfig?.active) return false
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return (h ?? 0) * 60 + (m ?? 0) }
    const current = toMin(`${hourStr}:${minuteStr}`)
    return current >= toMin(dayConfig.open) && current < toMin(dayConfig.close)
  } catch { return true }
}

async function fetchAll(slug: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const opts = { next: { revalidate: 300 } }
  const [tenantRes, teamRes, productsRes] = await Promise.all([
    fetch(`${base}/api/public/${encodeURIComponent(slug)}`, opts),
    fetch(`${base}/api/public/${encodeURIComponent(slug)}/team`, opts),
    fetch(`${base}/api/public/${encodeURIComponent(slug)}/products`, opts),
  ])
  if (!tenantRes.ok) return null
  const tenant = (await tenantRes.json()) as TenantData & { businessHours?: unknown; timezone?: string }
  const team: TeamMember[] = teamRes.ok ? ((await teamRes.json()) as TeamMember[]) : []
  const products: Product[] = productsRes.ok ? ((await productsRes.json()) as Product[]) : []
  return { tenant, team, products }
}

export default async function VitrinePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const data = await fetchAll(slug)
  if (!data) notFound()

  const { tenant, team, products } = data
  const primary = tenant.branding?.primaryColor ?? '#7C3AED'
  const accent = tenant.branding?.accentColor ?? '#c084fc'
  const bookingUrl = `/agendar/${slug}`
  const isOpen = isOpenNow(tenant.businessHours, tenant.timezone ?? 'America/Sao_Paulo')

  const bookableServices = tenant.services.filter((s) => s.priceType !== 'ON_CONSULTATION')
  const servicePrices = bookableServices.map((s) => (s.priceType === 'RANGE' ? s.priceMin ?? s.price : s.price))
  const minPrice = servicePrices.length > 0 ? Math.min(...servicePrices) : null
  const avgDuration =
    tenant.services.length > 0
      ? tenant.services.reduce((sum, s) => sum + s.duration, 0) / tenant.services.length
      : null

  return (
    <>
      {/* Drawer — position: fixed, renderizado uma vez, ouve evento global */}
      <PublicMenuDrawer
        tenantName={tenant.name}
        logoUrl={tenant.branding?.logoUrl}
        primaryColor={primary}
        phone={tenant.phone}
        whatsappEnabled={tenant.whatsappEnabled}
        slug={slug}
        bookingBaseUrl={bookingUrl}
        services={tenant.services}
        packages={tenant.packages}
        promotions={tenant.promotions}
        products={products}
        team={team}
      />

      {/* Hero com identidade do negócio */}
      <VitrineHero
        slug={slug}
        name={tenant.name}
        bio={tenant.bio}
        coverImageUrl={tenant.coverImageUrl}
        logoUrl={tenant.branding?.logoUrl}
        segments={tenant.segments}
        address={tenant.address}
        createdAt={tenant.createdAt}
        primaryColor={primary}
        accentColor={accent}
        phone={tenant.phone}
        whatsappEnabled={tenant.whatsappEnabled}
        instagramUrl={tenant.instagramUrl}
        allowPublicBooking={tenant.allowPublicBooking}
        bookingUrl={bookingUrl}
        isOpen={isOpen}
        teamCount={team.length}
        hasPackages={tenant.packages.length > 0}
        hasPromotions={tenant.promotions.length > 0}
        hasProducts={products.length > 0}
      />

      {/* Stats bar + localização */}
      <VitrineStatsBar
        servicesCount={tenant.services.length}
        minPrice={minPrice}
        avgDurationMinutes={avgDuration}
        teamCount={team.length}
      />
      {tenant.address && <VitrineLocationBlock address={tenant.address} primaryColor={primary} />}

      {/* Separador */}
      <div className="mx-auto mt-6 max-w-3xl px-4">
        <hr className="border-border" />
      </div>

      <VitrineInteractionProvider
        slug={slug}
        primaryColor={primary}
        bookingBaseUrl={bookingUrl}
        team={team}
        services={tenant.services}
      >
        {/* Serviços */}
        <VitrineServicesList
          services={tenant.services}
          bookingBaseUrl={bookingUrl}
          primaryColor={primary}
          team={team}
        />

        {/* Pacotes */}
        <VitrinePackagesSection
          packages={tenant.packages}
          bookingBaseUrl={bookingUrl}
          primaryColor={primary}
        />

        {/* Promoções */}
        <VitrinePromotionsSection
          promotions={tenant.promotions}
          bookingBaseUrl={bookingUrl}
          primaryColor={primary}
        />

        {/* Equipe */}
        <VitrineTeam members={team} id="equipe" />
      </VitrineInteractionProvider>

      {/* Produtos */}
      <VitrineProductsSection products={products} primaryColor={primary} />

      {/* Espaço para o CTA fixo mobile */}
      {tenant.allowPublicBooking && <div className="h-24 sm:hidden" />}

      {/* CTA fixo mobile — Agendar + WhatsApp consolidados num único bloco */}
      {tenant.allowPublicBooking && (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex gap-2 p-4 sm:hidden">
          <a
            href={bookingUrl}
            className="flex h-14 flex-1 items-center justify-center rounded-2xl text-base font-semibold text-white shadow-lg"
            style={{ backgroundColor: primary }}
          >
            Agendar agora
          </a>
          {tenant.whatsappEnabled && tenant.phone && (
            <a
              href={`https://wa.me/55${tenant.phone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              className="flex size-14 shrink-0 items-center justify-center rounded-2xl shadow-lg"
              style={{ backgroundColor: '#25D366' }}
            >
              <WhatsAppIcon className="size-6 text-white" />
            </a>
          )}
        </div>
      )}
    </>
  )
}
