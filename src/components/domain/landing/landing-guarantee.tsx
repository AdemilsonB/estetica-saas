// src/components/domain/landing/landing-guarantee.tsx
import { Reveal } from './landing-reveal'

export function LandingGuarantee({ trialDays }: { trialDays: number | null }) {
  const dias = trialDays ?? 14

  return (
    <section className="bg-[#F5F3FF] px-4 py-16 sm:px-6 sm:py-20">
      <Reveal className="mx-auto max-w-2xl text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-violet-200 bg-white text-3xl">
          🛡️
        </div>
        <h2 className="font-display mt-5 text-[clamp(1.4rem,4vw,2rem)] font-extrabold text-slate-900">
          Teste sem risco nenhum por {dias} dias
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-500 sm:text-lg">
          Comece agora sem cartão de crédito. Use tudo, coloque suas clientes pra agendar de
          verdade. Se não sentir a agenda mais cheia e o WhatsApp mais leve, é só não continuar —
          sem multa, sem letra miúda.
        </p>
      </Reveal>
    </section>
  )
}
