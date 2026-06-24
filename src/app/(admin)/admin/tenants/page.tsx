'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAdminTenants } from '@/hooks/admin/use-admin-tenants'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'

const PLAN_COLORS: Record<string, string> = {
  FREE: 'bg-slate-100 text-slate-700',
  STARTER: 'bg-blue-100 text-blue-700',
  PRO: 'bg-violet-100 text-violet-700',
  ENTERPRISE: 'bg-amber-100 text-amber-700',
}

export default function AdminTenantsPage() {
  const { data: tenants = [], isLoading } = useAdminTenants()
  const [search, setSearch] = useState('')

  const filtered = tenants.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-slate-950">Tenants</h1>
        <Input
          placeholder="Buscar por nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-60"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Negócio</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Plano</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Uso (agend.)</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Usuários</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    Nenhum tenant encontrado
                  </td>
                </tr>
              ) : (
                filtered.map((tenant) => (
                  <tr
                    key={tenant.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/tenants/${tenant.id}`}
                        className="flex items-center gap-2"
                      >
                        <span className="font-medium text-slate-900">{tenant.name}</span>
                        {tenant.isBlocked && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                            Bloqueado
                          </span>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PLAN_COLORS[tenant.plan] ?? 'bg-slate-100 text-slate-700'}`}>
                        {tenant.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-32">
                        <div className="flex justify-between text-xs text-slate-500 mb-0.5">
                          <span>{tenant.appointmentsThisMonth}</span>
                          <span>{tenant.appointmentsLimit ?? '∞'}</span>
                        </div>
                        {tenant.appointmentsLimit ? (
                          <div className="h-1.5 w-full rounded-full bg-slate-100">
                            <div
                              className="h-1.5 rounded-full bg-blue-500 transition-all"
                              style={{
                                width: `${Math.min(100, (tenant.appointmentsThisMonth / tenant.appointmentsLimit) * 100)}%`,
                              }}
                            />
                          </div>
                        ) : (
                          <div className="h-1.5 w-full rounded-full bg-slate-100" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{tenant._count.users}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {new Date(tenant.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}
