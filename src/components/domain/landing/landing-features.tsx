// src/components/domain/landing/landing-features.tsx

const FEATURES = [
  {
    icon: '📅',
    title: 'Agenda online 24 horas',
    description:
      'Sua cliente agenda pelo celular, a qualquer hora — sem precisar ligar. Você acorda com a agenda cheia. O Agendê organiza por profissional, horário e serviço automaticamente.',
    metric: '📈 +30% de agendamentos no primeiro mês',
    screenshot: 'Página pública de agendamento',
  },
  {
    icon: '💬',
    title: 'WhatsApp automático',
    description:
      'Confirmação, lembrete 24h antes e follow-up pós-atendimento — tudo enviado automaticamente. Sem digitar uma mensagem, sem esquecer uma cliente.',
    metric: '📉 -40% de faltas e no-shows',
    screenshot: 'Fluxo de mensagens automáticas',
  },
  {
    icon: '💰',
    title: 'Controle financeiro em tempo real',
    description:
      'Faturamento do dia, comissões por profissional e relatório mensal — tudo no painel. Sabe exatamente quanto entrou, quanto pagou e qual serviço dá mais lucro.',
    metric: '💡 Decisões baseadas em dados, não em chute',
    screenshot: 'Dashboard financeiro com gráficos',
  },
  {
    icon: '❤️',
    title: 'Fidelização automática',
    description:
      'Histórico completo de cada cliente, mensagem de aniversário e alerta quando ela sumiu há mais de 30 dias. Sua cliente se sente especial — e volta mais vezes.',
    metric: '🔁 Clientes retornam 2x mais rápido',
    screenshot: 'Perfil de cliente com histórico e tags',
  },
  {
    icon: '🚫',
    title: 'Zero faltas com lembretes inteligentes',
    description:
      'Lembrete automático 24h antes com confirmação por link. Se ela não confirmar, você recebe um alerta para ligar. Chega de horário vazio.',
    metric: '✅ Até 40% menos faltas garantidas',
    screenshot: 'Painel de confirmações com status',
  },
] as const

export function LandingFeatures() {
  return (
    <section id="funcionalidades" className="bg-white px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-extrabold text-slate-900 md:text-4xl">
            Tudo que seu salão precisa, num só lugar
          </h2>
          <p className="mt-3 text-lg text-slate-500">
            Cada funcionalidade foi pensada para a realidade de quem trabalha com beleza
          </p>
        </div>

        <div className="flex flex-col gap-20">
          {FEATURES.map((feature, index) => {
            const isReverse = index % 2 !== 0
            return (
              <div
                key={feature.title}
                className={`flex flex-col items-center gap-12 md:flex-row ${isReverse ? 'md:flex-row-reverse' : ''}`}
              >
                {/* Texto */}
                <div className="flex-1">
                  <div className="mb-3 text-4xl">{feature.icon}</div>
                  <h3 className="mb-3 text-2xl font-bold text-slate-900">{feature.title}</h3>
                  <p className="mb-5 leading-relaxed text-slate-500">{feature.description}</p>
                  <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-gradient-to-r from-violet-50 to-pink-50 px-4 py-2 text-sm font-semibold text-violet-700">
                    {feature.metric}
                  </div>
                </div>

                {/* Screenshot placeholder — substituir por <Image> quando disponível */}
                <div className="flex h-52 w-full flex-1 items-center justify-center rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-pink-50 text-sm font-semibold text-violet-400 md:h-64">
                  {feature.screenshot}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
