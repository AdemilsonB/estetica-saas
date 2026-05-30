# Portal de Agendamento Público — Design Spec

**Data:** 2026-05-29
**Status:** Aprovado

---

## Objetivo

Criar o portal público `/agendar/[slug]` — link compartilhável que permite qualquer cliente agendar um serviço sem criar conta. Popula o link `{{8}}` nos templates WhatsApp Twilio (atualmente retorna 404).

---

## Arquitetura

### Rota pública no App Router

```
app/agendar/[slug]/page.tsx       ← Server Component, carrega dados iniciais
app/agendar/[slug]/not-found.tsx  ← 404 customizado se slug inválido
```

Sem autenticação, sem cookie de sessão. O slug identifica o tenant. O `tenantId` é resolvido internamente pelo backend via `resolveTenant(slug)` — nunca exposto ao cliente.

### Camada de API pública

Três endpoints sob `/api/public/[slug]/`:

| Endpoint | Método | Propósito |
|---|---|---|
| `/api/public/[slug]/info` | GET | Dados iniciais: tenant branding + services + professionals |
| `/api/public/[slug]/slots` | GET | Horários disponíveis para professionalId + date |
| `/api/public/[slug]/appointments` | POST | Cria agendamento |

### Novo service

`PublicBookingService` — orquestra a criação pública de agendamentos:
1. `resolveTenant(slug)`
2. `availabilityService.ensureSlotAvailable()`
3. `customerRepository.findByPhone()` → find-or-create com `consentGiven: true`
4. `prisma.appointment.create({ ..., createdByUserId: null })`
5. `notificationService.sendConfirmation()` — fire-and-forget

### Schema change obrigatória

`Appointment.createdByUserId` muda de `String` para `String?` (nullable).  
**Motivo:** agendamentos públicos têm `NULL` neste campo — semanticamente correto, sem dados fantasma.

### Componentes reutilizados

- `CustomerRepository.findByPhone(tenantId, phone)`
- `AvailabilityService.ensureSlotAvailable(tenantId, professionalId, startsAt, endsAt)`
- `NotificationService.sendConfirmation(...)`
- `SchedulingService` (repository layer apenas — sem `createAppointment` pois exige `userId`)

---

## API Pública — Detalhes

### `GET /api/public/[slug]/info`

Resposta:
```json
{
  "tenant": { "name": "string", "logoUrl": "string | null", "primaryColor": "string | null" },
  "services": [{ "id": "uuid", "name": "string", "duration": "number", "price": "number" }],
  "professionals": [{ "id": "uuid", "name": "string", "avatarUrl": "string | null" }]
}
```
- Apenas registros `active: true`
- Sem `tenantId`, sem dados sensíveis

### `GET /api/public/[slug]/slots?professionalId=&date=`

- `date` formato `YYYY-MM-DD`
- Reusa `AvailabilityService` existente
- Resposta: `{ "slots": ["09:00", "09:30", "10:00"] }`
- Header: `Cache-Control: max-age=60`

### `POST /api/public/[slug]/appointments`

Body (Zod):
```typescript
z.object({
  serviceId: z.string().uuid(),
  professionalId: z.string().uuid(),
  startsAt: z.string().datetime(),
  customerName: z.string().min(2).max(80),
  customerPhone: z.string().regex(/^(\+?55)?[1-9]{2}[0-9]{8,9}$/)
})
```

Resposta `201`:
```json
{ "appointmentId": "uuid", "code": "ABCD1234" }
```
O `code` é `appointmentId.slice(0, 8).toUpperCase()` — protocolo exibido na tela de confirmação.

Códigos de erro:
- `404` — slug não encontrado
- `409` — slot ocupado (`SlotUnavailableError`)
- `422` — telefone inválido (`InvalidPhoneError`)
- `429` — rate limit (10 req/min por IP)

---

## Frontend — Wizard

### Estrutura de arquivos

```
app/agendar/[slug]/
  page.tsx                      ← Server Component
  not-found.tsx

components/booking/
  booking-wizard.tsx            ← Client Component, state machine
  booking-progress.tsx          ← indicador de progresso (passos 1-4)
  step-service.tsx
  step-professional.tsx
  step-datetime.tsx
  step-contact.tsx
  step-confirmation.tsx

hooks/booking/
  use-available-slots.ts        ← TanStack Query → GET /slots
```

### Estado local (useState — sem Zustand)

```typescript
type BookingState = {
  step: 1 | 2 | 3 | 4 | 'done'
  serviceId: string | null
  professionalId: string | null
  startsAt: string | null
  customerName: string
  customerPhone: string
  confirmationCode: string | null
}
```

### Passos do wizard

| Passo | Componente | Conteúdo |
|---|---|---|
| 1 | `StepService` | Cards: nome do serviço, duração, preço |
| 2 | `StepProfessional` | Cards: avatar, nome + opção "Qualquer profissional" (backend seleciona o primeiro disponível no slot escolhido) |
| 3 | `StepDatetime` | Date picker + grid de slots (via `useAvailableSlots`) |
| 4 | `StepContact` | Input nome, input telefone + aviso LGPD |
| done | `StepConfirmation` | Código de protocolo, resumo, "Confirmação via WhatsApp" |

### Visual

- Mobile-first, `max-w-md` centralizado no desktop
- `primaryColor` do tenant aplicado como CSS variable inline no CTA
- Logo do tenant no topo da página
- Página limpa: sem sidebar, sem nav

### Tratamento de erros

- **409 no POST** → toast "Este horário acabou de ser ocupado" + volta para passo 3
- **422** → erro inline no campo de telefone
- **Slots vazios** → "Nenhum horário disponível neste dia — tente outra data"
- **Serviço sem profissional ativo** → "Serviço temporariamente indisponível"

---

## Segurança

| Risco | Mitigação |
|---|---|
| Spam/bots | Rate limit 10 req/min por IP no POST (Map em memória, mesmo padrão do webhook Twilio) |
| Enumeração de slugs | `resolveTenant` retorna 404 genérico |
| Phone harvesting | GET /info retorna apenas dados públicos — sem emails, sem telefones de clientes |
| Double-booking | `ensureSlotAvailable` dentro de transação Prisma → 409 |
| LGPD | `consentGiven: true, consentOrigin: "public_booking", consentDate: now()` ao criar Customer |
| Injeção | Validação Zod antes de tocar banco; Prisma usa queries parametrizadas |
| WhatsApp falha | Fire-and-forget — não reverte agendamento; cliente vê código de protocolo na tela |

---

## Edge Cases de Negócio

- **`customerPhone` já existe com outro nome:** `findByPhone` retorna Customer existente — nome não é sobrescrito (número é a identidade)
- **Tenant sem `businessHours`:** AvailabilityService retorna slots vazios
- **Profissional sem horário configurado:** slots vazios — mensagem orientativa
- **WhatsApp desabilitado para o tenant:** notificação pulada silenciosamente — agendamento criado normalmente
- **Tenant inativo/desativado:** `resolveTenant` pode verificar flag futura — por ora, tenant existe no banco = portal ativo

---

## Fora do escopo (YAGNI)

- Cancelamento pelo portal público
- Reagendamento
- Login/área do cliente
- Pagamento online
- Múltiplos serviços por agendamento
- "Adicionar ao calendário"
