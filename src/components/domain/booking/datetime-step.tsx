'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function DateTimeStep({
  tenantSlug,
  serviceId,
  professionalId,
  maxAdvanceDays,
  onSelect,
  onBack,
  primaryColor,
}: {
  tenantSlug: string
  serviceId: string
  professionalId?: string
  maxAdvanceDays: number
  onSelect: (date: Date) => void
  onBack: () => void
  primaryColor: string
}) {
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d
  })
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [slots, setSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const maxDate = new Date(today.getTime() + maxAdvanceDays * 86_400_000)

  useEffect(() => {
    if (!selectedDay) return
    setLoadingSlots(true)
    setSlots([])
    const params = new URLSearchParams({ date: selectedDay, serviceId })
    if (professionalId) params.set('professionalId', professionalId)
    fetch(`/api/public/${tenantSlug}/availability?${params}`)
      .then((r) => r.json())
      .then((d: { slots?: string[] }) => setSlots(d.slots ?? []))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false))
  }, [selectedDay, serviceId, professionalId, tenantSlug])

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, month, 1).getDay()

  function toDateString(day: number): string {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  function isDisabled(day: number): boolean {
    const d = new Date(year, month, day)
    d.setHours(0, 0, 0, 0)
    return d < today || d > maxDate
  }

  function handleSlotClick(slot: string) {
    if (!selectedDay) return
    const [h, m] = slot.split(':').map(Number)
    const dt = new Date(selectedDay + 'T00:00:00')
    dt.setHours(h ?? 0, m ?? 0, 0, 0)
    onSelect(dt)
  }

  function prevMonth() {
    setViewDate((d) => {
      const nd = new Date(d)
      nd.setMonth(nd.getMonth() - 1)
      nd.setDate(1)
      return nd
    })
    setSelectedDay(null)
  }

  function nextMonth() {
    setViewDate((d) => {
      const nd = new Date(d)
      nd.setMonth(nd.getMonth() + 1)
      nd.setDate(1)
      return nd
    })
    setSelectedDay(null)
  }

  return (
    <div className="space-y-4">
      {/* CSS var para o hover dos slots com cor do tenant */}
      <style>{`
        .slot-btn:hover {
          background-color: var(--slot-primary);
          border-color: var(--slot-primary);
          color: white;
        }
      `}</style>

      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 -ml-1 py-1 px-1 rounded"
      >
        <ChevronLeft className="size-4" />
        Voltar
      </button>

      <h2 className="text-xl font-semibold text-slate-900">Escolha data e horário</h2>

      {/* Calendário */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="size-4 text-slate-600" />
          </button>
          <span className="text-sm font-semibold text-slate-900">
            {MONTHS_PT[month]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Próximo mês"
          >
            <ChevronRight className="size-4 text-slate-600" />
          </button>
        </div>

        {/* Dias da semana */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS_PT.map((d) => (
            <div key={d} className="text-center text-xs text-slate-400 py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Dias do mês */}
        <div className="grid grid-cols-7 gap-y-1">
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const dateStr = toDateString(day)
            const disabled = isDisabled(day)
            const selected = selectedDay === dateStr
            return (
              <button
                key={day}
                disabled={disabled}
                onClick={() => setSelectedDay(dateStr)}
                className={`h-9 rounded-lg text-sm font-medium transition-colors ${
                  disabled
                    ? 'text-slate-300 cursor-not-allowed'
                    : selected
                      ? 'text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                }`}
                style={selected ? { backgroundColor: primaryColor } : {}}
              >
                {day}
              </button>
            )
          })}
        </div>
      </div>

      {/* Slots de horário */}
      {selectedDay && (
        <div
          className="space-y-3"
          style={{ '--slot-primary': primaryColor } as React.CSSProperties}
        >
          <h3 className="text-sm font-medium text-slate-700">Horários disponíveis</h3>
          {loadingSlots ? (
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-11 rounded-lg bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : slots.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">
              Nenhum horário disponível nesta data.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {slots.map((slot) => (
                <button
                  key={slot}
                  onClick={() => handleSlotClick(slot)}
                  className="slot-btn h-11 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 transition-all"
                >
                  {slot}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
