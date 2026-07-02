'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type PublicSlot = { time: string; available: boolean }
type DayInfo = { open: boolean; available: boolean }

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function DateTimeStep({
  tenantSlug,
  serviceId,
  packageId,
  professionalId,
  maxAdvanceDays,
  onSelect,
  onBack,
  primaryColor,
}: {
  tenantSlug: string
  serviceId?: string
  packageId?: string
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
  const [slots, setSlots] = useState<PublicSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [dayInfo, setDayInfo] = useState<Record<string, DayInfo>>({})

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const maxDate = new Date(today.getTime() + maxAdvanceDays * 86_400_000)

  // Disponibilidade do mês visível — UMA chamada por mês, alimenta o destaque dos dias
  useEffect(() => {
    const y = viewDate.getFullYear()
    const m = String(viewDate.getMonth() + 1).padStart(2, '0')
    const params = new URLSearchParams({ month: `${y}-${m}` })
    if (serviceId) params.set('serviceId', serviceId)
    if (packageId) params.set('packageId', packageId)
    if (professionalId) params.set('professionalId', professionalId)
    fetch(`/api/public/${tenantSlug}/availability/month?${params}`)
      .then((r) => r.json())
      .then((d: { days?: { date: string; open: boolean; available: boolean }[] }) => {
        const map: Record<string, DayInfo> = {}
        for (const day of d.days ?? []) {
          map[day.date] = { open: day.open, available: day.available }
        }
        setDayInfo((prev) => ({ ...prev, ...map }))
      })
      .catch(() => {})
  }, [viewDate, serviceId, packageId, professionalId, tenantSlug])

  useEffect(() => {
    if (!selectedDay) return
    setLoadingSlots(true)
    setSlots([])
    const params = new URLSearchParams({ date: selectedDay })
    if (serviceId) params.set('serviceId', serviceId)
    if (packageId) params.set('packageId', packageId)
    if (professionalId) params.set('professionalId', professionalId)
    fetch(`/api/public/${tenantSlug}/availability?${params}`)
      .then((r) => r.json())
      .then((d: { slots?: PublicSlot[] }) => setSlots(d.slots ?? []))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false))
  }, [selectedDay, serviceId, packageId, professionalId, tenantSlug])

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

  function handleSlotClick(slot: PublicSlot) {
    if (!selectedDay || !slot.available) return
    const [h, m] = slot.time.split(':').map(Number)
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
        .slot-btn:hover,
        .slot-btn:focus-visible,
        .slot-btn:active {
          background-color: var(--slot-primary);
          border-color: var(--slot-primary);
          color: white;
          outline: none;
        }
        .slot-btn:active {
          transform: scale(0.97);
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
            const outOfRange = isDisabled(day)
            const info = dayInfo[dateStr]
            // Só bloqueia por disponibilidade depois que a info do mês chega
            const unavailable = !!info && (!info.open || !info.available)
            const disabled = outOfRange || unavailable
            const selected = selectedDay === dateStr
            const isToday = dateStr === todayStr
            const hasFreeSlots = !!info && info.open && info.available && !outOfRange

            return (
              <button
                key={day}
                disabled={disabled}
                aria-label={
                  unavailable && !outOfRange
                    ? `${day} — sem horários disponíveis`
                    : `${day}`
                }
                onClick={() => setSelectedDay(dateStr)}
                className={`relative h-9 rounded-lg text-sm font-medium transition-colors ${
                  selected
                    ? 'text-white'
                    : disabled
                      ? `text-slate-300 cursor-not-allowed ${unavailable && !outOfRange ? 'line-through decoration-slate-300' : ''}`
                      : isToday
                        ? 'text-slate-900 font-semibold ring-1 ring-inset'
                        : 'text-slate-700 hover:bg-slate-100'
                }`}
                style={
                  selected
                    ? { backgroundColor: primaryColor }
                    : isToday && !disabled
                      ? ({ '--tw-ring-color': primaryColor } as React.CSSProperties)
                      : {}
                }
              >
                {day}
                {/* Indicador de vaga — pontinho na cor do tenant */}
                {hasFreeSlots && !selected && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full"
                    style={{ backgroundColor: primaryColor }}
                  />
                )}
              </button>
            )
          })}
        </div>

        {/* Legenda */}
        <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full" style={{ backgroundColor: primaryColor }} />
            Tem horário
          </span>
          <span className="flex items-center gap-1">
            <span className="text-slate-300 line-through">00</span>
            Sem horário
          </span>
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
              {slots.map((slot) =>
                slot.available ? (
                  <button
                    key={slot.time}
                    onClick={() => handleSlotClick(slot)}
                    className="slot-btn h-11 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 transition-all"
                  >
                    {slot.time}
                  </button>
                ) : (
                  <div
                    key={slot.time}
                    className="flex h-11 flex-col items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-xs text-slate-400"
                  >
                    <span className="font-medium">{slot.time}</span>
                    {/* "Indisponível" cobre tanto horário já ocupado quanto
                        passado/abaixo da antecedência mínima — a API pública
                        nunca expõe o motivo exato (privacidade do agendamento). */}
                    <span className="leading-none">Indisponível</span>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
