# Agenda Operacional — Grupo A — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar atalho de remarcação com notificação ao cliente via WhatsApp, marcação de NO_SHOW com contador no perfil do cliente, e exibição/edição de observações do cliente na agenda e no CRM.

**Architecture:** Backend-first por feature (evento → repository → service → API route → notificação), depois frontend do mais simples ao mais complexo. Cada task produz código funcional e testável independentemente. Segue TDD: teste falha → implementação → teste passa → commit.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Prisma, Zod, Vitest + vitest-mock-extended, TanStack Query, Shadcn UI, EventBus interno em `src/shared/events/`.

---

## Mapa de arquivos

### Criados
- `src/app/api/scheduling/appointments/[appointmentId]/route.ts` — PATCH endpoint para reagendar
- `src/components/domain/scheduling/reschedule-modal.tsx` — modal de remarcação
- `src/domains/scheduling/scheduling.service.update.test.ts` — testes de `updateAppointment`
- `src/domains/crm/customer.repository.stats.test.ts` — testes de `findByIdWithStats`

### Modificados
- `src/shared/events/domain-events.ts` — novo evento + novo erro
- `src/shared/errors/domain-error.ts` — `AppointmentAlreadyCancelledError`
- `src/domains/scheduling/appointment.repository.ts` — método `update()` + `excludeId` no overlap
- `src/domains/scheduling/availability.service.ts` — `ensureSlotAvailableExcluding()`
- `src/domains/scheduling/scheduling.service.ts` — método `updateAppointment()`
- `src/domains/scheduling/types.ts` — `updateAppointmentSchema` + `UpdateAppointmentInput`
- `src/domains/notifications/subscriptions.ts` — subscription `scheduling.appointment.rescheduled`
- `src/domains/crm/customer.repository.ts` — método `findByIdWithStats()`
- `src/domains/crm/customer.service.ts` — `getProfile()` retorna `noShowCount`
- `src/hooks/scheduling/use-appointments.ts` — tipo `Appointment` com `customer.notes` + `useRescheduleAppointment`
- `src/components/domain/scheduling/appointment-card.tsx` — prop `onReschedule` + botão
- `src/components/domain/scheduling/appointment-drawer.tsx` — `customer.notes` somente leitura
- `src/components/domain/scheduling/agenda-day-view.tsx` — estado `reschedulingAppointment` + modal
- `src/components/domain/crm/customer-profile-header.tsx` — chip de NO_SHOW
- `src/app/(app)/clientes/[id]/page.tsx` — aba "Observações" com textarea editável

---

## Task 1: Registrar evento `scheduling.appointment.rescheduled` e erro `AppointmentAlreadyCancelledError`

**Files:**
- Modify: `src/shared/events/domain-events.ts`
- Modify: `src/shared/errors/domain-error.ts`

- [ ] **Step 1: Adicionar `AppointmentAlreadyCancelledError` em `domain-error.ts`**

Abra `src/shared/errors/domain-error.ts` e adicione após `AppointmentNotFoundError`:

```typescript
export class AppointmentAlreadyCancelledError extends DomainError {
  constructor() {
    super(
      "Agendamento não pode ser remarcado com o status atual.",
      "APPOINTMENT_NOT_RESCHEDULABLE",
      422,
    );
  }
}
```

- [ ] **Step 2: Adicionar tipo `RescheduledEventPayload` e evento em `domain-events.ts`**

Abra `src/shared/events/domain-events.ts`. Adicione o novo tipo antes de `DomainEvent` e adicione o evento na union:

```typescript
// Adicionar antes de `export type DomainEvent`
type RescheduledEventPayload = {
  tenantId: string;
  appointmentId: string;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  serviceName: string;
  professionalName: string;
  oldStartsAt: Date;
  newStartsAt: Date;
  newEndsAt: Date;
  notificationMessage: string;
};
```

Na union `DomainEvent`, adicione após `scheduling.appointment.no_show`:

```typescript
  | {
      type: "scheduling.appointment.rescheduled";
      payload: RescheduledEventPayload;
    }
```

- [ ] **Step 3: Verificar compilação**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 4: Commit**

```bash
git add src/shared/events/domain-events.ts src/shared/errors/domain-error.ts
git commit -m "feat(events): adiciona evento scheduling.appointment.rescheduled e AppointmentAlreadyCancelledError"
```

---

## Task 2: Estender `AppointmentRepository` com `update()` e suporte a `excludeId` no overlap

**Files:**
- Modify: `src/domains/scheduling/appointment.repository.ts`

- [ ] **Step 1: Adicionar parâmetro `excludeId` em `findOverlappingForProfessional`**

Abra `src/domains/scheduling/appointment.repository.ts`. Substitua o método `findOverlappingForProfessional` pelo código abaixo:

```typescript
async findOverlappingForProfessional(
  tenantId: string,
  professionalId: string,
  startsAt: Date,
  endsAt: Date,
  excludeId?: string,
) {
  return prisma.appointment.findFirst({
    where: {
      tenantId,
      professionalId,
      ...(excludeId && { id: { not: excludeId } }),
      status: {
        in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED],
      },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
  });
}
```

- [ ] **Step 2: Adicionar método `update()` no `AppointmentRepository`**

Logo abaixo de `updateStatus`, adicione:

```typescript
async update(
  tenantId: string,
  id: string,
  data: {
    startsAt?: Date;
    endsAt?: Date;
    professionalId?: string;
    serviceId?: string;
  },
) {
  await prisma.appointment.updateMany({
    where: { id, tenantId },
    data,
  });
  return prisma.appointment.findFirstOrThrow({
    where: { id, tenantId },
    include: {
      customer: true,
      professional: true,
      service: true,
    },
  });
}
```

- [ ] **Step 3: Verificar compilação**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 4: Commit**

```bash
git add src/domains/scheduling/appointment.repository.ts
git commit -m "feat(scheduling): AppointmentRepository.update() e excludeId no overlap check"
```

---

## Task 3: Adicionar `updateAppointmentSchema` em `scheduling/types.ts`

**Files:**
- Modify: `src/domains/scheduling/types.ts`

- [ ] **Step 1: Adicionar schema e tipo**

Abra `src/domains/scheduling/types.ts`. Adicione ao final do arquivo:

```typescript
export const updateAppointmentSchema = z
  .object({
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    professionalId: z.string().uuid().optional(),
    serviceId: z.string().cuid().optional(),
    notificationMessage: z.string().min(1).max(1000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Informe ao menos um campo para atualizar.");

export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
```

- [ ] **Step 2: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/domains/scheduling/types.ts
git commit -m "feat(scheduling): updateAppointmentSchema e UpdateAppointmentInput"
```

---

## Task 4: Adicionar `ensureSlotAvailableExcluding()` ao `AvailabilityService`

**Files:**
- Modify: `src/domains/scheduling/availability.service.ts`

- [ ] **Step 1: Adicionar método `ensureSlotAvailableExcluding`**

Abra `src/domains/scheduling/availability.service.ts`. Adicione o método abaixo de `ensureSlotAvailable`:

```typescript
async ensureSlotAvailableExcluding(
  tenantId: string,
  professionalId: string,
  startsAt: Date,
  endsAt: Date,
  excludeAppointmentId: string,
) {
  const overlapping = await appointmentRepository.findOverlappingForProfessional(
    tenantId,
    professionalId,
    startsAt,
    endsAt,
    excludeAppointmentId,
  );
  if (overlapping) {
    throw new SlotUnavailableError();
  }
}
```

- [ ] **Step 2: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/domains/scheduling/availability.service.ts
git commit -m "feat(scheduling): AvailabilityService.ensureSlotAvailableExcluding()"
```

---

## Task 5: Implementar `updateAppointment()` no `SchedulingService` (TDD)

**Files:**
- Create: `src/domains/scheduling/scheduling.service.update.test.ts`
- Modify: `src/domains/scheduling/scheduling.service.ts`

- [ ] **Step 1: Escrever os testes**

Crie o arquivo `src/domains/scheduling/scheduling.service.update.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppointmentStatus } from "@prisma/client";
import { prismaMock } from "@/shared/test/prisma-mock";
import { eventBus } from "@/shared/events/event-bus";
import { SchedulingService } from "./scheduling.service";
import { AppointmentNotFoundError, AppointmentAlreadyCancelledError, SlotUnavailableError } from "@/shared/errors";

vi.mock("@/shared/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/shared/events/event-bus", () => ({
  eventBus: { publish: vi.fn(), subscribe: vi.fn() },
}));
vi.mock("./availability.service", () => ({
  availabilityService: {
    ensureSlotAvailable: vi.fn(),
    ensureSlotAvailableExcluding: vi.fn(),
  },
}));
vi.mock("./appointment.repository", () => ({
  appointmentRepository: {
    findById: vi.fn(),
    update: vi.fn(),
    countThisMonth: vi.fn(),
    create: vi.fn(),
    updateStatus: vi.fn(),
  },
}));
vi.mock("@/domains/billing/feature-guard", () => ({
  featureGuard: { assertWithinLimit: vi.fn() },
}));
vi.mock("@/shared/queue/jobs/appointment-reminder", () => ({
  scheduleAppointmentReminder: vi.fn(),
  cancelAppointmentReminder: vi.fn(),
}));

import { appointmentRepository } from "./appointment.repository";
import { availabilityService } from "./availability.service";

const mockAppointment = {
  id: "appt-1",
  tenantId: "tenant-1",
  customerId: "cust-1",
  professionalId: "prof-1",
  serviceId: "svc-1",
  startsAt: new Date("2026-06-10T10:00:00Z"),
  endsAt: new Date("2026-06-10T11:00:00Z"),
  status: AppointmentStatus.SCHEDULED,
  notes: null,
  allowOverlap: false,
  price: 100,
  createdByUserId: "user-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  customer: { id: "cust-1", name: "Ana Lima", phone: "+5511999999999", email: null },
  professional: { id: "prof-1", name: "Paula", email: "paula@test.com" },
  service: { id: "svc-1", name: "Corte", duration: 60 },
};

describe("SchedulingService.updateAppointment", () => {
  let service: SchedulingService;

  beforeEach(() => {
    service = new SchedulingService();
    vi.clearAllMocks();
  });

  it("lança AppointmentNotFoundError quando agendamento não existe", async () => {
    vi.mocked(appointmentRepository.findById).mockResolvedValue(null);

    await expect(
      service.updateAppointment("tenant-1", "appt-999", {
        startsAt: "2026-06-11T10:00:00Z",
        endsAt: "2026-06-11T11:00:00Z",
        notificationMessage: "Olá, remarcamos!",
      }),
    ).rejects.toThrow(AppointmentNotFoundError);
  });

  it("lança AppointmentAlreadyCancelledError quando status é CANCELLED", async () => {
    vi.mocked(appointmentRepository.findById).mockResolvedValue({
      ...mockAppointment,
      status: AppointmentStatus.CANCELLED,
    } as never);

    await expect(
      service.updateAppointment("tenant-1", "appt-1", {
        startsAt: "2026-06-11T10:00:00Z",
        endsAt: "2026-06-11T11:00:00Z",
        notificationMessage: "Olá!",
      }),
    ).rejects.toThrow(AppointmentAlreadyCancelledError);
  });

  it("lança SlotUnavailableError quando novo horário está ocupado", async () => {
    vi.mocked(appointmentRepository.findById).mockResolvedValue(mockAppointment as never);
    vi.mocked(availabilityService.ensureSlotAvailableExcluding).mockRejectedValue(
      new SlotUnavailableError(),
    );

    await expect(
      service.updateAppointment("tenant-1", "appt-1", {
        startsAt: "2026-06-11T10:00:00Z",
        endsAt: "2026-06-11T11:00:00Z",
        notificationMessage: "Olá!",
      }),
    ).rejects.toThrow(SlotUnavailableError);
  });

  it("atualiza agendamento e publica evento scheduling.appointment.rescheduled", async () => {
    const updated = { ...mockAppointment, startsAt: new Date("2026-06-11T10:00:00Z") };
    vi.mocked(appointmentRepository.findById).mockResolvedValue(mockAppointment as never);
    vi.mocked(availabilityService.ensureSlotAvailableExcluding).mockResolvedValue();
    vi.mocked(appointmentRepository.update).mockResolvedValue(updated as never);

    await service.updateAppointment("tenant-1", "appt-1", {
      startsAt: "2026-06-11T10:00:00Z",
      endsAt: "2026-06-11T11:00:00Z",
      notificationMessage: "Olá, Ana! Seu agendamento foi remarcado.",
    });

    expect(appointmentRepository.update).toHaveBeenCalledWith(
      "tenant-1",
      "appt-1",
      expect.objectContaining({ startsAt: new Date("2026-06-11T10:00:00Z") }),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: "scheduling.appointment.rescheduled" }),
    );
  });
});
```

- [ ] **Step 2: Rodar os testes para confirmar que falham**

```bash
npx vitest run src/domains/scheduling/scheduling.service.update.test.ts
```

Esperado: falha em todos os testes (`updateAppointment is not a function`).

- [ ] **Step 3: Implementar `updateAppointment()` no `SchedulingService`**

Abra `src/domains/scheduling/scheduling.service.ts`.

1. Adicione os imports necessários no topo, junto aos existentes:

```typescript
import {
  AppointmentNotFoundError,
  AppointmentAlreadyCancelledError,
  // ...imports que já existem...
} from "@/shared/errors";
import type { UpdateAppointmentInput } from "./types";
```

2. Adicione o método `updateAppointment` na classe `SchedulingService`, após `updateAppointmentStatus`:

```typescript
async updateAppointment(
  tenantId: string,
  appointmentId: string,
  input: UpdateAppointmentInput,
) {
  const current = await appointmentRepository.findById(tenantId, appointmentId);
  if (!current) throw new AppointmentNotFoundError();

  const nonReschedulable: AppointmentStatus[] = [
    AppointmentStatus.CANCELLED,
    AppointmentStatus.COMPLETED,
    AppointmentStatus.NO_SHOW,
  ];
  if (nonReschedulable.includes(current.status)) {
    throw new AppointmentAlreadyCancelledError();
  }

  const newStartsAt = input.startsAt ? new Date(input.startsAt) : current.startsAt;
  const newEndsAt = input.endsAt ? new Date(input.endsAt) : current.endsAt;
  const newProfessionalId = input.professionalId ?? current.professionalId;

  const timeOrProfessionalChanged =
    input.startsAt !== undefined ||
    input.endsAt !== undefined ||
    input.professionalId !== undefined;

  if (timeOrProfessionalChanged) {
    await availabilityService.ensureSlotAvailableExcluding(
      tenantId,
      newProfessionalId,
      newStartsAt,
      newEndsAt,
      appointmentId,
    );
  }

  const updated = await appointmentRepository.update(tenantId, appointmentId, {
    startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
    endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
    professionalId: input.professionalId,
    serviceId: input.serviceId,
  });

  eventBus.publish({
    type: "scheduling.appointment.rescheduled",
    payload: {
      tenantId,
      appointmentId: updated.id,
      customerId: updated.customerId,
      customerName: current.customer.name,
      customerPhone: current.customer.phone,
      serviceName: current.service.name,
      professionalName: updated.professional.name,
      oldStartsAt: current.startsAt,
      newStartsAt: updated.startsAt,
      newEndsAt: updated.endsAt,
      notificationMessage: input.notificationMessage ?? "",
    },
  });

  return updated;
}
```

- [ ] **Step 4: Rodar os testes para confirmar que passam**

```bash
npx vitest run src/domains/scheduling/scheduling.service.update.test.ts
```

Esperado: todos os 4 testes passam.

- [ ] **Step 5: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/domains/scheduling/scheduling.service.ts src/domains/scheduling/scheduling.service.update.test.ts
git commit -m "feat(scheduling): SchedulingService.updateAppointment() com validação, overlap e evento"
```

---

## Task 6: Criar API Route `PATCH /api/scheduling/appointments/[appointmentId]`

**Files:**
- Create: `src/app/api/scheduling/appointments/[appointmentId]/route.ts`

> Atenção: o arquivo `status/route.ts` já existe em `[appointmentId]/status/route.ts`. Este novo arquivo fica um nível acima, em `[appointmentId]/route.ts`.

- [ ] **Step 1: Criar o arquivo da route**

Crie `src/app/api/scheduling/appointments/[appointmentId]/route.ts`:

```typescript
import { schedulingService } from "@/domains/scheduling/scheduling.service";
import { updateAppointmentSchema } from "@/domains/scheduling/types";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";

type RouteContext = {
  params: Promise<{ appointmentId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.appointments.edit);
    const { appointmentId } = await context.params;
    const input = await validateInput(request, updateAppointmentSchema);
    const appointment = await schedulingService.updateAppointment(
      session.tenantId,
      appointmentId,
      input,
    );
    return Response.json(appointment);
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 2: Verificar que a permission key existe**

Abra `src/shared/auth/permissions.ts` (ou onde `PERMISSIONS` está definido) e confirme que `PERMISSIONS.appointments.edit` existe. Se a chave for diferente (ex: `appointments.edit`), ajuste o código acima.

- [ ] **Step 3: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/scheduling/appointments/[appointmentId]/route.ts
git commit -m "feat(api): PATCH /api/scheduling/appointments/[appointmentId] para reagendar"
```

---

## Task 7: Adicionar subscription de notificação para remarcação

**Files:**
- Modify: `src/domains/notifications/subscriptions.ts`

- [ ] **Step 1: Adicionar subscription `scheduling.appointment.rescheduled`**

Abra `src/domains/notifications/subscriptions.ts` e adicione a subscription abaixo de `scheduling.appointment.no_show`, dentro de `registerNotificationSubscriptions()`:

```typescript
eventBus.subscribe("scheduling.appointment.rescheduled", async (payload) => {
  if (!payload.customerPhone) return;
  await notificationService.logAndDispatch({
    tenantId: payload.tenantId,
    appointmentId: payload.appointmentId,
    channel: NotificationChannel.WHATSAPP,
    template: "appointment-rescheduled",
    recipient: payload.customerPhone,
    provider: "whatsapp",
    payload: {
      message: payload.notificationMessage,
      appointmentId: payload.appointmentId,
      customerName: payload.customerName,
      newStartsAt: payload.newStartsAt.toISOString(),
    },
  });
});
```

> **Nota para o implementador:** O gateway WhatsApp (`src/domains/notifications/providers/whatsapp.gateway.ts`) precisa lidar com o template `"appointment-rescheduled"`. Verifique como os outros templates são tratados no gateway e adicione o handler para esse template que usa `payload.message` como corpo da mensagem WhatsApp diretamente (mensagem já foi renderizada e validada pelo operador no frontend).

- [ ] **Step 2: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/domains/notifications/subscriptions.ts
git commit -m "feat(notifications): subscription scheduling.appointment.rescheduled com notificação WhatsApp"
```

---

## Task 8: Adicionar `findByIdWithStats()` ao `CustomerRepository` e atualizar `getProfile()`

**Files:**
- Create: `src/domains/crm/customer.repository.stats.test.ts`
- Modify: `src/domains/crm/customer.repository.ts`
- Modify: `src/domains/crm/customer.service.ts`

- [ ] **Step 1: Escrever o teste para `findByIdWithStats`**

Crie `src/domains/crm/customer.repository.stats.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { prismaMock } from "@/shared/test/prisma-mock";
import { CustomerRepository } from "./customer.repository";

vi.mock("@/shared/database/prisma", () => ({ prisma: prismaMock }));

describe("CustomerRepository.findByIdWithStats", () => {
  it("retorna noShowCount calculado via _count", async () => {
    const mockResult = {
      id: "cust-1",
      tenantId: "tenant-1",
      name: "Ana Lima",
      phone: "+5511999999999",
      email: null,
      notes: "Cliente VIP",
      tags: [],
      consentGiven: false,
      consentDate: null,
      consentOrigin: null,
      birthDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      appointments: [],
      _count: { appointments: 2 },
    };

    prismaMock.customer.findFirst.mockResolvedValue(mockResult as never);

    const repo = new CustomerRepository();
    const result = await repo.findByIdWithStats("tenant-1", "cust-1");

    expect(result).not.toBeNull();
    expect(result!._count.appointments).toBe(2);
    expect(prismaMock.customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cust-1", tenantId: "tenant-1" },
      }),
    );
  });

  it("retorna null quando cliente não existe", async () => {
    prismaMock.customer.findFirst.mockResolvedValue(null);
    const repo = new CustomerRepository();
    const result = await repo.findByIdWithStats("tenant-1", "nao-existe");
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

```bash
npx vitest run src/domains/crm/customer.repository.stats.test.ts
```

Esperado: falha (`findByIdWithStats is not a function`).

- [ ] **Step 3: Adicionar `findByIdWithStats()` ao `CustomerRepository`**

Abra `src/domains/crm/customer.repository.ts`. Adicione o método após `findWithAppointments`:

```typescript
async findByIdWithStats(tenantId: string, customerId: string) {
  return prisma.customer.findFirst({
    where: { id: customerId, tenantId },
    include: {
      appointments: {
        include: {
          service: { select: { id: true, name: true } },
          professional: { select: { id: true, name: true } },
        },
        orderBy: { startsAt: "desc" },
        take: 50,
      },
      _count: {
        select: {
          appointments: {
            where: { status: "NO_SHOW" },
          },
        },
      },
    },
  });
}
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

```bash
npx vitest run src/domains/crm/customer.repository.stats.test.ts
```

Esperado: 2 testes passando.

- [ ] **Step 5: Atualizar `CustomerService.getProfile()` para usar `findByIdWithStats`**

Abra `src/domains/crm/customer.service.ts`. Substitua o método `getProfile`:

```typescript
async getProfile(tenantId: string, customerId: string) {
  const profile = await customerRepository.findByIdWithStats(tenantId, customerId);
  if (!profile) throw new CustomerNotFoundError();

  const { _count, ...rest } = profile;
  return {
    ...rest,
    noShowCount: _count.appointments,
  };
}
```

- [ ] **Step 6: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add src/domains/crm/customer.repository.ts src/domains/crm/customer.service.ts src/domains/crm/customer.repository.stats.test.ts
git commit -m "feat(crm): CustomerRepository.findByIdWithStats() e noShowCount no getProfile"
```

---

## Task 9: Atualizar tipo `Appointment` no hook e adicionar `useRescheduleAppointment`

**Files:**
- Modify: `src/hooks/scheduling/use-appointments.ts`

- [ ] **Step 1: Adicionar `notes` ao tipo `customer` dentro de `Appointment`**

Abra `src/hooks/scheduling/use-appointments.ts`. Altere o tipo `Appointment`:

```typescript
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
  customer: { id: string; name: string; phone: string | null; notes: string | null }  // ← adicionar notes
  professional: { id: string; name: string }
  service: { id: string; name: string; duration: number }
}
```

- [ ] **Step 2: Adicionar tipo `UpdateAppointmentInput` e função `updateAppointment`**

Adicione após o tipo `CreateAppointmentInput`:

```typescript
export type UpdateAppointmentInput = {
  startsAt?: string
  endsAt?: string
  professionalId?: string
  serviceId?: string
  notificationMessage?: string
}
```

Adicione a função antes dos hooks:

```typescript
async function rescheduleAppointment(
  id: string,
  data: UpdateAppointmentInput,
): Promise<Appointment> {
  const res = await fetch(`/api/scheduling/appointments/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message ?? 'Falha ao remarcar agendamento')
  }
  return res.json()
}
```

- [ ] **Step 3: Adicionar hook `useRescheduleAppointment`**

Adicione ao final do arquivo:

```typescript
export function useRescheduleAppointment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateAppointmentInput) =>
      rescheduleAppointment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
    },
  })
}
```

- [ ] **Step 4: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/hooks/scheduling/use-appointments.ts
git commit -m "feat(hooks): customer.notes no tipo Appointment e hook useRescheduleAppointment"
```

---

## Task 10: Exibir `customer.notes` no `AppointmentDrawer` (somente leitura)

**Files:**
- Modify: `src/components/domain/scheduling/appointment-drawer.tsx`

- [ ] **Step 1: Adicionar bloco `customer.notes` dentro da seção de informações**

Abra `src/components/domain/scheduling/appointment-drawer.tsx`. Importe `StickyNote` do Lucide no topo junto com os outros ícones (ou adicione o import se não existir):

```typescript
import { StickyNote } from 'lucide-react'
```

No JSX, logo após o bloco de `Horário` e antes de `appointment.notes`, adicione:

```tsx
{appointment.customer.notes && (
  <>
    <Separator />
    <div>
      <p className="text-xs font-medium text-slate-400 uppercase">
        Observações do cliente
      </p>
      <div className="mt-1.5 flex items-start gap-1.5">
        <StickyNote className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
        <p className="text-sm text-slate-600">{appointment.customer.notes}</p>
      </div>
    </div>
  </>
)}
```

> **Nota:** Mantenha o bloco existente de `appointment.notes` como está, renomeando seu label para "Observações do atendimento" para diferenciar visualmente:
> ```tsx
> {appointment.notes && (
>   <>
>     <Separator />
>     <div>
>       <p className="text-xs font-medium text-slate-400 uppercase">Observações do atendimento</p>
>       <p className="mt-0.5 text-sm text-slate-700">{appointment.notes}</p>
>     </div>
>   </>
> )}
> ```

- [ ] **Step 2: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/scheduling/appointment-drawer.tsx
git commit -m "feat(ui): customer.notes somente leitura no AppointmentDrawer"
```

---

## Task 11: Chip de NO_SHOW e aba de observações no perfil do cliente

**Files:**
- Modify: `src/components/domain/crm/customer-profile-header.tsx`
- Modify: `src/app/(app)/clientes/[id]/page.tsx`
- Modify: `src/hooks/crm/use-customer.ts` (verificar e atualizar o tipo de retorno para incluir `noShowCount` e `notes`)

- [ ] **Step 1: Verificar e atualizar o hook `useCustomer`**

Abra `src/hooks/crm/use-customer.ts`. Localize o tipo de retorno e garanta que inclui `noShowCount: number` e `notes: string | null`. Se o tipo for inferido automaticamente do response, não há nada a mudar. Se for explícito, adicione os campos.

- [ ] **Step 2: Adicionar chip de NO_SHOW no `CustomerProfileHeader`**

Abra `src/components/domain/crm/customer-profile-header.tsx`. Adicione o import de `AlertTriangle` do Lucide se não existir:

```typescript
import { AlertTriangle } from 'lucide-react'
```

No JSX do componente, logo abaixo do nome do cliente, adicione condicionalmente o chip (o `customer` prop deve ter `noShowCount`):

```tsx
{customer.noShowCount > 0 && (
  <div
    className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 border border-amber-200"
    title={`Este cliente não compareceu ${customer.noShowCount} ${customer.noShowCount === 1 ? 'vez' : 'vezes'}`}
  >
    <AlertTriangle className="size-3.5" />
    {customer.noShowCount} não comparecimento{customer.noShowCount > 1 ? 's' : ''}
  </div>
)}
```

- [ ] **Step 3: Adicionar aba "Observações" na página de perfil**

Abra `src/app/(app)/clientes/[id]/page.tsx`. 

1. Adicione os imports necessários:

```typescript
import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
```

2. Adicione o hook de atualização do cliente (importe ou verifique se existe `useUpdateCustomer` em `src/hooks/crm/`). Se não existir, crie a função inline na página:

```typescript
async function saveCustomerNotes(id: string, notes: string) {
  const res = await fetch(`/api/crm/customers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
  })
  if (!res.ok) throw new Error('Falha ao salvar observações')
  return res.json()
}
```

3. Adicione estado para o textarea **antes dos early returns** de `isLoading`/`isError` (regra dos hooks React — não podem estar após condicionais). Os dois `useState` e o `useEffect` ficam no topo do componente:

```typescript
// ← ANTES de if (isLoading) e if (isError || !customer)
const [notes, setNotes] = useState('')
const [savingNotes, setSavingNotes] = useState(false)

// Sincroniza quando customer carrega (assíncrono)
useEffect(() => {
  if (customer) setNotes(customer.notes ?? '')
}, [customer])

async function handleSaveNotes() {
  setSavingNotes(true)
  try {
    await saveCustomerNotes(id, notes)
    toast.success('Observações salvas')
  } catch {
    toast.error('Erro ao salvar observações')
  } finally {
    setSavingNotes(false)
  }
}
```

4. Adicione a nova aba no `<Tabs>`. Substitua o `<Tabs>` existente:

```tsx
<Tabs defaultValue="historico">
  <TabsList className="w-full">
    <TabsTrigger value="historico" className="flex-1">
      Histórico ({customer.appointments.length})
    </TabsTrigger>
    <TabsTrigger value="observacoes" className="flex-1">
      Observações
    </TabsTrigger>
  </TabsList>
  <TabsContent value="historico" className="mt-4">
    <AppointmentHistory appointments={customer.appointments} />
  </TabsContent>
  <TabsContent value="observacoes" className="mt-4">
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <Label htmlFor="customer-notes" className="text-sm font-medium text-slate-700">
        Observações do cliente
      </Label>
      <Textarea
        id="customer-notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Alergias, preferências, histórico relevante..."
        className="min-h-[120px] resize-none"
      />
      <p className="text-xs text-slate-400">
        Visível no card de agendamento ao atender este cliente.
      </p>
      <Button
        onClick={handleSaveNotes}
        disabled={savingNotes}
        className="bg-slate-950 text-white hover:bg-slate-800"
        size="sm"
      >
        {savingNotes ? 'Salvando...' : 'Salvar observações'}
      </Button>
    </div>
  </TabsContent>
</Tabs>
```

> **Atenção:** Como a página é `'use client'`, o `useState` já está disponível. O `customer.notes` só estará tipado se o hook `useCustomer` retornar `notes`. Verifique isso no Step 1.

- [ ] **Step 4: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/components/domain/crm/customer-profile-header.tsx src/app/(app)/clientes/[id]/page.tsx
git commit -m "feat(crm): chip de NO_SHOW e aba de observações no perfil do cliente"
```

---

## Task 12: Adicionar botão "Remarcar" ao `AppointmentCard`

**Files:**
- Modify: `src/components/domain/scheduling/appointment-card.tsx`

- [ ] **Step 1: Adicionar prop `onReschedule` e botão no card**

Abra `src/components/domain/scheduling/appointment-card.tsx`. Substitua o arquivo inteiro pelo código abaixo:

```typescript
import { CalendarDays } from 'lucide-react'
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

const RESCHEDULABLE_STATUSES: AppointmentStatus[] = ['SCHEDULED', 'CONFIRMED']

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

type Props = {
  appointment: Appointment
  onClick: (appointment: Appointment) => void
  onReschedule?: (appointment: Appointment) => void
}

export function AppointmentCard({ appointment, onClick, onReschedule }: Props) {
  const config = STATUS_CONFIG[appointment.status]
  const canReschedule = RESCHEDULABLE_STATUSES.includes(appointment.status)

  return (
    <div className={cn('relative w-full rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md', config.cardClass)}>
      <button
        onClick={() => onClick(appointment)}
        className="w-full text-left"
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

      {canReschedule && onReschedule && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onReschedule(appointment)
          }}
          title="Remarcar"
          className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <CalendarDays className="size-4" />
        </button>
      )}
    </div>
  )
}
```

> **Nota:** O card principal agora é uma `<div>` com um `<button>` interno para o click de abertura do drawer. O botão de Remarcar fica no canto superior direito, absoluto. `e.stopPropagation()` evita que o clique em Remarcar abra o drawer.

- [ ] **Step 2: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/scheduling/appointment-card.tsx
git commit -m "feat(ui): botão Remarcar no AppointmentCard com ícone CalendarDays"
```

---

## Task 13: Criar `RescheduleModal`

**Files:**
- Create: `src/components/domain/scheduling/reschedule-modal.tsx`

- [ ] **Step 1: Criar o componente `RescheduleModal`**

Crie `src/components/domain/scheduling/reschedule-modal.tsx`:

```typescript
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useAvailableSlots } from '@/hooks/scheduling/use-availability'
import { useTeamMembers } from '@/hooks/iam/use-team'
import { useRescheduleAppointment } from '@/hooks/scheduling/use-appointments'
import type { Appointment } from '@/hooks/scheduling/use-appointments'

const RESCHEDULE_TEMPLATE =
  'Olá, {nome}! Seu agendamento de {serviço} foi remarcado para {data} às {hora} com {profissional}. Qualquer dúvida, estamos à disposição. Te esperamos! 🤍'

function formatDateLabel(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
}

function formatHour(time: string): string {
  return time.replace(':', 'h')
}

function renderTemplate(params: {
  nome: string
  serviço: string
  data: string
  hora: string
  profissional: string
}): string {
  return RESCHEDULE_TEMPLATE.replace('{nome}', params.nome)
    .replace('{serviço}', params.serviço)
    .replace('{data}', params.data)
    .replace('{hora}', params.hora)
    .replace('{profissional}', params.profissional)
}

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10)
}

type Props = {
  appointment: Appointment | null
  open: boolean
  onClose: () => void
}

export function RescheduleModal({ appointment, open, onClose }: Props) {
  const { data: teamMembers = [] } = useTeamMembers()
  const reschedule = useRescheduleAppointment()

  const [professionalId, setProfessionalId] = useState('')
  const [date, setDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (appointment && open) {
      setProfessionalId(appointment.professionalId)
      setDate(toDateInput(new Date(appointment.startsAt)))
      setSelectedTime('')
      setMessage('')
    }
  }, [appointment, open])

  const { data: slots = [], isLoading: loadingSlots } = useAvailableSlots(
    professionalId || null,
    date || null,
    appointment?.serviceId ?? null,
  )

  const professionalName =
    teamMembers.find((m) => m.id === professionalId)?.name ??
    appointment?.professional.name ??
    ''

  useEffect(() => {
    if (!appointment || !selectedTime || !date) return
    setMessage(
      renderTemplate({
        nome: appointment.customer.name.split(' ')[0],
        serviço: appointment.service.name,
        data: formatDateLabel(date),
        hora: formatHour(selectedTime),
        profissional: professionalName,
      }),
    )
  }, [selectedTime, date, professionalName, appointment])

  if (!appointment) return null

  const selectedSlot = slots.find((s) => s.time === selectedTime)
  const serviceDuration = appointment.service.duration
  const canConfirm = selectedTime && selectedSlot?.available

  function handleConfirm() {
    if (!canConfirm || !appointment) return

    const [hour, minute] = selectedTime.split(':').map(Number)
    const newStartsAt = new Date(`${date}T${selectedTime}:00`)
    const newEndsAt = new Date(newStartsAt.getTime() + serviceDuration * 60 * 1000)

    reschedule.mutate(
      {
        id: appointment.id,
        startsAt: newStartsAt.toISOString(),
        endsAt: newEndsAt.toISOString(),
        professionalId,
        notificationMessage: message,
      },
      {
        onSuccess: () => {
          toast.success('Agendamento remarcado com sucesso')
          onClose()
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Erro ao remarcar')
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remarcar agendamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Info somente leitura */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-sm font-semibold text-slate-950">
              {appointment.customer.name}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{appointment.service.name}</p>
          </div>

          {/* Profissional */}
          <div className="space-y-1.5">
            <Label>Profissional</Label>
            <Select value={professionalId} onValueChange={setProfessionalId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um profissional" />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Data */}
          <div className="space-y-1.5">
            <Label>Nova data</Label>
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value)
                setSelectedTime('')
              }}
              min={toDateInput(new Date())}
              className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
            />
          </div>

          {/* Horários */}
          <div className="space-y-1.5">
            <Label>Horário</Label>
            {loadingSlots ? (
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-16 rounded-full" />
                ))}
              </div>
            ) : slots.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum horário disponível nesta data.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot.time}
                    disabled={!slot.available}
                    onClick={() => setSelectedTime(slot.time)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-medium transition',
                      slot.available
                        ? selectedTime === slot.time
                          ? 'border-slate-950 bg-slate-950 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                        : 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300',
                    )}
                  >
                    {formatHour(slot.time)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mensagem */}
          <div className="space-y-1.5">
            <Label>Mensagem enviada ao cliente via WhatsApp</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Selecione um horário para pré-preencher a mensagem..."
              className="min-h-[100px] resize-none text-sm"
            />
            {!appointment.customer.phone && (
              <p className="text-xs text-slate-400">
                Este cliente não tem telefone cadastrado. A mensagem não será enviada.
              </p>
            )}
          </div>

          {/* Botões */}
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={reschedule.isPending}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1 bg-slate-950 text-white hover:bg-slate-800"
              onClick={handleConfirm}
              disabled={!canConfirm || reschedule.isPending}
            >
              {reschedule.isPending ? 'Remarcando...' : 'Confirmar remarcação'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verificar que os hooks importados existem**

Confirme que estes hooks existem:
- `src/hooks/scheduling/use-availability.ts` — exporta `useAvailableSlots(professionalId, date, serviceId)`
- `src/hooks/iam/use-team.ts` — exporta `useTeamMembers()` com campo `id` e `name`

Se os tipos diferirem, ajuste o código do modal para usar os nomes corretos.

- [ ] **Step 3: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/domain/scheduling/reschedule-modal.tsx
git commit -m "feat(ui): RescheduleModal com slot picker, template editável e notificação WhatsApp"
```

---

## Task 14: Integrar `RescheduleModal` no `AgendaDayView` + verificação final

**Files:**
- Modify: `src/components/domain/scheduling/agenda-day-view.tsx`

- [ ] **Step 1: Adicionar import, estado e props no `AgendaDayView`**

Abra `src/components/domain/scheduling/agenda-day-view.tsx`.

1. Adicione o import do `RescheduleModal` no topo:

```typescript
import { RescheduleModal } from './reschedule-modal'
```

2. Dentro do componente `AgendaDayView`, adicione o novo estado após `paymentModalOpen`:

```typescript
const [reschedulingAppointment, setReschedulingAppointment] =
  useState<Appointment | null>(null)
const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false)
```

3. Adicione o handler `handleReschedule`:

```typescript
function handleReschedule(appt: Appointment) {
  setReschedulingAppointment(appt)
  setRescheduleModalOpen(true)
}
```

- [ ] **Step 2: Passar `onReschedule` para `AppointmentCard`**

No JSX, nas duas ocorrências de `<AppointmentCard>` (modo dia e modo semana), adicione a prop:

```tsx
<AppointmentCard
  key={appt.id}
  appointment={appt}
  onClick={handleCardClick}
  onReschedule={handleReschedule}  // ← adicionar
/>
```

- [ ] **Step 3: Adicionar `RescheduleModal` no final do JSX**

Após `<RegisterPaymentModal .../>` e antes do fechamento do fragment/div, adicione:

```tsx
<RescheduleModal
  appointment={reschedulingAppointment}
  open={rescheduleModalOpen}
  onClose={() => {
    setRescheduleModalOpen(false)
    setReschedulingAppointment(null)
  }}
/>
```

- [ ] **Step 4: Verificação final — TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 5: Verificação final — Testes**

```bash
npx vitest run
```

Esperado: todos os testes passando.

- [ ] **Step 6: Commit final**

```bash
git add src/components/domain/scheduling/agenda-day-view.tsx
git commit -m "feat(ui): integra RescheduleModal no AgendaDayView com estado e handler"
```

---

## Task 15: Verificação do gateway WhatsApp para o template `appointment-rescheduled`

**Files:**
- Modify: `src/domains/notifications/providers/whatsapp.gateway.ts` (verificar)

- [ ] **Step 1: Verificar como o gateway renderiza mensagens**

Abra `src/domains/notifications/providers/whatsapp.gateway.ts`. Localize como o `template` e o `payload` são usados para construir o corpo da mensagem WhatsApp.

- [ ] **Step 2: Adicionar handler para `appointment-rescheduled`**

Se o gateway usa um mapa de templates (ex: `switch(template)` ou `templateMap[template]`), adicione o caso `appointment-rescheduled` que usa `payload.message` diretamente como corpo da mensagem:

```typescript
case 'appointment-rescheduled':
  return payload.message as string
```

Se o gateway não usa templates e envia o corpo diretamente (ex: primeiro campo do payload que contenha o texto), ajuste o payload na subscription (Task 7) para que o campo que representa o corpo esteja correto.

- [ ] **Step 3: Verificar compilação e testes**

```bash
npx tsc --noEmit && npx vitest run
```

- [ ] **Step 4: Commit**

```bash
git add src/domains/notifications/providers/whatsapp.gateway.ts
git commit -m "feat(notifications): handler appointment-rescheduled no WhatsApp gateway"
```

---

## Checklist final de entrega

- [ ] `npx tsc --noEmit` — zero erros
- [ ] `npx vitest run` — todos os testes passando
- [ ] Testes de `SchedulingService.updateAppointment` — 4 casos cobrindo: 404, status inválido, slot ocupado, sucesso com evento
- [ ] Testes de `CustomerRepository.findByIdWithStats` — 2 casos cobrindo: retorno com `_count`, null quando não existe
- [ ] Botão "Remarcar" visível apenas para agendamentos SCHEDULED e CONFIRMED
- [ ] `customer.notes` visível no drawer apenas quando não vazio
- [ ] Chip de NO_SHOW visível no perfil apenas quando `noShowCount > 0`
- [ ] `tenantId` em todos os novos endpoints — nunca do body, sempre do JWT
- [ ] PR aberta para `main`
