# Central de Notificações da Equipe — Design

> Spec de design. Data: 2026-07-13.
> Autor: sessão de brainstorming (analista de arquitetura).
> Status: aprovado para escrita de plano.

---

## 1. Contexto e problema

O Agendê já tem três frentes de notificação parcialmente construídas, mas com lacunas
relevantes descobertas neste levantamento:

- **WhatsApp ao cliente final** — maduro. Evolution API (número do próprio tenant),
  6 templates, gatilhos por evento e jobs pg-boss. **Fora do escopo deste módulo.**
- **Email ao cliente final** — `EmailProvider` (Resend) e templates HTML existem, mas
  **nenhum evento/job dispara com `channel: EMAIL`**. Na prática, o cliente não recebe
  email nenhum. (Registrado como gap; não é o foco desta entrega.)
- **Notificações internas da equipe** — submódulo `user-notifications/` com sino, feed,
  3 preferências booleanas por usuário e email opt-in disparado direto pelo serviço
  (sem passar pelo canal formal). É a **fundação** deste módulo.

### Escopo deste módulo

Notificações **operacionais para a equipe** (dono + colaboradores): novos agendamentos,
cancelamentos, reagendamentos, faltas, novos clientes, pendências que precisam de ação,
resumo do dia e avisos inteligentes. **Não** trata de mensagens ao cliente final.

### Restrições de negócio confirmadas

- **Canais da equipe = In-app (sino) + Email.** WhatsApp **não** entra: o disparo sairia do
  número do próprio tenant para os próprios colaboradores (inclusive o dono para si mesmo),
  consumiria a cota destinada ao cliente e exigiria Evolution conectada. Não há número da
  plataforma para disparo transacional interno.
- **Governança em duas camadas:** o **negócio** (dono ou quem tiver permissão) liga cada
  evento e define o padrão (ligado/desligado, canais); o **colaborador** ajusta os seus.
  In-app é sempre on; email é opt-in.
- **Sem dependência de plano pago da Vercel.** O projeto já roda tarefas via um endpoint
  pull-based `/api/cron/tick`, acionável por qualquer agendador externo grátis. O motor
  novo reusa essa infra; nada exige Vercel Pro.

---

## 2. Objetivos e não-objetivos

### Objetivos
1. Padronizar as notificações da equipe num único módulo configurável.
2. Camada de negócio (padrões por evento) + camada por colaborador (ajuste do próprio).
3. Entrega confiável por in-app + email, sem perder aviso e sem adicionar latência ao
   fluxo de agendamento.
4. Aba dedicada **Notificações** em Configurações (hoje está fragmentado).
5. Editor de mensagens com variáveis `{{...}}` reais para email e in-app.
6. Recursos de mercado de alto valor e baixo custo: resumo do dia, alertas acionáveis,
   e o pacote anti-fadiga (digest × tempo real, quiet hours, defaults por cargo).

### Não-objetivos (desta entrega)
- Mensagens ao cliente final (WhatsApp/email) — sistema separado, intocado.
- WhatsApp como canal para a equipe.
- Motor de automação genérico / rules engine (Fase 2 — domínio Automation).

---

## 3. Arquitetura escolhida

**Abordagem A — expandir o submódulo `user-notifications`** (frente às alternativas de
rules-engine genérico e config em JSON, ambas descartadas por custo/YAGNI).

Aproveita o feed, o sino e o padrão de eventos já existentes; normaliza a configuração em
tabelas consultáveis; e escala para novos tipos de aviso só adicionando `eventType`.

### 3.1 Modelo de dados

Enum `NotificationEventType` (Prisma):
```
appointment_created
appointment_cancelled
appointment_rescheduled
appointment_no_show
customer_created
appointment_pending_confirmation   // pendência (lazy in-app; digest por email)
payment_pending                     // pendência
daily_digest                        // resumo do dia (periódico)
birthday_digest                     // aniversariantes da semana (periódico) — já existe
customer_inactive                   // aviso inteligente (snapshot periódico) — Fase 1-b/2
agenda_idle                         // aviso inteligente (snapshot) — Fase 2
monthly_goal                        // aviso inteligente (snapshot) — Fase 2
```

Enum `NotificationChannel_Team` (novo, distinto do enum cliente): `IN_APP | EMAIL`.

Novos models:
```
TenantNotificationSetting
├─ id
├─ tenantId
├─ eventType        NotificationEventType
├─ enabled          Boolean        // negócio liga/desliga o evento
├─ defaultChannels  String[]       // padrão herdado pelos colaboradores (ex.: [IN_APP, EMAIL])
├─ templateId       String?        // FK opcional para NotificationTemplate
├─ @@unique([tenantId, eventType])
└─ @@index([tenantId])

UserNotificationPreference           // só OVERRIDES; ausência = herda o padrão do negócio
├─ id
├─ tenantId
├─ userId
├─ eventType        NotificationEventType
├─ channel          NotificationChannel_Team  // só EMAIL é opt-in; IN_APP não entra aqui
├─ enabled          Boolean
├─ @@unique([tenantId, userId, eventType, channel])
└─ @@index([tenantId, userId])

NotificationTemplate                 // edição de layout com variáveis
├─ id
├─ tenantId
├─ eventType        NotificationEventType
├─ channel          NotificationChannel_Team  // IN_APP | EMAIL
├─ subject          String?        // assunto do email / título in-app
├─ body             String         // corpo com {{variaveis}}
├─ @@unique([tenantId, eventType, channel])
└─ @@index([tenantId])
```

Campos novos em `User` (preferências globais do colaborador — anti-fadiga):
```
notificationDeliveryMode   String   @default("realtime")   // "realtime" | "digest"
quietHoursStart            Int?     // hora local (0-23); null = sem silêncio
quietHoursEnd              Int?
```

**Migração dos 3 booleans atuais** (`notifyEmailAppointments`, `notifyOwnAppointments`,
`notifyTeamAppointments`): migration aditiva cria as tabelas novas e faz o *backfill* das
preferências equivalentes em `UserNotificationPreference`. Os booleans permanecem por um
release (compatibilidade), depois são removidos em migration separada. Sem drop destrutivo
nesta entrega.

> Nota de implementação: `defaultChannels` e `NotificationChannel_Team` podem ser
> representados como enum Prisma nativo. Onde o Prisma exigir, usar enum dedicado e não
> reaproveitar o `NotificationChannel` do canal cliente (que inclui WHATSAPP).

### 3.2 Catálogo de eventos, destinatários e natureza

| Evento | Destinatários | Natureza | Fase |
|---|---|---|---|
| `appointment_created` | profissional do atendimento + gestores | evento | 1 |
| `appointment_cancelled` | profissional + gestores | evento | 1 |
| `appointment_rescheduled` | profissional + gestores | evento | 1 |
| `appointment_no_show` | profissional + gestores | evento | 1 |
| `customer_created` | gestores | evento | 1 |
| `appointment_pending_confirmation` | profissional + gestores | lazy in-app / digest email | 1 |
| `payment_pending` | gestores | lazy in-app / digest email | 1 |
| `daily_digest` | gestores (config) + profissional (própria agenda) | periódico (tick) | 1 |
| `birthday_digest` | gestores | periódico (tick) — já existe | 1 |
| `customer_inactive` | gestores | snapshot periódico | 1-b |
| `agenda_idle` | gestores | snapshot periódico | 2 |
| `monthly_goal` | gestores | snapshot periódico | 2 |

Regra de destinatário reusa a atual: profissional do atendimento + OWNER/MANAGER,
deduplicado, com **auto-skip** de quem gerou a ação no painel (não no público).

### 3.3 Motor de disparo (dispatcher)

Substitui o `notifyAppointment` atual por um dispatcher genérico orientado a `eventType`.
Três caminhos, conforme a natureza do evento:

**a) Orientado a evento (operacional + novo cliente) — sem cron.**
1. `eventBus.publish` (já é fire-and-forget: `void handler`) → o fluxo de negócio não espera.
2. O handler resolve destinatários e, para cada um, calcula os canais efetivos:
   `canais = TenantNotificationSetting.defaultChannels ∩ overrides do usuário`
   (IN_APP sempre presente; EMAIL só se não houver override `enabled=false`).
3. **In-app**: grava `UserNotification` na hora (um insert — rápido, durável).
4. **Email**: **não envia inline**. Enfileira um job pg-boss durável
   (`team-notification-email`) — um insert. O `/api/cron/tick` entrega.
   → Motivo: em serverless, trabalho disparado após a resposta HTTP pode ser congelado
   antes do envio; a fila torna a entrega **confiável sem adicionar latência**.

**b) Pendências — lazy no in-app, digest opcional por email.**
- O badge/seção de pendências no sino/dashboard é **query ao vivo na leitura** (barata e
  indexada: agendamentos de hoje sem confirmação, pagamentos pendentes). Sem cron.
- Um **digest diário por email** dessas pendências é montado pelo tick (opt-in por usuário).

**c) Periódicos e inteligentes — snapshot pelo tick.**
- `daily_digest`, `birthday_digest`: job agendado no tick existente.
- `customer_inactive` / `agenda_idle` / `monthly_goal`: **snapshot materializado** pelo tick
  (varrem a base — não podem ser lazy sob pena de degradar o carregamento do app). O
  resultado vira `UserNotification` e/ou linha de digest.

**Respeito a quiet hours e delivery mode** (anti-fadiga):
- `realtime`: emails enfileirados são despachados no próximo tick, exceto dentro da janela de
  silêncio do destinatário (segura até o fim da janela).
- `digest`: o colaborador não recebe email por evento; recebe tudo consolidado no resumo.
- In-app nunca é bloqueado por quiet hours (é passivo, o usuário abre quando quer);
  o silêncio afeta o **push por email**.

**Isolamento de falhas:** cada canal é best-effort e independente; falha de email nunca
afeta o in-app nem o fluxo de negócio. Já é o padrão atual (`try/catch` + log).

### 3.4 Motor de templates com variáveis

Editor `{{variavel}}` real, unificado para **email + in-app** (o editor WhatsApp
client-facing existente permanece separado e intocado).

- **Chips clicáveis** inserem a variável no cursor. Conjunto por evento, ex.:
  `{{cliente}}`, `{{servico}}`, `{{profissional}}`, `{{data}}`, `{{hora}}`, `{{negocio}}`,
  `{{valor}}`, `{{link_acao}}`.
- **Preview ao vivo** com dados de exemplo.
- **Interpolação segura no envio**: variável desconhecida → string vazia; **escape de HTML**
  obrigatório no corpo de email (nome de cliente pode conter caracteres perigosos).
- **Fallback**: sem `NotificationTemplate` do tenant, usa o template padrão do sistema.
- **Alertas acionáveis**: o template inclui `{{link_acao}}` (deep link para a ação
  correspondente — ex.: remarcar, ver pendência), atendendo o padrão de mercado de
  notificação que já leva à ação.

### 3.5 UI — aba Notificações em Configurações

Nova página em `Configurações › Notificações`, com duas sub-abas:

```
Configurações › Notificações
┌───────────────────────────────────────────────┐
│ [ Avisos do negócio ]   [ Minhas preferências ] │
├───────────────────────────────────────────────┤
│ AVISOS DO NEGÓCIO  (dono / permissão settings)  │
│  Novo agendamento     ● ativo   canais: 🔔 ✉️    │
│  Cancelamento         ● ativo   canais: 🔔 ✉️    │
│  Resumo do dia        ● ativo   ✉️   [08:00]     │
│  Pendências           ● ativo   🔔 + digest ✉️   │
│  ...                   [ Editar mensagem ]        │
├───────────────────────────────────────────────┤
│ MINHAS PREFERÊNCIAS  (cada colaborador)          │
│  Modo:  ( ) Tempo real   (•) Resumo diário       │
│  Silêncio: [22:00] às [07:00]                    │
│  Novo agendamento   🔔 (sempre)  ✉️ [x]           │
│  ...  só mostra eventos que o negócio ativou      │
└───────────────────────────────────────────────┘
```

- **Mobile-first** (checklist `agent-mobile`): cards empilhados; switches com alvo de toque
  ≥ 44px; as duas sub-abas viram seletor segmentado no topo em telas pequenas; nenhum
  overflow horizontal; DialogContent do editor com `max-h` + `overflow-y-auto`.
- **Permissões**: "Avisos do negócio" exige `configuracoes`/`settings.manage`;
  "Minhas preferências" é do próprio usuário (independe de cargo).
- **Fonte única**: o painel de preferências do sino e a engrenagem atuais passam a linkar
  para esta aba (deprecam o `notification-preferences.tsx` de 3 switches).
- **Defaults por cargo** ao semear o tenant: dono recebe operacional + resumo do dia +
  financeiro; profissional recebe só os agendamentos dele — poucos e ON, o resto opt-in.

---

## 4. Fluxo de dados (resumo)

```
Ação (API Route)  ──publish──▶  eventBus (fire-and-forget)
                                     │
                        dispatcher resolve destinatários
                                     │
              ┌──────────────────────┼───────────────────────┐
              ▼                      ▼                        ▼
     UserNotification         enqueue pg-boss           (lazy/snapshot)
      (in-app, na hora)     team-notification-email      pendências/inteligentes
              │                      │
           sino/feed          /api/cron/tick  ──▶  Resend (respeita quiet hours/mode)
```

---

## 5. Tratamento de erros

- Erros de domínio tipados de `src/shared/errors/` (nada de `throw new Error('...')`).
- Falha de envio de email: capturada, logada, marcada no log de notificação; **não** falha
  o job inteiro nem o fluxo de negócio (o débito técnico já registrado no
  `notification.service` sobre `PlanLimitError` no caminho de job é respeitado — limites são
  tratados no contexto do job, sem propagar 402).
- Template inválido/variável desconhecida: degrada para vazio/fallback, nunca quebra o envio.

---

## 6. Estratégia de testes

Seguindo o checklist do projeto:
- **Service/dispatcher (80%)**: resolução de destinatários; interseção de canais
  (negócio ∩ override); auto-skip; quiet hours segurando email; modo digest não emitindo
  email por evento; isolamento de falha de canal.
- **Template engine**: interpolação de variáveis conhecidas/desconhecidas; escape de HTML;
  fallback para padrão do sistema.
- **Repository (60%)**: filtro por `tenantId` em todas as queries; upsert de settings/prefs.
- **API Routes (70%)**: permissões (negócio vs colaborador); validação Zod dos schemas.
- **Job de email (tick)**: entrega enfileirada; retry; não propaga limite como erro fatal.

---

## 7. Faseamento

**Fase 1 (primeira entrega ao ar — resolve o problema imediato sem Evolution):**
- Models + enums + migração aditiva (backfill dos 3 booleans).
- Dispatcher orientado a evento para operacional + `customer_created`.
- Entrega in-app na hora + email durável via tick.
- Pendências (`appointment_pending_confirmation`, `payment_pending`) como **worklist lazy**
  in-app.
- **Resumo do dia** por email (tick diário).
- Motor de templates (`{{...}}`) para email + in-app, com preview e chips.
- Aba **Notificações** (Avisos do negócio + Minhas preferências).
- Anti-fadiga: modo tempo-real × digest, quiet hours, defaults por cargo, agrupamento
  ("3 novos agendamentos").
- Alertas acionáveis (`{{link_acao}}`).

**Fase 1-b (logo em seguida):**
- Digest de pendências por email.
- `customer_inactive` (win-back) como snapshot periódico + worklist.

**Fase 2:**
- `agenda_idle` (ociosidade/sazonalidade), `monthly_goal` (meta), snooze/"resolver" nos
  avisos inteligentes, fill-your-gaps no cancelamento.
- Remoção definitiva dos 3 booleans legados.

---

## 8. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Email perdido em serverless (fire-and-forget morto no freeze) | Enfileirar job durável; entrega pelo tick. |
| Fadiga de notificação → usuário desliga tudo | Defaults poucos e por cargo; digest; quiet hours; agrupamento. |
| Snapshot inteligente pesando no carregamento | Nunca lazy para varredura de base; sempre snapshot pelo tick. |
| Fan-out de queries por evento | Batelada de destinatários + prefs em poucas queries; overrides esparsos. |
| Migração dos booleans | Aditiva + backfill; remoção só na Fase 2. |
| Escopo grande | Faseamento não-cosmético; cada fase é um PR revisável e no ar. |

---

## 9. Impacto em arquivos (indicativo, não exaustivo)

- `prisma/schema.prisma` — enums, 3 models novos, campos em `User`; migration aditiva.
- `src/domains/notifications/user-notifications/` — dispatcher genérico, repository,
  template engine, types.
- `src/shared/queue/jobs/` — job `team-notification-email`, job `daily-digest`; registro no
  `/api/cron/tick`.
- `src/app/(app)/configuracoes/notificacoes/` — nova página + sub-abas.
- `src/components/domain/notifications/` — editor de template, matriz de canais, preferências
  (substitui os 3 switches).
- `src/app/api/notifications/**` — rotas de settings do negócio e prefs do colaborador.
- `docs/decisions.md` — ADR atualizando a central de notificações da equipe (evolui o ADR-015).

---

## 10. Critérios de aceite (Fase 1)

- [ ] Negócio liga/desliga cada evento e define canais-padrão; colaborador ajusta os seus.
- [ ] Novo agendamento/cancelamento/reagendamento/no-show geram in-app na hora + email
      confiável (via tick), respeitando padrões e overrides.
- [ ] Pendências aparecem como worklist viva no in-app, sem cron.
- [ ] Resumo do dia chega por email no horário configurado.
- [ ] Templates editáveis com `{{variaveis}}`, preview e escape de HTML.
- [ ] Modo digest e quiet hours funcionam (email respeita ambos; in-app não é bloqueado).
- [ ] Aba Notificações responsiva (checklist mobile) e permissões corretas.
- [ ] `npx tsc --noEmit` limpo; testes nos percentuais do checklist passando.
- [ ] Nenhum item 🔴 do Security Agent; PR aberta e mergeada na `main`.
