import { getPublicPlans } from '@/domains/billing/plan-catalog.service'
import { PricingToggle } from '@/components/domain/billing/pricing-toggle'

// Sempre renderizar no request: os planos são editáveis pelo admin e precisam
// refletir imediatamente (chamadas Prisma não são sinal de dinamismo no Next 15).
export const dynamic = 'force-dynamic'

export default async function PlansPage() {
  const plans = await getPublicPlans()

  const plansForCards = plans.map((p) => ({
    name: p.name,
    displayName: p.displayName,
    price: p.price,
    features: p.benefits,
    highlights: p.highlights,
    trialDays: p.trialDays,
    isPopular: p.isPopular,
  }))

  const trialDays =
    plans.find((p) => p.name === 'STARTER')?.trialDays ??
    plans.reduce((max, p) => Math.max(max, p.trialDays), 0)

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="font-semibold text-slate-900">Estética SaaS</span>
          <a href="/login" className="text-sm text-slate-600 hover:text-slate-900">Entrar</a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900">Planos simples e transparentes</h1>
          <p className="mt-4 text-lg text-slate-500">{trialDays} dias grátis em qualquer plano pago. Sem cartão de crédito.</p>
        </div>

        <PricingToggle plans={plansForCards} />

        <div className="mt-20 max-w-2xl mx-auto">
          <h2 className="text-xl font-semibold text-slate-900 mb-6 text-center">Dúvidas frequentes</h2>
          <div className="space-y-4">
            {[
              ['Preciso de cartão de crédito para o trial?', `Não. O trial de ${trialDays} dias é gratuito e não exige cartão.`],
              ['Posso cancelar a qualquer momento?', 'Sim. Cancele pelo painel de configurações. Sem multas.'],
              ['O que acontece ao fim do trial?', 'Seu acesso fica suspenso até você escolher e assinar um plano. Nenhum dado é perdido.'],
              ['Posso mudar de plano?', 'Sim. Upgrade ou downgrade a qualquer momento nas configurações.'],
            ].map(([q, a]) => (
              <details key={q} className="rounded-xl border border-slate-200 bg-white p-4">
                <summary className="font-medium text-slate-900 cursor-pointer">{q}</summary>
                <p className="mt-2 text-sm text-slate-500">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
