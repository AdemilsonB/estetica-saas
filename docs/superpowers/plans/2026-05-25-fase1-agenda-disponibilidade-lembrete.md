# Fase 1 — Agenda Semanal, Disponibilidade, Lembrete 24h e Horários de Expediente

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finalizar a Fase 1 do produto: agenda semanal funcional, validação de conflito de horário com bypass controlado, seletor de slots disponíveis no modal, lembrete WhatsApp 24h antes via pg-boss, e configuração de horários de expediente por tenant.

**Architecture:** Novos campos no schema (businessHours + allowOverlap) → AvailabilityService expandido com geração de slots → API de disponibilidade → modal de agendamento reescrito em etapas (profissional → serviço → data → slot → cliente) → pg-boss singleton com job de lembrete → agenda semanal via integração dos componentes já existentes.

**Tech Stack:** Next.js 15 App Router, Prisma, Supabase Auth, TanStack Query v5, Shadcn UI / Tailwind, Zod, pg-boss, Z-API

**Branch:** Criar `feat/fase1-agenda-disponibilidade` a partir de `main` antes de iniciar qualquer task.

```bash
git checkout main && git pull origin main
git checkout -b feat/fase1-agenda-disponibilidade
```

---

## Mapa de arquivos

| Arquivo | Ação |
|---------|------|
| `prisma/schema.prisma` | Modificar — `businessHours Json?` no Tenant, `allowOverlap Boolean` no Appointment |
| `src/domains/scheduling/types.ts` | Modificar — adicionar `allowOverlap` e `professionalId` opcional no createAppointmentSchema |
| `src/domains/scheduling/availability.service.ts` | Modificar — adicionar `getAvailableSlots()` |
| `src/app/api/scheduling/availability/route.ts` | Criar — GET disponibilidade |
| `src/domains/iam/iam.repository.ts` | Modificar — `findTenantBusinessHours`, `updateBusinessHours` |
| `src/domains/iam/iam.service.ts` | Modificar — `getBusinessHours`, `updateBusinessHours` |
| `src/app/api/iam/tenant/business-hours/route.ts` | Criar — GET + PATCH horários |
| `src/domains/scheduling/scheduling.service.ts` | Modificar — bypass allowOverlap, agendar/cancelar job pg-boss |
| `src/shared/queue/pg-boss.ts` | Criar — singleton pg-boss |
| `src/shared/queue/jobs/appointment-reminder.ts` | Criar — job handler + schedule + cancel |
| `src/app/api/_lib/runtime.ts` | Modificar — inicializar worker pg-boss |
| `.env.example` | Modificar — adicionar ZAPI_CLIENT_TOKEN, remover Evolution API |
| `src/hooks/scheduling/use-availability.ts` | Criar — useAvailableSlots |
| `src/hooks/settings/use-business-hours.ts` | Criar — useBusinessHours, useUpdateBusinessHours |
| `src/components/domain/scheduling/agenda-day-view.tsx` | Modificar — aceitar prop `date?: Date` |
| `src/app/(app)/agenda/page.tsx` | Modificar — client, selectedDate, integrar AgendaWeekStrip |
| `src/components/domain/settings/business-hours-form.tsx` | Criar — grade semanal de horários |
| `src/app/(app)/configuracoes/page.tsx` | Modificar — adicionar aba Horários |
| `src/components/domain/scheduling/create-appointment-modal.tsx` | Modificar — reescrever com profissional selector, date+slot picker, toggle overlap |
| `src/domains/notifications/providers/whatsapp.provider.ts` | Modificar — adicionar template `appointment-reminder` |

---

### Task 1: Schema — businessHours no Tenant e allowOverlap no Appointment

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Adicionar campos ao schema**

Em `prisma/schema.prisma`, no model `Tenant`, adicionar após `whatsappEnabled Boolean @default(false)`:

```prisma
  businessHours     Json?
```

No model `Appointment`, adicionar após `notes String?`:

```prisma
  allowOverlap      Boolean           @default(false)
```

- [ ] **Step 2: Rodar a migration**

```bash
npx prisma migrate dev --name add_business_hours_and_allow_overlap
```

Esperado: migration aplicada sem erros.

- [ ] **Step 3: Regenerar client e checar TypeScript**

```bash
npx prisma generate && npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "chore(db): adiciona businessHours ao Tenant e allowOverlap ao Appointment"
```

---

### Task 2: Backend — horários de expediente (GET + PATCH /api/iam/tenant/business-hours)

**Files:**
- Modify: `src/domains/iam/iam.repository.ts`
- Modify: `src/domains/iam/iam.service.ts`
- Create: `src/app/api/iam/tenant/business-hours/route.ts`

O formato do `businessHours` é:
```json
{
  "0": { "open": "09:00", "close": "18:00", "active": false },
  "1": { "open": "09:00", "close": "18:00", "active": true },
  "2": { "open": "09:00", "close": "18:00", "active": true },
  "3": { "open": "09:00", "close": "18:00", "active": true },
  "4": { "open": "09:00", "close": "18:00", "active": true },
  "5": { "open": "09:00", "close": "18:00", "active": true },
  "6": { "open": "09:00", "close": "13:00", "active": true }
}
```
Onde 0=Domingo, 1=Segunda, …, 6=Sábado (mesmo que `Date.getDay()`).

- [ ] **Step 1: Adicionar métodos ao repository**

Em `src/domains/iam/iam.repository.ts`, adicionar os métodos:

```typescript
  static defaultBusinessHours(): Record<string, { open: string; close: string; active: boolean }> {
    return {
      "0": { open: "09:00", close: "18:00", active: false },
      "1": { open: "09:00", close: "18:00", active: true },
      "2": { open: "09:00", close: "18:00", active: true },
      "3": { open: "09:00", close: "18:00", active: true },
      "4": { open: "09:00", close: "18:00", active: true },
      "5": { open: "09:00", close: "18:00", active: true },
      "6": { open: "09:00", close: "13:00", active: true },
    };
  }

  async getBusinessHours(tenantId: string) {
    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { businessHours: true },
    });
    return (tenant?.businessHours as Record<string, { open: string; close: string; active: boolean }> | null)
      ?? IamRepository.defaultBusinessHours();
  }

  async updateBusinessHours(
    tenantId: string,
    hours: Record<string, { open: string; close: string; active: boolean }>,
  ) {
    return prisma.tenant.update({
      where: { id: tenantId },
      data: { businessHours: hours },
      select: { businessHours: true },
    });
  }
```

- [ ] **Step 2: Adicionar métodos ao service**

Em `src/domains/iam/iam.service.ts`, adicionar:

```typescript
  async getBusinessHours(tenantId: string) {
    return this.repo.getBusinessHours(tenantId);
  }

  async updateBusinessHours(
    tenantId: string,
    hours: Record<string, { open: string; close: string; active: boolean }>,
  ) {
    return this.repo.updateBusinessHours(tenantId, hours);
  }
```

- [ ] **Step 3: Criar a API route**

Criar `src/app/api/iam/tenant/business-hours/route.ts`:

```typescript
import { z } from "zod";

import { iamService } from "@/domains/iam/iam.service";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";

const daySchema = z.object({
  open: z.string().regex(/^\d{2}:\d{2}$/),
  close: z.string().regex(/^\d{2}:\d{2}$/),
  active: z.boolean(),
});

const businessHoursSchema = z.object({
  "0": daySchema, "1": daySchema, "2": daySchema,
  "3": daySchema, "4": daySchema, "5": daySchema, "6": daySchema,
});

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.view);
    const hours = await iamService.getBusinessHours(session.tenantId);
    return Response.json(hours);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.manage);
    const input = await validateInput(request, businessHoursSchema);
    const result = await iamService.updateBusinessHours(session.tenantId, input);
    return Response.json(result.businessHours);
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/domains/iam/ src/app/api/iam/tenant/business-hours/
git commit -m "feat(iam): API de horarios de expediente GET/PATCH /api/iam/tenant/business-hours"
```

---

### Task 3: Backend — geração de slots disponíveis (AvailabilityService + GET /api/scheduling/availability)

**Files:**
- Modify: `src/domains/scheduling/availability.service.ts`
- Create: `src/app/api/scheduling/availability/route.ts`

- [ ] **Step 1: Adicionar `getAvailableSlots` ao AvailabilityService**

Substituir todo o conteúdo de `src/domains/scheduling/availability.service.ts`:

```typescript
import { prisma } from "@/shared/database/prisma";
import { SlotUnavailableError } from "@/shared/errors";
import { IamRepository } from "@/domains/iam/iam.repository";

import { appointmentRepository } from "./appointment.repository";

export type TimeSlot = {
  time: string;
  available: boolean;
};

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export class AvailabilityService {
  async ensureSlotAvailable(
    tenantId: string,
    professionalId: string,
    startsAt: Date,
    endsAt: Date,
  ) {
    const overlapping = await appointmentRepository.findOverlappingForProfessional(
      tenantId,
      professionalId,
      startsAt,
      endsAt,
    );
    if (overlapping) {
      throw new SlotUnavailableError();
    }
  }

  async getAvailableSlots(
    tenantId: string,
    professionalId: string,
    date: string,
    serviceDuration: number,
  ): Promise<TimeSlot[]> {
    const iamRepo = new IamRepository();
    const businessHours = await iamRepo.getBusinessHours(tenantId);
    const dayOfWeek = new Date(date + "T12:00:00").getDay();
    const dayConfig = businessHours[String(dayOfWeek)];

    if (!dayConfig || !dayConfig.active) {
      return [];
    }

    const step = Math.max(serviceDuration, 15);
    const openMin = timeToMinutes(dayConfig.open);
    const closeMin = timeToMinutes(dayConfig.close);

    const dayStart = new Date(date + "T00:00:00");
    const dayEnd = new Date(date + "T23:59:59");

    const existingAppointments = await prisma.appointment.findMany({
      where: {
        tenantId,
        professionalId,
        status: { in: ["SCHEDULED", "CONFIRMED"] },
        startsAt: { gte: dayStart, lte: dayEnd },
      },
      select: { startsAt: true, endsAt: true },
    });

    const slots: TimeSlot[] = [];
    for (let min = openMin; min + step <= closeMin; min += step) {
      const slotStart = new Date(`${date}T${minutesToTime(min)}:00`);
      const slotEnd = new Date(slotStart.getTime() + step * 60 * 1000);

      const conflicting = existingAppointments.some(
        (a) => a.startsAt < slotEnd && a.endsAt > slotStart,
      );

      slots.push({ time: minutesToTime(min), available: !conflicting });
    }

    return slots;
  }
}

export const availabilityService = new AvailabilityService();
```

- [ ] **Step 2: Criar a API route de disponibilidade**

Criar `src/app/api/scheduling/availability/route.ts`:

```typescript
import { z } from "zod";

import { availabilityService } from "@/domains/scheduling/availability.service";
import { catalogServiceRepository } from "@/domains/scheduling/service.repository";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { ValidationError } from "@/shared/errors";

const querySchema = z.object({
  professionalId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  serviceId: z.string().cuid(),
});

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.appointments.create);

    const url = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      throw new ValidationError("Parametros invalidos.", parsed.error.flatten());
    }

    const { professionalId, date, serviceId } = parsed.data;

    const service = await catalogServiceRepository.findById(session.tenantId, serviceId);
    if (!service) {
      return Response.json({ slots: [] });
    }

    const slots = await availabilityService.getAvailableSlots(
      session.tenantId,
      professionalId,
      date,
      service.duration,
    );

    return Response.json({ slots });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/domains/scheduling/availability.service.ts src/app/api/scheduling/availability/
git commit -m "feat(scheduling): AvailabilityService gera slots disponíveis por dia e profissional"
```

---

### Task 4: Backend — allowOverlap no createAppointment

**Files:**
- Modify: `src/domains/scheduling/types.ts`
- Modify: `src/domains/scheduling/scheduling.service.ts`
- Modify: `src/app/api/scheduling/appointments/route.ts`

- [ ] **Step 1: Adicionar allowOverlap ao schema de criação**

Em `src/domains/scheduling/types.ts`, modificar `createAppointmentSchema`:

```typescript
export const createAppointmentSchema = z.object({
  customerId: z.string().cuid(),
  professionalId: z.string().uuid(),
  serviceId: z.string().cuid(),
  startsAt: z.string().datetime(),
  notes: z.string().trim().max(500).optional(),
  allowOverlap: z.boolean().optional().default(false),
});
```

E atualizar o tipo:
```typescript
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
```

- [ ] **Step 2: Respeitar allowOverlap no service**

Em `src/domains/scheduling/scheduling.service.ts`, na função `createAppointment`, substituir o bloco de `ensureSlotAvailable`:

```typescript
    if (!input.allowOverlap) {
      await availabilityService.ensureSlotAvailable(
        tenantId,
        input.professionalId,
        startsAt,
        endsAt,
      );
    }
```

E no `appointmentRepository.create`, adicionar `allowOverlap` aos dados:

```typescript
    const appointment = await appointmentRepository.create(tenantId, {
      customerId: input.customerId,
      professionalId: input.professionalId,
      serviceId: input.serviceId,
      startsAt,
      endsAt,
      notes: input.notes,
      price: new Prisma.Decimal(service.price),
      createdByUserId: userId,
      allowOverlap: input.allowOverlap ?? false,
    });
```

- [ ] **Step 3: Verificar permissão no handler da API**

Verificar `src/app/api/scheduling/appointments/route.ts` — no handler POST, após `getSessionContext`, antes de chamar o service, validar que se `input.allowOverlap === true` então o role é OWNER ou MANAGER:

```typescript
    if (input.allowOverlap && session.role !== 'OWNER' && session.role !== 'MANAGER') {
      throw new ForbiddenError("Apenas OWNER e MANAGER podem autorizar conflito de horario.");
    }
```

Importar `ForbiddenError` de `@/shared/errors` se não estiver importado.

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/domains/scheduling/types.ts src/domains/scheduling/scheduling.service.ts src/app/api/scheduling/appointments/route.ts
git commit -m "feat(scheduling): allowOverlap no createAppointment — bypass de conflito para OWNER/MANAGER"
```

---

### Task 5: Backend — pg-boss lembrete 24h

**Files:**
- Create: `src/shared/queue/pg-boss.ts`
- Create: `src/shared/queue/jobs/appointment-reminder.ts`
- Modify: `src/domains/scheduling/scheduling.service.ts`
- Modify: `src/app/api/_lib/runtime.ts`
- Modify: `src/domains/notifications/providers/whatsapp.provider.ts`
- Modify: `.env.example`

- [ ] **Step 1: Criar o singleton pg-boss**

Criar `src/shared/queue/pg-boss.ts`:

```typescript
import PgBoss from "pg-boss";

let boss: PgBoss | null = null;

export function getPgBoss(): PgBoss {
  if (!boss) {
    boss = new PgBoss({
      connectionString: process.env.DATABASE_URL,
      schema: process.env.PG_BOSS_SCHEMA ?? "pgboss",
    });
  }
  return boss;
}

export async function startPgBoss(): Promise<PgBoss> {
  const b = getPgBoss();
  if (b.isInstalled()) return b;
  await b.start();
  return b;
}
```

- [ ] **Step 2: Criar o job de lembrete**

Criar `src/shared/queue/jobs/appointment-reminder.ts`:

```typescript
import type PgBoss from "pg-boss";

import { prisma } from "@/shared/database/prisma";
import { NotificationChannel } from "@prisma/client";
import { notificationService } from "@/domains/notifications/notification.service";

export const APPOINTMENT_REMINDER_JOB = "appointment-reminder";

export type AppointmentReminderPayload = {
  appointmentId: string;
  tenantId: string;
};

export async function handleAppointmentReminder(
  job: PgBoss.Job<AppointmentReminderPayload>,
): Promise<void> {
  const { appointmentId, tenantId } = job.data;

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, tenantId },
    include: {
      customer: true,
      service: true,
    },
  });

  if (!appointment || appointment.status === "CANCELLED") return;
  if (!appointment.customer.phone) return;

  await notificationService.logAndDispatch({
    tenantId,
    appointmentId,
    customerId: appointment.customerId,
    channel: NotificationChannel.WHATSAPP,
    template: "appointment-reminder",
    recipient: appointment.customer.phone,
    provider: "z-api",
    payload: {
      appointmentId,
      startsAt: appointment.startsAt.toISOString(),
      customerName: appointment.customer.name,
      serviceName: appointment.service.name,
    },
  });
}

export async function scheduleAppointmentReminder(
  boss: PgBoss,
  tenantId: string,
  appointmentId: string,
  startsAt: Date,
): Promise<void> {
  const sendAt = new Date(startsAt.getTime() - 24 * 60 * 60 * 1000);
  if (sendAt <= new Date()) return;

  await boss.send(
    APPOINTMENT_REMINDER_JOB,
    { appointmentId, tenantId },
    {
      startAfter: sendAt,
      singletonKey: appointmentId,
      retryLimit: 2,
      retryDelay: 300,
    },
  );
}

export async function cancelAppointmentReminder(
  boss: PgBoss,
  appointmentId: string,
): Promise<void> {
  await boss.cancel(APPOINTMENT_REMINDER_JOB, { singletonKey: appointmentId }).catch(() => {});
}
```

- [ ] **Step 3: Adicionar template `appointment-reminder` ao provider**

Em `src/domains/notifications/providers/whatsapp.provider.ts`, no `buildMessage`, adicionar antes do `return` final:

```typescript
  if (template === "appointment-reminder") {
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
      `Olá, ${payload.customerName}! 👋\n` +
      `Lembrete: você tem um agendamento amanhã:\n` +
      `📅 ${formatted}\n` +
      `✂️ ${payload.serviceName}\n` +
      `Até lá!`
    );
  }
```

- [ ] **Step 4: Integrar pg-boss no scheduling service**

Em `src/domains/scheduling/scheduling.service.ts`, adicionar import no topo:

```typescript
import { getPgBoss, startPgBoss } from "@/shared/queue/pg-boss";
import {
  scheduleAppointmentReminder,
  cancelAppointmentReminder,
} from "@/shared/queue/jobs/appointment-reminder";
```

Na função `createAppointment`, após o bloco `eventBus.publish(...)`, adicionar:

```typescript
    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { whatsappEnabled: true },
    });
    if (tenant?.whatsappEnabled) {
      const boss = getPgBoss();
      await scheduleAppointmentReminder(boss, tenantId, appointment.id, startsAt);
    }
```

Na função `updateAppointmentStatus`, após atualizar o status, se `input.status === AppointmentStatus.CANCELLED`, adicionar:

```typescript
    if (input.status === AppointmentStatus.CANCELLED) {
      const boss = getPgBoss();
      await cancelAppointmentReminder(boss, appointmentId);
    }
```

Verificar como `updateAppointmentStatus` está estruturada para inserir no lugar certo (após o update, antes do eventBus).

- [ ] **Step 5: Inicializar o worker no runtime**

Em `src/app/api/_lib/runtime.ts`, adicionar:

```typescript
import { startPgBoss } from "@/shared/queue/pg-boss";
import {
  APPOINTMENT_REMINDER_JOB,
  handleAppointmentReminder,
} from "@/shared/queue/jobs/appointment-reminder";

// Adicionar dentro da função initializeDomainRuntime(), após as subscriptions:
  startPgBoss().then((boss) => {
    boss.work(APPOINTMENT_REMINDER_JOB, handleAppointmentReminder);
  }).catch(console.error);
```

- [ ] **Step 6: Atualizar .env.example**

No arquivo `.env.example`, substituir o bloco de Evolution API:

```bash
# WhatsApp — Z-API
# Credencial global do client Z-API (painel Z-API → Client Token)
ZAPI_CLIENT_TOKEN=your-z-api-client-token
# Credenciais por tenant ficam no banco: Tenant.zApiInstanceId / Tenant.zApiToken
```

- [ ] **Step 7: Instalar pg-boss (se não estiver em package.json)**

```bash
npm list pg-boss 2>/dev/null || npm install pg-boss
```

- [ ] **Step 8: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 9: Commit**

```bash
git add src/shared/queue/ src/domains/scheduling/scheduling.service.ts src/app/api/_lib/runtime.ts src/domains/notifications/providers/whatsapp.provider.ts .env.example package.json package-lock.json
git commit -m "feat(notifications): lembrete 24h via pg-boss com singletonKey por appointmentId"
```

---

### Task 6: Frontend — agenda semanal (AgendaWeekStrip + AgendaDayView integrados)

**Files:**
- Modify: `src/components/domain/scheduling/agenda-day-view.tsx`
- Modify: `src/app/(app)/agenda/page.tsx`

- [ ] **Step 1: Adicionar prop `date` ao AgendaDayView**

Ler o arquivo `src/components/domain/scheduling/agenda-day-view.tsx`. Encontrar onde usa `new Date()` internamente como "hoje" e substituir pela prop `date`.

A mudança envolve:
1. Adicionar `date?: Date` ao tipo de props do componente
2. Substituir todas as ocorrências de `new Date()` usadas como "data do dia" por `date ?? new Date()`
3. Garantir que o `useMemo` que gera `from` e `to` dependa de `date` e não apenas rode na montagem

Exemplo de como o topo do componente deve ficar:

```typescript
type Props = {
  date?: Date
}

export function AgendaDayView({ date: dateProp }: Props) {
  const date = dateProp ?? new Date()

  const { from, to } = useMemo(() => {
    const start = new Date(date)
    start.setHours(0, 0, 0, 0)
    const end = new Date(date)
    end.setHours(23, 59, 59, 999)
    return {
      from: start.toISOString(),
      to: end.toISOString(),
    }
  }, [date])
  // restante do componente...
```

- [ ] **Step 2: Reescrever /agenda/page.tsx**

Substituir o conteúdo de `src/app/(app)/agenda/page.tsx` por:

```tsx
'use client'

import { useState } from 'react'
import { AgendaDayView } from '@/components/domain/scheduling/agenda-day-view'
import { AgendaWeekStrip } from '@/components/domain/scheduling/agenda-week-strip'

export default function AgendaPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())

  const formatted = selectedDate.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          Agenda
        </h1>
        <p className="mt-1 text-sm text-slate-500 capitalize">{formatted}</p>
      </div>

      <AgendaWeekStrip
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />

      <AgendaDayView date={selectedDate} />
    </div>
  )
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/domain/scheduling/agenda-day-view.tsx "src/app/(app)/agenda/page.tsx"
git commit -m "feat(agenda): vista semanal com AgendaWeekStrip — clicar no dia exibe agendamentos"
```

---

### Task 7: Frontend — horários de expediente em /configuracoes

**Files:**
- Create: `src/hooks/settings/use-business-hours.ts`
- Create: `src/components/domain/settings/business-hours-form.tsx`
- Modify: `src/app/(app)/configuracoes/page.tsx`

- [ ] **Step 1: Criar hook use-business-hours**

Criar `src/hooks/settings/use-business-hours.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export type DayConfig = {
  open: string
  close: string
  active: boolean
}

export type BusinessHours = Record<string, DayConfig>

const DAY_LABELS: Record<string, string> = {
  '1': 'Segunda', '2': 'Terça', '3': 'Quarta',
  '4': 'Quinta', '5': 'Sexta', '6': 'Sábado', '0': 'Domingo',
}

export const DAY_ORDER = ['1', '2', '3', '4', '5', '6', '0']
export { DAY_LABELS }

async function fetchBusinessHours(): Promise<BusinessHours> {
  const res = await fetch('/api/iam/tenant/business-hours')
  if (!res.ok) throw new Error('Falha ao carregar horários')
  return res.json()
}

async function updateBusinessHours(hours: BusinessHours): Promise<BusinessHours> {
  const res = await fetch('/api/iam/tenant/business-hours', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(hours),
  })
  if (!res.ok) throw new Error('Falha ao salvar horários')
  return res.json()
}

export function useBusinessHours() {
  return useQuery({
    queryKey: ['business-hours'],
    queryFn: fetchBusinessHours,
    staleTime: 60 * 1000,
  })
}

export function useUpdateBusinessHours() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateBusinessHours,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['business-hours'] }),
  })
}
```

- [ ] **Step 2: Criar BusinessHoursForm**

Criar `src/components/domain/settings/business-hours-form.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  useBusinessHours,
  useUpdateBusinessHours,
  DAY_ORDER,
  DAY_LABELS,
  type BusinessHours,
} from '@/hooks/settings/use-business-hours'

export function BusinessHoursForm() {
  const { data, isLoading } = useBusinessHours()
  const { mutate, isPending } = useUpdateBusinessHours()
  const [hours, setHours] = useState<BusinessHours>({})

  useEffect(() => {
    if (data) setHours(data)
  }, [data])

  function setDay(day: string, field: 'open' | 'close' | 'active', value: string | boolean) {
    setHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    mutate(hours)
  }

  if (isLoading) return <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {DAY_ORDER.map((day) => {
        const cfg = hours[day]
        if (!cfg) return null
        return (
          <div
            key={day}
            className="flex items-center gap-4 rounded-2xl border border-white/80 bg-white/85 px-4 py-3"
          >
            <Switch
              checked={cfg.active}
              onCheckedChange={(v) => setDay(day, 'active', v)}
              id={`day-${day}`}
            />
            <Label
              htmlFor={`day-${day}`}
              className="w-20 text-sm font-medium text-slate-700"
            >
              {DAY_LABELS[day]}
            </Label>
            <div className={`flex items-center gap-2 transition-opacity ${cfg.active ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
              <Input
                type="time"
                value={cfg.open}
                onChange={(e) => setDay(day, 'open', e.target.value)}
                className="w-28"
              />
              <span className="text-slate-400">até</span>
              <Input
                type="time"
                value={cfg.close}
                onChange={(e) => setDay(day, 'close', e.target.value)}
                className="w-28"
              />
            </div>
            {!cfg.active && (
              <span className="ml-auto text-xs text-slate-400">Fechado</span>
            )}
          </div>
        )
      })}

      <Button type="submit" disabled={isPending} className="w-full sm:w-auto mt-2">
        {isPending ? 'Salvando...' : 'Salvar horários'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 3: Adicionar aba Horários em /configuracoes**

Em `src/app/(app)/configuracoes/page.tsx`, adicionar a import:

```typescript
import { BusinessHoursForm } from '@/components/domain/settings/business-hours-form'
```

Alterar o `TabsList` para ter 4 colunas:

```tsx
<TabsList className="grid w-full grid-cols-4">
  <TabsTrigger value="negocio">Negócio</TabsTrigger>
  <TabsTrigger value="horarios">Horários</TabsTrigger>
  <TabsTrigger value="servicos">Serviços</TabsTrigger>
  <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
</TabsList>
```

Adicionar o `TabsContent` para horários após o de negócio:

```tsx
<TabsContent value="horarios" className="mt-6">
  <div className="rounded-2xl border border-white/80 bg-white/85 p-6 shadow-sm">
    <h2 className="mb-4 text-base font-semibold text-slate-950">
      Horários de expediente
    </h2>
    <p className="mb-4 text-sm text-slate-500">
      Configure os dias e horários em que seu negócio está aberto. Esses horários definem os slots disponíveis para agendamento.
    </p>
    <BusinessHoursForm />
  </div>
</TabsContent>
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/hooks/settings/use-business-hours.ts src/components/domain/settings/business-hours-form.tsx "src/app/(app)/configuracoes/page.tsx"
git commit -m "feat(settings): horarios de expediente com grade semanal em /configuracoes"
```

---

### Task 8: Frontend — modal de agendamento reescrito

**Files:**
- Create: `src/hooks/scheduling/use-availability.ts`
- Modify: `src/components/domain/scheduling/create-appointment-modal.tsx`

- [ ] **Step 1: Criar hook useAvailableSlots**

Criar `src/hooks/scheduling/use-availability.ts`:

```typescript
import { useQuery } from '@tanstack/react-query'

export type TimeSlot = {
  time: string
  available: boolean
}

async function fetchSlots(
  professionalId: string,
  date: string,
  serviceId: string,
): Promise<TimeSlot[]> {
  const url = new URL('/api/scheduling/availability', window.location.origin)
  url.searchParams.set('professionalId', professionalId)
  url.searchParams.set('date', date)
  url.searchParams.set('serviceId', serviceId)
  const res = await fetch(url)
  if (!res.ok) throw new Error('Falha ao carregar horários')
  const data: { slots: TimeSlot[] } = await res.json()
  return data.slots
}

export function useAvailableSlots(
  professionalId: string | null,
  date: string | null,
  serviceId: string | null,
) {
  return useQuery({
    queryKey: ['availability', professionalId, date, serviceId],
    queryFn: () => fetchSlots(professionalId!, date!, serviceId!),
    enabled: !!(professionalId && date && serviceId),
    staleTime: 30 * 1000,
  })
}
```

- [ ] **Step 2: Reescrever CreateAppointmentModal**

Substituir **todo** o conteúdo de `src/components/domain/scheduling/create-appointment-modal.tsx` por:

```tsx
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useServices } from '@/hooks/scheduling/use-services'
import { useCustomersSearch } from '@/hooks/crm/use-customers-search'
import { useCreateAppointment } from '@/hooks/scheduling/use-appointments'
import { useAvailableSlots } from '@/hooks/scheduling/use-availability'
import { useTeamMembers } from '@/hooks/iam/use-team'
import { useCurrentUser } from '@/hooks/use-current-user'
import { usePermissions } from '@/hooks/use-permissions'

type Props = {
  open: boolean
  onClose: () => void
  defaultDate?: string
}

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function CreateAppointmentModal({ open, onClose, defaultDate }: Props) {
  const { data: currentUser } = useCurrentUser()
  const { can } = usePermissions()
  const { data: services = [] } = useServices()
  const { data: teamMembers = [] } = useTeamMembers()
  const createAppointment = useCreateAppointment()

  const canManage = can('appointments:edit')

  const [professionalId, setProfessionalId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [date, setDate] = useState(defaultDate ?? toDateInput(new Date()))
  const [selectedTime, setSelectedTime] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [allowOverlap, setAllowOverlap] = useState(false)

  const { data: customers = [], isLoading: searchingCustomers } =
    useCustomersSearch(customerSearch)

  const { data: slots = [], isLoading: loadingSlots } = useAvailableSlots(
    professionalId || null,
    date || null,
    serviceId || null,
  )

  // Inicializa profissional como o próprio usuário se não for OWNER/MANAGER
  useEffect(() => {
    if (currentUser && !canManage) {
      setProfessionalId(currentUser.id)
    }
  }, [currentUser, canManage])

  useEffect(() => {
    if (defaultDate) setDate(defaultDate)
  }, [defaultDate])

  // Limpa o horário selecionado ao trocar profissional, data ou serviço
  useEffect(() => {
    setSelectedTime('')
  }, [professionalId, date, serviceId])

  function handleClose() {
    setProfessionalId(canManage ? '' : (currentUser?.id ?? ''))
    setServiceId('')
    setDate(toDateInput(new Date()))
    setSelectedTime('')
    setCustomerSearch('')
    setCustomerId('')
    setAllowOverlap(false)
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!customerId || !serviceId || !professionalId || !date || !selectedTime) return

    const startsAt = new Date(`${date}T${selectedTime}:00`).toISOString()

    createAppointment.mutate(
      {
        customerId,
        professionalId,
        serviceId,
        startsAt,
        allowOverlap,
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
  const selectedCustomer = customers.find((c) => c.id === customerId)
  const professionals = teamMembers.filter((m) =>
    ['OWNER', 'MANAGER', 'PROFESSIONAL'].includes(m.role),
  )

  const visibleSlots = allowOverlap ? slots : slots.filter((s) => s.available)
  const isFormValid = customerId && serviceId && professionalId && date && selectedTime

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Profissional — só OWNER/MANAGER escolhem */}
          {canManage && (
            <div className="space-y-2">
              <Label>Profissional</Label>
              <Select value={professionalId} onValueChange={setProfessionalId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar profissional" />
                </SelectTrigger>
                <SelectContent>
                  {professionals.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Serviço */}
          <div className="space-y-2">
            <Label>Serviço</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
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

          {/* Data */}
          <div className="space-y-2">
            <Label htmlFor="apt-date">Data</Label>
            <Input
              id="apt-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          {/* Slots de horário */}
          {professionalId && serviceId && date && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Horário</Label>
                {canManage && (
                  <div className="flex items-center gap-2">
                    <Switch
                      id="allow-overlap"
                      checked={allowOverlap}
                      onCheckedChange={setAllowOverlap}
                    />
                    <Label htmlFor="allow-overlap" className="text-xs text-slate-500 cursor-pointer">
                      Autorizar conflito
                    </Label>
                  </div>
                )}
              </div>

              {loadingSlots ? (
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 rounded-xl" />
                  ))}
                </div>
              ) : visibleSlots.length === 0 ? (
                <p className="text-sm text-slate-500 py-2">
                  Nenhum horário disponível neste dia.
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {visibleSlots.map((slot) => (
                    <button
                      key={slot.time}
                      type="button"
                      onClick={() => setSelectedTime(slot.time)}
                      className={cn(
                        'rounded-xl border px-2 py-2 text-sm font-medium transition',
                        selectedTime === slot.time
                          ? 'border-rose-500 bg-rose-50 text-rose-700'
                          : slot.available
                          ? 'border-slate-200 bg-white text-slate-700 hover:border-rose-300 hover:bg-rose-50'
                          : 'border-slate-200 bg-slate-50 text-slate-400 line-through',
                      )}
                    >
                      {slot.time}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Cliente */}
          <div className="space-y-2">
            <Label>Cliente</Label>
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={selectedCustomer ? selectedCustomer.name : customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value)
                setCustomerId('')
              }}
            />
            {customerSearch.length >= 2 && !customerId && (
              <div className="rounded-xl border bg-white shadow-sm max-h-40 overflow-y-auto">
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
                        setCustomerId(c.id)
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

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!isFormValid || createAppointment.isPending}
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

- [ ] **Step 3: Atualizar useCreateAppointment para passar allowOverlap**

Verificar `src/hooks/scheduling/use-appointments.ts`. A função `createAppointment` (ou `useCreateAppointment`) precisa aceitar `allowOverlap` no input. O tipo `CreateAppointmentInput` já foi atualizado na Task 4. Confirmar que o hook passa os dados do input diretamente para o body da requisição sem filtrar campos — se filtrar, adicionar `allowOverlap`.

- [ ] **Step 4: Verificar TypeScript completo**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/scheduling/use-availability.ts src/components/domain/scheduling/create-appointment-modal.tsx src/hooks/scheduling/use-appointments.ts
git commit -m "feat(scheduling): modal de agendamento com seletor de profissional, slots disponíveis e toggle de conflito"
```

---

### Task 9: PR, review e merge

**Files:** nenhum novo

- [ ] **Step 1: Verificação final de TypeScript e build**

```bash
npx tsc --noEmit && npx next build 2>&1 | tail -20
```

Esperado: build limpo.

- [ ] **Step 2: Push e PR**

```bash
git push origin feat/fase1-agenda-disponibilidade
```

Abrir PR em: `https://github.com/AdemilsonB/estetica-saas/pull/new/feat/fase1-agenda-disponibilidade`

Título: `feat: finaliza fase 1 — agenda semanal, disponibilidade de slots, lembrete 24h e horários de expediente`

Descrição deve cobrir:
- Agenda semanal com strip de navegação
- Seletor de profissional no modal
- Slots de horário baseados em expediente e conflitos
- Toggle "Autorizar conflito" para OWNER/MANAGER
- Lembrete automático 24h antes via pg-boss
- Aba Horários em /configuracoes
- `.env.example` atualizado com ZAPI_CLIENT_TOKEN

- [ ] **Step 3: Merge na main**

Após revisão, mergear a PR.
