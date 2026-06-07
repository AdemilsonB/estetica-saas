# Melhorias — Agendamento, Serviços e Planos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir ordem do modal de agendamento, bug na geração de slots, adicionar aba Planos nas configurações e reordenar abas de serviços.

**Architecture:** 4 melhorias independentes implementadas em sequência, da mais simples para a mais complexa. As mudanças de frontend são puras (sem backend). A lógica de slots envolve migration aditiva, correção no service e adaptação do fluxo público.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma, Vitest, TanStack Query, Shadcn UI.

---

## Mapa de arquivos

| Arquivo | Ação | Melhoria |
|---|---|---|
| `src/app/(app)/servicos/page.tsx` | Modificar | #4 |
| `src/app/(app)/configuracoes/page.tsx` | Modificar | #3 |
| `src/components/domain/scheduling/create-appointment-modal.tsx` | Modificar | #1 |
| `prisma/schema.prisma` | Modificar | #2 |
| `prisma/migrations/20260607000004_add_slot_interval_minutes/migration.sql` | Criar | #2 |
| `src/domains/scheduling/availability.service.ts` | Modificar | #2 |
| `src/domains/scheduling/availability.service.test.ts` | Modificar (reescrever) | #2 |
| `src/domains/scheduling/scheduling-policy.repository.ts` | Modificar | #2 |
| `src/app/api/scheduling/availability/route.ts` | Modificar | #2 |
| `src/app/api/public/[slug]/availability/route.ts` | Modificar | #2 |
| `src/components/domain/booking/datetime-step.tsx` | Modificar | #2 |

---

## Task 1: Reordenar abas na página de Serviços

**Files:**
- Modify: `src/app/(app)/servicos/page.tsx`

- [ ] **Step 1: Reordenar os TabsTrigger**

Abrir `src/app/(app)/servicos/page.tsx` e substituir o bloco `<TabsList>`:

```tsx
// DE:
<TabsList className="grid w-full grid-cols-4">
  <TabsTrigger value="servicos">Serviços</TabsTrigger>
  <TabsTrigger value="pacotes">Pacotes</TabsTrigger>
  <TabsTrigger value="promocoes">Promoções</TabsTrigger>
  <TabsTrigger value="categorias">Categorias</TabsTrigger>
</TabsList>

// PARA:
<TabsList className="grid w-full grid-cols-4">
  <TabsTrigger value="categorias">Categorias</TabsTrigger>
  <TabsTrigger value="servicos">Serviços</TabsTrigger>
  <TabsTrigger value="pacotes">Pacotes</TabsTrigger>
  <TabsTrigger value="promocoes">Promoções</TabsTrigger>
</TabsList>
```

O `defaultValue="servicos"` permanece inalterado. Os blocos `<TabsContent>` não mudam de posição (ordem no DOM não afeta visual).

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/servicos/page.tsx
git commit -m "feat(servicos): reordena abas — Categorias primeiro"
```

---

## Task 2: Adicionar aba "Planos" nas Configurações (só Owner)

**Files:**
- Modify: `src/app/(app)/configuracoes/page.tsx`

- [ ] **Step 1: Adicionar import de BillingPlansContent**

No topo de `src/app/(app)/configuracoes/page.tsx`, adicionar import após os existentes:

```tsx
import { BillingPlansContent } from '@/components/domain/billing/billing-plans-content'
```

- [ ] **Step 2: Atualizar a grid de tabs**

Localizar a linha que define `grid-cols-8` / `grid-cols-7` e atualizar para incluir a aba Planos (também exclusiva de Owner):

```tsx
// DE:
<TabsList className={`grid w-full min-w-[140%] ${user?.isOwner ? 'grid-cols-8' : 'grid-cols-7'}`}>

// PARA:
<TabsList className={`grid w-full min-w-[140%] ${user?.isOwner ? 'grid-cols-9' : 'grid-cols-7'}`}>
```

- [ ] **Step 3: Adicionar TabsTrigger de Planos (só Owner)**

Logo após `<TabsTrigger value="cargos">Cargos</TabsTrigger>` (que já é condicional ao Owner), adicionar dentro do mesmo bloco condicional:

```tsx
{user?.isOwner && (
  <>
    <TabsTrigger value="cargos">Cargos</TabsTrigger>
    <TabsTrigger value="planos">Planos</TabsTrigger>
  </>
)}
```

Remover o `<TabsTrigger value="cargos">` anterior (que estava isolado) para não duplicar.

- [ ] **Step 4: Adicionar TabsContent de Planos**

Após o `</TabsContent>` do bloco de "cargos", adicionar:

```tsx
{user?.isOwner && (
  <TabsContent value="planos" className="mt-6">
    <div className="rounded-2xl border border-white/80 bg-white/85 p-6 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-slate-950">
        Plano e assinatura
      </h2>
      <BillingPlansContent />
    </div>
  </TabsContent>
)}
```

- [ ] **Step 5: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 6: Commit**

```bash
git add src/app/(app)/configuracoes/page.tsx
git commit -m "feat(configuracoes): adiciona aba Planos exclusiva para Owner"
```

---

## Task 3: Modal de Agendamento — Serviço antes do Profissional

**Files:**
- Modify: `src/components/domain/scheduling/create-appointment-modal.tsx`

- [ ] **Step 1: Adicionar useEffect que reseta professionalId ao trocar serviço**

Dentro do componente `CreateAppointmentModal`, após os `useEffect` existentes (por volta da linha 119), adicionar:

```tsx
useEffect(() => {
  if (canManage) {
    setProfessionalId('')
  }
}, [serviceId, canManage])
```

Isso garante que ao trocar o serviço, o profissional selecionado anteriormente seja limpo.

- [ ] **Step 2: Mover bloco de Serviço para antes do bloco de Profissional no JSX**

No `<form>`, a ordem atual é: `[Profissional] → [Serviço] → [Data] → ...`

Reorganizar para: `[Serviço] → [Profissional] → [Data] → ...`

O JSX deve ficar:

```tsx
<form onSubmit={handleSubmit} className="space-y-5">
  {/* 1. Serviço — sempre primeiro */}
  <div className="space-y-2">
    <Label>Serviço</Label>
    <ServicePickerWithCategories
      services={activeServices}
      categories={categories}
      selectedId={serviceId}
      onSelect={(s) => setServiceId(s.id)}
    />
  </div>

  {/* 2. Profissional — filtrado pelo serviço, só para quem pode gerenciar */}
  {canManage && (
    <>
      {showServiceWarning && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Nenhum profissional configurado para este serviço. Configure na aba{' '}
          <span className="font-medium">Equipe</span>.
        </div>
      )}
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
    </>
  )}

  {/* 3. Data */}
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

  {/* 4. Horário — só aparece quando profissional + serviço + data estão definidos */}
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

  {/* 5. Cliente */}
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

  {/* 6. Mensagem WhatsApp — só quando formulário completo */}
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

  {/* 7. Botões */}
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
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 4: Commit**

```bash
git add src/components/domain/scheduling/create-appointment-modal.tsx
git commit -m "feat(scheduling): modal de agendamento — serviço selecionado antes do profissional"
```

---

## Task 4: Lógica de Slots — Migration + Backend + Área Pública

### Task 4a: Migration — adicionar `slotIntervalMinutes`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260607000004_add_slot_interval_minutes/migration.sql`

- [ ] **Step 1: Adicionar campo ao schema**

Em `prisma/schema.prisma`, localizar `model SchedulingPolicy` e adicionar o campo:

```prisma
model SchedulingPolicy {
  id                 String   @id @default(cuid())
  tenantId           String   @unique
  paddingMinutes     Int      @default(0)
  minAdvanceMinutes  Int      @default(15)
  maxAdvanceDays     Int      @default(60)
  slotIntervalMinutes Int     @default(30)
  allowPublicBooking Boolean  @default(true)
  updatedAt          DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2: Criar arquivo de migration manual**

Criar o diretório e o arquivo SQL:

```
prisma/migrations/20260607000004_add_slot_interval_minutes/migration.sql
```

Conteúdo do arquivo:

```sql
-- AlterTable
ALTER TABLE "SchedulingPolicy" ADD COLUMN "slotIntervalMinutes" INTEGER NOT NULL DEFAULT 30;
```

- [ ] **Step 3: Aplicar migration**

```bash
npx prisma migrate deploy
```

Esperado: `1 migration applied successfully.`

- [ ] **Step 4: Gerar Prisma Client**

```bash
npx prisma generate
```

Esperado: sem erros.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260607000004_add_slot_interval_minutes/migration.sql
git commit -m "chore(database): adiciona slotIntervalMinutes à SchedulingPolicy (default 30)"
```

---

### Task 4b: Atualizar SchedulingPolicyRepository

**Files:**
- Modify: `src/domains/scheduling/scheduling-policy.repository.ts`

- [ ] **Step 1: Adicionar `slotIntervalMinutes` ao tipo do upsert**

Substituir o método `upsert` para incluir o novo campo:

```ts
async upsert(
  tenantId: string,
  data: {
    paddingMinutes?: number
    minAdvanceMinutes?: number
    maxAdvanceDays?: number
    slotIntervalMinutes?: number
    allowPublicBooking?: boolean
  },
) {
  return prisma.schedulingPolicy.upsert({
    where: { tenantId },
    create: { tenantId, ...data },
    update: data,
  })
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/domains/scheduling/scheduling-policy.repository.ts
git commit -m "feat(scheduling): slotIntervalMinutes no repositório de policy"
```

---

### Task 4c: Corrigir AvailabilityService

**Files:**
- Modify: `src/domains/scheduling/availability.service.ts`
- Modify: `src/domains/scheduling/availability.service.test.ts`

- [ ] **Step 1: Escrever os testes (TDD — escrita antes da implementação)**

Substituir o conteúdo de `src/domains/scheduling/availability.service.test.ts` por:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/shared/database/prisma'
import { IamRepository } from '@/domains/iam/iam.repository'
import { AvailabilityService } from './availability.service'

vi.mock('@/shared/database/prisma', () => ({
  prisma: { appointment: { findMany: vi.fn() } },
}))

vi.mock('@/domains/iam/iam.repository', () => ({
  IamRepository: vi.fn().mockImplementation(() => ({
    getBusinessHours: vi.fn(),
    getTenantTimezone: vi.fn(),
  })),
}))

const mockBusinessHours = {
  '1': { active: true, open: '09:00', close: '18:00' }, // Segunda
}

beforeEach(() => {
  vi.clearAllMocks()
  const iamInstance = new (IamRepository as any)()
  iamInstance.getBusinessHours.mockResolvedValue(mockBusinessHours)
  iamInstance.getTenantTimezone.mockResolvedValue('America/Sao_Paulo')
  ;(IamRepository as any).mockImplementation(() => iamInstance)
})

describe('AvailabilityService.getAvailableSlots', () => {
  const service = new AvailabilityService()
  const tenantId = 'tenant-1'
  const professionalId = 'prof-1'
  // 2026-06-08 é uma segunda-feira (dayOfWeek = 1)
  const date = '2026-06-08'

  it('gera slots com intervalo fixo, não com a duração do serviço', async () => {
    ;(prisma.appointment.findMany as any).mockResolvedValue([])

    // Serviço de 60 min com intervalo de 30 min
    const slots = await service.getAvailableSlots(tenantId, professionalId, date, 60, 30)
    const times = slots.map((s) => s.time)

    // Deve gerar 09:00, 09:30, 10:00, ... até 17:00 (último que cabe: 17:00 + 60min = 18:00)
    expect(times).toContain('09:00')
    expect(times).toContain('09:30')
    expect(times).toContain('10:00')
    expect(times).toContain('17:00')
    // 17:30 não cabe (17:30 + 60min = 18:30 > 18:00)
    expect(times).not.toContain('17:30')
  })

  it('todos os slots disponíveis quando não há agendamentos', async () => {
    ;(prisma.appointment.findMany as any).mockResolvedValue([])

    const slots = await service.getAvailableSlots(tenantId, professionalId, date, 60, 30)

    expect(slots.every((s) => s.available)).toBe(true)
    expect(slots.every((s) => !s.bookedBy)).toBe(true)
  })

  it('marca slot como ocupado quando há conflito com agendamento existente', async () => {
    // Agendamento das 09:00 às 10:00 (UTC: 12:00–13:00)
    ;(prisma.appointment.findMany as any).mockResolvedValue([
      {
        startsAt: new Date('2026-06-08T12:00:00.000Z'),
        endsAt: new Date('2026-06-08T13:00:00.000Z'),
        customer: { name: 'Ana Silva' },
      },
    ])

    const slots = await service.getAvailableSlots(tenantId, professionalId, date, 60, 30)

    const slot0900 = slots.find((s) => s.time === '09:00')
    expect(slot0900?.available).toBe(false)
    expect(slot0900?.bookedBy).toBe('Ana')

    // Slot das 09:30 conflita: 09:30+60min=10:30 > 09:00 e 09:30 < 10:00
    const slot0930 = slots.find((s) => s.time === '09:30')
    expect(slot0930?.available).toBe(false)

    // Slot das 10:00 NÃO conflita: começa exatamente quando termina o agendamento
    const slot1000 = slots.find((s) => s.time === '10:00')
    expect(slot1000?.available).toBe(true)
  })

  it('retorna array vazio quando dia está fechado', async () => {
    // Usa uma quinta com dayOfWeek=4, não configurada no businessHours mock
    const slots = await service.getAvailableSlots(tenantId, professionalId, '2026-06-11', 60, 30)
    expect(slots).toHaveLength(0)
  })

  it('usa intervalo padrão de 30 min quando não informado', async () => {
    ;(prisma.appointment.findMany as any).mockResolvedValue([])

    const slots = await service.getAvailableSlots(tenantId, professionalId, date, 60)
    const times = slots.map((s) => s.time)

    // Com intervalo 30: 09:00, 09:30, 10:00...
    expect(times).toContain('09:30')
  })
})
```

- [ ] **Step 2: Rodar os testes para confirmar que falham**

```bash
npx vitest run src/domains/scheduling/availability.service.test.ts
```

Esperado: vários FAIL (a função ainda usa `step = Math.max(serviceDuration, 15)`).

- [ ] **Step 3: Corrigir a implementação**

Substituir o conteúdo de `src/domains/scheduling/availability.service.ts`:

```ts
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
    slotIntervalMinutes = 30,
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

    const interval = Math.max(slotIntervalMinutes, 5);
    const openMin = timeToMinutes(dayConfig.open);
    const closeMin = timeToMinutes(dayConfig.close);

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
    // Itera com `interval` como passo; slot só é incluído se a duração cabe até o fechamento
    for (let min = openMin; min + serviceDuration <= closeMin; min += interval) {
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

- [ ] **Step 4: Rodar os testes para confirmar que passam**

```bash
npx vitest run src/domains/scheduling/availability.service.test.ts
```

Esperado: todos PASS.

- [ ] **Step 5: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 6: Commit**

```bash
git add src/domains/scheduling/availability.service.ts src/domains/scheduling/availability.service.test.ts
git commit -m "fix(scheduling): corrige geração de slots — intervalo fixo separado da duração do serviço"
```

---

### Task 4d: Atualizar API interna de disponibilidade

**Files:**
- Modify: `src/app/api/scheduling/availability/route.ts`

- [ ] **Step 1: Carregar slotIntervalMinutes da policy e passá-la ao service**

Substituir o conteúdo de `src/app/api/scheduling/availability/route.ts`:

```ts
import { z } from "zod";

import { availabilityService } from "@/domains/scheduling/availability.service";
import { catalogServiceRepository } from "@/domains/scheduling/service.repository";
import { schedulingPolicyService } from "@/domains/scheduling/scheduling-policy.service";
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

    const [service, policy] = await Promise.all([
      catalogServiceRepository.findById(session.tenantId, serviceId),
      schedulingPolicyService.getPolicy(session.tenantId),
    ]);

    if (!service) {
      return Response.json({ slots: [] });
    }

    const slots = await availabilityService.getAvailableSlots(
      session.tenantId,
      professionalId,
      date,
      service.duration,
      policy.slotIntervalMinutes,
    );

    return Response.json({ slots });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/scheduling/availability/route.ts
git commit -m "feat(scheduling): API interna usa slotIntervalMinutes da policy"
```

---

### Task 4e: Atualizar API pública — retornar todos os slots com status

**Files:**
- Modify: `src/app/api/public/[slug]/availability/route.ts`

- [ ] **Step 1: Retornar todos os slots com `{ time, available }` em vez de apenas os disponíveis**

Substituir o conteúdo de `src/app/api/public/[slug]/availability/route.ts`:

```ts
import { publicBookingRepository } from '@/domains/scheduling/public-booking.repository'
import { availabilityService } from '@/domains/scheduling/availability.service'
import { schedulingPolicyService } from '@/domains/scheduling/scheduling-policy.service'
import { catalogServiceRepository } from '@/domains/scheduling/service.repository'
import { handleApiError } from '@/shared/http/handle-api-error'

export async function GET(
  req: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    const serviceId = searchParams.get('serviceId')
    const professionalId = searchParams.get('professionalId')

    if (!date || !serviceId) {
      return Response.json(
        { error: 'Parâmetros date e serviceId são obrigatórios.' },
        { status: 400 },
      )
    }

    const tenant = await publicBookingRepository.findTenantBySlug(slug)
    const policy = await schedulingPolicyService.getPolicy(tenant.id)

    if (!policy.allowPublicBooking) {
      return Response.json({ slots: [] })
    }

    const service = await catalogServiceRepository.findById(tenant.id, serviceId)
    if (!service) {
      return Response.json({ error: 'Serviço não encontrado.' }, { status: 404 })
    }

    let resolvedProfessionalId = professionalId
    if (!resolvedProfessionalId) {
      const professionals = await publicBookingRepository.findPublicProfessionals(tenant.id)
      if (professionals.length === 0) {
        return Response.json({ slots: [] })
      }
      resolvedProfessionalId = professionals[0].id
    }

    const allSlots = await availabilityService.getAvailableSlots(
      tenant.id,
      resolvedProfessionalId,
      date,
      service.duration,
      policy.slotIntervalMinutes,
    )

    // Retorna todos os slots com status. Nunca expõe bookedBy (privacidade).
    const publicSlots = allSlots.map((slot) => ({
      time: slot.time,
      available: slot.available,
    }))

    return Response.json({ slots: publicSlots })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/public/[slug]/availability/route.ts
git commit -m "feat(booking): API pública retorna todos os slots com status (sem dados privados)"
```

---

### Task 4f: Adaptar DateTimeStep para exibir slots ocupados

**Files:**
- Modify: `src/components/domain/booking/datetime-step.tsx`

- [ ] **Step 1: Adicionar tipo local e atualizar o estado**

No topo do componente, após os imports, substituir o estado `slots`:

```tsx
type PublicSlot = { time: string; available: boolean }
```

Substituir:
```tsx
const [slots, setSlots] = useState<string[]>([])
```
Por:
```tsx
const [slots, setSlots] = useState<PublicSlot[]>([])
```

- [ ] **Step 2: Atualizar o fetch para parsear o novo formato**

Substituir:
```tsx
.then((d: { slots?: string[] }) => setSlots(d.slots ?? []))
```
Por:
```tsx
.then((d: { slots?: PublicSlot[] }) => setSlots(d.slots ?? []))
```

- [ ] **Step 3: Atualizar `handleSlotClick` para aceitar `PublicSlot`**

Substituir:
```tsx
function handleSlotClick(slot: string) {
  if (!selectedDay) return
  const [h, m] = slot.split(':').map(Number)
  const dt = new Date(selectedDay + 'T00:00:00')
  dt.setHours(h ?? 0, m ?? 0, 0, 0)
  onSelect(dt)
}
```
Por:
```tsx
function handleSlotClick(slot: PublicSlot) {
  if (!selectedDay || !slot.available) return
  const [h, m] = slot.time.split(':').map(Number)
  const dt = new Date(selectedDay + 'T00:00:00')
  dt.setHours(h ?? 0, m ?? 0, 0, 0)
  onSelect(dt)
}
```

- [ ] **Step 4: Atualizar a renderização dos slots**

Substituir o bloco de grid de slots (dentro de `{selectedDay && ...}`):

```tsx
{/* Slots de horário */}
{selectedDay && (
  <div
    className="space-y-3"
    style={{ '--slot-primary': primaryColor } as React.CSSProperties}
  >
    <h3 className="text-sm font-medium text-slate-700">Horários disponíveis</h3>
    {loadingSlots ? (
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-11 rounded-lg bg-slate-100 animate-pulse" />
        ))}
      </div>
    ) : slots.length === 0 ? (
      <p className="text-sm text-slate-500 text-center py-6">
        Nenhum horário disponível nesta data.
      </p>
    ) : (
      <div className="grid grid-cols-3 gap-2">
        {slots.map((slot) =>
          slot.available ? (
            <button
              key={slot.time}
              onClick={() => handleSlotClick(slot)}
              className="slot-btn h-11 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 transition-all"
            >
              {slot.time}
            </button>
          ) : (
            <div
              key={slot.time}
              className="flex h-11 flex-col items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-xs text-slate-400"
            >
              <span className="font-medium">{slot.time}</span>
              <span className="leading-none">Agendado</span>
            </div>
          )
        )}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 5: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 6: Rodar todos os testes**

```bash
npx vitest run
```

Esperado: todos PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/domain/booking/datetime-step.tsx
git commit -m "feat(booking): exibe slots ocupados como desabilitados na área pública"
```

---

## Verificação final

- [ ] **Rodar build completo**

```bash
npx tsc --noEmit && npx vitest run
```

Esperado: zero erros TypeScript, todos os testes passando.

- [ ] **Commit final se necessário**

Se houver arquivos pendentes:

```bash
git status
git add <arquivos>
git commit -m "chore: ajustes finais das melhorias de agendamento e serviços"
```
