// src/components/domain/scheduling/agenda-day-timeline.tsx
'use client'

import { cn } from '@/lib/utils'
import { AppointmentCard } from './appointment-card'
import { appointmentSlotSpan, slotBucket } from '@/shared/utils/day-slots'
import type { Appointment } from '@/hooks/scheduling/use-appointments'

export type TimelineColumn = {
  professionalId: string
  professionalName: string
}

type Props = {
  slots: string[]
  columns: TimelineColumn[]
  appointmentsByProfessional: Record<string, Appointment[]>
  slotIntervalMinutes: number
  canClickSlot: (professionalId: string) => boolean
  onSlotClick: (professionalId: string, time: string) => void
  onAppointmentClick: (appointment: Appointment) => void
  onConfirm: (appointment: Appointment) => void
  onPay: (appointment: Appointment) => void
  onEdit: (appointment: Appointment) => void
}

function toHour(appt: Appointment) {
  return new Date(appt.startsAt).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Pra cada horário de início na coluna de um profissional, agrupa os
// agendamentos que caem naquele bucket (pode ter mais de um com conflito
// autorizado) e marca quantas linhas seguintes ficam "cobertas" pela
// duração — essas não recebem botão de slot vazio nem novo card.
function buildColumnCoverage(appts: Appointment[], slots: string[], slotIntervalMinutes: number) {
  const slotIndex = new Map(slots.map((t, i) => [t, i]))
  const grouped = new Map<string, Appointment[]>()

  for (const appt of appts) {
    const bucket = slotBucket(toHour(appt), slotIntervalMinutes)
    if (!slotIndex.has(bucket)) continue
    const list = grouped.get(bucket) ?? []
    list.push(appt)
    grouped.set(bucket, list)
  }

  const startsByTime = new Map<string, { appts: Appointment[]; span: number }>()
  const coveredTimes = new Set<string>()

  for (const [bucket, apptsAtBucket] of grouped) {
    const startIdx = slotIndex.get(bucket)!
    const span = Math.max(
      ...apptsAtBucket.map((a) => appointmentSlotSpan(a.startsAt, a.endsAt, slotIntervalMinutes)),
    )
    startsByTime.set(bucket, { appts: apptsAtBucket, span })
    for (let i = startIdx + 1; i < Math.min(startIdx + span, slots.length); i++) {
      coveredTimes.add(slots[i])
    }
  }

  return { startsByTime, coveredTimes }
}

export function AgendaDayTimeline({
  slots,
  columns,
  appointmentsByProfessional,
  slotIntervalMinutes,
  canClickSlot,
  onSlotClick,
  onAppointmentClick,
  onConfirm,
  onPay,
  onEdit,
}: Props) {
  const multiColumn = columns.length > 1
  const lastColumnIndex = columns.length - 1

  const coverageByColumn = new Map(
    columns.map((col) => [
      col.professionalId,
      buildColumnCoverage(appointmentsByProfessional[col.professionalId] ?? [], slots, slotIntervalMinutes),
    ]),
  )

  return (
    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
      <div className="inline-flex min-w-full flex-col [--time-col:2.5rem] [--col-min:11rem] sm:[--time-col:3.5rem] sm:[--col-min:15rem]">
        {multiColumn && (
          <div className="mb-2 flex">
            <div className="w-(--time-col) shrink-0" />
            {columns.map((col, colIdx) => (
              <div
                key={col.professionalId}
                className={cn(
                  'min-w-(--col-min) flex-1 px-1 sm:px-2',
                  colIdx < lastColumnIndex && 'border-r border-slate-200',
                )}
              >
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="flex size-6 sm:size-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] sm:text-xs font-semibold text-slate-600">
                    {col.professionalName.charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate text-xs sm:text-sm font-medium text-slate-700">
                    {col.professionalName}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div
          className="grid"
          style={{
            gridTemplateColumns: `var(--time-col) repeat(${columns.length}, ${
              multiColumn ? 'minmax(var(--col-min),1fr)' : '1fr'
            })`,
            gridTemplateRows: `repeat(${slots.length}, minmax(2.75rem, auto))`,
          }}
        >
          {slots.map((time, rowIdx) => (
            <div
              key={`time-${time}`}
              style={{ gridColumn: 1, gridRow: rowIdx + 1 }}
              className="sticky left-0 z-10 border-t border-slate-100/80 bg-background pt-1.5"
            >
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-slate-700">
                {time}
              </span>
            </div>
          ))}

          {columns.map((col, colIdx) => {
            const coverage = coverageByColumn.get(col.professionalId)!
            const clickable = canClickSlot(col.professionalId)
            const gridColumn = colIdx + 2
            const borderRight = colIdx < lastColumnIndex

            return slots.map((time, rowIdx) => {
              const start = coverage.startsByTime.get(time)

              if (!start && coverage.coveredTimes.has(time)) {
                // Coberto pela duração de um agendamento iniciado numa linha
                // anterior nesta mesma coluna — sem card, sem botão.
                return null
              }

              if (start) {
                const endRow = Math.min(rowIdx + start.span, slots.length) + 1
                return (
                  <div
                    key={`${col.professionalId}-${time}`}
                    style={{ gridColumn, gridRow: `${rowIdx + 1} / ${endRow}` }}
                    className={cn('min-w-0 border-t border-slate-100/80 px-1 pb-2', borderRight && 'border-r border-slate-200')}
                  >
                    <div className="space-y-1.5">
                      {start.appts.map((appt) => (
                        <div key={appt.id} onClick={(e) => e.stopPropagation()}>
                          <AppointmentCard
                            appointment={appt}
                            onClick={onAppointmentClick}
                            onConfirm={onConfirm}
                            onPay={onPay}
                            onEdit={onEdit}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={`${col.professionalId}-${time}`}
                  style={{ gridColumn, gridRow: rowIdx + 1 }}
                  className={cn('min-w-0 border-t border-slate-100/80 px-1 pb-2', borderRight && 'border-r border-slate-200')}
                >
                  <button
                    type="button"
                    disabled={!clickable}
                    onClick={() => onSlotClick(col.professionalId, time)}
                    aria-label={clickable ? `Novo agendamento às ${time}` : undefined}
                    className={cn(
                      'min-h-11 w-full rounded-lg transition',
                      clickable ? 'cursor-pointer hover:bg-primary/5' : 'cursor-default',
                    )}
                  />
                </div>
              )
            })
          })}
        </div>
      </div>
    </div>
  )
}
