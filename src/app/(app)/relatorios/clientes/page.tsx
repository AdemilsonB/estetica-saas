'use client'

import { useState } from 'react'
import { usePermissions } from '@/hooks/use-permissions'
import { useCustomersReport } from '@/hooks/reports/use-customers-report'
import { PeriodFilter, type PeriodValue } from '@/components/domain/reports/period-filter'
import { ReportKpis, type KpiCard } from '@/components/domain/reports/report-kpis'
import { ReportTable, type ReportColumn } from '@/components/domain/reports/report-table'
import { ExportCsvButton } from '@/components/domain/reports/export-csv-button'
import { startOfMonth, endOfDay } from '@/lib/dates'

const defaultPeriod: PeriodValue = {
  from: startOfMonth(new Date()).toISOString(),
  to: endOfDay(new Date()).toISOString(),
}

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR')
}

const COLUMNS: ReportColumn[] = [
  { key: 'clienteNome', header: 'Cliente' },
  { key: 'atendimentos', header: 'Atendimentos', align: 'right' },
  { key: 'receita', header: 'Receita', align: 'right', format: (v) => fmtBRL(Number(v)) },
  { key: 'ultimoAtendimento', header: 'Último atendimento', align: 'right', format: (v) => fmtDate(String(v)) },
]

export default function RelatorioClientesPage() {
  const { can } = usePermissions()
  const [period, setPeriod] = useState<PeriodValue>(defaultPeriod)

  const { data, isLoading, isError } = useCustomersReport({
    from: period.from,
    to: period.to,
  })

  if (!can('relatorios', 'view')) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-sm font-medium text-red-700">Sem permissão para visualizar clientes.</p>
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
        { label: 'Clientes ativos', value: data.kpis.totalAtivos },
        { label: 'Novos no período', value: data.kpis.novosNoPeriodo },
        { label: 'Retorno (2+ visitas)', value: data.kpis.retorno },
      ]
    : []

  const csvRows = (data?.rows ?? []).map((r) => ({
    Cliente: r.clienteNome,
    Atendimentos: r.atendimentos,
    'Receita (R$)': r.receita.toFixed(2),
    'Último atendimento': fmtDate(r.ultimoAtendimento),
  }))

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-100 bg-white p-5 space-y-4">
        <PeriodFilter onChange={setPeriod} />
        <div className="flex justify-end">
          <ExportCsvButton rows={csvRows} filename="relatorio-clientes.csv" isLoading={isLoading} />
        </div>
      </div>

      <ReportKpis cards={kpis} isLoading={isLoading} />
      <ReportTable columns={COLUMNS} rows={data?.rows ?? []} isLoading={isLoading} />
    </div>
  )
}
