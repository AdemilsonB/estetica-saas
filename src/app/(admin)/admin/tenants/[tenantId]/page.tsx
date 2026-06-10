'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { PlanName, SubscriptionStatus } from '@prisma/client'
import { ArrowLeft, Shield, ShieldOff, RotateCcw, MessageSquare, Eye } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  useAdminTenantDetail,
  useBlockTenant,
  useResetTrial,
  useChangePlan,
  useSendAdminMessage,
} from '@/hooks/admin/use-admin-tenant-detail'
import { storeImpersonationSession } from '@/lib/impersonation-client'

const PLAN_LABELS: Record<string, string> = {
  FREE: 'Free', STARTER: 'Starter', PRO: 'Pro', ENTERPRISE: 'Enterprise',
}

const STATUS_LABELS: Record<string, string> = {
  TRIALING: 'Trial',
  ACTIVE: 'Ativo',
  PAST_DUE: 'Pagamento pendente',
  CANCELLED: 'Cancelado',
  EXPIRED: 'Expirado',
}

const STATUS_COLORS: Record<string, string> = {
  TRIALING: 'bg-blue-100 text-blue-700',
  ACTIVE: 'bg-green-100 text-green-700',
  PAST_DUE: 'bg-orange-100 text-orange-700',
  CANCELLED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-slate-100 text-slate-700',
}


export default function TenantDetailPage() {
  const params = useParams<{ tenantId: string }>()
  const router = useRouter()
  const { data: tenant, isLoading } = useAdminTenantDetail(params.tenantId)

  const blockMutation = useBlockTenant(params.tenantId)
  const resetTrialMutation = useResetTrial(params.tenantId)
  const changePlanMutation = useChangePlan(params.tenantId)
  const sendMessageMutation = useSendAdminMessage(params.tenantId)

  const [blockDialog, setBlockDialog] = useState(false)
  const [blockReason, setBlockReason] = useState('')
  const [messageDialog, setMessageDialog] = useState(false)
  const [message, setMessage] = useState('')
  const [selectedPlan, setSelectedPlan] = useState<string>('')
  const [selectedStatus, setSelectedStatus] = useState<string>('')

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  if (!tenant) {
    return <p className="text-slate-500">Tenant não encontrado.</p>
  }

  const sub = tenant.subscription
  const currentPlan = sub?.plan ?? 'FREE'
  const currentStatus = sub?.status ?? 'ACTIVE'

  const handleImpersonate = async () => {
    const res = await fetch(`/api/admin/tenants/${params.tenantId}/impersonate`, {
      method: 'POST',
    })
    if (!res.ok) {
      alert('Falha ao iniciar impersonação.')
      return
    }
    const data = await res.json() as { token: string; tenantId: string; tenantName: string }
    storeImpersonationSession(data)
    router.push('/agenda')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/tenants" className="text-slate-400 hover:text-slate-700">
            <ArrowLeft className="size-4" />
          </Link>
          <h1 className="text-xl font-semibold text-slate-950">{tenant.name}</h1>
          {tenant.isBlocked && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              Bloqueado
            </span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleImpersonate} className="gap-1.5">
          <Eye className="size-4" />
          Visualizar como dono
        </Button>
      </div>

      {/* Info + Subscription */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Dados do negócio */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Dados do negócio</h2>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Slug</dt>
              <dd className="font-mono text-slate-900">{tenant.slug}</dd>
            </div>
            {tenant.phone && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Telefone</dt>
                <dd className="text-slate-900">{tenant.phone}</dd>
              </div>
            )}
            {tenant.address && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Endereço</dt>
                <dd className="text-slate-900 text-right max-w-48 truncate">{tenant.address}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-slate-500">Cadastro</dt>
              <dd className="text-slate-900">{new Date(tenant.createdAt).toLocaleDateString('pt-BR')}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">WhatsApp</dt>
              <dd>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    tenant.evolutionConnected
                      ? 'bg-green-100 text-green-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {tenant.evolutionConnected
                    ? `Conectado${tenant.evolutionPhone ? ` (${tenant.evolutionPhone})` : ''}`
                    : 'Desconectado'}
                </span>
              </dd>
            </div>
          </dl>
        </div>

        {/* Assinatura */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Assinatura</h2>
          {sub ? (
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Plano</dt>
                <dd className="font-medium text-slate-900">{PLAN_LABELS[sub.plan] ?? sub.plan}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Status</dt>
                <dd>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[sub.status] ?? 'bg-slate-100 text-slate-700'}`}
                  >
                    {STATUS_LABELS[sub.status] ?? sub.status}
                  </span>
                </dd>
              </div>
              {sub.trialEndsAt && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Trial até</dt>
                  <dd className="text-slate-900">{new Date(sub.trialEndsAt).toLocaleDateString('pt-BR')}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-slate-500">Período até</dt>
                <dd className="text-slate-900">{new Date(sub.currentPeriodEnd).toLocaleDateString('pt-BR')}</dd>
              </div>
              {sub.stripeCustomerId && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Stripe</dt>
                  <dd className="font-mono text-xs text-slate-500">{sub.stripeCustomerId}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-slate-400">Sem assinatura</p>
          )}
        </div>
      </div>

      {/* Métricas do mês */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Métricas deste mês</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Agendamentos', value: tenant._count.appointments },
            { label: 'WhatsApp enviados', value: tenant._count.notifications },
            { label: 'Clientes', value: tenant._count.customers },
            { label: 'Usuários', value: tenant._count.users },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border border-slate-100 p-3 text-center">
              <p className="text-xl font-bold text-slate-950">{value}</p>
              <p className="mt-0.5 text-xs text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Ações */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-5">
        <h2 className="text-sm font-semibold text-slate-700">Ações manuais</h2>

        {/* Mudar plano */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500">Mudar plano / status</p>
          <div className="flex flex-wrap gap-2">
            <Select
              value={selectedPlan || currentPlan}
              onValueChange={(v) => setSelectedPlan(v)}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PLAN_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={selectedStatus || currentStatus}
              onValueChange={(v) => setSelectedStatus(v)}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={changePlanMutation.isPending || (!selectedPlan && !selectedStatus)}
              onClick={() => {
                const plan = (selectedPlan || currentPlan) as PlanName
                const status = (selectedStatus || currentStatus) as SubscriptionStatus
                changePlanMutation.mutate({ plan, status })
              }}
            >
              Aplicar
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={resetTrialMutation.isPending}
            onClick={() => {
              if (confirm('Resetar trial por 14 dias?')) resetTrialMutation.mutate()
            }}
            className="gap-1.5"
          >
            <RotateCcw className="size-3.5" />
            Resetar trial (+14 dias)
          </Button>

          {tenant.isBlocked ? (
            <Button
              variant="outline"
              size="sm"
              disabled={blockMutation.isPending}
              onClick={() => blockMutation.mutate({ blocked: false })}
              className="gap-1.5 text-green-700 border-green-300 hover:bg-green-50"
            >
              <ShieldOff className="size-3.5" />
              Desbloquear tenant
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBlockDialog(true)}
              className="gap-1.5 text-red-700 border-red-300 hover:bg-red-50"
            >
              <Shield className="size-3.5" />
              Bloquear tenant
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setMessageDialog(true)}
            className="gap-1.5"
          >
            <MessageSquare className="size-3.5" />
            Enviar mensagem WA
          </Button>
        </div>
      </div>

      {/* Histórico de plano */}
      {sub?.history && sub.history.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Histórico de assinatura</h2>
          <div className="space-y-1">
            {sub.history.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs"
              >
                <span className="text-slate-700">
                  {h.fromPlan ? `${PLAN_LABELS[h.fromPlan] ?? h.fromPlan} → ` : ''}
                  {PLAN_LABELS[h.toPlan] ?? h.toPlan}
                  {h.reason && <span className="ml-1 text-slate-400">({h.reason})</span>}
                </span>
                <span className="text-slate-400">
                  {new Date(h.createdAt).toLocaleDateString('pt-BR')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dialog: Bloquear */}
      <Dialog open={blockDialog} onOpenChange={setBlockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bloquear tenant</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              O tenant <strong>{tenant.name}</strong> ficará inacessível para todos os usuários.
            </p>
            <Input
              placeholder="Motivo (opcional)"
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockDialog(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={blockMutation.isPending}
              onClick={() => {
                blockMutation.mutate({ blocked: true, reason: blockReason || undefined })
                setBlockDialog(false)
              }}
            >
              Bloquear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Enviar mensagem */}
      <Dialog open={messageDialog} onOpenChange={setMessageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar mensagem via WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-slate-500">Enviada para o proprietário do negócio.</p>
            <Textarea
              placeholder="Digite a mensagem..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMessageDialog(false)}>Cancelar</Button>
            <Button
              disabled={sendMessageMutation.isPending || !message.trim()}
              onClick={() => {
                sendMessageMutation.mutate(message, {
                  onSuccess: () => {
                    setMessageDialog(false)
                    setMessage('')
                  },
                })
              }}
            >
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
