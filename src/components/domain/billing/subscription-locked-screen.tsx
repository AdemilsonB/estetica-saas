'use client'

import { useEffect, useState } from 'react'
import { Loader2, LogOut, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createSupabaseBrowserClient } from '@/integrations/supabase/client'
import { SharedPlanCard, type SharedPlanData } from '@/components/domain/billing/plan-card-shared'

type ApiPlan = {
  name: string
  displayName: string
  price: number
  description: string
  trialDays: number
}

function apiPlanToShared(plan: ApiPlan, isPopular: boolean): SharedPlanData {
  return {
    name: plan.name,
    displayName: plan.displayName,
    price: plan.price,
    trialDays: plan.trialDays,
    isPopular,
    features: plan.description
      ? plan.description.split('\n').map((l) => l.trim()).filter(Boolean)
      : [],
  }
}

type Props = {
  isOwner: boolean
  originalPlan: string | null
}

export function SubscriptionLockedScreen({ isOwner, originalPlan }: Props) {
  const [plans, setPlans] = useState<ApiPlan[]>([])
  const [plansLoading, setPlansLoading] = useState(true)
  const [loadingKey, setLoadingKey] = useState<string | null>(null)

  useEffect(() => {
    if (!isOwner) return
    fetch('/api/public/plans')
      .then((r) => r.json())
      .then((data) => setPlans(data as ApiPlan[]))
      .catch(() => toast.error('Erro ao carregar planos.'))
      .finally(() => setPlansLoading(false))
  }, [isOwner])

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  async function handleSelectPlan(planName: string, skipTrial = false) {
    if (!skipTrial) {
      setLoadingKey(`${planName}_trial`)
      try {
        const res = await fetch('/api/billing/start-trial', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planName }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          toast.error(err?.message ?? 'Erro ao iniciar trial. Tente novamente.')
          return
        }
        toast.success('Trial reativado! Bem-vindo de volta.')
        window.location.reload()
      } catch {
        toast.error('Erro de conexão. Tente novamente.')
      } finally {
        setLoadingKey(null)
      }
      return
    }

    setLoadingKey(`${planName}_direct`)
    try {
      const origin = window.location.origin
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planName,
          skipTrial: true,
          successUrl: `${origin}/dashboard?stripe=success`,
          cancelUrl: `${origin}/dashboard?stripe=cancelled`,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err?.message ?? 'Erro ao iniciar checkout. Tente novamente.')
        return
      }
      const { checkoutUrl } = await res.json()
      window.location.href = checkoutUrl
    } catch {
      toast.error('Erro de conexão. Tente novamente.')
    } finally {
      setLoadingKey(null)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 sm:p-8">
      <div className="w-full max-w-5xl space-y-6 sm:space-y-8">
        <div className="flex flex-col items-center gap-3 text-center sm:gap-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-pink-600">
            <ShieldAlert className="size-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Sua assinatura expirou
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {originalPlan
                ? `Seu trial/assinatura do plano ${originalPlan} encerrou. Assine para voltar a ter acesso completo.`
                : 'Assine um plano para ter acesso ao painel.'}
            </p>
          </div>
        </div>

        {!isOwner ? (
          <div className="mx-auto max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Apenas o proprietário do negócio pode renovar a assinatura.
              Peça para ele acessar e escolher um plano.
            </p>
            <Button variant="outline" className="w-full" onClick={handleLogout}>
              <LogOut className="mr-2 size-4" />
              Sair da conta
            </Button>
          </div>
        ) : plansLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => (
                <SharedPlanCard
                  key={plan.name}
                  plan={apiPlanToShared(plan, plan.name === 'PRO')}
                  action={{ type: 'onboarding', onSelect: handleSelectPlan, loadingKey }}
                />
              ))}
            </div>
            <div className="flex justify-center">
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={handleLogout}>
                <LogOut className="mr-2 size-4" />
                Sair da conta
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
