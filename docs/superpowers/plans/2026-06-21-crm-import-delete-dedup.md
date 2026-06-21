# CRM — Importar Contatos, Soft Delete e Deduplicação Pública

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar soft delete de clientes com restauração, importação de contatos via Contact Picker API (Android) e vCard (iOS), e deduplicação por CPF ou telefone no cadastro público.

**Architecture:** Soft delete via campo `deletedAt` no schema Prisma com filtros adicionados em todos os métodos do repository. Import usa dois novos endpoints REST (preview + bulk create) e um modal com máquina de estados que detecta suporte a Contact Picker em runtime. Dedup público atualiza cliente existente ao invés de criar duplicata.

**Tech Stack:** Next.js 15 App Router, Prisma, TypeScript strict, TanStack Query, Shadcn UI, Vitest + vitest-mock-extended, Zod

## Global Constraints

- Todo output em Português do Brasil (variáveis, comentários e strings de UI)
- Strict TypeScript — sem `any`, sem `as unknown as`
- Todo repository method filtra `tenantId` em todas as queries
- Erros tipados de `src/shared/errors/domain-error.ts` — nunca `throw new Error('string')`
- Zod para validação de input em toda API Route
- `tenantId` sempre extraído de `getSessionContext(request)` — nunca do body
- Commits frequentes após cada task
- Branch: `feat/crm-import-delete-dedup`

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---------|------|-----------------|
| `prisma/schema.prisma` | Modificar | Adicionar `deletedAt DateTime?` + índice ao Customer |
| `src/shared/auth/permissions.ts` | Modificar | Adicionar `customers.delete` |
| `src/shared/test/factories/customer.factory.ts` | Modificar | Adicionar `deletedAt: null` |
| `src/domains/crm/customer.repository.ts` | Modificar | Filtros `deletedAt`, `softDelete`, `restore`, `findDeletedById` |
| `src/domains/crm/customer.repository.soft-delete.test.ts` | Criar | Testes de soft delete do repository |
| `src/domains/crm/customer.service.ts` | Modificar | Métodos `delete` e `restore` |
| `src/domains/crm/customer.service.delete.test.ts` | Criar | Testes de delete/restore do service |
| `src/app/api/crm/customers/[customerId]/route.ts` | Modificar | Adicionar `DELETE` handler |
| `src/app/api/crm/customers/[customerId]/restore/route.ts` | Criar | `POST` para restaurar |
| `src/app/api/crm/customers/import/preview/route.ts` | Criar | `POST` preview de importação |
| `src/app/api/crm/customers/import/route.ts` | Criar | `POST` bulk import |
| `src/hooks/crm/use-customers.ts` | Modificar | `useDeleteCustomer`, `useRestoreCustomer` |
| `src/hooks/crm/use-import-contacts.ts` | Criar | Hook de importação (Contact Picker + vCard + API) |
| `src/components/domain/crm/customer-card.tsx` | Modificar | Menu de ações com arquivar |
| `src/app/(app)/clientes/[id]/page.tsx` | Modificar | Banner de arquivado + botão Restaurar |
| `src/components/domain/crm/import-contacts-modal.tsx` | Criar | Modal com máquina de estados |
| `src/components/domain/crm/import-contacts-button.tsx` | Criar | Botão com detecção de suporte |
| `src/components/domain/crm/customer-list.tsx` | Modificar | Integrar botão de importação |
| `src/app/api/public/[slug]/customers/route.ts` | Modificar | Dedup por CPF ou telefone + upsert |

---

## Task 1: Schema, permissões e factory

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/shared/auth/permissions.ts`
- Modify: `src/shared/test/factories/customer.factory.ts`

**Interfaces:**
- Produces: tipo `Customer` do Prisma com campo `deletedAt: Date | null`; permissão `PERMISSIONS.customers.delete = 'customers:delete'`

- [ ] **Step 1: Criar branch**

```bash
git checkout -b feat/crm-import-delete-dedup
```

- [ ] **Step 2: Adicionar `deletedAt` ao model Customer no schema**

No arquivo `prisma/schema.prisma`, encontre o model `Customer` e adicione **após** o campo `blockedAt`:

```prisma
deletedAt     DateTime?
```

E adicione o índice **dentro** do bloco do model, junto aos demais `@@index`:

```prisma
@@index([tenantId, deletedAt])
```

O bloco de índices do Customer deve ficar:

```prisma
@@index([tenantId])
@@index([tenantId, phone])
@@index([tenantId, birthDate])
@@index([tenantId, cpf])
@@index([tenantId, deletedAt])
```

- [ ] **Step 3: Rodar migration**

```bash
npx prisma migrate dev --name add-customer-soft-delete
```

Saída esperada: `Your database is now in sync with your schema.`

Depois rodar para regenerar o cliente Prisma:

```bash
npx prisma generate
```

- [ ] **Step 4: Adicionar permissão `customers.delete` em `src/shared/auth/permissions.ts`**

No objeto `PERMISSIONS.customers`, adicionar:

```ts
export const PERMISSIONS = {
  // ...
  customers: {
    view:   'customers:view',
    create: 'customers:create',
    edit:   'customers:edit',
    delete: 'customers:delete',   // ← adicionar
  },
  // ...
} as const
```

No `ROLE_PERMISSIONS`, adicionar `PERMISSIONS.customers.delete` para `OWNER` (já incluso via `flatMap`) e `MANAGER`:

```ts
[UserRole.MANAGER]: [
  PERMISSIONS.appointments.view, PERMISSIONS.appointments.create, PERMISSIONS.appointments.edit,
  PERMISSIONS.customers.view, PERMISSIONS.customers.create, PERMISSIONS.customers.edit,
  PERMISSIONS.customers.delete,  // ← adicionar
  PERMISSIONS.financial.view, PERMISSIONS.services.view, PERMISSIONS.services.manage,
  PERMISSIONS.users.view, PERMISSIONS.settings.view, PERMISSIONS.settings.manage,
],
```

No `LEGACY_PERMISSION_MAP`, adicionar:

```ts
'customers:delete': [{ key: 'clientes', action: 'delete' }],
```

- [ ] **Step 5: Atualizar factory `makeCustomer`**

Em `src/shared/test/factories/customer.factory.ts`, adicionar os campos que o Prisma agora exige. O arquivo completo deve ficar:

```ts
import type { Customer } from '@prisma/client'

export function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'customer-test-id',
    tenantId: 'tenant-test-id',
    name: 'Cliente Teste',
    phone: '11999999999',
    email: 'cliente@test.com',
    notes: null,
    tags: [],
    consentGiven: false,
    consentDate: null,
    consentOrigin: null,
    birthDate: null,
    cpf: null,
    isVip: false,
    vipUpdatedAt: null,
    isBlocked: false,
    blockedReason: null,
    blockedAt: null,
    deletedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}
```

- [ ] **Step 6: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Saída esperada: zero erros.

- [ ] **Step 7: Commit**

```bash
git add prisma/ src/shared/auth/permissions.ts src/shared/test/factories/customer.factory.ts
git commit -m "feat(crm): adiciona deletedAt ao Customer e permissão customers.delete"
```

---

## Task 2: Repository — soft delete + filtros `deletedAt`

**Files:**
- Modify: `src/domains/crm/customer.repository.ts`
- Create: `src/domains/crm/customer.repository.soft-delete.test.ts`

**Interfaces:**
- Consumes: `Customer` com `deletedAt: Date | null` (Task 1)
- Produces:
  - `customerRepository.softDelete(tenantId: string, customerId: string): Promise<Customer>`
  - `customerRepository.restore(tenantId: string, customerId: string): Promise<Customer>`
  - `customerRepository.findDeletedById(tenantId: string, customerId: string): Promise<Customer | null>`
  - `customerRepository.findByPhones(tenantId, phones)` — já existe, sem mudança de assinatura
  - Todos os `findAll`, `findById`, `findByPhone`, `findByPhones`, `findWithAppointments`, `findByIdWithStats`, `findOrCreateByPhone` passam a filtrar `deletedAt: null`

- [ ] **Step 1: Escrever testes de soft delete**

Criar `src/domains/crm/customer.repository.soft-delete.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from '@/shared/test/prisma-mock'
import { makeCustomer } from '@/shared/test/factories/customer.factory'
import { CustomerRepository } from './customer.repository'

const TENANT_ID = 'tenant-1'
const CUSTOMER_ID = 'customer-1'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CustomerRepository — soft delete', () => {
  it('findAll filtra deletedAt: null', async () => {
    prismaMock.customer.findMany.mockResolvedValue([])
    prismaMock.customer.count.mockResolvedValue(0)

    const repo = new CustomerRepository()
    await repo.findAll(TENANT_ID)

    expect(prismaMock.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    )
  })

  it('findById filtra deletedAt: null', async () => {
    prismaMock.customer.findFirst.mockResolvedValue(null)

    const repo = new CustomerRepository()
    await repo.findById(TENANT_ID, CUSTOMER_ID)

    expect(prismaMock.customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    )
  })

  it('findByPhone filtra deletedAt: null', async () => {
    prismaMock.customer.findFirst.mockResolvedValue(null)

    const repo = new CustomerRepository()
    await repo.findByPhone(TENANT_ID, '11999999999')

    expect(prismaMock.customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    )
  })

  it('softDelete: chama update com deletedAt preenchido', async () => {
    const archived = makeCustomer({ id: CUSTOMER_ID, deletedAt: new Date() })
    prismaMock.customer.update.mockResolvedValue(archived)

    const repo = new CustomerRepository()
    await repo.softDelete(TENANT_ID, CUSTOMER_ID)

    expect(prismaMock.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CUSTOMER_ID, tenantId: TENANT_ID },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    )
  })

  it('restore: chama update com deletedAt: null', async () => {
    const restored = makeCustomer({ id: CUSTOMER_ID, deletedAt: null })
    prismaMock.customer.update.mockResolvedValue(restored)

    const repo = new CustomerRepository()
    await repo.restore(TENANT_ID, CUSTOMER_ID)

    expect(prismaMock.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CUSTOMER_ID, tenantId: TENANT_ID },
        data: { deletedAt: null },
      }),
    )
  })

  it('findDeletedById: busca sem filtro de deletedAt', async () => {
    const archived = makeCustomer({ id: CUSTOMER_ID, deletedAt: new Date() })
    prismaMock.customer.findFirst.mockResolvedValue(archived)

    const repo = new CustomerRepository()
    const result = await repo.findDeletedById(TENANT_ID, CUSTOMER_ID)

    expect(result).toEqual(archived)
    expect(prismaMock.customer.findFirst).toHaveBeenCalledWith({
      where: { id: CUSTOMER_ID, tenantId: TENANT_ID },
    })
  })
})
```

- [ ] **Step 2: Rodar testes para verificar que falham**

```bash
npx vitest run src/domains/crm/customer.repository.soft-delete.test.ts
```

Saída esperada: FAIL — `softDelete is not a function` e filtros sem `deletedAt: null`.

- [ ] **Step 3: Implementar alterações no repository**

Em `src/domains/crm/customer.repository.ts`, substituir o arquivo inteiro pelo conteúdo abaixo (mantendo os métodos existentes, adicionando `deletedAt: null` e os três novos métodos):

```ts
import type { Customer, Prisma } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";

export type CustomerFilters = {
  search?: string;
  page?: number;
  pageSize?: number;
  onlyVip?: boolean;
  birthdayMonth?: number;
  noAppointmentDays?: number;
  minAvgTicket?: number;
  hasPendingDebt?: boolean;
};

export class CustomerRepository {
  async findAll(tenantId: string, filters: CustomerFilters = {}) {
    const {
      search,
      page = 1,
      pageSize = 20,
      onlyVip,
      birthdayMonth,
      noAppointmentDays,
      minAvgTicket,
      hasPendingDebt,
    } = filters;
    const skip = (page - 1) * pageSize;

    const rawSets: string[][] = [];

    if (birthdayMonth != null) {
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Customer"
        WHERE "tenantId" = ${tenantId}
        AND "deletedAt" IS NULL
        AND "birthDate" IS NOT NULL
        AND EXTRACT(MONTH FROM "birthDate") = ${birthdayMonth}
      `;
      rawSets.push(rows.map((r) => r.id));
    }

    if (noAppointmentDays != null) {
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT c.id FROM "Customer" c
        WHERE c."tenantId" = ${tenantId}
        AND c."deletedAt" IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM "Appointment" a
          WHERE a."customerId" = c.id
          AND a."tenantId" = ${tenantId}
          AND a.status = 'COMPLETED'::"AppointmentStatus"
          AND a."startsAt" >= NOW() - (${noAppointmentDays}::integer * INTERVAL '1 day')
        )
      `;
      rawSets.push(rows.map((r) => r.id));
    }

    if (minAvgTicket != null) {
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT a."customerId" AS id
        FROM "Transaction" t
        JOIN "Appointment" a ON a.id = t."appointmentId"
        WHERE t."tenantId" = ${tenantId}
        AND a."tenantId" = ${tenantId}
        AND t.type = 'INCOME'::"TransactionType"
        AND t."paidAt" >= NOW() - INTERVAL '365 days'
        AND a."customerId" IS NOT NULL
        GROUP BY a."customerId"
        HAVING AVG(t.amount) >= ${minAvgTicket}
      `;
      rawSets.push(rows.map((r) => r.id));
    }

    if (hasPendingDebt) {
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT DISTINCT a."customerId" AS id
        FROM "Appointment" a
        WHERE a."tenantId" = ${tenantId}
        AND a."paymentStatus" IN (
          'PENDING'::"AppointmentPaymentStatus",
          'DEBT'::"AppointmentPaymentStatus"
        )
      `;
      rawSets.push(rows.map((r) => r.id));
    }

    let complexIds: string[] | null = null;
    if (rawSets.length > 0) {
      const [first, ...rest] = rawSets;
      complexIds = rest.reduce((acc, set) => {
        const s = new Set(set);
        return acc.filter((id) => s.has(id));
      }, first);
    }

    const where: Prisma.CustomerWhereInput = {
      tenantId,
      deletedAt: null,
      ...(complexIds !== null && { id: { in: complexIds } }),
      ...(onlyVip && { isVip: true }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { phone: { contains: search } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.customer.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async findById(tenantId: string, customerId: string) {
    return prisma.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null },
    });
  }

  async findDeletedById(tenantId: string, customerId: string) {
    return prisma.customer.findFirst({
      where: { id: customerId, tenantId },
    });
  }

  async findByPhone(tenantId: string, phone: string) {
    return prisma.customer.findFirst({
      where: { tenantId, phone, deletedAt: null },
    });
  }

  async findByPhones(tenantId: string, phones: string[]): Promise<Customer[]> {
    if (phones.length === 0) return [];
    return prisma.customer.findMany({
      where: { tenantId, phone: { in: phones }, deletedAt: null },
    });
  }

  async create(
    tenantId: string,
    data: Omit<Prisma.CustomerUncheckedCreateInput, "tenantId">,
  ): Promise<Customer> {
    return prisma.customer.create({
      data: { ...data, tenantId },
    });
  }

  async update(
    tenantId: string,
    customerId: string,
    data: Prisma.CustomerUpdateInput,
  ) {
    await prisma.customer.updateMany({
      where: { id: customerId, tenantId, deletedAt: null },
      data,
    });
    return prisma.customer.findFirstOrThrow({
      where: { id: customerId, tenantId },
    });
  }

  async softDelete(tenantId: string, customerId: string): Promise<Customer> {
    return prisma.customer.update({
      where: { id: customerId, tenantId },
      data: { deletedAt: new Date() },
    });
  }

  async restore(tenantId: string, customerId: string): Promise<Customer> {
    return prisma.customer.update({
      where: { id: customerId, tenantId },
      data: { deletedAt: null },
    });
  }

  async findWithAppointments(tenantId: string, customerId: string) {
    return prisma.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null },
      include: {
        appointments: {
          include: {
            service: { select: { id: true, name: true } },
            professional: { select: { id: true, name: true } },
          },
          orderBy: { startsAt: "desc" },
          take: 50,
        },
      },
    });
  }

  async findByIdWithStats(tenantId: string, customerId: string) {
    return prisma.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null },
      include: {
        appointments: {
          include: {
            service: { select: { id: true, name: true } },
            professional: { select: { id: true, name: true } },
          },
          orderBy: { startsAt: "desc" },
          take: 50,
        },
        _count: {
          select: {
            appointments: { where: { status: "NO_SHOW" } },
          },
        },
      },
    });
  }

  async findOrCreateByPhone(tenantId: string, phone: string, name: string) {
    const existing = await prisma.customer.findFirst({
      where: { tenantId, phone, deletedAt: null },
    });
    if (existing) {
      if (existing.name === 'Cliente' && name !== 'Cliente') {
        return prisma.customer.update({
          where: { id: existing.id },
          data: { name },
        });
      }
      return existing;
    }
    return prisma.customer.create({
      data: { tenantId, phone, name },
    });
  }

  async block(tenantId: string, customerId: string, reason?: string) {
    return prisma.customer.update({
      where: { id: customerId, tenantId },
      data: {
        isBlocked: true,
        blockedReason: reason ?? null,
        blockedAt: new Date(),
      },
    });
  }

  async unblock(tenantId: string, customerId: string) {
    return prisma.customer.update({
      where: { id: customerId, tenantId },
      data: {
        isBlocked: false,
        blockedReason: null,
        blockedAt: null,
      },
    });
  }
}

export const customerRepository = new CustomerRepository();
```

- [ ] **Step 4: Rodar testes para verificar que passam**

```bash
npx vitest run src/domains/crm/customer.repository.soft-delete.test.ts
```

Saída esperada: 5 testes passando.

- [ ] **Step 5: Rodar testes existentes para verificar regressões**

```bash
npx vitest run src/domains/crm/customer.repository.filters.test.ts
```

Saída esperada: todos passando.

- [ ] **Step 6: Commit**

```bash
git add src/domains/crm/
git commit -m "feat(crm): soft delete no CustomerRepository — filtros deletedAt e métodos softDelete/restore"
```

---

## Task 3: Service + API routes de delete/restore

**Files:**
- Modify: `src/domains/crm/customer.service.ts`
- Create: `src/domains/crm/customer.service.delete.test.ts`
- Modify: `src/app/api/crm/customers/[customerId]/route.ts`
- Create: `src/app/api/crm/customers/[customerId]/restore/route.ts`

**Interfaces:**
- Consumes: `customerRepository.softDelete`, `customerRepository.restore`, `customerRepository.findDeletedById` (Task 2); `PERMISSIONS.customers.delete` (Task 1)
- Produces:
  - `customerService.delete(tenantId: string, customerId: string): Promise<void>`
  - `customerService.restore(tenantId: string, customerId: string): Promise<Customer>`
  - `DELETE /api/crm/customers/[customerId]` → 204 No Content
  - `POST /api/crm/customers/[customerId]/restore` → 200 `Customer`

- [ ] **Step 1: Escrever testes do service**

Criar `src/domains/crm/customer.service.delete.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from '@/shared/test/prisma-mock'
import { makeCustomer } from '@/shared/test/factories/customer.factory'
import { CustomerService } from './customer.service'
import { CustomerNotFoundError } from '@/shared/errors'

const TENANT_ID = 'tenant-1'
const CUSTOMER_ID = 'customer-1'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CustomerService.delete', () => {
  it('lança CustomerNotFoundError se cliente não existe', async () => {
    prismaMock.customer.findFirst.mockResolvedValue(null)

    const service = new CustomerService()
    await expect(service.delete(TENANT_ID, CUSTOMER_ID)).rejects.toThrow(
      CustomerNotFoundError,
    )
  })

  it('arquiva cliente ativo com softDelete', async () => {
    const customer = makeCustomer({ id: CUSTOMER_ID, tenantId: TENANT_ID })
    prismaMock.customer.findFirst.mockResolvedValue(customer)
    prismaMock.customer.update.mockResolvedValue({
      ...customer,
      deletedAt: new Date(),
    })

    const service = new CustomerService()
    await service.delete(TENANT_ID, CUSTOMER_ID)

    expect(prismaMock.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    )
  })
})

describe('CustomerService.restore', () => {
  it('lança CustomerNotFoundError se cliente não existe nem arquivado', async () => {
    prismaMock.customer.findFirst.mockResolvedValue(null)

    const service = new CustomerService()
    await expect(service.restore(TENANT_ID, CUSTOMER_ID)).rejects.toThrow(
      CustomerNotFoundError,
    )
  })

  it('restaura cliente arquivado', async () => {
    const archived = makeCustomer({
      id: CUSTOMER_ID,
      tenantId: TENANT_ID,
      deletedAt: new Date(),
    })
    prismaMock.customer.findFirst.mockResolvedValue(archived)
    prismaMock.customer.update.mockResolvedValue({ ...archived, deletedAt: null })

    const service = new CustomerService()
    await service.restore(TENANT_ID, CUSTOMER_ID)

    expect(prismaMock.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { deletedAt: null },
      }),
    )
  })
})
```

- [ ] **Step 2: Rodar testes para verificar que falham**

```bash
npx vitest run src/domains/crm/customer.service.delete.test.ts
```

Saída esperada: FAIL — `service.delete is not a function`.

- [ ] **Step 3: Adicionar métodos `delete` e `restore` ao CustomerService**

Em `src/domains/crm/customer.service.ts`, adicionar após o método `getProfile`:

```ts
async delete(tenantId: string, customerId: string): Promise<void> {
  const customer = await customerRepository.findById(tenantId, customerId);
  if (!customer) {
    throw new CustomerNotFoundError();
  }
  await customerRepository.softDelete(tenantId, customerId);
  eventBus.publish({
    type: "crm.customer.deleted",
    payload: { tenantId, customerId },
  });
}

async restore(tenantId: string, customerId: string): Promise<Customer> {
  const customer = await customerRepository.findDeletedById(tenantId, customerId);
  if (!customer) {
    throw new CustomerNotFoundError();
  }
  const restored = await customerRepository.restore(tenantId, customerId);
  eventBus.publish({
    type: "crm.customer.restored",
    payload: { tenantId, customer: restored },
  });
  return restored;
}
```

O import de `Customer` de `@prisma/client` já existe no arquivo. Verificar que está importado no topo.

- [ ] **Step 4: Rodar testes do service**

```bash
npx vitest run src/domains/crm/customer.service.delete.test.ts
```

Saída esperada: 4 testes passando.

- [ ] **Step 5: Adicionar `DELETE` handler em `src/app/api/crm/customers/[customerId]/route.ts`**

Adicionar ao final do arquivo existente (manter `GET` e `PATCH` intactos):

```ts
export async function DELETE(request: Request, context: RouteContext) {
  initializeDomainRuntime();

  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.customers.delete);
    const { customerId } = await context.params;
    await customerService.delete(session.tenantId, customerId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 6: Criar `src/app/api/crm/customers/[customerId]/restore/route.ts`**

```ts
import { customerService } from "@/domains/crm/customer.service";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";

type RouteContext = {
  params: Promise<{ customerId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  initializeDomainRuntime();

  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.customers.edit);
    const { customerId } = await context.params;
    const customer = await customerService.restore(session.tenantId, customerId);
    return Response.json(customer);
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 7: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Saída esperada: zero erros.

- [ ] **Step 8: Commit**

```bash
git add src/domains/crm/ src/app/api/crm/customers/
git commit -m "feat(crm): service e endpoints de DELETE e restore de clientes"
```

---

## Task 4: UI — arquivar no CustomerCard e restaurar no perfil

**Files:**
- Modify: `src/hooks/crm/use-customers.ts`
- Modify: `src/components/domain/crm/customer-card.tsx`
- Modify: `src/app/(app)/clientes/[id]/page.tsx`

**Interfaces:**
- Consumes: `DELETE /api/crm/customers/[id]` (Task 3); `POST /api/crm/customers/[id]/restore` (Task 3)
- Produces:
  - `useDeleteCustomer()` → mutation que chama `DELETE /api/crm/customers/:id` e invalida `['customers']`
  - `useRestoreCustomer()` → mutation que chama `POST /api/crm/customers/:id/restore` e invalida `['customer', id]`
  - `customer.deletedAt` exposto no tipo `Customer` do hook

- [ ] **Step 1: Adicionar `deletedAt` ao tipo `Customer` e mutations no hook**

Em `src/hooks/crm/use-customers.ts`, modificar o tipo `Customer` para incluir `deletedAt`:

```ts
export type Customer = {
  id: string
  name: string
  phone: string | null
  email: string | null
  notes: string | null
  tags: string[]
  isVip: boolean
  vipUpdatedAt: string | null
  birthDate: string | null
  isBlocked: boolean
  blockedReason: string | null
  blockedAt: string | null
  deletedAt: string | null   // ← adicionar
  createdAt: string
  updatedAt: string
}
```

Adicionar as duas funções e hooks ao final do arquivo (antes do fechamento do módulo):

```ts
async function deleteCustomer(id: string): Promise<void> {
  const res = await fetch(`/api/crm/customers/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      (err as { error?: { message?: string } }).error?.message ?? 'Falha ao arquivar cliente',
    )
  }
}

async function restoreCustomer(id: string): Promise<Customer> {
  const res = await fetch(`/api/crm/customers/${id}/restore`, { method: 'POST' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      (err as { error?: { message?: string } }).error?.message ?? 'Falha ao restaurar cliente',
    )
  }
  return res.json()
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}

export function useRestoreCustomer(customerId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => restoreCustomer(customerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}
```

- [ ] **Step 2: Adicionar menu de ações com "Arquivar" no CustomerCard**

Substituir `src/components/domain/crm/customer-card.tsx` pelo conteúdo abaixo. O card agora envolve apenas o conteúdo de informações em um `Link`, enquanto o menu de ações fica separado para não conflitar com o clique:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Phone, Mail, Tag, Crown, MoreHorizontal, Archive } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useDeleteCustomer } from '@/hooks/crm/use-customers'
import { usePermissions } from '@/hooks/use-permissions'
import type { Customer } from '@/hooks/crm/use-customers'

type Props = {
  customer: Customer
}

export function CustomerCard({ customer }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { can } = usePermissions()
  const deleteCustomer = useDeleteCustomer()

  function handleArchive() {
    deleteCustomer.mutate(customer.id, {
      onSuccess: () => toast.success(`${customer.name} arquivado`),
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : 'Erro ao arquivar'),
    })
  }

  return (
    <>
      <div className="relative flex items-stretch rounded-2xl border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-sm">
        <Link
          href={`/clientes/${customer.id}`}
          className="flex min-w-0 flex-1 items-start gap-3 p-4"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
            {customer.name.slice(0, 2).toUpperCase()}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-slate-950">
                {customer.name}
              </p>
              {customer.isVip && (
                <Badge className="shrink-0 gap-1 rounded-full bg-amber-100 px-1.5 py-0 text-[10px] text-amber-700 border border-amber-200">
                  <Crown className="size-2.5" />
                  VIP
                </Badge>
              )}
            </div>

            <div className="mt-1 flex flex-col gap-0.5">
              {customer.phone && (
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Phone className="size-3" />
                  {customer.phone}
                </span>
              )}
              {customer.email && (
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Mail className="size-3" />
                  {customer.email}
                </span>
              )}
            </div>

            {customer.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {customer.tags.map((tag) => (
                  <Badge
                    key={tag}
                    className="flex items-center gap-0.5 rounded-full bg-slate-100 px-2 py-0 text-[10px] text-slate-600"
                  >
                    <Tag className="size-2.5" />
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </Link>

        {can('clientes', 'delete') && (
          <div className="flex items-center pr-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-slate-400 hover:text-slate-700"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">Opções</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-700"
                  onSelect={() => setConfirmOpen(true)}
                >
                  <Archive className="mr-2 size-4" />
                  Arquivar cliente
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{customer.name}</strong> será removido da lista. O histórico de
              agendamentos e dados serão preservados e podem ser restaurados pelo perfil do cliente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteCustomer.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              disabled={deleteCustomer.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteCustomer.isPending ? 'Arquivando...' : 'Arquivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

- [ ] **Step 3: Adicionar banner de arquivado e botão Restaurar em `/clientes/[id]/page.tsx`**

No arquivo `src/app/(app)/clientes/[id]/page.tsx`:

1. Adicionar import no topo:
```ts
import { ArchiveRestore } from 'lucide-react'
import { useRestoreCustomer } from '@/hooks/crm/use-customers'
```

2. Dentro do componente `CustomerProfilePage`, adicionar o hook após `useBlockCustomer`:
```ts
const { mutate: restore, isPending: isRestoring } = useRestoreCustomer(id)
```

3. Adicionar handler:
```ts
function handleRestore() {
  restore(undefined, {
    onSuccess: () => toast.success('Cliente restaurado'),
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Erro ao restaurar'),
  })
}
```

4. Adicionar banner de arquivado logo após `<CustomerProfileHeader customer={customer} />` e **antes** do banner de bloqueio:

```tsx
{customer.deletedAt && (
  <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
    <Archive className="mt-0.5 size-5 shrink-0 text-amber-500" />
    <div className="flex-1 space-y-1">
      <p className="text-sm font-medium text-amber-800">Cliente arquivado</p>
      <p className="text-xs text-amber-600">
        Este cliente não aparece na lista. Restaure para reativá-lo.
      </p>
    </div>
    <Button
      variant="outline"
      size="sm"
      onClick={handleRestore}
      disabled={isRestoring}
      className="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100"
    >
      <ArchiveRestore className="mr-1.5 size-4" />
      {isRestoring ? 'Restaurando...' : 'Restaurar'}
    </Button>
  </div>
)}
```

Lembrar de adicionar `Archive` à lista de imports do lucide-react no topo do arquivo.

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Saída esperada: zero erros.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/crm/use-customers.ts src/components/domain/crm/customer-card.tsx src/app/\(app\)/clientes/
git commit -m "feat(crm): UI de arquivar cliente no card e restaurar no perfil"
```

---

## Task 5: API routes de importação (preview + bulk create)

**Files:**
- Create: `src/app/api/crm/customers/import/preview/route.ts`
- Create: `src/app/api/crm/customers/import/route.ts`

**Interfaces:**
- Consumes: `customerRepository.findByPhones` (Task 2)
- Produces:
  - `POST /api/crm/customers/import/preview` — body: `{ phones: string[] }` → `{ existing: string[] }`
  - `POST /api/crm/customers/import` — body: `{ contacts: Array<{ name: string; phone: string }> }` → `{ created: number; skipped: number }`

- [ ] **Step 1: Criar `src/app/api/crm/customers/import/preview/route.ts`**

```ts
import { z } from "zod";
import { customerRepository } from "@/domains/crm/customer.repository";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";

const previewSchema = z.object({
  phones: z.array(z.string().min(1)).max(500),
});

export async function POST(request: Request) {
  initializeDomainRuntime();

  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.customers.view);

    const { phones } = await validateInput(request, previewSchema);
    const existing = await customerRepository.findByPhones(session.tenantId, phones);
    const existingPhones = existing
      .map((c) => c.phone)
      .filter((p): p is string => p !== null);

    return Response.json({ existing: existingPhones });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 2: Criar `src/app/api/crm/customers/import/route.ts`**

```ts
import { z } from "zod";
import { customerRepository } from "@/domains/crm/customer.repository";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";

const importSchema = z.object({
  contacts: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        phone: z.string().trim().min(8).max(30),
      }),
    )
    .min(1)
    .max(500),
});

export async function POST(request: Request) {
  initializeDomainRuntime();

  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.customers.create);

    const { contacts } = await validateInput(request, importSchema);

    const phones = contacts.map((c) => c.phone);
    const existing = await customerRepository.findByPhones(session.tenantId, phones);
    const existingPhoneSet = new Set(existing.map((c) => c.phone).filter(Boolean));

    let created = 0;
    let skipped = 0;

    for (const contact of contacts) {
      if (existingPhoneSet.has(contact.phone)) {
        skipped++;
        continue;
      }
      await customerRepository.create(session.tenantId, {
        name: contact.name,
        phone: contact.phone,
      });
      created++;
    }

    return Response.json({ created, skipped });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Saída esperada: zero erros.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/crm/customers/import/
git commit -m "feat(crm): endpoints de preview e bulk import de contatos"
```

---

## Task 6: Hook + modal + botão de importação

**Files:**
- Create: `src/hooks/crm/use-import-contacts.ts`
- Create: `src/components/domain/crm/import-contacts-modal.tsx`
- Create: `src/components/domain/crm/import-contacts-button.tsx`
- Modify: `src/components/domain/crm/customer-list.tsx`

**Interfaces:**
- Consumes: `POST /api/crm/customers/import/preview` e `POST /api/crm/customers/import` (Task 5)
- Produces: botão "Importar contatos" integrado à barra de ações do `CustomerList`

- [ ] **Step 1: Criar `src/hooks/crm/use-import-contacts.ts`**

```ts
'use client'

import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

export type ContactItem = {
  name: string
  phone: string
  selected: boolean
  alreadyExists: boolean
}

export type ImportStep =
  | 'idle'
  | 'loading'
  | 'preview'
  | 'importing'
  | 'done'
  | 'error'

export type ImportResult = { created: number; skipped: number }

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '')
}

export function parseVCard(content: string): Array<{ name: string; phone: string }> {
  const blocks = content.split(/BEGIN:VCARD/i).slice(1)
  const contacts: Array<{ name: string; phone: string }> = []

  for (const block of blocks) {
    const fnMatch = block.match(/^FN:(.+)$/m)
    const telMatches = [...block.matchAll(/^TEL[^:]*:(.+)$/gm)]

    const name = fnMatch?.[1]?.trim()
    const rawPhone = telMatches[0]?.[1]?.trim()
    const phone = rawPhone ? normalizePhone(rawPhone) : undefined

    if (name && phone && phone.length >= 8) {
      contacts.push({ name, phone })
    }
  }

  return contacts
}

export function supportsContactPicker(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'contacts' in navigator &&
    'ContactsManager' in window
  )
}

export function useImportContacts() {
  const queryClient = useQueryClient()
  const [step, setStep] = useState<ImportStep>('idle')
  const [contacts, setContacts] = useState<ContactItem[]>([])
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setStep('idle')
    setContacts([])
    setResult(null)
    setError(null)
  }, [])

  const applyPreview = useCallback(
    async (raw: Array<{ name: string; phone: string }>) => {
      setStep('loading')

      try {
        const phones = raw.map((c) => c.phone)
        const res = await fetch('/api/crm/customers/import/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phones }),
        })
        if (!res.ok) throw new Error('Falha ao verificar contatos existentes')

        const { existing } = (await res.json()) as { existing: string[] }
        const existingSet = new Set(existing)

        setContacts(
          raw.map((c) => ({
            name: c.name,
            phone: c.phone,
            selected: !existingSet.has(c.phone),
            alreadyExists: existingSet.has(c.phone),
          })),
        )
        setStep('preview')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido')
        setStep('error')
      }
    },
    [],
  )

  const pickFromDevice = useCallback(async () => {
    setStep('loading')
    try {
      // A ContactsManager API não tem typings nativos no TypeScript
      const mgr = (navigator as unknown as { contacts: {
        select: (props: string[], opts: { multiple: boolean }) => Promise<Array<{ name: string[]; tel: string[] }>>
      } }).contacts

      const selected = await mgr.select(['name', 'tel'], { multiple: true })

      const raw: Array<{ name: string; phone: string }> = []
      for (const entry of selected) {
        const name = entry.name[0]?.trim()
        const phone = normalizePhone(entry.tel[0] ?? '')
        if (name && phone.length >= 8) {
          raw.push({ name, phone })
        }
      }

      if (raw.length === 0) {
        setStep('idle')
        return
      }

      await applyPreview(raw)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Acesso aos contatos negado')
      setStep('error')
    }
  }, [applyPreview])

  const pickFromVCard = useCallback(
    async (file: File) => {
      setStep('loading')
      try {
        const text = await file.text()
        const raw = parseVCard(text)

        if (raw.length === 0) {
          setError('Nenhum contato com telefone encontrado no arquivo')
          setStep('error')
          return
        }

        await applyPreview(raw)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao ler arquivo')
        setStep('error')
      }
    },
    [applyPreview],
  )

  const toggleContact = useCallback((phone: string) => {
    setContacts((prev) =>
      prev.map((c) =>
        c.phone === phone ? { ...c, selected: !c.selected } : c,
      ),
    )
  }, [])

  const toggleAll = useCallback((selected: boolean) => {
    setContacts((prev) =>
      prev.map((c) => (c.alreadyExists ? c : { ...c, selected })),
    )
  }, [])

  const importSelected = useCallback(async () => {
    const toImport = contacts.filter((c) => c.selected && !c.alreadyExists)
    if (toImport.length === 0) return

    setStep('importing')

    try {
      const res = await fetch('/api/crm/customers/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contacts: toImport.map(({ name, phone }) => ({ name, phone })),
        }),
      })
      if (!res.ok) throw new Error('Falha ao importar contatos')

      const data = (await res.json()) as ImportResult
      setResult(data)
      setStep('done')
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao importar')
      setStep('error')
    }
  }, [contacts, queryClient])

  const selectedCount = contacts.filter((c) => c.selected && !c.alreadyExists).length
  const newCount = contacts.filter((c) => !c.alreadyExists).length
  const existingCount = contacts.filter((c) => c.alreadyExists).length

  return {
    step,
    contacts,
    result,
    error,
    selectedCount,
    newCount,
    existingCount,
    reset,
    pickFromDevice,
    pickFromVCard,
    toggleContact,
    toggleAll,
    importSelected,
  }
}
```

- [ ] **Step 2: Criar `src/components/domain/crm/import-contacts-modal.tsx`**

```tsx
'use client'

import { useRef } from 'react'
import { Upload, Users, CheckCircle2, Circle, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { useImportContacts, supportsContactPicker } from '@/hooks/crm/use-import-contacts'

type Props = {
  open: boolean
  onClose: () => void
}

export function ImportContactsModal({ open, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const {
    step,
    contacts,
    result,
    error,
    selectedCount,
    newCount,
    existingCount,
    reset,
    pickFromDevice,
    pickFromVCard,
    toggleContact,
    toggleAll,
    importSelected,
  } = useImportContacts()

  function handleClose() {
    reset()
    onClose()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) pickFromVCard(file)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importar contatos</DialogTitle>
        </DialogHeader>

        {/* Estado: idle — escolha do método */}
        {step === 'idle' && (
          <div className="space-y-3 pt-2">
            {supportsContactPicker() ? (
              <Button
                onClick={pickFromDevice}
                className="w-full justify-start gap-3 h-14 rounded-2xl border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                variant="outline"
              >
                <Users className="size-5 text-slate-500" />
                <div className="text-left">
                  <p className="text-sm font-medium">Selecionar dos contatos</p>
                  <p className="text-xs text-slate-500">Abre os contatos do dispositivo</p>
                </div>
              </Button>
            ) : (
              <Button
                onClick={() => fileRef.current?.click()}
                className="w-full justify-start gap-3 h-14 rounded-2xl border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                variant="outline"
              >
                <Upload className="size-5 text-slate-500" />
                <div className="text-left">
                  <p className="text-sm font-medium">Importar arquivo .vcf</p>
                  <p className="text-xs text-slate-500">
                    No iPhone: Contatos → Exportar → Todos os contatos
                  </p>
                </div>
              </Button>
            )}

            <input
              ref={fileRef}
              type="file"
              accept=".vcf,text/vcard"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        )}

        {/* Estado: loading */}
        {step === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="size-8 animate-spin text-slate-400" />
            <p className="text-sm text-slate-500">Carregando contatos...</p>
          </div>
        )}

        {/* Estado: preview — seleção dos contatos */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">
                <span className="font-medium text-slate-900">{newCount} novos</span>
                {existingCount > 0 && (
                  <span className="text-slate-400"> · {existingCount} já cadastrados</span>
                )}
              </p>
              <button
                className="text-xs text-slate-500 underline underline-offset-2"
                onClick={() => toggleAll(selectedCount < newCount)}
              >
                {selectedCount < newCount ? 'Selecionar todos' : 'Desmarcar todos'}
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-1 rounded-xl border border-slate-100 p-1">
              {contacts.map((contact) => (
                <label
                  key={contact.phone}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition ${
                    contact.alreadyExists
                      ? 'opacity-50 cursor-default'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <Checkbox
                    checked={contact.selected}
                    disabled={contact.alreadyExists}
                    onCheckedChange={() => !contact.alreadyExists && toggleContact(contact.phone)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {contact.name}
                    </p>
                    <p className="text-xs text-slate-500">{contact.phone}</p>
                  </div>
                  {contact.alreadyExists && (
                    <Badge className="shrink-0 rounded-full bg-slate-100 px-2 text-[10px] text-slate-500">
                      Já cadastrado
                    </Badge>
                  )}
                </label>
              ))}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-slate-950 text-white hover:bg-slate-800"
                disabled={selectedCount === 0}
                onClick={importSelected}
              >
                Importar {selectedCount > 0 ? `(${selectedCount})` : ''}
              </Button>
            </div>
          </div>
        )}

        {/* Estado: importing */}
        {step === 'importing' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="size-8 animate-spin text-slate-400" />
            <p className="text-sm text-slate-500">Importando contatos...</p>
          </div>
        )}

        {/* Estado: done */}
        {step === 'done' && result && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="size-10 text-green-500" />
            <div>
              <p className="font-medium text-slate-900">
                {result.created} contato{result.created !== 1 ? 's' : ''} importado{result.created !== 1 ? 's' : ''}
              </p>
              {result.skipped > 0 && (
                <p className="text-sm text-slate-500">
                  {result.skipped} já estavam cadastrados
                </p>
              )}
            </div>
            <Button onClick={handleClose} className="mt-2 bg-slate-950 text-white hover:bg-slate-800">
              Fechar
            </Button>
          </div>
        )}

        {/* Estado: error */}
        {step === 'error' && (
          <div className="space-y-4 py-4 text-center">
            <p className="text-sm text-red-600">{error}</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={reset}>
                Tentar novamente
              </Button>
              <Button variant="ghost" onClick={handleClose}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Criar `src/components/domain/crm/import-contacts-button.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { ContactRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ImportContactsModal } from './import-contacts-modal'

export function ImportContactsButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-full"
      >
        <ContactRound className="size-4" />
        <span className="hidden sm:inline">Importar</span>
      </Button>

      <ImportContactsModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
```

- [ ] **Step 4: Integrar botão no `CustomerList`**

Em `src/components/domain/crm/customer-list.tsx`:

1. Adicionar import:
```ts
import { ImportContactsButton } from './import-contacts-button'
```

2. Na barra de ações (div com `className="flex items-center gap-3"`), adicionar o botão antes do "Novo cliente", dentro do bloco `can('clientes', 'create')`:

```tsx
<div className="flex items-center gap-3">
  <div className="relative flex-1">
    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
    <Input
      placeholder="Buscar por nome ou telefone..."
      className="pl-9"
      value={search}
      onChange={(e) => {
        setSearch(e.target.value)
        setPage(1)
      }}
    />
  </div>
  {can('clientes', 'create') && (
    <>
      <ImportContactsButton />
      <Button
        onClick={() => setCreateOpen(true)}
        className="shrink-0 rounded-full bg-slate-950 text-white hover:bg-slate-800"
      >
        <Plus className="size-4" />
        <span className="hidden sm:inline">Novo cliente</span>
      </Button>
    </>
  )}
</div>
```

- [ ] **Step 5: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Saída esperada: zero erros.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/crm/use-import-contacts.ts src/components/domain/crm/
git commit -m "feat(crm): modal e hook de importação de contatos via Contact Picker e vCard"
```

---

## Task 7: Deduplicação no cadastro público

**Files:**
- Modify: `src/app/api/public/[slug]/customers/route.ts`

**Interfaces:**
- Consumes: Prisma `customer.findFirst` + `customer.update` + `customer.create` diretamente (fluxo público sem autenticação de tenant)
- Produces: ao receber CPF ou telefone já existente no tenant, atualiza o cliente e retorna sessão — sem criar duplicata

- [ ] **Step 1: Reescrever a lógica de lookup e upsert em `/api/public/[slug]/customers/route.ts`**

Substituir o arquivo completo:

```ts
// src/app/api/public/[slug]/customers/route.ts
import { z } from 'zod'
import { prisma } from '@/shared/database/prisma'
import { publicBookingRepository } from '@/domains/scheduling/public-booking.repository'
import { checkRateLimit } from '@/shared/rate-limit/public-rate-limit'
import {
  createPublicSession,
  COOKIE_NAME,
  MAX_AGE_SECONDS,
} from '@/shared/auth/public-session'
import { handleApiError } from '@/shared/http/handle-api-error'

const CreateCustomerSchema = z.object({
  name: z.string().min(2).max(100),
  cpf: z.string().min(11).max(14),
  phone: z.string().min(10).max(20),
  email: z.string().email().max(100),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, '')
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

type RouteContext = { params: Promise<{ slug: string }> }

export async function POST(req: Request, context: RouteContext) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const limit = await checkRateLimit({
      ip,
      action: 'customer_register',
      maxPerWindow: 5,
      windowMs: 15 * 60 * 1000,
    })
    if (!limit.allowed) {
      return Response.json(
        { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Muitas tentativas. Aguarde 15 minutos.' } },
        { status: 429 },
      )
    }

    const body = await req.json()
    const parsed = CreateCustomerSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.', details: parsed.error.flatten().fieldErrors } },
        { status: 422 },
      )
    }

    const { slug } = await context.params
    const tenant = await publicBookingRepository.findTenantBySlug(slug)

    const cpf = normalizeCpf(parsed.data.cpf)
    const phone = normalizePhone(parsed.data.phone)
    const birthDate = new Date(parsed.data.birthDate)

    const updateData = {
      name: parsed.data.name,
      phone,
      email: parsed.data.email,
      birthDate,
      cpf,
      consentGiven: true,
      consentDate: new Date(),
      consentOrigin: 'public_booking',
    }

    // Busca por CPF primeiro (identificador mais confiável)
    let existing = await prisma.customer.findFirst({
      where: { tenantId: tenant.id, cpf },
      select: { id: true, name: true },
    })

    // Fallback: busca por telefone normalizado
    if (!existing) {
      existing = await prisma.customer.findFirst({
        where: { tenantId: tenant.id, phone },
        select: { id: true, name: true },
      })
    }

    const customer = existing
      ? await prisma.customer.update({
          where: { id: existing.id },
          data: updateData,
          select: { id: true, name: true },
        })
      : await prisma.customer.create({
          data: {
            tenantId: tenant.id,
            ...updateData,
          },
          select: { id: true, name: true },
        })

    const token = createPublicSession(customer.id, tenant.id, slug)
    const isProduction = process.env.NODE_ENV === 'production'
    const secureFlag = isProduction ? '; Secure' : ''
    return new Response(JSON.stringify({ id: customer.id, name: customer.name }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/${secureFlag}; Max-Age=${MAX_AGE_SECONDS}`,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Saída esperada: zero erros.

- [ ] **Step 3: Rodar todos os testes**

```bash
npx vitest run
```

Saída esperada: todos passando, zero falhas.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/public/
git commit -m "feat(crm): deduplicação pública por CPF ou telefone com upsert de dados"
```

---

## Finalização

- [ ] **Abrir Pull Request**

```bash
gh pr create \
  --base main \
  --title "feat(crm): importar contatos, soft delete de clientes e dedup pública" \
  --body "$(cat <<'EOF'
## Resumo

- **Soft delete de clientes**: campo `deletedAt` no schema + menu de arquivar no card + restauração no perfil
- **Importar contatos**: Contact Picker API no Android, upload .vcf no iOS — preview com seleção individual antes de importar
- **Deduplicação pública**: cadastro na vitrine verifica CPF ou telefone e atualiza cliente existente ao invés de duplicar

## Como testar

- [ ] Arquivar cliente via menu no card e confirmar que some da lista
- [ ] Acessar `/clientes/[id]` de um cliente arquivado e restaurá-lo
- [ ] (Android Chrome) Clicar em "Importar" → selecionar contatos → verificar preview com novos vs. já cadastrados → importar
- [ ] (iOS/Desktop) Clicar em "Importar" → fazer upload de .vcf → verificar preview → importar
- [ ] Cadastrar na vitrine pública com CPF já existente → verificar que atualiza dados sem criar duplicata
- [ ] Cadastrar na vitrine pública com telefone já existente (sem CPF) → verificar que atualiza dados
EOF
)"
```
