'use client'

import { useState } from 'react'
import { usePermissions } from '@/hooks/use-permissions'
import { useOverviewReport } from '@/hooks/reports/use-overview-report'
import { PeriodFilter, type PeriodValue } from '@/components/domain/reports/period-filter'
import { ReportKpis, type KpiCard } from '@/components/domain/reports/report-kpis'
import { CategorySelect } from '@/components/domain/reports/category-select'
import { RevenueLineChart } from '@/components/domain/reports/charts/revenue-line-chart'
import { LockedFeatureCard } from '@/components/domain/reports/locked-feature-card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { startOfMonth, endOfDay } from '@/lib/dates'

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const defaultPeriod: PeriodValue = {
  from: startOfMonth(new Date()).toISOString(),
  to: endOfDay(new Date()).toISOString(),
}

export function VisaoGeralClient() {
  const { can } = usePermissions()
  const [period, setPeriod] = useState<PeriodValue>(defaultPeriod)
  const [categoryId, setCategoryId] = useState<string>('all')
  const [metric, setMetric] = useState<'faturamento' | 'agendamentos'>('faturamento')

  const { data, isLoading, isError } = useOverviewReport({
    from: period.from,
    to: period.to,
    categoryId: categoryId === 'all' ? undefined : categoryId,
  })

  if (!can('relatorios', 'view')) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-sm font-medium text-red-700">Sem permissão para visualizar relatórios.</p>
      </div>
    )
  }

  if (isError) {
    return (
      <p className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-600">
        Erro ao carregar relatório. Tente recarregar a página.
      </p>
    )
  }

  const kpis: KpiCard[] = data
    ? [
        { label: 'Faturamento', value: fmtBRL(data.kpis.faturamento), delta: data.kpis.variacao.faturamento },
        { label: 'Agendamentos', value: data.kpis.agendamentos, delta: data.kpis.variacao.agendamentos },
        { label: 'Ticket médio', value: fmtBRL(data.kpis.ticketMedio), delta: data.kpis.variacao.ticketMedio },
        { label: 'Clientes novos', value: `${data.kpis.novosPct}%`, delta: data.kpis.variacao.novosPctPp, deltaUnit: 'pp' },
      ]
    : []

  const temDados = (data?.series ?? []).some((p) => p.faturamento > 0 || p.agendamentos > 0)

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5">
        <PeriodFilter onChange={setPeriod} />
        <CategorySelect value={categoryId} onChange={setCategoryId} />
      </div>

      <ReportKpis cards={kpis} isLoading={isLoading} />

      <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Evolução no tempo</h2>
          <Tabs value={metric} onValueChange={(v) => setMetric(v as typeof metric)}>
            <TabsList className="grid w-full grid-cols-2 sm:w-auto">
              <TabsTrigger value="faturamento">Faturamento</TabsTrigger>
              <TabsTrigger value="agendamentos">Agendamentos</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {isLoading ? (
          <Skeleton className="h-56 w-full rounded-xl sm:h-72" />
        ) : data?.series == null ? (
          <LockedFeatureCard
            title="Evolução no tempo é um relatório avançado"
            description="Acompanhe a tendência de faturamento e agendamentos do seu negócio com um plano superior."
          />
        ) : !temDados ? (
          <p className="rounded-xl border border-slate-100 bg-slate-50 p-8 text-center text-sm text-slate-500">
            Nenhum agendamento neste período.
          </p>
        ) : (
          <RevenueLineChart series={data.series} granularity={data.granularity} metric={metric} />
        )}
      </div>
    </div>
  )
}
