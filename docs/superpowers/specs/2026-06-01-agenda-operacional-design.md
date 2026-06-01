# Spec: Grupo A — Agenda Operacional

**Data:** 2026-06-01  
**Escopo:** 3 features de operação diária da agenda  
**Branch:** `feat/agenda-operacional`

---

## Contexto

Features derivadas do mapeamento MinhaAgenda (38 features priorizadas). O Grupo A é o conjunto de menor esforço e maior impacto operacional — recursos que o operador usa em toda sessão de trabalho.

Estado atual do projeto relevante para este spec:
- `AppointmentStatus` enum já tem `NO_SHOW`
- `Appointment.notes` e `Customer.notes` existem no schema Prisma
- `AppointmentCard`, `AppointmentDrawer`, `CreateAppointmentModal`, `AgendaDayView` existem em `src/components/domain/scheduling/`
- Evolution API + Twilio já integrados no domínio de Notifications
- API `PATCH /api/scheduling/appointments/[id]/status` existe — mas não há PATCH geral de dados do agendamento

---

## Feature 1: Atalho "Remarcar" com Notificação ao Cliente

### Objetivo

O operador remarca um agendamento existente (altera data, hora ou profissional) com um clique direto no card, e o cliente recebe uma mensagem personalizada via WhatsApp automaticamente.

### Backend

#### `AppointmentRepository.update()`
Novo método no repository:
```ts
update(tenantId: string, id: string, data: {
  startsAt?: Date
  endsAt?: Date
  professionalId?: string
  serviceId?: string
})
```
Filtra por `tenantId` obrigatoriamente.

#### `SchedulingService.updateAppointment()`
Novo método no service:
1. Busca o agendamento atual via `findById` (lança `AppointmentNotFoundError` se não existir)
2. Valida disponibilidade com os novos horários via `ensureSlotAvailable()` — ignorando o próprio agendamento na verificação de overlap
3. Salva via `repository.update()`
4. Publica evento `scheduling.appointment.rescheduled` com payload:
```ts
{
  tenantId: string
  appointmentId: string
  customerId: string
  customerName: string
  customerPhone: string | null
  serviceName: string
  professionalName: string
  oldStartsAt: Date
  newStartsAt: Date
  newEndsAt: Date
  notificationMessage: string  // texto final editado pelo operador
}
```

#### Zod Schema — `UpdateAppointmentSchema`
```ts
{
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  professionalId: z.string().cuid().optional(),
  serviceId: z.string().cuid().optional(),
  notificationMessage: z.string().min(1).max(1000).optional()
}
```

#### API Route — `PATCH /api/scheduling/appointments/[appointmentId]`
Nova route. Segue padrão do projeto:
- Extrai `tenantId` do JWT via `withTenant()`
- Valida com `UpdateAppointmentSchema`
- Requer permissão `appointments.edit`
- Chama `schedulingService.updateAppointment()`
- Retorna o agendamento atualizado com status 200

#### Notificação — Subscription `scheduling.appointment.rescheduled`
No domínio de Notifications, nova subscription:
- Verifica se cliente tem `phone` cadastrado (skip silencioso se não tiver)
- Dispara WhatsApp via Evolution API (fallback Twilio) com `notificationMessage`
- Registra no histórico de notificações

### Template de Mensagem Padrão

Template hardcoded como constante (configuração por tenant fica para sprint futura):

```
Olá, {nome}! Seu agendamento de {serviço} foi remarcado para {data} às {hora} com {profissional}. Qualquer dúvida, estamos à disposição. Te esperamos! 🤍
```

Variáveis disponíveis: `{nome}`, `{serviço}`, `{data}`, `{hora}`, `{profissional}`, `{estabelecimento}`.

A renderização do template (substituição das variáveis) ocorre no frontend com os dados do agendamento já carregados — resultado exibido no textarea editável.

### Frontend

#### Botão "Remarcar" no `AppointmentCard`
- Ícone `CalendarDays` (Lucide), pequeno, no canto superior direito do card
- Tooltip: "Remarcar"
- Prop nova: `onReschedule?: (appointment: Appointment) => void`
- Visível sempre (não só hover) — funciona bem em touch/mobile

#### `RescheduleModal` — novo componente
Localização: `src/components/domain/scheduling/reschedule-modal.tsx`

Seções do modal:
1. **Cabeçalho**: "Remarcar agendamento" + nome do cliente e serviço (somente leitura)
2. **Campos editáveis**:
   - Profissional (select, pré-preenchido com o atual)
   - Data (date picker)
   - Horário (slot picker — reutiliza lógica de slots do `CreateAppointmentModal`, busca disponibilidade via `GET /api/scheduling/availability`)
3. **Mensagem ao cliente** (textarea editável):
   - Label: "Mensagem enviada ao cliente via WhatsApp"
   - Pré-preenchida com o template renderizado com os dados reais
   - Atualiza automaticamente ao trocar data/hora
   - Editável antes de confirmar
   - Nota discreta: "A mensagem será enviada apenas se o cliente tiver telefone cadastrado"
4. **Botões**: "Cancelar" | "Confirmar remarcação"

Estados do modal:
- `idle` — formulário editável
- `loading` — botão com spinner
- `error` — toast de erro inline
- `success` — toast de sucesso + modal fecha

#### `AgendaDayView` — mudanças
- Novo estado: `reschedulingAppointment: Appointment | null`
- Passa `onReschedule` para `AppointmentCard`
- Renderiza `RescheduleModal` quando `reschedulingAppointment !== null`
- Ao fechar o modal, invalida a query de agendamentos (TanStack Query `invalidateQueries`)

---

## Feature 2: Status NO_SHOW + Contador no Perfil do Cliente

### Objetivo

O operador marca "Não compareceu" num clique na agenda, e o histórico de faltas fica visível no perfil do cliente no CRM.

### Backend

#### `CustomerRepository.findById()` — incluir contagem de NO_SHOW
Extender o include do `findById` para retornar:
```ts
_count: {
  select: {
    appointments: {
      where: { status: 'NO_SHOW' }
    }
  }
}
```
Nenhuma migration necessária — campo calculado.

#### `GET /api/crm/customers/[id]` — retornar `noShowCount`
O endpoint já existe. Garantir que o campo `noShowCount` (derivado do `_count`) seja mapeado na resposta:
```ts
{
  ...customer,
  noShowCount: customer._count.appointments
}
```

### Frontend

#### `AppointmentDrawer` — botão NO_SHOW
Verificar se já existe. Se não, adicionar ao conjunto de ações existentes (Confirmar, Completar, Cancelar). Usa a API `PATCH /api/scheduling/appointments/[id]/status` já existente com `{ status: 'NO_SHOW' }`.

Visual: cor âmbar (`text-amber-600`), ícone `UserX` (Lucide), label "Não compareceu".

#### Perfil do cliente no CRM
- Exibir chip de alerta apenas quando `noShowCount > 0`:
```
⚠️ 2 não comparecimentos
```
- Cor âmbar, abaixo do nome do cliente na seção de informações do perfil
- Tooltip: "Este cliente não compareceu {n} vezes"
- `noShowCount === 0` → não renderiza o chip (sem poluição visual)

---

## Feature 3: Observações do Cliente (`notes`)

### Objetivo

O operador vê as observações do cliente no momento do atendimento (agenda) e edita no cadastro (CRM).

### Backend

#### `PATCH /api/crm/customers/[id]` — garantir campo `notes`
Verificar se o Zod schema do endpoint já inclui `notes: z.string().optional()`. Se não, adicionar. O `CustomerRepository.update()` deve aceitar `notes` no data.

Nenhuma migration — campo já existe no schema Prisma.

### Frontend

#### `AppointmentDrawer` — exibição somente leitura
- Bloco condicional: renderiza apenas se `appointment.customer.notes` não for vazio
- Posição: abaixo das informações do cliente (nome, telefone)
- Visual: ícone `StickyNote` (Lucide) + texto em `text-muted-foreground`
- Label: "Observações"
- Sem botão de editar — para editar, o operador vai ao perfil no CRM

#### Perfil do cliente no CRM — textarea editável
- Campo "Observações" com `<Textarea>` (Shadcn)
- Placeholder: "Alergias, preferências, histórico relevante..."
- Botão "Salvar observações" explícito — evita salvar acidentalmente ao navegar pelo perfil
- Limpa/atualiza ao editar

---

## Erros tipados (a criar se não existirem)

```ts
AppointmentNotFoundError       // 404
SlotUnavailableError           // 409 (já existe)
AppointmentAlreadyCancelledError  // 422
```

---

## Ordem de implementação recomendada

1. **Backend Feature 1** — `repository.update()`, `service.updateAppointment()`, schema Zod, API Route PATCH
2. **Backend Feature 2** — `_count` no `CustomerRepository.findById()`, mapeamento na API CRM
3. **Backend Feature 3** — verificar/ajustar schema Zod do PATCH customers
4. **Notification subscription** — `scheduling.appointment.rescheduled`
5. **Frontend Feature 3** — notes no AppointmentDrawer (mais simples, aquece o ambiente)
6. **Frontend Feature 2** — chip de NO_SHOW no perfil CRM + botão NO_SHOW no drawer
7. **Frontend Feature 1** — `RescheduleModal` + botão no `AppointmentCard` + estado no `AgendaDayView`

---

## Checklist de entrega

- [ ] `npx tsc --noEmit` — zero erros
- [ ] `npx vitest run` — todos os testes passando
- [ ] Testes: `SchedulingService.updateAppointment()` (disponibilidade, evento, erro 404)
- [ ] Testes: `CustomerRepository.findById()` inclui `noShowCount`
- [ ] Security: `tenantId` em todos os novos endpoints, nunca do body
- [ ] PR aberta para `main`
