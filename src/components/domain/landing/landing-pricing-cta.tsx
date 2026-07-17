// src/components/domain/landing/landing-pricing-cta.tsx
import Link from 'next/link'

interface LandingPricingCTAProps {
  starterPrice: number | null
  trialDays: number | null
}

export function LandingPricingCTA({ starterPrice, trialDays }: LandingPricingCTAProps) {
  const formattedPrice = starterPrice
    ? starterPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })
    : null
  const trialLabel = trialDays ? `${trialDays} dias grátis` : 'Trial grátis'

  return (
    <section className="bg-gradient-to-br from-[#4C1D95] via-[#7C3AED] to-[#DB2777] px-4 py-16 text-center text-white sm:px-6 sm:py-24">
      <h2 className="font-display mx-auto max-w-2xl text-[clamp(1.8rem,5vw,2.75rem)] font-extrabold leading-tight">
        Sua próxima sexta pode ser diferente.
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-base text-white/85 sm:text-lg">
        Deixe o Agendê confirmar, lembrar e cobrar por você. Comece hoje, {trialLabel.toLowerCase()}
        {formattedPrice ? ` — planos a partir de ${formattedPrice}/mês.` : '.'}
      </p>
      <Link
        href="/login?tab=signup"
        className="mt-8 inline-block w-full max-w-xs rounded-xl bg-white px-8 py-4 text-base font-extrabold text-violet-700 shadow-xl transition-transform hover:scale-105 sm:w-auto"
      >
        Começar meus {trialDays ?? 14} dias grátis →
      </Link>
      <p className="mt-4 text-xs text-white/80">✓ Sem cartão · ✓ Configura em 10 min · ✓ Cancela quando quiser</p>
      <p className="mx-auto mt-8 max-w-xl border-t border-white/20 pt-6 text-sm text-white/90">
        <strong className="text-white">P.S.:</strong> cada falta de sexta à noite é dinheiro que
        não volta. O Agendê custa menos que uma única falta evitada por mês — e evita dezenas.
      </p>
    </section>
  )
}
