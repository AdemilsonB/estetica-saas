// src/components/domain/landing/landing-demo-mobile.tsx
import { Reveal } from './landing-reveal'
import { MockAgenda } from './landing-feature-mockups'

const STEPS = [
  'Escolhe o serviço e o profissional favorito',
  'Vê os horários realmente disponíveis, ao vivo',
  'Confirma e recebe tudo no WhatsApp na hora',
]

export function LandingDemoMobile() {
  return (
    <section id="demo" className="bg-gradient-to-b from-[#F5F3FF] to-[#FAFAFA] px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2 md:gap-14">
        <Reveal>
          <p className="text-sm font-extrabold uppercase tracking-wide text-violet-600">
            7 em cada 10 clientes agendam pelo celular
          </p>
          <h2 className="font-display mt-3 text-[clamp(1.6rem,4.5vw,2.4rem)] font-extrabold text-slate-900">
            Veja como sua cliente agenda em 30 segundos
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-slate-500 sm:text-lg">
            Ela abre seu link, escolhe o serviço, vê os horários livres de verdade e confirma.
            Sem app pra baixar, sem ligação, sem espera.
          </p>
          <ul className="mt-6 flex flex-col gap-3">
            {STEPS.map((step, i) => (
              <li key={step} className="flex items-start gap-3 text-sm text-slate-700 sm:text-base">
                <span className="font-extrabold text-violet-600">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={120} className="w-full">
          <div className="mx-auto w-full max-w-sm">
            <MockAgenda />
          </div>
        </Reveal>
      </div>
    </section>
  )
}
