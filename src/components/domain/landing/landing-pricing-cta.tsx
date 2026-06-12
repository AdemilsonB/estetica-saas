import Link from 'next/link'

interface LandingPricingCTAProps {
  starterPrice: number | null
}

export function LandingPricingCTA({ starterPrice }: LandingPricingCTAProps) {
  const formattedPrice = starterPrice
    ? starterPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })
    : null

  return (
    <section className="bg-gradient-to-r from-violet-600 to-pink-600 px-6 py-20 text-center">
      <h2 className="text-3xl font-extrabold text-white md:text-4xl">
        Pronto para deixar o Agendê trabalhar por você?
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">
        {formattedPrice ? `Planos a partir de ${formattedPrice}/mês · ` : ''}
        14 dias grátis · Sem cartão de crédito
      </p>
      <Link
        href="/planos"
        className="mt-8 inline-block rounded-xl bg-white px-8 py-4 text-base font-bold text-violet-700 shadow-xl transition-transform hover:scale-105"
      >
        Escolher meu plano →
      </Link>
    </section>
  )
}
