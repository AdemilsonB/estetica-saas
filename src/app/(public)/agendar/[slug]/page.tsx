import { notFound } from 'next/navigation'
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
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
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
    <div className="min-h-screen bg-[--booking-bg,#fafafa]">
      {brandingVars && <style>{`:root { ${brandingVars} }`}</style>}

      {/* Header fixo — branding do salão */}
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          {branding?.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={data.name}
              className="h-9 w-9 rounded-lg object-contain border border-slate-100"
            />
          ) : (
            <div
              className="h-9 w-9 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
              style={{ backgroundColor: branding?.primaryColor ?? '#191919' }}
            >
              {data.name[0]?.toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="font-semibold text-slate-900 text-sm leading-tight truncate">
              {data.name}
            </h1>
            {data.address && (
              <p className="text-xs text-slate-500 truncate">{data.address}</p>
            )}
          </div>
          <div className="ml-auto shrink-0">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                isOpen ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${isOpen ? 'bg-green-500' : 'bg-slate-400'}`}
              />
              {isOpen ? 'Aberto' : 'Fechado'}
            </span>
          </div>
        </div>
      </header>

      {branding?.bannerUrl && (
        <div className="w-full max-w-lg mx-auto">
          <img
            src={branding.bannerUrl}
            alt={`Banner ${data.name}`}
            className="w-full h-36 object-cover"
          />
        </div>
      )}

      <main className="max-w-lg mx-auto px-4 py-6 pb-24">
        <BookingClient tenantData={data} />
      </main>
    </div>
  )
}
