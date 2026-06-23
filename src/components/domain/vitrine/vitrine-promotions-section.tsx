'use client'

import { useEffect, useMemo, useState } from 'react'
import { Flame, Filter, Timer } from 'lucide-react'
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
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-600">
      <Timer className="size-2.5" />
      {remaining}
    </span>
  )
}

function PromotionCard({
  promo,
  bookingBaseUrl,
  primaryColor,
}: {
  promo: PublicPromotion
  bookingBaseUrl: string
  primaryColor: string
}) {
  const { openDetail } = useVitrineInteraction()
  const first = promo.services[0]
  const finalPrice = first ? calcFinalPrice(first.originalPrice, promo.discountType, promo.discountValue) : null

  function handleOpenDetail() {
    openDetail({
      kind: 'promotion',
      id: promo.id,
      name: promo.name,
      imageUrl: promo.imageUrl,
      description: promo.description,
      priceLabel: finalPrice != null ? `R$ ${finalPrice.toFixed(2)}` : badgeLabel(promo),
      originalPriceLabel: first ? `R$ ${first.originalPrice.toFixed(2)}` : null,
      badge: badgeLabel(promo),
      includedNames: promo.services.map((s) => s.name),
      includedServiceIds: promo.services.map((s) => s.id),
      bookingHref: bookingBaseUrl,
    })
  }

  return (
    <div className="relative w-32 shrink-0 overflow-hidden rounded-2xl bg-card shadow-sm sm:w-36">
      <button onClick={handleOpenDetail} className="flex w-full flex-col text-left" aria-label={`Ver detalhes de ${promo.name}`}>
        <div className="flex h-24 w-full items-center justify-center overflow-hidden bg-muted">
          {promo.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={promo.imageUrl} alt={promo.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-2xl">🎉</span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-2.5">
          <p className="text-xs font-semibold leading-snug line-clamp-2">{promo.name}</p>
          {promo.endsAt ? <Countdown endsAt={promo.endsAt} /> : (
            <span className="text-[10px] text-muted-foreground">Tempo limitado</span>
          )}
        </div>
      </button>

      <span
        className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-bold text-white"
        style={{ backgroundColor: primaryColor }}
      >
        {badgeLabel(promo)}
      </span>

      <p className="px-2.5 pb-2.5 text-xs font-bold" style={{ color: primaryColor }}>
        {finalPrice != null ? `R$ ${finalPrice.toFixed(2)}` : badgeLabel(promo)}
      </p>
    </div>
  )
}

export function VitrinePromotionsSection({ promotions, bookingBaseUrl, primaryColor }: Props) {
  const [filter, setFilter] = useState<VitrineFilterState>(EMPTY_FILTER_STATE)
  const [filterOpen, setFilterOpen] = useState(false)

  const filtered = useMemo(
    () => promotions.filter((p) => matchesPriceRange(minFinalPrice(p), filter.priceRange)),
    [promotions, filter],
  )

  if (promotions.length === 0) return null

  const activeFilters = countActiveFilters(filter)

  return (
    <section id="promocoes" className="mx-auto max-w-3xl px-4 pt-8">
      <div className="mb-4 flex items-center justify-between">
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
        <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">
          Nenhuma promoção encontrada com esse filtro.
        </p>
      ) : (
        <div className="flex min-w-0 touch-pan-x gap-3 overflow-x-auto overscroll-x-contain pb-1 scrollbar-none">
          {filtered.map((promo) => (
            <PromotionCard key={promo.id} promo={promo} bookingBaseUrl={bookingBaseUrl} primaryColor={primaryColor} />
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
