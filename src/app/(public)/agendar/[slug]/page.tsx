import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { verifyPublicSession, COOKIE_NAME } from '@/shared/auth/public-session'
import { prisma } from '@/shared/database/prisma'
import { isOpenNow } from '@/lib/business-hours'
import { BookingClient } from './booking-client'
import type { TenantPublicData } from './types'

async function fetchTenantData(slug: string): Promise<TenantPublicData | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  try {
    const res = await fetch(`${baseUrl}/api/public/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    })
    if (!res.ok) return null
    return res.json() as Promise<TenantPublicData>
  } catch {
    return null
  }
}

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ serviceId?: string; packageId?: string; promotionId?: string }>
}) {
  const { slug } = await params
  const sp = await searchParams

  const data = await fetchTenantData(slug)
  if (!data || !data.allowPublicBooking) notFound()

  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value ?? null
  const session = token ? verifyPublicSession(token) : null
  if (!session || session.slug !== slug) {
    redirect(`/${slug}/entrar`)
  }

  const customer = await prisma.customer.findFirst({
    where: { id: session.customerId, tenantId: session.tenantId },
    select: { id: true, name: true, phone: true },
  })
  if (!customer) {
    redirect(`/${slug}/entrar`)
  }

  const branding = data.branding
  const primaryColor = branding?.primaryColor ?? '#7C3AED'
  const bgColor = branding?.backgroundColor ?? '#FAFAFA'
  const fgColor = branding?.foregroundColor ?? '#1a1a1a'
  const logoUrl = branding?.logoUrl ?? null
  const hasLogo = !!logoUrl

  const brandingVars = [
    branding?.primaryColor ? `--booking-primary: ${branding.primaryColor};` : '',
    branding?.accentColor ? `--booking-accent: ${branding.accentColor};` : '',
    branding?.foregroundColor ? `--booking-fg: ${branding.foregroundColor};` : '',
  ]
    .filter(Boolean)
    .join(' ')

  const isOpen = isOpenNow(data.businessHours, data.timezone)

  return (
    <div className="min-h-screen" style={{ backgroundColor: bgColor, color: fgColor }}>
      {brandingVars && <style>{`:root { ${brandingVars} }`}</style>}

      {/* Barra de retorno — sem logo duplicada */}
      <div className="sticky top-0 z-50 flex items-center gap-3 border-b bg-white/95 px-4 py-3 backdrop-blur-sm">
        <Link
          href={`/${data.slug}`}
          className="flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-70"
          style={{ color: primaryColor }}
        >
          <ArrowLeft className="size-4 shrink-0" />
          <span className="max-w-[180px] truncate sm:max-w-xs">{data.name}</span>
        </Link>

        <div className="ml-auto shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              isOpen ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            <span className={`size-1.5 rounded-full ${isOpen ? 'bg-green-500' : 'bg-slate-400'}`} />
            {isOpen ? 'Aberto' : 'Fechado'}
          </span>
        </div>
      </div>

      {/* Info do estabelecimento abaixo do header */}
      <div className="border-b bg-white/70 px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          {hasLogo && logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={data.name}
              className="size-9 shrink-0 rounded-lg object-contain"
            />
          ) : (
            <div
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ backgroundColor: primaryColor }}
            >
              {data.name[0]?.toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold">{data.name}</p>
            {data.address && (
              <p className="truncate text-xs opacity-60">{data.address}</p>
            )}
          </div>
        </div>
      </div>

      {/* Conteúdo do agendamento */}
      <main className="mx-auto max-w-2xl px-4 py-6 pb-28">
        {/* Card em desktop, layout plano em mobile */}
        <div className="sm:rounded-2xl sm:border sm:border-slate-200/80 sm:bg-white sm:p-6 sm:shadow-sm">
          <BookingClient
            tenantData={data}
            customerId={customer.id}
            customerName={customer.name}
            customerPhone={customer.phone ?? ''}
            preSelectServiceId={sp.serviceId}
            preSelectPackageId={sp.packageId}
          />
        </div>
      </main>
    </div>
  )
}
