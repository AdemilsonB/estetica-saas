'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

type Plan = {
  name: string
  displayName: string
  price: number
  description?: string | null
  features: string[]
  isPopular?: boolean
}

function PlanCard({ plan, isAnnual }: { plan: Plan; isAnnual: boolean }) {
  const router = useRouter()
  const isFree = plan.name === 'FREE'
  const monthlyPrice = isAnnual ? Math.round(plan.price * 10 / 12) : plan.price

  return (
    <div className={`relative rounded-2xl border bg-white p-6 flex flex-col gap-5
      ${plan.isPopular ? 'border-slate-900 shadow-lg ring-1 ring-slate-900' : 'border-slate-200'}`}>
      {plan.isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">Mais popular</span>
        </div>
      )}
      <div>
        <h3 className="font-semibold text-slate-900">{plan.displayName}</h3>
        {plan.description && <p className="text-sm text-slate-500 mt-1">{plan.description}</p>}
      </div>
      <div>
        {isFree ? (
          <p className="text-3xl font-bold text-slate-900">Grátis</p>
        ) : (
          <div>
            <p className="text-3xl font-bold text-slate-900">
              R$ {monthlyPrice}<span className="text-base font-normal text-slate-500">/mês</span>
            </p>
            {isAnnual && <p className="text-sm text-green-600 mt-1">R$ {plan.price}/mês no mensal</p>}
          </div>
        )}
      </div>
      <ul className="space-y-2 flex-1">
        {plan.features.map(f => (
          <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
            <Check className="size-4 text-green-500 mt-0.5 shrink-0" />{f}
          </li>
        ))}
      </ul>
      <Button
        onClick={() => router.push(`/login?plan=${plan.name}`)}
        variant={plan.isPopular ? 'default' : 'outline'}
        className="w-full"
      >
        {isFree ? 'Começar grátis' : 'Iniciar 14 dias grátis'}
      </Button>
    </div>
  )
}

export function PricingToggle({ plans }: { plans: Plan[] }) {
  const [isAnnual, setIsAnnual] = useState(false)

  return (
    <div>
      <div className="flex items-center justify-center gap-3 mb-10">
        <span className={`text-sm ${!isAnnual ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>Mensal</span>
        <button
          onClick={() => setIsAnnual(v => !v)}
          className={`relative w-12 h-6 rounded-full transition-colors ${isAnnual ? 'bg-slate-900' : 'bg-slate-300'}`}
        >
          <span className={`absolute top-1 size-4 rounded-full bg-white transition-transform ${isAnnual ? 'translate-x-7' : 'translate-x-1'}`} />
        </button>
        <span className={`text-sm ${isAnnual ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>
          Anual <span className="text-green-600 font-medium">(-17%)</span>
        </span>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map(plan => <PlanCard key={plan.name} plan={plan} isAnnual={isAnnual} />)}
      </div>
    </div>
  )
}
