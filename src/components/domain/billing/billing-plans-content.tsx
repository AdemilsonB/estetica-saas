"use client"

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useBillingStatus } from "@/hooks/billing/use-billing-status"
import { usePlans, type PlanData } from "@/hooks/billing/use-plans"
import { useBillingActions } from "@/hooks/use-billing-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"

const PLAN_ORDER = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE']

function formatLimitValue(value: number, infiniteThreshold: number): string {
  if (value >= infiniteThreshold) return 'Ilimitado'
  return value.toLocaleString('pt-BR')
}

function buildTableRows(plans: PlanData[]) {
  return [
    {
      label: 'Agendamentos/mês',
      getVal: (p: PlanData) => formatLimitValue(p.limits.max_appointments_month ?? 0, 99999),
    },
    {
      label: 'Usuários',
      getVal: (p: PlanData) => formatLimitValue(p.limits.max_users ?? 0, 999),
    },
    {
      label: 'WhatsApp/mês',
      getVal: (p: PlanData) => {
        const v = p.limits.max_whatsapp_month ?? 0
        return v === 0 ? '—' : formatLimitValue(v, 99999)
      },
    },
    {
      label: 'E-mails/mês',
      getVal: (p: PlanData) => {
        const v = p.limits.max_email_month ?? 0
        return v === 0 ? '—' : formatLimitValue(v, 99999)
      },
    },
    {
      label: 'Múltiplas unidades',
      getVal: (p: PlanData) => {
        const v = p.limits.max_units ?? 1
        if (v >= 999) return 'Ilimitado'
        return v <= 1 ? '—' : `${v}`
      },
    },
  ]
}

const STATUS_LABEL: Record<string, string> = {
  TRIALING:  'Trial ativo',
  ACTIVE:    'Ativo',
  PAST_DUE:  'Pagamento pendente',
  CANCELLED: 'Cancelado',
  EXPIRED:   'Expirado',
}

function formatPrice(price: number) {
  return price === 0 ? 'Grátis' : `R$${price.toFixed(0)}/mês`
}

export function BillingPlansContent() {
  const { data, isLoading: statusLoading } = useBillingStatus()
  const { data: plansData, isLoading: plansLoading } = usePlans()
  const { startUpgrade, openPortal, loadingKey, loadingPortal } = useBillingActions()
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const stripe = searchParams.get('stripe')
    if (stripe === 'success') {
      toast.success('Assinatura ativada com sucesso!')
      router.replace('/configuracoes/planos')
    } else if (stripe === 'cancelled') {
      toast.info('Checkout cancelado. Seu plano não foi alterado.')
      router.replace('/configuracoes/planos')
    }
  }, [searchParams, router])

  if (statusLoading || plansLoading) return <div className="h-64 animate-pulse rounded-lg bg-muted" />
  if (!data || !plansData) return null

  const { plans } = plansData
  const tableRows = buildTableRows(plans)

  const trialDaysLeft = data.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(data.trialEndsAt).getTime() - Date.now()) / 86400000))
    : null

  const isPaid = data.status === 'ACTIVE' || data.status === 'TRIALING'
  const hasStripeSubscription = !!data.stripeSubId
  const isLoadingAction = loadingKey !== null

  // Para upgrades, considera o plano original quando o trial expirou (FREE é plano efetivo, não contratado)
  const displayPlan = data.isExpiredTrial && data.originalPlan ? data.originalPlan : data.plan
  const currentPlanIndex = PLAN_ORDER.indexOf(data.isExpiredTrial ? 'FREE' : data.plan)
  const upgradePlans = plans.filter(p => PLAN_ORDER.indexOf(p.name) > currentPlanIndex)
  const canUpgradeViaCheckout = upgradePlans.length > 0 && !hasStripeSubscription
  const canUpgradeViaPortal = upgradePlans.length > 0 && hasStripeSubscription

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Plano atual: {displayPlan}
            <Badge variant={isPaid ? 'default' : 'destructive'}>
              {data.isExpiredTrial ? 'Trial encerrado' : (STATUS_LABEL[data.status] ?? data.status)}
            </Badge>
          </CardTitle>
          {data.isExpiredTrial && (
            <CardDescription>
              Seu trial do plano {data.originalPlan} encerrou. Assine para continuar com acesso completo.
            </CardDescription>
          )}
          {trialDaysLeft !== null && data.status === 'TRIALING' && !data.isExpiredTrial && (
            <CardDescription>
              {trialDaysLeft > 0
                ? `Trial termina em ${trialDaysLeft} dia(s)`
                : 'Trial encerrado'}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Agendamentos este mês</p>
            <p className="font-medium">
              {data.limits.appointments_month.current} /{' '}
              {data.limits.appointments_month.max === -1 ? 'Ilimitado' : data.limits.appointments_month.max}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Usuários</p>
            <p className="font-medium">
              {data.limits.users.current} /{' '}
              {data.limits.users.max === -1 ? 'Ilimitado' : data.limits.users.max}
            </p>
          </div>
        </CardContent>
        {hasStripeSubscription && (
          <CardFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={openPortal}
              disabled={loadingPortal}
            >
              {loadingPortal ? 'Abrindo...' : 'Gerenciar assinatura / Faturas'}
            </Button>
          </CardFooter>
        )}
      </Card>

      <div
        className="overflow-x-auto rounded-lg border"
        style={{
          maskImage: 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)',
          WebkitMaskImage: 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)',
        }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-3 text-left font-medium">Recurso</th>
              {plans.map(plan => (
                <th key={plan.name} className="p-3 text-center font-medium">
                  {plan.displayName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="p-3">{row.label}</td>
                {plans.map(plan => (
                  <td key={plan.name} className="p-3 text-center">
                    {row.getVal(plan)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canUpgradeViaCheckout && (
        <div className="space-y-4">
          <p className="text-sm font-medium">Fazer upgrade do plano</p>
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
            {upgradePlans.map(plan => (
              <div key={plan.name} className="flex flex-col gap-2 rounded-lg border p-4 sm:w-56">
                <div>
                  <p className="text-sm font-semibold">{plan.displayName}</p>
                  <p className="text-xs text-muted-foreground">{formatPrice(plan.price)}</p>
                </div>
                <Button
                  size="sm"
                  variant={plan.name === 'PRO' ? 'default' : 'outline'}
                  onClick={() => startUpgrade(plan.name, true)}
                  disabled={isLoadingAction}
                  className="w-full"
                >
                  {loadingKey === `${plan.name}_direct` ? 'Redirecionando...' : 'Assinar agora'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {canUpgradeViaPortal && (
        <div className="rounded-lg border p-4 space-y-2">
          <p className="text-sm font-medium">Fazer upgrade do plano</p>
          <p className="text-sm text-muted-foreground">
            Para mudar para um plano superior, acesse o portal de assinatura e selecione o novo plano.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={openPortal}
            disabled={loadingPortal}
          >
            {loadingPortal ? 'Abrindo...' : 'Gerenciar / Fazer upgrade'}
          </Button>
        </div>
      )}

      {upgradePlans.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Você está no plano máximo disponível. Entre em contato com o suporte para necessidades especiais.
        </p>
      )}
    </div>
  )
}
