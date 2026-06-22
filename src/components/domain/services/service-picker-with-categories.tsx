'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDuration } from '@/lib/format-duration'
import { Input } from '@/components/ui/input'

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
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  function formatPrice(s: PickerService): string {
    const num = Number(s.price)
    const formatted = num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    if (s.priceType === 'STARTING_FROM') return `A partir de ${formatted}`
    return formatted
  }

  const categorized = categories.filter((cat) =>
    services.some((s) => getServiceCategoryId(s) === cat.id),
  )
  const uncategorized = services.filter((s) => !getServiceCategoryId(s))

  const sections = useMemo(() => {
    const list = categorized.map((cat) => ({
      id: cat.id,
      label: cat.name,
      services: services.filter((s) => getServiceCategoryId(s) === cat.id),
    }))
    if (uncategorized.length > 0) {
      list.push({ id: OUTROS_ID, label: 'Outros', services: uncategorized })
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorized, uncategorized, services])

  const isSearching = search.trim().length > 0

  const searchResults = useMemo(() => {
    if (!isSearching) return []
    const term = normalize(search.trim())
    return services.filter(
      (s) =>
        normalize(s.name).includes(term) ||
        (s.description ? normalize(s.description).includes(term) : false),
    )
  }, [services, search, isSearching])

  useEffect(() => {
    if (isSearching) return
    if (typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      (entries) => {
        const mostVisible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (mostVisible?.target instanceof HTMLElement) {
          setActiveCategoryId(mostVisible.target.dataset.sectionId ?? null)
        }
      },
      { threshold: [0.3, 0.5, 0.7] },
    )

    sectionRefs.current.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [isSearching, sections])

  function scrollToSection(id: string | null) {
    setActiveCategoryId(id)
    const targetId = id ?? sections[0]?.id
    if (!targetId) return
    sectionRefs.current.get(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function renderCard(service: PickerService, widthClassName: string) {
    const isSelected = selectedId === service.id
    return (
      <button
        key={service.id}
        type="button"
        onClick={() => onSelect(service)}
        className={cn(
          'group relative flex flex-col overflow-hidden rounded-2xl border text-left transition-all',
          widthClassName,
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
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar serviço..."
          className="pl-9"
        />
      </div>

      {!isSearching && sections.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => scrollToSection(null)}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              activeCategoryId === null
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-muted-foreground hover:border-primary/50',
            )}
          >
            Todos
          </button>
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => scrollToSection(section.id)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                activeCategoryId === section.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-muted-foreground hover:border-primary/50',
              )}
            >
              {section.label}
            </button>
          ))}
        </div>
      )}

      {isSearching ? (
        searchResults.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">
            Nenhum serviço encontrado para &quot;{search.trim()}&quot;.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {searchResults.map((service) => renderCard(service, ''))}
          </div>
        )
      ) : sections.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-6">Nenhum serviço disponível.</p>
      ) : (
        <div className="space-y-5">
          {sections.map((section) => (
            <div
              key={section.id}
              data-section-id={section.id}
              ref={(el) => {
                if (el) sectionRefs.current.set(section.id, el)
                else sectionRefs.current.delete(section.id)
              }}
            >
              <h4 className="mb-2 text-sm font-semibold text-foreground">{section.label}</h4>
              <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
                {section.services.map((service) => renderCard(service, 'w-32 shrink-0 sm:w-36'))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
