'use client'

import { useState } from 'react'
import { usePermissions } from '@/hooks/use-permissions'
import { useAppointmentsReport } from '@/hooks/reports/use-appointments-report'
import { PeriodFilter, type PeriodValue } from '@/components/domain/reports/period-filter'
import { ReportKpis, type KpiCard } from '@/components/domain/reports/report-kpis'
import { ReportTable, type ReportColumn } from '@/components/domain/reports/report-table'
import { ExportCsvButton } from '@/components/domain/reports/export-csv-button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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

export default function RelatorioAgendamentosPage() {
  const { can } = usePermissions()
  const [period, setPeriod] = useState<PeriodValue>(defaultPeriod)
  const [status, setStatus] = useState<string>('')
  const [groupBy, setGroupBy] = useState<'profissional' | 'servico'>('profissional')

  const { data, isLoading, isError } = useAppointmentsReport({
    from: period.from,
    to: period.to,
    status: status ? [status] : undefined,
    groupBy,
  })

  if (!can('appointments:view')) {
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
        { label: 'Total', value: data.kpis.total },
        { label: 'Concluídos', value: data.kpis.concluidos },
        { label: 'Cancelados', value: data.kpis.cancelados },
        { label: 'Taxa de conclusão', value: `${data.kpis.taxaConclusao}%` },
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
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Status: Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Agrupar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="profissional">Agrupar por profissional</SelectItem>
              <SelectItem value="servico">Agrupar por serviço</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto">
            <ExportCsvButton rows={csvRows} filename="relatorio-agendamentos.csv" isLoading={isLoading} />
          </div>
        </div>
      </div>

      <ReportKpis cards={kpis} isLoading={isLoading} />
      <ReportTable columns={COLUMNS} rows={data?.rows ?? []} isLoading={isLoading} />
    </div>
  )
}
