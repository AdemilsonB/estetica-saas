'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import {
  BarChart2,
  CalendarDays,
  CreditCard,
  LogOut,
  Settings,
  Sparkles,
  Users,
  UserCog,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { usePermissions } from '@/hooks/use-permissions'
import { createSupabaseBrowserClient } from '@/integrations/supabase/client'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  {
    label: 'Agenda',
    description: 'Atendimentos e encaixes',
    icon: CalendarDays,
    href: '/agenda',
    permission: 'appointments:view',
  },
  {
    label: 'Clientes',
    description: 'CRM e recorrência',
    icon: Users,
    href: '/clientes',
    permission: 'customers:view',
  },
  {
    label: 'Financeiro',
    description: 'Receitas e caixa',
    icon: CreditCard,
    href: '/financeiro',
    permission: 'financial:view',
  },
  {
    label: 'Relatórios',
    description: 'Análises e exportações',
    icon: BarChart2,
    href: '/relatorios',
    permission: 'financial:view',
  },
  {
    label: 'Equipe',
    description: 'Usuários e permissões',
    icon: UserCog,
    href: '/equipe',
    permission: 'users:view',
  },
  {
    label: 'Config.',
    description: 'Configurações',
    icon: Settings,
    href: '/configuracoes',
    permission: null,
  },
] as const

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { can, user, isLoading } = usePermissions()

  const visibleItems = NAV_ITEMS.filter(
    (item) => item.permission === null || can(item.permission),
  )

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        {/* Sidebar desktop */}
        <aside className="hidden w-[290px] flex-col border-r border-border/40 bg-background/80 px-5 py-6 backdrop-blur xl:flex">
          <Link
            href="/dashboard"
            title="Ir para Dashboard"
            className="flex items-center gap-3 rounded-2xl p-1 transition hover:bg-primary/5"
          >
            <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-sm">
              <Sparkles className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-[0.24em] text-primary uppercase">
                SaaS Estética
              </p>
              <h1 className="text-lg font-semibold text-foreground">
                Operational Workspace
              </h1>
            </div>
          </Link>

          {/* Tenant info */}
          <div className="mt-8 rounded-[1.75rem] border border-border/40 bg-background/90 p-4 shadow-sm">
            {isLoading ? (
              <>
                <Skeleton className="h-3 w-20 mb-2" />
                <Skeleton className="h-5 w-36" />
              </>
            ) : (
              <>
                <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                  Negócio ativo
                </p>
                <h2 className="mt-2 text-lg font-semibold text-foreground">
                  {user?.name ?? '—'}
                </h2>
              </>
            )}
          </div>

          {/* Nav principal */}
          <nav className="mt-8 space-y-2">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-2xl" />
                ))
              : visibleItems.slice(0, -1).map((item) => {
                  const Icon = item.icon
                  const isActive = pathname.startsWith(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-2xl px-4 py-3 transition',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-primary/5 hover:text-foreground',
                      )}
                    >
                      <span
                        className={cn(
                          'inline-flex size-10 items-center justify-center rounded-2xl',
                          isActive
                            ? 'bg-primary/15 text-primary'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">
                          {item.label}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {item.description}
                        </span>
                      </span>
                    </Link>
                  )
                })}
          </nav>

          {/* Config e logout no rodapé */}
          <div className="mt-auto space-y-1 pt-8">
            {(() => {
              const configItem = visibleItems.at(-1)
              if (!configItem) return null
              const Icon = configItem.icon
              const isActive = pathname.startsWith(configItem.href)
              return (
                <Link
                  href={configItem.href}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-primary/5 hover:text-foreground',
                  )}
                >
                  <Icon className="size-4" />
                  {configItem.label}
                </Link>
              )
            })()}
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary/15"
            >
              <LogOut className="size-4" />
              Sair da conta
            </button>
          </div>
        </aside>

        {/* Área principal */}
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-border/40 bg-background/75 px-4 py-4 backdrop-blur sm:px-6 xl:px-8">
            <div className="flex items-center gap-3">
              <div className="xl:hidden">
                <Link
                  href="/dashboard"
                  title="Ir para Dashboard"
                  className="inline-flex size-11 items-center justify-center rounded-2xl bg-primary/15 text-primary transition hover:bg-primary/25"
                >
                  <Sparkles className="size-5" />
                </Link>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">
                  Workspace operacional
                </p>
                {isLoading ? (
                  <Skeleton className="h-5 w-48 mt-1" />
                ) : (
                  <h2 className="truncate text-lg font-semibold text-foreground">
                    Olá, {user?.name?.split(' ')[0] ?? '—'}
                  </h2>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="inline-flex size-10 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary transition hover:bg-primary/15 xl:hidden"
                aria-label="Sair da conta"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </header>

          <div className="flex-1 px-4 py-6 sm:px-6 xl:px-8 xl:py-8">
            {children}
          </div>

          {/* Bottom nav mobile */}
          <nav className="sticky bottom-0 z-20 border-t border-border/40 bg-background/90 px-2 py-2 backdrop-blur xl:hidden">
            {isLoading ? (
              <div className="grid grid-cols-5 gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 rounded-2xl" />
                ))}
              </div>
            ) : (
              <div
                className="grid gap-1"
                style={{ gridTemplateColumns: `repeat(${visibleItems.length}, 1fr)` }}
              >
                {visibleItems.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname.startsWith(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-center text-[11px] font-medium transition',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-primary/10 hover:text-primary',
                      )}
                    >
                      <Icon className="size-4" />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            )}
          </nav>
        </div>
      </div>
    </div>
  )
}
