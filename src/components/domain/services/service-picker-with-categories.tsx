'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDuration } from '@/lib/format-duration'
import { Input } from '@/components/ui/input'
import { EntityImage } from '@/components/domain/shared/entity-image'

export type PickerService = {
  id: string
  name: string
  duration: number
  price: string | number
  priceType?: string
  priceMax?: string | number | null
  description?: string | null
  imageUrl?: string | null
  imageCropX?: number | null
  imageCropY?: number | null
  imageCropZoom?: number | null
  categoryId?: string | null
  categoryName?: string | null
  category?: { id: string; name: string } | null
}

export type PickerPackage = {
  id: string
  name: string
  description?: string | null
  price: string | number
  imageUrl?: string | null
  imageCropX?: number | null
  imageCropY?: number | null
  imageCropZoom?: number | null
  items: Array<{ service: { id: string; name: string; duration: number } }>
}

export type PickerPromotion = {
  id: string
  name: string
  description?: string | null
  discountType: 'PERCENTAGE' | 'FIXED'
  discountValue: string | number
  imageUrl?: string | null
  imageCropX?: number | null
  imageCropY?: number | null
  imageCropZoom?: number | null
  items: Array<{
    serviceId: string | null
    service: { id: string; name: string; price: string | number; duration?: number } | null
  }>
}

export type PickerSelection =
  | { type: 'service'; item: PickerService }
  | { type: 'package'; item: PickerPackage }
  | { type: 'promotion'; promotionId: string; service: { id: string; name: string; price: number; duration: number } }

type Category = {
  id: string
  name: string
}

type Props = {
  services: PickerService[]
  packages?: PickerPackage[]
  promotions?: PickerPromotion[]
  categories: Category[]
  selectedId?: string | null
  onSelect: (selection: PickerSelection) => void
}

const PACOTE_ID = '__pacote__'
const PROMO_ID = '__promo__'
const OUTROS_ID = '__outros__'

function normalize(text: string): string {
  return text
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export function ServicePickerWithCategories({ services, packages = [], promotions = [], categories, selectedId, onSelect }: Props) {
  const [search, setSearch] = useState('')
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)

  function formatPrice(price: string | number, priceType?: string): string {
    const num = Number(price)
    const formatted = num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    if (priceType === 'STARTING_FROM') return `A partir de ${formatted}`
    return formatted
  }

  const uncategorized = services.filter((s) => !s.categoryId)
  const categorized = categories.filter((cat) => services.some((s) => s.categoryId === cat.id))

  const chips: Array<{ id: string | null; label: string }> = [
    { id: null, label: 'Todos' },
    ...categorized.map((cat) => ({ id: cat.id, label: cat.name })),
    ...(uncategorized.length > 0 ? [{ id: OUTROS_ID, label: 'Outros' }] : []),
    ...(packages.length > 0 ? [{ id: PACOTE_ID, label: 'Pacote' }] : []),
    ...(promotions.length > 0 ? [{ id: PROMO_ID, label: 'Promoção' }] : []),
  ]

  const isSearching = search.trim().length > 0
  const term = normalize(search.trim())

  const visibleServices = useMemo(() => {
    if (activeCategoryId === PACOTE_ID || activeCategoryId === PROMO_ID) return []
    if (isSearching) {
      return services.filter(
        (s) => normalize(s.name).includes(term) || (s.description ? normalize(s.description).includes(term) : false),
      )
    }
    if (activeCategoryId === null) return services
    if (activeCategoryId === OUTROS_ID) return uncategorized
    return services.filter((s) => s.categoryId === activeCategoryId)
  }, [isSearching, term, services, activeCategoryId, uncategorized])

  const visiblePackages = useMemo(() => {
    if (activeCategoryId !== null && activeCategoryId !== PACOTE_ID) return []
    if (isSearching) return packages.filter((p) => normalize(p.name).includes(term))
    return packages
  }, [isSearching, term, packages, activeCategoryId])

  const visiblePromotions = useMemo(() => {
    if (activeCategoryId !== null && activeCategoryId !== PROMO_ID) return []
    if (isSearching) return promotions.filter((p) => normalize(p.name).includes(term))
    return promotions
  }, [isSearching, term, promotions, activeCategoryId])

  function renderServiceCard(service: PickerService) {
    const isSelected = selectedId === service.id
    return (
      <button
        key={service.id}
        type="button"
        onClick={() => onSelect({ type: 'service', item: service })}
        className={cn(
          'group relative flex w-32 shrink-0 flex-col overflow-hidden rounded-2xl border text-left transition-all sm:w-36',
          isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border/50 hover:border-primary/40',
        )}
      >
        <EntityImage
          src={service.imageUrl}
          alt={service.name}
          shape="portrait"
          cropX={service.imageCropX}
          cropY={service.imageCropY}
          cropZoom={service.imageCropZoom}
          className="w-full rounded-none"
          fallback={<span className="text-2xl text-muted-foreground/30">✂</span>}
        />
        <div className="flex flex-1 flex-col gap-1 p-3">
          <span className="text-sm font-medium leading-tight line-clamp-2">{service.name}</span>
          {service.description && (
            <span className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-line">{service.description}</span>
          )}
          <div className="mt-auto pt-1">
            <span className="text-xs font-semibold text-primary">{formatPrice(service.price, service.priceType)}</span>
            <span className="block text-xs text-muted-foreground">{formatDuration(service.duration)}</span>
          </div>
        </div>
        {isSelected && (
          <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
            <span className="text-[10px] text-primary-foreground">✓</span>
          </div>
        )}
      </button>
    )
  }

  function renderPackageCard(pkg: PickerPackage) {
    const totalDuration = pkg.items.reduce((s, i) => s + i.service.duration, 0)
    const isSelected = selectedId === pkg.id
    return (
      <button
        key={pkg.id}
        type="button"
        onClick={() => onSelect({ type: 'package', item: pkg })}
        className={cn(
          'w-full text-left rounded-2xl border p-4 transition-all',
          isSelected ? 'border-primary ring-2 ring-primary/20 bg-white' : 'border-border/50 bg-white hover:border-primary/40',
        )}
      >
        <div className="flex items-start gap-3">
          {pkg.imageUrl && (
            <EntityImage
              src={pkg.imageUrl}
              alt={pkg.name}
              shape="portrait"
              cropX={pkg.imageCropX}
              cropY={pkg.imageCropY}
              cropZoom={pkg.imageCropZoom}
              className="w-14 shrink-0 rounded-xl"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-medium text-slate-900">{pkg.name}</p>
            {pkg.description && (
              <p className="text-xs text-slate-500 mt-0.5 whitespace-pre-line line-clamp-2">{pkg.description}</p>
            )}
            <p className="text-xs text-slate-500 mt-1">
              {pkg.items.map((i) => i.service.name).join(' + ')}
              {' · '}
              {formatDuration(totalDuration)}
            </p>
            <p className="text-sm font-semibold text-primary mt-1">{formatPrice(pkg.price)}</p>
          </div>
        </div>
      </button>
    )
  }

  function renderPromotionCard(promo: PickerPromotion) {
    const serviceItems = promo.items.filter((i) => i.service !== null)
    return (
      <div key={promo.id} className="rounded-2xl border border-border/50 bg-white p-4">
        <div className="mb-2">
          <p className="font-medium text-slate-900">{promo.name}</p>
          {promo.description && (
            <p className="text-xs text-slate-500 mt-0.5 whitespace-pre-line">{promo.description}</p>
          )}
          <p className="text-xs text-emerald-600 mt-0.5">
            {promo.discountType === 'PERCENTAGE' ? `${promo.discountValue}% de desconto` : `R$ ${Number(promo.discountValue).toFixed(2)} de desconto`}
          </p>
        </div>
        <div className="space-y-2">
          {serviceItems.map((item) => {
            if (!item.service || !item.serviceId) return null
            const originalPrice = Number(item.service.price)
            const discountedPrice = promo.discountType === 'PERCENTAGE'
              ? originalPrice * (1 - Number(promo.discountValue) / 100)
              : Math.max(0, originalPrice - Number(promo.discountValue))
            return (
              <button
                key={item.serviceId}
                type="button"
                onClick={() => onSelect({
                  type: 'promotion',
                  promotionId: promo.id,
                  service: {
                    id: item.serviceId!,
                    name: item.service!.name,
                    price: discountedPrice,
                    duration: item.service!.duration ?? 0,
                  },
                })}
                className="w-full text-left rounded-xl border border-slate-100 p-3 hover:border-primary/40 transition-all"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-900">{item.service.name}</span>
                  <span className="shrink-0 text-sm font-semibold text-emerald-600">
                    R$ {discountedPrice.toFixed(2).replace('.', ',')}
                  </span>
                </div>
                <span className="text-xs text-slate-400 line-through">
                  R$ {originalPrice.toFixed(2).replace('.', ',')}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const hasResults = visibleServices.length > 0 || visiblePackages.length > 0 || visiblePromotions.length > 0

  return (
    <div className="min-w-0 space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar serviço..."
          className="pl-9"
        />
      </div>

      {!isSearching && chips.length > 1 && (
        <div className="flex min-w-0 touch-pan-x gap-2 overflow-x-auto overscroll-x-contain pb-1 scrollbar-none">
          {chips.map((chip) => (
            <button
              key={chip.id ?? 'all'}
              type="button"
              onClick={() => setActiveCategoryId(chip.id)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                activeCategoryId === chip.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-muted-foreground hover:border-primary/50',
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {!hasResults ? (
        <p className="text-center text-sm text-muted-foreground py-6">
          {isSearching ? `Nenhum item encontrado para "${search.trim()}".` : 'Nenhum item disponível.'}
        </p>
      ) : (
        <div className="space-y-3">
          {visibleServices.length > 0 && (
            <div className="flex min-w-0 touch-pan-x gap-3 overflow-x-auto overscroll-x-contain pb-1 scrollbar-none">
              {visibleServices.map((s) => renderServiceCard(s))}
            </div>
          )}
          {visiblePackages.length > 0 && (
            <div className="space-y-2">
              {visiblePackages.map((p) => renderPackageCard(p))}
            </div>
          )}
          {visiblePromotions.length > 0 && (
            <div className="space-y-3">
              {visiblePromotions.map((p) => renderPromotionCard(p))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
