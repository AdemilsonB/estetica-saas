'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useMonthlyAppointmentCounts } from '@/hooks/scheduling/use-monthly-appointment-counts'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

type OccupancyRingProps = {
  count: number
  capacity: number
  size: number
  isSelected: boolean
  isToday: boolean
}

function OccupancyRing({ count, capacity, size, isSelected, isToday }: OccupancyRingProps) {
  const filled = capacity > 0 ? Math.round(Math.min(count / capacity, 1) * 100) : 0
  const r = 15.9
  const bgColor = isSelected ? 'rgba(255,255,255,0.3)' : '#e2e8f0'
  const fgColor = 'currentColor'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      className={isSelected || isToday ? 'text-primary-foreground' : 'text-primary'}
      aria-hidden
    >
      <circle cx="18" cy="18" r={r} fill="none" stroke={bgColor} strokeWidth="2.5" />
      {filled > 0 && (
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke={fgColor}
          strokeWidth="2.5"
          strokeDasharray={`${filled} 100`}
          strokeLinecap="round"
          transform="rotate(-90 18 18)"
        />
      )}
    </svg>
  )
}

function getDaysInMonth(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const days: Date[] = []
  // Preencher dias anteriores (calendário começa na segunda)
  const startWeekday = (first.getDay() + 6) % 7 // 0 = seg
  for (let i = startWeekday - 1; i >= 0; i--) {
    days.push(new Date(year, month, -i))
  }
  // Dias do mês atual
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(new Date(year, month, d))
  }
  // Preencher dias posteriores para completar a última semana
  const remaining = (7 - (days.length % 7)) % 7
  for (let i = 1; i <= remaining; i++) {
    days.push(new Date(year, month + 1, i))
  }
  return days
}

type Props = {
  selectedDate: Date
  onSelectDate: (d: Date) => void
  onSelectDayView: () => void
}

export function AgendaMonthView({ selectedDate, onSelectDate, onSelectDayView }: Props) {
  const [viewYear, setViewYear] = useState(selectedDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth())

  const { data, isLoading } = useMonthlyAppointmentCounts(viewYear, viewMonth)
  const counts = data?.counts ?? {}
  const capacity = data?.capacity ?? 16

  const today = useMemo(() => {
    const t = new Date()
    t.setHours(0, 0, 0, 0)
    return t
  }, [])

  const todayKey = useMemo(
    () => today.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }),
    [today]
  )

  const selectedKey = useMemo(
    () => selectedDate.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }),
    [selectedDate]
  )

  const days = getDaysInMonth(viewYear, viewMonth)

  function prevMonth() {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1)
      setViewMonth(11)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1)
      setViewMonth(0)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  function handleDayClick(d: Date) {
    onSelectDate(d)
    onSelectDayView()
  }

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="flex flex-col gap-4">
      {/* Navegação de mês */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="icon"
          onClick={prevMonth}
          className="rounded-full shrink-0"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-semibold capitalize text-slate-700">{monthLabel}</span>
        <Button
          variant="outline"
          size="icon"
          onClick={nextMonth}
          className="rounded-full shrink-0"
          aria-label="Próximo mês"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Cabeçalho dos dias da semana */}
      <div className="grid grid-cols-7">
        {WEEKDAYS.map((wd) => (
          <div
            key={wd}
            className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400"
          >
            {wd}
          </div>
        ))}
      </div>

      {/* Grade de dias */}
      <div className="grid grid-cols-7 gap-y-1">
        {days.map((d) => {
          const isCurrentMonth = d.getMonth() === viewMonth
          const dateKey = d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
          const isToday = dateKey === todayKey
          const isSelected = dateKey === selectedKey
          const count = counts[dateKey] ?? 0
          const hasAppointments = count > 0

          return (
            <button
              key={dateKey}
              aria-label={`${d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}${count > 0 ? `, ${count} agendamento${count > 1 ? 's' : ''}` : ''}`}
              aria-pressed={isSelected}
              onClick={() => handleDayClick(d)}
              disabled={!isCurrentMonth}
              className={cn(
                'relative flex flex-col items-center justify-center py-1.5 rounded-xl transition-all min-h-[52px]',
                !isCurrentMonth && 'opacity-0 pointer-events-none',
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : isToday
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-slate-100 text-slate-700',
              )}
            >
              {/* Anel de ocupação (renderizado atrás do texto) */}
              {hasAppointments && isCurrentMonth && (
                <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <OccupancyRing
                    count={count}
                    capacity={capacity}
                    size={42}
                    isSelected={isSelected}
                    isToday={isToday && !isSelected}
                  />
                </span>
              )}

              {/* Número do dia — z-10 para ficar na frente do anel */}
              <span className="relative z-10 text-sm font-semibold leading-none">
                {d.getDate()}
              </span>

              {/* Badge de contagem ou skeleton durante carregamento */}
              {isLoading && isCurrentMonth ? (
                <Skeleton className="mt-0.5 h-2 w-4 rounded-full relative z-10" />
              ) : hasAppointments && isCurrentMonth ? (
                <span
                  className={cn(
                    'relative z-10 mt-0.5 text-[10px] font-semibold leading-none',
                    isSelected ? 'text-primary-foreground/80' : 'text-primary',
                  )}
                >
                  {count}
                </span>
              ) : (
                <span className="mt-0.5 h-3 relative z-10" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
