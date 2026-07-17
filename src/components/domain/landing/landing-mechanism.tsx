// src/components/domain/landing/landing-mechanism.tsx
import { Reveal } from './landing-reveal'

const CARDS = [
  {
    n: '01',
    badge: 'bg-violet-50 text-violet-600',
    title: 'Ele confirma antes de você acordar',
    text: 'Cada agendamento dispara confirmação e lembrete no WhatsApp automaticamente. A cliente responde num toque — e a agenda furada de sexta vira exceção, não regra.',
  },
  {
    n: '02',
    badge: 'bg-pink-50 text-pink-600',
    title: 'Ele preenche os buracos da agenda',
    text: 'Cancelou às 14h? A lista de espera é avisada na hora e o horário volta a vender sozinho. Você recupera faturamento que hoje evapora silenciosamente.',
  },
  {
    n: '03',
    badge: 'bg-emerald-50 text-emerald-600',
    title: 'Ele fecha o caixa no fim do dia',
    text: 'Quanto entrou, quanto cada profissional produziu, o que vender amanhã. Sem planilha, sem calculadora — o número está pronto quando você desliga a luz.',
  },
] as const

export function LandingMechanism() {
  return (
    <section className="bg-[#FAFAFA] px-4 pb-16 sm:px-6 sm:pb-20">
      <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-3">
        {CARDS.map((card, i) => (
          <Reveal key={card.n} delay={i * 100}>
            <div className="h-full rounded-2xl border border-violet-100 bg-white p-6 sm:p-7">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-lg font-extrabold ${card.badge}`}>
                {card.n}
              </div>
              <h3 className="font-display mt-5 text-xl font-extrabold text-slate-900">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{card.text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
