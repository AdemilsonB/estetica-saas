// src/components/domain/landing/landing-plans.tsx
import Link from 'next/link'
import { PricingToggle, type PlanData } from '@/components/domain/billing/pricing-toggle'

interface LandingPlansProps {
  plans: PlanData[]
  trialDays: number | null
}

export function LandingPlans({ plans, trialDays }: LandingPlansProps) {
  if (plans.length === 0) return null

  const trialLabel = trialDays ? `${trialDays} dias grátis` : 'Trial grátis'

  return (
    <section id="planos" className="bg-gradient-to-br from-violet-50 to-pink-50 px-4 py-12 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 text-center sm:mb-12">
          <h2 className="text-2xl font-extrabold text-slate-900 sm:text-3xl md:text-4xl">
            Planos simples e transparentes
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-500 sm:text-lg">
            {trialLabel} em qualquer plano pago. Sem cartão de crédito, sem plano gratuito
            escondido — você só paga se continuar.
          </p>
        </div>

        <PricingToggle plans={plans} showAnnualToggle={false} />

        <div className="mt-6 text-center">
          <Link
            href="/planos"
            className="text-sm font-semibold text-violet-600 transition-colors hover:text-violet-800"
          >
            Ver comparação completa dos planos →
          </Link>
        </div>
      </div>
    </section>
  )
}
