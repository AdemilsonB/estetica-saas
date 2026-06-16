// src/components/domain/landing/landing-hero.tsx
import Link from 'next/link'

export function LandingHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-violet-50 to-pink-50 px-4 sm:px-6 pb-10 sm:pb-16 pt-14 sm:pt-20 text-center">
      {/* Glow decorativo */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-violet-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 bottom-0 h-64 w-64 rounded-full bg-pink-200/30 blur-3xl" />

      {/* Badge */}
      <div className="mb-6 inline-block rounded-full border border-violet-200 bg-gradient-to-r from-violet-50 to-pink-50 px-4 py-1.5 text-xs font-semibold text-violet-700">
        ✨ Plataforma #1 para salões de beleza
      </div>

      {/* Headline */}
      <h1 className="mx-auto max-w-3xl text-3xl font-extrabold leading-tight text-slate-900 sm:text-4xl md:text-5xl lg:text-6xl">
        Seu salão no{' '}
        <span className="bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent">
          piloto automático.
        </span>
        <br />
        Você foca nas clientes.
      </h1>

      {/* Subtítulo */}
      <p className="mx-auto mt-4 sm:mt-5 max-w-xl text-sm sm:text-lg text-slate-500">
        Agenda online, WhatsApp automático e controle financeiro — tudo em um só lugar.
        Sem planilha. Sem telefone tocando.
      </p>

      {/* CTAs */}
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/login"
          className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 px-8 py-4 text-base font-bold text-white shadow-lg shadow-violet-200 transition-opacity hover:opacity-90 sm:w-auto"
        >
          Começar trial gratuito →
        </Link>
        <Link
          href="/planos"
          className="flex items-center gap-2 text-sm font-semibold text-violet-600 hover:text-violet-800 transition-colors"
        >
          Ver planos e preços
        </Link>
      </div>

      {/* Screenshot mockup — overflow-x-auto para mobile */}
      <div className="relative mx-auto mt-8 sm:mt-14 max-w-4xl overflow-x-auto">
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
                  className={`rounded-lg px-3 py-2 text-xs ${i === 0 ? 'bg-gradient-to-r from-violet-600 to-pink-600 text-white font-semibold' : 'text-slate-400'}`}
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
