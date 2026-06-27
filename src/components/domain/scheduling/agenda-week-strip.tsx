// src/components/domain/scheduling/agenda-week-strip.tsx
'use client'

import { useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { useAppointments } from '@/hooks/scheduling/use-appointments'
import { cn } from '@/lib/utils'
import { ptBR } from 'react-day-picker/locale'

function startOfWeek(d: Date) {
  const r = new Date(d)
  const day = r.getDay()
  r.setDate(r.getDate() - day + (day === 0 ? -6 : 1))
  r.setHours(0, 0, 0, 0)
  return r
}

type Props = {
  selectedDate: Date
  onSelectDate: (d: Date) => void
}

export function AgendaWeekStrip({ selectedDate, onSelectDate }: Props) {
  const [calendarOpen, setCalendarOpen] = useState(false)
  const monday = startOfWeek(selectedDate)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  const { data: appointments = [], isLoading } = useAppointments({
    from: monday.toISOString(),
    to: sunday.toISOString(),
  })

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })

  const countByDay = days.map((d) => {
    const key = d.toDateString()
    return appointments.filter(
      (a) => new Date(a.startsAt).toDateString() === key,
    ).length
  })

  function prevWeek() {
    const d = new Date(monday)
    d.setDate(d.getDate() - 7)
    onSelectDate(d)
  }

  function nextWeek() {
    const d = new Date(monday)
    d.setDate(d.getDate() + 7)
    onSelectDate(d)
  }

  return (
    <div className="flex items-center gap-2">
      {/* Botão de calendário toggle */}
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className={cn('rounded-full shrink-0', calendarOpen && 'bg-slate-100')}
            aria-label="Abrir calendário"
          >
            <CalendarDays className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(d) => {
              if (d) {
                onSelectDate(d)
                setCalendarOpen(false)
              }
            }}
            locale={ptBR}
            autoFocus
          />
        </PopoverContent>
      </Popover>

      <Button variant="outline" size="icon" onClick={prevWeek} className="rounded-full shrink-0">
        <ChevronLeft className="size-4" />
      </Button>

      <div className="grid flex-1 grid-cols-7 gap-1">
        {days.map((d, i) => {
          const isSelected = d.toDateString() === selectedDate.toDateString()
          const isToday = d.toDateString() === new Date().toDateString()
          return (
            <button
              key={d.toISOString()}
              aria-label={d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              aria-pressed={isSelected}
              onClick={() => onSelectDate(d)}
              className={cn(
                'flex flex-col items-center rounded-xl py-2 text-center transition',
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : isToday
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-slate-100 text-slate-700',
              )}
            >
              <span className="text-[10px] font-medium uppercase">
                {d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
              </span>
              <span className="text-base font-semibold">{d.getDate()}</span>
              {isLoading ? (
                <Skeleton className="mt-1 h-1.5 w-4 rounded-full" />
              ) : countByDay[i] > 0 ? (
                <span
                  className={cn(
                    'mt-1 text-[10px] font-semibold',
                    isSelected ? 'text-primary-foreground/80' : 'text-primary',
                  )}
                >
                  {countByDay[i]}
                </span>
              ) : (
                <span className="mt-1 h-3" />
              )}
            </button>
          )
        })}
      </div>

      <Button variant="outline" size="icon" onClick={nextWeek} className="rounded-full shrink-0">
        <ChevronRight className="size-4" />
      </Button>
    </div>
  )
}
