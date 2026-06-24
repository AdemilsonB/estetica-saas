'use client'

import { MapPin } from 'lucide-react'
import { openRoute } from '@/lib/maps-route'

type Props = {
  address: string
  primaryColor: string
}

export function VitrineLocationBlock({ address, primaryColor }: Props) {
  const parts = address.split(',')
  const street = parts.slice(0, -2).join(',').trim() || address
  const city = parts.slice(-2).join(',').trim()

  return (
    <button
      onClick={() => openRoute(address)}
      className="mx-auto mt-4 flex w-full max-w-3xl items-center gap-3 px-4 py-1 text-left"
    >
      <MapPin className="size-4 shrink-0" style={{ color: primaryColor }} />
      <span className="min-w-0 flex-1 text-xs">
        <span className="block truncate font-semibold">{street}</span>
        {city && <span className="block truncate text-muted-foreground">{city}</span>}
      </span>
      <span className="shrink-0 text-xs font-bold" style={{ color: primaryColor }}>
        Rota ›
      </span>
    </button>
  )
}
