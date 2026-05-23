'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import {
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
    permission: null, // sempre visível
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(244,114,182,0.16),_transparent_28%),linear-gradient(180deg,_#fff8fb_0%,_#fffdfd_45%,_#fff5f8_100%)] text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        {/* Sidebar desktop */}
        <aside className="hidden w-[290px] flex-col border-r border-white/70 bg-white/70 px-5 py-6 backdrop-blur xl:flex">
          <div className="flex items-center gap-3">
            <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 shadow-sm">
              <Sparkles className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-[0.24em] text-rose-500 uppercase">
                SaaS Estética
              </p>
              <h1 className="text-lg font-semibold text-slate-950">
                Operational Workspace
              </h1>
            </div>
          </div>

          {/* Tenant info */}
          <div className="mt-8 rounded-[1.75rem] border border-white/80 bg-white/90 p-4 shadow-[0_20px_50px_rgba(190,24,93,0.08)]">
            {isLoading ? (
              <>
                <Skeleton className="h-3 w-20 mb-2" />
                <Skeleton className="h-5 w-36" />
              </>
            ) : (
              <>
                <p className="text-xs font-semibold tracking-[0.2em] text-slate-400 uppercase">
                  Negócio ativo
                </p>
                <h2 className="mt-2 text-lg font-semibold text-slate-950">
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
                          ? 'bg-rose-50 text-rose-700'
                          : 'text-slate-700 hover:bg-white hover:text-slate-950',
                      )}
                    >
                      <span
                        className={cn(
                          'inline-flex size-10 items-center justify-center rounded-2xl',
                          isActive
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-slate-100 text-slate-700',
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">
                          {item.label}
                        </span>
                        <span className="block text-xs text-slate-500">
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
                      ? 'bg-rose-50 text-rose-700'
                      : 'text-slate-600 hover:bg-white hover:text-slate-950',
                  )}
                >
                  <Icon className="size-4" />
                  {configItem.label}
                </Link>
              )
            })()}
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
            >
              <LogOut className="size-4" />
              Sair da conta
            </button>
          </div>
        </aside>

        {/* Área principal */}
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
                {isLoading ? (
                  <Skeleton className="h-5 w-48 mt-1" />
                ) : (
                  <h2 className="truncate text-lg font-semibold text-slate-950">
                    Olá, {user?.name?.split(' ')[0] ?? '—'}
                  </h2>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="inline-flex size-10 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-600 transition hover:bg-rose-100 xl:hidden"
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
          <nav className="sticky bottom-0 z-20 border-t border-white/70 bg-white/90 px-2 py-2 backdrop-blur xl:hidden">
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
                          ? 'bg-rose-50 text-rose-700'
                          : 'text-slate-600 hover:bg-rose-50 hover:text-rose-700',
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
