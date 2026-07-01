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

  const faq: [string, string][] = [
    ['Preciso de cartão de crédito para o trial?', `Não. O trial de ${trialLabel.toLowerCase()} não exige cartão.`],
    ['Existe plano gratuito?', 'Não temos plano gratuito permanente. Você começa com o trial de qualquer plano pago e só assina se quiser continuar.'],
    ['O que acontece quando o trial acaba?', 'Seu acesso fica suspenso até você escolher e assinar um plano. Nenhum dado é perdido.'],
    ['Posso cancelar quando quiser?', 'Sim. Cancele pelo painel de configurações, sem multas.'],
    ['Posso personalizar a marca do meu salão?', 'Sim. Cores, logo e link público são configuráveis. Alguns recursos avançados dependem do plano escolhido.'],
  ]

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

        <PricingToggle plans={plans} />

        <div className="mt-6 text-center">
          <Link
            href="/planos"
            className="text-sm font-semibold text-violet-600 transition-colors hover:text-violet-800"
          >
            Ver comparação completa dos planos →
          </Link>
        </div>

        {/* FAQ */}
        <div className="mx-auto mt-14 max-w-2xl sm:mt-20">
          <h3 className="mb-6 text-center text-xl font-semibold text-slate-900 sm:text-2xl">
            Dúvidas frequentes
          </h3>
          <div className="space-y-3">
            {faq.map(([q, a]) => (
              <details key={q} className="rounded-xl border border-slate-200 bg-white p-4">
                <summary className="cursor-pointer font-medium text-slate-900">{q}</summary>
                <p className="mt-2 text-sm text-slate-500">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
