// src/components/domain/scheduling/agenda-day-timeline.tsx
'use client'

import { cn } from '@/lib/utils'
import { AppointmentCard } from './appointment-card'
import { slotBucket } from '@/shared/utils/day-slots'
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

  return (
    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
      <div className="inline-flex min-w-full flex-col">
        {multiColumn && (
          <div className="mb-2 flex">
            <div className="w-10 sm:w-14 shrink-0" />
            {columns.map((col) => (
              <div key={col.professionalId} className="min-w-44 sm:min-w-60 flex-1 px-1 sm:px-2">
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

        {slots.map((time) => (
          <div key={time} className="flex items-start border-t border-slate-100/80">
            <div className="sticky left-0 z-10 w-10 sm:w-14 shrink-0 bg-background pt-1.5">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-slate-700">
                {time}
              </span>
            </div>
            {columns.map((col) => {
              const apptsInSlot = (appointmentsByProfessional[col.professionalId] ?? []).filter(
                (a) => slotBucket(toHour(a), slotIntervalMinutes) === time,
              )
              const clickable = canClickSlot(col.professionalId)

              return (
                <div
                  key={col.professionalId}
                  className={cn(
                    'shrink-0 px-1 pb-2',
                    multiColumn ? 'min-w-44 sm:min-w-60 flex-1' : 'flex-1',
                  )}
                >
                  {apptsInSlot.length > 0 ? (
                    <div className="space-y-1.5">
                      {apptsInSlot.map((appt) => (
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
                  ) : (
                    <button
                      type="button"
                      disabled={!clickable}
                      onClick={() => onSlotClick(col.professionalId, time)}
                      aria-label={clickable ? `Novo agendamento às ${time}` : undefined}
                      className={cn(
                        'min-h-11 w-full rounded-lg transition',
                        clickable
                          ? 'cursor-pointer hover:bg-primary/5'
                          : 'cursor-default',
                      )}
                    />
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
