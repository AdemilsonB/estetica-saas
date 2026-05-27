'use client'

import { useState } from 'react'
import { usePermissions } from '@/hooks/use-permissions'
import { useProfessionalsReport } from '@/hooks/reports/use-professionals-report'
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

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const defaultPeriod: PeriodValue = {
  from: startOfMonth(new Date()).toISOString(),
  to: endOfDay(new Date()).toISOString(),
}

const COLUMNS: ReportColumn[] = [
  { key: 'profissionalNome', header: 'Profissional' },
  { key: 'atendimentos', header: 'Atendimentos', align: 'right' },
  { key: 'receita', header: 'Receita', align: 'right', format: (v) => fmtBRL(Number(v)) },
  { key: 'ticketMedio', header: 'Ticket médio', align: 'right', format: (v) => fmtBRL(Number(v)) },
]

export default function RelatorioProfissionaisPage() {
  const { can } = usePermissions()
  const [period, setPeriod] = useState<PeriodValue>(defaultPeriod)
  const [status, setStatus] = useState<string>('')

  const { data, isLoading, isError } = useProfessionalsReport({
    from: period.from,
    to: period.to,
    status: status ? [status] : undefined,
  })

  if (!can('appointments:view')) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-sm font-medium text-red-700">Sem permissão para visualizar este relatório.</p>
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
        { label: 'Total de atendimentos', value: data.kpis.totalAtendimentos },
        { label: 'Receita total', value: fmtBRL(data.kpis.receitaTotal) },
      ]
    : []

  const csvRows = (data?.rows ?? []).map((r) => ({
    Profissional: r.profissionalNome,
    Atendimentos: r.atendimentos,
    'Receita (R$)': r.receita.toFixed(2),
    'Ticket médio (R$)': r.ticketMedio.toFixed(2),
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
          <div className="ml-auto">
            <ExportCsvButton rows={csvRows} filename="relatorio-profissionais.csv" isLoading={isLoading} />
          </div>
        </div>
      </div>

      <ReportKpis cards={kpis} isLoading={isLoading} />
      <ReportTable columns={COLUMNS} rows={data?.rows ?? []} isLoading={isLoading} />
    </div>
  )
}
