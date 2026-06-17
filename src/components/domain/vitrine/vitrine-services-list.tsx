'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, ClipboardList } from 'lucide-react'

export type PublicService = {
  id: string
  name: string
  duration: number
  price: number
  priceType: 'FIXED' | 'STARTING_FROM' | 'RANGE' | 'ON_CONSULTATION'
  priceMin?: number | null
  priceMax?: number | null
  imageUrl?: string | null
  description?: string | null
  categoryName?: string | null
  anamneseMode: 'NONE' | 'OPTIONAL' | 'REQUIRED'
}

type Props = {
  services: PublicService[]
  bookingBaseUrl: string
  primaryColor: string
}

function formatPrice(s: PublicService): string {
  if (s.priceType === 'ON_CONSULTATION') return 'Sob consulta'
  if (s.priceType === 'RANGE' && s.priceMin != null && s.priceMax != null)
    return `R$ ${s.priceMin.toFixed(2)} – R$ ${s.priceMax.toFixed(2)}`
  if (s.priceType === 'STARTING_FROM') return `A partir de R$ ${s.price.toFixed(2)}`
  return `R$ ${s.price.toFixed(2)}`
}

function formatDuration(min: number): string {
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h${m}min` : `${h}h`
}

function ServiceCard({
  service,
  bookingBaseUrl,
  primaryColor,
}: {
  service: PublicService
  bookingBaseUrl: string
  primaryColor: string
}) {
  const [descExpanded, setDescExpanded] = useState(false)
  const hasLongDesc = (service.description?.length ?? 0) > 100

  return (
    <div className="flex gap-3 rounded-2xl border bg-card p-3">
      {/* Thumbnail */}
      <div className="size-[72px] shrink-0 overflow-hidden rounded-xl bg-muted flex items-center justify-center">
        {service.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={service.imageUrl} alt={service.name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-2xl">✂️</span>
        )}
      </div>

      {/* Conteúdo */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold leading-snug">{service.name}</p>
          {service.anamneseMode === 'REQUIRED' && (
            <span
              className="shrink-0 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
              style={{ backgroundColor: primaryColor }}
              title="Requer ficha de saúde"
            >
              <ClipboardList className="size-2.5" />
              Ficha
            </span>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          <span className="font-medium" style={{ color: primaryColor }}>
            {formatPrice(service)}
          </span>
          {' · '}
          {formatDuration(service.duration)}
        </p>

        {service.description && (
          <div>
            <p
              className={`text-xs leading-relaxed text-muted-foreground ${descExpanded ? '' : 'line-clamp-2'}`}
            >
              {service.description}
            </p>
            {hasLongDesc && (
              <button
                onClick={() => setDescExpanded((v) => !v)}
                className="mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-medium"
                style={{ color: primaryColor }}
              >
                {descExpanded ? (
                  <>Ver menos <ChevronUp className="size-3" /></>
                ) : (
                  <>Ver mais <ChevronDown className="size-3" /></>
                )}
              </button>
            )}
          </div>
        )}

        <a
          href={`${bookingBaseUrl}?serviceId=${service.id}`}
          className="mt-1.5 inline-flex h-8 w-full items-center justify-center rounded-xl text-xs font-semibold text-white"
          style={{ backgroundColor: primaryColor }}
        >
          Agendar
        </a>
      </div>
    </div>
  )
}

export function VitrineServicesList({ services, bookingBaseUrl, primaryColor }: Props) {
  if (services.length === 0) return null

  // Agrupa por categoria
  const categoryOrder: string[] = []
  const grouped: Record<string, PublicService[]> = {}
  for (const s of services) {
    const cat = s.categoryName ?? 'Outros'
    if (!grouped[cat]) {
      grouped[cat] = []
      categoryOrder.push(cat)
    }
    grouped[cat].push(s)
  }

  return (
    <section id="servicos" className="mx-auto max-w-3xl px-4 pt-8">
      <h2 className="mb-5 text-lg font-bold">Serviços</h2>
      <div className="space-y-8">
        {categoryOrder.map((cat) => (
          <div key={cat}>
            {categoryOrder.length > 1 && (
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {cat}
              </h3>
            )}
            <div className="space-y-3">
              {grouped[cat]!.map((s) => (
                <ServiceCard
                  key={s.id}
                  service={s}
                  bookingBaseUrl={bookingBaseUrl}
                  primaryColor={primaryColor}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
