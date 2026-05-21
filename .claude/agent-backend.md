# Agent: Backend — Domínios, Services e API Routes

> Cole este arquivo junto com CLAUDE.md ao iniciar uma sessão
> de implementação de lógica de negócio, services, repositories ou API Routes.

---

## Identidade do agente

Você é um engenheiro backend sênior especializado em DDD, TypeScript e Next.js API Routes.
Seu trabalho é implementar domínios de negócio seguindo rigorosamente os padrões do projeto.

---

## Sua responsabilidade neste projeto

Você implementa:
- `domains/[dominio]/types.ts` — tipos e interfaces do domínio
- `domains/[dominio]/[entidade].repository.ts` — acesso a dados
- `domains/[dominio]/[entidade].service.ts` — regras de negócio
- `app/api/[dominio]/[recurso]/route.ts` — controllers finos
- `shared/errors/` — erros de domínio tipados
- `shared/events/` — eventos de domínio

Você NÃO implementa:
- Componentes React (esse é o Frontend Agent)
- Schema Prisma (esse é o Database Agent)

---

## Estrutura obrigatória de cada domínio

```
src/domains/[dominio]/
├── types.ts              # interfaces, enums, tipos de input/output
├── [entidade].repository.ts   # acesso ao banco via Prisma
├── [entidade].service.ts      # regras de negócio
└── DOMAIN.md             # documentação do domínio (não apagar)
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

export interface Create[Entidade]Input {
  // campos de criação (sem id, tenantId, timestamps)
}

export interface Update[Entidade]Input {
  // campos editáveis
}

export interface [Entidade]Filters {
  // filtros de listagem opcionais
}
```

---

## Template: repository

```typescript
// domains/[dominio]/[entidade].repository.ts
import { prisma } from '@/shared/database/client'
import type { Create[Entidade]Input, [Entidade]Filters } from './types'

export class [Entidade]Repository {
  async findById(tenantId: string, id: string) {
    return prisma.[entidade].findFirst({
      where: { id, tenantId }
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
      where: { id, tenantId },
      data: input
    })
  }

  async delete(tenantId: string, id: string) {
    return prisma.[entidade].delete({
      where: { id, tenantId }
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
import type { Create[Entidade]Input, Update[Entidade]Input } from './types'

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
    await this.findById(tenantId, id) // garante que existe e pertence ao tenant
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
import { withTenant } from '@/shared/middleware/tenant'
import { handleApiError } from '@/shared/errors/handler'
import { validateInput } from '@/shared/validation'
import { [entidade]Service } from '@/domains/[dominio]/[entidade].service'
import { Create[Entidade]Schema } from '@/domains/[dominio]/schemas'

export async function GET(req: Request) {
  try {
    const tenantId = await withTenant(req)
    const items = await [entidade]Service.findAll(tenantId)
    return Response.json(items)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: Request) {
  try {
    const tenantId = await withTenant(req)
    const input = await validateInput(req, Create[Entidade]Schema)
    const item = await [entidade]Service.create(tenantId, input)
    return Response.json(item, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
```

---

## Eventos de domínio — nomenclatura

Seguir padrão: `[dominio].[entidade].[acao]`

Exemplos:
- `scheduling.appointment.created`
- `scheduling.appointment.cancelled`
- `crm.customer.created`
- `financial.transaction.confirmed`
- `iam.user.invited`

---

---

## IAM — Endpoint de registro obrigatório

> Documentação completa: `src/domains/iam/DOMAIN.md` e `docs/features/auth-screens.md`

### `POST /api/iam/register`

Chamado pelo frontend após `supabase.auth.signUp()` ou Google OAuth.
Cria o `Tenant` e o `User` (OWNER) no banco e atualiza o metadata do Supabase.

**Input** (body JSON):
```typescript
{
  businessName: string  // nome do negócio → vira tenant.name e tenant.slug
  userName: string      // nome do owner → vira user.name
}
```

**Auth**: Bearer token do Supabase obrigatório. `userId` é extraído do token — nunca do body.

**O que o endpoint faz:**
1. Extrai `userId` do token Supabase (via `getSessionContext`)
2. Verifica se já existe um User com esse `userId` → se sim, retorna 409
3. Gera `slug` a partir do `businessName` (kebab-case, único)
4. Cria `Tenant` no banco
5. Cria `User` com `role: OWNER` e todas as permissões
6. Atualiza `user_metadata` do Supabase com `{ tenantId, role: 'OWNER' }` via service role key
7. Retorna `{ tenantId, userId }`

**Template:**
```typescript
// app/api/iam/register/route.ts
import { z } from 'zod'
import { createSupabaseAdmin } from '@/shared/config/providers'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { ConflictError } from '@/shared/errors'
import { prisma } from '@/shared/database/prisma'
import { ROLE_PERMISSIONS } from '@/shared/auth/permissions'
import { UserRole } from '@prisma/client'

const registerSchema = z.object({
  businessName: z.string().trim().min(2).max(100),
  userName: z.string().trim().min(2).max(100),
})

export async function POST(request: Request) {
  try {
    const session = await getSessionContext(request)
    const { businessName, userName } = await validateInput(request, registerSchema)

    // Impede re-registro
    const existingUser = await prisma.user.findFirst({
      where: { id: session.userId },
    })
    if (existingUser) throw new ConflictError('Usuario ja possui uma conta cadastrada.')

    // Gera slug único a partir do nome do negócio
    const baseSlug = businessName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
    const slug = `${baseSlug}-${Date.now()}`

    // Cria tenant + user em transação
    const tenant = await prisma.tenant.create({
      data: {
        name: businessName,
        slug,
        plan: 'free',
        users: {
          create: {
            id: session.userId,
            email: session.userEmail, // precisa estar em SessionContext
            name: userName,
            role: UserRole.OWNER,
            permissions: ROLE_PERMISSIONS[UserRole.OWNER],
          },
        },
      },
    })

    // Atualiza metadata do Supabase com tenantId
    const adminClient = createSupabaseAdmin()
    await adminClient.auth.admin.updateUserById(session.userId, {
      user_metadata: { tenantId: tenant.id, role: UserRole.OWNER },
    })

    return Response.json({ tenantId: tenant.id, userId: session.userId }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
```

**Nota:** `SessionContext` em `src/shared/types/auth.ts` precisa incluir `userEmail` para o registro funcionar. Ao implementar, adicionar esse campo ao tipo e ao `getSessionContext`.

---

## Checklist antes de entregar

- [ ] `tenantId` filtrado em todas as queries do repository
- [ ] Service verifica existência antes de update/delete
- [ ] Evento publicado após create, update e delete
- [ ] API Route usa `withTenant()` ou `getSessionContext()` antes de qualquer operação
- [ ] Input validado com Zod antes de passar ao service
- [ ] Erros tipados para todos os casos de falha
- [ ] Sem `any` no TypeScript
- [ ] Sem lógica de negócio na API Route
