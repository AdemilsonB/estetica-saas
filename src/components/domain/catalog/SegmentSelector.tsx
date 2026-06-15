'use client'

import { Check, Leaf, Scissors, Sparkles, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SegmentSelectorProps {
  selected: string[]
  onChange: (segments: string[]) => void
  error?: string
}

interface SegmentConfig {
  value: string
  name: string
  examples: string
  icon: LucideIcon
}

const SEGMENTS: SegmentConfig[] = [
  {
    value: 'HAIR_SALON',
    name: 'Salão de Beleza',
    examples: 'Corte, coloração, mechas',
    icon: Scissors,
  },
  {
    value: 'BARBERSHOP',
    name: 'Barbearia',
    examples: 'Corte, barba, pigmentação',
    icon: Zap,
  },
  {
    value: 'NAIL_DESIGN',
    name: 'Nail Design',
    examples: 'Manicure, pedicure, alongamento',
    icon: Sparkles,
  },
  {
    value: 'AESTHETICS',
    name: 'Estética',
    examples: 'Limpeza de pele, massagem, lifting',
    icon: Leaf,
  },
]

export function SegmentSelector({ selected, onChange, error }: SegmentSelectorProps) {
  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((s) => s !== value))
    } else {
      onChange([...selected, value])
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SEGMENTS.map((segment) => {
          const isSelected = selected.includes(segment.value)
          const Icon = segment.icon

          return (
            <button
              key={segment.value}
              type="button"
              onClick={() => toggle(segment.value)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-all',
                isSelected
                  ? 'ring-2 ring-primary bg-primary/5 border-primary'
                  : 'hover:bg-muted/50',
              )}
            >
              <div className="relative w-full flex justify-end h-4">
                {isSelected && <Check className="size-4 text-primary" />}
              </div>
              <Icon className="size-8 text-primary" />
              <div>
                <p className="font-medium text-sm">{segment.name}</p>
                <p className="text-xs text-muted-foreground">{segment.examples}</p>
              </div>
            </button>
          )
        })}
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
