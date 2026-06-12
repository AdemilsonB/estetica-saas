// src/components/domain/landing/landing-how-it-works.tsx

const STEPS = [
  {
    number: 1,
    title: 'Cria sua conta',
    description: 'Cadastro em 2 minutos. Adiciona seus profissionais e serviços.',
  },
  {
    number: 2,
    title: 'Compartilha o link',
    description: 'Coloca no Instagram, no WhatsApp e na bio. Suas clientes já podem agendar.',
  },
  {
    number: 3,
    title: 'O Agendê trabalha por você',
    description: 'Lembretes, confirmações e relatórios automáticos. Você foca no atendimento.',
  },
] as const

export function LandingHowItWorks() {
  return (
    <section id="como-funciona" className="bg-gradient-to-br from-violet-50 to-pink-50 px-6 py-20">
      <div className="mx-auto max-w-4xl">
        <div className="mb-14 text-center">
          <h2 className="text-3xl font-extrabold text-slate-900 md:text-4xl">Pronto em 3 passos</h2>
          <p className="mt-3 text-lg text-slate-500">Sem instalação. Sem técnico. Começa hoje.</p>
        </div>

        <div className="grid gap-10 md:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.number} className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-pink-600 text-lg font-extrabold text-white shadow-lg shadow-violet-200">
                {step.number}
              </div>
              <h3 className="mb-2 text-lg font-bold text-slate-900">{step.title}</h3>
              <p className="text-sm leading-relaxed text-slate-500">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
