'use client'

import { useEffect, useState } from 'react'
import { Sheet, SheetContent } from '@/components/ui/sheet'

export type FilterOption = { value: string; label: string }

export type VitrineFilterState = {
  category: string | null
  professional: string | null
  priceRange: string | null
}

export const EMPTY_FILTER_STATE: VitrineFilterState = { category: null, professional: null, priceRange: null }

const PRICE_RANGES: FilterOption[] = [
  { value: 'any', label: 'Qualquer' },
  { value: '0-100', label: 'Até R$100' },
  { value: '100-200', label: 'R$100–200' },
  { value: '200+', label: 'R$200+' },
]

export function matchesPriceRange(price: number, range: string | null): boolean {
  if (!range || range === 'any') return true
  if (range === '200+') return price >= 200
  const [min, max] = range.split('-').map(Number)
  return price >= (min ?? 0) && price <= (max ?? Infinity)
}

export function countActiveFilters(state: VitrineFilterState): number {
  return [state.category, state.professional, state.priceRange && state.priceRange !== 'any' ? state.priceRange : null].filter(
    Boolean,
  ).length
}

function Chip({
  active,
  onClick,
  primaryColor,
  children,
}: {
  active: boolean
  onClick: () => void
  primaryColor: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
      style={
        active
          ? { backgroundColor: `${primaryColor}1A`, borderColor: primaryColor, color: primaryColor }
          : { borderColor: 'var(--border)' }
      }
    >
      {children}
    </button>
  )
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  primaryColor: string
  categories?: FilterOption[]
  professionals?: FilterOption[]
  value: VitrineFilterState
  onApply: (next: VitrineFilterState) => void
}

export function VitrineFilterSheet({
  open,
  onOpenChange,
  title,
  primaryColor,
  categories,
  professionals,
  value,
  onApply,
}: Props) {
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    if (open) setDraft(value)
  }, [open, value])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl p-0"
      >
        <div className="px-5 pt-5">
          <h3 className="text-sm font-bold">{title}</h3>
        </div>

        {categories && categories.length > 0 && (
          <div className="px-5 pt-4">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">Categoria</p>
            <div className="flex flex-wrap gap-2">
              <Chip active={!draft.category} onClick={() => setDraft((d) => ({ ...d, category: null }))} primaryColor={primaryColor}>
                Todos
              </Chip>
              {categories.map((c) => (
                <Chip
                  key={c.value}
                  active={draft.category === c.value}
                  onClick={() => setDraft((d) => ({ ...d, category: c.value }))}
                  primaryColor={primaryColor}
                >
                  {c.label}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {professionals && professionals.length > 0 && (
          <div className="px-5 pt-4">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">Profissional</p>
            <div className="flex flex-wrap gap-2">
              <Chip active={!draft.professional} onClick={() => setDraft((d) => ({ ...d, professional: null }))} primaryColor={primaryColor}>
                Todas
              </Chip>
              {professionals.map((p) => (
                <Chip
                  key={p.value}
                  active={draft.professional === p.value}
                  onClick={() => setDraft((d) => ({ ...d, professional: p.value }))}
                  primaryColor={primaryColor}
                >
                  {p.label}
                </Chip>
              ))}
            </div>
          </div>
        )}

        <div className="px-5 pb-5 pt-4">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Faixa de preço</p>
          <div className="flex flex-wrap gap-2">
            {PRICE_RANGES.map((r) => (
              <Chip
                key={r.value}
                active={(draft.priceRange ?? 'any') === r.value}
                onClick={() => setDraft((d) => ({ ...d, priceRange: r.value }))}
                primaryColor={primaryColor}
              >
                {r.label}
              </Chip>
            ))}
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center gap-4 border-t bg-popover p-4">
          <button
            onClick={() => setDraft(EMPTY_FILTER_STATE)}
            className="text-xs font-semibold text-muted-foreground"
          >
            Limpar
          </button>
          <button
            onClick={() => {
              onApply(draft)
              onOpenChange(false)
            }}
            className="flex h-11 flex-1 items-center justify-center rounded-2xl text-sm font-semibold text-white"
            style={{ backgroundColor: primaryColor }}
          >
            Aplicar{countActiveFilters(draft) > 0 ? ` (${countActiveFilters(draft)})` : ''}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
