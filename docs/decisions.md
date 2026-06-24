# decisions.md — Decisões arquiteturais (ADRs)

Registro de decisões importantes tomadas no projeto.
Formato: data, contexto, decisão, consequências.

---

## ADR-001 — Next.js full-stack ao invés de Java + Spring Boot

**Data**: 2025
**Status**: Aceito

**Contexto**: O prompt original especificava Java 21 + Spring Boot. O projeto está em fase zero com orçamento de R$500/mês e desenvolvimento via Vibe Coding com Claude.

**Decisão**: Usar Next.js API Routes como backend no MVP. Mesma arquitetura DDD, bounded contexts e eventos internos — mas em TypeScript.

**Consequências**:
- Deploy em Vercel: R$0 inicial vs R$1.500+ na AWS
- Claude gera código TypeScript muito melhor que Java
- Migração futura para backend separado é extração cirúrgica, não reescrita
- Perde-se o Spring Modulith — compensado pela estrutura de pastas por domínio

---

## ADR-002 — Supabase ao invés de PostgreSQL + Redis + RabbitMQ próprios

**Data**: 2025
**Status**: Aceito

**Contexto**: Stack original exigia múltiplos serviços gerenciados na AWS.

**Decisão**: Supabase como plataforma principal no MVP. Inclui PostgreSQL, Auth, Realtime e Storage.

**Consequências**:
- Custo: R$0 no plano free vs R$800+ na AWS
- Auth já resolvido — não precisa implementar JWT, refresh tokens, etc.
- RLS nativo resolve multi-tenancy no banco
- Dependência de vendor — mitigada pela possibilidade de self-host do Supabase

---

## ADR-003 — pg-boss ao invés de RabbitMQ para filas

**Data**: 2025
**Status**: Aceito

**Contexto**: RabbitMQ gerenciado custa R$200-400/mês extra e exige configuração complexa.

**Decisão**: pg-boss rodando sobre o PostgreSQL existente para jobs assíncronos no MVP.

**Consequências**:
- Zero custo extra — usa o banco já contratado
- Suficiente para: notificações, automações, campanhas no MVP
- Migração para BullMQ + Redis ou RabbitMQ quando necessário é simples

---

## ADR-004 — Multi-tenancy com tenant_id desde o dia 1

**Data**: 2025
**Status**: Aceito

**Contexto**: Incerteza se multi-tenancy seria necessário imediatamente.

**Decisão**: Implementar `tenantId` em todas as entidades de negócio desde o início, mesmo sem múltiplos clientes.

**Consequências**:
- Custo mínimo agora (uma coluna a mais por tabela)
- Evita reescrita dolorosa quando o segundo cliente aparecer
- RLS do Supabase usa o tenantId para isolamento no banco

---

## ADR-005 — EventEmitter interno ao invés de message broker

**Data**: 2025
**Status**: Aceito

**Contexto**: Comunicação entre domínios sem acoplamento direto.

**Decisão**: EventEmitter do Node.js como event bus interno no MVP. Mesma semântica de publish/subscribe, zero infraestrutura.

**Consequências**:
- Eventos síncronos em memória — suficiente para MVP
- Sem persistência de eventos (jobs assíncronos vão para pg-boss)
- Migração para RabbitMQ/Redis Pub-Sub é substituição do event bus, não reescrita de domínios

---

## ADR-006 — Reestruturação de agents e skills (2026-06-20)

**Data**: 2026-06-20
**Status**: Aceito

**Contexto**: Diagnóstico identificou ~38k tokens por sessão de feature completa, schema Prisma embedado no `agent-database.md` estava desatualizado (Fase 5 vs. estado real), tabela de domínios em 3 versões conflitantes (CLAUDE.md / CODEX.md / project-state.md), e ausência de pipeline para correções pontuais (hotfix), forçando o pipeline completo (~28k tokens) para bugs simples.

**Decisão**:
1. Criar `agent-hotfix.md` — pipeline reduzido (~13k tokens) para bugs pontuais
2. Criar `agent-mobile.md` — checklist mobile-first obrigatório após todo frontend
3. Tornar `agent-documentation.md` condicional — BUGFIX só atualiza `project-state.md`
4. Remover schema embedado do `agent-database.md` — referencia `prisma/schema.prisma` como fonte única
5. Restringir critérios de acionamento do `agent-architect.md` — evitar invocações desnecessárias
6. Consolidar tabela de status em `CLAUDE.md` como fonte única de verdade
7. Arquivar `PLANEJAMENTO.md` em `docs/planejamento-template.md` (arquivo de referência histórica)
8. `AGENTS.md` simplificado — mantém apenas fluxo visual + links para cada skill

**Consequências**:
- Hotfix: ~13k tokens (-66% vs. pipeline completo)
- Feature nova: ~28k tokens (-26% vs. ~38k anterior)
- Schema sempre atualizado — sem risco de modelagem baseada em schema obsoleto
- `CLAUDE.md` é a fonte canônica de status de domínios
- Worktrees ativos precisam de merge manual: CLAUDE.md, AGENTS.md, orchestrator.md, agent-database.md, agent-documentation.md, agent-architect.md, settings.json; novos arquivos (agent-hotfix.md, agent-mobile.md) precisam ser copiados

---

## ADR-007 — Auditoria de índices e N+1 (issue #122)

**Data**: 2026-06-21
**Status**: Aceito

**Contexto**: Issue #122 pediu auditoria completa de `prisma/schema.prisma` contra FKs sem índice, N+1 nos repositories de `scheduling`/`financial`/`crm`/`notifications`, e reaproveitamento de campos antes de criar colunas novas.

**Decisão**:
1. Adicionar 22 índices aditivos (migration `20260622014940_add_missing_fk_and_composite_indexes`) — toda FK sem índice correspondente, mais `Appointment.[tenantId,customerId]`, `Appointment.[tenantId,status]` e `Transaction.[tenantId,professionalId]` pedidos explicitamente na issue.
2. Não aplicar índice parcial por status — Prisma não representa `WHERE` em `@@index`; aplicar via SQL bruto criaria schema drift na próxima `migrate dev`. Proposta documentada em `docs/auditoria-banco-dados-2026-06.md` para aplicação manual futura.
3. Corrigir 2 N+1 reais encontrados em jobs de fila (`subscription-expiry-warnings.ts`, `recurring-expense.ts`) — nenhum N+1 encontrado nos repositories principais.
4. `Subscription.externalId` (campo confirmado sem uso em todo o `src/` e em 0 de 15 linhas no banco) — documentado como candidato a remoção e, após confirmação explícita do usuário, removido via migration dedicada (`20260622021203_remove_unused_subscription_external_id`, branch `chore/remove-subscription-external-id`). Era um placeholder de "ID no Asaas/Stripe" do schema inicial de planos (27/05/2026), substituído pelos campos tipados `stripeCustomerId`/`stripeSubId`/`stripePriceId` quando a integração Stripe foi implementada (07/06/2026) e nunca limpo depois.

**Consequências**:
- Queries por `customerId`, `status`, `professionalId` (Transaction), e todas as FKs antes sem índice passam a usar index scan em vez de seq scan.
- `PromotionItem` (que não tinha nenhum índice) passa a ter as 3 FKs indexadas.
- Relatório completo de achados em `docs/auditoria-banco-dados-2026-06.md` — inclui análise de reaproveitamento de schema.
- `Subscription.externalId` removido — sem impacto, campo nunca foi lido/escrito por código nem tinha dado em nenhuma linha.

---

## ADR-008 — Defesa em profundidade para rotas de API no middleware (issue #145)

**Data**: 2026-06-22
**Status**: Aceito

**Contexto**: Auditoria de QA (#123) encontrou que `config.matcher` do `middleware.ts` excluía `api/.*` por completo — nenhuma rota de API passava pelo middleware, então toda a proteção de tenant dependia 100% de cada `route.ts` chamar `getSessionContext`/`getAdminContext` manualmente, sem nenhuma rede de segurança central. Não havia vazamento ativo confirmado, mas o modelo era frágil a regressão silenciosa: bastava uma rota nova esquecer essa chamada.

**Decisão**: Middleware passa a cobrir `/api/*` com um gate mínimo — "existe sessão Supabase" — deny-by-default, com allowlist explícita do que é público ou usa mecanismo de auth próprio:
- `/api/public/*` (booking público), `/api/webhooks/*` (assinatura própria por provider), `/api/admin/*` (Bearer `ADMIN_API_SECRET` via `getAdminContext`, não cookie), `/api/auth/signup`, `/api/dev/*`, `/api/billing/plans`, `/api/billing/stripe/webhook`, `/api/iam/tenant-branding`.
- Todo o resto exige `supabase.auth.getUser()` válido (ou o bypass de dev via `x-auth-mode: headers`, já existente em `session.ts`, replicado aqui para não quebrar o fluxo de teste manual local).

O gate **não substitui** `getSessionContext`/tenant scoping — cada route.ts continua responsável pela autorização real (role, permissões, `tenantId`). É só a segunda camada que impede uma rota nova exposta por omissão.

**Alternativas consideradas**:
- Tornar o matcher mais granular por domínio (`/api/iam/*`, `/api/financial/*`, etc., como sugerido originalmente na issue) — descartado por adicionar manutenção (toda rota nova de domínio protegido exigiria lembrar de incluir o prefixo) sem ganho real sobre o deny-by-default com allowlist do que é público (lista mais curta e estável).

**Consequências**:
- Toda chamada a uma rota protegida agora faz uma verificação de sessão Supabase extra no middleware, além da que o próprio route.ts já fazia — custo de latência aceito como trade-off de defesa em profundidade.
- Mapeadas as 153 rotas existentes em `src/app/api` por mecanismo de auth antes da mudança, para garantir que a allowlist não quebrasse webhooks, admin ou onboarding.
- Achados fora do escopo desta issue, não corrigidos aqui: `POST /api/auth/signup` não tem `try/catch`/`handleApiError` e retorna 500 em vez de 422 para payload invalido (bug pré-existente, encontrado durante o smoke test).

---

## ADR-009 — Estorno de receita como ação manual, separada do cancelamento (issue #154)

**Data**: 2026-06-22
**Status**: Aceito

**Contexto**: Issue #142 (auditoria de QA #123) encontrou que cancelar um agendamento com `paymentStatus = PAID` não reflete nada no financeiro — a `Transaction` de receita criada por `markPayment` continua registrada como se o atendimento tivesse acontecido. O hotfix de #142 (PR #153) só adicionou um aviso ao operador no modal de cancelamento; o reflexo financeiro foi propositalmente deixado fora do hotfix e movido para esta issue.

**Investigação prévia**: o pagamento do cliente final acontece **fora do sistema** (maquininha, PIX, dinheiro no balcão) — não há gateway de pagamento integrado ao checkout de agendamento (o Stripe deste projeto cobra a assinatura SaaS do salão, não o cliente final). Logo, "estorno" aqui nunca é devolver dinheiro real — é manter o financeiro consistente com uma devolução que o operador já fez (ou não) na vida real.

**Decisão**: Estorno é uma ação **explícita e manual**, separada do cancelamento — não automática.

1. Cancelar um agendamento `PAID` continua só cancelando (aviso já implementado em #142/PR #153) — não cria nenhuma `Transaction` automaticamente.
2. Um botão "Confirmar estorno" passa a aparecer no agendamento cancelado com `paymentStatus = PAID`. Só ao confirmar, o sistema registra uma `Transaction` `INCOME` com `amount`/`netAmount`/`commissionAmount` **negativos**, mesma categoria `SERVICE`, vinculada ao `appointmentId` original.
3. Nenhuma mudança necessária em `reports.service.ts` nem `src/app/api/financial/summary/route.ts` — `grossRevenue`/`netRevenue`/`commissions` já são somas simples sobre transações `INCOME`; uma entrada negativa se ajusta sozinha, sem precisar de filtro por categoria (diferente do lado de despesa, que usa `isReversal`/`SUPPLY_REVERSAL`).

**Alternativa rejeitada — estorno automático no momento do cancelamento**: cancelamento e devolução de dinheiro não são a mesma coisa na vida real — um salão pode cancelar e reter o valor (política de não-reembolso) ou devolver dias depois. Criar a `Transaction` negativa automaticamente no instante do cancelamento faria o sistema assumir que o dinheiro voltou quando isso não é garantido — um erro de contabilidade pior do que não fazer nada.

**Consequências**:
- `getProfessionalsReport` (`reports.service.ts:208`) soma receita por `appointmentId` via `appointment.transactions` — uma entrada negativa no mesmo `appointmentId` neutraliza corretamente sem mudança de código.
- `byGroup` em `getFinancialReport` (`reports.service.ts:74`) incrementa `quantidade` por transação, não por agendamento — um agendamento estornado contará como 2 ocorrências (pagamento + estorno) no agrupamento por serviço/profissional, com `receita` líquida correta. Limitação conhecida, aceitável; revisar se incomodar na prática.
- `src/domains/financial/DOMAIN.md` está desatualizado (cita evento `scheduling.appointment.completed`, que não existe; o real é `scheduling.appointment.paid`) — corrigir numa sessão de documentação separada, fora do escopo desta ADR.

---

## ADR-010 — Remoção do plano FREE comercial; bloqueio de acesso em vez de downgrade automático

**Data**: 2026-06-24
**Status**: Aceito

**Contexto**: O plano FREE permanente prejudicava a conversão e não refletia o posicionamento atual do produto. Decisão de negócio: parar de vender/oferecer FREE em qualquer superfície (landing, `/planos`, onboarding).

**Problema técnico encontrado**: `PlanName.FREE` não era só uma opção comercial — era usado como *fallback* interno sempre que um trial expirava ou uma assinatura era cancelada (`billing.service.ts: runExpireSweep`, webhook `customer.subscription.deleted`, `/api/billing/sync`). Esses fluxos rebaixavam o tenant para FREE silenciosamente, perdendo o registro de qual plano ele tinha antes e permitindo acesso contínuo (ainda que limitado).

**Decisão**:
1. `PlanName.FREE` permanece no enum do Prisma (sem migration destrutiva), mas o registro em `Plan` fica com `isActive: false` — nunca aparece em `/api/public/plans`, `/planos`, onboarding ou cards de admin.
2. Trial expirado ou assinatura cancelada/sem renovação **não rebaixam mais o `plan` para FREE** — `status` vai para `EXPIRED`/`CANCELLED` mantendo o `plan` real (`runExpireSweep`, `sync/route.ts`, webhook `customer.subscription.deleted` agora preservam `sub.plan`).
3. `src/app/(app)/layout.tsx` passou a checar `featureGuard.getSubscriptionState()` e, se o status não for `TRIALING`/`ACTIVE`/`PAST_DUE`, renderiza `<SubscriptionLockedScreen>` em vez de `<AppShell>` — bloqueio total do painel até o dono escolher e assinar um plano. Apenas o `OWNER` vê o seletor de planos; demais papéis veem mensagem para contatar o dono.
4. Novo tenant não recebe mais subscription FREE automática no signup (`billingService.startFree` removido) — sem subscription, `getSubscriptionState` já cai em `status: EXPIRED` por padrão, então o tenant fica bloqueado até escolher um plano no onboarding (comportamento existente, agora consistente).
5. `/api/billing/checkout` e `/api/billing/portal` passaram a exigir `session.isOwner` (mesma regra já aplicada em `/api/billing/start-trial`) — gap de autorização pré-existente, corrigido porque a tela de bloqueio agora é o caminho principal para contratar/renovar.

**Alternativa rejeitada — remover `FREE` do enum**: exigiria migration destrutiva e tocaria toda a lógica de fallback (`feature-guard.ts`, `plan-limits.service.ts`) que usa `PlanName.FREE` como valor "sem acesso". Manter o enum e apenas desativar a venda é mais seguro e reversível.

**Consequências**:
- Tenants existentes nunca tiveram FREE real em produção (confirmado antes da mudança) — sem necessidade de migração de dados.
- `BillingPlansContent`/`SharedPlanCard` perderam os ramos especiais para `plan.name === 'FREE'` (não há mais como a API retornar um plano FREE ativo para exibição).
- Página `/configuracoes/planos` fica inacessível enquanto o tenant está bloqueado (todo o `(app)` layout é substituído pela tela de bloqueio) — a própria tela de bloqueio embute o seletor de planos, então não há perda de funcionalidade.
