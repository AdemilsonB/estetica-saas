// src/components/domain/scheduling/agenda-day-timeline.tsx
'use client'

import { cn } from '@/lib/utils'
import { AppointmentCard } from './appointment-card'
import { appointmentSlotSpan, occupiesSlot, slotBucket } from '@/shared/utils/day-slots'
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

// Monta os blocos ocupados da coluna de um profissional: cada bloco é um
// horário de início + quantas linhas ele cobre + os agendamentos dentro dele.
// As linhas cobertas não recebem botão de slot vazio nem card próprio.
//
// Dois casos que precisam virar UM bloco só:
//  - mesmo bucket (conflito autorizado no mesmo horário);
//  - início dentro do intervalo de um agendamento anterior (ex.: 09:00–11:00
//    e 10:00–10:30). Sem juntar, os dois viravam grid items sobrepostos na
//    mesma coluna e um desenhava por cima do outro.
function buildColumnCoverage(appts: Appointment[], slots: string[], slotIntervalMinutes: number) {
  const slotIndex = new Map(slots.map((t, i) => [t, i]))

  const entries = appts
    // Desmarcado / não compareceu deixam de ocupar o horário (mesma regra do
    // backend) — não renderizam card nem bloqueiam o slot.
    .filter((a) => occupiesSlot(a.status))
    .flatMap((appt) => {
      const idx = slotIndex.get(slotBucket(toHour(appt), slotIntervalMinutes))
      if (idx === undefined) return []
      return [{ idx, appt, span: appointmentSlotSpan(appt.startsAt, appt.endsAt, slotIntervalMinutes) }]
    })
    .sort((a, b) => a.idx - b.idx)

  const startsByTime = new Map<string, { appts: Appointment[]; span: number }>()
  const coveredTimes = new Set<string>()

  let openIdx = -1
  let openEnd = -1 // exclusivo

  for (const entry of entries) {
    if (openIdx !== -1 && entry.idx < openEnd) {
      const block = startsByTime.get(slots[openIdx])!
      block.appts.push(entry.appt)
      openEnd = Math.max(openEnd, entry.idx + entry.span)
      block.span = openEnd - openIdx
      continue
    }
    openIdx = entry.idx
    openEnd = entry.idx + entry.span
    startsByTime.set(slots[openIdx], { appts: [entry.appt], span: entry.span })
  }

  for (const [time, block] of startsByTime) {
    const startIdx = slotIndex.get(time)!
    for (let i = startIdx + 1; i < Math.min(startIdx + block.span, slots.length); i++) {
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
                  colIdx < lastColumnIndex && 'border-r border-slate-700/40',
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
              className="sticky left-0 z-10 border-t border-slate-700 bg-background pt-1.5"
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
            // `flex` (não bloco) pra que card e botão estiquem até o fim da
            // célula: uma linha alta por causa do card do vizinho deixava o
            // botão de 44px no topo e o resto virava área morta — o toque no
            // meio do espaço vazio não fazia nada e exigia um segundo clique.
            const cellClass = cn(
              'flex min-w-0 flex-col border-t border-slate-700 px-1 pb-2',
              borderRight && 'border-r border-slate-700/40',
            )

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
                    className={cellClass}
                  >
                    <div className="flex min-h-0 flex-1 flex-col gap-1.5">
                      {start.appts.map((appt) => (
                        <div
                          key={appt.id}
                          onClick={(e) => e.stopPropagation()}
                          className="flex min-h-0 flex-1 flex-col"
                        >
                          <AppointmentCard
                            appointment={appt}
                            onClick={onAppointmentClick}
                            onConfirm={onConfirm}
                            onPay={onPay}
                            onEdit={onEdit}
                            // Preenche todo o intervalo da duração — o bloco
                            // ocupado tem a mesma cor de ponta a ponta, em vez
                            // de cor só na altura do conteúdo e vazio abaixo.
                            className="h-full"
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
                  className={cellClass}
                >
                  <button
                    type="button"
                    disabled={!clickable}
                    onClick={() => onSlotClick(col.professionalId, time)}
                    aria-label={clickable ? `Novo agendamento às ${time}` : undefined}
                    className={cn(
                      'min-h-11 w-full flex-1 rounded-lg transition',
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
