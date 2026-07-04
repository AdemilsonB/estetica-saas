# Agenda, Serviços e Comissões — Polimento UX — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir 8 itens de UX/bug identificados em uso real: layout do card da agenda, horário personalizado no drawer, filtro unificado de serviços/pacotes/promoções, textarea de descrição, comissões editáveis, e propagação correta de pacotes/promoções para financeiro e relatórios.

**Architecture:** Todas as mudanças são no frontend Next.js (App Router) exceto Task 6 que toca o schema Zod de criação de agendamento, o scheduling service e a rota de disponibilidade para suportar `packageId` no painel profissional. Nenhuma migration de banco. O appointment repository já inclui `package` e `promotion` nas queries — as correções são de leitura e schema apenas.

**Tech Stack:** Next.js 15, TypeScript strict, Tailwind CSS, Shadcn UI, TanStack Query, Zod, Prisma

## Global Constraints

- Todo código em TypeScript strict — sem `any`, sem `as unknown as`
- Nenhuma mudança de schema de banco de dados (nenhum `prisma migrate`)
- Branch de trabalho: `fix/agenda-ux-pencil-products`
- Verificar branch com `git branch --show-current` antes de todo commit
- Rodar `npx tsc --noEmit` ao final de cada task para confirmar zero erros
- Mensagens de commit em português

---

## Mapa de arquivos

| Arquivo | Tasks |
|---------|-------|
| `src/components/domain/scheduling/appointment-card.tsx` | 3 |
| `src/components/domain/scheduling/appointment-drawer.tsx` | 5 |
| `src/components/domain/scheduling/create-appointment-modal.tsx` | 10 |
| `src/components/domain/services/package-form-modal.tsx` | 4 |
| `src/components/domain/services/promotion-form-modal.tsx` | 4 |
| `src/components/domain/services/service-picker-with-categories.tsx` | 8 |
| `src/components/domain/booking/service-step.tsx` | 9 |
| `src/components/domain/settings/commissions-grid.tsx` | 2 |
| `src/domains/scheduling/types.ts` | 6 |
| `src/domains/scheduling/scheduling.service.ts` | 1, 6 |
| `src/domains/reports/reports.service.ts` | 1 |
| `src/app/api/scheduling/availability/route.ts` | 6 |
| `src/hooks/scheduling/use-appointments.ts` | 7 |
| `src/hooks/scheduling/use-availability.ts` | 7 |

---

## Task 1: Item H — Nomes de pacotes/promoções no financeiro e relatórios

**Files:**
- Modify: `src/domains/scheduling/scheduling.service.ts`
- Modify: `src/domains/reports/reports.service.ts`
- Test: `src/domains/scheduling/__tests__/scheduling.service.test.ts` (arquivo existente ou criar)

**Interfaces:**
- Produces: `appointmentItemName(apt)` helper local em cada arquivo

**Contexto:** Hoje `scheduling.service.ts` extrai `serviceName` só de `service?.name`. Pacotes e promoções ficam como `""` ou `null` no financeiro. `reports.service.ts` também só lê `service?.name` e não inclui `package`/`promotion` nas queries.

- [ ] **Step 1: Corrigir scheduling.service.ts — 4 ocorrências**

Abrir `src/domains/scheduling/scheduling.service.ts`. Localizar e substituir as 4 ocorrências:

*Linha ~318 (evento de reagendamento):*
```typescript
// ANTES
serviceName: current.service?.name ?? "",
// DEPOIS
serviceName: current.service?.name ?? current.package?.name ?? current.promotion?.name ?? "",
```

*Linha ~435 (registro de pagamento):*
```typescript
// ANTES
serviceName: appointment.service?.name ?? null,
// DEPOIS
serviceName: appointment.service?.name ?? appointment.package?.name ?? appointment.promotion?.name ?? null,
```

*Linha ~498 (registro de estorno):*
```typescript
// ANTES
serviceName: appointment.service?.name ?? null,
// DEPOIS
serviceName: appointment.service?.name ?? appointment.package?.name ?? appointment.promotion?.name ?? null,
```

*Linha ~625 (toAppointmentEventPayload — campo `service.name`):*
```typescript
// ANTES
service: {
  id: appointment.service?.id ?? "",
  name: appointment.service?.name ?? "",
  duration: appointment.service?.duration ?? 0,
},
// DEPOIS
service: {
  id: appointment.service?.id ?? "",
  name: appointment.service?.name ?? appointment.package?.name ?? appointment.promotion?.name ?? "",
  duration: appointment.service?.duration ?? (appointment.package?.items?.reduce((s: number, i: { service: { duration: number } }) => s + i.service.duration, 0) ?? 0),
},
```

- [ ] **Step 2: Corrigir reports.service.ts — includes e leituras**

Abrir `src/domains/reports/reports.service.ts`.

*Encontrar os dois `findMany` que têm `service: { select: { id: true, name: true } }` (linhas ~61-68 e ~179-183) e adicionar `package` e `promotion`:*

```typescript
// No include de cada findMany, adicionar ao lado de service:
package: { select: { id: true, name: true } },
promotion: { select: { id: true, name: true } },
```

*Encontrar a leitura de groupId/label no relatório financeiro (linhas ~88-92):*
```typescript
// ANTES
const groupId =
  input.groupBy === 'profissional'
    ? (tx.appointment?.professional?.id ?? null)
    : (tx.appointment?.service?.id ?? null)
const label =
  input.groupBy === 'profissional'
    ? (tx.appointment?.professional?.name ?? 'Sem profissional')
    : (tx.appointment?.service?.name ?? 'Sem serviço')
// DEPOIS
const groupId =
  input.groupBy === 'profissional'
    ? (tx.appointment?.professional?.id ?? null)
    : (tx.appointment?.service?.id ?? tx.appointment?.package?.id ?? tx.appointment?.promotion?.id ?? null)
const label =
  input.groupBy === 'profissional'
    ? (tx.appointment?.professional?.name ?? 'Sem profissional')
    : (tx.appointment?.service?.name ?? tx.appointment?.package?.name ?? tx.appointment?.promotion?.name ?? 'Sem serviço')
```

*Encontrar a leitura de label no relatório de agendamentos (linha ~215):*
```typescript
// ANTES
const label =
  input.groupBy === 'servico'
    ? (apt.service?.name ?? 'Sem serviço')
    : (apt.professional?.name ?? 'Sem profissional')
// DEPOIS
const label =
  input.groupBy === 'servico'
    ? (apt.service?.name ?? apt.package?.name ?? apt.promotion?.name ?? 'Sem serviço')
    : (apt.professional?.name ?? 'Sem profissional')
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd c:/dev/estetica-saas && npx tsc --noEmit 2>&1 | head -30
```
Esperado: zero erros relacionados a esses arquivos (erros pré-existentes em outros arquivos podem existir).

- [ ] **Step 4: Commit**

```bash
git branch --show-current  # deve ser fix/agenda-ux-pencil-products
git add src/domains/scheduling/scheduling.service.ts src/domains/reports/reports.service.ts
git commit -m "fix: propaga nome de pacote/promoção para financeiro e relatórios"
```

---

## Task 2: Items F+G — Comissões editáveis no mobile

**Files:**
- Modify: `src/components/domain/settings/commissions-grid.tsx`

**Contexto:** Input controlado sem `onChange` bloqueia toda digitação no React. `text-xs` (12px) dispara zoom iOS. Dois bugs com a mesma causa raiz.

- [ ] **Step 1: Reescrever CommissionsGrid**

Substituir o conteúdo de `src/components/domain/settings/commissions-grid.tsx` por:

```typescript
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { useCommissions, useUpsertCommission } from "@/hooks/settings/use-commissions";
import { useQuery } from "@tanstack/react-query";

async function fetchServices() {
  const res = await fetch("/api/scheduling/services");
  if (!res.ok) throw new Error("Erro");
  return res.json();
}

async function fetchProfessionals() {
  const res = await fetch("/api/iam/users");
  if (!res.ok) throw new Error("Erro");
  return res.json();
}

export function CommissionsGrid() {
  const { data: commissions = [] } = useCommissions();
  const { data: services = [] } = useQuery({ queryKey: ["services"], queryFn: fetchServices });
  const { data: professionals = [] } = useQuery({ queryKey: ["professionals"], queryFn: fetchProfessionals });
  const upsert = useUpsertCommission();

  const [localValues, setLocalValues] = useState<Record<string, string>>({});

  function getCellKey(serviceId: string, professionalId: string) {
    return `${serviceId}:${professionalId}`;
  }

  function getCommittedRate(serviceId: string, professionalId: string): string {
    const found = commissions.find(
      (c: { serviceId: string; professionalId: string; rate: number }) =>
        c.serviceId === serviceId && c.professionalId === professionalId,
    );
    return found ? String(Number(found.rate)) : "";
  }

  function getCellValue(serviceId: string, professionalId: string): string {
    const key = getCellKey(serviceId, professionalId);
    return key in localValues ? localValues[key] : getCommittedRate(serviceId, professionalId);
  }

  function handleChange(serviceId: string, professionalId: string, value: string) {
    setLocalValues((prev) => ({ ...prev, [getCellKey(serviceId, professionalId)]: value }));
  }

  function handleBlur(serviceId: string, professionalId: string, value: string) {
    setLocalValues((prev) => {
      const next = { ...prev };
      delete next[getCellKey(serviceId, professionalId)];
      return next;
    });
    if (value === "") return;
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed < 0 || parsed > 100) return;
    upsert.mutate(
      { serviceId, professionalId, rate: parsed },
      { onError: () => toast.error("Erro ao salvar comissão") },
    );
  }

  if (!services.length || !professionals.length) {
    return <div className="h-24 animate-pulse rounded-xl bg-slate-100" />;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-slate-700">Comissões por profissional × serviço (%)</p>
      <div
        className="overflow-x-auto rounded-xl border border-white/80 bg-white/85"
        style={{
          maskImage: 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)',
          WebkitMaskImage: 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)',
        }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Profissional</th>
              {services.map((s: { id: string; name: string }) => (
                <th key={s.id} className="px-3 py-2 text-center text-xs font-semibold text-slate-500">{s.name}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {professionals
              .filter((p: { role: string }) => p.role === "PROFESSIONAL")
              .map((p: { id: string; name: string }) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 font-medium text-slate-800">{p.name}</td>
                  {services.map((s: { id: string }) => (
                    <td key={s.id} className="px-3 py-2 text-center">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        className="h-8 w-16 text-center"
                        style={{ fontSize: '16px' }}
                        value={getCellValue(s.id, p.id)}
                        placeholder="—"
                        onChange={(e) => handleChange(s.id, p.id, e.target.value)}
                        onFocus={(e) => e.target.select()}
                        onBlur={(e) => handleBlur(s.id, p.id, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">Deixe em branco para sem comissão. Salva automaticamente ao sair do campo.</p>
    </div>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "commissions-grid"
```
Esperado: nenhuma linha de erro para esse arquivo.

- [ ] **Step 3: Commit**

```bash
git branch --show-current
git add src/components/domain/settings/commissions-grid.tsx
git commit -m "fix(comissões): corrige edição travada e zoom mobile iOS"
```

---

## Task 3: Item A — Novo layout do AppointmentCard

**Files:**
- Modify: `src/components/domain/scheduling/appointment-card.tsx`

**Contexto:** Layout atual mistura cliente + serviço + profissional numa linha. Ordem nova: badge+lápis → cliente → serviço → horário → botão. Remover profissional. Botões sempre visíveis (tirar `sm:hidden`).

- [ ] **Step 1: Substituir appointment-card.tsx**

```typescript
// src/components/domain/scheduling/appointment-card.tsx
import { Pencil } from 'lucide-react'
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
  onConfirm?: (appointment: Appointment) => void
  onPay?: (appointment: Appointment) => void
  onEdit?: (appointment: Appointment) => void
}

export function AppointmentCard({ appointment, onClick, onConfirm, onPay, onEdit }: Props) {
  const config = STATUS_CONFIG[appointment.status]
  const isActive = !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(appointment.status)
  const serviceName = appointment.service?.name ?? appointment.package?.name ?? appointment.promotion?.name ?? 'Serviço'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(appointment)}
      onKeyDown={(e) => e.key === 'Enter' && onClick(appointment)}
      className={cn('relative w-full cursor-pointer rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md', config.cardClass)}
    >
      {/* Linha 1: status + lápis */}
      <div className="flex items-center justify-between gap-2">
        <Badge className={cn('text-xs', config.badgeClass)}>
          {config.label}
        </Badge>
        {onEdit && isActive && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(appointment) }}
            className="rounded-md border border-slate-200 p-1 text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 transition"
            aria-label="Editar agendamento"
          >
            <Pencil className="size-3.5" />
          </button>
        )}
      </div>

      {/* Linha 2: cliente */}
      <p className="mt-2 truncate text-sm font-semibold text-slate-950">
        {appointment.customer?.name ?? '—'}
      </p>

      {/* Linha 3: serviço */}
      <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">
        {serviceName}
      </p>

      {/* Linha 4: horário */}
      <p className="mt-2 text-xs font-medium text-slate-600">
        {formatTime(appointment.startsAt)} – {formatTime(appointment.endsAt)}
      </p>

      {/* Linha 5: botões de ação */}
      {(() => {
        const showConfirm = !!onConfirm && appointment.status === 'SCHEDULED'
        const showPay = !!onPay && appointment.status === 'CONFIRMED' && appointment.paymentStatus !== 'PAID'
        if (!showConfirm && !showPay) return null
        return (
          <div
            className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3"
            onClick={(e) => e.stopPropagation()}
          >
            {showConfirm && (
              <button
                onClick={() => onConfirm?.(appointment)}
                className="flex w-full items-center justify-center rounded-xl bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100 transition min-h-11"
              >
                Confirmar
              </button>
            )}
            {showPay && (
              <button
                onClick={() => onPay?.(appointment)}
                className="flex w-full items-center justify-center rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition min-h-11"
              >
                Fechar pagamento
              </button>
            )}
          </div>
        )
      })()}
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "appointment-card"
```
Esperado: zero erros.

- [ ] **Step 3: Commit**

```bash
git branch --show-current
git add src/components/domain/scheduling/appointment-card.tsx
git commit -m "feat(agenda): novo layout do card — status, cliente, serviço, horário, ação"
```

---

## Task 4: Item D — Textarea para descrição em Pacotes e Promoções

**Files:**
- Modify: `src/components/domain/services/package-form-modal.tsx` (linha 106)
- Modify: `src/components/domain/services/promotion-form-modal.tsx` (linha 141)

**Contexto:** Descrição usa `<Input>` (linha única). Serviços já usam `<Textarea>`. Mudar para Textarea com suporte a quebra de linha.

- [ ] **Step 1: Atualizar package-form-modal.tsx**

Em `src/components/domain/services/package-form-modal.tsx`, a linha de import já tem `Input`. Adicionar `Textarea` ao import:
```typescript
// ANTES
import { Input } from '@/components/ui/input'
// DEPOIS
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
```

Localizar o bloco do campo de descrição (linha ~104-107):
```tsx
// ANTES
<div className="space-y-2">
  <Label htmlFor="pkg-description">Descrição (opcional)</Label>
  <Input id="pkg-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva o que está incluído" maxLength={500} />
</div>
// DEPOIS
<div className="space-y-2">
  <Label htmlFor="pkg-description">Descrição (opcional)</Label>
  <Textarea
    id="pkg-description"
    value={description}
    onChange={(e) => setDescription(e.target.value)}
    placeholder="Descreva o que está incluído"
    maxLength={500}
    className="min-h-[80px] resize-none"
  />
</div>
```

- [ ] **Step 2: Atualizar promotion-form-modal.tsx**

Em `src/components/domain/services/promotion-form-modal.tsx`, adicionar `Textarea` ao import (que já tem `Input`):
```typescript
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
```

Localizar o bloco de descrição (linha ~139-142):
```tsx
// ANTES
<div className="space-y-2">
  <Label htmlFor="promo-desc">Descrição (opcional)</Label>
  <Input id="promo-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
</div>
// DEPOIS
<div className="space-y-2">
  <Label htmlFor="promo-desc">Descrição (opcional)</Label>
  <Textarea
    id="promo-desc"
    value={description}
    onChange={(e) => setDescription(e.target.value)}
    placeholder="Descreva a promoção"
    maxLength={500}
    className="min-h-[80px] resize-none"
  />
</div>
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "package-form|promotion-form"
```
Esperado: zero erros.

- [ ] **Step 4: Commit**

```bash
git branch --show-current
git add src/components/domain/services/package-form-modal.tsx src/components/domain/services/promotion-form-modal.tsx
git commit -m "feat(serviços): descrição de pacote e promoção aceita quebra de linha"
```

---

## Task 5: Item B — Horário personalizado + botão WhatsApp no drawer

**Files:**
- Modify: `src/components/domain/scheduling/appointment-drawer.tsx`

**Contexto:** No modo edição, o usuário só pode selecionar horários via chips. Adicionar `<input type="time">` para horário livre. No modo visualização, adicionar link WhatsApp se cliente tiver telefone.

- [ ] **Step 1: Campo de horário personalizado no modo edição**

No `appointment-drawer.tsx`, localizar o bloco de horário no modo `isEditing` (após o `{loadingSlots ? ... : slots.length === 0 ? ... : ...}`), adicionar após o `</div>` que fecha os chips:

```tsx
{/* Horário personalizado — alternativa aos chips */}
<div className="mt-2 space-y-1">
  <p className="text-xs text-slate-400">— ou informe um horário —</p>
  <input
    type="time"
    value={editTime}
    onChange={(e) => setEditTime(e.target.value)}
    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    style={{ fontSize: '16px' }}
  />
</div>
```

O `editTime` já é o estado compartilhado — selecionar um chip e digitar no input são a mesma coisa.

- [ ] **Step 2: Botão WhatsApp na view (não edição)**

No modo view do drawer, localizar a seção do cliente (linhas ~385-393):

```tsx
// ANTES
<div>
  <p className="text-xs font-medium text-slate-400 uppercase">Cliente</p>
  <p className="mt-0.5 text-sm font-semibold text-slate-950">
    {appointment.customer.name}
  </p>
  {appointment.customer.phone && (
    <p className="text-xs text-slate-500">{appointment.customer.phone}</p>
  )}
</div>
```

```tsx
// DEPOIS
<div>
  <p className="text-xs font-medium text-slate-400 uppercase">Cliente</p>
  <p className="mt-0.5 text-sm font-semibold text-slate-950">
    {appointment.customer.name}
  </p>
  {appointment.customer.phone && (
    <div className="mt-0.5 flex items-center gap-2">
      <p className="text-xs text-slate-500">{appointment.customer.phone}</p>
      <a
        href={`https://wa.me/55${appointment.customer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
          `Olá, ${appointment.customer.name.split(' ')[0]}! Lembrando do seu agendamento de ${appointment.service?.name ?? appointment.package?.name ?? appointment.promotion?.name ?? 'serviço'} em ${new Date(appointment.startsAt).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })} às ${new Date(appointment.startsAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}h. Te esperamos! 🤍`
        )}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition"
      >
        WhatsApp ↗
      </a>
    </div>
  )}
</div>
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "appointment-drawer"
```
Esperado: zero erros.

- [ ] **Step 4: Commit**

```bash
git branch --show-current
git add src/components/domain/scheduling/appointment-drawer.tsx
git commit -m "feat(agenda): horário personalizado no drawer e link WhatsApp no card do cliente"
```

---

## Task 6: Item C-backend — Schema e service para pacotes/promoções no painel profissional

**Files:**
- Modify: `src/domains/scheduling/types.ts`
- Modify: `src/domains/scheduling/scheduling.service.ts`
- Modify: `src/app/api/scheduling/availability/route.ts`

**Contexto:** O painel profissional só aceita `serviceId` ao criar agendamento. A rota de disponibilidade só aceita `serviceId`. Precisamos suportar `packageId` (para pacotes) e `promotionId` (para promoções — que mantêm `serviceId` do serviço promovido).

- [ ] **Step 1: Atualizar createAppointmentSchema em types.ts**

Localizar `createAppointmentSchema` em `src/domains/scheduling/types.ts` (linha ~45):

```typescript
// ANTES
export const createAppointmentSchema = z.object({
  customerId: z.string().cuid(),
  professionalId: z.string().uuid(),
  serviceId: z.string().cuid(),
  startsAt: z.string().datetime(),
  notes: z.string().trim().max(500).optional(),
  allowOverlap: z.boolean().optional().default(false),
  allowPastDate: z.boolean().optional().default(false),
  notificationMessage: z.string().trim().optional(),
});

// DEPOIS
export const createAppointmentSchema = z.object({
  customerId: z.string().cuid(),
  professionalId: z.string().uuid(),
  serviceId: z.string().cuid().optional(),
  packageId: z.string().cuid().optional(),
  promotionId: z.string().cuid().optional(),
  startsAt: z.string().datetime(),
  notes: z.string().trim().max(500).optional(),
  allowOverlap: z.boolean().optional().default(false),
  allowPastDate: z.boolean().optional().default(false),
  notificationMessage: z.string().trim().optional(),
}).refine((d) => d.serviceId || d.packageId, {
  message: 'serviceId ou packageId é obrigatório',
});
```

- [ ] **Step 2: Atualizar createAppointment no scheduling.service.ts**

Localizar o método `createAppointment` (linha ~103). Substituir o bloco que busca o service e calcula duração/preço:

```typescript
// ANTES (linhas ~111-134)
const service = await catalogServiceRepository.findById(tenantId, input.serviceId);
if (!service) {
  throw new ServiceNotFoundError();
}
// ...
const startsAt = new Date(input.startsAt);
const endsAt = new Date(startsAt.getTime() + service.duration * 60 * 1000);
// ...
return appointmentRepository.create(
  tenantId,
  {
    customerId: input.customerId,
    professionalId: input.professionalId,
    serviceId: input.serviceId,
    startsAt,
    endsAt,
    notes: input.notes,
    price: new Prisma.Decimal(service.price),
    createdByUserId: userId,
    allowOverlap: input.allowOverlap ?? false,
  },
  tx,
);

// DEPOIS
let duration: number;
let price: Prisma.Decimal;
let serviceIdForAppointment: string | undefined = input.serviceId;
let packageIdForAppointment: string | undefined = input.packageId;

if (input.packageId) {
  const pkg = await packageRepository.findById(tenantId, input.packageId);
  if (!pkg) throw new ServiceNotFoundError();
  duration = pkg.items.reduce((s: number, i: { service: { duration: number } }) => s + i.service.duration, 0) || 60;
  price = new Prisma.Decimal(pkg.price);
  serviceIdForAppointment = undefined;
} else {
  const service = await catalogServiceRepository.findById(tenantId, input.serviceId!);
  if (!service) throw new ServiceNotFoundError();
  duration = service.duration;

  if (input.promotionId) {
    const promo = await promotionRepository.findById(tenantId, input.promotionId);
    if (promo) {
      const discountedPrice = promo.discountType === 'PERCENTAGE'
        ? Number(service.price) * (1 - Number(promo.discountValue) / 100)
        : Math.max(0, Number(service.price) - Number(promo.discountValue));
      price = new Prisma.Decimal(discountedPrice.toFixed(2));
    } else {
      price = new Prisma.Decimal(service.price);
    }
  } else {
    price = new Prisma.Decimal(service.price);
  }

  packageIdForAppointment = undefined;
}

// ...
const startsAt = new Date(input.startsAt);
const endsAt = new Date(startsAt.getTime() + duration * 60 * 1000);
// ...
return appointmentRepository.create(
  tenantId,
  {
    customerId: input.customerId,
    professionalId: input.professionalId,
    serviceId: serviceIdForAppointment,
    packageId: packageIdForAppointment,
    promotionId: input.promotionId,
    startsAt,
    endsAt,
    notes: input.notes,
    price,
    createdByUserId: userId,
    allowOverlap: input.allowOverlap ?? false,
  },
  tx,
);
```

**Atenção:** O `packageRepository.findById` pode não existir — verificar em `src/domains/scheduling/package.repository.ts`. Se existir, usar. Se não existir, usar `prisma.servicePackage.findFirst({ where: { id: packageId, tenantId }, include: { items: { include: { service: true } } } })` diretamente.

- [ ] **Step 3: Verificar packageRepository.findById**

```bash
grep -n "findById" c:/dev/estetica-saas/src/domains/scheduling/package.repository.ts
```

Se não existir, adicionar o método ao repositório OU usar o Prisma direto no service (abordagem mais simples para esse caso).

- [ ] **Step 4: Atualizar rota de disponibilidade para aceitar packageId**

Em `src/app/api/scheduling/availability/route.ts`, substituir o `querySchema`:

```typescript
// ANTES
const querySchema = z.object({
  professionalId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  serviceId: z.string().cuid(),
});
// DEPOIS
const querySchema = z.object({
  professionalId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  serviceId: z.string().cuid().optional(),
  packageId: z.string().cuid().optional(),
}).refine((d) => d.serviceId || d.packageId, { message: 'serviceId ou packageId obrigatório' });
```

E substituir o bloco que busca o serviço e gera os slots:

```typescript
// ANTES
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

// DEPOIS
const { professionalId, date, serviceId, packageId } = parsed.data;
const policy = await schedulingPolicyService.getPolicy(session.tenantId);

let duration: number;
if (packageId) {
  const pkg = await prisma.servicePackage.findFirst({
    where: { id: packageId, tenantId: session.tenantId },
    include: { items: { include: { service: { select: { duration: true } } } } },
  });
  if (!pkg) return Response.json({ slots: [] });
  duration = pkg.items.reduce((s, i) => s + i.service.duration, 0) || 60;
} else {
  const service = await catalogServiceRepository.findById(session.tenantId, serviceId!);
  if (!service) return Response.json({ slots: [] });
  duration = service.duration;
}
const slots = await availabilityService.getAvailableSlots(
  session.tenantId,
  professionalId,
  date,
  duration,
  policy.slotIntervalMinutes,
);
```

Adicionar import do prisma se não existir no arquivo: `import { prisma } from "@/shared/database/prisma";`

- [ ] **Step 5: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "types\.ts|scheduling\.service|availability/route"
```
Esperado: zero erros relacionados a esses arquivos.

- [ ] **Step 6: Commit**

```bash
git branch --show-current
git add src/domains/scheduling/types.ts src/domains/scheduling/scheduling.service.ts src/app/api/scheduling/availability/route.ts
git commit -m "feat(agenda): painel profissional suporta criação de agendamento com pacote"
```

---

## Task 7: Item C-hooks — Atualizar tipos dos hooks

**Files:**
- Modify: `src/hooks/scheduling/use-appointments.ts`
- Modify: `src/hooks/scheduling/use-availability.ts`

**Contexto:** `CreateAppointmentInput` no hook só tem `serviceId: string`. `useAvailableSlots` só aceita `serviceId`.

- [ ] **Step 1: Atualizar CreateAppointmentInput em use-appointments.ts**

Localizar `CreateAppointmentInput` (linha ~34):
```typescript
// ANTES
export type CreateAppointmentInput = {
  customerId: string
  professionalId: string
  serviceId: string
  startsAt: string
  notes?: string
  allowOverlap?: boolean
  allowPastDate?: boolean
  notificationMessage?: string
}
// DEPOIS
export type CreateAppointmentInput = {
  customerId: string
  professionalId: string
  serviceId?: string
  packageId?: string
  promotionId?: string
  startsAt: string
  notes?: string
  allowOverlap?: boolean
  allowPastDate?: boolean
  notificationMessage?: string
}
```

- [ ] **Step 2: Atualizar useAvailableSlots em use-availability.ts**

Substituir todo o arquivo:

```typescript
import { useQuery } from '@tanstack/react-query'

export type TimeSlot = {
  time: string
  available: boolean
  bookedBy?: string
}

async function fetchSlots(
  professionalId: string,
  date: string,
  serviceId: string | null,
  packageId: string | null,
): Promise<TimeSlot[]> {
  const url = new URL('/api/scheduling/availability', window.location.origin)
  url.searchParams.set('professionalId', professionalId)
  url.searchParams.set('date', date)
  if (serviceId) url.searchParams.set('serviceId', serviceId)
  if (packageId) url.searchParams.set('packageId', packageId)
  const res = await fetch(url)
  if (!res.ok) throw new Error('Falha ao carregar horários')
  const data: { slots: TimeSlot[] } = await res.json()
  return data.slots
}

export function useAvailableSlots(
  professionalId: string | null,
  date: string | null,
  serviceId: string | null,
  packageId?: string | null,
) {
  return useQuery({
    queryKey: ['availability', professionalId, date, serviceId, packageId ?? null],
    queryFn: () => fetchSlots(professionalId!, date!, serviceId, packageId ?? null),
    enabled: !!(professionalId && date && (serviceId || packageId)),
    staleTime: 30 * 1000,
  })
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "use-appointments|use-availability"
```
Esperado: zero erros relacionados a esses arquivos. Pode haver erros em callers — serão corrigidos nas tasks seguintes.

- [ ] **Step 4: Commit**

```bash
git branch --show-current
git add src/hooks/scheduling/use-appointments.ts src/hooks/scheduling/use-availability.ts
git commit -m "feat(hooks): atualiza tipos para suportar packageId/promotionId"
```

---

## Task 8: Item C-picker — ServicePickerWithCategories unificado

**Files:**
- Modify: `src/components/domain/services/service-picker-with-categories.tsx`

**Contexto:** Picker atual só mostra serviços. Precisa de chips "Pacote" e "Promoção" e renderizar cards diferentes para cada tipo.

- [ ] **Step 1: Substituir service-picker-with-categories.tsx**

```typescript
'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDuration } from '@/lib/format-duration'
import { Input } from '@/components/ui/input'
import { EntityImage } from '@/components/domain/shared/entity-image'

export type PickerService = {
  id: string
  name: string
  duration: number
  price: string | number
  priceType?: string
  priceMax?: string | number | null
  description?: string | null
  imageUrl?: string | null
  imageCropX?: number | null
  imageCropY?: number | null
  imageCropZoom?: number | null
  categoryId?: string | null
  categoryName?: string | null
  category?: { id: string; name: string } | null
}

export type PickerPackage = {
  id: string
  name: string
  description?: string | null
  price: string | number
  imageUrl?: string | null
  imageCropX?: number | null
  imageCropY?: number | null
  imageCropZoom?: number | null
  items: Array<{ service: { id: string; name: string; duration: number } }>
}

export type PickerPromotion = {
  id: string
  name: string
  description?: string | null
  discountType: 'PERCENTAGE' | 'FIXED'
  discountValue: string | number
  imageUrl?: string | null
  imageCropX?: number | null
  imageCropY?: number | null
  imageCropZoom?: number | null
  items: Array<{
    serviceId: string | null
    service: { id: string; name: string; price: string | number; duration?: number } | null
  }>
}

export type PickerSelection =
  | { type: 'service'; item: PickerService }
  | { type: 'package'; item: PickerPackage }
  | { type: 'promotion'; promotionId: string; service: { id: string; name: string; price: number; duration: number } }

type Category = {
  id: string
  name: string
}

type Props = {
  services: PickerService[]
  packages?: PickerPackage[]
  promotions?: PickerPromotion[]
  categories: Category[]
  selectedId?: string | null
  onSelect: (selection: PickerSelection) => void
}

const PACOTE_ID = '__pacote__'
const PROMO_ID = '__promo__'
const OUTROS_ID = '__outros__'

function normalize(text: string): string {
  return text
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export function ServicePickerWithCategories({ services, packages = [], promotions = [], categories, selectedId, onSelect }: Props) {
  const [search, setSearch] = useState('')
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)

  function formatPrice(price: string | number, priceType?: string): string {
    const num = Number(price)
    const formatted = num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    if (priceType === 'STARTING_FROM') return `A partir de ${formatted}`
    return formatted
  }

  const uncategorized = services.filter((s) => !s.categoryId)
  const categorized = categories.filter((cat) => services.some((s) => s.categoryId === cat.id))

  const chips: Array<{ id: string | null; label: string }> = [
    { id: null, label: 'Todos' },
    ...categorized.map((cat) => ({ id: cat.id, label: cat.name })),
    ...(uncategorized.length > 0 ? [{ id: OUTROS_ID, label: 'Outros' }] : []),
    ...(packages.length > 0 ? [{ id: PACOTE_ID, label: 'Pacote' }] : []),
    ...(promotions.length > 0 ? [{ id: PROMO_ID, label: 'Promoção' }] : []),
  ]

  const isSearching = search.trim().length > 0
  const term = normalize(search.trim())

  const visibleServices = useMemo(() => {
    if (activeCategoryId === PACOTE_ID || activeCategoryId === PROMO_ID) return []
    if (isSearching) {
      return services.filter(
        (s) => normalize(s.name).includes(term) || (s.description ? normalize(s.description).includes(term) : false),
      )
    }
    if (activeCategoryId === null) return services
    if (activeCategoryId === OUTROS_ID) return uncategorized
    return services.filter((s) => s.categoryId === activeCategoryId)
  }, [isSearching, term, services, activeCategoryId, uncategorized])

  const visiblePackages = useMemo(() => {
    if (activeCategoryId !== null && activeCategoryId !== PACOTE_ID) return []
    if (isSearching) return packages.filter((p) => normalize(p.name).includes(term))
    if (activeCategoryId === PACOTE_ID) return packages
    return packages
  }, [isSearching, term, packages, activeCategoryId])

  const visiblePromotions = useMemo(() => {
    if (activeCategoryId !== null && activeCategoryId !== PROMO_ID) return []
    if (isSearching) return promotions.filter((p) => normalize(p.name).includes(term))
    if (activeCategoryId === PROMO_ID) return promotions
    return promotions
  }, [isSearching, term, promotions, activeCategoryId])

  function renderServiceCard(service: PickerService) {
    const isSelected = selectedId === service.id
    return (
      <button
        key={service.id}
        type="button"
        onClick={() => onSelect({ type: 'service', item: service })}
        className={cn(
          'group relative flex w-32 shrink-0 flex-col overflow-hidden rounded-2xl border text-left transition-all sm:w-36',
          isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border/50 hover:border-primary/40',
        )}
      >
        <EntityImage
          src={service.imageUrl}
          alt={service.name}
          shape="portrait"
          cropX={service.imageCropX}
          cropY={service.imageCropY}
          cropZoom={service.imageCropZoom}
          className="w-full rounded-none"
          fallback={<span className="text-2xl text-muted-foreground/30">✂</span>}
        />
        <div className="flex flex-1 flex-col gap-1 p-3">
          <span className="text-sm font-medium leading-tight line-clamp-2">{service.name}</span>
          {service.description && (
            <span className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-line">{service.description}</span>
          )}
          <div className="mt-auto pt-1">
            <span className="text-xs font-semibold text-primary">{formatPrice(service.price, service.priceType)}</span>
            <span className="block text-xs text-muted-foreground">{formatDuration(service.duration)}</span>
          </div>
        </div>
        {isSelected && (
          <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
            <span className="text-[10px] text-primary-foreground">✓</span>
          </div>
        )}
      </button>
    )
  }

  function renderPackageCard(pkg: PickerPackage) {
    const totalDuration = pkg.items.reduce((s, i) => s + i.service.duration, 0)
    return (
      <button
        key={pkg.id}
        type="button"
        onClick={() => onSelect({ type: 'package', item: pkg })}
        className="w-full text-left rounded-2xl border border-border/50 bg-white p-4 hover:border-primary/40 transition-all"
      >
        <div className="flex items-start gap-3">
          {pkg.imageUrl && (
            <EntityImage
              src={pkg.imageUrl}
              alt={pkg.name}
              shape="portrait"
              cropX={pkg.imageCropX}
              cropY={pkg.imageCropY}
              cropZoom={pkg.imageCropZoom}
              className="w-14 shrink-0 rounded-xl"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-medium text-slate-900">{pkg.name}</p>
            {pkg.description && (
              <p className="text-xs text-slate-500 mt-0.5 whitespace-pre-line line-clamp-2">{pkg.description}</p>
            )}
            <p className="text-xs text-slate-500 mt-1">
              {pkg.items.map((i) => i.service.name).join(' + ')}
              {' · '}
              {formatDuration(totalDuration)}
            </p>
            <p className="text-sm font-semibold text-primary mt-1">{formatPrice(pkg.price)}</p>
          </div>
        </div>
      </button>
    )
  }

  function renderPromotionCard(promo: PickerPromotion) {
    const serviceItems = promo.items.filter((i) => i.service !== null)
    return (
      <div key={promo.id} className="rounded-2xl border border-border/50 bg-white p-4">
        <div className="mb-2">
          <p className="font-medium text-slate-900">{promo.name}</p>
          {promo.description && (
            <p className="text-xs text-slate-500 mt-0.5 whitespace-pre-line">{promo.description}</p>
          )}
          <p className="text-xs text-emerald-600 mt-0.5">
            {promo.discountType === 'PERCENTAGE' ? `${promo.discountValue}% de desconto` : `R$ ${Number(promo.discountValue).toFixed(2)} de desconto`}
          </p>
        </div>
        <div className="space-y-2">
          {serviceItems.map((item) => {
            if (!item.service || !item.serviceId) return null
            const originalPrice = Number(item.service.price)
            const discountedPrice = promo.discountType === 'PERCENTAGE'
              ? originalPrice * (1 - Number(promo.discountValue) / 100)
              : Math.max(0, originalPrice - Number(promo.discountValue))
            return (
              <button
                key={item.serviceId}
                type="button"
                onClick={() => onSelect({
                  type: 'promotion',
                  promotionId: promo.id,
                  service: {
                    id: item.serviceId!,
                    name: item.service.name,
                    price: discountedPrice,
                    duration: item.service.duration ?? 0,
                  },
                })}
                className="w-full text-left rounded-xl border border-slate-100 p-3 hover:border-primary/40 transition-all"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-900">{item.service.name}</span>
                  <span className="shrink-0 text-sm font-semibold text-emerald-600">
                    R$ {discountedPrice.toFixed(2).replace('.', ',')}
                  </span>
                </div>
                <span className="text-xs text-slate-400 line-through">
                  R$ {originalPrice.toFixed(2).replace('.', ',')}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const hasResults = visibleServices.length > 0 || visiblePackages.length > 0 || visiblePromotions.length > 0

  return (
    <div className="min-w-0 space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar serviço..."
          className="pl-9"
        />
      </div>

      {!isSearching && chips.length > 1 && (
        <div className="flex min-w-0 touch-pan-x gap-2 overflow-x-auto overscroll-x-contain pb-1 scrollbar-none">
          {chips.map((chip) => (
            <button
              key={chip.id ?? 'all'}
              type="button"
              onClick={() => setActiveCategoryId(chip.id)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                activeCategoryId === chip.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-muted-foreground hover:border-primary/50',
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {!hasResults ? (
        <p className="text-center text-sm text-muted-foreground py-6">
          {isSearching ? `Nenhum item encontrado para "${search.trim()}".` : 'Nenhum item disponível.'}
        </p>
      ) : (
        <div className="space-y-3">
          {visibleServices.length > 0 && (
            <div className="flex min-w-0 touch-pan-x gap-3 overflow-x-auto overscroll-x-contain pb-1 scrollbar-none">
              {visibleServices.map((s) => renderServiceCard(s))}
            </div>
          )}
          {visiblePackages.length > 0 && (
            <div className="space-y-2">
              {visiblePackages.map((p) => renderPackageCard(p))}
            </div>
          )}
          {visiblePromotions.length > 0 && (
            <div className="space-y-3">
              {visiblePromotions.map((p) => renderPromotionCard(p))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "service-picker"
```
Pode haver erros nos callers (service-step.tsx, create-appointment-modal.tsx) — serão corrigidos nas tasks 9 e 10.

- [ ] **Step 3: Commit**

```bash
git branch --show-current
git add src/components/domain/services/service-picker-with-categories.tsx
git commit -m "feat(picker): chips unificados para serviços, pacotes e promoções"
```

---

## Task 9: Item C — service-step.tsx atualizado (vitrine pública)

**Files:**
- Modify: `src/components/domain/booking/service-step.tsx`

**Contexto:** Hoje usa `<Tabs>` para separar Serviços/Pacotes/Promoções. Agora usa o picker unificado. A assinatura de `onSelect` mudou: era `(PickerService) => void`, agora é `(PickerSelection) => void`.

- [ ] **Step 1: Substituir service-step.tsx**

```typescript
'use client'

import type { PublicPackage, PublicPromotion, PublicService } from '@/app/(public)/agendar/[slug]/types'
import {
  ServicePickerWithCategories,
  type PickerService,
  type PickerPackage,
  type PickerPromotion,
  type PickerSelection,
} from '@/components/domain/services/service-picker-with-categories'

function deriveCategories(services: PublicService[]): Array<{ id: string; name: string }> {
  const seen = new Set<string>()
  const result: Array<{ id: string; name: string }> = []
  for (const s of services) {
    if (s.categoryId && s.categoryName && !seen.has(s.categoryId)) {
      seen.add(s.categoryId)
      result.push({ id: s.categoryId, name: s.categoryName })
    }
  }
  return result
}

function toPickerService(s: PublicService): PickerService {
  return {
    id: s.id,
    name: s.name,
    duration: s.duration,
    price: s.price,
    priceType: s.priceType,
    priceMax: s.priceMax,
    description: s.description,
    imageUrl: s.imageUrl,
    categoryId: s.categoryId,
    categoryName: s.categoryName,
  }
}

function toPickerPackage(p: PublicPackage): PickerPackage {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price,
    imageUrl: p.imageUrl ?? null,
    imageCropX: p.imageCropX ?? null,
    imageCropY: p.imageCropY ?? null,
    imageCropZoom: p.imageCropZoom ?? null,
    items: p.services.map((s) => ({
      service: { id: s.id, name: s.name, duration: s.duration },
    })),
  }
}

function toPickerPromotion(p: PublicPromotion): PickerPromotion {
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    discountType: p.discountType,
    discountValue: p.discountValue,
    imageUrl: p.imageUrl ?? null,
    imageCropX: p.imageCropX ?? null,
    imageCropY: p.imageCropY ?? null,
    imageCropZoom: p.imageCropZoom ?? null,
    items: p.services.map((s) => ({
      serviceId: s.id,
      service: { id: s.id, name: s.name, price: String(s.originalPrice), duration: s.duration },
    })),
  }
}

export type PromotionServiceSelection = {
  id: string
  name: string
  duration: number
  discountedPrice: number
}

export function ServiceStep({
  services,
  onSelect,
  packages,
  promotions,
  onPackageSelect,
  onPromotionServiceSelect,
}: {
  services: PublicService[]
  onSelect: (service: PublicService) => void
  primaryColor: string
  packages?: PublicPackage[]
  promotions?: PublicPromotion[]
  onPackageSelect?: (pkg: PublicPackage) => void
  onPromotionServiceSelect?: (promotionId: string, service: PromotionServiceSelection) => void
}) {
  const categories = deriveCategories(services)

  function handleSelect(selection: PickerSelection) {
    if (selection.type === 'service') {
      const original = services.find((s) => s.id === selection.item.id)
      if (original) onSelect(original)
    } else if (selection.type === 'package') {
      const original = packages?.find((p) => p.id === selection.item.id)
      if (original) onPackageSelect?.(original)
    } else if (selection.type === 'promotion') {
      const promo = promotions?.find((p) => p.id === selection.promotionId)
      if (!promo) return
      const svc = promo.services.find((s) => s.id === selection.service.id)
      if (!svc) return
      const discountedPrice = promo.discountType === 'PERCENTAGE'
        ? svc.originalPrice * (1 - promo.discountValue / 100)
        : Math.max(0, svc.originalPrice - promo.discountValue)
      onPromotionServiceSelect?.(promo.id, {
        id: svc.id,
        name: svc.name,
        duration: svc.duration,
        discountedPrice,
      })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Escolha o serviço</h2>
        <p className="text-sm text-slate-500 mt-1">Selecione o serviço que deseja agendar</p>
      </div>
      <ServicePickerWithCategories
        services={services.map(toPickerService)}
        packages={packages?.map(toPickerPackage)}
        promotions={promotions?.map(toPickerPromotion)}
        categories={categories}
        onSelect={handleSelect}
      />
    </div>
  )
}
```

**Atenção:** Verificar se `PublicPackage` e `PublicPromotion` em `src/app/(public)/agendar/[slug]/types.ts` têm `imageCropX/Y/Zoom`, `description`, `discountType`, `discountValue`. Se não tiverem, usar `undefined` com `??`.

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "service-step"
```
Corrigir quaisquer erros de tipo (campos não existentes no PublicPackage/PublicPromotion).

- [ ] **Step 3: Commit**

```bash
git branch --show-current
git add src/components/domain/booking/service-step.tsx
git commit -m "feat(vitrine): seletor unificado substitui abas de serviços/pacotes/promoções"
```

---

## Task 10: Item C — create-appointment-modal.tsx atualizado (painel profissional)

**Files:**
- Modify: `src/components/domain/scheduling/create-appointment-modal.tsx`

**Contexto:** O modal hoje só usa serviços. Precisa de state para pacote/promoção, slots para pacote, mensagem de confirmação correta, e submit com `packageId`/`promotionId`.

- [ ] **Step 1: Adicionar imports e hooks no topo do componente**

Adicionar ao bloco de imports existente:
```typescript
import { usePackages, type ServicePackage } from '@/hooks/scheduling/use-packages'
import { usePromotions, type Promotion } from '@/hooks/scheduling/use-promotions'
import type { PickerSelection } from '@/components/domain/services/service-picker-with-categories'
import type { PickerPackage, PickerPromotion } from '@/components/domain/services/service-picker-with-categories'
```

Dentro do componente, adicionar os hooks:
```typescript
const { data: packages = [] } = usePackages()
const { data: promotions = [] } = usePromotions()
```

- [ ] **Step 2: Adicionar estados para pacote/promoção**

Após `const [serviceId, setServiceId] = useState('')`, adicionar:
```typescript
const [packageId, setPackageId] = useState('')
const [promotionId, setPromotionId] = useState('')
const [selectedItemName, setSelectedItemName] = useState('')
```

- [ ] **Step 3: Atualizar useAvailableSlots para suportar packageId**

Localizar a chamada de `useAvailableSlots`:
```typescript
// ANTES
const { data: slots = [], isLoading: loadingSlots } = useAvailableSlots(
    professionalId || null,
    date || null,
    serviceId || null,
  )
// DEPOIS
const { data: slots = [], isLoading: loadingSlots } = useAvailableSlots(
    professionalId || null,
    date || null,
    serviceId || null,
    packageId || null,
  )
```

- [ ] **Step 4: Atualizar handler de seleção de serviço**

Substituir `onSelect={(s) => setServiceId(s.id)}` por um handler que trata todos os tipos:

```typescript
function handlePickerSelect(selection: PickerSelection) {
  // Limpa todos os estados de seleção
  setServiceId('')
  setPackageId('')
  setPromotionId('')
  setSelectedTime('')
  setCustomTime('')

  if (selection.type === 'service') {
    setServiceId(selection.item.id)
    setSelectedItemName(selection.item.name)
  } else if (selection.type === 'package') {
    setPackageId(selection.item.id)
    setSelectedItemName(selection.item.name)
    // Reseta profissional para forçar nova seleção (profissional por serviço não se aplica a pacotes)
    if (canManage) setProfessionalId('')
  } else if (selection.type === 'promotion') {
    setServiceId(selection.service.id)
    setPromotionId(selection.promotionId)
    setSelectedItemName(selection.service.name)
  }
}
```

- [ ] **Step 5: Atualizar useEffect de mensagem de confirmação**

O `useEffect` que gera `notificationMessage` usa `services.find((s) => s.id === serviceId)`. Atualizar para usar `selectedItemName`:

```typescript
useEffect(() => {
  if (!customerId || (!serviceId && !packageId) || !date || !selectedTime || !professionalId) return

  const customerName = defaultCustomerName
    ? defaultCustomerName.split(' ')[0]
    : customers.find((c) => c.id === customerId)?.name.split(' ')[0]
  const professional = teamMembers.find((m) => m.id === professionalId)
  if (!customerName || !selectedItemName || !professional) return

  setNotificationMessage(
    renderConfirmTemplate({
      nome: customerName,
      serviço: selectedItemName,
      data: formatDateLabel(date),
      hora: formatHour(selectedTime),
      profissional: professional.name.split(' ')[0],
    }),
  )
}, [customerId, serviceId, packageId, selectedItemName, date, selectedTime, professionalId, customers, teamMembers, defaultCustomerName])
```

- [ ] **Step 6: Atualizar handleClose para limpar novos estados**

```typescript
function handleClose() {
  setProfessionalId(canManage ? '' : (currentUser?.id ?? ''))
  setServiceId('')
  setPackageId('')
  setPromotionId('')
  setSelectedItemName('')
  setDate(defaultDate ?? toDateInput(new Date()))
  setSelectedTime('')
  setCustomTime('')
  setCustomerSearch('')
  setCustomerId(defaultCustomerId ?? '')
  setAllowOverlap(false)
  setAllowPastDate(false)
  setNotificationMessage('')
  onClose()
}
```

- [ ] **Step 7: Atualizar handleSubmit**

```typescript
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  if (!customerId || (!serviceId && !packageId) || !professionalId || !date || !selectedTime) return

  const startsAt = new Date(`${date}T${selectedTime}:00`).toISOString()

  createAppointment.mutate(
    {
      customerId,
      professionalId,
      ...(serviceId ? { serviceId } : {}),
      ...(packageId ? { packageId } : {}),
      ...(promotionId ? { promotionId } : {}),
      startsAt,
      allowOverlap,
      allowPastDate,
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
```

- [ ] **Step 8: Atualizar isFormValid e o uso do picker**

```typescript
// ANTES
const isFormValid = customerId && serviceId && professionalId && date && selectedTime
// DEPOIS
const isFormValid = customerId && (serviceId || packageId) && professionalId && date && selectedTime
```

No JSX, substituir `<ServicePickerWithCategories>`:
```tsx
// ANTES
<ServicePickerWithCategories
  services={activeServices}
  categories={categories}
  selectedId={serviceId}
  onSelect={(s) => setServiceId(s.id)}
/>
// DEPOIS — importar toPickerPackage e toPickerPromotion ou converter inline
<ServicePickerWithCategories
  services={activeServices}
  categories={categories}
  packages={packages.filter((p) => p.active).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    price: p.price,
    imageUrl: p.imageUrl ?? null,
    imageCropX: p.imageCropX ?? null,
    imageCropY: p.imageCropY ?? null,
    imageCropZoom: p.imageCropZoom ?? null,
    items: p.items.map((i) => ({ service: i.service })),
  }))}
  promotions={promotions.filter((p) => p.active && !p.expired).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    discountType: p.discountType,
    discountValue: p.discountValue,
    imageUrl: p.imageUrl ?? null,
    imageCropX: p.imageCropX ?? null,
    imageCropY: p.imageCropY ?? null,
    imageCropZoom: p.imageCropZoom ?? null,
    items: p.items
      .filter((i) => i.service !== null)
      .map((i) => ({
        serviceId: i.serviceId,
        service: i.service ? { id: i.service.id, name: i.service.name, price: i.service.price } : null,
      })),
  }))}
  selectedId={serviceId || packageId || undefined}
  onSelect={handlePickerSelect}
/>
```

- [ ] **Step 9: Atualizar lógica de profissionais por serviço**

```typescript
// ANTES
const { data: professionalsByService } = useProfessionalsByService(serviceId || null)
// DEPOIS — para pacotes, não filtra por serviço
const { data: professionalsByService } = useProfessionalsByService(serviceId || null)
```
(sem mudança — pacotes sem serviceId retornam null, e a lógica existente `serviceId && professionalsByService` já trata esse caso corretamente)

- [ ] **Step 10: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -50
```
Corrigir todos os erros. Erros comuns esperados: campos não existentes em `ServicePackage` (verificar o tipo no hook).

- [ ] **Step 11: Commit**

```bash
git branch --show-current
git add src/components/domain/scheduling/create-appointment-modal.tsx
git commit -m "feat(agenda): modal de criação suporta agendamento de pacotes e promoções"
```

---

## Verificação Final

- [ ] **Rodar TypeScript completo**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules"
```
Esperado: zero erros nos arquivos modificados.

- [ ] **Verificar branch**

```bash
git log --oneline -10
```
Esperado: 10 commits da sessão presentes, todos na branch `fix/agenda-ux-pencil-products`.

- [ ] **Commit final de documentação**

```bash
git add docs/
git commit -m "docs: atualiza memory e marca spec como implementado"
```
