# ROADMAP.md — Fases e status

## Fase 1 — MVP (em andamento)

### Infraestrutura ✅
- [x] Next.js 16 + TypeScript + TailwindCSS 4
- [x] Shadcn UI (Nova/Rose)
- [x] GitHub + Vercel CI/CD
- [x] Estrutura de agentes e contexto
- [x] Supabase integração configurada (adapters, auth, providers)
- [x] Prisma 7 schema completo + migrations + seed de desenvolvimento
- [x] Shared: errors tipados, event bus, middleware, validação, RBAC, config env

### Domínio IAM 🟡 Parcial
- [x] Models: Tenant, User (schema Prisma)
- [x] Middleware de tenant (withTenant, getSessionContext)
- [x] RBAC: roles e permissões granulares (ROLE_PERMISSIONS)
- [x] Auth com Supabase configurado (adapters, session)
- [ ] Página de login
- [ ] Registro de tenant + onboarding
- [ ] Invite de usuários

### Domínio CRM ✅ Backend completo
- [x] Model: Customer (schema Prisma)
- [x] CustomerRepository + CustomerService
- [x] API: CRUD de clientes (GET com busca + paginação, POST, PATCH)
- [ ] Página de listagem de clientes
- [ ] Página de perfil do cliente
- [ ] Formulário de cadastro/edição

### Domínio Scheduling ✅ Backend completo
- [x] Models: Appointment, Service (schema Prisma)
- [x] AppointmentRepository + SchedulingService
- [x] AvailabilityService (verificação de conflitos de horário)
- [x] API: agendamentos (GET com filtros de data/status/profissional, POST)
- [x] API: serviços (GET, POST)
- [x] API: atualização de status (PATCH)
- [ ] Agenda semanal (tela principal)
- [ ] Modal de criação de agendamento
- [ ] Gestão de serviços (UI)

### Domínio Financial ✅ Backend completo
- [x] Model: Transaction (schema Prisma)
- [x] TransactionRepository + FinancialService
- [x] Geração automática de receita ao concluir agendamento (via eventos)
- [x] API: transações (GET com filtros tipo/data + paginação, POST)
- [ ] Fechamento de caixa
- [ ] Página financeira

### Domínio Notifications 🟡 Parcial
- [x] Model: NotificationLog (schema Prisma)
- [x] NotificationRepository + NotificationService
- [x] Subscriptions de eventos (criado, cancelado, no_show)
- [ ] Integração Evolution API (WhatsApp) — provider stub, sem credenciais
- [ ] Lembrete 24h antes (requer pg-boss)

---

## Fase 2 — Operação avançada

- [ ] Estoque e consumo por serviço
- [ ] Comissões por profissional
- [ ] Motor de automações (Billing + Automation — stubs criados)
- [ ] Campanhas de retenção
- [ ] Dashboard com analytics
- [ ] Relatórios avançados
- [ ] Billing SaaS (planos, limites, trials) — stub criado

---

## Fase 2 — Operação avançada

- [ ] Estoque e consumo por serviço
- [ ] Comissões por profissional
- [ ] Motor de automações (triggers + conditions + actions)
- [ ] Campanhas de retenção
- [ ] Dashboard com analytics
- [ ] Relatórios avançados

## Fase 3 — Camada inteligente

- [ ] IA: insights operacionais
- [ ] IA: previsão de churn
- [ ] IA: recomendações de horário
- [ ] IA: campanhas inteligentes
- [ ] Copiloto conversacional

## Fase 4 — Escala

- [ ] Multi-unidade
- [ ] Billing SaaS (planos, limites, trials)
- [ ] App mobile
- [ ] API pública
- [ ] Integrações: Stripe, Asaas, PlugNotas
