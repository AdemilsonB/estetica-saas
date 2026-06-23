'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Flame, Heart, Filter, Timer } from 'lucide-react'
import { useVitrineInteraction } from './vitrine-interaction-context'
import {
  VitrineFilterSheet,
  EMPTY_FILTER_STATE,
  matchesPriceRange,
  countActiveFilters,
  type VitrineFilterState,
} from './vitrine-filter-sheet'

type PromoService = {
  id: string
  name: string
  duration: number
  originalPrice: number
}

type PublicPromotion = {
  id: string
  name: string
  description?: string | null
  imageUrl?: string | null
  discountType: 'PERCENTAGE' | 'FIXED'
  discountValue: number
  endsAt?: string | null
  services: PromoService[]
}

type Props = {
  promotions: PublicPromotion[]
  bookingBaseUrl: string
  primaryColor: string
}

function calcFinalPrice(original: number, type: 'PERCENTAGE' | 'FIXED', value: number): number {
  if (type === 'PERCENTAGE') return Math.max(0, original * (1 - value / 100))
  return Math.max(0, original - value)
}

function badgeLabel(promo: PublicPromotion): string {
  return promo.discountType === 'PERCENTAGE' ? `${promo.discountValue}% OFF` : `R$ ${promo.discountValue.toFixed(2)} OFF`
}

function minFinalPrice(promo: PublicPromotion): number {
  if (promo.services.length === 0) return 0
  return Math.min(...promo.services.map((s) => calcFinalPrice(s.originalPrice, promo.discountType, promo.discountValue)))
}

function Countdown({ endsAt }: { endsAt: string }) {
  const [remaining, setRemaining] = useState('')

  useEffect(() => {
    function update() {
      const diff = new Date(endsAt).getTime() - Date.now()
      if (diff <= 0) { setRemaining('Encerrada'); return }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      if (d > 0) setRemaining(`${d}d ${h}h`)
      else setRemaining(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [endsAt])

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
      <Timer className="size-3" />
      {remaining}
    </span>
  )
}

function PromotionCard({
  promo,
  bookingBaseUrl,
  primaryColor,
  isFavorite,
  onToggleFavorite,
}: {
  promo: PublicPromotion
  bookingBaseUrl: string
  primaryColor: string
  isFavorite: boolean
  onToggleFavorite: () => void
}) {
  const { openDetail } = useVitrineInteraction()

  function handleOpenDetail() {
    const first = promo.services[0]
    openDetail({
      kind: 'promotion',
      id: promo.id,
      name: promo.name,
      imageUrl: promo.imageUrl,
      description: promo.description,
      priceLabel: first ? `R$ ${calcFinalPrice(first.originalPrice, promo.discountType, promo.discountValue).toFixed(2)}` : badgeLabel(promo),
      originalPriceLabel: first ? `R$ ${first.originalPrice.toFixed(2)}` : null,
      badge: badgeLabel(promo),
      includedNames: promo.services.map((s) => s.name),
      includedServiceIds: promo.services.map((s) => s.id),
      bookingHref: bookingBaseUrl,
    })
  }

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <div className="flex gap-3 p-3">
        <button
          onClick={handleOpenDetail}
          className="size-[72px] shrink-0 overflow-hidden rounded-xl bg-muted flex items-center justify-center"
          aria-label={`Ver detalhes de ${promo.name}`}
        >
          {promo.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={promo.imageUrl} alt={promo.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-2xl">🎉</span>
          )}
        </button>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-start justify-between gap-1">
            <button onClick={handleOpenDetail} className="text-left text-sm font-semibold leading-snug">
              {promo.name}
            </button>
            <div className="flex shrink-0 items-center gap-1.5">
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
                style={{ backgroundColor: primaryColor }}
              >
                {badgeLabel(promo)}
              </span>
              <button
                onClick={onToggleFavorite}
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

          {promo.description && (
            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{promo.description}</p>
          )}

          {promo.services.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {promo.services.slice(0, 3).map((s) => {
                const final = calcFinalPrice(s.originalPrice, promo.discountType, promo.discountValue)
                return (
                  <p key={s.id} className="text-xs text-muted-foreground">
                    {s.name}:{' '}
                    <span className="line-through">R$ {s.originalPrice.toFixed(2)}</span>
                    {' → '}
                    <span className="font-semibold" style={{ color: primaryColor }}>
                      R$ {final.toFixed(2)}
                    </span>
                  </p>
                )
              })}
            </div>
          )}

          <div className="mt-1.5 flex items-center justify-between gap-2">
            {promo.endsAt && <Countdown endsAt={promo.endsAt} />}
            {!promo.endsAt && <span className="text-[10px] text-muted-foreground">Tempo limitado</span>}
            <Link
              href={bookingBaseUrl}
              className="inline-flex h-8 items-center justify-center rounded-xl px-4 text-xs font-semibold text-white"
              style={{ backgroundColor: primaryColor }}
            >
              Aproveitar
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export function VitrinePromotionsSection({ promotions, bookingBaseUrl, primaryColor }: Props) {
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
    () => promotions.filter((p) => matchesPriceRange(minFinalPrice(p), filter.priceRange)),
    [promotions, filter],
  )

  if (promotions.length === 0) return null

  const activeFilters = countActiveFilters(filter)

  return (
    <section id="promocoes" className="mx-auto max-w-3xl px-4 pt-8">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Flame className="size-5 text-orange-500" />
          Promoções
        </h2>
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
          Nenhuma promoção encontrada com esse filtro.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((promo) => (
            <PromotionCard
              key={promo.id}
              promo={promo}
              bookingBaseUrl={bookingBaseUrl}
              primaryColor={primaryColor}
              isFavorite={favorites.has(promo.id)}
              onToggleFavorite={() => toggleFavorite(promo.id)}
            />
          ))}
        </div>
      )}

      <VitrineFilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        title="Filtrar promoções"
        primaryColor={primaryColor}
        value={filter}
        onApply={setFilter}
      />
    </section>
  )
}
