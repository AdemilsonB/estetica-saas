'use client'

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

export function PricingToggle({ plans }: { plans: PlanData[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {plans.map((plan) => (
        <SharedPlanCard
          key={plan.name}
          plan={plan}
          action={{ type: 'navigate', href: `/login?plan=${plan.name}` }}
        />
      ))}
    </div>
  )
}
