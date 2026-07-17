// src/components/domain/landing/landing-features.tsx
import { Reveal } from './landing-reveal'

type Feature = {
  icon: string
  title: string
  description: string
  metric: string
  metricColor: string
}

const FEATURES: Feature[] = [
  {
    icon: '🗓️',
    title: 'Agenda que vende 24h',
    description: 'Sua cliente marca de madrugada, no domingo, sem te mandar mensagem. Você acorda com a agenda cheia.',
    metric: '+30% de agendamentos',
    metricColor: 'text-violet-600',
  },
  {
    icon: '💬',
    title: 'WhatsApp no automático',
    description: 'Confirmação, lembrete e retorno saem sozinhos, com a sua voz. Chega de digitar a mesma mensagem 40 vezes por dia.',
    metric: '−40% de faltas',
    metricColor: 'text-pink-600',
  },
  {
    icon: '📊',
    title: 'Financeiro em tempo real',
    description: 'Faturamento, comissão e ticket médio calculados na hora. Você decide com número, não com achismo.',
    metric: '0 planilhas',
    metricColor: 'text-emerald-600',
  },
  {
    icon: '💜',
    title: 'Fidelização que traz de volta',
    description: 'Aniversário, retorno atrasado, cliente sumida: o Agendê lembra você — e reconquista por você.',
    metric: 'clientes voltam 2x mais',
    metricColor: 'text-violet-600',
  },
  {
    icon: '🛡️',
    title: 'Anti-falta de verdade',
    description: 'Confirmação em duas etapas e lista de espera automática. O horário vago não fica vago.',
    metric: 'agenda mais cheia',
    metricColor: 'text-pink-600',
  },
  {
    icon: '🏷️',
    title: 'Sua marca, sua vitrine',
    description: 'Página pública com suas cores, seus serviços e seus preços. Um link só, do jeitinho do seu salão.',
    metric: '100% personalizável',
    metricColor: 'text-emerald-600',
  },
]

export function LandingFeatures() {
  return (
    <section id="funcionalidades" className="bg-white px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mb-10 text-center sm:mb-14">
          <p className="text-sm font-extrabold uppercase tracking-wide text-violet-600">Tudo num lugar só</p>
          <h2 className="font-display mt-3 text-[clamp(1.6rem,4.5vw,2.4rem)] font-extrabold text-slate-900">
            O que você ganha quando o Agendê assume
          </h2>
        </Reveal>

        <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <Reveal key={feature.title} delay={(i % 3) * 80}>
              <div className="h-full rounded-2xl border border-violet-100 bg-violet-50/40 p-6">
                <div className="text-2xl">{feature.icon}</div>
                <h3 className="font-display mt-3 text-lg font-extrabold text-slate-900">{feature.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{feature.description}</p>
                <span className={`mt-3 inline-block text-sm font-extrabold ${feature.metricColor}`}>
                  {feature.metric}
                </span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
