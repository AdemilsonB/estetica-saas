'use client'

import React, { useMemo } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppointments, type Appointment } from '@/hooks/scheduling/use-appointments'
import { cn } from '@/lib/utils'

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7) // 07–21
const HOUR_LABELS = HOURS.map(h => `${String(h).padStart(2, '0')}:00`)

function startOfWeek(d: Date): Date {
  const r = new Date(d)
  const day = r.getDay()
  r.setDate(r.getDate() - day + (day === 0 ? -6 : 1))
  r.setHours(0, 0, 0, 0)
  return r
}

function toDateString(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

function toHourIndex(appt: Appointment): number {
  const hourStr = new Date(appt.startsAt).toLocaleString('en-CA', {
    timeZone: 'America/Sao_Paulo',
    hour: 'numeric',
    hour12: false,
  })
  return parseInt(hourStr, 10) - 7 // offset para o array HOURS
}

function toTimeLabel(appt: Appointment): string {
  return new Date(appt.startsAt).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type Props = {
  selectedDate: Date
  onSelectDate: (d: Date) => void
  onAppointmentClick: (appt: Appointment) => void
  professionalId?: string
}

export function AgendaWeekGrid({
  selectedDate,
  onSelectDate,
  onAppointmentClick,
  professionalId,
}: Props): React.JSX.Element {
  const monday = useMemo(() => startOfWeek(selectedDate), [selectedDate])

  const sunday = useMemo(() => {
    const d = new Date(monday)
    d.setDate(d.getDate() + 6)
    d.setHours(23, 59, 59, 999)
    return d
  }, [monday])

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday)
        d.setDate(monday.getDate() + i)
        return d
      }),
    [monday],
  )

  const { data: appointments = [], isLoading } = useAppointments({
    from: monday.toISOString(),
    to: sunday.toISOString(),
    professionalId,
  })

  const todayStr = useMemo(
    () => toDateString(new Date()),
    [],
  )

  // Map: dateString → hourIndex → Appointment[]
  const grid = useMemo(() => {
    const m: Record<string, Record<number, Appointment[]>> = {}
    for (const appt of appointments) {
      const key = toDateString(new Date(appt.startsAt))
      const hi = toHourIndex(appt)
      if (hi < 0 || hi >= HOURS.length) continue // fora do range visível
      if (!m[key]) m[key] = {}
      if (!m[key][hi]) m[key][hi] = []
      m[key][hi].push(appt)
    }
    return m
  }, [appointments])

  return (
    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 rounded-xl border border-slate-100">
      <div className="inline-flex min-w-full flex-col">

        {/* Cabeçalho — dias */}
        <div className="flex border-b border-slate-100 bg-white sticky top-0 z-10">
          {/* Espaço para alinhar com a coluna de hora */}
          <div className="w-12 shrink-0" />
          {weekDays.map((d) => {
            const isToday = toDateString(d) === todayStr
            const isSelected = toDateString(d) === toDateString(selectedDate)
            return (
              <button
                key={toDateString(d)}
                onClick={() => onSelectDate(d)}
                aria-label={d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric' })}
                aria-pressed={isSelected}
                className={cn(
                  'flex min-w-13 flex-1 flex-col items-center py-2 transition hover:bg-slate-50',
                  isSelected && 'bg-primary/5',
                )}
              >
                <span className="text-[10px] font-medium uppercase text-slate-600">
                  {d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
                </span>
                <span
                  className={cn(
                    'flex size-7 items-center justify-center rounded-full text-sm font-semibold',
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : isToday
                        ? 'bg-primary/10 text-primary'
                        : 'text-slate-700',
                  )}
                >
                  {d.getDate()}
                </span>
              </button>
            )
          })}
        </div>

        {/* Linhas de horário */}
        {isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          HOURS.map((hour, hi) => (
            <div key={hour} className="flex border-t border-slate-50 min-h-12">
              {/* Label de hora — sticky à esquerda */}
              <div className="sticky left-0 z-10 w-12 shrink-0 bg-white pt-1 pr-2">
                <span className="text-[10px] font-semibold text-slate-700">
                  {HOUR_LABELS[hi]}
                </span>
              </div>

              {/* Células por dia */}
              {weekDays.map((d) => {
                const key = toDateString(d)
                const appts = grid[key]?.[hi] ?? []
                const isToday = toDateString(d) === todayStr
                return (
                  <div
                    key={toDateString(d)}
                    className={cn(
                      'min-w-13 flex-1 border-l border-slate-50 p-0.5',
                      isToday && 'bg-primary/2',
                    )}
                  >
                    {appts.map((appt) => (
                      <button
                        key={appt.id}
                        onClick={() => onAppointmentClick(appt)}
                        title={`${appt.customer.name} — ${appt.service?.name ?? appt.package?.name ?? appt.promotion?.name ?? 'Serviço'} às ${toTimeLabel(appt)}`}
                        className={cn(
                          'w-full rounded text-left px-1 py-0.5 text-[10px] leading-tight transition',
                          'bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20',
                          appt.status === 'COMPLETED' && 'opacity-60',
                        )}
                      >
                        <span className="block truncate font-semibold">{toTimeLabel(appt)}</span>
                        <span className="block truncate text-slate-600">{appt.customer.name}</span>
                      </button>
                    ))}
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
