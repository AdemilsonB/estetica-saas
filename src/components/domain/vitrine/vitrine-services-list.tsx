'use client'

import { useMemo, useState } from 'react'
import { ClipboardList, Filter, Heart, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { EntityImage } from '@/components/domain/shared/entity-image'
import { formatDuration } from '@/lib/format-duration'
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
  imageCropX?: number | null
  imageCropY?: number | null
  imageCropZoom?: number | null
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

const OUTROS = '__outros__'

function normalize(text: string): string {
  return text
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
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

function ServiceCard({
  service,
  bookingBaseUrl,
  primaryColor,
}: {
  service: PublicService
  bookingBaseUrl: string
  primaryColor: string
}) {
  const { openDetail, isFavorited, toggleFavorite } = useVitrineInteraction()
  const isFavorite = isFavorited('service', service.id)

  function handleOpenDetail() {
    openDetail({
      kind: 'service',
      id: service.id,
      name: service.name,
      imageUrl: service.imageUrl,
      imageCropX: service.imageCropX,
      imageCropY: service.imageCropY,
      imageCropZoom: service.imageCropZoom,
      description: service.description,
      priceLabel: formatPrice(service),
      durationLabel: formatDuration(service.duration),
      bookingHref: `${bookingBaseUrl}?serviceId=${service.id}`,
    })
  }

  return (
    <div className="relative w-32 shrink-0 overflow-hidden rounded-2xl bg-card shadow-sm sm:w-36">
      <button onClick={handleOpenDetail} className="flex w-full flex-col text-left" aria-label={`Ver detalhes de ${service.name}`}>
        <EntityImage
          src={service.imageUrl}
          alt={service.name}
          shape="portrait"
          cropX={service.imageCropX}
          cropY={service.imageCropY}
          cropZoom={service.imageCropZoom}
          className="w-full rounded-none"
          fallback={<span className="text-2xl">✂️</span>}
        />
        <div className="flex flex-1 flex-col gap-1 p-2.5">
          <p className="text-xs font-semibold leading-snug line-clamp-2">{service.name}</p>
          <p className="text-[11px] text-muted-foreground">{formatDuration(service.duration)}</p>
        </div>
      </button>

      {service.anamneseMode === 'REQUIRED' && (
        <span
          className="absolute left-2 top-2 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium text-white"
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
        className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-background/90"
      >
        <Heart
          className="size-3.5"
          style={{ fill: isFavorite ? '#e0436b' : 'none', stroke: isFavorite ? '#e0436b' : '#b94a6c' }}
        />
      </button>

      <p className="px-2.5 pb-2.5 text-xs font-bold" style={{ color: primaryColor }}>
        {formatPrice(service)}
      </p>
    </div>
  )
}

export function VitrineServicesList({ services, bookingBaseUrl, primaryColor, team = [] }: Props) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [filter, setFilter] = useState<VitrineFilterState>(EMPTY_FILTER_STATE)
  const [filterOpen, setFilterOpen] = useState(false)

  const professionalOptions = useMemo(
    () => team.filter((m) => (m.serviceIds?.length ?? 0) > 0).map((m) => ({ value: m.id, label: m.name })),
    [team],
  )

  const uncategorized = services.filter((s) => !s.categoryName)
  const categoryNames = Array.from(new Set(services.filter((s) => s.categoryName).map((s) => s.categoryName!)))

  const chips: { id: string | null; label: string }[] = [
    { id: null, label: 'Todos' },
    ...categoryNames.map((name) => ({ id: name, label: name })),
    ...(uncategorized.length > 0 ? [{ id: OUTROS, label: 'Outros' }] : []),
  ]

  const isSearching = search.trim().length > 0
  const activeFilters = countActiveFilters(filter)

  const visibleServices = useMemo(() => {
    let result = services

    if (isSearching) {
      const term = normalize(search.trim())
      result = result.filter(
        (s) => normalize(s.name).includes(term) || (s.description ? normalize(s.description).includes(term) : false),
      )
    } else if (activeCategory === OUTROS) {
      result = uncategorized
    } else if (activeCategory !== null) {
      result = result.filter((s) => s.categoryName === activeCategory)
    }

    return result.filter((s) => {
      if (filter.professional) {
        const pro = team.find((m) => m.id === filter.professional)
        if (!pro?.serviceIds?.includes(s.id)) return false
      }
      if (!matchesPriceRange(effectivePrice(s), filter.priceRange)) return false
      return true
    })
  }, [services, isSearching, search, activeCategory, uncategorized, filter, team])

  if (services.length === 0) return null

  return (
    <section id="servicos" className="mx-auto max-w-3xl px-4 pt-8">
      <div className="mb-4 flex items-center justify-between">
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

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar serviço..."
          className="pl-9"
        />
      </div>

      {!isSearching && chips.length > 1 && (
        <div className="mb-3 flex min-w-0 gap-2 overflow-x-auto overscroll-x-contain pb-1 scrollbar-none">
          {chips.map((chip) => (
            <button
              key={chip.id ?? 'all'}
              onClick={() => setActiveCategory(chip.id)}
              className="shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
              style={
                activeCategory === chip.id
                  ? { backgroundColor: primaryColor, borderColor: primaryColor, color: '#fff' }
                  : undefined
              }
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {visibleServices.length === 0 ? (
        <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">
          {isSearching ? `Nenhum serviço encontrado para "${search.trim()}".` : 'Nenhum serviço encontrado com esse filtro.'}
        </p>
      ) : (
        <div className="flex min-w-0 gap-3 overflow-x-auto overscroll-x-contain pb-1 scrollbar-none">
          {visibleServices.map((s) => (
            <ServiceCard key={s.id} service={s} bookingBaseUrl={bookingBaseUrl} primaryColor={primaryColor} />
          ))}
        </div>
      )}

      <VitrineFilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        title="Filtrar serviços"
        primaryColor={primaryColor}
        professionals={professionalOptions}
        value={filter}
        onApply={setFilter}
      />
    </section>
  )
}
