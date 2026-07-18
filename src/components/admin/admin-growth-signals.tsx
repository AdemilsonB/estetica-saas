'use client'

import { useGrowthSignals } from '@/hooks/admin/use-growth-signals'

export function AdminGrowthSignals() {
  const { data, isLoading } = useGrowthSignals()

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Recursos bloqueados mais clicados</h2>
        <p className="mb-3 text-xs text-slate-400">Últimos 90 dias — o que mais puxa upgrade.</p>
        {isLoading ? (
          <p className="text-sm text-slate-400">Carregando…</p>
        ) : (data?.topBlockedCapabilities.length ?? 0) === 0 ? (
          <p className="text-sm text-slate-400">Nenhum clique de interesse registrado no período.</p>
        ) : (
          <ul className="space-y-2">
            {data!.topBlockedCapabilities.map((c) => (
              <li key={c.key} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">{c.label}</span>
                <span className="font-semibold text-slate-950">{c.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Tenants perto do limite</h2>
        <p className="mb-3 text-xs text-slate-400">Assinantes ativos/trial com algum limite ≥ 80% — candidatos a expansão.</p>
        {isLoading ? (
          <p className="text-sm text-slate-400">Carregando…</p>
        ) : (data?.tenantsNearLimit.length ?? 0) === 0 ? (
          <p className="text-sm text-slate-400">Nenhum tenant perto do limite.</p>
        ) : (
          <ul className="space-y-3">
            {data!.tenantsNearLimit.map((t) => (
              <li key={t.tenantId} className="text-sm">
                <p className="font-medium text-slate-800">{t.tenantName}</p>
                <p className="text-xs text-slate-500">
                  {t.items.map((i) => `${i.label} ${i.percent}%`).join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
