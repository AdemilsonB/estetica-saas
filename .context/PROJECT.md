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

- [x] Projeto Next.js criado
- [x] Shadcn UI configurado (Nova/Rose)
- [x] Repositório GitHub iniciado
- [x] Vercel conectado
- [x] Estrutura de pastas e agentes criada
- [ ] Supabase projeto criado e conectado
- [ ] Prisma schema configurado
- [ ] Shared utilities (errors, events, middleware)
- [ ] Domínio IAM
- [ ] Domínio CRM
- [ ] Domínio Scheduling
- [ ] Domínio Financial
- [ ] Domínio Notifications
