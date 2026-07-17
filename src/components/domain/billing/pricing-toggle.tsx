'use client'

import { useState } from 'react'
import { SharedPlanCard } from './plan-card-shared'

export type PlanData = {
  name: string
  displayName: string
  price: number
  features: string[]
  highlights?: string[]
  trialDays: number
  isPopular?: boolean
}

interface PricingToggleProps {
  plans: PlanData[]
  /** Só exibe o seletor Mensal/Anual quando houver preço anual real no catálogo. */
  showAnnualToggle?: boolean
}

export function PricingToggle({ plans, showAnnualToggle = false }: PricingToggleProps) {
  const [annual, setAnnual] = useState(false)

  return (
    <div>
      {showAnnualToggle && (
        <div className="mb-8 flex justify-center">
          <div className="inline-flex gap-1 rounded-full border border-violet-200 bg-violet-50 p-1">
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={`rounded-full px-5 py-2 text-sm font-extrabold transition-colors ${
                annual ? 'text-violet-700' : 'bg-violet-600 text-white'
              }`}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={`rounded-full px-5 py-2 text-sm font-extrabold transition-colors ${
                annual ? 'bg-violet-600 text-white' : 'text-violet-700'
              }`}
            >
              Anual
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => (
          <SharedPlanCard
            key={plan.name}
            plan={plan}
            action={{ type: 'navigate', href: `/login?plan=${plan.name}` }}
          />
        ))}
      </div>
    </div>
  )
}
