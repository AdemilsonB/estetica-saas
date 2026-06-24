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

type Category = {
  id: string
  name: string
}

type Props = {
  services: PickerService[]
  categories: Category[]
  selectedId?: string | null
  onSelect: (service: PickerService) => void
}

const OUTROS_ID = '__outros__'

function normalize(text: string): string {
  return text
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

function getServiceCategoryId(s: PickerService): string | null {
  return s.categoryId ?? null
}

export function ServicePickerWithCategories({ services, categories, selectedId, onSelect }: Props) {
  const [search, setSearch] = useState('')
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)

  function formatPrice(s: PickerService): string {
    const num = Number(s.price)
    const formatted = num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    if (s.priceType === 'STARTING_FROM') return `A partir de ${formatted}`
    return formatted
  }

  const uncategorized = services.filter((s) => !getServiceCategoryId(s))
  const categorized = categories.filter((cat) =>
    services.some((s) => getServiceCategoryId(s) === cat.id),
  )

  const chips: Array<{ id: string | null; label: string }> = [
    { id: null, label: 'Todos' },
    ...categorized.map((cat) => ({ id: cat.id, label: cat.name })),
    ...(uncategorized.length > 0 ? [{ id: OUTROS_ID, label: 'Outros' }] : []),
  ]

  const isSearching = search.trim().length > 0

  const visibleServices = useMemo(() => {
    if (isSearching) {
      const term = normalize(search.trim())
      return services.filter(
        (s) =>
          normalize(s.name).includes(term) ||
          (s.description ? normalize(s.description).includes(term) : false),
      )
    }
    if (activeCategoryId === null) return services
    if (activeCategoryId === OUTROS_ID) return uncategorized
    return services.filter((s) => getServiceCategoryId(s) === activeCategoryId)
  }, [isSearching, search, services, activeCategoryId, uncategorized])

  function renderCard(service: PickerService) {
    const isSelected = selectedId === service.id
    return (
      <button
        key={service.id}
        type="button"
        onClick={() => onSelect(service)}
        className={cn(
          'group relative flex w-32 shrink-0 flex-col overflow-hidden rounded-2xl border text-left transition-all sm:w-36',
          isSelected
            ? 'border-primary ring-2 ring-primary/20'
            : 'border-border/50 hover:border-primary/40',
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
            <span className="text-xs text-muted-foreground line-clamp-2">{service.description}</span>
          )}
          <div className="mt-auto pt-1">
            <span className="text-xs font-semibold text-primary">{formatPrice(service)}</span>
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

      {visibleServices.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-6">
          {isSearching
            ? `Nenhum serviço encontrado para "${search.trim()}".`
            : 'Nenhum serviço disponível.'}
        </p>
      ) : (
        <div className="flex min-w-0 touch-pan-x gap-3 overflow-x-auto overscroll-x-contain pb-1 scrollbar-none">
          {visibleServices.map((service) => renderCard(service))}
        </div>
      )}
    </div>
  )
}
