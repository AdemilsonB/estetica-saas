'use client'

import { CalendarCheck, DollarSign, TrendingUp, Users } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useDashboardMetrics, type AppointmentStatus } from '@/hooks/dashboard/use-dashboard-metrics'

const STATUS_CONFIG: Record<AppointmentStatus, { label: string; color: string }> = {
  SCHEDULED:  { label: 'Agendado',   color: 'bg-blue-100 text-blue-700' },
  CONFIRMED:  { label: 'Confirmado', color: 'bg-indigo-100 text-indigo-700' },
  COMPLETED:  { label: 'Concluído',  color: 'bg-emerald-100 text-emerald-700' },
  CANCELLED:  { label: 'Cancelado',  color: 'bg-slate-100 text-slate-500' },
  NO_SHOW:    { label: 'Faltou',     color: 'bg-rose-100 text-rose-600' },
}

const STATUS_ORDER: AppointmentStatus[] = [
  'SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW',
]

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/85 p-3 sm:p-5 shadow-sm">
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
      {children}
    </p>
  )
}

export function DashboardMetrics() {
  const { data, isLoading, isError } = useDashboardMetrics()

  if (isError) {
    return (
      <p className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-600">
        Erro ao carregar métricas. Tente recarregar a página.
      </p>
    )
  }

  const total = data
    ? Object.values(data.byStatus).reduce((s, n) => s + n, 0)
    : 0

  const maxCount = data?.byProfessional[0]?.count ?? 1

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Linha 1 — 4 cards de resumo */}
      <div className="grid gap-2 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="inline-flex rounded-xl bg-blue-50 p-2 text-blue-600">
            <CalendarCheck className="size-4" />
          </div>
          {isLoading ? (
            <>
              <Skeleton className="mt-4 h-7 w-16" />
              <Skeleton className="mt-1 h-3 w-24" />
            </>
          ) : (
            <>
              <p className="mt-3 sm:mt-4 text-xl sm:text-2xl font-semibold text-slate-950">{total}</p>
              <p className="mt-0.5 text-xs text-slate-500">agendamentos hoje</p>
            </>
          )}
          <p className="mt-2 sm:mt-3 hidden sm:block text-xs font-medium text-slate-400">Total do dia</p>
        </Card>

        <Card>
          <div className="inline-flex rounded-xl bg-emerald-50 p-2 text-emerald-600">
            <Users className="size-4" />
          </div>
          {isLoading ? (
            <>
              <Skeleton className="mt-4 h-7 w-16" />
              <Skeleton className="mt-1 h-3 w-24" />
            </>
          ) : (
            <>
              <p className="mt-3 sm:mt-4 text-xl sm:text-2xl font-semibold text-slate-950">
                {data?.byStatus.COMPLETED ?? 0}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">hoje</p>
            </>
          )}
          <p className="mt-2 sm:mt-3 hidden sm:block text-xs font-medium text-slate-400">Concluídos</p>
        </Card>

        <Card>
          <div className="inline-flex rounded-xl bg-rose-50 p-2 text-rose-600">
            <DollarSign className="size-4" />
          </div>
          {isLoading ? (
            <>
              <Skeleton className="mt-4 h-7 w-24" />
              <Skeleton className="mt-1 h-3 w-28" />
            </>
          ) : (
            <>
              <p className="mt-3 sm:mt-4 text-xl sm:text-2xl font-semibold text-slate-950">
                R${fmt(data?.revenue.today ?? 0)}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">atendimentos concluídos</p>
            </>
          )}
          <p className="mt-2 sm:mt-3 hidden sm:block text-xs font-medium text-slate-400">Receita do dia</p>
        </Card>

        <Card>
          <div className="inline-flex rounded-xl bg-purple-50 p-2 text-purple-600">
            <TrendingUp className="size-4" />
          </div>
          {isLoading ? (
            <>
              <Skeleton className="mt-4 h-7 w-24" />
              <Skeleton className="mt-1 h-3 w-28" />
            </>
          ) : (
            <>
              <p className="mt-3 sm:mt-4 text-xl sm:text-2xl font-semibold text-slate-950">
                R${fmt(data?.revenue.month ?? 0)}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">mês atual</p>
            </>
          )}
          <p className="mt-2 sm:mt-3 hidden sm:block text-xs font-medium text-slate-400">Receita do mês</p>
        </Card>
      </div>

      {/* Linha 2 — Status + Profissionais */}
      <div className="grid gap-2 sm:gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle>Agendamentos por status</SectionTitle>
          {isLoading ? (
            <div className="flex flex-wrap gap-2">
              {STATUS_ORDER.map((s) => (
                <Skeleton key={s} className="h-7 w-24 rounded-full" />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {STATUS_ORDER.map((status) => {
                const cfg = STATUS_CONFIG[status]
                const count = data?.byStatus[status] ?? 0
                return (
                  <span
                    key={status}
                    className={`inline-flex items-center gap-1 sm:gap-1.5 rounded-full px-2 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm font-medium ${cfg.color}`}
                  >
                    <span className="font-semibold">{count}</span>
                    {cfg.label}
                  </span>
                )
              })}
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle>Ocupação por profissional</SectionTitle>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              ))}
            </div>
          ) : !data || data.byProfessional.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum agendamento hoje.</p>
          ) : (
            <div className="space-y-3">
              {data.byProfessional.map((prof) => (
                <div key={prof.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{prof.name}</span>
                    <span className="text-slate-400">
                      {prof.count} {prof.count === 1 ? 'atendimento' : 'atendimentos'}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-rose-400 transition-all"
                      style={{ width: `${(prof.count / maxCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
