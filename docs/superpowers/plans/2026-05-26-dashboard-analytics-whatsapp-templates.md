# Dashboard Analytics + Templates WhatsApp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o dashboard atual (cálculo no frontend) por métricas agregadas no backend com polling de 30s, e adicionar templates WhatsApp para confirmação e no-show.

**Architecture:** Novo endpoint `GET /api/dashboard/metrics` agrega no Prisma (groupBy status, groupBy profissional, aggregate receita). Frontend usa `useDashboardMetrics` com `refetchInterval: 30_000`. Subscriptions de notificações ganham `appointment.confirmed` e templates `appointment-confirmed`/`appointment-no-show` no provider.

**Tech Stack:** Next.js 15 App Router, Prisma groupBy/aggregate, TanStack Query v5 (`refetchInterval`), Shadcn UI, Z-API WhatsApp

**Branch:** Criar `feat/dashboard-analytics-whatsapp` a partir de `main` antes de iniciar qualquer task.

```bash
git checkout main && git pull origin main
git checkout -b feat/dashboard-analytics-whatsapp
```

---

## Mapa de arquivos

| Arquivo | Ação |
|---------|------|
| `src/app/api/dashboard/metrics/route.ts` | Criar — GET agrega métricas no banco |
| `src/hooks/dashboard/use-dashboard-metrics.ts` | Criar — hook com refetchInterval 30s |
| `src/components/domain/dashboard/dashboard-metrics.tsx` | Criar — componente principal (substitui DaySummaryCards) |
| `src/components/domain/dashboard/day-summary-cards.tsx` | Remover uso — arquivo pode ficar mas não será mais usado na page |
| `src/app/(app)/dashboard/page.tsx` | Modificar — trocar DaySummaryCards por DashboardMetrics |
| `src/domains/notifications/providers/whatsapp.provider.ts` | Modificar — adicionar templates confirmed e no-show |
| `src/domains/notifications/subscriptions.ts` | Modificar — adicionar confirmed, corrigir provider "evolution-api" → "z-api" |

---

### Task 1: Backend — GET /api/dashboard/metrics

**Files:**
- Create: `src/app/api/dashboard/metrics/route.ts`

- [ ] **Step 1: Ler arquivos de referência**

Leia antes de criar:
- `src/app/api/scheduling/appointments/route.ts` — para ver o padrão de `getSessionContext`, `handleApiError`, `initializeDomainRuntime`
- `src/shared/auth/permissions.ts` — para confirmar a permissão correta (use `PERMISSIONS.appointments.view`)
- `src/shared/database/prisma.ts` — para confirmar o import do Prisma client

- [ ] **Step 2: Criar a API route**

Criar `src/app/api/dashboard/metrics/route.ts`:

```typescript
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { prisma } from "@/shared/database/prisma";
import { AppointmentStatus } from "@prisma/client";

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.appointments.view);

    const today = new Date();
    const dayStart = startOfDay(today);
    const dayEnd = endOfDay(today);
    const monthStart = startOfMonth(today);

    const [statusGroups, profGroups, revenueToday, revenueMonth] =
      await Promise.all([
        prisma.appointment.groupBy({
          by: ["status"],
          where: { tenantId: session.tenantId, startsAt: { gte: dayStart, lte: dayEnd } },
          _count: { status: true },
        }),
        prisma.appointment.groupBy({
          by: ["professionalId"],
          where: { tenantId: session.tenantId, startsAt: { gte: dayStart, lte: dayEnd } },
          _count: { professionalId: true },
          orderBy: { _count: { professionalId: "desc" } },
        }),
        prisma.appointment.aggregate({
          where: {
            tenantId: session.tenantId,
            status: AppointmentStatus.COMPLETED,
            startsAt: { gte: dayStart, lte: dayEnd },
          },
          _sum: { price: true },
        }),
        prisma.appointment.aggregate({
          where: {
            tenantId: session.tenantId,
            status: AppointmentStatus.COMPLETED,
            startsAt: { gte: monthStart, lte: dayEnd },
          },
          _sum: { price: true },
        }),
      ]);

    const allStatuses: AppointmentStatus[] = [
      "SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW",
    ];
    const byStatus = Object.fromEntries(
      allStatuses.map((s) => [
        s,
        statusGroups.find((g) => g.status === s)?._count.status ?? 0,
      ]),
    ) as Record<AppointmentStatus, number>;

    const profIds = profGroups.map((g) => g.professionalId);
    const profUsers = profIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: profIds } },
          select: { id: true, name: true },
        })
      : [];

    const byProfessional = profGroups.map((g) => ({
      id: g.professionalId,
      name: profUsers.find((u) => u.id === g.professionalId)?.name ?? "Desconhecido",
      count: g._count.professionalId,
    }));

    const revenue = {
      today: Number(revenueToday._sum.price ?? 0),
      month: Number(revenueMonth._sum.price ?? 0),
    };

    return Response.json({ byStatus, byProfessional, revenue });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd c:/dev/estetica-saas && npx tsc --noEmit 2>&1 | head -30
```

Esperado: zero erros.

- [ ] **Step 4: Commit**

```bash
cd c:/dev/estetica-saas && git add src/app/api/dashboard/
git commit -m "feat(dashboard): endpoint GET /api/dashboard/metrics com agregação por status, profissional e receita"
```

---

### Task 2: WhatsApp — templates confirmed + no-show + corrigir provider

**Files:**
- Modify: `src/domains/notifications/providers/whatsapp.provider.ts`
- Modify: `src/domains/notifications/subscriptions.ts`

- [ ] **Step 1: Ler os arquivos**

Leia:
- `src/domains/notifications/providers/whatsapp.provider.ts` — ver a função `buildMessage` e onde adicionar os novos templates
- `src/domains/notifications/subscriptions.ts` — ver todas as subscriptions existentes

- [ ] **Step 2: Adicionar templates no provider**

Em `src/domains/notifications/providers/whatsapp.provider.ts`, na função `buildMessage`, adicionar antes do `return` final (a linha `return \`Olá, ${payload.customerName}!...`):

```typescript
  if (template === "appointment-confirmed") {
    const date = new Date(payload.startsAt as string);
    const formatted = date.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    return (
      `✅ Confirmado, ${payload.customerName}!\n` +
      `Seu agendamento está confirmado:\n` +
      `📅 ${formatted}\n` +
      `✂️ ${payload.serviceName}\n` +
      `Te esperamos!`
    );
  }

  if (template === "appointment-no-show") {
    return (
      `Olá, ${payload.customerName}! 😕\n` +
      `Notamos que você não compareceu ao seu agendamento de ${payload.serviceName}.\n` +
      `Quando quiser reagendar, estamos à disposição!`
    );
  }
```

- [ ] **Step 3: Corrigir subscriptions.ts**

Em `src/domains/notifications/subscriptions.ts`, fazer duas mudanças:

**3a) Adicionar subscription para `appointment.confirmed`** (inserir após a subscription de `appointment.created`):

```typescript
  eventBus.subscribe("scheduling.appointment.confirmed", async ({ tenantId, appointment, customer, service }) => {
    if (!customer.phone) return;
    await notificationService.logAndDispatch({
      tenantId,
      appointmentId: appointment.id,
      channel: NotificationChannel.WHATSAPP,
      template: "appointment-confirmed",
      recipient: customer.phone,
      provider: "z-api",
      payload: {
        appointmentId: appointment.id,
        startsAt: appointment.startsAt.toISOString(),
        customerName: customer.name,
        serviceName: service.name,
      },
    });
  });
```

**3b) Substituir `provider: "evolution-api"` por `provider: "z-api"` em TODAS as subscriptions existentes** (cancelled, created, no_show). Há 3 ocorrências. Substituir todas.

Também **adicionar guard `if (!customer.phone) return;`** no início de cada handler das subscriptions existentes — o payload tem `customer.phone` que pode ser `string | null`. O campo `recipient` já usa `customer.phone ?? customer.email ?? ""`, mas retornar cedo é mais limpo quando não tem telefone.

O resultado final de `subscriptions.ts` deve ser:

```typescript
import { NotificationChannel } from "@prisma/client";

import { eventBus } from "@/shared/events/event-bus";

import { notificationService } from "./notification.service";

let notificationsRegistered = false;

export function registerNotificationSubscriptions() {
  if (notificationsRegistered) {
    return;
  }

  notificationsRegistered = true;

  eventBus.subscribe("scheduling.appointment.cancelled", async ({ tenantId, appointment, customer, service }) => {
    if (!customer.phone) return;
    await notificationService.logAndDispatch({
      tenantId,
      appointmentId: appointment.id,
      channel: NotificationChannel.WHATSAPP,
      template: "appointment-cancelled",
      recipient: customer.phone,
      provider: "z-api",
      payload: {
        appointmentId: appointment.id,
        status: appointment.status,
        customerName: customer.name,
        serviceName: service.name,
      },
    });
  });

  eventBus.subscribe("scheduling.appointment.created", async ({ tenantId, appointment, customer, service }) => {
    if (!customer.phone) return;
    await notificationService.logAndDispatch({
      tenantId,
      appointmentId: appointment.id,
      channel: NotificationChannel.WHATSAPP,
      template: "appointment-created",
      recipient: customer.phone,
      provider: "z-api",
      payload: {
        appointmentId: appointment.id,
        startsAt: appointment.startsAt.toISOString(),
        customerName: customer.name,
        serviceName: service.name,
      },
    });
  });

  eventBus.subscribe("scheduling.appointment.confirmed", async ({ tenantId, appointment, customer, service }) => {
    if (!customer.phone) return;
    await notificationService.logAndDispatch({
      tenantId,
      appointmentId: appointment.id,
      channel: NotificationChannel.WHATSAPP,
      template: "appointment-confirmed",
      recipient: customer.phone,
      provider: "z-api",
      payload: {
        appointmentId: appointment.id,
        startsAt: appointment.startsAt.toISOString(),
        customerName: customer.name,
        serviceName: service.name,
      },
    });
  });

  eventBus.subscribe("scheduling.appointment.no_show", async ({ tenantId, appointment, customer, service }) => {
    if (!customer.phone) return;
    await notificationService.logAndDispatch({
      tenantId,
      appointmentId: appointment.id,
      channel: NotificationChannel.WHATSAPP,
      template: "appointment-no-show",
      recipient: customer.phone,
      provider: "z-api",
      payload: {
        appointmentId: appointment.id,
        status: appointment.status,
        customerName: customer.name,
        serviceName: service.name,
      },
    });
  });
}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
cd c:/dev/estetica-saas && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 5: Commit**

```bash
cd c:/dev/estetica-saas && git add src/domains/notifications/
git commit -m "feat(notifications): templates appointment-confirmed e appointment-no-show + corrige provider para z-api"
```

---

### Task 3: Frontend — hook useDashboardMetrics + componente DashboardMetrics

**Files:**
- Create: `src/hooks/dashboard/use-dashboard-metrics.ts`
- Create: `src/components/domain/dashboard/dashboard-metrics.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`

O tipo de retorno do endpoint (Task 1):
```typescript
type AppointmentStatus = 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'

type DashboardMetrics = {
  byStatus: Record<AppointmentStatus, number>
  byProfessional: Array<{ id: string; name: string; count: number }>
  revenue: { today: number; month: number }
}
```

- [ ] **Step 1: Criar o hook**

Criar `src/hooks/dashboard/use-dashboard-metrics.ts`:

```typescript
import { useQuery } from '@tanstack/react-query'

export type AppointmentStatus =
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'

export type DashboardMetrics = {
  byStatus: Record<AppointmentStatus, number>
  byProfessional: Array<{ id: string; name: string; count: number }>
  revenue: { today: number; month: number }
}

async function fetchMetrics(): Promise<DashboardMetrics> {
  const res = await fetch('/api/dashboard/metrics')
  if (!res.ok) throw new Error('Falha ao carregar métricas')
  return res.json()
}

export function useDashboardMetrics() {
  return useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: fetchMetrics,
    refetchInterval: 30_000,
    staleTime: 20_000,
  })
}
```

- [ ] **Step 2: Criar o componente DashboardMetrics**

Criar `src/components/domain/dashboard/dashboard-metrics.tsx`:

```tsx
'use client'

import { CalendarCheck, DollarSign, TrendingUp, Users } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useDashboardMetrics, type AppointmentStatus } from '@/hooks/dashboard/use-dashboard-metrics'

const STATUS_CONFIG: Record<AppointmentStatus, { label: string; color: string }> = {
  SCHEDULED:  { label: 'Agendado',   color: 'bg-blue-100 text-blue-700' },
  CONFIRMED:  { label: 'Confirmado', color: 'bg-indigo-100 text-indigo-700' },
  COMPLETED:  { label: 'Concluído',  color: 'bg-emerald-100 text-emerald-700' },
  CANCELLED:  { label: 'Cancelado',  color: 'bg-slate-100 text-slate-500' },
  NO_SHOW:    { label: 'Faltou',     color: 'bg-rose-100 text-rose-600' },
}

const STATUS_ORDER: AppointmentStatus[] = [
  'SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW',
]

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/85 p-5 shadow-sm">
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{children}</p>
}

export function DashboardMetrics() {
  const { data, isLoading, isError } = useDashboardMetrics()

  if (isError) {
    return (
      <p className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-600">
        Erro ao carregar métricas. Tente recarregar a página.
      </p>
    )
  }

  const total = data
    ? Object.values(data.byStatus).reduce((s, n) => s + n, 0)
    : 0

  const maxCount = data?.byProfessional[0]?.count ?? 1

  return (
    <div className="space-y-4">
      {/* Linha 1 — Resumo numérico */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Total de hoje */}
        <Card>
          <div className="inline-flex rounded-xl bg-blue-50 p-2 text-blue-600">
            <CalendarCheck className="size-4" />
          </div>
          {isLoading ? (
            <>
              <Skeleton className="mt-4 h-7 w-16" />
              <Skeleton className="mt-1 h-3 w-24" />
            </>
          ) : (
            <>
              <p className="mt-4 text-2xl font-semibold text-slate-950">{total}</p>
              <p className="mt-0.5 text-xs text-slate-500">agendamentos hoje</p>
            </>
          )}
          <p className="mt-3 text-xs font-medium text-slate-400">Total do dia</p>
        </Card>

        {/* Concluídos */}
        <Card>
          <div className="inline-flex rounded-xl bg-emerald-50 p-2 text-emerald-600">
            <Users className="size-4" />
          </div>
          {isLoading ? (
            <>
              <Skeleton className="mt-4 h-7 w-16" />
              <Skeleton className="mt-1 h-3 w-24" />
            </>
          ) : (
            <>
              <p className="mt-4 text-2xl font-semibold text-slate-950">
                {data?.byStatus.COMPLETED ?? 0}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">hoje</p>
            </>
          )}
          <p className="mt-3 text-xs font-medium text-slate-400">Concluídos</p>
        </Card>

        {/* Receita hoje */}
        <Card>
          <div className="inline-flex rounded-xl bg-rose-50 p-2 text-rose-600">
            <DollarSign className="size-4" />
          </div>
          {isLoading ? (
            <>
              <Skeleton className="mt-4 h-7 w-24" />
              <Skeleton className="mt-1 h-3 w-28" />
            </>
          ) : (
            <>
              <p className="mt-4 text-2xl font-semibold text-slate-950">
                R${fmt(data?.revenue.today ?? 0)}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">atendimentos concluídos</p>
            </>
          )}
          <p className="mt-3 text-xs font-medium text-slate-400">Receita do dia</p>
        </Card>

        {/* Receita do mês */}
        <Card>
          <div className="inline-flex rounded-xl bg-purple-50 p-2 text-purple-600">
            <TrendingUp className="size-4" />
          </div>
          {isLoading ? (
            <>
              <Skeleton className="mt-4 h-7 w-24" />
              <Skeleton className="mt-1 h-3 w-28" />
            </>
          ) : (
            <>
              <p className="mt-4 text-2xl font-semibold text-slate-950">
                R${fmt(data?.revenue.month ?? 0)}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">mês atual</p>
            </>
          )}
          <p className="mt-3 text-xs font-medium text-slate-400">Receita do mês</p>
        </Card>
      </div>

      {/* Linha 2 — Status + Profissionais */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Status breakdown */}
        <Card>
          <SectionTitle>Agendamentos por status</SectionTitle>
          {isLoading ? (
            <div className="flex flex-wrap gap-2">
              {STATUS_ORDER.map((s) => (
                <Skeleton key={s} className="h-7 w-24 rounded-full" />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {STATUS_ORDER.map((status) => {
                const cfg = STATUS_CONFIG[status]
                const count = data?.byStatus[status] ?? 0
                return (
                  <span
                    key={status}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${cfg.color}`}
                  >
                    <span className="text-base font-semibold">{count}</span>
                    {cfg.label}
                  </span>
                )
              })}
            </div>
          )}
        </Card>

        {/* Ocupação por profissional */}
        <Card>
          <SectionTitle>Ocupação por profissional</SectionTitle>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              ))}
            </div>
          ) : !data || data.byProfessional.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum agendamento hoje.</p>
          ) : (
            <div className="space-y-3">
              {data.byProfessional.map((prof) => (
                <div key={prof.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{prof.name}</span>
                    <span className="text-slate-400">
                      {prof.count} {prof.count === 1 ? 'atendimento' : 'atendimentos'}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-rose-400 transition-all"
                      style={{ width: `${(prof.count / maxCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Atualizar dashboard/page.tsx**

Substituir o conteúdo de `src/app/(app)/dashboard/page.tsx` por:

```tsx
import { DashboardMetrics } from '@/components/domain/dashboard/dashboard-metrics'
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
          Resumo operacional · atualiza automaticamente a cada 30s
        </p>
      </div>

      <DashboardMetrics />

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

- [ ] **Step 4: Verificar TypeScript**

```bash
cd c:/dev/estetica-saas && npx tsc --noEmit 2>&1 | head -30
```

Esperado: zero erros.

- [ ] **Step 5: Commit**

```bash
cd c:/dev/estetica-saas && git add src/hooks/dashboard/ src/components/domain/dashboard/dashboard-metrics.tsx "src/app/(app)/dashboard/page.tsx"
git commit -m "feat(dashboard): métricas em tempo real com polling 30s — status, profissionais e receita"
```

---

### Task 4: PR e merge

**Files:** nenhum novo

- [ ] **Step 1: Verificação final TypeScript**

```bash
cd c:/dev/estetica-saas && npx tsc --noEmit 2>&1
```

Esperado: zero erros.

- [ ] **Step 2: Push e PR**

```bash
cd c:/dev/estetica-saas && git push origin feat/dashboard-analytics-whatsapp
```

Abrir PR em: `https://github.com/AdemilsonB/estetica-saas/pull/new/feat/dashboard-analytics-whatsapp`

Título: `feat: dashboard analytics com polling 30s + templates WhatsApp confirmed/no-show`

- [ ] **Step 3: Merge na main após aprovação**
