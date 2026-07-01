// src/components/domain/landing/landing-features.tsx
import type { ComponentType } from 'react'
import {
  MockAgenda,
  MockWhatsApp,
  MockFinanceiro,
  MockFidelizacao,
  MockAntiFalta,
} from './landing-feature-mockups'

type Feature = {
  eyebrow?: string
  title: string
  description: string
  metric: string
  Mock: ComponentType
}

const FEATURES: Feature[] = [
  {
    title: 'Agenda online 24 horas',
    description:
      'Sua cliente agenda pelo celular, a qualquer hora — sem precisar ligar. Você acorda com a agenda cheia. O Agendê organiza por profissional, horário e serviço automaticamente.',
    metric: '📈 +30% de agendamentos no primeiro mês',
    Mock: MockAgenda,
  },
  {
    eyebrow: 'Automação & tecnologia',
    title: 'WhatsApp que trabalha sozinho',
    description:
      'Confirmação no agendamento, lembrete 24h antes e follow-up pós-atendimento — disparados automaticamente pela plataforma, em tempo real. Sem digitar uma mensagem, sem esquecer uma cliente.',
    metric: '📉 -40% de faltas e no-shows',
    Mock: MockWhatsApp,
  },
  {
    title: 'Controle financeiro em tempo real',
    description:
      'Faturamento do dia, comissões por profissional e relatório mensal — tudo no painel, atualizado na hora. Sabe exatamente quanto entrou, quanto pagou e qual serviço dá mais lucro.',
    metric: '💡 Decisões baseadas em dados, não em chute',
    Mock: MockFinanceiro,
  },
  {
    title: 'Fidelização automática',
    description:
      'Histórico completo de cada cliente, mensagem de aniversário e alerta quando ela sumiu há mais de 30 dias. Sua cliente se sente especial — e volta mais vezes.',
    metric: '🔁 Clientes retornam 2x mais rápido',
    Mock: MockFidelizacao,
  },
  {
    title: 'Zero faltas com lembretes inteligentes',
    description:
      'Lembrete automático 24h antes com confirmação por link. Se ela não confirmar, você recebe um alerta para ligar. Chega de horário vazio.',
    metric: '✅ Até 40% menos faltas garantidas',
    Mock: MockAntiFalta,
  },
]

const MORE_FEATURES = [
  {
    icon: '🩺',
    title: 'Anamnese digital',
    description: 'Ficha de saúde e preferências por serviço, preenchida pela cliente antes do atendimento.',
  },
  {
    icon: '🌐',
    title: 'Portal do cliente',
    description: 'Sua cliente acompanha histórico, próximo horário e dados do negócio sem precisar te chamar.',
  },
  {
    icon: '📦',
    title: 'Catálogo & estoque',
    description: 'Produtos, pacotes e promoções com controle de estoque conectado ao financeiro.',
  },
  {
    icon: '🎨',
    title: 'Marca personalizável',
    description: 'Cores, logo e link público com a identidade do seu salão, não a nossa.',
  },
  {
    icon: '📱',
    title: 'App no celular',
    description: 'Instale o painel na tela inicial do celular como um app — sem precisar baixar nada.',
  },
] as const

export function LandingFeatures() {
  return (
    <section id="funcionalidades" className="bg-white px-4 py-12 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 text-center sm:mb-16">
          <h2 className="text-2xl font-extrabold text-slate-900 sm:text-3xl md:text-4xl">
            Tudo que seu salão precisa, num só lugar
          </h2>
          <p className="mt-3 text-sm text-slate-500 sm:text-lg">
            Cada funcionalidade foi pensada para a realidade de quem trabalha com beleza
          </p>
        </div>

        <div className="flex flex-col gap-12 sm:gap-20">
          {FEATURES.map((feature, index) => {
            const isReverse = index % 2 !== 0
            const { Mock } = feature
            return (
              <div
                key={feature.title}
                className={`flex flex-col items-center gap-6 sm:gap-12 md:flex-row ${isReverse ? 'md:flex-row-reverse' : ''}`}
              >
                {/* Texto */}
                <div className="flex-1">
                  {feature.eyebrow && (
                    <span className="mb-2 inline-block rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-violet-700">
                      {feature.eyebrow}
                    </span>
                  )}
                  <h3 className="mb-3 text-lg font-bold text-slate-900 sm:text-2xl">{feature.title}</h3>
                  <p className="mb-4 text-sm leading-relaxed text-slate-500 sm:mb-5 sm:text-base">{feature.description}</p>
                  <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-gradient-to-r from-violet-50 to-pink-50 px-4 py-2 text-sm font-semibold text-violet-700">
                    {feature.metric}
                  </div>
                </div>

                {/* Mockup fiel do recurso */}
                <div className="w-full flex-1">
                  <Mock />
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-14 sm:mt-24">
          <h3 className="text-center text-xl font-extrabold text-slate-900 sm:text-2xl">
            E tem muito mais incluído
          </h3>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 md:grid-cols-3">
            {MORE_FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/50 to-pink-50/50 p-4 sm:p-5"
              >
                <div className="mb-2 text-xl sm:text-2xl">{feature.icon}</div>
                <h4 className="mb-1 text-sm font-bold text-slate-900 sm:text-base">{feature.title}</h4>
                <p className="text-xs leading-relaxed text-slate-500 sm:text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
