"use client"

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useBillingStatus } from "@/hooks/billing/use-billing-status"
import { useBillingActions } from "@/hooks/use-billing-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"

const PLAN_FEATURES_TABLE = [
  { feature: "Agendamentos/mês",     free: "50",  starter: "300",  pro: "2.000" },
  { feature: "Usuários",             free: "2",   starter: "5",    pro: "20"   },
  { feature: "WhatsApp básico",      free: "—",   starter: "✓",    pro: "✓"   },
  { feature: "Relatórios básicos",   free: "✓",   starter: "✓",    pro: "✓"   },
  { feature: "Relatórios avançados", free: "—",   starter: "—",    pro: "✓"   },
  { feature: "Campanhas",            free: "—",   starter: "✓",    pro: "✓"   },
]

const STATUS_LABEL: Record<string, string> = {
  TRIALING:  "Trial ativo",
  ACTIVE:    "Ativo",
  PAST_DUE:  "Pagamento pendente",
  CANCELLED: "Cancelado",
  EXPIRED:   "Expirado",
}

const UPGRADEABLE_PLANS = [
  { name: 'STARTER', label: 'Starter — R$29/mês' },
  { name: 'PRO',     label: 'Pro — R$59/mês' },
]

export function BillingPlansContent() {
  const { data, isLoading } = useBillingStatus()
  const { startUpgrade, openPortal, loadingPlan, loadingPortal } = useBillingActions()
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

  if (isLoading) return <div className="h-64 animate-pulse rounded-lg bg-muted" />
  if (!data) return null

  const trialDaysLeft = data.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(data.trialEndsAt).getTime() - Date.now()) / 86400000))
    : null

  const isPaid = data.status === 'ACTIVE' || data.status === 'TRIALING'
  const isCurrentPlanFree = data.plan === 'FREE'
  const hasStripeSubscription = !!data.stripeSubId

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Plano atual: {data.plan}
            <Badge variant={isPaid ? "default" : "destructive"}>
              {STATUS_LABEL[data.status] ?? data.status}
            </Badge>
          </CardTitle>
          {trialDaysLeft !== null && data.status === "TRIALING" && (
            <CardDescription>
              {trialDaysLeft > 0
                ? `Trial termina em ${trialDaysLeft} dia(s)`
                : "Trial encerrado"}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Agendamentos este mês</p>
            <p className="font-medium">
              {data.limits.appointments_month.current} /{" "}
              {data.limits.appointments_month.max === -1 ? "Ilimitado" : data.limits.appointments_month.max}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Usuários</p>
            <p className="font-medium">
              {data.limits.users.current} /{" "}
              {data.limits.users.max === -1 ? "Ilimitado" : data.limits.users.max}
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
              <th className="p-3 text-center font-medium">Free</th>
              <th className="p-3 text-center font-medium">Starter</th>
              <th className="p-3 text-center font-medium">Pro</th>
            </tr>
          </thead>
          <tbody>
            {PLAN_FEATURES_TABLE.map((row, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="p-3">{row.feature}</td>
                <td className="p-3 text-center text-muted-foreground">{row.free}</td>
                <td className="p-3 text-center">{row.starter}</td>
                <td className="p-3 text-center">{row.pro}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isCurrentPlanFree && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Fazer upgrade do plano</p>
          <div className="flex flex-wrap gap-3">
            {UPGRADEABLE_PLANS.map(plan => (
              <Button
                key={plan.name}
                onClick={() => startUpgrade(plan.name)}
                disabled={loadingPlan !== null}
                variant={plan.name === 'PRO' ? 'default' : 'outline'}
              >
                {loadingPlan === plan.name ? 'Redirecionando...' : plan.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {!isCurrentPlanFree && !hasStripeSubscription && (
        <p className="text-sm text-muted-foreground">
          Para gerenciar sua assinatura, entre em contato com o suporte via WhatsApp.
        </p>
      )}
    </div>
  )
}
