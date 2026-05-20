# Visão & Arquitetura Alvo — SaaS Operacional para Estética

> Este documento define a visão de produto, posicionamento e arquitetura alvo de longo prazo.
> Não é usado diretamente para geração de código. É o norte estratégico do produto.

---

## Visão do produto

Estamos construindo uma plataforma operacional inteligente para negócios de estética e serviços — barbearias, salões, clínicas estéticas, estúdios de tatuagem, maquiadores, manicures, estúdios fotográficos e qualquer negócio baseado em agendamento e relacionamento com cliente.

O produto não é um ERP. Não é uma agenda online. Não é um CRM básico.

É um **Vertical AI-Augmented Business Operating System** — uma plataforma que centraliza a operação, automatiza processos, aumenta retenção de clientes e entrega inteligência contextual para o dono do negócio crescer.

O objetivo final é ser a principal plataforma operacional inteligente para negócios de estética e serviços da América Latina.

---

## Posicionamento

O sistema deve transmitir: sofisticação, velocidade, inteligência operacional, simplicidade de uso e automação contextual. A experiência deve parecer um **Operational Workspace** — contextual, rápido, inteligente, minimalista, premium.

Inspirações de UX: Linear, Stripe, Notion, Vercel, Framer. Com identidade visual elegante, tons rosados suaves e UX extremamente fluida.

O produto não resolve apenas gestão. Resolve **crescimento operacional inteligente**.

---

## Mercado-alvo inicial

- Barbearias
- Salões de beleza
- Clínicas estéticas
- Estúdios de tatuagem
- Maquiadores e manicures profissionais
- Estúdios fotográficos
- Qualquer negócio baseado em agendamento e relacionamento

Expansão futura para múltiplos nichos de serviços na América Latina.

---

## Arquitetura alvo (longo prazo)

### Modelo arquitetural

- **Modular Monolith** com Spring Modulith (ou equivalente Node.js)
- **DDD Estratégico** com bounded contexts explícitos
- **Event-Driven Architecture Interna** — módulos comunicam por eventos, não por chamadas diretas
- Multi-tenancy com isolamento progressivo: shared database → database per tenant → sharding

### Bounded contexts

| Contexto | Responsabilidade |
|---|---|
| IAM | Autenticação, autorização, RBAC multi-tenant |
| CRM | Clientes, histórico, retenção, frequência |
| Scheduling | Agenda, conflitos, encaixes, disponibilidade |
| Financial | Caixa, comissões, relatórios financeiros |
| Billing | Planos SaaS, módulos, trials, upgrades |
| Inventory | Estoque, alertas, consumo por serviço |
| Sales | PDV, orçamentos, pacotes de serviços |
| Analytics | Read models derivados por eventos, KPIs |
| Automation | Triggers, conditions, actions, workflows |
| Notifications | WhatsApp, email, push — desacoplado |
| Integrations | Providers de pagamento, fiscal, comunicação |
| AI | Copiloto, insights, recomendações, previsões |
| Subscription | Gestão de planos e consumo por tenant |
| Audit | Rastreabilidade de ações e eventos |

### Consistência

- **Forte**: financeiro, agenda, billing, autenticação, permissões
- **Eventual**: notificações, automações, analytics, IA, integrações, campanhas

### Segurança

RBAC granular multi-tenant. Toda autorização é permission-driven, feature-driven e tenant-aware. Nenhuma role hardcoded como ROLE_ADMIN.

```
Tenant → Roles → Permissions → Features → UI Capabilities
```

### Motor de automações

Triggers → Conditions → Actions, completamente desacoplado do core transacional.

Exemplos de triggers: `appointment_created`, `payment_confirmed`, `customer_inactive`, `stock_low`
Exemplos de actions: send whatsapp, send email, create task, generate coupon, notify manager

### Camadas de IA

A IA atua como copiloto operacional — nunca executa operações críticas autonomamente.

- **AI Insights** — insights operacionais derivados de eventos
- **AI Recommendations** — sugestões contextuais para o operador
- **AI Predictions** — previsões de demanda, churn, receita
- **AI Campaigns** — campanhas inteligentes baseadas em comportamento
- **AI Assistant** — copiloto conversacional contextual

Fluxo: `Operational Events → Analytics Layer → AI Context Builder → AI Services → Automation Engine → Human Approval Layer`

### Stack alvo (quando escalar)

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js, React, TypeScript, TailwindCSS, Shadcn UI |
| Backend | Node.js + TypeScript ou Java 21 + Spring Boot |
| Banco principal | PostgreSQL (RDS) |
| Cache | Redis (ElastiCache) |
| Filas | RabbitMQ ou BullMQ |
| Infra | AWS ECS, CloudFront, S3 |
| Observabilidade | OpenTelemetry, logs estruturados, audit trail |

### Integrações previstas

- Comunicação: WhatsApp Cloud API, Evolution API, Twilio
- Pagamentos: Stripe, Mercado Pago, Asaas
- Fiscal: PlugNotas, Focus NFe

---

## Roadmap macro

### Fase 1 — Core operacional
IAM, CRM, Agenda, Financeiro básico, Serviços, Usuários, Permissões, WhatsApp, Notificações

### Fase 2 — Operação avançada
Estoque, Comissões, Automações, Campanhas, Dashboards, Analytics

### Fase 3 — Camada inteligente
IA operacional, Insights, Retenção, Recomendações, Automações inteligentes

### Fase 4 — Escala
Multi-unidade, Billing avançado, Integrações expandidas, Apps mobile, APIs externas

---

## Princípios de engenharia (alvo)

**Obrigatório**: Clean Code, SOLID pragmático, DDD estratégico, arquitetura modular, eventos desacoplados, idempotência, retry policies, observabilidade, tracing, auditabilidade.

**Nunca**: arquitetura procedural, service god classes, controllers gordos, regras espalhadas, acoplamento entre módulos, queries pesadas no operacional.

---

## Diretrizes para agentes de IA no desenvolvimento

Os agentes devem: respeitar boundaries, evitar acoplamento, seguir arquitetura modular, usar linguagem ubíqua, criar código legível e documentar decisões importantes.

Os agentes não devem: criar abstrações desnecessárias, aplicar overengineering, misturar domínios, duplicar lógica ou criar dependências cruzadas.
