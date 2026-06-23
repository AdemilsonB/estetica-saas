'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Clock, Filter, Heart } from 'lucide-react'
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
  price: number
  duration: number
  services: { id: string; name: string }[]
}

type Props = {
  packages: PublicPackage[]
  bookingBaseUrl: string
  primaryColor: string
}

function formatDuration(min: number): string {
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h${m}min` : `${h}h`
}

function PackageCard({
  pkg,
  bookingBaseUrl,
  primaryColor,
  isFavorite,
  onToggleFavorite,
}: {
  pkg: PublicPackage
  bookingBaseUrl: string
  primaryColor: string
  isFavorite: boolean
  onToggleFavorite: () => void
}) {
  const { openDetail } = useVitrineInteraction()

  function handleOpenDetail() {
    openDetail({
      kind: 'package',
      id: pkg.id,
      name: pkg.name,
      imageUrl: pkg.imageUrl,
      description: pkg.description,
      priceLabel: `R$ ${pkg.price.toFixed(2)}`,
      durationLabel: pkg.duration > 0 ? formatDuration(pkg.duration) : null,
      includedNames: pkg.services.map((s) => s.name),
      includedServiceIds: pkg.services.map((s) => s.id),
      bookingHref: `${bookingBaseUrl}?packageId=${pkg.id}`,
    })
  }

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <div className="flex gap-3 p-3">
        <button
          onClick={handleOpenDetail}
          className="size-[72px] shrink-0 overflow-hidden rounded-xl bg-muted flex items-center justify-center"
          aria-label={`Ver detalhes de ${pkg.name}`}
        >
          {pkg.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pkg.imageUrl} alt={pkg.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-2xl">📦</span>
          )}
        </button>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            <button onClick={handleOpenDetail} className="text-left text-sm font-semibold leading-snug">
              {pkg.name}
            </button>
            <button
              onClick={onToggleFavorite}
              aria-label={isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
              className="flex size-9 shrink-0 items-center justify-center rounded-full"
            >
              <Heart
                className="size-4"
                style={{ fill: isFavorite ? '#e0436b' : 'none', stroke: isFavorite ? '#e0436b' : '#b94a6c' }}
              />
            </button>
          </div>
          <p className="text-xs">
            <span className="font-medium" style={{ color: primaryColor }}>
              R$ {pkg.price.toFixed(2)}
            </span>
            {pkg.duration > 0 && (
              <span className="text-muted-foreground">
                {' · '}
                <Clock className="inline size-3" /> {formatDuration(pkg.duration)}
              </span>
            )}
          </p>

          {pkg.description && (
            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{pkg.description}</p>
          )}

          {pkg.services.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {pkg.services.map((s) => (
                <span key={s.id} className="rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {s.name}
                </span>
              ))}
            </div>
          )}

          <Link
            href={`${bookingBaseUrl}?packageId=${pkg.id}`}
            className="mt-1.5 inline-flex h-8 w-full items-center justify-center rounded-xl text-xs font-semibold text-white"
            style={{ backgroundColor: primaryColor }}
          >
            Agendar pacote
          </Link>
        </div>
      </div>
    </div>
  )
}

export function VitrinePackagesSection({ packages, bookingBaseUrl, primaryColor }: Props) {
  const [filter, setFilter] = useState<VitrineFilterState>(EMPTY_FILTER_STATE)
  const [filterOpen, setFilterOpen] = useState(false)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())

  function toggleFavorite(id: string) {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filtered = useMemo(
    () => packages.filter((p) => matchesPriceRange(p.price, filter.priceRange)),
    [packages, filter],
  )

  if (packages.length === 0) return null

  const activeFilters = countActiveFilters(filter)

  return (
    <section id="pacotes" className="mx-auto max-w-3xl px-4 pt-8">
      <div className="mb-5 flex items-center justify-between">
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
        <p className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
          Nenhum pacote encontrado com esse filtro.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((pkg) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              bookingBaseUrl={bookingBaseUrl}
              primaryColor={primaryColor}
              isFavorite={favorites.has(pkg.id)}
              onToggleFavorite={() => toggleFavorite(pkg.id)}
            />
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
