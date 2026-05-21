import type { ReactNode } from "react";
import {
  Bell,
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  Search,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";

const navigationItems = [
  {
    label: "Workspace",
    description: "Visao geral do negocio",
    icon: LayoutDashboard,
    href: "#workspace",
  },
  {
    label: "Agenda",
    description: "Atendimentos e encaixes",
    icon: CalendarDays,
    href: "#agenda",
  },
  {
    label: "Clientes",
    description: "CRM e recorrencia",
    icon: Users,
    href: "#clientes",
  },
  {
    label: "Financeiro",
    description: "Receitas e caixa",
    icon: CreditCard,
    href: "#financeiro",
  },
];

const utilityItems = [
  {
    label: "Notificacoes",
    icon: Bell,
    href: "#notificacoes",
  },
  {
    label: "Configuracoes",
    icon: Settings,
    href: "#configuracoes",
  },
];

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(244,114,182,0.16),_transparent_28%),linear-gradient(180deg,_#fff8fb_0%,_#fffdfd_45%,_#fff5f8_100%)] text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-[290px] flex-col border-r border-white/70 bg-white/70 px-5 py-6 backdrop-blur xl:flex">
          <div className="flex items-center gap-3">
            <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 shadow-sm">
              <Sparkles className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-[0.24em] text-rose-500 uppercase">
                SaaS Estetica
              </p>
              <h1 className="text-lg font-semibold text-slate-950">
                Operational Workspace
              </h1>
            </div>
          </div>

          <div className="mt-8 rounded-[1.75rem] border border-white/80 bg-white/90 p-4 shadow-[0_20px_50px_rgba(190,24,93,0.08)]">
            <p className="text-xs font-semibold tracking-[0.2em] text-slate-400 uppercase">
              Tenant ativo
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">
              SaaS Estetica Demo
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Base preparada para agenda, CRM, financeiro e operacao mobile-first.
            </p>
          </div>

          <nav className="mt-8 space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;

              return (
                <a
                  key={item.label}
                  href={item.href}
                  className="flex items-center gap-3 rounded-2xl px-4 py-3 text-slate-700 transition hover:bg-white hover:text-slate-950"
                >
                  <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{item.label}</span>
                    <span className="block text-xs text-slate-500">
                      {item.description}
                    </span>
                  </span>
                </a>
              );
            })}
          </nav>

          <div className="mt-auto space-y-2 pt-8">
            {utilityItems.map((item) => {
              const Icon = item.icon;

              return (
                <a
                  key={item.label}
                  href={item.href}
                  className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-slate-950"
                >
                  <Icon className="size-4" />
                  {item.label}
                </a>
              );
            })}
          </div>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-white/70 bg-white/75 px-4 py-4 backdrop-blur sm:px-6 xl:px-8">
            <div className="flex items-center gap-3">
              <div className="xl:hidden">
                <div className="inline-flex size-11 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
                  <Sparkles className="size-5" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold tracking-[0.18em] text-rose-500 uppercase">
                  Workspace operacional
                </p>
                <h2 className="truncate text-lg font-semibold text-slate-950">
                  SaaS para negocios de estetica e servicos
                </h2>
              </div>
              <div className="hidden items-center gap-3 rounded-full border border-white/80 bg-white/85 px-4 py-2 shadow-sm lg:flex">
                <Search className="size-4 text-slate-400" />
                <span className="text-sm text-slate-500">
                  Buscar cliente, servico ou agendamento
                </span>
              </div>
            </div>
          </header>

          <div className="flex-1 px-4 py-6 sm:px-6 xl:px-8 xl:py-8">{children}</div>

          <nav className="sticky bottom-0 z-20 border-t border-white/70 bg-white/90 px-2 py-2 backdrop-blur xl:hidden">
            <div className="grid grid-cols-4 gap-1">
              {navigationItems.map((item) => {
                const Icon = item.icon;

                return (
                  <a
                    key={item.label}
                    href={item.href}
                    className="flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-center text-[11px] font-medium text-slate-600 transition hover:bg-rose-50 hover:text-rose-700"
                  >
                    <Icon className="size-4" />
                    <span>{item.label}</span>
                  </a>
                );
              })}
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}
