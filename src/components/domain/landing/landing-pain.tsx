// src/components/domain/landing/landing-pain.tsx
import { Reveal } from './landing-reveal'

export function LandingPain() {
  return (
    <section className="bg-[#FAFAFA] px-4 py-16 sm:px-6 sm:py-20">
      <Reveal className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-extrabold uppercase tracking-wide text-pink-600">
          A sexta-feira que você conhece bem
        </p>
        <h2 className="font-display mt-4 text-[clamp(1.6rem,4.5vw,2.4rem)] font-extrabold leading-tight text-slate-900">
          São 20h. Três clientes confirmaram de manhã. Duas não apareceram.
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-500 sm:text-lg">
          A cadeira fica vazia, o dinheiro não entra — e você nem tem como cobrar sem parecer
          chata. No dia seguinte é a planilha que não bate, o WhatsApp com 40 mensagens sem
          responder e o caderninho de horários que só você entende.{' '}
          <strong className="text-slate-900">Não é falta de cliente. É falta de sistema.</strong>
        </p>
      </Reveal>
    </section>
  )
}
