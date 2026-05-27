# Shell de Navegação + Agenda — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o shell estático em navegação real com Next.js Links e controle de permissões, e implementar a agenda como tela central do sistema com fluxo completo de criação e gestão de agendamentos.

**Architecture:** Hooks TanStack Query para dados do usuário e agendamentos; `usePermissions()` para ocultar itens de nav sem permissão; `AppShell` convertido para componente client com `usePathname()`; agenda como lista de horários do dia com modal de criação em 3 cliques.

**Tech Stack:** Next.js 15 App Router, TypeScript, TanStack Query v5, Zustand, Shadcn UI (sonner para toasts), Tailwind CSS, Supabase SSR auth.

> **Nota sobre testes:** O projeto não tem framework de testes configurado. Cada tarefa verifica com `npm run build` + `npm run lint`. Recomenda-se adicionar Vitest + Testing Library em tarefa futura dedicada.

---

## Mapa de arquivos

### Criar
| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/lib/providers.tsx` | QueryClientProvider + ReactQueryDevtools (client component raiz) |
| `src/hooks/use-current-user.ts` | Query `/api/iam/me` — dados do usuário logado |
| `src/hooks/use-permissions.ts` | `can(permission)` baseado no papel + permissões do usuário |
| `src/hooks/scheduling/use-appointments.ts` | Query + mutations de agendamentos |
| `src/hooks/scheduling/use-services.ts` | Query de serviços disponíveis |
| `src/hooks/crm/use-customers-search.ts` | Busca de clientes para o modal de agendamento |
| `src/app/(app)/agenda/page.tsx` | Página da agenda (server component wrapper) |
| `src/app/(app)/dashboard/page.tsx` | Dashboard do dono (server component wrapper) |
| `src/components/domain/scheduling/agenda-day-view.tsx` | Lista de agendamentos do dia com seletor de data |
| `src/components/domain/scheduling/appointment-card.tsx` | Card de agendamento com cor por status |
| `src/components/domain/scheduling/create-appointment-modal.tsx` | Modal de criação em 3 cliques |
| `src/components/domain/scheduling/appointment-drawer.tsx` | Drawer de detalhes + ações de status |
| `src/components/domain/dashboard/day-summary-cards.tsx` | Cards de resumo do dia para OWNER |

### Modificar
| Arquivo | O que muda |
|---------|-----------|
| `src/app/layout.tsx` | Adicionar `<Providers>` wrappando `{children}` |
| `src/components/app/app-shell.tsx` | Converter para client component: Next.js Links, `usePathname()` para active state, `usePermissions()` para visibilidade |
| `src/app/(app)/page.tsx` | Redirecionar para `/agenda` ou `/dashboard` com base no papel |

---

## Tarefa 1: QueryClientProvider

**Arquivos:**
- Criar: `src/lib/providers.tsx`
- Modificar: `src/app/layout.tsx`

- [ ] **Passo 1: Criar providers.tsx**

```tsx
// src/lib/providers.tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState, type ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```

- [ ] **Passo 2: Adicionar Providers no root layout**

Modificar `src/app/layout.tsx` — envolver `{children}` com `<Providers>`:

```tsx
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import { Providers } from '@/lib/providers'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Estetica SaaS',
  description: 'Plataforma operacional inteligente para negocios de estetica e servicos.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Providers>
          {children}
          <Toaster position="top-right" richColors />
        </Providers>
      </body>
    </html>
  )
}
```

- [ ] **Passo 3: Verificar build**

```bash
npm run build
```

Esperado: build sem erros. Se `ReactQueryDevtools` causar erro de bundle, mover para dynamic import com `ssr: false`.

- [ ] **Passo 4: Commit**

```bash
git add src/lib/providers.tsx src/app/layout.tsx
git commit -m "feat(shell): adiciona QueryClientProvider no root layout"
```

---

## Tarefa 2: Hook useCurrentUser

**Arquivos:**
- Criar: `src/hooks/use-current-user.ts`

- [ ] **Passo 1: Criar o hook**

```ts
// src/hooks/use-current-user.ts
import { useQuery } from '@tanstack/react-query'
import type { UserRole } from '@prisma/client'

export type CurrentUser = {
  id: string
  tenantId: string
  email: string
  name: string
  role: UserRole
  permissions: string[]
}

async function fetchCurrentUser(): Promise<CurrentUser> {
  const res = await fetch('/api/iam/me')
  if (res.status === 401) throw new Error('NAO_AUTENTICADO')
  if (!res.ok) throw new Error('Falha ao buscar usuario')
  return res.json()
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ['current-user'],
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}
```

- [ ] **Passo 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: sem erros de tipo.

- [ ] **Passo 3: Commit**

```bash
git add src/hooks/use-current-user.ts
git commit -m "feat(iam): hook useCurrentUser para dados do usuario logado"
```

---

## Tarefa 3: Hook usePermissions

**Arquivos:**
- Criar: `src/hooks/use-permissions.ts`

- [ ] **Passo 1: Criar o hook**

```ts
// src/hooks/use-permissions.ts
import { useCurrentUser } from './use-current-user'

const ROLE_PERMISSIONS: Record<string, string[]> = {
  OWNER: [
    'appointments:view', 'appointments:create', 'appointments:edit', 'appointments:delete',
    'customers:view', 'customers:create', 'customers:edit',
    'financial:view', 'financial:manage',
    'users:view', 'users:invite', 'users:manage',
    'services:view', 'services:manage',
  ],
  MANAGER: [
    'appointments:view', 'appointments:create', 'appointments:edit',
    'customers:view', 'customers:create', 'customers:edit',
    'financial:view',
    'users:view',
    'services:view', 'services:manage',
  ],
  PROFESSIONAL: [
    'appointments:view', 'appointments:create',
    'customers:view',
    'services:view',
  ],
  RECEPTIONIST: [
    'appointments:view', 'appointments:create', 'appointments:edit',
    'customers:view', 'customers:create', 'customers:edit',
    'services:view',
  ],
}

export function usePermissions() {
  const { data: user } = useCurrentUser()

  function can(permission: string): boolean {
    if (!user) return false
    const rolePerms = ROLE_PERMISSIONS[user.role] ?? []
    const allPerms = new Set([...rolePerms, ...user.permissions])
    return allPerms.has(permission)
  }

  return { can, user, isLoading: !user }
}
```

- [ ] **Passo 2: Verificar tipos**

```bash
npx tsc --noEmit
```

- [ ] **Passo 3: Commit**

```bash
git add src/hooks/use-permissions.ts
git commit -m "feat(iam): hook usePermissions com verificacao de permissao por papel"
```

---

## Tarefa 4: Refatorar AppShell

**Arquivos:**
- Modificar: `src/components/app/app-shell.tsx`

- [ ] **Passo 1: Instalar componentes Shadcn necessários**

```bash
npx shadcn@latest add skeleton tooltip
```

- [ ] **Passo 2: Substituir app-shell.tsx completo**

```tsx
// src/components/app/app-shell.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import {
  CalendarDays,
  CreditCard,
  Settings,
  Sparkles,
  Users,
  UserCog,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentUser } from '@/hooks/use-current-user'
import { usePermissions } from '@/hooks/use-permissions'
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
  const { data: user, isLoading } = useCurrentUser()
  const { can } = usePermissions()

  const visibleItems = NAV_ITEMS.filter(
    (item) => item.permission === null || can(item.permission),
  )

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

          {/* Config no rodapé */}
          <div className="mt-auto pt-8">
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
```

- [ ] **Passo 3: Verificar build e lint**

```bash
npm run lint && npm run build
```

Esperado: sem erros. Se houver erro de `usePathname` fora de Suspense no Next.js 15, envolver o componente em `<Suspense>` no layout.

- [ ] **Passo 4: Commit**

```bash
git add src/components/app/app-shell.tsx
git commit -m "feat(shell): converte AppShell para navegacao real com Link, active state e permissoes"
```

---

## Tarefa 5: Redirect por papel em (app)/page.tsx

**Arquivos:**
- Modificar: `src/app/(app)/page.tsx`

- [ ] **Passo 1: Substituir page.tsx por redirect client-side**

```tsx
// src/app/(app)/page.tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrentUser } from '@/hooks/use-current-user'

export default function AppHome() {
  const router = useRouter()
  const { data: user, isLoading } = useCurrentUser()

  useEffect(() => {
    if (!user) return
    if (user.role === 'OWNER' || user.role === 'MANAGER') {
      router.replace('/dashboard')
    } else {
      router.replace('/agenda')
    }
  }, [user, router])

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-rose-200 border-t-rose-600" />
      </div>
    )
  }

  return null
}
```

- [ ] **Passo 2: Verificar tipos**

```bash
npx tsc --noEmit
```

- [ ] **Passo 3: Commit**

```bash
git add src/app/(app)/page.tsx
git commit -m "feat(shell): redirect por papel apos login (OWNER->dashboard, outros->agenda)"
```

---

## Tarefa 6: Hooks de agendamentos e serviços

**Arquivos:**
- Criar: `src/hooks/scheduling/use-appointments.ts`
- Criar: `src/hooks/scheduling/use-services.ts`
- Criar: `src/hooks/crm/use-customers-search.ts`

- [ ] **Passo 1: Criar use-appointments.ts**

```ts
// src/hooks/scheduling/use-appointments.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export type AppointmentStatus =
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'

export type Appointment = {
  id: string
  customerId: string
  professionalId: string
  serviceId: string
  startsAt: string
  endsAt: string
  status: AppointmentStatus
  notes: string | null
  price: string
  customer: { id: string; name: string; phone: string | null }
  professional: { id: string; name: string }
  service: { id: string; name: string; duration: number }
}

export type CreateAppointmentInput = {
  customerId: string
  professionalId: string
  serviceId: string
  startsAt: string
  notes?: string
}

type ListParams = {
  from?: string
  to?: string
  professionalId?: string
}

async function listAppointments(params: ListParams): Promise<Appointment[]> {
  const url = new URL('/api/scheduling/appointments', window.location.origin)
  if (params.from) url.searchParams.set('from', params.from)
  if (params.to) url.searchParams.set('to', params.to)
  if (params.professionalId)
    url.searchParams.set('professionalId', params.professionalId)
  const res = await fetch(url)
  if (!res.ok) throw new Error('Falha ao carregar agendamentos')
  return res.json()
}

async function createAppointment(input: CreateAppointmentInput): Promise<Appointment> {
  const res = await fetch('/api/scheduling/appointments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message ?? 'Falha ao criar agendamento')
  }
  return res.json()
}

async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus,
): Promise<Appointment> {
  const res = await fetch(`/api/scheduling/appointments/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message ?? 'Falha ao atualizar status')
  }
  return res.json()
}

export function useAppointments(params: ListParams) {
  return useQuery({
    queryKey: ['appointments', params],
    queryFn: () => listAppointments(params),
    staleTime: 30 * 1000,
  })
}

export function useCreateAppointment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createAppointment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
    },
  })
}

export function useUpdateAppointmentStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) =>
      updateAppointmentStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
    },
  })
}
```

- [ ] **Passo 2: Criar use-services.ts**

```ts
// src/hooks/scheduling/use-services.ts
import { useQuery } from '@tanstack/react-query'

export type Service = {
  id: string
  name: string
  duration: number
  price: string
  active: boolean
}

async function listServices(): Promise<Service[]> {
  const res = await fetch('/api/scheduling/services')
  if (!res.ok) throw new Error('Falha ao carregar servicos')
  return res.json()
}

export function useServices() {
  return useQuery({
    queryKey: ['services'],
    queryFn: listServices,
    staleTime: 5 * 60 * 1000,
  })
}
```

- [ ] **Passo 3: Criar use-customers-search.ts**

```ts
// src/hooks/crm/use-customers-search.ts
import { useQuery } from '@tanstack/react-query'

export type CustomerSummary = {
  id: string
  name: string
  phone: string | null
}

async function searchCustomers(q: string): Promise<CustomerSummary[]> {
  if (q.trim().length < 2) return []
  const url = new URL('/api/crm/customers', window.location.origin)
  url.searchParams.set('search', q)
  url.searchParams.set('limit', '10')
  const res = await fetch(url)
  if (!res.ok) throw new Error('Falha ao buscar clientes')
  return res.json()
}

export function useCustomersSearch(query: string) {
  return useQuery({
    queryKey: ['customers-search', query],
    queryFn: () => searchCustomers(query),
    enabled: query.trim().length >= 2,
    staleTime: 30 * 1000,
  })
}
```

- [ ] **Passo 4: Verificar tipos**

```bash
npx tsc --noEmit
```

- [ ] **Passo 5: Commit**

```bash
git add src/hooks/scheduling/ src/hooks/crm/
git commit -m "feat(scheduling): hooks useAppointments, useServices e useCustomersSearch"
```

---

## Tarefa 7: AppointmentCard

**Arquivos:**
- Criar: `src/components/domain/scheduling/appointment-card.tsx`

- [ ] **Passo 1: Instalar Badge do Shadcn se não existir**

```bash
npx shadcn@latest add badge
```

- [ ] **Passo 2: Criar appointment-card.tsx**

```tsx
// src/components/domain/scheduling/appointment-card.tsx
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { Appointment, AppointmentStatus } from '@/hooks/scheduling/use-appointments'

const STATUS_CONFIG: Record<
  AppointmentStatus,
  { label: string; cardClass: string; badgeClass: string }
> = {
  SCHEDULED: {
    label: 'Agendado',
    cardClass: 'border-slate-200 bg-white',
    badgeClass: 'bg-slate-100 text-slate-700',
  },
  CONFIRMED: {
    label: 'Confirmado',
    cardClass: 'border-blue-200 bg-blue-50',
    badgeClass: 'bg-blue-100 text-blue-700',
  },
  COMPLETED: {
    label: 'Concluído',
    cardClass: 'border-emerald-200 bg-emerald-50',
    badgeClass: 'bg-emerald-100 text-emerald-700',
  },
  CANCELLED: {
    label: 'Cancelado',
    cardClass: 'border-red-200 bg-red-50 opacity-60',
    badgeClass: 'bg-red-100 text-red-700',
  },
  NO_SHOW: {
    label: 'Não compareceu',
    cardClass: 'border-orange-200 bg-orange-50 opacity-60',
    badgeClass: 'bg-orange-100 text-orange-700',
  },
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

type Props = {
  appointment: Appointment
  onClick: (appointment: Appointment) => void
}

export function AppointmentCard({ appointment, onClick }: Props) {
  const config = STATUS_CONFIG[appointment.status]

  return (
    <button
      onClick={() => onClick(appointment)}
      className={cn(
        'w-full rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md',
        config.cardClass,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-950">
            {appointment.customer.name}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {appointment.service.name} · {appointment.professional.name}
          </p>
        </div>
        <Badge className={cn('shrink-0 text-xs', config.badgeClass)}>
          {config.label}
        </Badge>
      </div>
      <p className="mt-3 text-xs font-medium text-slate-600">
        {formatTime(appointment.startsAt)} – {formatTime(appointment.endsAt)}
      </p>
    </button>
  )
}
```

- [ ] **Passo 3: Verificar tipos**

```bash
npx tsc --noEmit
```

- [ ] **Passo 4: Commit**

```bash
git add src/components/domain/scheduling/appointment-card.tsx
git commit -m "feat(scheduling): componente AppointmentCard com status colorido"
```

---

## Tarefa 8: CreateAppointmentModal

**Arquivos:**
- Criar: `src/components/domain/scheduling/create-appointment-modal.tsx`

- [ ] **Passo 1: Instalar componentes Shadcn necessários**

```bash
npx shadcn@latest add dialog command select label
```

- [ ] **Passo 2: Criar create-appointment-modal.tsx**

```tsx
// src/components/domain/scheduling/create-appointment-modal.tsx
'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useServices } from '@/hooks/scheduling/use-services'
import { useCustomersSearch } from '@/hooks/crm/use-customers-search'
import { useCreateAppointment } from '@/hooks/scheduling/use-appointments'
import { useCurrentUser } from '@/hooks/use-current-user'

type Props = {
  open: boolean
  onClose: () => void
  defaultStartsAt?: string
}

export function CreateAppointmentModal({ open, onClose, defaultStartsAt }: Props) {
  const { data: currentUser } = useCurrentUser()
  const { data: services = [] } = useServices()
  const createAppointment = useCreateAppointment()

  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [selectedServiceId, setSelectedServiceId] = useState('')
  const [startsAt, setStartsAt] = useState(defaultStartsAt ?? '')

  const { data: customers = [], isLoading: searchingCustomers } =
    useCustomersSearch(customerSearch)

  useEffect(() => {
    if (defaultStartsAt) setStartsAt(defaultStartsAt)
  }, [defaultStartsAt])

  function handleClose() {
    setCustomerSearch('')
    setSelectedCustomerId('')
    setSelectedServiceId('')
    setStartsAt('')
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedCustomerId || !selectedServiceId || !startsAt || !currentUser) return

    const service = services.find((s) => s.id === selectedServiceId)
    if (!service) return

    createAppointment.mutate(
      {
        customerId: selectedCustomerId,
        professionalId: currentUser.id,
        serviceId: selectedServiceId,
        startsAt: new Date(startsAt).toISOString(),
      },
      {
        onSuccess: () => {
          toast.success('Agendamento criado com sucesso')
          handleClose()
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Erro ao criar agendamento')
        },
      },
    )
  }

  const activeServices = services.filter((s) => s.active)
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Passo 1: Cliente */}
          <div className="space-y-2">
            <Label>Cliente</Label>
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={selectedCustomer ? selectedCustomer.name : customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value)
                setSelectedCustomerId('')
              }}
            />
            {customerSearch.length >= 2 && !selectedCustomerId && (
              <div className="rounded-xl border bg-white shadow-sm">
                {searchingCustomers ? (
                  <p className="p-3 text-sm text-slate-500">Buscando...</p>
                ) : customers.length === 0 ? (
                  <p className="p-3 text-sm text-slate-500">Nenhum cliente encontrado</p>
                ) : (
                  customers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedCustomerId(c.id)
                        setCustomerSearch(c.name)
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-rose-50"
                    >
                      <span className="font-medium">{c.name}</span>
                      {c.phone && (
                        <span className="ml-2 text-slate-400">{c.phone}</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Passo 2: Serviço */}
          <div className="space-y-2">
            <Label>Serviço</Label>
            <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar serviço" />
              </SelectTrigger>
              <SelectContent>
                {activeServices.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} · {s.duration}min · R${Number(s.price).toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Passo 3: Horário */}
          <div className="space-y-2">
            <Label>Data e horário</Label>
            <Input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                !selectedCustomerId ||
                !selectedServiceId ||
                !startsAt ||
                createAppointment.isPending
              }
              className="bg-slate-950 text-white hover:bg-slate-800"
            >
              {createAppointment.isPending ? 'Criando...' : 'Criar agendamento'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Passo 3: Verificar tipos**

```bash
npx tsc --noEmit
```

- [ ] **Passo 4: Commit**

```bash
git add src/components/domain/scheduling/create-appointment-modal.tsx
git commit -m "feat(scheduling): modal de criacao de agendamento em 3 passos"
```

---

## Tarefa 9: AppointmentDrawer

**Arquivos:**
- Criar: `src/components/domain/scheduling/appointment-drawer.tsx`

- [ ] **Passo 1: Instalar Sheet do Shadcn**

```bash
npx shadcn@latest add sheet separator
```

- [ ] **Passo 2: Criar appointment-drawer.tsx**

```tsx
// src/components/domain/scheduling/appointment-drawer.tsx
'use client'

import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { useUpdateAppointmentStatus } from '@/hooks/scheduling/use-appointments'
import type { Appointment } from '@/hooks/scheduling/use-appointments'
import { cn } from '@/lib/utils'

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Agendado',
  CONFIRMED: 'Confirmado',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Não compareceu',
}

const STATUS_BADGE: Record<string, string> = {
  SCHEDULED: 'bg-slate-100 text-slate-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-red-100 text-red-700',
  NO_SHOW: 'bg-orange-100 text-orange-700',
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type Props = {
  appointment: Appointment | null
  open: boolean
  onClose: () => void
  onCompleted?: (appointment: Appointment) => void
}

export function AppointmentDrawer({ appointment, open, onClose, onCompleted }: Props) {
  const updateStatus = useUpdateAppointmentStatus()

  function handleStatus(status: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW') {
    if (!appointment) return
    updateStatus.mutate(
      { id: appointment.id, status },
      {
        onSuccess: (updated) => {
          const labels: Record<string, string> = {
            CONFIRMED: 'Agendamento confirmado',
            COMPLETED: 'Atendimento concluído',
            CANCELLED: 'Agendamento cancelado',
            NO_SHOW: 'No-show registrado',
          }
          toast.success(labels[status])
          if (status === 'COMPLETED') onCompleted?.(updated)
          onClose()
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Erro ao atualizar status')
        },
      },
    )
  }

  if (!appointment) return null

  const isActive = !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(appointment.status)

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Detalhes do agendamento</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status */}
          <div className="flex items-center gap-3">
            <Badge className={cn('text-sm', STATUS_BADGE[appointment.status])}>
              {STATUS_LABELS[appointment.status]}
            </Badge>
          </div>

          {/* Informações */}
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase">Cliente</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-950">
                {appointment.customer.name}
              </p>
              {appointment.customer.phone && (
                <p className="text-xs text-slate-500">{appointment.customer.phone}</p>
              )}
            </div>
            <Separator />
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase">Serviço</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-950">
                {appointment.service.name}
              </p>
              <p className="text-xs text-slate-500">
                {appointment.service.duration} min · R${Number(appointment.price).toFixed(2)}
              </p>
            </div>
            <Separator />
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase">Profissional</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-950">
                {appointment.professional.name}
              </p>
            </div>
            <Separator />
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase">Horário</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-950">
                {formatDateTime(appointment.startsAt)}
              </p>
            </div>
            {appointment.notes && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase">Observações</p>
                  <p className="mt-0.5 text-sm text-slate-700">{appointment.notes}</p>
                </div>
              </>
            )}
          </div>

          {/* Ações */}
          {isActive && (
            <div className="space-y-2">
              {appointment.status === 'SCHEDULED' && (
                <Button
                  className="w-full bg-blue-600 text-white hover:bg-blue-700"
                  onClick={() => handleStatus('CONFIRMED')}
                  disabled={updateStatus.isPending}
                >
                  Confirmar presença
                </Button>
              )}
              {['SCHEDULED', 'CONFIRMED'].includes(appointment.status) && (
                <Button
                  className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => handleStatus('COMPLETED')}
                  disabled={updateStatus.isPending}
                >
                  Concluir atendimento
                </Button>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 border-orange-200 text-orange-700 hover:bg-orange-50"
                  onClick={() => handleStatus('NO_SHOW')}
                  disabled={updateStatus.isPending}
                >
                  Não compareceu
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-red-200 text-red-700 hover:bg-red-50"
                  onClick={() => handleStatus('CANCELLED')}
                  disabled={updateStatus.isPending}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Passo 3: Verificar tipos**

```bash
npx tsc --noEmit
```

- [ ] **Passo 4: Commit**

```bash
git add src/components/domain/scheduling/appointment-drawer.tsx
git commit -m "feat(scheduling): drawer de detalhes com acoes confirmar, concluir e cancelar"
```

---

## Tarefa 10: AgendaDayView

**Arquivos:**
- Criar: `src/components/domain/scheduling/agenda-day-view.tsx`

- [ ] **Passo 1: Instalar Button do Shadcn se não existir**

```bash
npx shadcn@latest add button
```

- [ ] **Passo 2: Criar agenda-week-strip.tsx** (visão compacta da semana)

```tsx
// src/components/domain/scheduling/agenda-week-strip.tsx
'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppointments } from '@/hooks/scheduling/use-appointments'
import { cn } from '@/lib/utils'

function startOfWeek(d: Date) {
  const r = new Date(d)
  const day = r.getDay()
  r.setDate(r.getDate() - day + (day === 0 ? -6 : 1))
  r.setHours(0, 0, 0, 0)
  return r
}

type Props = {
  selectedDate: Date
  onSelectDate: (d: Date) => void
}

export function AgendaWeekStrip({ selectedDate, onSelectDate }: Props) {
  const monday = startOfWeek(selectedDate)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  const { data: appointments = [], isLoading } = useAppointments({
    from: monday.toISOString(),
    to: sunday.toISOString(),
  })

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })

  const countByDay = days.map((d) => {
    const key = d.toDateString()
    return appointments.filter(
      (a) => new Date(a.startsAt).toDateString() === key,
    ).length
  })

  function prevWeek() {
    const d = new Date(monday)
    d.setDate(d.getDate() - 7)
    onSelectDate(d)
  }

  function nextWeek() {
    const d = new Date(monday)
    d.setDate(d.getDate() + 7)
    onSelectDate(d)
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={prevWeek} className="rounded-full shrink-0">
        <ChevronLeft className="size-4" />
      </Button>

      <div className="grid flex-1 grid-cols-7 gap-1">
        {days.map((d, i) => {
          const isSelected = d.toDateString() === selectedDate.toDateString()
          const isToday = d.toDateString() === new Date().toDateString()
          return (
            <button
              key={i}
              onClick={() => onSelectDate(d)}
              className={cn(
                'flex flex-col items-center rounded-xl py-2 text-center transition',
                isSelected
                  ? 'bg-slate-950 text-white'
                  : isToday
                    ? 'bg-rose-50 text-rose-700'
                    : 'hover:bg-slate-100 text-slate-700',
              )}
            >
              <span className="text-[10px] font-medium uppercase">
                {d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
              </span>
              <span className="text-base font-semibold">{d.getDate()}</span>
              {isLoading ? (
                <Skeleton className="mt-1 h-1.5 w-4 rounded-full" />
              ) : countByDay[i] > 0 ? (
                <span
                  className={cn(
                    'mt-1 text-[10px] font-semibold',
                    isSelected ? 'text-rose-300' : 'text-rose-500',
                  )}
                >
                  {countByDay[i]}
                </span>
              ) : (
                <span className="mt-1 h-3" />
              )}
            </button>
          )
        })}
      </div>

      <Button variant="outline" size="icon" onClick={nextWeek} className="rounded-full shrink-0">
        <ChevronRight className="size-4" />
      </Button>
    </div>
  )
}
```

- [ ] **Passo 4: Criar agenda-day-view.tsx** (inclui toggle semana/dia + filtro PROFESSIONAL)

```tsx
// src/components/domain/scheduling/agenda-day-view.tsx
'use client'

import { useState } from 'react'
import { Plus, CalendarDays, LayoutList, CalendarRange } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AppointmentCard } from './appointment-card'
import { AppointmentDrawer } from './appointment-drawer'
import { CreateAppointmentModal } from './create-appointment-modal'
import { AgendaWeekStrip } from './agenda-week-strip'
import { useAppointments } from '@/hooks/scheduling/use-appointments'
import type { Appointment } from '@/hooks/scheduling/use-appointments'
import { usePermissions } from '@/hooks/use-permissions'
import { useCurrentUser } from '@/hooks/use-current-user'

function startOfDay(d: Date) {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

function endOfDay(d: Date) {
  const r = new Date(d)
  r.setHours(23, 59, 59, 999)
  return r
}

function formatDayLabel(d: Date) {
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  const label = d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
  return isToday ? `Hoje, ${label}` : label
}

function groupByHour(appointments: Appointment[]) {
  const groups: Record<string, Appointment[]> = {}
  for (const appt of appointments) {
    const hour = new Date(appt.startsAt).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })
    if (!groups[hour]) groups[hour] = []
    groups[hour].push(appt)
  }
  return groups
}

type ViewMode = 'day' | 'week'

export function AgendaDayView() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('day')
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const { can } = usePermissions()
  const { data: currentUser } = useCurrentUser()

  // PROFESSIONAL só vê seus próprios agendamentos
  const professionalId =
    currentUser?.role === 'PROFESSIONAL' ? currentUser.id : undefined

  const from = startOfDay(selectedDate).toISOString()
  const to = endOfDay(selectedDate).toISOString()

  const { data: appointments = [], isLoading, error } = useAppointments({
    from,
    to,
    professionalId,
  })

  const sorted = [...appointments].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  )
  const groups = groupByHour(sorted)
  const hours = Object.keys(groups).sort()

  function handleCardClick(appt: Appointment) {
    setSelectedAppointment(appt)
    setDrawerOpen(true)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header da agenda */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1">
          <Button
            variant={viewMode === 'day' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('day')}
            className="rounded-full"
          >
            <LayoutList className="size-4" />
            <span className="hidden sm:inline">Dia</span>
          </Button>
          <Button
            variant={viewMode === 'week' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('week')}
            className="rounded-full"
          >
            <CalendarRange className="size-4" />
            <span className="hidden sm:inline">Semana</span>
          </Button>
        </div>

        {can('appointments:create') && (
          <Button
            onClick={() => setCreateModalOpen(true)}
            className="rounded-full bg-slate-950 text-white hover:bg-slate-800"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">Novo agendamento</span>
          </Button>
        )}
      </div>

      {/* Strip semanal (sempre visível para navegação) */}
      <AgendaWeekStrip
        selectedDate={selectedDate}
        onSelectDate={(d) => {
          setSelectedDate(d)
          setViewMode('day')
        }}
      />

      {/* Label do dia selecionado (só no modo dia) */}
      {viewMode === 'day' && (
        <p className="text-sm font-semibold capitalize text-slate-600">
          {formatDayLabel(selectedDate)}
        </p>
      )}

      {/* Lista de agendamentos */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-600">Erro ao carregar agendamentos.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => window.location.reload()}
          >
            Tentar novamente
          </Button>
        </div>
      ) : hours.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 py-16 text-center">
          <CalendarDays className="size-10 text-slate-300" />
          <p className="mt-4 text-sm font-medium text-slate-500">
            Nenhum agendamento para este dia
          </p>
          {can('appointments:create') && (
            <Button
              onClick={() => setCreateModalOpen(true)}
              variant="outline"
              size="sm"
              className="mt-4 rounded-full"
            >
              <Plus className="size-4" />
              Criar primeiro agendamento
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {hours.map((hour) => (
            <div key={hour}>
              <p className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                {hour}
              </p>
              <div className="space-y-2">
                {groups[hour].map((appt) => (
                  <AppointmentCard
                    key={appt.id}
                    appointment={appt}
                    onClick={handleCardClick}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <AppointmentDrawer
        appointment={selectedAppointment}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setSelectedAppointment(null)
        }}
      />

      <CreateAppointmentModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
    </div>
  )
}
```

- [ ] **Passo 3: Verificar tipos**

```bash
npx tsc --noEmit
```

- [ ] **Passo 5: Commit**

```bash
git add src/components/domain/scheduling/agenda-week-strip.tsx src/components/domain/scheduling/agenda-day-view.tsx
git commit -m "feat(scheduling): AgendaWeekStrip + AgendaDayView com toggle dia/semana, filtro PROFESSIONAL e estados vazios"
```

---

## Tarefa 11: Página /agenda

**Arquivos:**
- Criar: `src/app/(app)/agenda/page.tsx`

- [ ] **Passo 1: Criar página**

```tsx
// src/app/(app)/agenda/page.tsx
import { AgendaDayView } from '@/components/domain/scheduling/agenda-day-view'

export const metadata = { title: 'Agenda · Estética SaaS' }

export default function AgendaPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          Agenda
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Gerencie seus atendimentos do dia
        </p>
      </div>
      <AgendaDayView />
    </div>
  )
}
```

- [ ] **Passo 2: Verificar build**

```bash
npm run build
```

Esperado: compilação sem erros. Se Next.js reclamar de Server Component importando Client Component com hooks, verificar se `AgendaDayView` tem `'use client'` no topo.

- [ ] **Passo 3: Commit**

```bash
git add src/app/(app)/agenda/page.tsx
git commit -m "feat(scheduling): pagina /agenda com AgendaDayView"
```

---

## Tarefa 12: DaySummaryCards + Dashboard

**Arquivos:**
- Criar: `src/components/domain/dashboard/day-summary-cards.tsx`
- Criar: `src/app/(app)/dashboard/page.tsx`

- [ ] **Passo 1: Criar day-summary-cards.tsx**

```tsx
// src/components/domain/dashboard/day-summary-cards.tsx
'use client'

import { CalendarCheck, DollarSign, TrendingUp, Users } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppointments } from '@/hooks/scheduling/use-appointments'

function startOfDay(d: Date) {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

function endOfDay(d: Date) {
  const r = new Date(d)
  r.setHours(23, 59, 59, 999)
  return r
}

export function DaySummaryCards() {
  const today = new Date()
  const { data: appointments = [], isLoading } = useAppointments({
    from: startOfDay(today).toISOString(),
    to: endOfDay(today).toISOString(),
  })

  const completed = appointments.filter((a) => a.status === 'COMPLETED')
  const pending = appointments.filter((a) =>
    ['SCHEDULED', 'CONFIRMED'].includes(a.status),
  )
  const totalRevenue = completed.reduce((sum, a) => sum + Number(a.price), 0)
  const avgTicket = completed.length > 0 ? totalRevenue / completed.length : 0

  const cards = [
    {
      label: 'Atendimentos hoje',
      value: isLoading ? '—' : String(appointments.length),
      sub: `${pending.length} pendentes`,
      icon: CalendarCheck,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Concluídos',
      value: isLoading ? '—' : String(completed.length),
      sub: 'hoje',
      icon: Users,
      color: 'text-emerald-600 bg-emerald-50',
    },
    {
      label: 'Receita do dia',
      value: isLoading
        ? '—'
        : `R$${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      sub: 'atendimentos concluídos',
      icon: DollarSign,
      color: 'text-rose-600 bg-rose-50',
    },
    {
      label: 'Ticket médio',
      value: isLoading
        ? '—'
        : `R$${avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      sub: 'por atendimento',
      icon: TrendingUp,
      color: 'text-purple-600 bg-purple-50',
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div
            key={card.label}
            className="rounded-2xl border border-white/80 bg-white/85 p-5 shadow-sm"
          >
            <div className={`inline-flex rounded-xl p-2 ${card.color}`}>
              <Icon className="size-4" />
            </div>
            {isLoading ? (
              <>
                <Skeleton className="mt-4 h-7 w-24" />
                <Skeleton className="mt-1 h-3 w-32" />
              </>
            ) : (
              <>
                <p className="mt-4 text-2xl font-semibold text-slate-950">
                  {card.value}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{card.sub}</p>
              </>
            )}
            <p className="mt-3 text-xs font-medium text-slate-400">{card.label}</p>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Passo 2: Criar página /dashboard**

```tsx
// src/app/(app)/dashboard/page.tsx
import { DaySummaryCards } from '@/components/domain/dashboard/day-summary-cards'
import { AgendaDayView } from '@/components/domain/scheduling/agenda-day-view'

export const metadata = { title: 'Dashboard · Estética SaaS' }

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          Visão geral do dia
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Resumo operacional e agenda de hoje
        </p>
      </div>

      <DaySummaryCards />

      <div>
        <h2 className="mb-4 text-lg font-semibold text-slate-950">
          Agenda de hoje
        </h2>
        <AgendaDayView />
      </div>
    </div>
  )
}
```

- [ ] **Passo 3: Verificar build completo**

```bash
npm run build
```

Esperado: build sem erros ou warnings de tipo.

- [ ] **Passo 4: Commit**

```bash
git add src/components/domain/dashboard/ src/app/(app)/dashboard/
git commit -m "feat(dashboard): DaySummaryCards e pagina /dashboard para OWNER"
```

---

## Tarefa 13: Verificação manual e PR

- [ ] **Passo 1: Rodar em desenvolvimento**

```bash
npm run dev
```

- [ ] **Passo 2: Verificar fluxo de autenticação**

Acessar `http://localhost:3000`. Deve redirecionar para `/login`. Fazer login com usuário OWNER → deve cair em `/dashboard`. Fazer login com PROFESSIONAL → deve cair em `/agenda`.

- [ ] **Passo 3: Verificar shell**

- Sidebar visível apenas em ≥ 1280px (`xl:flex`)
- Bottom nav visível apenas abaixo de 1280px
- Item ativo destacado com fundo rose
- Links navegam para as rotas corretas
- Itens sem permissão não aparecem (PROFESSIONAL vê apenas Agenda e Config.)

- [ ] **Passo 4: Verificar agenda**

- Strip da semana aparece no topo com o dia selecionado destacado
- Toggle Dia/Semana funciona (no modo semana, a lista do dia selecionado ainda aparece abaixo do strip)
- Clicar num dia no strip navega para aquele dia
- "Hoje" formatado corretamente no label do dia
- Empty state aparece quando não há agendamentos
- Criar agendamento: selecionar cliente → serviço → horário → confirmar → toast de sucesso → card aparece na lista
- Clicar no card → drawer abre com detalhes
- Botões de status funcionam e atualizam o card sem recarregar a página
- PROFESSIONAL logado só vê seus próprios agendamentos

- [ ] **Passo 5: Verificar dashboard (OWNER)**

- 4 cards de resumo aparecem com dados do dia
- Agenda aparece abaixo dos cards
- Skeleton aparece enquanto dados carregam

- [ ] **Passo 6: Criar PR**

```bash
git checkout -b feat/shell-e-agenda
git push -u origin feat/shell-e-agenda
gh pr create \
  --title "feat(shell+agenda): navegacao real com permissoes e agenda como tela central" \
  --body "## O que foi implementado

- QueryClientProvider configurado no root layout
- hooks useCurrentUser e usePermissions
- AppShell convertido para navegação real com Next.js Links, active state e controle de permissões
- Redirect por papel após login (OWNER/MANAGER → /dashboard, demais → /agenda)
- Hooks de dados: useAppointments, useServices, useCustomersSearch
- AppointmentCard com status colorido
- CreateAppointmentModal (fluxo de 3 passos)
- AppointmentDrawer com ações de status
- AgendaDayView com navegação por dia, grupos por hora e estados vazios
- Página /agenda
- DaySummaryCards e página /dashboard para OWNER

## Critérios atendidos

- [x] Sidebar visível no desktop, bottom nav no mobile
- [x] Item ativo destacado visualmente
- [x] Redirect correto por papel após login
- [x] Itens sem permissão não renderizados
- [x] Agendamento criado em até 3 passos
- [x] Status de cada agendamento com cor distinta
- [x] OWNER vê resumo do dia no dashboard
- [x] PROFESSIONAL vê apenas seus agendamentos (via filtro professionalId)"
```

---

## Planos subsequentes

Após a aprovação do PR deste plano, os próximos são:

- **Plano 2:** `2026-05-22-crm-financeiro-equipe.md` — Clientes, Financeiro e Equipe
- **Plano 3:** `2026-05-22-notificacoes-whatsapp.md` — DB + backend + frontend de notificações
- **Plano 4:** `2026-05-22-automacoes.md` — DB + backend + frontend de automações
