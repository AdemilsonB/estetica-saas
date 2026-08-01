'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  useBusinessHours,
  useUpdateBusinessHours,
  DAY_ORDER,
  DAY_LABELS,
  type BusinessHours,
} from '@/hooks/settings/use-business-hours'

export function BusinessHoursForm() {
  const { data, isLoading } = useBusinessHours()
  const { mutate, isPending } = useUpdateBusinessHours()
  const [hours, setHours] = useState<BusinessHours>({})

  useEffect(() => {
    if (data) setHours(data)
  }, [data])

  function setDay(day: string, field: 'open' | 'close' | 'active', value: string | boolean) {
    setHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    mutate(hours)
  }

  if (isLoading) return <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {DAY_ORDER.map((day) => {
        const cfg = hours[day]
        if (!cfg) return null
        return (
          <div
            key={day}
            className="flex flex-col gap-3 rounded-2xl border border-white/80 bg-white/85 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
          >
            <div className="flex items-center gap-3">
              <Switch
                checked={cfg.active}
                onCheckedChange={(v: boolean) => setDay(day, 'active', v)}
                id={`day-${day}`}
              />
              <Label
                htmlFor={`day-${day}`}
                className="text-sm font-medium text-slate-700 sm:w-20"
              >
                {DAY_LABELS[day]}
              </Label>
              {!cfg.active && (
                <span className="ml-auto text-xs text-slate-400 sm:hidden">Fechado</span>
              )}
            </div>
            <div className={`flex items-center gap-2 transition-opacity ${cfg.active ? 'opacity-100' : 'pointer-events-none opacity-30'}`}>
              <Input
                type="time"
                value={cfg.open}
                onChange={(e) => setDay(day, 'open', e.target.value)}
                className="w-full min-w-0 flex-1 sm:w-28 sm:flex-none"
              />
              <span className="shrink-0 text-slate-400">até</span>
              <Input
                type="time"
                value={cfg.close}
                onChange={(e) => setDay(day, 'close', e.target.value)}
                className="w-full min-w-0 flex-1 sm:w-28 sm:flex-none"
              />
            </div>
            {!cfg.active && (
              <span className="hidden text-xs text-slate-400 sm:ml-auto sm:inline">Fechado</span>
            )}
          </div>
        )
      })}

      <Button type="submit" disabled={isPending} className="w-full sm:w-auto mt-2">
        {isPending ? 'Salvando...' : 'Salvar horários'}
      </Button>
    </form>
  )
}
