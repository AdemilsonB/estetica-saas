// src/components/domain/scheduling/agenda-day-timeline.tsx
'use client'

import { useRef } from 'react'
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
  /** Fica fixo no topo junto com os nomes dos profissionais ao rolar o dia. */
  dateLabel: string
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
  dateLabel,
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

  const gridTemplateColumns = `var(--time-col) repeat(${columns.length}, ${
    multiColumn ? 'minmax(var(--col-min),1fr)' : '1fr'
  })`
  const gridTemplateRows = `repeat(${slots.length}, minmax(2.75rem, auto))`

  // O cabeçalho não rola sozinho (overflow-hidden): ele só espelha o
  // deslocamento horizontal do corpo, senão as colunas saem do lugar.
  const bodyRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)

  function syncHeaderScroll() {
    if (headerRef.current && bodyRef.current) {
      headerRef.current.scrollLeft = bodyRef.current.scrollLeft
    }
  }

  return (
    <div
      className="relative -mx-4 sm:mx-0 [--col-min:11rem] [--time-col:3rem] sm:[--col-min:15rem] sm:[--time-col:4rem]"
      // O app inteiro fica dentro de um swipe de rota (SwipeNavWrapper, drag
      // no eixo X). Sem barrar aqui, arrastar a grade pro lado movia a página
      // e a grade ao mesmo tempo — metade do "samba". Gesto horizontal que
      // nasce na agenda pertence à agenda.
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Faixa fixa: data + nomes dos profissionais. Gruda logo abaixo do
          cabeçalho do app (h-14, só no mobile). Os filtros ficam de fora de
          propósito — rolam junto com a página. */}
      <div className="sticky top-14 z-20 bg-background md:top-0">
        <p className="px-4 pb-1.5 pt-2 text-sm font-semibold capitalize text-slate-600 sm:px-0">
          {dateLabel}
        </p>
        {multiColumn && (
          <div ref={headerRef} className="overflow-x-hidden">
            <div className="grid min-w-full" style={{ gridTemplateColumns }}>
              {/* Canto: cobre o cruzamento das duas faixas fixas. */}
              <div className={cn('sticky left-0 z-10 bg-background', GRID_LINE_B)} />
              {columns.map((col, colIdx) => (
                <div
                  key={col.professionalId}
                  className={cn(
                    'min-w-0 px-1 py-2 sm:px-2',
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
            </div>
          </div>
        )}
      </div>

      {/* Corpo: rola SÓ na horizontal. A vertical continua sendo da página —
          é isso que separa os eixos e mata o "samba" de rolar nos dois ao
          mesmo tempo. `overscroll-x-none` tira o elástico nas duas pontas e
          impede o gesto de virar navegação do navegador. */}
      <div
        ref={bodyRef}
        onScroll={syncHeaderScroll}
        className="overflow-x-auto overflow-y-hidden overscroll-x-none"
      >
        <div className="grid min-w-full" style={{ gridTemplateColumns, gridTemplateRows }}>
          {/* Divisória desenhada UMA vez por faixa, atravessando todas as
              colunas. Antes cada célula desenhava a sua, então a espessura
              variava de coluna pra coluna — e sumia nas faixas cobertas por um
              bloco, que não renderizam célula nenhuma. */}
          {slots.map((time, rowIdx) => (
            <div
              key={`line-${time}`}
              aria-hidden="true"
              style={{ gridColumn: '1 / -1', gridRow: rowIdx + 1 }}
              className={cn('pointer-events-none', GRID_LINE_T)}
            />
          ))}

          {slots.map((time, rowIdx) => (
            <div
              key={`time-${time}`}
              style={{ gridColumn: 1, gridRow: rowIdx + 1 }}
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

              const row = rowIdx + 1

              if (start) {
                const endRow = Math.min(rowIdx + start.span, slots.length) + 1
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
    </div>
  )
}
