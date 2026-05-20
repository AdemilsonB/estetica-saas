# ROADMAP.md — Fases e status

## Fase 1 — MVP (atual)

### Infraestrutura
- [x] Next.js 15 + TypeScript + TailwindCSS
- [x] Shadcn UI (Nova/Rose)
- [x] GitHub + Vercel CI/CD
- [x] Estrutura de agentes e contexto
- [ ] Supabase conectado (DATABASE_URL)
- [ ] Prisma schema base + migration inicial
- [ ] Shared: errors, events, middleware, validation

### Domínio IAM
- [ ] Model: Tenant, User
- [ ] Auth com Supabase (login, cadastro, magic link)
- [ ] Middleware de tenant
- [ ] RBAC: roles e permissões
- [ ] Página de login
- [ ] Onboarding de novo tenant

### Domínio CRM
- [ ] Model: Customer
- [ ] CustomerRepository + CustomerService
- [ ] API: CRUD de clientes
- [ ] Página de listagem de clientes
- [ ] Página de perfil do cliente
- [ ] Formulário de cadastro/edição

### Domínio Scheduling
- [ ] Model: Appointment, Service
- [ ] AppointmentRepository + AppointmentService
- [ ] AvailabilityService (verificação de conflitos)
- [ ] API: CRUD de agendamentos
- [ ] API: listagem de disponibilidade
- [ ] Agenda semanal (tela principal)
- [ ] Modal de criação de agendamento
- [ ] Gestão de serviços

### Domínio Financial
- [ ] Model: Transaction
- [ ] TransactionRepository + TransactionService
- [ ] API: CRUD de transações
- [ ] Fechamento de caixa
- [ ] Página financeira básica

### Domínio Notifications
- [ ] Integração Evolution API (WhatsApp)
- [ ] Confirmação automática de agendamento
- [ ] Lembrete 24h antes
- [ ] Listener de eventos

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
