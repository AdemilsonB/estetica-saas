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
