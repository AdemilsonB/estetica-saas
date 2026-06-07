'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { formatDuration } from '@/lib/format-duration'

export type PickerService = {
  id: string
  name: string
  duration: number
  price: string | number
  priceType?: string
  priceMax?: string | number | null
  description?: string | null
  imageUrl?: string | null
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

export function ServicePickerWithCategories({ services, categories, selectedId, onSelect }: Props) {
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)

  function getServiceCategoryId(s: PickerService): string | null {
    return s.categoryId ?? null
  }

  const categorized = categories.filter((cat) =>
    services.some((s) => getServiceCategoryId(s) === cat.id)
  )
  const uncategorized = services.filter((s) => !getServiceCategoryId(s))

  const allChips: Array<{ id: string | null; label: string }> = [
    ...categorized.map((c) => ({ id: c.id, label: c.name })),
    ...(uncategorized.length > 0 ? [{ id: '__outros__', label: 'Outros' }] : []),
  ]

  const visibleServices = activeCategoryId === null
    ? services
    : activeCategoryId === '__outros__'
      ? uncategorized
      : services.filter((s) => getServiceCategoryId(s) === activeCategoryId)

  function formatPrice(s: PickerService): string {
    const num = Number(s.price)
    const formatted = num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    if (s.priceType === 'STARTING_FROM') return `A partir de ${formatted}`
    return formatted
  }

  return (
    <div className="space-y-4">
      {allChips.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveCategoryId(null)}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              activeCategoryId === null
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-muted-foreground hover:border-primary/50',
            )}
          >
            Todos
          </button>
          {allChips.map((chip) => (
            <button
              key={chip.id}
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

      {visibleServices.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-6">Nenhum serviço disponível.</p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {visibleServices.map((service) => {
          const isSelected = selectedId === service.id
          return (
            <button
              key={service.id}
              type="button"
              onClick={() => onSelect(service)}
              className={cn(
                'group relative flex flex-col overflow-hidden rounded-2xl border text-left transition-all',
                isSelected
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'border-border/50 hover:border-primary/40',
              )}
            >
              {service.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={service.imageUrl}
                  alt={service.name}
                  className="h-28 w-full object-cover"
                />
              ) : (
                <div className="h-28 w-full bg-muted/40 flex items-center justify-center">
                  <span className="text-2xl text-muted-foreground/30">✂</span>
                </div>
              )}
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
        })}
      </div>
    </div>
  )
}
