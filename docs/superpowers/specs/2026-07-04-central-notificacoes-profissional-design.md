# Design — Central de notificações do profissional

**Data:** 2026-07-04
**Status:** Aprovado (design), pronto para plano de implementação
**Domínios afetados:** notifications (novo submódulo in-app), scheduling (produtor de eventos — já existe), crm (produtor de eventos — já existe), iam (preferências no User)

---

## 1. Problema e objetivo

Hoje o domínio `notifications` só trata mensagens **para o cliente** (WhatsApp/email, modelo `NotificationLog`). Não existe nenhum canal de notificação **para a equipe** (profissionais, donos, gestores).

Objetivo: dar a cada membro da equipe uma **central de notificações in-app** (sino no topo, estilo redes sociais) que avisa sobre eventos operacionais relevantes — novos agendamentos, cancelamentos, novos clientes e aniversariantes da semana — com e-mail opcional para agendamentos. Cada usuário tem sua **própria visão** (feed por usuário).

Isso reforça o posicionamento do Agendê como "sistema operacional inteligente": o mesmo mecanismo vira base para avisos futuros de alto valor (VIP cancelou, meta batida, estoque baixo).

---

## 2. Escopo da v1

### Tipos de notificação

| Tipo | Gatilho | Quem recebe | E-mail? |
|---|---|---|---|
| `appointment_created` | evento `scheduling.appointment.created` | profissional do atendimento + gestores | opcional (toggle por usuário) |
| `appointment_cancelled` | evento `scheduling.appointment.cancelled` | profissional do atendimento + gestores | opcional (toggle por usuário) |
| `customer_created` | evento `crm.customer.created` | **só gestores** (OWNER/MANAGER) | **nunca** |
| `birthday_digest` | job semanal pg-boss (segunda 08h) | **só gestores** (OWNER/MANAGER) | **nunca** |

"Gestor" = `User.role ∈ { OWNER, MANAGER }` (enum real no schema, não depende dos cargos dinâmicos).

### Fora de escopo (v1)
- Notificar confirmação / reagendamento / no-show (arquitetura já deixa trivial somar assinando mais eventos).
- Realtime por websocket (Supabase Realtime) — fica o polling de 30s.
- Push nativo/PWA.
- Toggles individuais para novo cliente e aniversariantes (sempre ligados para gestores na v1).
- Gate por plano — a central fica **liberada** para todos (é UX core; o e-mail é transacional via Resend, não a automação paga de WhatsApp).
- Calendário com range custom no filtro de datas (só presets na v1).
- Filtro de datas/tipo server-side (client-side na v1).

---

## 3. Arquitetura

```
scheduling.appointment.created / .cancelled   (event bus — já existem)
crm.customer.created                          (event bus — já existe)
job semanal birthday_digest (pg-boss)
        ↓
notifications/user-notifications.subscriptions.ts   ← assina eventos, calcula destinatários
        ↓
UserNotificationService   ← regras (self/gestor/dedup) + dispara e-mail opcional (Resend)
        ↓
UserNotificationRepository   ← sempre filtra tenantId
        ↓
Prisma (UserNotification)

Frontend:
  GET   /api/notifications/me           → { items, unreadCount } (polling 30s via TanStack Query)
  POST  /api/notifications/me/read      → marca lida: { id } ou { all: true }
  PATCH /api/notifications/me/prefs     → atualiza toggles
  hook  useUserNotifications            → <NotificationBell> em AppShell (desktop) + MobileHeader (mobile)
```

Segue as regras do CLAUDE.md: `tenantId` sempre do token; repository filtra tenant em toda query; service concentra regras e (quando aplicável) publica/consome eventos; Zod nas rotas; erros tipados; componentes com loading/empty/error; checklist mobile-first.

---

## 4. Modelo de dados

### Nova tabela `UserNotification` (uma linha por destinatário)

```prisma
model UserNotification {
  id        String    @id @default(cuid())
  tenantId  String
  userId    String    // destinatário — dono do feed
  type      String    // "appointment_created" | "appointment_cancelled" | "customer_created" | "birthday_digest"
  title     String    // resumo (bloco fechado)
  body      String    // mensagem completa (bloco expandido)
  data      Json      // { appointmentId?, customerId?, customerName?, serviceName?, startsAt?, createdByName?, origin?, birthdays?[] }
  readAt    DateTime?
  createdAt DateTime  @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([tenantId, userId, readAt])
  @@index([tenantId, userId, createdAt])
}
```

### Preferências — campos aditivos no `User` (migração não-destrutiva)

```prisma
notifyEmailAppointments   Boolean @default(false)  // e-mail em novos/cancelados agendamentos
notifyOwnAppointments     Boolean @default(false)  // avisar quando o próprio usuário criou o agendamento
notifyTeamAppointments    Boolean @default(true)   // (OWNER/MANAGER) receber agendamentos de toda a equipe
```

Defaults escolhidos: e-mail **opt-in** (evita surpresa); auto-agendamento **não avisa** por padrão (o usuário sabe que criou); gestor **recebe** a agenda da equipe por padrão (pode desligar e ficar só com os próprios).

---

## 5. Regra de destinatários

### Agendamentos (`appointment_created` / `appointment_cancelled`)

```
candidatos = { profissional do atendimento } ∪ { usuários com role OWNER ou MANAGER }
para cada candidato (dedup por userId):
   - se candidato.id == createdByUserId  E  !candidato.notifyOwnAppointments  → pula
   - se candidato é gestor E NÃO é o profissional do atendimento E !candidato.notifyTeamAppointments → pula
   - senão → cria UserNotification
             + se candidato.notifyEmailAppointments → envia e-mail (Resend)
```

Mapeamento dos cenários:
- **Cliente agenda na vitrine** → `createdByUserId = null` → profissional recebe + gestores recebem.
- **Outro profissional/recepção marca** → profissional do atendimento recebe + gestores.
- **Profissional marca para si** → só recebe se ligou `notifyOwnAppointments`; gestores recebem normalmente.

O `title`/`body` variam pela origem (`data.origin`): "Novo agendamento pela vitrine" / "{createdByName} marcou um horário para você" / "Você marcou um horário".

### Novo cliente (`customer_created`)
Destinatários = gestores (OWNER/MANAGER). Sem e-mail. Se o payload permitir identificar um usuário criador que também é gestor, aplica-se a mesma regra de auto-skip; caso contrário notifica todos os gestores (dedup).

### Aniversariantes (`birthday_digest`)
Job semanal pg-boss (cron, segunda 08h). Por tenant, varre `Customer.birthDate` (índice `@@index([tenantId, birthDate])`) na janela seg–dom. Se houver ≥1 aniversariante, cria **uma** notificação-resumo por gestor com `data.birthdays = [{ name, day, customerId, phone }]`. Sem e-mail.
Simplificação v1: janela calculada no fuso do servidor (a revisar se for necessário fuso por tenant).

---

## 6. UI — sino, badge e modal

### Sino + badge
Indicador de alerta = **bolinha vermelha** (presença de não-lidas; sem número), pulsante, no canto do ícone de sino. Sem não-lidas = sem bolinha.

- **Mobile** (`MobileHeader`): sino à esquerda do nome/logo (que fica no topo-direito).
  ```
  ☰            🔔•   Salão da Ana  [logo]
  ```
- **Desktop** (topo da sidebar, ao lado de `LogoBrand`; colapsada = sino abaixo do ícone):
  ```
  [logo] Salão da Ana 🔔•
  ```

### Modal / painel (sheet lateral no desktop, bottom-sheet no mobile)

```
┌─ Notificações ─────────────────── ⚙  ✕ ─┐
│ (Todas•) (Agenda) (Clientes) (Aniversários)│  ← chips por TIPO; "Todas" default
│ Período: [ 7 dias ▾ ]    Marcar todas lidas│  ← seletor de DATA + ação
│                                            │
│  HOJE ─────────────────────────────       │
│ ● 🗓 Novo agendamento pela vitrine   2min ▸│
│      Maria • Corte • hoje 14h              │
│ ● 👤 Novo cliente: João Souza        1h  ▸│
│                                            │
│  ONTEM ────────────────────────────       │
│ ○ ❌ Agendamento cancelado          18h  ▸│
│                                            │
│  ESTA SEMANA ──────────────────────       │
│ ○ 🎂 5 aniversariantes esta semana  seg  ▸│
│                                            │
│              Ver mais                       │
└────────────────────────────────────────────┘
```

Comportamento:
- **Bloco-resumo → expande** ao tocar: mostra mensagem completa + CTA contextual ("Ver na agenda →", "Ver cliente →", ou lista de aniversariantes com botão WhatsApp reusando o padrão de "clientes inativos" dos Relatórios).
- **Ícone/cor por tipo:** 🗓 agendado, ❌ cancelado, 👤 novo cliente, 🎂 aniversários.
- **Filtro por tipo (chips):** `Todas` · `Agenda` (created+cancelled) · `Clientes` (customer_created) · `Aniversários` (birthday_digest). Chip sem nenhuma notificação no período fica oculto. Cada chip pode exibir micro-contador de não-lidas (ex: `Agenda ②`).
- **Filtro por data:** agrupamento automático por cabeçalhos (`Hoje` · `Ontem` · `Esta semana` · `Mais antigas`) + seletor de período (`7 dias` default · `30 dias` · `Tudo`).
- **Leitura:** badge = existe alguma com `readAt IS null`. Expandir um item marca aquele como lido; "Marcar todas como lidas" zera. Abrir o modal **não** zera sozinho.
- Filtros de tipo e data são **client-side** sobre o que o polling trouxe (default: últimos 30 dias / até 50 itens; "Ver mais" pagina o restante).
- Estados: loading (skeleton dos blocos), empty ("Nenhuma notificação por aqui ainda"), error (retry).

### Preferências (engrenagem no topo do modal)
Painel inline, linguagem simples:
```
Preferências de notificação
 ☐ Receber e-mail sobre meus agendamentos (novos e cancelados)
 ☐ Me avisar também quando eu mesmo marco um horário
 ☑ Receber avisos de agendamentos da equipe        ← só aparece para OWNER/MANAGER
```

---

## 7. Backend — camadas e contratos

### Repository (`user-notification.repository.ts`)
- `create(tenantId, data)` — insere uma notificação.
- `createMany(tenantId, rows)` — insere em lote (fan-out de destinatários).
- `findManyForUser(tenantId, userId, { since, limit, cursor })` — feed paginado, ordenado por `createdAt desc`.
- `countUnread(tenantId, userId)` — para o badge.
- `markRead(tenantId, userId, { id | all })` — set `readAt`.
- Todas filtram `tenantId` **e** `userId` (isolamento por usuário além do tenant).

### Service (`user-notification.service.ts`)
- `notifyAppointment(event, kind)` — resolve destinatários (regra §5), monta title/body/data, `createMany`, dispara e-mails opt-in.
- `notifyCustomerCreated(event)` — destinatários = gestores.
- `runBirthdayDigest(tenantId)` — query de aniversariantes, monta resumo, fan-out para gestores.
- `listForUser` / `markRead` / `updatePreferences` — usados pelas rotas.
- Resolução de "gestores": query `User` por `role in [OWNER, MANAGER]` no tenant.

### Subscriptions (`user-notifications.subscriptions.ts`)
Registrado no mesmo ponto de bootstrap das assinaturas existentes:
```
eventBus.subscribe("scheduling.appointment.created", e => userNotificationService.notifyAppointment(e, "created"))
eventBus.subscribe("scheduling.appointment.cancelled", e => userNotificationService.notifyAppointment(e, "cancelled"))
eventBus.subscribe("crm.customer.created", e => userNotificationService.notifyCustomerCreated(e))
```
Falhas de notificação **não** afetam o fluxo principal (try/catch + log estruturado).

### Job semanal (pg-boss)
Cron `0 8 * * 1` que itera tenants ativos e chama `runBirthdayDigest(tenantId)`. Reusa a infra de pg-boss já usada em `scheduleAppointmentReminder`.

### Rotas (App Router, controllers finos, Zod)
- `GET /api/notifications/me` → `getSessionContext()` → `{ items, unreadCount }`. Query params: `period` (7|30|all), `limit`, `cursor`.
- `POST /api/notifications/me/read` → body `{ id?: string; all?: boolean }` (Zod), retorna `unreadCount` atualizado.
- `PATCH /api/notifications/me/prefs` → body com os 3 booleanos (Zod), persiste no `User`, retorna prefs.
- `tenantId` e `userId` sempre do token — nunca do body.

### E-mail
Novo template em `notifications/providers/email-templates.ts` ("novo agendamento para o profissional" e "agendamento cancelado para o profissional"), enviado via provider Resend existente. Assunto/HTML no padrão dos templates atuais.

---

## 8. Frontend — componentes e hook

- `useUserNotifications()` (TanStack Query): `GET /me` com `refetchInterval: 30_000`; expõe `items`, `unreadCount`, `markRead`, `markAllRead`, `prefs`, `updatePrefs`. Invalida ao marcar lida.
- `<NotificationBell />`: ícone + bolinha vermelha; abre o painel. Usado em `AppShell` (desktop, topo da sidebar) e `MobileHeader` (mobile).
- `<NotificationPanel />`: sheet/bottom-sheet com chips de tipo, seletor de período, agrupamento por data, blocos que expandem, "marcar todas como lidas", engrenagem de preferências.
- `<NotificationItem />`: bloco-resumo colapsável, ícone/cor por tipo, CTA contextual.
- `<NotificationPreferences />`: painel inline com os toggles (o de equipe só para OWNER/MANAGER).
- Checklist mobile-first do `agent-mobile` obrigatório antes da entrega.

---

## 9. Testes (metas do CLAUDE.md)

- **Service (80%):** regra de destinatários nos 3 cenários de agendamento; dedup profissional-que-é-gestor; auto-skip com/sem toggle; gestor com `notifyTeamAppointments=false`; e-mail só quando opt-in; `customer_created` só para gestores; `runBirthdayDigest` (com/sem aniversariantes, janela seg–dom).
- **Repository (60%):** filtro por tenant+user; `countUnread`; `markRead` id vs. all; paginação por período.
- **API route (70%):** auth/session; validação Zod; `tenantId`/`userId` do token, nunca do body.
- **Frontend:** render de badge (com/sem não-lida), expandir bloco, filtro por tipo e período, empty/loading/error.

---

## 10. Checklist de conclusão
- [ ] Migration aditiva (`UserNotification` + 3 campos no `User`) — sem drop.
- [ ] `tenantId` em toda query do repository; `userId` do token.
- [ ] Zod em todas as rotas; erros tipados.
- [ ] Componentes com loading/empty/error; checklist mobile-first executado.
- [ ] Sem `any`; `npx tsc --noEmit` zero erros.
- [ ] `npx vitest run` verde.
- [ ] Security Agent sem item 🔴.
- [ ] PR aberta e mergeada na `main`.
