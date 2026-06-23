'use client'

import { useEffect, useState } from 'react'

type MeAppointment = {
  startsAt: string
  serviceId: string | null
  packageId: string | null
  serviceName: string | null
  professionalId: string
  professionalName: string
}

type MeData = {
  name: string
  appointments: MeAppointment[]
}

type Props = {
  slug: string
  bookingUrl: string
  primaryColor: string
}

function relativeTime(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days < 1) return 'hoje'
  if (days < 14) return `há ${days} ${days === 1 ? 'dia' : 'dias'}`
  const weeks = Math.floor(days / 7)
  if (weeks < 8) return `há ${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`
  const months = Math.floor(days / 30)
  return `há ${months} ${months === 1 ? 'mês' : 'meses'}`
}

export function VitrineRebookBand({ slug, bookingUrl, primaryColor }: Props) {
  const [data, setData] = useState<MeData | null>(null)

  useEffect(() => {
    fetch(`/api/public/${encodeURIComponent(slug)}/me`, { credentials: 'include' })
      .then((res) => (res.ok ? (res.json() as Promise<MeData>) : null))
      .then(setData)
      .catch(() => setData(null))
  }, [slug])

  const last = data?.appointments[0]
  const rebookable = last && (last.serviceId || last.packageId)
  if (!data || !rebookable) return null

  const firstName = data.name.split(' ')[0]
  const params = new URLSearchParams()
  if (last.serviceId) params.set('serviceId', last.serviceId)
  if (last.packageId) params.set('packageId', last.packageId)
  params.set('professionalId', last.professionalId)

  return (
    <div
      className="mt-4 flex items-center gap-3 rounded-2xl p-3"
      style={{ backgroundColor: `${primaryColor}14` }}
    >
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ backgroundColor: primaryColor }}
      >
        {firstName[0]?.toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold">Olá, {firstName}! Repetir último agendamento?</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {last.serviceName} · {last.professionalName} · {relativeTime(last.startsAt)}
        </p>
      </div>
      <a
        href={`${bookingUrl}?${params.toString()}`}
        className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-white"
        style={{ backgroundColor: primaryColor }}
      >
        Agendar
      </a>
    </div>
  )
}
