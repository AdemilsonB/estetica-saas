'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import React, { useEffect, useState, type ReactNode } from 'react'
import * as Icons from 'lucide-react'
import { LogOut, Menu, Users } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { usePermissions } from '@/hooks/use-permissions'
import { useBillingStatus } from '@/hooks/billing/use-billing-status'
import { useNavSections } from '@/hooks/iam/use-nav-sections'
import { useEvolutionStatus } from '@/hooks/settings/use-evolution-status'
import { createSupabaseBrowserClient } from '@/integrations/supabase/client'
import { cn } from '@/lib/utils'
import type { NavSection } from '@/shared/permissions/nav-registry'
import { BottomNav } from '@/components/app/bottom-nav'
import { CreateAppointmentModal } from '@/components/domain/scheduling/create-appointment-modal'

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('')
}

interface AppShellProps {
  children: ReactNode
  logoUrl: string | null
  businessName: string
}

export function AppShell({ children, logoUrl, businessName }: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { canAccess, user, isLoading } = usePermissions()
  const { data: billingStatus } = useBillingStatus()
  const { data: planNavSections, isLoading: navSectionsLoading } = useNavSections()
  const [upgradeCardDismissed, setUpgradeCardDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return sessionStorage.getItem('upgrade-card-dismissed') === '1'
  })
  const { data: evolutionStatus, isLoading: evolutionLoading } = useEvolutionStatus()
  const whatsappPending = !evolutionLoading && evolutionStatus?.connected === false
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    // Tablet (< xl) nunca colapsa
    if (window.innerWidth < 1280) return false
    return localStorage.getItem('sidebar-collapsed') === 'true'
  })
  const [menuDrawerOpen, setMenuDrawerOpen] = useState(false)
  const [newAppointmentOpen, setNewAppointmentOpen] = useState(false)

  useEffect(() => {
    setMenuDrawerOpen(false)
  }, [pathname])

  function toggleCollapsed() {
    if (typeof window !== 'undefined' && window.innerWidth < 1280) return
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar-collapsed', String(next))
  }

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navBase = planNavSections ?? []
  const visibleItems = navBase.filter((section) => canAccess(section.key))
  const mainItems = visibleItems.filter((s) => s.key !== 'configuracoes')
  const configItem = visibleItems.find((s) => s.key === 'configuracoes')

  function UserAvatar({ size = 'md' }: { size?: 'md' | 'sm' }) {
    const dim = size === 'sm' ? 'size-9' : 'size-[34px]'
    if (user?.avatarUrl) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.avatarUrl}
          alt={user.name}
          className={cn(dim, 'shrink-0 rounded-xl object-cover')}
        />
      )
    }
    return (
      <div className={cn(dim, 'inline-flex shrink-0 items-center justify-center rounded-xl bg-primary/15 text-xs font-bold text-primary')}>
        {getInitials(user?.name ?? 'U')}
      </div>
    )
  }

  function PlanBadge() {
    if (!billingStatus) return null
    const { plan, status, trialEndsAt } = billingStatus

    if (status === 'TRIALING' && trialEndsAt) {
      const daysLeft = Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))
      return (
        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
          Trial · {daysLeft}d
        </span>
      )
    }

    const styles: Record<string, string> = {
      FREE:       'bg-slate-100 text-slate-600 border-slate-200',
      STARTER:    'bg-blue-50 text-blue-700 border-blue-200',
      PRO:        'bg-violet-50 text-violet-700 border-violet-200',
      ENTERPRISE: 'bg-amber-50 text-amber-700 border-amber-200',
    }

    return (
      <span className={cn('inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide', styles[plan] ?? styles['FREE'])}>
        {plan}
      </span>
    )
  }

  function LogoBrand({ size = 'normal' }: { size?: 'normal' | 'small' }) {
    const isSmall = size === 'small'
    return (
      <Link href="/dashboard" title="Ir para Dashboard" className="flex items-center gap-3 min-w-0">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={businessName}
            className={cn('shrink-0 object-contain rounded-xl', isSmall ? 'size-9' : 'size-10')}
          />
        ) : (
          <div
            className={cn(
              'shrink-0 inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold',
              isSmall ? 'size-9 text-sm' : 'size-10 text-base',
            )}
          >
            {getInitials(businessName || 'E')}
          </div>
        )}
        {!isSmall && (
          <span className="truncate text-sm font-semibold text-foreground">
            {businessName || 'Meu negócio'}
          </span>
        )}
      </Link>
    )
  }

  function NavLink({ item, showLabel, hasBadge }: { item: NavSection; showLabel: boolean; hasBadge?: boolean }) {
    const Icon = (Icons as unknown as Record<string, React.ElementType>)[item.icon] ?? Icons.Circle
    const isActive = pathname.startsWith(item.href)
    return (
      <Link
        href={item.href}
        className={cn(
          'flex items-center rounded-xl transition',
          hasBadge && 'relative',
          showLabel ? 'gap-3 px-3 py-2.5' : 'size-10 justify-center',
          isActive
            ? 'bg-accent text-primary'
            : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
        )}
      >
        <span
          className={cn(
            'inline-flex shrink-0 items-center justify-center rounded-lg',
            showLabel ? 'size-8' : 'size-6',
            isActive ? 'bg-primary/15 text-primary' : 'text-muted-foreground',
          )}
        >
          <Icon className="size-4" />
        </span>
        {showLabel && (
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">{item.label}</span>
            <span className="block text-xs text-muted-foreground">{item.description}</span>
          </span>
        )}
        {showLabel && hasBadge && (
          <span
            aria-label="Configuração pendente"
            className="ml-auto inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-green-500 text-[9px] font-bold leading-none text-white"
          >
            !
          </span>
        )}
        {!showLabel && hasBadge && (
          <span aria-hidden="true" className="absolute right-0.5 top-0.5 size-2 rounded-full bg-green-500" />
        )}
      </Link>
    )
  }

  function SidebarContent({ showLabel }: { showLabel: boolean }) {
    return (
      <TooltipProvider delayDuration={300}>
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className={cn('flex items-center border-b border-border/50 py-4', showLabel ? 'px-4 justify-between' : 'px-3 justify-center')}>
            {showLabel ? (
              <>
                <LogoBrand />
                {/* Toggle só visível em xl+ (desktop) */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden xl:inline-flex size-8 shrink-0 text-muted-foreground"
                  onClick={toggleCollapsed}
                  aria-label="Recolher sidebar"
                >
                  <Menu className="size-4" />
                </Button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <LogoBrand size="small" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden xl:inline-flex size-8 text-muted-foreground"
                  onClick={toggleCollapsed}
                  aria-label="Expandir sidebar"
                >
                  <Menu className="size-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Nav */}
          <nav className={cn('flex-1 overflow-y-auto space-y-1 py-4', showLabel ? 'px-3' : 'px-2')}>
            {isLoading || navSectionsLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className={cn('rounded-xl', showLabel ? 'h-12 w-full' : 'size-10')} />
                ))
              : mainItems.map((item) =>
                  showLabel ? (
                    <NavLink key={item.href} item={item} showLabel />
                  ) : (
                    <Tooltip key={item.href}>
                      <TooltipTrigger asChild>
                        <div><NavLink item={item} showLabel={false} /></div>
                      </TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  ),
                )}
          </nav>

          {/* Rodapé — config + usuário */}
          <div className={cn('border-t border-border/50 py-3', showLabel ? 'px-3 space-y-1' : 'px-2 space-y-2 flex flex-col items-center')}>
            {configItem && (
              showLabel ? (
                <NavLink item={configItem} showLabel hasBadge={whatsappPending} />
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div><NavLink item={configItem} showLabel={false} hasBadge={whatsappPending} /></div>
                  </TooltipTrigger>
                  <TooltipContent side="right">{configItem.label}</TooltipContent>
                </Tooltip>
              )
            )}

            {showLabel && (
              <div className="mt-2 space-y-2">
                {/* Avatar com DropdownMenu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex w-full items-center gap-2 rounded-xl border border-border/50 bg-accent/30 px-3 py-2 text-left transition hover:bg-accent/50">
                      <UserAvatar />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-foreground">
                          {isLoading ? '...' : (user?.name ?? '—')}
                        </span>
                        <PlanBadge />
                      </span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="end" className="w-48">
                    <DropdownMenuItem asChild>
                      <Link href="/equipe" className="flex items-center gap-2">
                        <Users className="size-4" />
                        Minha equipe
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="flex items-center gap-2 text-destructive focus:text-destructive"
                    >
                      <LogOut className="size-4" />
                      Sair
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {billingStatus?.plan === 'FREE' && billingStatus?.status !== 'TRIALING' && !upgradeCardDismissed && (
                  <div className="rounded-xl bg-linear-to-br from-violet-600 to-purple-600 p-3 text-white">
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <p className="text-xs font-bold leading-tight"><span aria-hidden="true">🚀</span> Desbloqueie mais recursos</p>
                        <p className="mt-0.5 text-[10px] leading-tight opacity-80">WhatsApp, relatórios e muito mais</p>
                      </div>
                      <button
                        onClick={() => {
                          sessionStorage.setItem('upgrade-card-dismissed', '1')
                          setUpgradeCardDismissed(true)
                        }}
                        className="shrink-0 text-[12px] text-white/60 transition hover:text-white"
                        aria-label="Dispensar"
                      >
                        ×
                      </button>
                    </div>
                    <Link
                      href="/configuracoes/planos"
                      className="mt-2 block w-full rounded-lg bg-white py-1.5 text-center text-[11px] font-bold text-violet-700 transition hover:bg-white/90"
                    >
                      Ver planos →
                    </Link>
                  </div>
                )}
              </div>
            )}

            {!showLabel && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleLogout}
                    className="inline-flex size-10 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-accent/60 hover:text-foreground"
                    aria-label="Sair da conta"
                  >
                    <LogOut className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Sair da conta</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </TooltipProvider>
    )
  }

  // Itens de navegação secundária para o bottom drawer "Menu"
  const MENU_DRAWER_LINKS = [
    { label: 'Serviços', href: '/servicos' },
    { label: 'Produtos', href: '/produtos' },
    { label: 'Equipe', href: '/equipe' },
    { label: 'Configurações', href: '/configuracoes' },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        {/* Sidebar — tablet (md+) e desktop (xl+) */}
        <aside
          className={cn(
            'hidden md:flex flex-col h-screen sticky top-0 overflow-hidden border-r border-border/50 bg-background/80 backdrop-blur transition-all duration-200',
            collapsed ? 'w-[64px]' : 'w-[220px]',
          )}
        >
          <SidebarContent showLabel={!collapsed} />
        </aside>

        {/* Área principal */}
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <div className="flex-1 px-4 py-6 pb-24 sm:px-6 md:pb-6 xl:px-8 xl:py-8">
            {children}
          </div>
        </div>
      </div>

      {/* Bottom nav mobile (< md) */}
      <BottomNav
        onNewAppointment={() => setNewAppointmentOpen(true)}
        onOpenMenu={() => setMenuDrawerOpen(true)}
      />

      {/* Bottom drawer "Menu" (mobile) */}
      <Sheet open={menuDrawerOpen} onOpenChange={setMenuDrawerOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
          <div className="space-y-1 pt-2">
            {MENU_DRAWER_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center rounded-xl px-4 py-3 text-sm font-medium transition',
                  pathname.startsWith(link.href)
                    ? 'bg-accent text-primary'
                    : 'text-foreground hover:bg-accent/60',
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="mt-4 border-t border-border/50 pt-4">
            <div className="flex items-center gap-3 rounded-xl px-4 py-3">
              <UserAvatar />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {user?.name ?? '—'}
                </p>
                <PlanBadge />
              </div>
            </div>
            <Link
              href="/equipe"
              className="flex w-full items-center gap-2 rounded-xl px-4 py-2.5 text-sm text-muted-foreground transition hover:bg-accent/60 hover:text-foreground"
            >
              <Users className="size-4" />
              Ver equipe
            </Link>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-xl px-4 py-2.5 text-sm text-destructive transition hover:bg-destructive/10"
            >
              <LogOut className="size-4" />
              Sair
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Modal novo agendamento — controlado pelo FAB da bottom nav */}
      <CreateAppointmentModal
        open={newAppointmentOpen}
        onClose={() => setNewAppointmentOpen(false)}
      />
    </div>
  )
}
