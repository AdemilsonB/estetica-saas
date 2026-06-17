import { notFound } from 'next/navigation'
import Link from 'next/link'
import { VitrineBanner } from '@/components/domain/vitrine/vitrine-banner'
import { VitrineTeam } from '@/components/domain/vitrine/vitrine-team'
import { VitrineTabs } from '@/components/domain/vitrine/vitrine-tabs'

type TenantData = {
  name: string
  slug: string
  phone?: string | null
  whatsappEnabled?: boolean
  bio?: string | null
  instagramUrl?: string | null
  coverImageUrl?: string | null
  branding?: {
    primaryColor?: string | null
    accentColor?: string | null
    backgroundColor?: string | null
    foregroundColor?: string | null
  } | null
  services: object[]
  packages: object[]
  promotions: object[]
  allowPublicBooking: boolean
}

type TeamMember = { id: string; name: string; role: string; avatarUrl?: string | null; bio?: string | null }
type Product = { id: string; name: string; salePrice: number; imageUrl?: string | null; categoryName?: string | null }

async function fetchAll(slug: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const opts = { next: { revalidate: 300 } }
  const [tenantRes, teamRes, productsRes] = await Promise.all([
    fetch(`${base}/api/public/${encodeURIComponent(slug)}`, opts),
    fetch(`${base}/api/public/${encodeURIComponent(slug)}/team`, opts),
    fetch(`${base}/api/public/${encodeURIComponent(slug)}/products`, opts),
  ])
  if (!tenantRes.ok) return null
  const tenant = (await tenantRes.json()) as TenantData
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

  return (
    <>
      <VitrineBanner
        coverImageUrl={tenant.coverImageUrl}
        primaryColor={primary}
        accentColor={accent}
        bio={tenant.bio}
      />

      <VitrineTeam members={team} />

      <VitrineTabs
        services={tenant.services as Parameters<typeof VitrineTabs>[0]['services']}
        packages={tenant.packages as Parameters<typeof VitrineTabs>[0]['packages']}
        promotions={tenant.promotions as Parameters<typeof VitrineTabs>[0]['promotions']}
        products={products}
        bookingBaseUrl={bookingUrl}
        primaryColor={primary}
      />

      {/* CTA fixo mobile */}
      {tenant.allowPublicBooking && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:hidden">
          <Link
            href={bookingUrl}
            className="flex h-14 w-full items-center justify-center rounded-2xl text-base font-semibold text-white shadow-lg"
            style={{ backgroundColor: primary }}
          >
            Agendar agora
          </Link>
        </div>
      )}
    </>
  )
}
