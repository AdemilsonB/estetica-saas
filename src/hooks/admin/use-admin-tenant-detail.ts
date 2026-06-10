import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { PlanName, SubscriptionStatus } from '@prisma/client'

export type TenantDetail = {
  id: string
  name: string
  slug: string
  phone: string | null
  address: string | null
  isBlocked: boolean
  blockedReason: string | null
  evolutionConnected: boolean
  evolutionPhone: string | null
  evolutionStatus: string
  createdAt: string
  subscription: {
    id: string
    plan: PlanName
    status: SubscriptionStatus
    trialEndsAt: string | null
    currentPeriodEnd: string
    cancelAtPeriodEnd: boolean
    stripeCustomerId: string | null
    history: Array<{
      id: string
      fromPlan: PlanName | null
      toPlan: PlanName
      fromStatus: SubscriptionStatus | null
      toStatus: SubscriptionStatus
      reason: string | null
      changedBy: string | null
      createdAt: string
    }>
  } | null
  usageSnapshots: Array<{ limitKey: string; count: number; period: string }>
  _count: { appointments: number; notifications: number; customers: number; users: number }
}

async function fetchTenantDetail(tenantId: string): Promise<TenantDetail> {
  const res = await fetch(`/api/admin/tenants/${tenantId}`)
  if (!res.ok) throw new Error('Falha ao carregar tenant')
  return res.json()
}

export function useAdminTenantDetail(tenantId: string) {
  return useQuery({
    queryKey: ['admin', 'tenants', tenantId],
    queryFn: () => fetchTenantDetail(tenantId),
    staleTime: 30_000,
  })
}

export function useBlockTenant(tenantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { blocked: boolean; reason?: string }) =>
      fetch(`/api/admin/tenants/${tenantId}/block`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) throw new Error('Falha ao bloquear')
        return r.json()
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'tenants', tenantId] }),
  })
}

export function useResetTrial(tenantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      fetch(`/api/admin/tenants/${tenantId}/reset-trial`, { method: 'POST' }).then((r) => {
        if (!r.ok) throw new Error('Falha ao resetar trial')
        return r.json()
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'tenants', tenantId] }),
  })
}

export function useChangePlan(tenantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { plan: PlanName; status: SubscriptionStatus; reason?: string }) =>
      fetch(`/api/admin/tenants/${tenantId}/plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) throw new Error('Falha ao alterar plano')
        return r.json()
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'tenants', tenantId] }),
  })
}

export function useSendAdminMessage(tenantId: string) {
  return useMutation({
    mutationFn: (message: string) =>
      fetch(`/api/admin/tenants/${tenantId}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      }).then((r) => {
        if (!r.ok) throw new Error('Falha ao enviar mensagem')
        return r.json()
      }),
  })
}
