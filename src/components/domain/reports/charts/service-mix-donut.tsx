'use client'

import { Cell, Pie, PieChart } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { stableColor, OTHERS_COLOR } from './palette'
import type { FinancialReportRow } from '@/domains/reports/types'

const MAX_FATIAS = 5

type Slice = { nome: string; receita: number; pct: number; cor: string }

function toSlices(rows: FinancialReportRow[]): Slice[] {
  const total = rows.reduce((s, r) => s + r.receita, 0)
  if (total === 0) return []
  const top = rows.slice(0, MAX_FATIAS)
  const resto = rows.slice(MAX_FATIAS)
  const slices: Slice[] = top.map((r) => ({
    nome: r.label,
    receita: r.receita,
    pct: Math.round((r.receita / total) * 100),
    cor: stableColor(r.groupId),
  }))
  const restoReceita = resto.reduce((s, r) => s + r.receita, 0)
  if (restoReceita > 0) {
    slices.push({
      nome: 'Outros',
      receita: restoReceita,
      pct: Math.round((restoReceita / total) * 100),
      cor: OTHERS_COLOR,
    })
  }
  return slices
}

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function ServiceMixDonut({ rows }: { rows: FinancialReportRow[] }) {
  const slices = toSlices(rows)
  if (slices.length === 0) {
    return (
      <p className="rounded-xl border border-slate-100 bg-slate-50 p-8 text-center text-sm text-slate-500">
        Nenhuma receita neste período.
      </p>
    )
  }

  const config = Object.fromEntries(
    slices.map((s) => [s.nome, { label: s.nome, color: s.cor }]),
  ) as ChartConfig

  return (
    <div className="flex flex-col items-center gap-4">
      <ChartContainer config={config} className="aspect-square h-44 sm:h-52">
        <PieChart>
          <ChartTooltip
            content={<ChartTooltipContent formatter={(value) => fmtBRL(Number(value))} />}
          />
          <Pie data={slices} dataKey="receita" nameKey="nome" innerRadius="60%" strokeWidth={2}>
            {slices.map((s) => (
              <Cell key={s.nome} fill={s.cor} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <ul className="w-full space-y-1.5">
        {slices.map((s) => (
          <li key={s.nome} className="flex items-center gap-2 text-xs text-slate-600">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.cor }} />
            <span className="min-w-0 flex-1 truncate">{s.nome}</span>
            <span className="font-medium tabular-nums text-slate-900">{s.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
