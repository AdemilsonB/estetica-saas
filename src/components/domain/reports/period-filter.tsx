'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  startOfDay, endOfDay, addDays,
  startOfMonth, startOfPrevMonth, endOfPrevMonth, startOfYear,
} from '@/lib/dates'

export type PeriodValue = { from: string; to: string }

type Preset = 'hoje' | '7dias' | 'mes' | 'mes-passado' | 'ano' | 'personalizado'

function toISO(d: Date) {
  return d.toISOString()
}

function presetToPeriod(preset: Exclude<Preset, 'personalizado'>): PeriodValue {
  const now = new Date()
  const map: Record<Exclude<Preset, 'personalizado'>, PeriodValue> = {
    hoje: { from: toISO(startOfDay(now)), to: toISO(endOfDay(now)) },
    '7dias': { from: toISO(startOfDay(addDays(now, -6))), to: toISO(endOfDay(now)) },
    mes: { from: toISO(startOfMonth(now)), to: toISO(endOfDay(now)) },
    'mes-passado': { from: toISO(startOfPrevMonth(now)), to: toISO(endOfPrevMonth(now)) },
    ano: { from: toISO(startOfYear(now)), to: toISO(endOfDay(now)) },
  }
  return map[preset]
}

const PRESETS: { key: Exclude<Preset, 'personalizado'>; label: string }[] = [
  { key: 'hoje', label: 'Hoje' },
  { key: '7dias', label: '7 dias' },
  { key: 'mes', label: 'Este mês' },
  { key: 'mes-passado', label: 'Mês passado' },
  { key: 'ano', label: 'Este ano' },
]

type Props = {
  onChange: (v: PeriodValue) => void
}

export function PeriodFilter({ onChange }: Props) {
  const [active, setActive] = useState<Preset>('mes')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  function handlePreset(preset: Exclude<Preset, 'personalizado'>) {
    setActive(preset)
    onChange(presetToPeriod(preset))
  }

  function handleCustomChange(from: string, to: string) {
    if (from && to) {
      onChange({
        from: toISO(startOfDay(new Date(from + 'T00:00:00'))),
        to: toISO(endOfDay(new Date(to + 'T00:00:00'))),
      })
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={active === 'personalizado' ? undefined : active}
          onValueChange={(v) => handlePreset(v as Exclude<Preset, 'personalizado'>)}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            {PRESETS.map(({ key, label }) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant={active === 'personalizado' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActive('personalizado')}
        >
          Personalizado
        </Button>
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
