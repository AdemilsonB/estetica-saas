# UX Mobile + Reorganização de Configurações — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar bottom navigation bar no mobile, reorganizar a página de configurações em cards híbridos com sheets, conectar o avatar do usuário ao `/equipe`, e remover `autoFocus` de todos os modais.

**Architecture:** Alterações exclusivamente de camada de apresentação (Frontend). Novos componentes em `src/components/app/` e `src/components/domain/settings/`. O `AppShell` absorve as mudanças de breakpoint e o bottom nav. A página `/configuracoes` tem seus `<Tabs>` substituídos por grupos de cards. Zero alterações em services, repositories ou schema.

**Tech Stack:** Next.js 15 App Router, React, TypeScript, Tailwind CSS, Shadcn UI, Lucide React, Vitest + Testing Library

---

## Mapa de arquivos

### Criados
- `src/components/app/bottom-nav.tsx` — bottom nav fixa mobile (5 itens + FAB)
- `src/components/domain/settings/settings-group.tsx` — grupo colapsável de cards
- `src/components/domain/settings/settings-card.tsx` — card com header, status badge e botão "Editar"
- `src/components/domain/settings/settings-card-sheet.tsx` — wrapper Sheet para formulários existentes
- `src/components/ui/dropdown-menu.tsx` — componente Shadcn (instalado via CLI)
- `src/app/(app)/configuracoes/page.tsx` — substituição completa (rewrite)

### Modificados
- `src/components/app/app-shell.tsx` — breakpoints, remoção do header mobile, bottom nav, DropdownMenu avatar, CreateAppointmentModal
- `src/components/domain/crm/create-customer-modal.tsx:76` — remover `autoFocus`
- `src/components/domain/crm/edit-customer-modal.tsx:88` — remover `autoFocus`
- `src/components/domain/iam/invite-member-modal.tsx:74` — remover `autoFocus`
- `src/components/domain/iam/roles-manager.tsx:87` — remover `autoFocus`
- `src/components/domain/services/category-form-modal.tsx:48` — remover `autoFocus`

---

## Task 1: Criar branch e instalar DropdownMenu

**Files:**
- `src/components/ui/dropdown-menu.tsx` (criado pelo CLI do Shadcn)

- [ ] **Criar a branch a partir do estado atual**

```bash
git checkout -b feat/ux-mobile-configuracoes
```

- [ ] **Instalar o componente DropdownMenu do Shadcn**

```bash
npx shadcn@latest add dropdown-menu
```

Esperado: cria `src/components/ui/dropdown-menu.tsx` com exports `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator`.

- [ ] **Verificar que o arquivo foi criado**

```bash
ls src/components/ui/dropdown-menu.tsx
```

- [ ] **Commit**

```bash
git add src/components/ui/dropdown-menu.tsx
git commit -m "chore: adicionar componente DropdownMenu do shadcn"
```

---

## Task 2: Entrega 4 — Remover autoFocus de modais e sheets

**Files:**
- Modify: `src/components/domain/crm/create-customer-modal.tsx:76`
- Modify: `src/components/domain/crm/edit-customer-modal.tsx:88`
- Modify: `src/components/domain/iam/invite-member-modal.tsx:74`
- Modify: `src/components/domain/iam/roles-manager.tsx:87`
- Modify: `src/components/domain/services/category-form-modal.tsx:48`

- [ ] **Remover autoFocus de create-customer-modal.tsx (linha 76)**

Localizar o `<Input placeholder="Nome completo" ... autoFocus />` e remover apenas o atributo `autoFocus`:

```tsx
// ANTES (linha ~72-77):
<Input
  placeholder="Nome completo"
  value={name}
  onChange={(e) => setName(e.target.value)}
  autoFocus
/>

// DEPOIS:
<Input
  placeholder="Nome completo"
  value={name}
  onChange={(e) => setName(e.target.value)}
/>
```

- [ ] **Remover autoFocus de edit-customer-modal.tsx (linha 88)**

Mesmo padrão — localizar o primeiro `<Input>` do modal e remover `autoFocus`.

- [ ] **Remover autoFocus de invite-member-modal.tsx (linha 74)**

Localizar o `<Input>` com `autoFocus` e remover o atributo.

- [ ] **Remover autoFocus de roles-manager.tsx (linha 87)**

Localizar o `<Input>` com `autoFocus` e remover o atributo.

- [ ] **Remover autoFocus de category-form-modal.tsx (linha 48)**

Localizar o `<Input>` com `autoFocus` e remover o atributo.

- [ ] **Verificar que não há mais autoFocus em nenhum componente**

```bash
grep -rn "autoFocus" src/components/
```

Esperado: nenhuma linha no output.

- [ ] **Commit**

```bash
git add src/components/domain/crm/create-customer-modal.tsx
git add src/components/domain/crm/edit-customer-modal.tsx
git add src/components/domain/iam/invite-member-modal.tsx
git add src/components/domain/iam/roles-manager.tsx
git add src/components/domain/services/category-form-modal.tsx
git commit -m "fix(ux): remover autoFocus de modais e sheets — corrige teclado mobile"
```

---

## Task 3: Entrega 1 — Componente BottomNav

**Files:**
- Create: `src/components/app/bottom-nav.tsx`

- [ ] **Criar o componente BottomNav**

Criar `src/components/app/bottom-nav.tsx` com o seguinte conteúdo:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Calendar, Users, Plus, DollarSign, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BottomNavProps {
  onNewAppointment: () => void
  onOpenMenu: () => void
}

const NAV_ITEMS = [
  { icon: Calendar, label: 'Agenda', href: '/agenda' },
  { icon: Users, label: 'Clientes', href: '/clientes' },
  null, // slot do FAB central
  { icon: DollarSign, label: 'Financeiro', href: '/financeiro' },
] as const

export function BottomNav({ onNewAppointment, onOpenMenu }: BottomNavProps) {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex items-end justify-around border-t border-border/50 bg-background/95 pt-2 backdrop-blur md:hidden"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
    >
      {NAV_ITEMS.map((item, i) => {
        if (item === null) {
          return (
            <button
              key="fab"
              onClick={onNewAppointment}
              aria-label="Novo agendamento"
              className="-mt-5 flex size-14 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/30 text-primary-foreground transition hover:opacity-90 active:scale-95"
            >
              <Plus className="size-6" />
            </button>
          )
        }
        const Icon = item.icon
        const isActive = pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center gap-0.5 px-3 pb-1 text-[10px] font-medium',
              isActive ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <Icon className={cn('size-5', isActive && 'fill-primary/15')} />
            <span>{item.label}</span>
          </Link>
        )
      })}

      <button
        onClick={onOpenMenu}
        className="flex flex-col items-center gap-0.5 px-3 pb-1 text-[10px] font-medium text-muted-foreground"
      >
        <Menu className="size-5" />
        <span>Menu</span>
      </button>
    </nav>
  )
}
```

- [ ] **Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Esperado: sem erros em `bottom-nav.tsx`.

- [ ] **Commit**

```bash
git add src/components/app/bottom-nav.tsx
git commit -m "feat(ux): componente BottomNav para mobile"
```

---

## Task 4: Entrega 1+3 — Modificar AppShell (breakpoints, header, dropdown avatar, bottom drawer)

**Files:**
- Modify: `src/components/app/app-shell.tsx`

Este é o arquivo mais extenso do pacote. Substitua o conteúdo completo por:

- [ ] **Reescrever app-shell.tsx**

```tsx
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
```

- [ ] **Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Esperado: zero erros. Se aparecerem erros de tipo em `dropdown-menu`, verificar se o componente foi instalado corretamente na Task 1.

- [ ] **Commit**

```bash
git add src/components/app/app-shell.tsx
git commit -m "feat(ux): bottom nav mobile + dropdown avatar + breakpoints md/xl no AppShell"
```

---

## Task 5: Entrega 2 — Componentes de Settings (SettingsGroup, SettingsCard, SettingsCardSheet)

**Files:**
- Create: `src/components/domain/settings/settings-group.tsx`
- Create: `src/components/domain/settings/settings-card.tsx`
- Create: `src/components/domain/settings/settings-card-sheet.tsx`

- [ ] **Criar settings-group.tsx**

```tsx
'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

type GroupBadge = 'essencial'

interface SettingsGroupProps {
  title: string
  badge?: GroupBadge
  defaultExpanded?: boolean
  children: ReactNode
}

export function SettingsGroup({ title, badge, defaultExpanded = false, children }: SettingsGroupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div className="space-y-3">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 text-left"
        aria-expanded={expanded}
      >
        <span className="text-base font-semibold text-foreground">{title}</span>
        {badge === 'essencial' && (
          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
            Essencial
          </span>
        )}
        <ChevronDown
          className={cn(
            'ml-auto size-4 shrink-0 text-muted-foreground transition-transform duration-200',
            expanded && 'rotate-180',
          )}
        />
      </button>
      {expanded && <div className="space-y-3">{children}</div>}
    </div>
  )
}
```

- [ ] **Criar settings-card.tsx**

```tsx
'use client'

import type { ElementType, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface StatusBadge {
  label: string
  variant: 'ok' | 'warn' | 'info' | 'neutral'
}

interface SettingsCardProps {
  icon: ElementType
  title: string
  subtitle: string
  statusBadge?: StatusBadge
  onEdit?: () => void
  isStatic?: boolean
  children?: ReactNode
}

const BADGE_STYLES: Record<StatusBadge['variant'], string> = {
  ok:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  warn:    'bg-amber-50 text-amber-700 border-amber-200',
  info:    'bg-blue-50 text-blue-700 border-blue-200',
  neutral: 'bg-slate-100 text-slate-600 border-slate-200',
}

export function SettingsCard({
  icon: Icon,
  title,
  subtitle,
  statusBadge,
  onEdit,
  isStatic = false,
  children,
}: SettingsCardProps) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/85 shadow-sm">
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/50 text-foreground">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{title}</span>
            {statusBadge && (
              <span className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium',
                BADGE_STYLES[statusBadge.variant],
              )}>
                {statusBadge.label}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          {children}
        </div>
        {!isStatic && onEdit && (
          <Button size="sm" variant="outline" onClick={onEdit} className="shrink-0">
            Editar
          </Button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Criar settings-card-sheet.tsx**

```tsx
'use client'

import { type ReactNode } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

interface SettingsCardSheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function SettingsCardSheet({ open, onClose, title, children }: SettingsCardSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-6 pb-6">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Esperado: zero erros.

- [ ] **Commit**

```bash
git add src/components/domain/settings/settings-group.tsx
git add src/components/domain/settings/settings-card.tsx
git add src/components/domain/settings/settings-card-sheet.tsx
git commit -m "feat(ux): componentes SettingsGroup, SettingsCard e SettingsCardSheet"
```

---

## Task 6: Entrega 2 — Reescrever página de Configurações

**Files:**
- Modify: `src/app/(app)/configuracoes/page.tsx` (rewrite completo)

- [ ] **Reescrever configuracoes/page.tsx**

Substituir o conteúdo completo do arquivo por:

```tsx
'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Building2, Clock, Palette, Link as LinkIcon,
  Settings2, MessageCircle, Zap, CreditCard,
  Sparkles, ClipboardList, Loader2, ExternalLink,
} from 'lucide-react'
import { SettingsGroup } from '@/components/domain/settings/settings-group'
import { SettingsCard } from '@/components/domain/settings/settings-card'
import { SettingsCardSheet } from '@/components/domain/settings/settings-card-sheet'
import { BusinessInfoForm } from '@/components/domain/settings/business-info-form'
import { BusinessHoursForm } from '@/components/domain/settings/business-hours-form'
import { BrandingForm } from '@/components/domain/settings/branding-form'
import { LinkSharingHub } from '@/components/domain/settings/link-sharing-hub'
import { SchedulingPolicyForm } from '@/components/domain/settings/scheduling-policy-form'
import { WhatsAppSettingsForm } from '@/components/domain/settings/whatsapp-settings-form'
import { NotificationHistory } from '@/components/domain/settings/notification-history'
import { WhatsAppAutomationsForm } from '@/components/domain/settings/whatsapp-automations-form'
import { CardFeesForm } from '@/components/domain/settings/card-fees-form'
import { BillingPlansContent } from '@/components/domain/billing/billing-plans-content'
import { SettingsAnamneseTab } from '@/components/domain/crm/settings-anamnese-tab'
import { usePermissions } from '@/hooks/use-permissions'
import { useEvolutionStatus } from '@/hooks/settings/use-evolution-status'
import { Button } from '@/components/ui/button'

type OpenSheet =
  | 'negocio' | 'horarios' | 'branding' | 'link'
  | 'agendamento' | 'whatsapp' | 'automacoes'
  | 'taxas' | 'plano' | 'anamnese'
  | null

type BrandingConfig = {
  logoUrl: string | null
  primaryColor: string
  accentColor: string
  backgroundColor: string
  borderColor: string
  foregroundColor: string
  mutedColor: string
  fontFamily: string
  borderRadius: string
  colorScheme: string
}

type BusinessInfo = {
  name?: string
  phone?: string
}

export default function ConfiguracoesPage() {
  const { can, user, isLoading } = usePermissions()
  const router = useRouter()
  const { data: evolutionStatus } = useEvolutionStatus()

  const [openSheet, setOpenSheet] = useState<OpenSheet>(null)
  const [brandingConfig, setBrandingConfig] = useState<BrandingConfig | null>(null)
  const [brandingLoading, setBrandingLoading] = useState(false)
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo | null>(null)

  useEffect(() => {
    if (!isLoading && !can('configuracoes', 'view')) {
      router.replace('/agenda')
    }
  }, [isLoading, can, router])

  // Carrega dados para status badges ao montar
  useEffect(() => {
    fetch('/api/iam/business-info')
      .then((r) => r.json())
      .then((data) => setBusinessInfo(data as BusinessInfo))
      .catch(() => {})
  }, [])

  function openBrandingSheet() {
    if (!brandingConfig && !brandingLoading) {
      setBrandingLoading(true)
      fetch('/api/iam/branding')
        .then((r) => r.json())
        .then((data) => setBrandingConfig(data as BrandingConfig))
        .finally(() => setBrandingLoading(false))
    }
    setOpenSheet('branding')
  }

  function closeSheet() {
    setOpenSheet(null)
  }

  const businessInfoComplete =
    businessInfo !== null &&
    Boolean(businessInfo.name?.trim()) &&
    Boolean(businessInfo.phone?.trim())

  const whatsappConnected = evolutionStatus?.connected === true

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-rose-200 border-t-rose-600" />
      </div>
    )
  }

  if (!can('configuracoes', 'view')) return null

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Configurações
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie os dados do seu negócio e integrações
        </p>
      </div>

      {/* GRUPO 1 — Configure seu negócio */}
      <SettingsGroup title="Configure seu negócio" badge="essencial" defaultExpanded>
        <SettingsCard
          icon={Building2}
          title="Dados do negócio"
          subtitle="Nome, telefone e endereço do seu estabelecimento"
          statusBadge={
            businessInfo === null
              ? undefined
              : businessInfoComplete
              ? { label: '✓ Completo', variant: 'ok' }
              : { label: '⚠ Pendente', variant: 'warn' }
          }
          onEdit={() => setOpenSheet('negocio')}
        />

        <SettingsCard
          icon={Clock}
          title="Horários de funcionamento"
          subtitle="Dias e horários em que seu negócio está aberto para atendimentos"
          onEdit={() => setOpenSheet('horarios')}
        />

        <SettingsCard
          icon={Palette}
          title="Identidade visual"
          subtitle="Logo e cores do seu negócio — aparecem no agendamento online"
          statusBadge={
            brandingConfig !== null
              ? brandingConfig.logoUrl
                ? { label: '✓ Logo enviada', variant: 'ok' }
                : { label: 'Sem logo', variant: 'neutral' }
              : undefined
          }
          onEdit={openBrandingSheet}
        />
      </SettingsGroup>

      {/* GRUPO 2 — Divulgue e automatize */}
      <SettingsGroup title="Divulgue e automatize">
        <SettingsCard
          icon={LinkIcon}
          title="Meu link de agendamento"
          subtitle="Compartilhe com clientes para que agendem sozinhos, sem precisar do WhatsApp"
          onEdit={() => setOpenSheet('link')}
        >
          <p className="mt-1 text-[11px] text-blue-600">
            💡 Dica: cole esse link na bio do Instagram
          </p>
        </SettingsCard>

        <SettingsCard
          icon={Settings2}
          title="Regras de agendamento online"
          subtitle="Antecedência mínima, janela de dias disponíveis e intervalo entre horários"
          onEdit={() => setOpenSheet('agendamento')}
        />

        <SettingsCard
          icon={MessageCircle}
          title="WhatsApp e notificações"
          subtitle="Conecte seu WhatsApp para enviar confirmações e lembretes automáticos"
          statusBadge={
            evolutionStatus !== undefined
              ? whatsappConnected
                ? { label: 'Conectado', variant: 'ok' }
                : { label: 'Inativo', variant: 'neutral' }
              : undefined
          }
          onEdit={() => setOpenSheet('whatsapp')}
        />

        <SettingsCard
          icon={Zap}
          title="Automações de mensagens"
          subtitle="Lembrete de agendamento, resposta automática, parabéns e resumo do dia"
          onEdit={() => setOpenSheet('automacoes')}
        />
      </SettingsGroup>

      {/* GRUPO 3 — Financeiro e acesso */}
      <SettingsGroup title="Financeiro e acesso">
        <SettingsCard
          icon={CreditCard}
          title="Taxas de pagamento"
          subtitle="Percentual das maquininhas de débito e crédito — usado para calcular o lucro real"
          onEdit={() => setOpenSheet('taxas')}
        />

        {user?.isOwner && (
          <SettingsCard
            icon={Sparkles}
            title="Plano e assinatura"
            subtitle="Seu plano atual, limites de uso e opções de upgrade"
            onEdit={() => setOpenSheet('plano')}
          />
        )}

        <SettingsCard
          icon={ClipboardList}
          title="Ficha de anamnese"
          subtitle="A anamnese é configurada por serviço — acesse um serviço para definir as perguntas"
          isStatic
        >
          <div className="mt-3">
            <Button asChild variant="outline" size="sm">
              <Link href="/servicos" className="flex items-center gap-1.5">
                <ExternalLink className="size-3.5" />
                Ir para Serviços
              </Link>
            </Button>
          </div>
        </SettingsCard>
      </SettingsGroup>

      {/* ── Sheets ── */}

      <SettingsCardSheet open={openSheet === 'negocio'} onClose={closeSheet} title="Dados do negócio">
        <BusinessInfoForm />
      </SettingsCardSheet>

      <SettingsCardSheet open={openSheet === 'horarios'} onClose={closeSheet} title="Horários de funcionamento">
        <p className="text-sm text-muted-foreground">
          Configure os dias e horários em que seu negócio está aberto. Esses horários definem os slots disponíveis para agendamento.
        </p>
        <BusinessHoursForm />
      </SettingsCardSheet>

      <SettingsCardSheet open={openSheet === 'branding'} onClose={closeSheet} title="Identidade visual">
        {brandingLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {brandingConfig && !brandingLoading && (
          <BrandingForm initial={brandingConfig} />
        )}
      </SettingsCardSheet>

      <SettingsCardSheet open={openSheet === 'link'} onClose={closeSheet} title="Meu link de agendamento">
        {user?.tenantSlug ? (
          <LinkSharingHub
            slug={user.tenantSlug}
            baseUrl={process.env.NEXT_PUBLIC_APP_URL ?? 'https://agend.me'}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Seu negócio ainda não possui um link público configurado. Entre em contato com o suporte.
          </p>
        )}
      </SettingsCardSheet>

      <SettingsCardSheet open={openSheet === 'agendamento'} onClose={closeSheet} title="Regras de agendamento online">
        <SchedulingPolicyForm />
      </SettingsCardSheet>

      <SettingsCardSheet open={openSheet === 'whatsapp'} onClose={closeSheet} title="WhatsApp e notificações">
        <WhatsAppSettingsForm />
        <NotificationHistory />
      </SettingsCardSheet>

      <SettingsCardSheet open={openSheet === 'automacoes'} onClose={closeSheet} title="Automações de mensagens">
        {!whatsappConnected && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Conecte o WhatsApp primeiro para ativar as automações.
          </div>
        )}
        <WhatsAppAutomationsForm />
      </SettingsCardSheet>

      <SettingsCardSheet open={openSheet === 'taxas'} onClose={closeSheet} title="Taxas de pagamento">
        <CardFeesForm />
      </SettingsCardSheet>

      {user?.isOwner && (
        <SettingsCardSheet open={openSheet === 'plano'} onClose={closeSheet} title="Plano e assinatura">
          <BillingPlansContent />
        </SettingsCardSheet>
      )}
    </div>
  )
}
```

- [ ] **Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Esperado: zero erros. Prestar atenção em possíveis erros de tipo em `businessInfo` e `evolutionStatus`.

- [ ] **Commit**

```bash
git add src/app/(app)/configuracoes/page.tsx
git commit -m "feat(ux): configurações reorganizadas em cards híbridos com sheets"
```

---

## Task 7: Verificação final e PR

**Files:** nenhum novo

- [ ] **Rodar TypeScript completo**

```bash
npx tsc --noEmit
```

Esperado: zero erros em todo o projeto.

- [ ] **Verificar ausência de autoFocus no projeto**

```bash
grep -rn "autoFocus" src/components/ src/app/
```

Esperado: nenhuma linha no output.

- [ ] **Verificar que sidebar aparece a partir de md**

Abrir `src/components/app/app-shell.tsx` e confirmar que o `aside` tem `hidden md:flex` (não `hidden xl:flex`).

```bash
grep "hidden md:flex\|hidden xl:flex" src/components/app/app-shell.tsx
```

Esperado: apenas `hidden md:flex`.

- [ ] **Verificar que BottomNav só aparece em mobile**

```bash
grep "md:hidden" src/components/app/bottom-nav.tsx
```

Esperado: a classe `md:hidden` aparece na nav element.

- [ ] **Push e PR**

```bash
git push -u origin feat/ux-mobile-configuracoes
```

Depois abrir PR para `main` com:
- Título: `feat(ux): bottom nav mobile + configurações em cards + correção autoFocus`
- Descrição: referenciar as 4 entregas do pacote

---

## Self-Review

**Spec coverage:**
- ✅ Entrega 1 — BottomNav: Task 3 (componente) + Task 4 (AppShell)
- ✅ Entrega 1 — FAB Plus: abre `CreateAppointmentModal` via `onNewAppointment` prop
- ✅ Entrega 1 — Drawer "Menu": Sheet bottom com links + card de usuário (Task 4)
- ✅ Entrega 1 — safe-area padding: `calc(env(safe-area-inset-bottom) + 0.5rem)` no BottomNav
- ✅ Entrega 1 — Sidebar tablet sempre expandida: `window.innerWidth < 1280` impede colapso
- ✅ Entrega 1 — Toggle colapso só em xl+: `hidden xl:inline-flex` no botão
- ✅ Entrega 2 — Grupo 1 expandido por padrão: `defaultExpanded` prop em SettingsGroup
- ✅ Entrega 2 — Status badges: businessInfoComplete, logoUrl, whatsappConnected
- ✅ Entrega 2 — Anamnese estático: `isStatic` prop + link para /servicos
- ✅ Entrega 2 — Banner de WhatsApp em Automações: renderizado condicionalmente
- ✅ Entrega 2 — Lazy load BrandingForm: só faz fetch ao abrir o sheet de identidade visual
- ✅ Entrega 3 — Avatar desktop: DropdownMenu com "Minha equipe" → /equipe + "Sair"
- ✅ Entrega 3 — Avatar mobile: card no drawer com link "Ver equipe" → /equipe
- ✅ Entrega 4 — autoFocus: removido de 5 arquivos (Task 2), verificação em Task 7
- ✅ Nenhuma alteração em services, repositories ou schema

**Placeholders:** nenhum.

**Consistência de tipos:**
- `OpenSheet` union type cobre todos os 10 sheets da página de configurações.
- `StatusBadge.variant` definido em `settings-card.tsx` e usado consistentemente.
- Props de `BottomNav` (`onNewAppointment`, `onOpenMenu`) batem com o uso em `AppShell`.
