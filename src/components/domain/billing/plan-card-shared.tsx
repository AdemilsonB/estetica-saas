'use client'

import { Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type SharedPlanData = {
  name: string
  displayName: string
  price: number
  features: string[]
  highlights?: string[]
  trialDays?: number
  isPopular?: boolean
}

type PublicAction = {
  type: 'navigate'
  href: string
}

type OnboardingAction = {
  type: 'onboarding'
  onSelect: (planName: string, skipTrial?: boolean) => void
  loadingKey: string | null
  allowTrial?: boolean
}

export type PlanCardAction = PublicAction | OnboardingAction

type Props = {
  plan: SharedPlanData
  action: PlanCardAction
  badge?: string
}

function formatPrice(price: number) {
  if (price === 0) return 'Grátis'
  return `R$ ${Math.round(price)}/mês`
}

export function SharedPlanCard({ plan, action, badge }: Props) {
  const trialDays = plan.trialDays ?? 14
  const isLoading = action.type === 'onboarding' && action.loadingKey !== null
  const showTrialOption = action.type === 'onboarding' && trialDays > 0 && action.allowTrial !== false

  return (
    <div
      className={`relative rounded-2xl border bg-white p-6 flex flex-col gap-5
        ${plan.isPopular ? 'border-slate-900 shadow-lg ring-1 ring-slate-900' : 'border-slate-200'}`}
    >
      {(plan.isPopular || badge) && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white whitespace-nowrap">
            {badge ?? 'Mais popular'}
          </span>
        </div>
      )}

      <div>
        <h3 className="font-semibold text-slate-900">{plan.displayName}</h3>
        <p className="text-3xl font-bold text-slate-900 mt-2">{formatPrice(plan.price)}</p>
        {action.type === 'navigate' && trialDays > 0 && (
          <p className="text-xs text-slate-500 mt-1">{trialDays} dias grátis · cancele a qualquer momento</p>
        )}
        {action.type === 'onboarding' && showTrialOption && (
          <p className="text-xs text-slate-500 mt-1">{trialDays} dias grátis · cancele a qualquer momento</p>
        )}
      </div>

      {plan.highlights && plan.highlights.length > 0 && (
        <div data-testid="plan-highlights" className="space-y-1">
          {plan.highlights.map((h) => (
            <p key={h} className="text-sm font-semibold text-slate-900">{h}</p>
          ))}
        </div>
      )}

      <ul className="space-y-2 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
            <Check className="size-4 text-green-500 mt-0.5 shrink-0" />
            {f}
          </li>
        ))}
      </ul>

      {action.type === 'navigate' ? (
        <a
          href={action.href}
          className={`block text-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors
            ${plan.isPopular
              ? 'bg-slate-900 text-white hover:bg-slate-700'
              : 'border border-slate-200 text-slate-700 hover:border-slate-400'}`}
        >
          {trialDays > 0 ? `Iniciar ${trialDays} dias grátis` : 'Assinar agora'}
        </a>
      ) : (
        <div className="flex flex-col gap-2">
          {showTrialOption && (
            <Button
              onClick={() => action.onSelect(plan.name, false)}
              disabled={isLoading}
              variant={plan.isPopular ? 'default' : 'outline'}
              className={`w-full h-11 ${plan.isPopular ? 'bg-slate-900 hover:bg-slate-700' : ''}`}
            >
              {action.loadingKey === `${plan.name}_trial` ? (
                <><Loader2 className="mr-2 size-4 animate-spin" />Redirecionando...</>
              ) : (
                `Testar ${trialDays} dias grátis`
              )}
            </Button>
          )}
          <Button
            onClick={() => action.onSelect(plan.name, true)}
            disabled={isLoading}
            variant={showTrialOption ? 'ghost' : (plan.isPopular ? 'default' : 'outline')}
            className={`w-full h-11 ${showTrialOption ? 'text-slate-500 text-sm' : plan.isPopular ? 'bg-slate-900 hover:bg-slate-700' : ''}`}
          >
            {action.loadingKey === `${plan.name}_direct` ? (
              <><Loader2 className="mr-2 size-4 animate-spin" />Redirecionando...</>
            ) : (
              'Assinar agora'
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
