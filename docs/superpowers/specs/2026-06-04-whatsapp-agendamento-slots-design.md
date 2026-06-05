# Spec: WhatsApp na Criação/Cancelamento + Fix de Disponibilidade + Slots

**Data:** 2026-06-04
**Status:** Aprovado pelo usuário

---

## Resumo

Quatro melhorias no fluxo de agendamento:

1. Campo de mensagem WhatsApp editável no modal de criação de agendamento
2. Modal de confirmação com mensagem WhatsApp editável no cancelamento
3. Correção do bug de timezone no serviço de disponibilidade
4. Grade de slots com informação de conflito e input de horário personalizado

---

## Contexto

O `RescheduleModal` já possui campo de mensagem editável que é enviado via WhatsApp ao remarcar. Os fluxos de criação e cancelamento disparam notificações silenciosamente no servidor (via subscriptions de evento), mas sem campo editável no front.

O `AvailabilityService.getAvailableSlots` não usa timezone do tenant ao criar objetos Date — gera slots em UTC do servidor, mas os agendamentos são armazenados com offset do browser do cliente. Isso faz slots ocupados aparecerem como disponíveis na UI.

---

## Feature 1 — WhatsApp na Criação

### Frontend — `CreateAppointmentModal`

- Adicionar estado `notificationMessage: string`
- `useEffect` auto-preenche quando `customerId + serviceId + date + selectedTime + professionalId` estão todos preenchidos
- Template de pré-preenchimento:
  ```
  "Olá, {nome}! Seu agendamento de {serviço} foi criado para {data} às {hora} com {profissional}. Te esperamos! 🤍"
  ```
  Onde `{nome}` = primeiro nome do cliente, `{data}` = data formatada em PT-BR (ex: "quarta-feira, 04 de junho"), `{hora}` = horário no formato "09h00"
- `Textarea` exibido quando o form está completo, com label "Mensagem enviada ao cliente via WhatsApp"
- Aviso se cliente não tem telefone cadastrado
- `notificationMessage` passado na mutation de criação

### Hook — `useCreateAppointment`

- Payload do `mutationFn` adiciona `notificationMessage?: string`
- Função `createAppointment` na camada de API aceita e passa o campo

### API Route — `POST /api/scheduling/appointments`

- Zod schema adiciona `notificationMessage: z.string().optional()`
- Passa para o service

### Scheduling Service — `create()`

- Input aceita `notificationMessage?: string`
- Inclui no payload do evento `scheduling.appointment.created`:
  ```typescript
  { ..., notificationMessage: input.notificationMessage }
  ```

### Subscription — `scheduling.appointment.created`

- Se `payload.notificationMessage` presente, passa `message: payload.notificationMessage` no `logAndDispatch`

### Evolution Provider — `appointment-created`

- Se `payload.message` presente, retorna diretamente (padrão já usado em `appointment-rescheduled`):
  ```typescript
  if (payload.message) return payload.message;
  ```
- Caso contrário, mantém o template configurado

---

## Feature 2 — WhatsApp no Cancelamento

### Novo componente — `CancelAppointmentModal`

**Arquivo:** `src/components/domain/scheduling/cancel-appointment-modal.tsx`

**Props:**
```typescript
type Props = {
  appointment: Appointment | null
  open: boolean
  onClose: () => void
}
```

**Comportamento:**
- Estado `message: string`
- `useEffect` auto-preenche ao abrir com:
  ```
  "Olá, {nome}! Seu agendamento de {serviço} foi cancelado. Para reagendar, fale conosco. 😊"
  ```
- `Textarea` editável com label "Mensagem enviada ao cliente via WhatsApp"
- Aviso se cliente sem telefone
- Botões: "Voltar" (fecha) / "Confirmar cancelamento" (chama mutation com `CANCELLED` + `message`)

### `AppointmentDrawer`

- Adicionar estado `cancelModalOpen: boolean`
- Botão "Cancelar" passa a executar `setCancelModalOpen(true)` em vez de `handleStatus('CANCELLED')` diretamente
- Renderiza `<CancelAppointmentModal appointment={appointment} open={cancelModalOpen} onClose={() => setCancelModalOpen(false)} />`

### Hook — `useUpdateAppointmentStatus`

- Payload adiciona `notificationMessage?: string`
- Passado apenas quando `status === 'CANCELLED'`

### API Route — `PATCH /api/scheduling/appointments/[id]/status`

- Zod schema adiciona `notificationMessage: z.string().optional()`
- Passa para o service

### Scheduling Service — `updateStatus()`

- Para `CANCELLED`, inclui `notificationMessage` no payload do evento

### Subscription — `scheduling.appointment.cancelled`

- Se `payload.notificationMessage` presente, passa como `message` no `logAndDispatch`

### Evolution Provider — `appointment-cancelled`

- Se `payload.message` presente, retorna diretamente (mesmo padrão de `appointment-created`)

---

## Feature 3 — Fix de Timezone na Disponibilidade

### Causa raiz

`getAvailableSlots` em `availability.service.ts` cria objetos Date sem timezone:

```typescript
// Bug: interpreta como UTC no servidor (Vercel)
const slotStart = new Date(`${date}T${minutesToTime(min)}:00`);
const dayStart = new Date(date + "T00:00:00");
```

Appointments são armazenados com offset do browser (UTC-3 para Brasil), criando divergência de 3h na comparação de conflitos.

### Fix — `src/lib/dates.ts`

Adicionar helper exportado:

```typescript
/**
 * Converte data local (string "YYYY-MM-DD" + "HH:MM") no timezone dado para UTC.
 */
export function localDateTimeToUtc(dateStr: string, timeStr: string, tz: string): Date {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, m] = timeStr.split(':').map(Number);
  const approxUtc = new Date(Date.UTC(y, mo - 1, d, h, m, 0));
  const offsetMs = tzOffsetMs(tz, approxUtc);
  return new Date(approxUtc.getTime() + offsetMs);
}
```

### Fix — `availability.service.ts`

- Adicionar método `getTenantTimezone(tenantId)` no `IamRepository` (query `{ select: { timezone: true } }`)
- Em `getAvailableSlots`:
  - Buscar timezone do tenant: `const tz = await iamRepo.getTenantTimezone(tenantId) ?? 'America/Sao_Paulo'`
  - Substituir `dayStart`/`dayEnd` por `dayBoundsInTz(tz, new Date(date + 'T12:00:00Z'))`
  - Substituir criação de `slotStart`/`slotEnd` por `localDateTimeToUtc(date, minutesToTime(min), tz)`

---

## Feature 4 — Slots com Conflito + Horário Personalizado

### API — `TimeSlot` type

```typescript
export type TimeSlot = {
  time: string;
  available: boolean;
  bookedBy?: string; // primeiro nome do cliente com conflito, se houver
}
```

### `getAvailableSlots` — query de appointments

```typescript
// Antes:
select: { startsAt: true, endsAt: true }

// Depois:
select: { startsAt: true, endsAt: true, customer: { select: { name: true } } }
```

No loop de slots:
```typescript
const conflictingAppt = existingAppointments.find(
  (a) => a.startsAt < slotEnd && a.endsAt > slotStart,
);
slots.push({
  time: minutesToTime(min),
  available: !conflictingAppt,
  bookedBy: conflictingAppt?.customer.name.split(' ')[0],
});
```

### `CreateAppointmentModal` — grade de slots

- **Remover** o filtro `visibleSlots = allowOverlap ? slots : slots.filter(s => s.available)`
- Exibir **todos** os slots sempre
- Slot ocupado (`!slot.available`):
  - Texto do horário com `line-through`
  - Nome do cliente abaixo do horário (ex: "Maria") em fonte menor
  - `disabled` quando `allowOverlap=false`, clicável quando `allowOverlap=true`
  - Borda laranja quando `allowOverlap=true` e selecionado (indica conflito ciente)

**Layout do card ocupado:**
```
┌──────────┐
│ ~~10:00~~│
│  Maria   │
└──────────┘
```

### Input de horário personalizado

Abaixo da grade, visível quando `professionalId + serviceId + date` estão preenchidos:

```
Label: "Ou informe um horário específico:"
<input type="time" />
```

- Digitar no input → desmarca slot da grade, atualiza `selectedTime`
- Selecionar slot → atualiza input e `selectedTime`
- Sem verificação prévia de disponibilidade para horários personalizados — validação ocorre no servidor via `ensureSlotAvailable`

---

## Arquivos criados/modificados

| Arquivo | Operação |
|---|---|
| `src/components/domain/scheduling/create-appointment-modal.tsx` | Modificar |
| `src/components/domain/scheduling/cancel-appointment-modal.tsx` | Criar |
| `src/components/domain/scheduling/appointment-drawer.tsx` | Modificar |
| `src/hooks/scheduling/use-appointments.ts` | Modificar |
| `src/app/api/scheduling/appointments/route.ts` | Modificar |
| `src/app/api/scheduling/appointments/[id]/status/route.ts` | Modificar |
| `src/domains/scheduling/scheduling.service.ts` | Modificar |
| `src/domains/scheduling/availability.service.ts` | Modificar |
| `src/domains/notifications/subscriptions.ts` | Modificar |
| `src/domains/notifications/providers/evolution.provider.ts` | Modificar |
| `src/lib/dates.ts` | Modificar (novo helper) |
| `src/domains/iam/iam.repository.ts` | Modificar (novo método) |

---

## Fora de escopo

- Twilio Provider: não suporta texto livre (usa template SIDs). Mantém comportamento atual — Evolution é o provider primário e suporta o texto customizado.
- Horário personalizado não tem verificação de disponibilidade em tempo real na UI — aceito como trade-off.
- Testes: cobertos pelo plano de implementação.
