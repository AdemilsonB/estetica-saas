import {
  ArrowRight,
  CalendarClock,
  CreditCard,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const modules = [
  {
    title: "IAM multi-tenant",
    description:
      "Controle de acesso por tenant, perfis operacionais e permissoes preparadas para RBAC.",
    icon: ShieldCheck,
  },
  {
    title: "CRM operacional",
    description:
      "Clientes com tags, historico e base pronta para recorrencia, retencao e campanhas.",
    icon: Users,
  },
  {
    title: "Agenda como centro",
    description:
      "Agendamentos com verificacao de conflito, servicos com duracao e eventos para automacao.",
    icon: CalendarClock,
  },
  {
    title: "Financeiro conectado",
    description:
      "Transacoes ligadas ao atendimento e preparadas para fechamento de caixa e analise.",
    icon: CreditCard,
  },
];

const quickActions = [
  "Criar agendamento em ate 3 passos",
  "Confirmar e concluir atendimento com poucos toques",
  "Consultar clientes e historico no mobile",
  "Evoluir para dashboard sem comprometer a operacao",
];

const architectureHighlights = [
  "Prisma + migrations versionadas",
  "Supabase com portabilidade planejada",
  "API Routes finas com validacao Zod",
  "Services com eventos internos desacoplados",
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 xl:gap-8">
      <section
        id="workspace"
        className="grid gap-6 rounded-[2rem] border border-white/80 bg-white/75 p-5 shadow-[0_24px_80px_rgba(190,24,93,0.10)] backdrop-blur sm:p-6 xl:grid-cols-[1.15fr_0.85fr] xl:items-start"
      >
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold tracking-[0.2em] text-rose-700 uppercase">
            <Sparkles className="size-3.5" />
            SaaS estetica mobile-first
          </div>

          <div className="space-y-4">
            <h1 className="max-w-4xl text-4xl font-semibold tracking-[-0.06em] text-slate-950 sm:text-5xl xl:text-6xl">
              Estrutura pronta para virar um workspace operacional premium.
            </h1>
            <p className="max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
              O projeto agora tem base de dominio, migrations, configuracao
              portavel, auth preparada para Supabase e uma fundacao de interface
              responsiva pensada para profissionais no mobile e gestores no desktop.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              className="h-12 rounded-full bg-slate-950 px-6 text-white hover:bg-slate-800"
            >
              Seguir para agenda
              <ArrowRight className="size-4" />
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 rounded-full border-rose-200 bg-white/80 px-6 text-slate-700"
            >
              <a href="/api/iam/me">Validar sessao e API</a>
            </Button>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-slate-200/80 bg-slate-950 p-5 text-white sm:p-6">
          <p className="text-xs font-semibold tracking-[0.2em] text-rose-200 uppercase">
            Proxima camada
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">
            Fluxo vertical da agenda com auth real e operacao mobile.
          </h2>
          <div className="mt-6 space-y-3">
            {quickActions.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-slate-100"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 2xl:grid-cols-4">
        {modules.map((module) => {
          const Icon = module.icon;

          return (
            <article
              key={module.title}
              id={module.title.toLowerCase()}
              className="rounded-[1.75rem] border border-white/80 bg-white/85 p-5 shadow-[0_16px_45px_rgba(15,23,42,0.06)] transition-transform duration-300 hover:-translate-y-1"
            >
              <div className="inline-flex rounded-2xl bg-rose-100 p-3 text-rose-700">
                <Icon className="size-5" />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-slate-950">
                {module.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {module.description}
              </p>
            </article>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <article
          id="agenda"
          className="rounded-[1.75rem] border border-white/80 bg-white/85 p-5 shadow-[0_16px_45px_rgba(15,23,42,0.06)] sm:p-6"
        >
          <p className="text-xs font-semibold tracking-[0.2em] text-slate-400 uppercase">
            Arquitetura aplicada
          </p>
          <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
            Backbone tecnico entregue para o MVP.
          </h3>
          <div className="mt-6 grid gap-3">
            {architectureHighlights.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"
              >
                {item}
              </div>
            ))}
          </div>
        </article>

        <article
          id="clientes"
          className="rounded-[1.75rem] border border-white/80 bg-white/85 p-5 shadow-[0_16px_45px_rgba(15,23,42,0.06)] sm:p-6"
        >
          <p className="text-xs font-semibold tracking-[0.2em] text-slate-400 uppercase">
            Estrategia de produto
          </p>
          <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
            O operacional vem antes do dashboard.
          </h3>
          <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
            A base visual e estrutural agora privilegia agenda, clientes e
            atendimento rapido em tela pequena. Isso reduz atrito para a equipe de
            operacao e preserva a escalabilidade do produto para desktop sem virar
            uma interface pesada ou genérica.
          </p>
        </article>
      </section>
    </main>
  );
}
