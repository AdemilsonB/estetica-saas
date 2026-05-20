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
