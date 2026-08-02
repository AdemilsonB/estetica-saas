// src/components/domain/landing/landing-hero.tsx
import Link from 'next/link'

interface LandingHeroProps {
  trialDays: number | null
}

export function LandingHero({ trialDays }: LandingHeroProps) {
  const trialMicrotrust = trialDays ? `${trialDays} dias grátis` : 'Trial grátis'

  return (
    <section className="relative overflow-hidden bg-[#FBF4EA] px-4 pb-12 pt-12 sm:px-6 sm:pb-20 sm:pt-20">
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_.95fr] lg:gap-14">
        {/* Coluna de texto */}
        <div className="text-center lg:text-left">
          <div className="mb-5 inline-flex items-center gap-2 text-sm italic text-[#7A4227]">
            <span className="hidden h-px w-4 bg-[#B9673C] sm:inline-block" aria-hidden="true" />
            sistema de gestão para salões de beleza
          </div>
          <p className="font-display mx-auto max-w-2xl text-[clamp(1.8rem,5vw,2.6rem)] font-extrabold leading-[1.1] text-[#2E2A26] lg:mx-0">
            Agendê
          </p>
          <h1 className="font-display mx-auto mt-3 max-w-2xl text-[clamp(1.5rem,4.4vw,2.15rem)] font-bold leading-[1.28] text-[#2E2A26] lg:mx-0">
            A gestão completa do seu salão, em um único sistema.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-sm text-[#6b5c4f] sm:text-base lg:mx-0">
            Agenda online, confirmação automática por WhatsApp e financeiro atualizado em tempo
            real — toda a operação do seu negócio, sob controle.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <Link
              href="/login?tab=signup"
              className="w-full rounded-sm bg-[#B9673C] px-8 py-4 text-base font-bold text-[#FBF4EA] transition-opacity hover:opacity-90 sm:w-auto"
            >
              Iniciar avaliação gratuita
            </Link>
            <Link
              href="#planos"
              className="text-sm font-semibold text-[#7A4227] underline underline-offset-4 transition-colors hover:text-[#B9673C]"
            >
              Ver planos
            </Link>
          </div>
          <p className="mt-4 text-xs text-[#8a7a6a]">
            ✓ sem cartão de crédito · {trialMicrotrust}
          </p>
        </div>

        {/* Coluna do cartão de agendamento */}
        <div className="relative flex h-[300px] items-center justify-center">
          <div
            aria-hidden="true"
            className="absolute w-64 -translate-x-3.5 rotate-[-7deg] rounded-none bg-[#F8EFE2] p-5 shadow-[0_14px_30px_-14px_rgba(46,42,38,0.25)]"
          />
          <div
            aria-hidden="true"
            className="absolute w-64 translate-x-2.5 rotate-[6deg] rounded-none bg-[#F3E6D4] p-5 shadow-[0_14px_30px_-14px_rgba(46,42,38,0.25)]"
          />

          <div className="relative w-64 rotate-[-1.5deg] rounded-none border-t-[3px] border-[#B9673C] bg-white p-5 shadow-[0_14px_30px_-14px_rgba(46,42,38,0.28)]">
            <span
              aria-hidden="true"
              className="absolute -right-[10px] -top-[6px] h-[26px] w-[26px] bg-[#C98B7A] opacity-85 [clip-path:polygon(0_0,100%_0,100%_78%,50%_100%,0_78%)]"
            />
            <span
              aria-hidden="true"
              className="absolute -top-[6px] right-[16px] h-2.5 w-2.5 rounded-full border-[1.5px] border-[#EDE1D1] bg-[#FBF4EA]"
            />

            <div className="mb-3.5 flex items-start justify-between">
              <span className="text-sm font-extrabold text-[#2E2A26]">Salão Flor &amp; Cia</span>
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[radial-gradient(circle_at_32%_28%,_#C97A4E_0%,_#B9673C_55%,_#7A4227_100%)]">
                <span className="text-sm font-extrabold text-[#FBF4EA]">a</span>
              </span>
            </div>

            {[
              { l: 'Cliente', v: 'Marina Souza' },
              { l: 'Serviço', v: 'Corte + Escova' },
              { l: 'Data', v: '03/08 · seg' },
              { l: 'Horário', v: '14:30' },
            ].map(({ l, v }) => (
              <div key={l} className="flex justify-between border-b border-dotted border-[#d9c9b4] py-1.5 text-xs">
                <span className="text-[10px] uppercase tracking-wide text-[#9a8a78]">{l}</span>
                <span className="font-bold tabular-nums text-[#2E2A26]">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
