'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, ClipboardList, Filter, Heart } from 'lucide-react'
import { useVitrineInteraction } from './vitrine-interaction-context'
import {
  VitrineFilterSheet,
  EMPTY_FILTER_STATE,
  matchesPriceRange,
  countActiveFilters,
  type VitrineFilterState,
} from './vitrine-filter-sheet'

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

type TeamMember = { id: string; name: string; serviceIds?: string[] }

type Props = {
  services: PublicService[]
  bookingBaseUrl: string
  primaryColor: string
  team?: TeamMember[]
}

function formatPrice(s: PublicService): string {
  if (s.priceType === 'ON_CONSULTATION') return 'Sob consulta'
  if (s.priceType === 'RANGE' && s.priceMin != null && s.priceMax != null)
    return `R$ ${s.priceMin.toFixed(2)} – R$ ${s.priceMax.toFixed(2)}`
  if (s.priceType === 'STARTING_FROM') return `A partir de R$ ${s.price.toFixed(2)}`
  return `R$ ${s.price.toFixed(2)}`
}

function effectivePrice(s: PublicService): number {
  return s.priceType === 'RANGE' ? s.priceMin ?? s.price : s.price
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
  const { openDetail, isFavorited, toggleFavorite } = useVitrineInteraction()
  const isFavorite = isFavorited('service', service.id)

  function handleOpenDetail() {
    openDetail({
      kind: 'service',
      id: service.id,
      name: service.name,
      imageUrl: service.imageUrl,
      description: service.description,
      priceLabel: formatPrice(service),
      durationLabel: formatDuration(service.duration),
      bookingHref: `${bookingBaseUrl}?serviceId=${service.id}`,
    })
  }

  return (
    <div className="flex gap-3 rounded-2xl border bg-card p-3">
      <button
        onClick={handleOpenDetail}
        className="relative size-[72px] shrink-0 overflow-hidden rounded-xl bg-muted flex items-center justify-center"
        aria-label={`Ver detalhes de ${service.name}`}
      >
        {service.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={service.imageUrl} alt={service.name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-2xl">✂️</span>
        )}
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <button onClick={handleOpenDetail} className="text-left text-sm font-semibold leading-snug">
            {service.name}
          </button>
          <div className="flex shrink-0 items-center gap-1.5">
            {service.anamneseMode === 'REQUIRED' && (
              <span
                className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
                style={{ backgroundColor: primaryColor }}
                title="Requer ficha de saúde"
              >
                <ClipboardList className="size-2.5" />
                Ficha
              </span>
            )}
            <button
              onClick={() => toggleFavorite('service', service.id)}
              aria-label={isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
              className="flex size-9 items-center justify-center rounded-full"
            >
              <Heart
                className="size-4"
                style={{ fill: isFavorite ? '#e0436b' : 'none', stroke: isFavorite ? '#e0436b' : '#b94a6c' }}
              />
            </button>
          </div>
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
            <p className={`text-xs leading-relaxed text-muted-foreground ${descExpanded ? '' : 'line-clamp-2'}`}>
              {service.description}
            </p>
            {hasLongDesc && (
              <button
                onClick={() => setDescExpanded((v) => !v)}
                className="mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-medium"
                style={{ color: primaryColor }}
              >
                {descExpanded ? <>Ver menos <ChevronUp className="size-3" /></> : <>Ver mais <ChevronDown className="size-3" /></>}
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

function CategorySection({
  name,
  services,
  bookingBaseUrl,
  primaryColor,
  showHeader,
}: {
  name: string
  services: PublicService[]
  bookingBaseUrl: string
  primaryColor: string
  showHeader: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-2xl border overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          {showHeader && (
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{name}</span>
          )}
          <span className="text-xs text-muted-foreground">
            {services.length} {services.length === 1 ? 'serviço' : 'serviços'}
          </span>
        </div>
        <ChevronDown className={`size-4 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t px-3 pb-3 pt-3 space-y-3">
          {services.map((s) => (
            <ServiceCard
              key={s.id}
              service={s}
              bookingBaseUrl={bookingBaseUrl}
              primaryColor={primaryColor}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function VitrineServicesList({ services, bookingBaseUrl, primaryColor, team = [] }: Props) {
  const [filter, setFilter] = useState<VitrineFilterState>(EMPTY_FILTER_STATE)
  const [filterOpen, setFilterOpen] = useState(false)

  const categoryOptions = useMemo(() => {
    const names = new Set(services.map((s) => s.categoryName ?? 'Outros'))
    return Array.from(names).map((n) => ({ value: n, label: n }))
  }, [services])

  const professionalOptions = useMemo(
    () => team.filter((m) => (m.serviceIds?.length ?? 0) > 0).map((m) => ({ value: m.id, label: m.name })),
    [team],
  )

  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      if (filter.category && (s.categoryName ?? 'Outros') !== filter.category) return false
      if (filter.professional) {
        const pro = team.find((m) => m.id === filter.professional)
        if (!pro?.serviceIds?.includes(s.id)) return false
      }
      if (!matchesPriceRange(effectivePrice(s), filter.priceRange)) return false
      return true
    })
  }, [services, filter, team])

  if (services.length === 0) return null

  const categoryOrder: string[] = []
  const grouped: Record<string, PublicService[]> = {}
  for (const s of filteredServices) {
    const cat = s.categoryName ?? 'Outros'
    if (!grouped[cat]) {
      grouped[cat] = []
      categoryOrder.push(cat)
    }
    grouped[cat].push(s)
  }

  const hasMultipleCategories = categoryOrder.length > 1
  const activeFilters = countActiveFilters(filter)

  return (
    <section id="servicos" className="mx-auto max-w-3xl px-4 pt-8">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-bold">Serviços</h2>
        <button
          onClick={() => setFilterOpen(true)}
          className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold"
        >
          <Filter className="size-3" />
          Filtrar
          {activeFilters > 0 && (
            <span
              className="flex size-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
              style={{ backgroundColor: primaryColor }}
            >
              {activeFilters}
            </span>
          )}
        </button>
      </div>

      {filteredServices.length === 0 ? (
        <p className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
          Nenhum serviço encontrado com esse filtro.
        </p>
      ) : (
        <div className="space-y-2">
          {categoryOrder.map((cat) => (
            <CategorySection
              key={cat}
              name={cat}
              services={grouped[cat]!}
              bookingBaseUrl={bookingBaseUrl}
              primaryColor={primaryColor}
              showHeader={hasMultipleCategories}
            />
          ))}
        </div>
      )}

      <VitrineFilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        title="Filtrar serviços"
        primaryColor={primaryColor}
        categories={categoryOptions}
        professionals={professionalOptions}
        value={filter}
        onApply={setFilter}
      />
    </section>
  )
}
