// src/components/domain/landing/landing-faq.tsx
import { Reveal } from './landing-reveal'

export function LandingFAQ({ trialDays }: { trialDays: number | null }) {
  const trialLabel = trialDays ? `${trialDays} dias grátis` : 'trial grátis'

  const faq: [string, string][] = [
    ['É difícil de configurar? Não entendo de tecnologia.', 'Se você usa WhatsApp e Instagram, você configura o Agendê. Leva cerca de 10 minutos e a gente te acompanha no primeiro acesso.'],
    ['Minha cliente vai saber usar?', 'Ela não instala nada. Clica no seu link, escolhe o horário e confirma — como pedir comida por app. Em média, leva 30 segundos.'],
    ['Já uso outra agenda / caderninho. Perco meus dados?', 'Não. A migração dos seus clientes e horários é gratuita e a gente faz junto com você, sem parar o atendimento.'],
    ['Preciso cadastrar cartão pra testar?', `Não. O ${trialLabel} é realmente grátis. Só escolhe um plano se decidir continuar.`],
    ['E a segurança dos meus dados e dos meus clientes?', 'Seus dados são criptografados e tratados conforme a LGPD. Você é dono das suas informações e pode exportar ou apagar quando quiser.'],
  ]

  return (
    <section id="faq" className="bg-[#FAFAFA] px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-2xl">
        <Reveal>
          <h2 className="font-display mb-8 text-center text-[clamp(1.5rem,4vw,2.1rem)] font-extrabold text-slate-900">
            Ainda em dúvida? A gente resolve.
          </h2>
        </Reveal>
        <div className="space-y-3">
          {faq.map(([q, a]) => (
            <details key={q} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
              <summary className="cursor-pointer font-display font-bold text-slate-900">{q}</summary>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
