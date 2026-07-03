'use client'

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { OverviewSeriesPoint } from '@/domains/reports/types'
import type { Granularity } from '@/domains/reports/analytics-utils'

const CONFIG = {
  faturamento: { label: 'Faturamento', color: '#0ea5e9' },
  agendamentos: { label: 'Agendamentos', color: '#8b5cf6' },
} satisfies ChartConfig

type Props = {
  series: OverviewSeriesPoint[]
  granularity: Granularity
  metric: 'faturamento' | 'agendamentos'
}

function fmtBucket(bucket: string, granularity: Granularity): string {
  const partes = bucket.split('-')
  const ano = partes[0] ?? ''
  const mes = partes[1] ?? ''
  const dia = partes[2] ?? ''
  if (granularity === 'month') {
    const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
    return `${nomes[Number(mes) - 1]}/${ano.slice(2)}`
  }
  return `${dia}/${mes}`
}

function fmtValor(v: number, metric: Props['metric']): string {
  return metric === 'faturamento'
    ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : String(v)
}

export function RevenueLineChart({ series, granularity, metric }: Props) {
  return (
    <ChartContainer config={CONFIG} className="h-56 w-full sm:h-72">
      <LineChart data={series} margin={{ left: 4, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="bucket"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={(b: string) => fmtBucket(b, granularity)}
        />
        <YAxis
          width={metric === 'faturamento' ? 64 : 32}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) =>
            metric === 'faturamento'
              ? `R$ ${Math.round(v / 100) / 10}k`.replace('R$ 0k', 'R$ 0')
              : String(v)
          }
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(b) => fmtBucket(String(b), granularity)}
              formatter={(value) => fmtValor(Number(value), metric)}
            />
          }
        />
        <Line
          type="monotone"
          dataKey={metric}
          stroke={`var(--color-${metric})`}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ChartContainer>
  )
}
