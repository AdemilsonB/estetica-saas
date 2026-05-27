'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, startOfPrevMonth, endOfPrevMonth,
} from '@/lib/dates'

export type PeriodValue = { from: string; to: string }

type Preset = 'hoje' | 'semana' | 'mes' | 'mes-passado' | 'personalizado'

function toISO(d: Date) {
  return d.toISOString()
}

function presetToPeriod(preset: Exclude<Preset, 'personalizado'>): PeriodValue {
  const now = new Date()
  const map: Record<Exclude<Preset, 'personalizado'>, PeriodValue> = {
    hoje: { from: toISO(startOfDay(now)), to: toISO(endOfDay(now)) },
    semana: { from: toISO(startOfWeek(now)), to: toISO(endOfWeek(now)) },
    mes: { from: toISO(startOfMonth(now)), to: toISO(endOfDay(now)) },
    'mes-passado': { from: toISO(startOfPrevMonth(now)), to: toISO(endOfPrevMonth(now)) },
  }
  return map[preset]
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'hoje', label: 'Hoje' },
  { key: 'semana', label: 'Esta semana' },
  { key: 'mes', label: 'Este mês' },
  { key: 'mes-passado', label: 'Mês passado' },
  { key: 'personalizado', label: 'Personalizado' },
]

type Props = {
  onChange: (v: PeriodValue) => void
}

export function PeriodFilter({ onChange }: Props) {
  const [active, setActive] = useState<Preset>('mes')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  function handlePreset(preset: Preset) {
    setActive(preset)
    if (preset !== 'personalizado') {
      onChange(presetToPeriod(preset))
    }
  }

  function handleCustomChange(from: string, to: string) {
    if (from && to) {
      onChange({
        from: toISO(startOfDay(new Date(from))),
        to: toISO(endOfDay(new Date(to))),
      })
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handlePreset(key)}
            className={cn(
              'rounded-full px-4 py-1.5 text-xs font-medium transition',
              active === key
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {active === 'personalizado' && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={customFrom}
            onChange={(e) => {
              setCustomFrom(e.target.value)
              handleCustomChange(e.target.value, customTo)
            }}
            className="w-36 text-sm"
          />
          <span className="text-xs text-slate-400">até</span>
          <Input
            type="date"
            value={customTo}
            onChange={(e) => {
              setCustomTo(e.target.value)
              handleCustomChange(customFrom, e.target.value)
            }}
            className="w-36 text-sm"
          />
        </div>
      )}
    </div>
  )
}
