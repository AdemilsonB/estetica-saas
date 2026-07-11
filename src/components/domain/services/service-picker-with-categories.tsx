'use client'

import { useMemo, useState } from 'react'
import { Eye, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDuration } from '@/lib/format-duration'
import { Input } from '@/components/ui/input'
import { EntityImage } from '@/components/domain/shared/entity-image'
import { PickerDetailModal, type PickerDetailItem } from './picker-detail-modal'

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

const PACOTES_PROMO_ID = '__pacotes_promocoes__'
const OUTROS_ID = '__outros__'

function normalize(text: string): string {
  return text
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export function formatCurrency(value: string | number): string {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatPrice(price: string | number, priceType?: string): string {
  const formatted = formatCurrency(price)
  if (priceType === 'STARTING_FROM') return `A partir de ${formatted}`
  return formatted
}

export type PromoPricedItem = {
  serviceId: string
  service: { id: string; name: string; price: string | number; duration?: number }
  originalPrice: number
  discountedPrice: number
}

export function computePromotionPricing(promo: PickerPromotion): PromoPricedItem[] {
  return promo.items
    .filter(
      (i): i is { serviceId: string; service: NonNullable<PickerPromotion['items'][number]['service']> } =>
        i.service !== null && i.serviceId !== null,
    )
    .map((item) => {
      const originalPrice = Number(item.service.price)
      const discountedPrice = promo.discountType === 'PERCENTAGE'
        ? originalPrice * (1 - Number(promo.discountValue) / 100)
        : Math.max(0, originalPrice - Number(promo.discountValue))
      return { serviceId: item.serviceId, service: item.service, originalPrice, discountedPrice }
    })
}

export function cheapestPromotionOption(promo: PickerPromotion): PromoPricedItem | null {
  const priced = computePromotionPricing(promo)
  if (priced.length === 0) return null
  return priced.reduce((min, w) => (w.discountedPrice < min.discountedPrice ? w : min), priced[0])
}

export function ServicePickerWithCategories({ services, packages = [], promotions = [], categories, selectedId, onSelect }: Props) {
  const [search, setSearch] = useState('')
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
  const [expandedPromoId, setExpandedPromoId] = useState<string | null>(null)
  const [detailItem, setDetailItem] = useState<PickerDetailItem | null>(null)

  const uncategorized = services.filter((s) => !s.categoryId)
  const categorized = categories.filter((cat) => services.some((s) => s.categoryId === cat.id))

  const chips: Array<{ id: string | null; label: string }> = [
    { id: null, label: 'Todos' },
    ...(packages.length > 0 || promotions.length > 0
      ? [{ id: PACOTES_PROMO_ID, label: 'Pacotes e Promoções' }]
      : []),
    ...categorized.map((cat) => ({ id: cat.id, label: cat.name })),
    ...(uncategorized.length > 0 ? [{ id: OUTROS_ID, label: 'Outros' }] : []),
  ]

  const isSearching = search.trim().length > 0
  const term = normalize(search.trim())

  const visibleServices = useMemo(() => {
    if (activeCategoryId === PACOTES_PROMO_ID) return []
    if (isSearching) {
      return services.filter(
        (s) => normalize(s.name).includes(term) || (s.description ? normalize(s.description).includes(term) : false),
      )
    }
    if (activeCategoryId === null) return services
    if (activeCategoryId === OUTROS_ID) return uncategorized
    return services.filter((s) => s.categoryId === activeCategoryId)
  }, [isSearching, term, services, activeCategoryId, uncategorized])

  // Pacotes e Promoções só entram na listagem quando o usuário filtra por eles
  // explicitamente (chip "Pacotes e Promoções") ou busca por nome — "Todos" mostra só Serviços.
  const visiblePackages = useMemo(() => {
    if (isSearching) return packages.filter((p) => normalize(p.name).includes(term))
    if (activeCategoryId !== PACOTES_PROMO_ID) return []
    return packages
  }, [isSearching, term, packages, activeCategoryId])

  const visiblePromotions = useMemo(() => {
    if (isSearching) return promotions.filter((p) => normalize(p.name).includes(term))
    if (activeCategoryId !== PACOTES_PROMO_ID) return []
    return promotions
  }, [isSearching, term, promotions, activeCategoryId])

  function renderEyeButton(label: string, onOpen: () => void) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onOpen()
        }}
        aria-label={label}
        className="group/eye absolute left-0 top-0 z-10 flex h-11 w-11 items-center justify-center"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors group-hover/eye:bg-black/60">
          <Eye className="size-3.5" />
        </span>
      </button>
    )
  }

  function renderServiceCard(service: PickerService) {
    const isSelected = selectedId === service.id
    return (
      <div key={service.id} className="relative w-32 shrink-0 sm:w-36">
        <button
          type="button"
          onClick={() => onSelect({ type: 'service', item: service })}
          className={cn(
            'group relative flex w-full flex-col overflow-hidden rounded-2xl border text-left transition-all',
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
            <div className="min-h-9">
              <span className="text-sm font-medium leading-tight line-clamp-2">{service.name}</span>
            </div>
            <div className="min-h-8">
              {service.description && (
                <span className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-line">{service.description}</span>
              )}
            </div>
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
        {renderEyeButton(`Ver detalhes de ${service.name}`, () => setDetailItem({ kind: 'service', data: service }))}
      </div>
    )
  }

  function renderPackageCard(pkg: PickerPackage) {
    const totalDuration = pkg.items.reduce((s, i) => s + i.service.duration, 0)
    const isSelected = selectedId === pkg.id
    return (
      <div key={pkg.id} className="relative w-32 shrink-0 sm:w-36">
        <button
          type="button"
          onClick={() => onSelect({ type: 'package', item: pkg })}
          className={cn(
            'group relative flex w-full flex-col overflow-hidden rounded-2xl border text-left transition-all',
            isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border/50 hover:border-primary/40',
          )}
        >
          <EntityImage
            src={pkg.imageUrl}
            alt={pkg.name}
            shape="portrait"
            cropX={pkg.imageCropX}
            cropY={pkg.imageCropY}
            cropZoom={pkg.imageCropZoom}
            className="w-full rounded-none"
            fallback={<span className="text-2xl text-muted-foreground/30">🎁</span>}
          />
          <div className="flex flex-1 flex-col gap-1 p-3">
            <div className="min-h-9">
              <span className="text-sm font-medium leading-tight line-clamp-2">{pkg.name}</span>
            </div>
            <div className="min-h-8">
              <span className="text-xs text-muted-foreground line-clamp-2">
                {pkg.items.map((i) => i.service.name).join(' + ')}
              </span>
            </div>
            <div className="mt-auto pt-1">
              <span className="text-xs font-semibold text-primary">{formatPrice(pkg.price)}</span>
              <span className="block text-xs text-muted-foreground">{formatDuration(totalDuration)}</span>
            </div>
          </div>
          {isSelected && (
            <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
              <span className="text-[10px] text-primary-foreground">✓</span>
            </div>
          )}
        </button>
        {renderEyeButton(`Ver detalhes de ${pkg.name}`, () => setDetailItem({ kind: 'package', data: pkg }))}
      </div>
    )
  }

  function renderPromotionCard(promo: PickerPromotion) {
    const priced = computePromotionPricing(promo)
    if (priced.length === 0) return null

    const cheapest = cheapestPromotionOption(promo)!
    const compositionLabel = priced.map((w) => w.service.name).join(' + ')
    const isSelected = priced.some((w) => selectedId === w.serviceId)
    const isExpanded = expandedPromoId === promo.id

    function selectDefault() {
      onSelect({
        type: 'promotion',
        promotionId: promo.id,
        service: {
          id: cheapest.serviceId,
          name: cheapest.service.name,
          price: cheapest.discountedPrice,
          duration: cheapest.service.duration ?? 0,
        },
      })
    }

    return (
      <div key={promo.id} className="w-32 shrink-0 sm:w-36">
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              if (isExpanded) {
                setExpandedPromoId(null)
                return
              }
              setExpandedPromoId(promo.id)
              if (!isSelected) selectDefault()
            }}
            className={cn(
              'group relative flex w-full flex-col overflow-hidden rounded-2xl border text-left transition-all',
              isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border/50 hover:border-primary/40',
            )}
          >
            <EntityImage
              src={promo.imageUrl}
              alt={promo.name}
              shape="portrait"
              cropX={promo.imageCropX}
              cropY={promo.imageCropY}
              cropZoom={promo.imageCropZoom}
              className="w-full rounded-none"
              fallback={<span className="text-2xl text-muted-foreground/30">%</span>}
            />
            <div className="flex flex-1 flex-col gap-1 p-3">
              <div className="min-h-9">
                <span className="text-sm font-medium leading-tight line-clamp-2">{promo.name}</span>
              </div>
              <div className="min-h-8">
                <span className="text-xs text-muted-foreground line-clamp-2">{compositionLabel}</span>
              </div>
              <div className="mt-auto pt-1">
                <span className="text-xs font-semibold text-emerald-600">A partir de {formatCurrency(cheapest.discountedPrice)}</span>
                <span className="block text-xs text-muted-foreground">{formatDuration(cheapest.service.duration ?? 0)}</span>
              </div>
            </div>
            {isSelected && (
              <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                <span className="text-[10px] text-primary-foreground">✓</span>
              </div>
            )}
          </button>
          {renderEyeButton(`Ver detalhes de ${promo.name}`, () => setDetailItem({ kind: 'promotion', data: promo }))}
        </div>

        {isExpanded && (
          <div className="mt-2 space-y-1.5">
            {priced.map(({ serviceId, service, originalPrice, discountedPrice }) => {
              const itemSelected = selectedId === serviceId
              return (
                <button
                  key={serviceId}
                  type="button"
                  onClick={() => onSelect({
                    type: 'promotion',
                    promotionId: promo.id,
                    service: {
                      id: serviceId,
                      name: service.name,
                      price: discountedPrice,
                      duration: service.duration ?? 0,
                    },
                  })}
                  className={cn(
                    'w-full min-h-11 rounded-xl border p-2.5 text-left transition-all',
                    itemSelected ? 'border-primary ring-1 ring-primary/20' : 'border-slate-100 hover:border-primary/40',
                  )}
                >
                  <span className="block text-xs font-medium text-slate-900 line-clamp-1">{service.name}</span>
                  <span className="text-xs font-semibold text-emerald-600">{formatCurrency(discountedPrice)}</span>{' '}
                  <span className="text-[11px] text-slate-400 line-through">{formatCurrency(originalPrice)}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const hasResults = visibleServices.length > 0 || visiblePackages.length > 0 || visiblePromotions.length > 0

  function handleSelectFromDetail(selection: PickerSelection) {
    setDetailItem(null)
    onSelect(selection)
  }

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
        <div className="flex min-w-0 touch-pan-x items-start gap-3 overflow-x-auto overscroll-x-contain pb-1 scrollbar-none">
          {visibleServices.map((s) => renderServiceCard(s))}
          {visiblePackages.map((p) => renderPackageCard(p))}
          {visiblePromotions.map((p) => renderPromotionCard(p))}
        </div>
      )}

      <PickerDetailModal item={detailItem} onClose={() => setDetailItem(null)} onSelect={handleSelectFromDetail} />
    </div>
  )
}
