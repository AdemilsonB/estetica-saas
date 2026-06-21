'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import React, { useState, type ReactNode } from 'react'
import * as Icons from 'lucide-react'
import { LogOut, Menu, Users } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
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
import { MobileHeader } from '@/components/app/mobile-header'
import { SwipeNavWrapper } from '@/components/app/swipe-nav-wrapper'
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
  const [newAppointmentOpen, setNewAppointmentOpen] = useState(false)
  const [sidebarDrawerOpen, setSidebarDrawerOpen] = useState(false)

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
          <div className={cn('flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-pink-600 font-extrabold text-white', isSmall ? 'size-9 text-sm' : 'size-10 text-base')}>
            A
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

  function NavLink({ item, showLabel, hasBadge, onClick }: { item: NavSection; showLabel: boolean; hasBadge?: boolean; onClick?: () => void }) {
    const Icon = (Icons as unknown as Record<string, React.ElementType>)[item.icon] ?? Icons.Circle
    const isActive = pathname.startsWith(item.href)
    return (
      <Link
        href={item.href}
        onClick={onClick}
        className={cn(
          'relative flex items-center rounded-xl transition',
          showLabel ? 'gap-3 px-3 py-2.5' : 'size-10 justify-center',
          isActive
            ? 'bg-accent text-primary font-semibold'
            : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
        )}
      >
        {isActive && showLabel && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-[20%] h-[60%] w-[3px] rounded-r"
            style={{ background: 'linear-gradient(to bottom, #7C3AED, #DB2777)' }}
          />
        )}
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

  function SidebarContent({ showLabel, onNavigate }: { showLabel: boolean; onNavigate?: () => void }) {
    return (
      <div>
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
                    <NavLink key={item.href} item={item} showLabel onClick={onNavigate} />
                  ) : (
                    <Tooltip key={item.href}>
                      <TooltipTrigger asChild>
                        <div><NavLink item={item} showLabel={false} onClick={onNavigate} /></div>
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
                <NavLink item={configItem} showLabel hasBadge={whatsappPending} onClick={onNavigate} />
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div><NavLink item={configItem} showLabel={false} hasBadge={whatsappPending} onClick={onNavigate} /></div>
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

                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut className="size-4" />
                  Sair da conta
                </button>
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
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
    <div className="min-h-screen bg-background text-foreground">
      {/* Header mobile — visível apenas em < md */}
      <MobileHeader
        logoUrl={logoUrl}
        businessName={businessName}
        onOpenSidebar={() => setSidebarDrawerOpen(true)}
      />

      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        {/* Sidebar — tablet (md+) e desktop */}
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
          <SwipeNavWrapper>
            <div className="flex-1 px-4 py-6 pb-24 sm:px-6 md:pb-6 xl:px-8 xl:py-8">
              {children}
            </div>
          </SwipeNavWrapper>
        </div>
      </div>

      {/* Sidebar drawer — mobile (< md) */}
      <Sheet open={sidebarDrawerOpen} onOpenChange={setSidebarDrawerOpen}>
        <SheetContent side="left" className="w-65 p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SidebarContent showLabel onNavigate={() => setSidebarDrawerOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Bottom nav mobile */}
      <BottomNav
        onNewAppointment={() => setNewAppointmentOpen(true)}
      />

      {/* Modal novo agendamento */}
      <CreateAppointmentModal
        open={newAppointmentOpen}
        onClose={() => setNewAppointmentOpen(false)}
      />
    </div>
    </TooltipProvider>
  )
}
