'use client'

import type { SeasonalityCell } from '@/domains/reports/types'

// Postgres EXTRACT(DOW): 0 = domingo. Exibimos Seg → Dom.
const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0] as const
const NOME_DIA: Record<number, string> = {
  0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb',
}
const COR_BASE = '14, 165, 233' // sky-500 em RGB, intensidade via alpha

type Props = {
  cells: SeasonalityCell[]
  maxTotal: number
}

export function SeasonalityHeatmap({ cells, maxTotal }: Props) {
  if (cells.length === 0 || maxTotal === 0) {
    return (
      <p className="rounded-xl border border-slate-100 bg-slate-50 p-8 text-center text-sm text-slate-500">
        Nenhum agendamento neste período.
      </p>
    )
  }

  const horas = cells.map((c) => c.hora)
  const horaMin = Math.min(...horas)
  const horaMax = Math.max(...horas)
  const faixaHoras = Array.from({ length: horaMax - horaMin + 1 }, (_, i) => horaMin + i)
  const porChave = new Map(cells.map((c) => [`${c.dow}-${c.hora}`, c.total]))

  return (
    <div className="overflow-x-auto pb-1">
      <div className="min-w-[520px]">
        <div className="grid grid-cols-[3rem_repeat(7,minmax(3rem,1fr))] gap-1">
          <div />
          {ORDEM_DIAS.map((dow) => (
            <p key={dow} className="text-center text-xs font-medium text-slate-500">
              {NOME_DIA[dow]}
            </p>
          ))}
          {faixaHoras.map((hora) => (
            <div key={hora} className="contents">
              <p className="pr-2 text-right text-xs tabular-nums text-slate-400">{hora}h</p>
              {ORDEM_DIAS.map((dow) => {
                const total = porChave.get(`${dow}-${hora}`) ?? 0
                return (
                  <div
                    key={`${dow}-${hora}`}
                    title={`${NOME_DIA[dow]} ${hora}h — ${total} agendamento${total === 1 ? '' : 's'}`}
                    className="flex h-8 items-center justify-center rounded-md text-[11px] font-medium tabular-nums"
                    style={{
                      backgroundColor: `rgba(${COR_BASE}, ${total === 0 ? 0.04 : 0.15 + (total / maxTotal) * 0.75})`,
                      color: total / maxTotal > 0.55 ? '#fff' : '#334155',
                    }}
                  >
                    {total > 0 ? total : ''}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
