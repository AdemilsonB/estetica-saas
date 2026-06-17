import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
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

type BusinessHourEntry = {
  open: string
  close: string
  active: boolean
}

type BusinessHoursMap = Record<string, BusinessHourEntry>

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function isOpenNow(businessHours: unknown, timezone: string): boolean {
  if (!businessHours || typeof businessHours !== 'object') return true

  try {
    const hours = businessHours as BusinessHoursMap

    // Obter hora atual no timezone do tenant
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hour12: false,
    })

    const parts = formatter.formatToParts(now)
    const weekdayShort = parts.find((p) => p.type === 'weekday')?.value
    const hourStr = parts.find((p) => p.type === 'hour')?.value
    const minuteStr = parts.find((p) => p.type === 'minute')?.value

    if (!weekdayShort || !hourStr || !minuteStr) return true

    // Mapear abreviação en-US para índice 0-6 (domingo=0)
    const weekdayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    }
    const dayIndex = weekdayMap[weekdayShort]
    if (dayIndex === undefined) return true

    const dayConfig = hours[String(dayIndex)]
    if (!dayConfig || !dayConfig.active) return false

    const currentMinutes = timeToMinutes(`${hourStr}:${minuteStr}`)
    const openMinutes = timeToMinutes(dayConfig.open)
    const closeMinutes = timeToMinutes(dayConfig.close)

    return currentMinutes >= openMinutes && currentMinutes < closeMinutes
  } catch {
    return true
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

  const branding = data.branding
  const brandingVars = [
    branding?.primaryColor ? `--booking-primary: ${branding.primaryColor};` : '',
    branding?.backgroundColor ? `--booking-bg: ${branding.backgroundColor};` : '',
    branding?.foregroundColor ? `--booking-fg: ${branding.foregroundColor};` : '',
    branding?.accentColor ? `--booking-accent: ${branding.accentColor};` : '',
  ]
    .filter(Boolean)
    .join(' ')

  const isOpen = isOpenNow(data.businessHours, data.timezone)

  return (
    <div className="min-h-screen bg-[--booking-bg,#FAFAFA]">
      {brandingVars && <style>{`:root { ${brandingVars} }`}</style>}

      {/* Barra de retorno */}
      <div className="sticky top-0 z-50 flex items-center gap-2 border-b bg-white/95 px-3 py-2.5 backdrop-blur-sm">
        <Link
          href={`/${data.slug}`}
          className="flex items-center gap-1.5 text-sm font-medium"
          style={{ color: branding?.primaryColor ?? '#7C3AED' }}
        >
          <ArrowLeft className="size-4 shrink-0" />
          <span className="truncate max-w-[200px]">{data.name}</span>
        </Link>
        {branding?.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.logoUrl}
            alt={data.name}
            className="ml-auto size-7 shrink-0 rounded-lg object-contain"
          />
        )}
      </div>

      {/* Hero compacto: banner do salão como fundo, info flutuando */}
      <div role="banner" aria-label={data.name} className="relative h-16 overflow-hidden">
        {/* Camada 1: fundo — banner do tenant ou gradiente padrão */}
        {branding?.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.bannerUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #DB2777)' }}
          />
        )}

        {/* Camada 2: overlay escuro para garantir leitura */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.15), rgba(0,0,0,0.45))' }}
        />

        {/* Camada 3: conteúdo flutuando */}
        <div className="absolute inset-0 flex items-center px-4">
          <div className="mx-auto flex w-full max-w-lg items-center gap-3">
          {/* Logo do salão */}
          {branding?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logoUrl}
              alt={data.name}
              className="size-[34px] shrink-0 rounded-[9px] border-2 border-white/75 object-contain shadow-md"
            />
          ) : (
            <div
              className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] border-2 border-white/75 text-sm font-bold text-white shadow-md"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
            >
              {data.name[0]?.toUpperCase()}
            </div>
          )}

          {/* Nome e endereço */}
          <div className="min-w-0 flex-1">
            <h1
              className="truncate text-xs font-extrabold text-white"
              style={{ textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}
            >
              {data.name}
            </h1>
            {data.address && (
              <p
                className="truncate text-[11px] text-white/80"
                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
              >
                {data.address}
              </p>
            )}
          </div>

          {/* Badge aberto/fechado */}
          <div className="ml-auto shrink-0">
            <span className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-white/20 px-2 py-0.5 text-xs font-medium text-white">
              <span
                className={`size-1.5 rounded-full ${isOpen ? 'bg-green-400' : 'bg-white/50'}`}
              />
              {isOpen ? 'Aberto' : 'Fechado'}
            </span>
          </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-lg px-4 py-6 pb-24">
        <BookingClient
          tenantData={data}
          preSelectServiceId={sp.serviceId}
          preSelectPackageId={sp.packageId}
        />
      </main>
    </div>
  )
}
