'use client'

import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { usePermissions } from '@/hooks/use-permissions'
import { useCustomersReport } from '@/hooks/reports/use-customers-report'
import { useInactiveCustomers } from '@/hooks/reports/use-inactive-customers'
import { FeatureLockedError } from '@/hooks/reports/report-fetcher'
import { PeriodFilter, type PeriodValue } from '@/components/domain/reports/period-filter'
import { ReportKpis, type KpiCard } from '@/components/domain/reports/report-kpis'
import { ReportTable, type ReportColumn } from '@/components/domain/reports/report-table'
import { ReportPagination } from '@/components/domain/reports/report-pagination'
import { ReportProfessionalFilter } from '@/components/domain/reports/report-professional-filter'
import { LockedFeatureCard } from '@/components/domain/reports/locked-feature-card'
import { ExportCsvButton } from '@/components/domain/reports/export-csv-button'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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

// Link wa.me: só dígitos; prefixa DDI 55 quando o telefone veio sem código do país.
function whatsappHref(telefone: string): string {
  const digitos = telefone.replace(/\D/g, '')
  return `https://wa.me/${digitos.length <= 11 ? `55${digitos}` : digitos}`
}

const RANKING_COLUMNS: ReportColumn[] = [
  { key: 'clienteNome', header: 'Cliente' },
  {
    key: 'atendimentos',
    header: 'Atend.',
    headerHint: 'Atendimentos: quantidade de vezes que o cliente foi atendido no período selecionado.',
    align: 'right',
  },
  { key: 'receita', header: 'Receita', align: 'right', format: (v) => fmtBRL(Number(v)) },
  { key: 'ticketMedio', header: 'Ticket médio', align: 'right', format: (v) => fmtBRL(Number(v)) },
  { key: 'ultimoAtendimento', header: 'Último atendimento', align: 'right', format: (v) => fmtDate(String(v)) },
]

const SORT_LABELS = {
  receita: 'Maior faturamento',
  atendimentos: 'Mais frequentes',
  ticketMedio: 'Maior ticket médio',
} as const

type SortBy = keyof typeof SORT_LABELS

const DIAS_INATIVIDADE = [30, 60, 90, 180] as const

export function ClientesClient() {
  const { can } = usePermissions()
  const [period, setPeriod] = useState<PeriodValue>(defaultPeriod)
  const [sortBy, setSortBy] = useState<SortBy>('receita')
  const [page, setPage] = useState(1)
  const [dias, setDias] = useState<number>(90)
  const [pageInativos, setPageInativos] = useState(1)
  const [professionalId, setProfessionalId] = useState<string>('all')

  const ranking = useCustomersReport({
    from: period.from,
    to: period.to,
    sortBy,
    page,
    professionalId: professionalId === 'all' ? undefined : professionalId,
  })
  const inativos = useInactiveCustomers({ days: dias, page: pageInativos })

  if (!can('relatorios', 'view')) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-sm font-medium text-red-700">Sem permissão para visualizar clientes.</p>
      </div>
    )
  }

  const kpis: KpiCard[] = ranking.data
    ? [
        { label: 'Clientes ativos', value: ranking.data.kpis.totalAtivos, delta: ranking.data.kpis.variacao.totalAtivos },
        { label: 'Novos no período', value: ranking.data.kpis.novosNoPeriodo, delta: ranking.data.kpis.variacao.novosNoPeriodo },
        { label: 'Retorno (2+ visitas)', value: ranking.data.kpis.retorno, delta: ranking.data.kpis.variacao.retorno },
      ]
    : []

  const rankingCsv = (ranking.data?.rows ?? []).map((r) => ({
    Cliente: r.clienteNome,
    Atendimentos: r.atendimentos,
    'Receita (R$)': r.receita.toFixed(2),
    'Ticket médio (R$)': r.ticketMedio.toFixed(2),
    'Último atendimento': fmtDate(r.ultimoAtendimento),
  }))

  const inativosCsv = (inativos.data?.rows ?? []).map((r) => ({
    Cliente: r.nome,
    Telefone: r.telefone ?? '',
    'Último atendimento': fmtDate(r.ultimoAtendimento),
    'Dias inativo': r.diasInativo,
    'Valor histórico (R$)': r.valorHistorico.toFixed(2),
  }))

  const inativosBloqueado = inativos.error instanceof FeatureLockedError

  return (
    <div className="space-y-6">
      <Tabs defaultValue="ranking">
        <TabsList className="grid w-full grid-cols-2 sm:w-auto">
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
          <TabsTrigger value="inativos">Inativos</TabsTrigger>
        </TabsList>

        <TabsContent value="ranking" className="mt-4 space-y-6">
          <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5">
            <PeriodFilter onChange={(v) => { setPeriod(v); setPage(1) }} />
            <div className="flex flex-wrap items-center gap-3">
              <Select value={sortBy} onValueChange={(v) => { setSortBy(v as SortBy); setPage(1) }}>
                <SelectTrigger className="w-full sm:w-52">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SORT_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <ReportProfessionalFilter value={professionalId} onChange={setProfessionalId} />
              <div className="ml-auto">
                <ExportCsvButton rows={rankingCsv} filename="relatorio-clientes.csv" isLoading={ranking.isLoading} />
              </div>
            </div>
          </div>

          {ranking.isError ? (
            <p className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-600">
              Erro ao carregar relatório. Tente recarregar a página.
            </p>
          ) : (
            <>
              <ReportKpis cards={kpis} isLoading={ranking.isLoading} />
              <ReportTable
                columns={RANKING_COLUMNS}
                rows={ranking.data?.rows ?? []}
                isLoading={ranking.isLoading}
                emptyMessage="Nenhum atendimento neste período."
              />
              <ReportPagination
                page={ranking.data?.page ?? page}
                pageSize={ranking.data?.pageSize ?? 20}
                total={ranking.data?.total ?? 0}
                onPageChange={setPage}
                isLoading={ranking.isFetching}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="inativos" className="mt-4 space-y-6">
          {inativosBloqueado ? (
            <LockedFeatureCard
              title="Clientes inativos é um relatório avançado"
              description="Encontre quem parou de agendar — priorizado por quanto já gastou — e traga de volta pelo WhatsApp com um plano superior."
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-white p-5">
                <Select
                  value={String(dias)}
                  onValueChange={(v) => { setDias(Number(v)); setPageInativos(1) }}
                >
                  <SelectTrigger className="w-full sm:w-56">
                    <SelectValue placeholder="Sem agendar há" />
                  </SelectTrigger>
                  <SelectContent>
                    {DIAS_INATIVIDADE.map((d) => (
                      <SelectItem key={d} value={String(d)}>Sem agendar há {d}+ dias</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="ml-auto">
                  <ExportCsvButton rows={inativosCsv} filename="clientes-inativos.csv" isLoading={inativos.isLoading} />
                </div>
              </div>

              {inativos.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full rounded-xl" />
                  ))}
                </div>
              ) : inativos.isError ? (
                <p className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-600">
                  Erro ao carregar clientes inativos.
                </p>
              ) : (inativos.data?.rows.length ?? 0) === 0 ? (
                <p className="rounded-2xl border border-slate-100 bg-slate-50 p-8 text-center text-sm text-slate-500">
                  Nenhum cliente inativo há {dias}+ dias. 🎉
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-2xl border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Cliente</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Último atendimento</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Dias inativo</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Valor histórico</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Contato</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {inativos.data?.rows.map((r) => (
                          <tr key={r.clienteId} className="bg-white transition hover:bg-slate-50">
                            <td className="px-4 py-3 text-slate-700">{r.nome}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-slate-700">{fmtDate(r.ultimoAtendimento)}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-slate-700">{r.diasInativo}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-slate-700">{fmtBRL(r.valorHistorico)}</td>
                            <td className="px-4 py-3 text-right">
                              {r.telefone ? (
                                <Button asChild size="sm" variant="ghost" className="h-8 gap-1.5 text-emerald-700 hover:text-emerald-800">
                                  <a href={whatsappHref(r.telefone)} target="_blank" rel="noopener noreferrer">
                                    <MessageCircle className="size-4" />
                                    <span className="hidden sm:inline">WhatsApp</span>
                                  </a>
                                </Button>
                              ) : (
                                <span className="text-xs text-slate-400">sem telefone</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <ReportPagination
                    page={inativos.data?.page ?? pageInativos}
                    pageSize={inativos.data?.pageSize ?? 20}
                    total={inativos.data?.total ?? 0}
                    onPageChange={setPageInativos}
                    isLoading={inativos.isFetching}
                  />
                </>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
