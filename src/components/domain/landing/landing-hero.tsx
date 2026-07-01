// src/components/domain/landing/landing-hero.tsx
import Link from 'next/link'

interface LandingHeroProps {
  trialDays: number | null
}

export function LandingHero({ trialDays }: LandingHeroProps) {
  const trialMicrotrust = trialDays ? `${trialDays} dias grátis` : 'Trial grátis'

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#FAF8FF] via-[#F0EBFF] to-[#FCE8F3] px-4 pb-10 pt-12 text-center sm:px-6 sm:pb-16 sm:pt-20">
      {/* Glow decorativo */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-violet-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 bottom-0 h-64 w-64 rounded-full bg-pink-200/30 blur-3xl" />

      {/* Badge */}
      <div className="relative mb-5 inline-block rounded-full border border-violet-200 bg-gradient-to-r from-violet-50 to-pink-50 px-4 py-1.5 text-xs font-semibold text-violet-700 sm:mb-6">
        ✨ Feito para salões, barbearias e clínicas
      </div>

      {/* Headline operacional */}
      <h1 className="relative mx-auto max-w-3xl text-[1.75rem] font-extrabold leading-[1.15] text-slate-900 sm:text-4xl lg:text-5xl">
        Pare de perder cliente no telefone tocando.
        <br className="hidden sm:block" />{' '}
        Sua agenda no{' '}
        <span className="bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent">
          piloto automático.
        </span>
      </h1>

      {/* Subtítulo */}
      <p className="relative mx-auto mt-4 max-w-xl text-sm text-slate-500 sm:mt-5 sm:text-lg">
        Agenda online, WhatsApp automático e financeiro em tempo real — tudo num lugar só.
        Sem planilha, sem telefone tocando.
      </p>

      {/* CTAs */}
      <div className="relative mt-7 flex flex-col items-center gap-3 sm:mt-8 sm:flex-row sm:justify-center">
        <Link
          href="/login?tab=signup"
          className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 px-8 py-4 text-base font-bold text-white shadow-lg shadow-violet-200 transition-opacity hover:opacity-90 sm:w-auto"
        >
          Começar trial grátis →
        </Link>
        <Link
          href="/planos"
          className="flex items-center gap-2 text-sm font-semibold text-violet-600 transition-colors hover:text-violet-800"
        >
          Ver planos e preços
        </Link>
      </div>

      {/* Microtrust */}
      <p className="relative mt-4 text-xs text-slate-400">
        ✓ sem cartão de crédito · {trialMicrotrust}
      </p>

      {/* Mockup de dashboard — overflow-x-auto para mobile */}
      <div className="relative mx-auto mt-8 max-w-4xl overflow-x-auto sm:mt-14">
        <div className="min-w-150 overflow-hidden rounded-2xl border border-slate-200 shadow-2xl shadow-slate-900/20">
          {/* Barra do browser */}
          <div className="flex items-center gap-2 bg-slate-800 px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-red-400" />
            <span className="h-3 w-3 rounded-full bg-yellow-400" />
            <span className="h-3 w-3 rounded-full bg-green-400" />
            <span className="ml-3 rounded bg-slate-700 px-3 py-0.5 text-xs text-slate-400">
              agend.com.br/dashboard
            </span>
          </div>

          {/* Conteúdo do dashboard mockup */}
          <div className="grid grid-cols-[180px_1fr] bg-slate-900">
            {/* Sidebar */}
            <div className="flex flex-col gap-2 p-4">
              <span className="mb-2 bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-sm font-extrabold text-transparent">
                Agendê
              </span>
              {['📅 Agenda', '👥 Clientes', '💬 WhatsApp', '💰 Financeiro', '📊 Relatórios'].map((item, i) => (
                <div
                  key={item}
                  className={`rounded-lg px-3 py-2 text-xs ${i === 0 ? 'bg-gradient-to-r from-violet-600 to-pink-600 font-semibold text-white' : 'text-slate-400'}`}
                >
                  {item}
                </div>
              ))}
            </div>

            {/* Main */}
            <div className="flex flex-col gap-3 bg-slate-50 p-4">
              {/* Métricas */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'agendamentos hoje', value: '47' },
                  { label: 'faturado hoje', value: 'R$2.840' },
                  { label: 'faltas evitadas', value: '3' },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl border border-violet-100 bg-white p-3 text-center">
                    <div className="text-lg font-extrabold text-violet-600">{value}</div>
                    <div className="text-xs text-slate-500">{label}</div>
                  </div>
                ))}
              </div>

              {/* Cards de agendamento */}
              {[
                { nome: 'Ana Silva — 14h00', servico: 'Escova + Hidratação · Mariana', color: 'from-violet-500 to-pink-500' },
                { nome: 'Juliana Costa — 15h30', servico: 'Coloração completa · Paula', color: 'from-pink-500 to-orange-400' },
                { nome: 'Camila Rocha — 17h00', servico: 'Corte + Finalização · Carla', color: 'from-sky-500 to-violet-500' },
              ].map(({ nome, servico, color }) => (
                <div key={nome} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3">
                  <div className={`h-8 w-8 flex-shrink-0 rounded-lg bg-gradient-to-br ${color}`} />
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{nome}</div>
                    <div className="text-xs text-slate-500">{servico}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
