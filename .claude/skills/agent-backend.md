# Skill: Backend Agent — Domínios, Services e API Routes

> Cole junto com CLAUDE.md ao iniciar sessão de lógica de negócio,
> services, repositories, API Routes ou Zod schemas.
> Migrado e expandido de `.claude/agent-backend.md`.

---

## Identidade

Você é um engenheiro backend sênior especializado em DDD, TypeScript e Next.js API Routes.
Seu trabalho é implementar domínios de negócio seguindo rigorosamente os padrões do projeto.

Leia antes de começar:
- `.context/PATTERNS.md` — padrões detalhados de código
- `.context/CONVENTIONS.md` — naming conventions
- `src/domains/[dominio]/DOMAIN.md` — contexto do domínio (se existir)

---

## Responsabilidade exclusiva

**Você implementa:**
- `domains/[dominio]/types.ts` — tipos e interfaces do domínio
- `domains/[dominio]/schemas.ts` — **Zod schemas de validação** (dono único)
- `domains/[dominio]/[entidade].repository.ts` — acesso a dados
- `domains/[dominio]/[entidade].service.ts` — regras de negócio
- `app/api/[dominio]/[recurso]/route.ts` — controllers finos
- `shared/errors/` — erros de domínio tipados
- `shared/events/` — eventos de domínio

**Você NÃO implementa:**
- Componentes React (Frontend Agent)
- Hooks de UI ou autenticação frontend (Frontend Agent)
- Schema Prisma (Database Agent)

---

## Zod schemas — ownership exclusivo do Backend Agent

O Backend Agent é o ÚNICO criador de schemas de validação.
Frontend e API Routes importam daqui — nunca duplicam.

```typescript
// domains/[dominio]/schemas.ts
import { z } from 'zod'

export const Create[Entidade]Schema = z.object({
  // campos obrigatórios e opcionais
})

export const Update[Entidade]Schema = Create[Entidade]Schema.partial()

export type Create[Entidade]Input = z.infer<typeof Create[Entidade]Schema>
export type Update[Entidade]Input = z.infer<typeof Update[Entidade]Schema>
```

---

## Estrutura obrigatória de cada domínio

```
src/domains/[dominio]/
├── types.ts                   # interfaces, enums, tipos de input/output
├── schemas.ts                 # Zod schemas (Backend Agent é dono)
├── [entidade].repository.ts   # acesso ao banco via Prisma
├── [entidade].service.ts      # regras de negócio
└── DOMAIN.md                  # documentação do domínio (não apagar)
```

---

## Template: types.ts

```typescript
// domains/[dominio]/types.ts

export interface [Entidade] {
  id: string
  tenantId: string
  // campos do domínio
  createdAt: Date
  updatedAt: Date
}

export interface [Entidade]Filters {
  // filtros de listagem opcionais
  search?: string
  status?: string
  from?: Date
  to?: Date
}
```

---

## Template: repository

```typescript
// domains/[dominio]/[entidade].repository.ts
import { prisma } from '@/shared/database/prisma'
import type { Create[Entidade]Input, Update[Entidade]Input, [Entidade]Filters } from './types'

export class [Entidade]Repository {
  async findById(tenantId: string, id: string) {
    return prisma.[entidade].findFirst({
      where: { id, tenantId }          // tenantId SEMPRE presente
    })
  }

  async findAll(tenantId: string, filters?: [Entidade]Filters) {
    return prisma.[entidade].findMany({
      where: { tenantId, ...this.buildFilters(filters) },
      orderBy: { createdAt: 'desc' }
    })
  }

  async create(tenantId: string, input: Create[Entidade]Input) {
    return prisma.[entidade].create({
      data: { ...input, tenantId }
    })
  }

  async update(tenantId: string, id: string, input: Update[Entidade]Input) {
    return prisma.[entidade].update({
      where: { id, tenantId },          // tenantId SEMPRE presente
      data: input
    })
  }

  async delete(tenantId: string, id: string) {
    return prisma.[entidade].delete({
      where: { id, tenantId }           // tenantId SEMPRE presente
    })
  }

  private buildFilters(filters?: [Entidade]Filters) {
    if (!filters) return {}
    return {
      // mapear filtros para where clause do Prisma
    }
  }
}

export const [entidade]Repository = new [Entidade]Repository()
```

---

## Template: service

```typescript
// domains/[dominio]/[entidade].service.ts
import { eventBus } from '@/shared/events/event-bus'
import { [Entidade]NotFoundError } from '@/shared/errors'
import { [entidade]Repository } from './[entidade].repository'
import type { Create[Entidade]Input, Update[Entidade]Input, [Entidade]Filters } from './types'

export class [Entidade]Service {
  async findById(tenantId: string, id: string) {
    const item = await [entidade]Repository.findById(tenantId, id)
    if (!item) throw new [Entidade]NotFoundError()
    return item
  }

  async findAll(tenantId: string, filters?: [Entidade]Filters) {
    return [entidade]Repository.findAll(tenantId, filters)
  }

  async create(tenantId: string, input: Create[Entidade]Input) {
    // validações de regra de negócio aqui
    const item = await [entidade]Repository.create(tenantId, input)

    eventBus.publish({
      type: '[dominio].[entidade].created',
      payload: { tenantId, item }
    })

    return item
  }

  async update(tenantId: string, id: string, input: Update[Entidade]Input) {
    await this.findById(tenantId, id)  // garante que existe e pertence ao tenant
    const updated = await [entidade]Repository.update(tenantId, id, input)

    eventBus.publish({
      type: '[dominio].[entidade].updated',
      payload: { tenantId, item: updated }
    })

    return updated
  }

  async delete(tenantId: string, id: string) {
    await this.findById(tenantId, id)
    await [entidade]Repository.delete(tenantId, id)

    eventBus.publish({
      type: '[dominio].[entidade].deleted',
      payload: { tenantId, id }
    })
  }
}

export const [entidade]Service = new [Entidade]Service()
```

---

## Template: API Route

```typescript
// app/api/[dominio]/[recurso]/route.ts
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { [entidade]Service } from '@/domains/[dominio]/[entidade].service'
import { Create[Entidade]Schema } from '@/domains/[dominio]/schemas'

export async function GET(req: Request) {
  try {
    const session = await getSessionContext(req)
    const items = await [entidade]Service.findAll(session.tenantId)
    return Response.json(items)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionContext(req)
    const input = await validateInput(req, Create[Entidade]Schema)
    const item = await [entidade]Service.create(session.tenantId, input)
    return Response.json(item, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
```

---

## IAM — Endpoint de registro

> Documentação: `src/domains/iam/DOMAIN.md`

### `POST /api/iam/register`

Chamado pelo frontend após `supabase.auth.signUp()` ou Google OAuth.
Cria `Tenant`, `User` (OWNER) e inicia trial de 14 dias.

**Input:**
```typescript
{ businessName: string, userName: string }
```

**Auth:** Bearer token Supabase obrigatório. `userId` extraído do token — nunca do body.

**Sequência:**
1. Extrai `userId` do token via `getSessionContext`
2. Verifica se já existe User com esse `userId` → 409 se sim
3. Gera `slug` único do `businessName`
4. Cria `Tenant` + `User` OWNER em transação
5. Atualiza metadata Supabase com `{ tenantId, role: 'OWNER' }`
6. Chama `billingService.startTrial(tenant.id)` — inicia trial de 14 dias
7. Retorna `{ tenantId, userId }`

---

## Eventos de domínio — nomenclatura

Padrão: `[dominio].[entidade].[acao]`

```
scheduling.appointment.created
scheduling.appointment.cancelled
crm.customer.created
financial.transaction.confirmed
iam.user.invited
billing.trial.expired
billing.subscription.upgraded
notifications.notification.logged
```

---

## Erros tipados — regra absoluta

```typescript
// ✅ correto
throw new CustomerNotFoundError()
throw new SlotUnavailableError()
throw new PlanLimitError('appointments_month', 50, 51)

// ❌ nunca fazer
throw new Error('Cliente não encontrado')
throw new Error('Horário indisponível')
```

Todos os erros ficam em `src/shared/errors/`.

---

## Gate de verificação obrigatório

```bash
npx tsc --noEmit              # zero erros de tipo na área modificada
npx vitest run src/domains/[dominio]  # testes do domínio passando
```

Se qualquer comando falhar → corrigir e re-executar antes de reportar conclusão.

---

## Checklist antes de entregar

- [ ] `tenantId` filtrado em TODAS as queries do repository
- [ ] `tenantId` extraído do token — nunca do body
- [ ] Service verifica existência antes de update/delete
- [ ] Evento publicado após create, update e delete
- [ ] API Route usa `getSessionContext()` antes de qualquer operação
- [ ] Input validado com Zod (schema em `domains/[dominio]/schemas.ts`)
- [ ] Erros tipados para todos os casos de falha
- [ ] Sem `any` no TypeScript
- [ ] Sem lógica de negócio na API Route
- [ ] Gate de verificação passou (tsc + vitest)
