'use client'

import { AlertTriangle } from 'lucide-react'
import { useUsage } from '@/hooks/billing/use-usage'
import { useUpgradeModal } from '@/stores/upgrade-modal.store'
import type { UsageItem, UsageStatus } from '@/domains/billing/usage.service'

const STATUS_BAR_COLOR: Record<UsageStatus, string> = {
  ok: 'bg-emerald-500',
  warning: 'bg-amber-500',
  exceeded: 'bg-rose-500',
}

const STATUS_TEXT_COLOR: Record<UsageStatus, string> = {
  ok: 'text-emerald-700',
  warning: 'text-amber-700',
  exceeded: 'text-rose-700',
}

/** `max_users` → `users` (o modal de upgrade da Fase B espera o sufixo do limitKey como `limitType`). */
function limitKeyToLimitType(limitKey: string): string {
  return limitKey.replace(/^max_/, '')
}

function UsageCard({ item }: { item: UsageItem }) {
  const openUpgrade = useUpgradeModal((s) => s.openUpgrade)
  const barPercent = Math.min(item.percent, 100)

  return (
    <div className="rounded-2xl border border-white/80 bg-white/85 p-3 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-800">{item.label}</p>
        {!item.unlimited && (
          <span className={`text-xs font-semibold ${STATUS_TEXT_COLOR[item.status]}`}>
            {item.percent}%
          </span>
        )}
      </div>

      <p className="mt-1 text-xs text-slate-500">
        {item.unlimited ? 'Ilimitado' : `${item.current} / ${item.limit}`}
      </p>

      {!item.unlimited && (
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${STATUS_BAR_COLOR[item.status]}`}
            style={{ width: `${barPercent}%` }}
          />
        </div>
      )}

      {item.status !== 'ok' && (
        <button
          type="button"
          onClick={() => openUpgrade({ limitType: limitKeyToLimitType(item.limitKey) })}
          className="mt-3 flex w-full items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-left text-xs font-medium text-white hover:bg-slate-700"
        >
          <AlertTriangle className="size-3.5 shrink-0" />
          Você usou {item.percent}% de {item.label.toLowerCase()} — ver planos
        </button>
      )}
    </div>
  )
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-28 animate-pulse rounded-2xl border border-white/80 bg-white/60" />
      ))}
    </div>
  )
}

export function UsageWidget() {
  const { data, isLoading, isError } = useUsage()

  if (isLoading) return <LoadingGrid />
  if (isError || !data?.items?.length) {
    return (
      <p className="rounded-2xl border border-white/80 bg-white/85 p-4 text-sm text-slate-500">
        Não foi possível carregar o uso do plano no momento.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
      {data.items.map((item) => (
        <UsageCard key={item.limitKey} item={item} />
      ))}
    </div>
  )
}
