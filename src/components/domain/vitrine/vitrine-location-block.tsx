'use client'

import { MapPin, Star } from 'lucide-react'
import { openRoute } from '@/lib/maps-route'

type Props = {
  address: string
  primaryColor: string
  googleBusinessUrl?: string | null
  googleRating?: { rating: number; userRatingCount: number } | null
}

export function VitrineLocationBlock({ address, primaryColor, googleBusinessUrl, googleRating }: Props) {
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`

  return (
    <div className="mx-auto mt-4 w-full max-w-3xl px-4">
      <div className="overflow-hidden rounded-2xl border">
        <iframe
          title={`Mapa de ${address}`}
          src={mapSrc}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="h-40 w-full border-0"
        />
        <div className="flex items-center gap-3 px-4 py-3">
          <MapPin className="size-4 shrink-0" style={{ color: primaryColor }} />
          <span className="min-w-0 flex-1 truncate text-sm">{address}</span>
          <button
            onClick={() => openRoute(address)}
            className="shrink-0 text-xs font-bold"
            style={{ color: primaryColor }}
          >
            Rota ›
          </button>
        </div>
        {(googleBusinessUrl || googleRating) && (
          <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
            {googleRating ? (
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Star className="size-4 fill-amber-400 text-amber-400" />
                {googleRating.rating.toFixed(1).replace('.', ',')}
                <span className="text-muted-foreground">
                  · {googleRating.userRatingCount} avaliações
                </span>
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Avaliações no Google</span>
            )}
            {googleBusinessUrl && (
              <a
                href={googleBusinessUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-xs font-bold"
                style={{ color: primaryColor }}
              >
                Ver no Google ↗
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
