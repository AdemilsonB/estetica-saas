'use client'

import { useMemo, useState } from 'react'
import { Filter, Heart } from 'lucide-react'
import { formatDuration } from '@/lib/format-duration'
import { EntityImage } from '@/components/domain/shared/entity-image'
import { useVitrineInteraction } from './vitrine-interaction-context'
import {
  VitrineFilterSheet,
  EMPTY_FILTER_STATE,
  matchesPriceRange,
  countActiveFilters,
  type VitrineFilterState,
} from './vitrine-filter-sheet'

type PublicPackage = {
  id: string
  name: string
  description?: string | null
  imageUrl?: string | null
  imageCropX?: number | null
  imageCropY?: number | null
  imageCropZoom?: number | null
  price: number
  duration: number
  services: { id: string; name: string }[]
}

type Props = {
  packages: PublicPackage[]
  bookingBaseUrl: string
  primaryColor: string
}

function PackageCard({
  pkg,
  bookingBaseUrl,
  primaryColor,
}: {
  pkg: PublicPackage
  bookingBaseUrl: string
  primaryColor: string
}) {
  const { openDetail, isFavorited, toggleFavorite } = useVitrineInteraction()
  const isFavorite = isFavorited('package', pkg.id)

  function handleOpenDetail() {
    openDetail({
      kind: 'package',
      id: pkg.id,
      name: pkg.name,
      imageUrl: pkg.imageUrl,
      imageCropX: pkg.imageCropX,
      imageCropY: pkg.imageCropY,
      imageCropZoom: pkg.imageCropZoom,
      description: pkg.description,
      priceLabel: `R$ ${pkg.price.toFixed(2)}`,
      durationLabel: pkg.duration > 0 ? formatDuration(pkg.duration) : null,
      includedNames: pkg.services.map((s) => s.name),
      includedServiceIds: pkg.services.map((s) => s.id),
      bookingHref: `${bookingBaseUrl}?packageId=${pkg.id}`,
    })
  }

  return (
    <div className="relative w-32 shrink-0 overflow-hidden rounded-2xl bg-card shadow-sm sm:w-36">
      <button onClick={handleOpenDetail} className="flex w-full flex-col text-left" aria-label={`Ver detalhes de ${pkg.name}`}>
        <EntityImage
          src={pkg.imageUrl}
          alt={pkg.name}
          shape="portrait"
          cropX={pkg.imageCropX}
          cropY={pkg.imageCropY}
          cropZoom={pkg.imageCropZoom}
          className="w-full rounded-none"
          fallback={<span className="text-2xl">📦</span>}
        />
        <div className="flex flex-1 flex-col gap-1 p-2.5">
          <p className="text-xs font-semibold leading-snug line-clamp-2">{pkg.name}</p>
          {pkg.duration > 0 && <p className="text-[11px] text-muted-foreground">{formatDuration(pkg.duration)}</p>}
        </div>
      </button>

      <button
        onClick={() => toggleFavorite('package', pkg.id)}
        aria-label={isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
        className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-background/90"
      >
        <Heart
          className="size-3.5"
          style={{ fill: isFavorite ? '#e0436b' : 'none', stroke: isFavorite ? '#e0436b' : '#b94a6c' }}
        />
      </button>

      <p className="px-2.5 pb-2.5 text-xs font-bold" style={{ color: primaryColor }}>
        R$ {pkg.price.toFixed(2)}
      </p>
    </div>
  )
}

export function VitrinePackagesSection({ packages, bookingBaseUrl, primaryColor }: Props) {
  const [filter, setFilter] = useState<VitrineFilterState>(EMPTY_FILTER_STATE)
  const [filterOpen, setFilterOpen] = useState(false)

  const filtered = useMemo(
    () => packages.filter((p) => matchesPriceRange(p.price, filter.priceRange)),
    [packages, filter],
  )

  if (packages.length === 0) return null

  const activeFilters = countActiveFilters(filter)

  return (
    <section id="pacotes" className="mx-auto max-w-3xl px-4 pt-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">Pacotes</h2>
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

      {filtered.length === 0 ? (
        <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">
          Nenhum pacote encontrado com esse filtro.
        </p>
      ) : (
        <div className="flex min-w-0 gap-3 overflow-x-auto overscroll-x-contain pb-1 scrollbar-none">
          {filtered.map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} bookingBaseUrl={bookingBaseUrl} primaryColor={primaryColor} />
          ))}
        </div>
      )}

      <VitrineFilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        title="Filtrar pacotes"
        primaryColor={primaryColor}
        value={filter}
        onApply={setFilter}
      />
    </section>
  )
}
