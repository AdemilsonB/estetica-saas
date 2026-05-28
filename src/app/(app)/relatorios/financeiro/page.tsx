'use client'

import { useState } from 'react'
import { usePermissions } from '@/hooks/use-permissions'
import { useFinancialReport } from '@/hooks/reports/use-financial-report'
import { PeriodFilter, type PeriodValue } from '@/components/domain/reports/period-filter'
import { ReportKpis, type KpiCard } from '@/components/domain/reports/report-kpis'
import { ReportTable, type ReportColumn } from '@/components/domain/reports/report-table'
import { ExportCsvButton } from '@/components/domain/reports/export-csv-button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { startOfMonth, endOfDay } from '@/lib/dates'

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const defaultPeriod: PeriodValue = {
  from: startOfMonth(new Date()).toISOString(),
  to: endOfDay(new Date()).toISOString(),
}

const COLUMNS: ReportColumn[] = [
  { key: 'label', header: 'Nome' },
  { key: 'quantidade', header: 'Transações', align: 'right' },
  { key: 'receita', header: 'Receita', align: 'right', format: (v) => fmtBRL(Number(v)) },
]

export default function RelatorioFinanceiroPage() {
  const { can } = usePermissions()
  const [period, setPeriod] = useState<PeriodValue>(defaultPeriod)
  const [groupBy, setGroupBy] = useState<'profissional' | 'servico'>('servico')
  const [type, setType] = useState<'INCOME' | 'EXPENSE' | 'all'>('all')

  const { data, isLoading, isError } = useFinancialReport({
    from: period.from,
    to: period.to,
    groupBy,
    type: type === 'all' ? undefined : type,
  })

  if (!can('financial:view')) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-sm font-medium text-red-700">Sem permissão para visualizar dados financeiros.</p>
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
        { label: 'Receita', value: fmtBRL(data.kpis.receita) },
        { label: 'Despesa', value: fmtBRL(data.kpis.despesa) },
        { label: 'Saldo', value: fmtBRL(data.kpis.saldo) },
        { label: 'Ticket médio', value: fmtBRL(data.kpis.ticketMedio) },
      ]
    : []

  const csvRows = (data?.rows ?? []).map((r) => ({
    Nome: r.label,
    Transações: r.quantidade,
    'Receita (R$)': r.receita.toFixed(2),
  }))

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-100 bg-white p-5 space-y-4">
        <PeriodFilter onChange={setPeriod} />
        <div className="flex flex-wrap gap-3">
          <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Tipo: Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="INCOME">Receita</SelectItem>
              <SelectItem value="EXPENSE">Despesa</SelectItem>
            </SelectContent>
          </Select>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Agrupar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="servico">Agrupar por serviço</SelectItem>
              <SelectItem value="profissional">Agrupar por profissional</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto">
            <ExportCsvButton rows={csvRows} filename="relatorio-financeiro.csv" isLoading={isLoading} />
          </div>
        </div>
      </div>

      <ReportKpis cards={kpis} isLoading={isLoading} />
      <ReportTable columns={COLUMNS} rows={data?.rows ?? []} isLoading={isLoading} />
    </div>
  )
}
