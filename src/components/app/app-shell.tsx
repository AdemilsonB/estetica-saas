'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import {
  BarChart2,
  CalendarDays,
  CreditCard,
  LogOut,
  Menu,
  Scissors,
  Settings,
  Users,
  UserCog,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { usePermissions } from '@/hooks/use-permissions'
import { createSupabaseBrowserClient } from '@/integrations/supabase/client'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  {
    label: 'Agenda',
    description: 'Atendimentos e encaixes',
    icon: CalendarDays,
    href: '/agenda',
    sectionKey: 'agenda',
  },
  {
    label: 'Serviços',
    description: 'Serviços, Pacotes e Promoções',
    icon: Scissors,
    href: '/servicos',
    sectionKey: 'servicos',
  },
  {
    label: 'Clientes',
    description: 'CRM e recorrência',
    icon: Users,
    href: '/clientes',
    sectionKey: 'clientes',
  },
  {
    label: 'Financeiro',
    description: 'Receitas e caixa',
    icon: CreditCard,
    href: '/financeiro',
    sectionKey: 'financeiro',
  },
  {
    label: 'Relatórios',
    description: 'Análises e exportações',
    icon: BarChart2,
    href: '/relatorios',
    sectionKey: 'relatorios',
  },
  {
    label: 'Equipe',
    description: 'Usuários e permissões',
    icon: UserCog,
    href: '/equipe',
    sectionKey: 'equipe',
  },
  {
    label: 'Config.',
    description: 'Configurações',
    icon: Settings,
    href: '/configuracoes',
    sectionKey: null,
  },
] as const

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
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('sidebar-collapsed') === 'true'
  })
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar-collapsed', String(next))
  }

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const visibleItems = NAV_ITEMS.filter(
    (item) => item.sectionKey === null || canAccess(item.sectionKey),
  )

  const mainItems = visibleItems.slice(0, -1)
  const configItem = visibleItems.at(-1)

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

  function NavLink({ item, showLabel }: { item: typeof NAV_ITEMS[number]; showLabel: boolean }) {
    const Icon = item.icon
    const isActive = pathname.startsWith(item.href)
    return (
      <Link
        href={item.href}
        className={cn(
          'flex items-center rounded-xl transition',
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
          <span className="min-w-0">
            <span className="block text-sm font-medium">{item.label}</span>
            <span className="block text-xs text-muted-foreground">{item.description}</span>
          </span>
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 text-muted-foreground"
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
                  className="size-8 text-muted-foreground"
                  onClick={toggleCollapsed}
                  aria-label="Expandir sidebar"
                >
                  <Menu className="size-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Nav */}
          <nav className={cn('flex-1 space-y-1 py-4', showLabel ? 'px-3' : 'px-2')}>
            {isLoading
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
                <NavLink item={configItem} showLabel />
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div><NavLink item={configItem} showLabel={false} /></div>
                  </TooltipTrigger>
                  <TooltipContent side="right">{configItem.label}</TooltipContent>
                </Tooltip>
              )
            )}

            {showLabel && (
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-border/50 bg-accent/30 px-3 py-2">
                <div className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-xs font-bold text-primary">
                  {getInitials(user?.name ?? 'U')}
                </div>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-foreground">
                    {isLoading ? '...' : (user?.name ?? '—')}
                  </span>
                </span>
                <button
                  onClick={handleLogout}
                  className="shrink-0 text-muted-foreground transition hover:text-foreground"
                  aria-label="Sair da conta"
                >
                  <LogOut className="size-4" />
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
      </TooltipProvider>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        {/* Sidebar desktop (xl+) */}
        <aside
          className={cn(
            'hidden xl:flex flex-col border-r border-border/50 bg-background/80 backdrop-blur transition-all duration-200',
            collapsed ? 'w-[64px]' : 'w-[220px]',
          )}
        >
          <SidebarContent showLabel={!collapsed} />
        </aside>

        {/* Área principal */}
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          {/* Header mobile (< xl) */}
          <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/50 bg-background/80 px-4 py-3 backdrop-blur xl:hidden">
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0" aria-label="Abrir menu">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[240px] p-0 bg-background">
                <SidebarContent showLabel />
              </SheetContent>
            </Sheet>

            <div className="flex flex-1 items-center justify-center">
              <LogoBrand />
            </div>

            <div className="shrink-0">
              <div className="inline-flex size-9 items-center justify-center rounded-xl bg-primary/15 text-xs font-bold text-primary">
                {isLoading ? '…' : getInitials(user?.name ?? 'U')}
              </div>
            </div>
          </header>

          <div className="flex-1 px-4 py-6 sm:px-6 xl:px-8 xl:py-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
