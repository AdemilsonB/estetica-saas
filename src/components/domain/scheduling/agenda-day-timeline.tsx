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

// Toda divisória da grade usa a MESMA cor e espessura (1px). Antes a linha
// horizontal era `slate-700` e a vertical `slate-700/40`, então as divisórias
// não batiam entre si e a grade parecia mais pesada em umas colunas que noutras.
const GRID_LINE = 'border-slate-400'
const GRID_LINE_T = `border-t ${GRID_LINE}`
const GRID_LINE_B = `border-b ${GRID_LINE}`
const GRID_LINE_R = `border-r ${GRID_LINE}`

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

  const rowOffset = multiColumn ? 2 : 1
  const gridTemplateColumns = `var(--time-col) repeat(${columns.length}, ${
    multiColumn ? 'minmax(var(--col-min),1fr)' : '1fr'
  })`
  const gridTemplateRows = `${multiColumn ? 'auto ' : ''}repeat(${slots.length}, minmax(2.75rem, auto))`

  return (
    // Rola nos dois eixos aqui dentro: é o que permite o cabeçalho dos
    // profissionais e a coluna de horas grudarem enquanto o dia rola.
    // Sem `px-4` de propósito — a folga lateral virava um vão pelo qual dava
    // pra ver o bloco de agendamento passando por trás da coluna de horas
    // fixa; o recuo do rótulo agora é padding da própria célula.
    <div className="-mx-4 max-h-[calc(100dvh-17rem)] overflow-auto sm:mx-0 sm:max-h-[calc(100dvh-20rem)]">
      <div
        className="grid min-w-full [--col-min:11rem] [--time-col:3rem] sm:[--col-min:15rem] sm:[--time-col:4rem]"
        style={{ gridTemplateColumns, gridTemplateRows }}
      >
        {multiColumn && (
          <>
            {/* Canto: cobre o cruzamento das duas faixas fixas. */}
            <div
              style={{ gridColumn: 1, gridRow: 1 }}
              className={cn('sticky left-0 top-0 z-30 bg-background', GRID_LINE_B)}
            />
            {columns.map((col, colIdx) => (
              <div
                key={col.professionalId}
                style={{ gridColumn: colIdx + 2, gridRow: 1 }}
                className={cn(
                  'sticky top-0 z-20 bg-background px-1 py-2 sm:px-2',
                  GRID_LINE_B,
                  colIdx < lastColumnIndex && GRID_LINE_R,
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
          </>
        )}

        {/* Divisória desenhada UMA vez por faixa, atravessando todas as
            colunas. Antes cada célula desenhava a sua, então a espessura
            variava de coluna pra coluna — e sumia nas faixas cobertas por um
            bloco, que não renderizam célula nenhuma. */}
        {slots.map((time, rowIdx) => (
          <div
            key={`line-${time}`}
            aria-hidden="true"
            style={{ gridColumn: '1 / -1', gridRow: rowIdx + rowOffset }}
            className={cn('pointer-events-none', GRID_LINE_T)}
          />
        ))}

        {slots.map((time, rowIdx) => (
          <div
            key={`time-${time}`}
            style={{ gridColumn: 1, gridRow: rowIdx + rowOffset }}
            className={cn('sticky left-0 z-10 bg-background pl-4 pt-1.5 sm:pl-2', GRID_LINE_T)}
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
          // `flex` (não bloco) pra que card e botão estiquem até o fim da
          // célula: uma faixa alta por causa do card do vizinho deixava o
          // botão de 44px no topo e o resto virava área morta — o toque no
          // meio do espaço vazio não fazia nada e exigia um segundo clique.
          const cellClass = cn(
            'flex min-w-0 flex-col px-1 pb-2',
            colIdx < lastColumnIndex && GRID_LINE_R,
          )

          return slots.map((time, rowIdx) => {
            const start = coverage.startsByTime.get(time)

            if (!start && coverage.coveredTimes.has(time)) {
              // Coberto pela duração de um agendamento iniciado numa faixa
              // anterior nesta mesma coluna — sem card, sem botão.
              return null
            }

            const row = rowIdx + rowOffset

            if (start) {
              const endRow = Math.min(rowIdx + start.span, slots.length) + rowOffset
              return (
                <div
                  key={`${col.professionalId}-${time}`}
                  style={{ gridColumn, gridRow: `${row} / ${endRow}` }}
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
                style={{ gridColumn, gridRow: row }}
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
  )
}
