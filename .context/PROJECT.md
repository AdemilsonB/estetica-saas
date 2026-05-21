# PROJECT.md — Visão geral do projeto

## O produto

SaaS operacional para negócios de estética — barbearias, salões, clínicas, estúdios de tatuagem, maquiadores e qualquer negócio baseado em agendamento e relacionamento com cliente.

**Posicionamento**: Vertical AI-Augmented Business Operating System.
Não é ERP. Não é agenda online. É uma plataforma operacional inteligente.

## Stack MVP

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 15, React, TypeScript |
| Backend | Next.js API Routes (TypeScript) |
| UI | Shadcn UI (Nova/Rose), TailwindCSS, Lucide |
| Banco | Supabase (PostgreSQL + Auth + Realtime) |
| ORM | Prisma |
| State | Zustand (UI) + TanStack Query (server) |
| Validação | Zod |
| Filas | pg-boss |
| Deploy | Vercel + Supabase |

## Custo de operação

| Fase | Custo/mês |
|---|---|
| MVP (0 clientes) | R$ 0 |
| Primeiros clientes | R$ 0–250 |
| Crescimento | R$ 250–800 |

## Repositório

- GitHub: https://github.com/AdemilsonB/estetica-saas
- Deploy: Vercel (automático a cada push na main)
- Banco: Supabase

## Status atual

### Infraestrutura
- [x] Projeto Next.js 16 + React 19 + TypeScript
- [x] Shadcn UI configurado (Nova/Rose) + TailwindCSS 4
- [x] Repositório GitHub + Vercel CI/CD
- [x] Estrutura de pastas, agentes e contexto
- [x] Supabase integração configurada (adapters, auth, session)
- [x] Prisma 7 schema completo (7 models, multi-tenant, índices)
- [x] Shared: errors tipados, event bus, middleware, validação, RBAC, config env

### Backend (domínios)
- [x] IAM — RBAC, session, permissões (sem UI de login/registro)
- [x] CRM — repository, service, API (GET/POST/PATCH + busca + paginação)
- [x] Scheduling — repository, service, availability, API (GET/POST + filtros)
- [x] Financial — repository, service, API (GET/POST + filtros + paginação)
- [x] Notifications — subscriptions de eventos, provider WhatsApp (stub)
- [x] Billing — tipos e documentação (stub Fase 2)
- [x] Automation — tipos e documentação (stub Fase 2)

### Frontend
- [ ] Shell de navegação (sidebar + bottom nav mobile)
- [ ] IAM: login, registro de tenant, onboarding
- [ ] CRM: listagem, perfil e cadastro de clientes
- [ ] Scheduling: agenda semanal, modal de agendamento
- [ ] Financial: listagem de transações, fechamento de caixa
- [ ] Dashboard: métricas básicas

### Integrações
- [ ] Evolution API (WhatsApp) — provider stub existente, sem credenciais
- [ ] pg-boss — instalado, sem jobs registrados
