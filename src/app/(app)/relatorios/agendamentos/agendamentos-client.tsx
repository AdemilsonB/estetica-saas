'use client'

import { useState } from 'react'
import { usePermissions } from '@/hooks/use-permissions'
import { useAppointmentsReport } from '@/hooks/reports/use-appointments-report'
import { useSeasonalityReport } from '@/hooks/reports/use-seasonality-report'
import { PeriodFilter, type PeriodValue } from '@/components/domain/reports/period-filter'
import { ReportKpis, type KpiCard } from '@/components/domain/reports/report-kpis'
import { ReportTable, type ReportColumn } from '@/components/domain/reports/report-table'
import { ExportCsvButton } from '@/components/domain/reports/export-csv-button'
import { CategorySelect } from '@/components/domain/reports/category-select'
import { ReportProfessionalFilter } from '@/components/domain/reports/report-professional-filter'
import { LockedFeatureCard } from '@/components/domain/reports/locked-feature-card'
import { SeasonalityHeatmap } from '@/components/domain/reports/charts/seasonality-heatmap'
import { FeatureLockedError } from '@/hooks/reports/report-fetcher'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { startOfMonth, endOfDay } from '@/lib/dates'

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Agendado',
  CONFIRMED: 'Confirmado',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Não compareceu',
}

const defaultPeriod: PeriodValue = {
  from: startOfMonth(new Date()).toISOString(),
  to: endOfDay(new Date()).toISOString(),
}

const COLUMNS: ReportColumn[] = [
  { key: 'label', header: 'Nome' },
  { key: 'total', header: 'Total', align: 'right' },
  { key: 'concluidos', header: 'Concluídos', align: 'right' },
  { key: 'cancelados', header: 'Cancelados', align: 'right' },
  { key: 'naoCompareceu', header: 'Não compareceu', align: 'right' },
]

export function AgendamentosClient() {
  const { can } = usePermissions()
  const [period, setPeriod] = useState<PeriodValue>(defaultPeriod)
  const [status, setStatus] = useState<string>('all')
  const [groupBy, setGroupBy] = useState<'profissional' | 'servico'>('profissional')
  const [categoryId, setCategoryId] = useState<string>('all')
  const [professionalId, setProfessionalId] = useState<string>('all')

  const { data, isLoading, isError } = useAppointmentsReport({
    from: period.from,
    to: period.to,
    status: status !== 'all' ? [status] : undefined,
    groupBy,
    categoryId: categoryId !== 'all' ? categoryId : undefined,
    professionalId: professionalId === 'all' ? undefined : professionalId,
  })

  const seasonality = useSeasonalityReport({
    from: period.from,
    to: period.to,
    categoryId: categoryId === 'all' ? undefined : categoryId,
    professionalId: professionalId === 'all' ? undefined : professionalId,
  })

  if (!can('relatorios', 'view')) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-sm font-medium text-red-700">Sem permissão para visualizar agendamentos.</p>
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
        { label: 'Total', value: data.kpis.total, delta: data.kpis.variacao.total },
        { label: 'Concluídos', value: data.kpis.concluidos, delta: data.kpis.variacao.concluidos },
        { label: 'Cancelados', value: data.kpis.cancelados },
        { label: 'Taxa de conclusão', value: `${data.kpis.taxaConclusao}%`, delta: data.kpis.variacao.taxaConclusaoPp, deltaUnit: 'pp' },
      ]
    : []

  const csvRows = (data?.rows ?? []).map((r) => ({
    Nome: r.label,
    Total: r.total,
    Concluídos: r.concluidos,
    Cancelados: r.cancelados,
    'Não compareceu': r.naoCompareceu,
  }))

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-100 bg-white p-5 space-y-4">
        <PeriodFilter onChange={setPeriod} />
        <div className="flex flex-wrap gap-3">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue placeholder="Status: Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Agrupar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="profissional">Agrupar por profissional</SelectItem>
              <SelectItem value="servico">Agrupar por serviço</SelectItem>
            </SelectContent>
          </Select>
          <CategorySelect value={categoryId} onChange={setCategoryId} />
          <ReportProfessionalFilter value={professionalId} onChange={setProfessionalId} />
          <div className="ml-auto">
            <ExportCsvButton rows={csvRows} filename="relatorio-agendamentos.csv" isLoading={isLoading} />
          </div>
        </div>
      </div>

      <ReportKpis cards={kpis} isLoading={isLoading} />

      <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Sazonalidade — dia × horário</h2>
        {seasonality.isLoading ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : seasonality.error instanceof FeatureLockedError ? (
          <LockedFeatureCard
            title="Sazonalidade é um relatório avançado"
            description="Descubra horários de pico e ociosidade da sua agenda com um plano superior."
          />
        ) : seasonality.isError ? (
          <p className="text-sm text-rose-600">Erro ao carregar sazonalidade.</p>
        ) : (
          <SeasonalityHeatmap cells={seasonality.data?.cells ?? []} maxTotal={seasonality.data?.maxTotal ?? 0} />
        )}
      </div>

      <ReportTable columns={COLUMNS} rows={data?.rows ?? []} isLoading={isLoading} />
    </div>
  )
}
