# CLAUDE.md — Contexto principal do projeto

> Este arquivo é lido automaticamente pelo Claude Code em toda sessão.
> Contém as regras, padrões e contexto essencial do projeto.

---

## O que é esse projeto

SaaS operacional para negócios de estética (barbearias, salões, clínicas, estúdios).
Posicionamento: **Vertical AI-Augmented Business Operating System**.
Não é um ERP. Não é uma agenda. É uma plataforma operacional inteligente.

---

## Stack

- **Frontend + Backend**: Next.js 15 App Router + TypeScript
- **Banco**: Supabase (PostgreSQL gerenciado + Auth + Realtime)
- **ORM**: Prisma
- **UI**: Shadcn UI (Nova preset) + TailwindCSS
- **Estado**: Zustand (UI) + TanStack Query (server state)
- **Validação**: Zod
- **Filas**: pg-boss (sobre o PostgreSQL)
- **Deploy**: Vercel (frontend) + Supabase (banco)

---

## Estrutura de pastas

```
src/
├── app/              # Next.js App Router — páginas e API Routes
├── domains/          # Lógica de negócio por domínio (DDD)
│   ├── iam/
│   ├── crm/
│   ├── scheduling/
│   ├── financial/
│   └── notifications/
├── shared/           # Código verdadeiramente compartilhado
│   ├── database/     # Prisma client
│   ├── events/       # Event bus interno
│   ├── errors/       # Erros de domínio tipados
│   └── types/        # Tipos globais
├── components/       # Componentes React
│   ├── ui/           # Shadcn UI
│   └── domain/       # Componentes de domínio
└── lib/              # Utilitários e configurações
```

---

## Regras obrigatórias — SEMPRE seguir

### Multi-tenancy
- Todo model Prisma de negócio tem `tenantId: String`
- Todo repository filtra por `tenantId` em TODAS as queries
- `tenantId` é sempre extraído do token — NUNCA do body ou URL
- Índice `@@index([tenantId])` em toda tabela de negócio

### Arquitetura em camadas
```
API Route (controller fino)
    ↓ valida input com Zod
Service (regras de negócio)
    ↓ usa repository
Repository (acesso a dados)
    ↓ sempre filtra tenantId
Prisma Client
```

### Eventos entre domínios
- Domínios NÃO se importam diretamente
- Comunicação via `eventBus.publish()` em `src/shared/events/`
- Notifications e Automation apenas ESCUTAM eventos

### Erros
- Sempre usar erros de domínio tipados de `src/shared/errors/`
- NUNCA `throw new Error('string genérica')`
- NUNCA retornar `{ error: 'string' }` sem código tipado

### TypeScript
- Strict mode ativado — sem `any`, sem `as unknown as`
- Zod para validação de input em toda API Route
- Tipos de domínio definidos em `domains/[dominio]/types.ts`

---

## Regras — NUNCA fazer

- Lógica de negócio em componentes React
- Queries diretas ao banco em API Routes (sempre via repository)
- Acoplamento direto entre domínios
- Hardcode de IDs, roles ou strings mágicas sem constante
- `console.log` em produção (usar logger estruturado)
- `tenantId` vindo do body da requisição

---

## Padrão de API Route

```typescript
export async function POST(req: Request) {
  try {
    const tenantId = await withTenant(req)
    const input = await validateInput(req, CreateXSchema)
    const result = await xService.create(tenantId, input)
    return Response.json(result, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
```

## Padrão de Repository

```typescript
export class XRepository {
  async findById(tenantId: string, id: string) {
    return prisma.x.findFirst({
      where: { id, tenantId } // tenantId SEMPRE presente
    })
  }
}
```

## Padrão de Service

```typescript
export class XService {
  constructor(
    private readonly repo: XRepository,
    private readonly events: DomainEventBus
  ) {}

  async create(tenantId: string, input: CreateXInput) {
    const result = await this.repo.create(tenantId, input)
    this.events.publish({ type: 'x.created', payload: { tenantId, result } })
    return result
  }
}
```

---

## Domínios — Fase 1 (MVP)

| Domínio | Status | Descrição |
|---|---|---|
| IAM | 🔴 não iniciado | Auth, tenants, roles, permissões |
| CRM | 🔴 não iniciado | Clientes, histórico |
| Scheduling | 🔴 não iniciado | Agenda, agendamentos |
| Financial | 🔴 não iniciado | Transações, caixa |
| Notifications | 🔴 não iniciado | WhatsApp, email |

---

## Checklist antes de entregar qualquer feature

- [ ] `tenantId` em todo model novo no Prisma
- [ ] Repository com filtro de tenant em todas as queries
- [ ] Service com regras de negócio e publicação de eventos
- [ ] API Route com `withTenant()` e validação Zod
- [ ] Erros tipados para todos os casos de falha
- [ ] Componente com loading state e error state
- [ ] Sem `any` no TypeScript

---

## Arquivos de contexto complementares

- `.claude/AGENTS.md` — como usar cada agente
- `.claude/agent-backend.md` — agente de domínios e API
- `.claude/agent-frontend.md` — agente de UI e componentes
- `.claude/agent-database.md` — agente de schema e migrations
- `.claude/agent-review.md` — agente revisor de código
- `.context/PATTERNS.md` — padrões detalhados de código
- `.context/CONVENTIONS.md` — naming conventions
- `docs/decisions.md` — decisões arquiteturais (ADRs)
