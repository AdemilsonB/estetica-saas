// src/components/domain/landing/landing-hero.tsx
import Link from 'next/link'

interface LandingHeroProps {
  trialDays: number | null
}

export function LandingHero({ trialDays }: LandingHeroProps) {
  const trialMicrotrust = trialDays ? `${trialDays} dias grátis` : 'Trial grátis'

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#FAF8FF] via-[#F0EBFF] to-[#FCE8F3] px-4 pb-12 pt-12 sm:px-6 sm:pb-20 sm:pt-20">
      {/* Glow decorativo */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-violet-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 bottom-0 h-64 w-64 rounded-full bg-pink-200/30 blur-3xl" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_.95fr] lg:gap-14">
        {/* Coluna de texto */}
        <div className="text-center lg:text-left">
          <div className="mb-5 inline-block rounded-full border border-violet-200 bg-gradient-to-r from-violet-50 to-pink-50 px-4 py-1.5 text-xs font-semibold text-violet-700">
            ✨ Feito para salões, barbearias e clínicas
          </div>
          <h1 className="font-display mx-auto max-w-2xl text-[clamp(1.9rem,6vw,3.25rem)] font-extrabold leading-[1.08] text-slate-900 lg:mx-0">
            Pare de perder cliente no telefone tocando. Sua agenda no{' '}
            <span className="bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent">
              piloto automático.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-sm text-slate-500 sm:text-lg lg:mx-0">
            Agenda online, WhatsApp automático e financeiro em tempo real — tudo num lugar só.
            Sem planilha, sem telefone tocando.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <Link
              href="/login?tab=signup"
              className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 px-8 py-4 text-base font-bold text-white shadow-lg shadow-violet-200 transition-opacity hover:opacity-90 sm:w-auto"
            >
              Começar trial grátis →
            </Link>
            <Link
              href="#planos"
              className="flex items-center gap-2 text-sm font-semibold text-violet-600 transition-colors hover:text-violet-800"
            >
              Ver planos e preços
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-400">
            ✓ sem cartão de crédito · {trialMicrotrust}
          </p>
        </div>

        {/* Coluna do mockup (com badge flutuante) */}
        <div className="relative">
          <div className="overflow-x-auto">
            <div className="min-w-[22rem] overflow-hidden rounded-2xl border border-slate-200 shadow-2xl shadow-slate-900/20">
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

          {/* Badge flutuante */}
          <div className="absolute -bottom-4 -left-3 flex items-center gap-2 rounded-2xl border border-violet-100 bg-white px-3 py-2 shadow-xl shadow-violet-200/50 sm:-left-5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#25D366] text-sm text-white">✓</span>
            <div>
              <div className="text-xs font-extrabold text-slate-900">Confirmação automática</div>
              <div className="text-[11px] text-slate-500">enviada há 2 min</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
