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
    <section className="bg-gradient-to-r from-violet-600 to-pink-600 px-4 sm:px-6 py-14 sm:py-20 text-center">
      <h2 className="mx-auto max-w-2xl text-2xl sm:text-3xl font-extrabold text-white md:text-4xl">
        Pronto para deixar o Agendê trabalhar por você?
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-base sm:text-lg text-white/85">
        {formattedPrice ? `Planos a partir de ${formattedPrice}/mês · ` : ''}
        {trialLabel} · Sem cartão de crédito
      </p>
      <Link
        href="/planos"
        className="mt-8 inline-block w-full max-w-xs rounded-xl bg-white px-8 py-4 text-base font-bold text-violet-700 shadow-xl transition-transform hover:scale-105 sm:w-auto"
      >
        Escolher meu plano →
      </Link>
    </section>
  )
}
