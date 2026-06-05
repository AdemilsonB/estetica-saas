# WhatsApp Agendamento/Cancelamento + Fix Disponibilidade + Slots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar mensagem WhatsApp editável na criação e no cancelamento de agendamentos, corrigir o bug de timezone na disponibilidade e melhorar a grade de slots com informação de conflito e input de horário personalizado.

**Architecture:** Backend — adicionar `notificationMessage` nos schemas, eventos e subscriptions; Evolution Provider verifica `payload.message` antes de usar template; Availability Service usa timezone do tenant. Frontend — `CreateAppointmentModal` ganha Textarea + input de horário + slots melhorados; novo `CancelAppointmentModal`; `AppointmentDrawer` delega cancelamento para o modal.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Prisma, Zod, TanStack Query, Shadcn UI, Vitest

---

## Mapa de arquivos

| Arquivo | Operação |
|---|---|
| `src/shared/events/domain-events.ts` | Modificar — adiciona `notificationMessage?` em `AppointmentEventPayload` |
| `src/domains/scheduling/types.ts` | Modificar — schemas de criação e status aceitam `notificationMessage?` |
| `src/lib/dates.ts` | Modificar — adiciona helper `localDateTimeToUtc` |
| `src/domains/iam/iam.repository.ts` | Modificar — adiciona `getTenantTimezone` |
| `src/domains/scheduling/availability.service.ts` | Modificar — fix timezone, campo `bookedBy` |
| `src/domains/scheduling/scheduling.service.ts` | Modificar — passa `notificationMessage` nos eventos |
| `src/domains/notifications/subscriptions.ts` | Modificar — repassa `message` quando presente |
| `src/domains/notifications/providers/evolution.provider.ts` | Modificar — shortcut `payload.message` para created/cancelled |
| `src/hooks/scheduling/use-appointments.ts` | Modificar — tipos incluem `notificationMessage?` |
| `src/hooks/scheduling/use-availability.ts` | Modificar — `TimeSlot` ganha `bookedBy?` |
| `src/components/domain/scheduling/create-appointment-modal.tsx` | Modificar — Textarea + custom time + slots melhorados |
| `src/components/domain/scheduling/cancel-appointment-modal.tsx` | Criar — modal de cancelamento com Textarea WhatsApp |
| `src/components/domain/scheduling/appointment-drawer.tsx` | Modificar — delega cancelamento para `CancelAppointmentModal` |

---

## Task 1: Tipos de evento e schemas de domínio

**Files:**
- Modify: `src/shared/events/domain-events.ts`
- Modify: `src/domains/scheduling/types.ts`

- [ ] **Step 1.1: Adicionar `notificationMessage?` ao `AppointmentEventPayload`**

Em `src/shared/events/domain-events.ts`, localizar `type AppointmentEventPayload` (linha ~14) e adicionar o campo opcional:

```typescript
type AppointmentEventPayload = {
  tenantId: string;
  appointment: Appointment;
  customer: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  };
  service: {
    id: string;
    name: string;
    duration: number;
  };
  professional: {
    id: string;
    name: string;
    email: string;
  };
  notificationMessage?: string;
};
```

- [ ] **Step 1.2: Adicionar `notificationMessage` ao schema de criação**

Em `src/domains/scheduling/types.ts`, localizar `createAppointmentSchema` e adicionar o campo:

```typescript
export const createAppointmentSchema = z.object({
  customerId: z.string().cuid(),
  professionalId: z.string().uuid(),
  serviceId: z.string().cuid(),
  startsAt: z.string().datetime(),
  notes: z.string().trim().max(500).optional(),
  allowOverlap: z.boolean().optional().default(false),
  notificationMessage: z.string().trim().optional(),
});
```

- [ ] **Step 1.3: Adicionar `notificationMessage` ao schema de status**

No mesmo arquivo, localizar `updateAppointmentStatusSchema`:

```typescript
export const updateAppointmentStatusSchema = z.object({
  status: z.nativeEnum(AppointmentStatus),
  notificationMessage: z.string().trim().optional(),
});
```

- [ ] **Step 1.4: Verificar tipos gerados**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 1.5: Commit**

```bash
git add src/shared/events/domain-events.ts src/domains/scheduling/types.ts
git commit -m "feat(scheduling): adiciona notificationMessage nos tipos de evento e schemas de domínio"
```

---

## Task 2: Helper `localDateTimeToUtc` em `dates.ts`

**Files:**
- Modify: `src/lib/dates.ts`
- Test: (inline no arquivo de teste do availability service — Task 4)

- [ ] **Step 2.1: Adicionar helper ao final de `src/lib/dates.ts`**

Após a função `monthBoundsInTz` (linha ~112), adicionar:

```typescript
/**
 * Converte data local ("YYYY-MM-DD" + "HH:MM") no timezone informado para UTC.
 * Ex: "2026-06-04" + "09:00" em "America/Sao_Paulo" → 2026-06-04T12:00:00.000Z
 * Seguro para timezones entre UTC-12 e UTC+11.
 */
export function localDateTimeToUtc(dateStr: string, timeStr: string, tz: string): Date {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, m] = timeStr.split(':').map(Number);
  const approxUtc = new Date(Date.UTC(y, mo - 1, d, h, m, 0));
  const offsetMs = tzOffsetMs(tz, approxUtc);
  return new Date(approxUtc.getTime() + offsetMs);
}
```

- [ ] **Step 2.2: Verificar compilação**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 2.3: Commit**

```bash
git add src/lib/dates.ts
git commit -m "feat(dates): adiciona localDateTimeToUtc para conversão timezone-aware"
```

---

## Task 3: `getTenantTimezone` no IAM Repository

**Files:**
- Modify: `src/domains/iam/iam.repository.ts`

- [ ] **Step 3.1: Adicionar método antes do `updateBusinessHours`**

Em `src/domains/iam/iam.repository.ts`, após `getBusinessHours` (linha ~255), adicionar:

```typescript
  async getTenantTimezone(tenantId: string): Promise<string | null> {
    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { timezone: true },
    });
    return tenant?.timezone ?? null;
  }
```

- [ ] **Step 3.2: Verificar compilação**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 3.3: Commit**

```bash
git add src/domains/iam/iam.repository.ts
git commit -m "feat(iam): adiciona getTenantTimezone ao IamRepository"
```

---

## Task 4: Fix de Timezone e campo `bookedBy` no Availability Service

**Files:**
- Modify: `src/domains/scheduling/availability.service.ts`
- Test: `src/domains/scheduling/availability.service.test.ts` (criar se não existir)

- [ ] **Step 4.1: Escrever testes falhando**

Criar/abrir `src/domains/scheduling/availability.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { localDateTimeToUtc } from '@/lib/dates'

describe('localDateTimeToUtc', () => {
  it('converte 09:00 em America/Sao_Paulo para 12:00 UTC', () => {
    const result = localDateTimeToUtc('2026-06-04', '09:00', 'America/Sao_Paulo')
    expect(result.toISOString()).toBe('2026-06-04T12:00:00.000Z')
  })

  it('converte 00:00 em America/Sao_Paulo para 03:00 UTC', () => {
    const result = localDateTimeToUtc('2026-06-04', '00:00', 'America/Sao_Paulo')
    expect(result.toISOString()).toBe('2026-06-04T03:00:00.000Z')
  })

  it('converte 18:00 em America/Sao_Paulo para 21:00 UTC', () => {
    const result = localDateTimeToUtc('2026-06-04', '18:00', 'America/Sao_Paulo')
    expect(result.toISOString()).toBe('2026-06-04T21:00:00.000Z')
  })
})
```

- [ ] **Step 4.2: Executar testes para confirmar que falham**

```bash
npx vitest run src/domains/scheduling/availability.service.test.ts
```

Esperado: FAIL (importação não existe ou função retorna valor errado antes do fix)

- [ ] **Step 4.3: Reescrever `getAvailableSlots` no `availability.service.ts`**

Substituir o conteúdo completo do arquivo pelo seguinte:

```typescript
import { prisma } from "@/shared/database/prisma";
import { SlotUnavailableError } from "@/shared/errors";
import { IamRepository } from "@/domains/iam/iam.repository";
import { dayBoundsInTz, localDateTimeToUtc } from "@/lib/dates";

import { appointmentRepository } from "./appointment.repository";

export type TimeSlot = {
  time: string;
  available: boolean;
  bookedBy?: string;
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

  async getAvailableSlots(
    tenantId: string,
    professionalId: string,
    date: string,
    serviceDuration: number,
  ): Promise<TimeSlot[]> {
    const iamRepo = new IamRepository();
    const [businessHours, tz] = await Promise.all([
      iamRepo.getBusinessHours(tenantId),
      iamRepo.getTenantTimezone(tenantId),
    ]);
    const timezone = tz ?? "America/Sao_Paulo";

    const dayOfWeek = new Date(date + "T12:00:00Z").getUTCDay();
    const dayConfig = businessHours[String(dayOfWeek)];

    if (!dayConfig || !dayConfig.active) {
      return [];
    }

    const step = Math.max(serviceDuration, 15);
    const openMin = timeToMinutes(dayConfig.open);
    const closeMin = timeToMinutes(dayConfig.close);

    // Limites do dia no timezone do tenant
    const { start: dayStart, end: dayEnd } = dayBoundsInTz(timezone, new Date(`${date}T12:00:00Z`));

    const existingAppointments = await prisma.appointment.findMany({
      where: {
        tenantId,
        professionalId,
        status: { in: ["SCHEDULED", "CONFIRMED"] },
        startsAt: { gte: dayStart, lte: dayEnd },
      },
      select: {
        startsAt: true,
        endsAt: true,
        customer: { select: { name: true } },
      },
    });

    const slots: TimeSlot[] = [];
    for (let min = openMin; min + step <= closeMin; min += step) {
      const slotStart = localDateTimeToUtc(date, minutesToTime(min), timezone);
      const slotEnd = new Date(slotStart.getTime() + serviceDuration * 60 * 1000);

      const conflictingAppt = existingAppointments.find(
        (a) => a.startsAt < slotEnd && a.endsAt > slotStart,
      );

      slots.push({
        time: minutesToTime(min),
        available: !conflictingAppt,
        bookedBy: conflictingAppt?.customer.name.split(" ")[0],
      });
    }

    return slots;
  }
}

export const availabilityService = new AvailabilityService();
```

Nota: `dayOfWeek` usa `getUTCDay()` com `T12:00:00Z` para obter o dia da semana correto independente de timezone.

- [ ] **Step 4.4: Executar testes**

```bash
npx vitest run src/domains/scheduling/availability.service.test.ts
```

Esperado: PASS (3 testes passando)

- [ ] **Step 4.5: Verificar compilação**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 4.6: Commit**

```bash
git add src/domains/scheduling/availability.service.ts src/domains/scheduling/availability.service.test.ts
git commit -m "fix(scheduling): corrige timezone no getAvailableSlots e adiciona bookedBy nos slots"
```

---

## Task 5: Scheduling Service — passar `notificationMessage` nos eventos

**Files:**
- Modify: `src/domains/scheduling/scheduling.service.ts`

- [ ] **Step 5.1: Atualizar `createAppointment` para incluir `notificationMessage` no evento**

Localizar o bloco `eventBus.publish` dentro de `createAppointment` (linha ~127) e substituir:

```typescript
    eventBus.publish({
      type: "scheduling.appointment.created",
      payload: {
        ...this.toAppointmentEventPayload(tenantId, appointmentDetails),
        notificationMessage: input.notificationMessage,
      },
    });
```

- [ ] **Step 5.2: Atualizar `updateAppointmentStatus` para incluir `notificationMessage` no evento de cancelamento**

Localizar o bloco `eventBus.publish` dentro de `updateAppointmentStatus` (linha ~165) e substituir:

```typescript
    const eventType = this.resolveStatusEvent(input.status);
    if (eventType) {
      eventBus.publish({
        type: eventType,
        payload: {
          ...this.toAppointmentEventPayload(tenantId, appointment),
          ...(input.status === AppointmentStatus.CANCELLED
            ? { notificationMessage: input.notificationMessage }
            : {}),
        },
      });
    }
```

- [ ] **Step 5.3: Verificar compilação**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 5.4: Commit**

```bash
git add src/domains/scheduling/scheduling.service.ts
git commit -m "feat(scheduling): service inclui notificationMessage no payload dos eventos created e cancelled"
```

---

## Task 6: Subscriptions + Evolution Provider

**Files:**
- Modify: `src/domains/notifications/subscriptions.ts`
- Modify: `src/domains/notifications/providers/evolution.provider.ts`

- [ ] **Step 6.1: Atualizar subscription `scheduling.appointment.created`**

Em `src/domains/notifications/subscriptions.ts`, localizar o subscribe de `scheduling.appointment.created` (linha ~34) e substituir:

```typescript
  eventBus.subscribe("scheduling.appointment.created", async ({ tenantId, appointment, customer, service, notificationMessage }) => {
    if (!customer.phone) return;
    await notificationService.logAndDispatch({
      tenantId,
      appointmentId: appointment.id,
      channel: NotificationChannel.WHATSAPP,
      template: "appointment-created",
      recipient: customer.phone,
      provider: "whatsapp",
      payload: {
        appointmentId: appointment.id,
        startsAt: appointment.startsAt.toISOString(),
        customerName: customer.name,
        serviceName: service.name,
        ...(notificationMessage ? { message: notificationMessage } : {}),
      },
    });
  });
```

- [ ] **Step 6.2: Atualizar subscription `scheduling.appointment.cancelled`**

Localizar o subscribe de `scheduling.appointment.cancelled` (linha ~16) e substituir:

```typescript
  eventBus.subscribe("scheduling.appointment.cancelled", async ({ tenantId, appointment, customer, service, notificationMessage }) => {
    if (!customer.phone) return;
    await notificationService.logAndDispatch({
      tenantId,
      appointmentId: appointment.id,
      channel: NotificationChannel.WHATSAPP,
      template: "appointment-cancelled",
      recipient: customer.phone,
      provider: "whatsapp",
      payload: {
        appointmentId: appointment.id,
        status: appointment.status,
        customerName: customer.name,
        serviceName: service.name,
        ...(notificationMessage ? { message: notificationMessage } : {}),
      },
    });
  });
```

- [ ] **Step 6.3: Adicionar shortcut `payload.message` no Evolution Provider para `appointment-created` e `appointment-cancelled`**

Em `src/domains/notifications/providers/evolution.provider.ts`, localizar a função `buildEvolutionMessage`. Adicionar verificação de `payload.message` logo no início do bloco de `appointment-created` (linha ~62), e um bloco dedicado para `appointment-cancelled` antes do catch-all:

```typescript
  if (template === "appointment-created" || template === "appointment-confirmed") {
    if (payload.message) return payload.message;
    if (!payload.startsAt) {
      return `Olá, ${payload.customerName}! ${principal} | ${payload.serviceName} | ${tenant.name}. ${final}`;
    }
    const date = fmt(payload.startsAt, tz, { day: "2-digit", month: "2-digit", year: "numeric" });
    const time = fmt(payload.startsAt, tz, { hour: "2-digit", minute: "2-digit" });
    const link = `${process.env.APP_URL ?? ""}/agendar/${tenant.slug}`;
    return `Olá, ${payload.customerName}! ${principal} 📅 ${date} às ${time} | ${payload.serviceName} | ${tenant.name}. ${final} 🔗 ${link}`;
  }
```

E antes do comentário `// cancelamento / nao_comparecimento` no final, adicionar bloco para `appointment-cancelled`:

```typescript
  if (template === "appointment-cancelled") {
    if (payload.message) return payload.message;
  }

  // cancelamento / nao_comparecimento
  return `Olá, ${payload.customerName}! ${principal} | ${payload.serviceName} | ${tenant.name}. ${final}`;
```

- [ ] **Step 6.4: Verificar compilação**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 6.5: Executar testes existentes**

```bash
npx vitest run src/domains/notifications/providers/evolution.provider.test.ts
```

Esperado: todos passando.

- [ ] **Step 6.6: Commit**

```bash
git add src/domains/notifications/subscriptions.ts src/domains/notifications/providers/evolution.provider.ts
git commit -m "feat(notifications): subscriptions e evolution provider usam mensagem customizada em created e cancelled"
```

---

## Task 7: Hook types — `notificationMessage` e `bookedBy`

**Files:**
- Modify: `src/hooks/scheduling/use-appointments.ts`
- Modify: `src/hooks/scheduling/use-availability.ts`

- [ ] **Step 7.1: Adicionar `notificationMessage` ao `CreateAppointmentInput`**

Em `src/hooks/scheduling/use-appointments.ts`, substituir `CreateAppointmentInput`:

```typescript
export type CreateAppointmentInput = {
  customerId: string
  professionalId: string
  serviceId: string
  startsAt: string
  notes?: string
  allowOverlap?: boolean
  notificationMessage?: string
}
```

- [ ] **Step 7.2: Atualizar `updateAppointmentStatus` para aceitar `notificationMessage`**

Substituir a função `updateAppointmentStatus`:

```typescript
async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus,
  notificationMessage?: string,
): Promise<Appointment> {
  const res = await fetch(`/api/scheduling/appointments/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, notificationMessage }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message ?? 'Falha ao atualizar status')
  }
  return res.json()
}
```

- [ ] **Step 7.3: Atualizar `useUpdateAppointmentStatus`**

Substituir o hook:

```typescript
export function useUpdateAppointmentStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status, notificationMessage }: { id: string; status: AppointmentStatus; notificationMessage?: string }) =>
      updateAppointmentStatus(id, status, notificationMessage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
    },
  })
}
```

- [ ] **Step 7.4: Adicionar `bookedBy` ao `TimeSlot` em `use-availability.ts`**

Em `src/hooks/scheduling/use-availability.ts`, substituir o tipo:

```typescript
export type TimeSlot = {
  time: string
  available: boolean
  bookedBy?: string
}
```

- [ ] **Step 7.5: Verificar compilação**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 7.6: Commit**

```bash
git add src/hooks/scheduling/use-appointments.ts src/hooks/scheduling/use-availability.ts
git commit -m "feat(hooks): adiciona notificationMessage e bookedBy nos tipos de agendamento e disponibilidade"
```

---

## Task 8: `CreateAppointmentModal` — Textarea + slots melhorados + custom time

**Files:**
- Modify: `src/components/domain/scheduling/create-appointment-modal.tsx`

- [ ] **Step 8.1: Substituir o arquivo completo**

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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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

const CONFIRM_TEMPLATE =
  'Olá, {nome}! Seu agendamento de {serviço} foi criado para {data} às {hora} com {profissional}. Te esperamos! 🤍'

function renderConfirmTemplate(params: {
  nome: string
  serviço: string
  data: string
  hora: string
  profissional: string
}): string {
  return CONFIRM_TEMPLATE
    .replace('{nome}', params.nome)
    .replace('{serviço}', params.serviço)
    .replace('{data}', params.data)
    .replace('{hora}', params.hora)
    .replace('{profissional}', params.profissional)
}

export function CreateAppointmentModal({ open, onClose, defaultDate }: Props) {
  const { data: currentUser } = useCurrentUser()
  const { can } = usePermissions()
  const { data: services = [] } = useServices()
  const { data: teamMembers = [] } = useTeamMembers()
  const createAppointment = useCreateAppointment()

  const canManage = can('agenda', 'edit')

  const [professionalId, setProfessionalId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [date, setDate] = useState(defaultDate ?? toDateInput(new Date()))
  const [selectedTime, setSelectedTime] = useState('')
  const [customTime, setCustomTime] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [allowOverlap, setAllowOverlap] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState('')

  const { data: customers = [], isLoading: searchingCustomers } =
    useCustomersSearch(customerSearch)

  const { data: slots = [], isLoading: loadingSlots } = useAvailableSlots(
    professionalId || null,
    date || null,
    serviceId || null,
  )

  useEffect(() => {
    if (currentUser && !canManage) {
      setProfessionalId(currentUser.id)
    }
  }, [currentUser, canManage])

  useEffect(() => {
    if (defaultDate) setDate(defaultDate)
  }, [defaultDate])

  useEffect(() => {
    setSelectedTime('')
    setCustomTime('')
  }, [professionalId, date, serviceId])

  // Auto-preenche mensagem WhatsApp quando todos os campos estão preenchidos
  useEffect(() => {
    if (!customerId || !serviceId || !date || !selectedTime || !professionalId) return

    const customer = customers.find((c) => c.id === customerId)
    const service = services.find((s) => s.id === serviceId)
    const professional = teamMembers.find((m) => m.id === professionalId)
    if (!customer || !service || !professional) return

    setNotificationMessage(
      renderConfirmTemplate({
        nome: customer.name.split(' ')[0],
        serviço: service.name,
        data: formatDateLabel(date),
        hora: formatHour(selectedTime),
        profissional: professional.name.split(' ')[0],
      }),
    )
  }, [customerId, serviceId, date, selectedTime, professionalId, customers, services, teamMembers])

  function handleClose() {
    setProfessionalId(canManage ? '' : (currentUser?.id ?? ''))
    setServiceId('')
    setDate(toDateInput(new Date()))
    setSelectedTime('')
    setCustomTime('')
    setCustomerSearch('')
    setCustomerId('')
    setAllowOverlap(false)
    setNotificationMessage('')
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
        notificationMessage: notificationMessage || undefined,
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
  const isFormValid = customerId && serviceId && professionalId && date && selectedTime

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
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
                    <Skeleton key={i} className="h-12 rounded-xl" />
                  ))}
                </div>
              ) : slots.length === 0 ? (
                <p className="text-sm text-slate-500 py-2">
                  Nenhum horário disponível neste dia.
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {slots.map((slot) => {
                    const isSelected = selectedTime === slot.time
                    const isOccupied = !slot.available
                    const isClickable = slot.available || allowOverlap

                    return (
                      <button
                        key={slot.time}
                        type="button"
                        disabled={!isClickable}
                        onClick={() => {
                          setSelectedTime(slot.time)
                          setCustomTime(slot.time)
                        }}
                        className={cn(
                          'rounded-xl border px-2 py-2 text-sm font-medium transition flex flex-col items-center gap-0.5 min-h-[40px]',
                          isSelected && !isOccupied
                            ? 'border-rose-500 bg-rose-50 text-rose-700'
                            : isSelected && isOccupied
                            ? 'border-orange-500 bg-orange-50 text-orange-700'
                            : !isOccupied
                            ? 'border-slate-200 bg-white text-slate-700 hover:border-rose-300 hover:bg-rose-50'
                            : allowOverlap
                            ? 'border-slate-200 bg-slate-50 text-slate-400 hover:border-orange-300 hover:bg-orange-50'
                            : 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300',
                        )}
                      >
                        <span className={isOccupied ? 'line-through' : ''}>{slot.time}</span>
                        {slot.bookedBy && (
                          <span className="text-xs font-normal leading-none">{slot.bookedBy}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="custom-time" className="text-xs text-slate-500">
                  Ou informe um horário específico:
                </Label>
                <Input
                  id="custom-time"
                  type="time"
                  value={customTime}
                  onChange={(e) => {
                    setCustomTime(e.target.value)
                    setSelectedTime(e.target.value)
                  }}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          )}

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

          {isFormValid && (
            <div className="space-y-1.5">
              <Label>Mensagem enviada ao cliente via WhatsApp</Label>
              <Textarea
                value={notificationMessage}
                onChange={(e) => setNotificationMessage(e.target.value)}
                placeholder="A mensagem será gerada automaticamente ao selecionar o horário..."
                className="min-h-[90px] resize-none text-sm"
              />
              {selectedCustomer && !selectedCustomer.phone && (
                <p className="text-xs text-slate-400">
                  Este cliente não tem telefone cadastrado. A mensagem não será enviada.
                </p>
              )}
            </div>
          )}

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

- [ ] **Step 8.2: Verificar compilação**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 8.3: Commit**

```bash
git add src/components/domain/scheduling/create-appointment-modal.tsx
git commit -m "feat(ui): CreateAppointmentModal com mensagem WhatsApp, slots com conflito e horário personalizado"
```

---

## Task 9: Criar `CancelAppointmentModal`

**Files:**
- Create: `src/components/domain/scheduling/cancel-appointment-modal.tsx`

- [ ] **Step 9.1: Criar o arquivo**

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
import { useUpdateAppointmentStatus } from '@/hooks/scheduling/use-appointments'
import type { Appointment } from '@/hooks/scheduling/use-appointments'

const CANCEL_TEMPLATE =
  'Olá, {nome}! Seu agendamento de {serviço} foi cancelado. Para reagendar, fale conosco. 😊'

function renderCancelTemplate(params: { nome: string; serviço: string }): string {
  return CANCEL_TEMPLATE
    .replace('{nome}', params.nome)
    .replace('{serviço}', params.serviço)
}

type Props = {
  appointment: Appointment | null
  open: boolean
  onClose: () => void
}

export function CancelAppointmentModal({ appointment, open, onClose }: Props) {
  const updateStatus = useUpdateAppointmentStatus()
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (appointment && open) {
      setMessage(
        renderCancelTemplate({
          nome: appointment.customer.name.split(' ')[0],
          serviço: appointment.service.name,
        }),
      )
    }
  }, [appointment, open])

  if (!appointment) return null

  function handleConfirm() {
    if (!appointment) return
    updateStatus.mutate(
      { id: appointment.id, status: 'CANCELLED', notificationMessage: message || undefined },
      {
        onSuccess: () => {
          toast.success('Agendamento cancelado')
          onClose()
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Erro ao cancelar agendamento')
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancelar agendamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-sm font-semibold text-slate-950">
              {appointment.customer.name}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{appointment.service.name}</p>
          </div>

          <div className="space-y-1.5">
            <Label>Mensagem enviada ao cliente via WhatsApp</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[90px] resize-none text-sm"
            />
            {!appointment.customer.phone && (
              <p className="text-xs text-slate-400">
                Este cliente não tem telefone cadastrado. A mensagem não será enviada.
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={updateStatus.isPending}
            >
              Voltar
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleConfirm}
              disabled={updateStatus.isPending}
            >
              {updateStatus.isPending ? 'Cancelando...' : 'Confirmar cancelamento'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 9.2: Verificar compilação**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 9.3: Commit**

```bash
git add src/components/domain/scheduling/cancel-appointment-modal.tsx
git commit -m "feat(ui): CancelAppointmentModal com mensagem WhatsApp editável"
```

---

## Task 10: Atualizar `AppointmentDrawer` para usar `CancelAppointmentModal`

**Files:**
- Modify: `src/components/domain/scheduling/appointment-drawer.tsx`

- [ ] **Step 10.1: Substituir o arquivo completo**

```typescript
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { StickyNote } from 'lucide-react'
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
import { CancelAppointmentModal } from './cancel-appointment-modal'

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
  const [cancelModalOpen, setCancelModalOpen] = useState(false)

  function handleStatus(status: 'CONFIRMED' | 'COMPLETED' | 'NO_SHOW') {
    if (!appointment) return
    updateStatus.mutate(
      { id: appointment.id, status },
      {
        onSuccess: (updated) => {
          const labels: Record<string, string> = {
            CONFIRMED: 'Agendamento confirmado',
            COMPLETED: 'Atendimento concluído',
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
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Detalhes do agendamento</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <div className="flex items-center gap-3">
              <Badge className={cn('text-sm', STATUS_BADGE[appointment.status])}>
                {STATUS_LABELS[appointment.status]}
              </Badge>
            </div>

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
              {appointment.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-medium text-slate-400 uppercase">Observações do atendimento</p>
                    <p className="mt-0.5 text-sm text-slate-700">{appointment.notes}</p>
                  </div>
                </>
              )}
            </div>

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
                    onClick={() => setCancelModalOpen(true)}
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

      <CancelAppointmentModal
        appointment={appointment}
        open={cancelModalOpen}
        onClose={() => {
          setCancelModalOpen(false)
          onClose()
        }}
      />
    </>
  )
}
```

- [ ] **Step 10.2: Verificar compilação completa**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 10.3: Executar todos os testes**

```bash
npx vitest run
```

Esperado: todos passando.

- [ ] **Step 10.4: Commit**

```bash
git add src/components/domain/scheduling/appointment-drawer.tsx
git commit -m "feat(ui): AppointmentDrawer delega cancelamento para CancelAppointmentModal"
```

---

## Task 11: Branch, PR e verificação final

- [ ] **Step 11.1: Criar branch a partir do primeiro commit desta feature**

Este plano assume que os commits foram feitos na branch de feature. Se estiver em `main`, criar a branch antes de começar:

```bash
git checkout -b feat/whatsapp-agendamento-slots
```

- [ ] **Step 11.2: Verificar todos os testes passando**

```bash
npx vitest run
```

Esperado: todos passando, zero falhas.

- [ ] **Step 11.3: Verificar build**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 11.4: Abrir Pull Request**

```bash
gh pr create \
  --title "feat(scheduling): WhatsApp na criação/cancelamento, fix disponibilidade timezone, slots com conflito" \
  --body "$(cat <<'EOF'
## Resumo

- Campo de mensagem WhatsApp editável no modal de criação de agendamento (auto-preenchido com template, editável antes de confirmar)
- Novo `CancelAppointmentModal` com campo de mensagem WhatsApp editável (substitui cancelamento direto no Drawer)
- Fix de timezone no `AvailabilityService`: slots agora são gerados no timezone do tenant, corrigindo o bug onde slots ocupados apareciam disponíveis
- Grade de slots melhorada: exibe nome do cliente em slots ocupados; slots ocupados ficam desabilitados (ou selecionáveis quando "Autorizar conflito" está ativo)
- Input de horário personalizado abaixo da grade de slots

## Test plan

- [ ] Criar agendamento: verificar que o campo de mensagem aparece ao selecionar todos os campos
- [ ] Verificar que a mensagem é auto-preenchida com nome, serviço, data e horário corretos
- [ ] Verificar que editar a mensagem mantém o conteúdo customizado
- [ ] Cancelar agendamento: verificar que o modal de cancelamento abre com mensagem pré-preenchida
- [ ] Verificar que slots do mesmo profissional no mesmo dia aparecem como ocupados (com nome do cliente)
- [ ] Verificar que slots ocupados ficam selecionáveis quando "Autorizar conflito" está ativo
- [ ] Testar input de horário personalizado (ex: 09:45) e verificar que sincroniza com a grade

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- Feature 1 (WhatsApp criação): Tasks 1, 5, 6, 7, 8 ✓
- Feature 2 (WhatsApp cancelamento): Tasks 1, 5, 6, 7, 9, 10 ✓
- Feature 3 (Fix timezone): Tasks 2, 3, 4 ✓
- Feature 4 (Slots + custom time): Tasks 4, 7, 8 ✓

**Consistência de tipos:**
- `AppointmentEventPayload.notificationMessage?` definido em Task 1, usado em Tasks 5 e 6 ✓
- `TimeSlot.bookedBy?` definido em Tasks 4 e 7 (ambos os arquivos que definem o tipo) ✓
- `CreateAppointmentInput.notificationMessage?` definido em Task 7, usado em Task 8 ✓
- `useUpdateAppointmentStatus` atualizado em Task 7, usado em Tasks 9 e 10 ✓

**Observações:**
- O `AppointmentDrawer` remove `CANCELLED` do tipo de `handleStatus` — TypeScript vai validar isso automaticamente pois o tipo agora é `'CONFIRMED' | 'COMPLETED' | 'NO_SHOW'`
- A route de status (`/api/scheduling/appointments/[appointmentId]/status`) não precisa ser modificada pois `validateInput` usa o schema atualizado em Task 1 e o service usa o tipo atualizado
- O `dayOfWeek` em `availability.service.ts` usa `getUTCDay()` com `T12:00:00Z` para evitar ambiguidade de timezone ao calcular o dia da semana
