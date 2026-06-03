# Serviços, Pacotes e Promoções — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar Serviços das Configurações para o menu lateral, criando uma página dedicada com três abas (Serviços, Pacotes, Promoções) com suporte a imagens e inputs monetários com máscara.

**Architecture:** Schema Prisma estendido com `ServicePackage`, `ServicePackageItem`, `Promotion` e `PromotionItem`. Backend seguindo o padrão Repository → Service → API Route já estabelecido no domínio `scheduling`. Frontend com novos componentes em `src/components/domain/services/` e dois novos inputs de UI compartilhados (`CurrencyInput`, `PercentageInput`).

**Tech Stack:** Next.js 15 App Router, Prisma, Supabase Storage, TanStack Query, Zod, Vitest, Shadcn UI, Lucide React.

---

## Mapa de arquivos

### Criar
| Arquivo | Responsabilidade |
|---|---|
| `src/domains/scheduling/package.repository.ts` | CRUD de ServicePackage + items |
| `src/domains/scheduling/promotion.repository.ts` | CRUD de Promotion + items + flag `expired` |
| `src/domains/scheduling/__tests__/package.repository.test.ts` | Testes do PackageRepository |
| `src/domains/scheduling/__tests__/promotion.repository.test.ts` | Testes do PromotionRepository |
| `src/app/api/scheduling/packages/route.ts` | GET + POST packages |
| `src/app/api/scheduling/packages/[id]/route.ts` | PATCH + DELETE package |
| `src/app/api/scheduling/promotions/route.ts` | GET + POST promotions |
| `src/app/api/scheduling/promotions/[id]/route.ts` | PATCH + DELETE promotion |
| `src/app/api/uploads/service-images/route.ts` | Upload p/ Supabase Storage |
| `src/components/ui/currency-input.tsx` | Máscara R$ 0,00 |
| `src/components/ui/percentage-input.tsx` | Máscara 0–100% |
| `src/components/domain/services/service-catalog.tsx` | Catálogo movido de settings/ |
| `src/components/domain/services/service-form-modal.tsx` | Modal movido + CurrencyInput |
| `src/components/domain/services/package-catalog.tsx` | Listagem de pacotes |
| `src/components/domain/services/package-form-modal.tsx` | Modal criar/editar pacote |
| `src/components/domain/services/promotion-catalog.tsx` | Listagem de promoções + badges |
| `src/components/domain/services/promotion-form-modal.tsx` | Modal criar/editar promoção |
| `src/hooks/scheduling/use-packages.ts` | Hooks TanStack Query para pacotes |
| `src/hooks/scheduling/use-promotions.ts` | Hooks TanStack Query para promoções |
| `src/app/(app)/servicos/page.tsx` | Página com 3 abas |

### Modificar
| Arquivo | O que muda |
|---|---|
| `prisma/schema.prisma` | Adiciona modelos novos + `imageUrl` no Service |
| `src/domains/scheduling/types.ts` | Adiciona schemas Zod de Package e Promotion |
| `src/domains/scheduling/scheduling.service.ts` | Métodos de package e promotion |
| `src/hooks/scheduling/use-services.ts` | Adiciona `imageUrl` ao tipo `Service` |
| `src/components/app/app-shell.tsx` | Adiciona item "Serviços" no sidebar |
| `src/app/(app)/configuracoes/page.tsx` | Remove aba "Serviços" |

### Deletar
| Arquivo | Motivo |
|---|---|
| `src/components/domain/settings/service-catalog.tsx` | Movido para `domain/services/` |
| `src/components/domain/settings/service-form-modal.tsx` | Movido para `domain/services/` |

---

## Task 1: Branch de feature

- [ ] **Criar branch**

```bash
git checkout -b feat/servicos-pacotes-promocoes
```

Expected: `Switched to a new branch 'feat/servicos-pacotes-promocoes'`

---

## Task 2: Schema Prisma — novos modelos

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Adicionar `imageUrl` ao modelo Service e relações reversas**

No arquivo `prisma/schema.prisma`, localizar o modelo `Service` (linha ~242) e adicionar após o campo `active`:

```prisma
model Service {
  id           String              @id @default(cuid())
  tenantId     String
  name         String
  duration     Int
  price        Decimal             @db.Decimal(10, 2)
  active       Boolean             @default(true)
  imageUrl     String?
  createdAt    DateTime            @default(now())
  updatedAt    DateTime            @updatedAt
  tenant       Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  appointments Appointment[]
  packages     ServicePackageItem[]
  promotions   PromotionItem[]

  @@index([tenantId])
}
```

- [ ] **Adicionar relações ao modelo Tenant**

Após a linha `anamneseTemplate AnamneseTemplate?` no modelo `Tenant`, adicionar:

```prisma
  servicePackages     ServicePackage[]
  tenantPromotions    Promotion[]
```

- [ ] **Adicionar enum PromoDiscountType e novos modelos ao final do schema**

Adicionar ao final de `prisma/schema.prisma`:

```prisma
enum PromoDiscountType {
  PERCENTAGE
  FIXED
}

model ServicePackage {
  id          String               @id @default(cuid())
  tenantId    String
  name        String
  description String?
  price       Decimal              @db.Decimal(10, 2)
  imageUrl    String?
  active      Boolean              @default(true)
  items       ServicePackageItem[]
  promotions  PromotionItem[]
  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt
  tenant      Tenant               @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
}

model ServicePackageItem {
  id        String         @id @default(cuid())
  package   ServicePackage @relation(fields: [packageId], references: [id], onDelete: Cascade)
  packageId String
  service   Service        @relation(fields: [serviceId], references: [id])
  serviceId String

  @@unique([packageId, serviceId])
}

model Promotion {
  id            String            @id @default(cuid())
  tenantId      String
  name          String
  description   String?
  discountType  PromoDiscountType
  discountValue Decimal           @db.Decimal(10, 2)
  startsAt      DateTime?
  endsAt        DateTime?
  active        Boolean           @default(true)
  imageUrl      String?
  items         PromotionItem[]
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt
  tenant        Tenant            @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
}

model PromotionItem {
  id          String          @id @default(cuid())
  promotion   Promotion       @relation(fields: [promotionId], references: [id], onDelete: Cascade)
  promotionId String
  service     Service?        @relation(fields: [serviceId], references: [id])
  serviceId   String?
  package     ServicePackage? @relation(fields: [packageId], references: [id])
  packageId   String?
}
```

- [ ] **Gerar e aplicar migration**

```bash
npx prisma migrate dev --name add-packages-promotions-imageurl
```

Expected: `✔ Generated Prisma Client` e migration aplicada sem erros.

- [ ] **Verificar que Prisma Client foi gerado com os novos tipos**

```bash
npx prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Commit**

```bash
git add prisma/
git commit -m "feat(db): adiciona ServicePackage, Promotion, PromoDiscountType e imageUrl em Service"
```

---

## Task 3: Zod schemas para Package e Promotion

**Files:**
- Modify: `src/domains/scheduling/types.ts`

- [ ] **Adicionar imports e schemas ao final de `types.ts`**

```typescript
// Adicionar ao final de src/domains/scheduling/types.ts

export const createPackageSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
  price: z.number().positive(),
  serviceIds: z.array(z.string().cuid()).min(1, 'Pacote deve ter ao menos 1 serviço'),
  imageUrl: z.string().url().optional(),
})

export const updatePackageSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(500).optional(),
    price: z.number().positive().optional(),
    serviceIds: z.array(z.string().cuid()).min(1).optional(),
    imageUrl: z.string().url().optional().nullable(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Informe ao menos um campo para atualizar.')

export type CreatePackageInput = z.infer<typeof createPackageSchema>
export type UpdatePackageInput = z.infer<typeof updatePackageSchema>

const promoItemSchema = z
  .object({
    serviceId: z.string().cuid().optional(),
    packageId: z.string().cuid().optional(),
  })
  .refine((i) => i.serviceId || i.packageId, 'Item deve ter serviceId ou packageId')

export const createPromotionSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().max(500).optional(),
    discountType: z.enum(['PERCENTAGE', 'FIXED']),
    discountValue: z.number().positive(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    imageUrl: z.string().url().optional(),
    items: z.array(promoItemSchema).min(1, 'Promoção deve ter ao menos 1 item'),
  })
  .refine(
    (data) => data.discountType !== 'PERCENTAGE' || data.discountValue <= 100,
    { message: 'Desconto percentual não pode ultrapassar 100%', path: ['discountValue'] },
  )

export const updatePromotionSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(500).optional(),
    discountType: z.enum(['PERCENTAGE', 'FIXED']).optional(),
    discountValue: z.number().positive().optional(),
    startsAt: z.string().datetime().optional().nullable(),
    endsAt: z.string().datetime().optional().nullable(),
    active: z.boolean().optional(),
    imageUrl: z.string().url().optional().nullable(),
    items: z.array(promoItemSchema).min(1).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Informe ao menos um campo para atualizar.')

export type CreatePromotionInput = z.infer<typeof createPromotionSchema>
export type UpdatePromotionInput = z.infer<typeof updatePromotionSchema>
```

Também adicionar `imageUrl` ao `updateServiceSchema` existente:

```typescript
export const updateServiceSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  duration: z.number().int().min(5).max(480).optional(),
  price: z.number().positive().optional(),
  imageUrl: z.string().url().optional().nullable(),
})
```

E atualizar o **tipo** derivado logo abaixo (se existir inline, já é inferido pelo `z.infer`; caso haja `UpdateServiceInput` manual, atualizá-lo).

- [ ] **Atualizar `service.repository.ts` — método `update` para aceitar `imageUrl`**

No arquivo `src/domains/scheduling/service.repository.ts`, atualizar a assinatura do método `update`:

```typescript
async update(
  tenantId: string,
  serviceId: string,
  data: { name?: string; duration?: number; price?: number; imageUrl?: string | null },
) {
  return prisma.service.update({
    where: { id: serviceId, tenantId },
    data,
  })
}
```

- [ ] **Commit**

```bash
git add src/domains/scheduling/types.ts
git commit -m "feat(scheduling): adiciona schemas Zod de Package e Promotion"
```

---

## Task 4: PackageRepository — TDD

**Files:**
- Create: `src/domains/scheduling/__tests__/package.repository.test.ts`
- Create: `src/domains/scheduling/package.repository.ts`

- [ ] **Escrever testes que falham**

```typescript
// src/domains/scheduling/__tests__/package.repository.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { prismaMock } from '@/shared/test/prisma-mock'
import { PackageRepository } from '../package.repository'
import { Prisma } from '@prisma/client'

const repo = new PackageRepository()

const mockItem = {
  id: 'item-1',
  packageId: 'pkg-1',
  serviceId: 'svc-1',
  service: { id: 'svc-1', name: 'Corte', duration: 60, price: new Prisma.Decimal('50.00') },
}

const mockPackage = {
  id: 'pkg-1',
  tenantId: 'tenant-1',
  name: 'Combo Corte + Barba',
  description: null,
  price: new Prisma.Decimal('80.00'),
  imageUrl: null,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [mockItem],
}

describe('PackageRepository', () => {
  beforeEach(() => {
    prismaMock.servicePackage.findMany.mockResolvedValue([mockPackage] as never)
    prismaMock.servicePackage.findFirst.mockResolvedValue(mockPackage as never)
    prismaMock.servicePackage.create.mockResolvedValue(mockPackage as never)
    prismaMock.servicePackage.update.mockResolvedValue(mockPackage as never)
  })

  it('list() filtra por tenantId e retorna apenas ativos', async () => {
    await repo.list('tenant-1')
    expect(prismaMock.servicePackage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1', active: true }),
      }),
    )
  })

  it('findById() filtra por tenantId e id', async () => {
    await repo.findById('tenant-1', 'pkg-1')
    expect(prismaMock.servicePackage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pkg-1', tenantId: 'tenant-1' },
      }),
    )
  })

  it('create() injeta tenantId e cria serviceIds como items', async () => {
    await repo.create('tenant-1', { name: 'Combo', price: 80, serviceIds: ['svc-1', 'svc-2'] })
    expect(prismaMock.servicePackage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          name: 'Combo',
          items: { create: [{ serviceId: 'svc-1' }, { serviceId: 'svc-2' }] },
        }),
      }),
    )
  })

  it('deactivate() seta active: false sem deletar registro', async () => {
    await repo.deactivate('tenant-1', 'pkg-1')
    expect(prismaMock.servicePackage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pkg-1', tenantId: 'tenant-1' },
        data: { active: false },
      }),
    )
  })
})
```

- [ ] **Rodar testes — esperar FAIL**

```bash
npx vitest run src/domains/scheduling/__tests__/package.repository.test.ts
```

Expected: FAIL — `Cannot find module '../package.repository'`

- [ ] **Implementar PackageRepository**

```typescript
// src/domains/scheduling/package.repository.ts
import { Prisma } from '@prisma/client'
import { prisma } from '@/shared/database/prisma'

const SERVICE_SELECT = { select: { id: true, name: true, duration: true, price: true } }

const INCLUDE = {
  items: { include: { service: SERVICE_SELECT } },
}

type CreatePackageData = {
  name: string
  description?: string
  price: number
  serviceIds: string[]
  imageUrl?: string
}

type UpdatePackageData = {
  name?: string
  description?: string
  price?: number
  serviceIds?: string[]
  imageUrl?: string | null
}

export class PackageRepository {
  async list(tenantId: string) {
    return prisma.servicePackage.findMany({
      where: { tenantId, active: true },
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
  }

  async findById(tenantId: string, packageId: string) {
    return prisma.servicePackage.findFirst({
      where: { id: packageId, tenantId },
      include: INCLUDE,
    })
  }

  async create(tenantId: string, data: CreatePackageData) {
    return prisma.servicePackage.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description,
        price: new Prisma.Decimal(data.price),
        imageUrl: data.imageUrl,
        items: { create: data.serviceIds.map((serviceId) => ({ serviceId })) },
      },
      include: INCLUDE,
    })
  }

  async update(tenantId: string, packageId: string, data: UpdatePackageData) {
    return prisma.$transaction(async (tx) => {
      if (data.serviceIds) {
        await tx.servicePackageItem.deleteMany({ where: { packageId } })
        await tx.servicePackageItem.createMany({
          data: data.serviceIds.map((serviceId) => ({ packageId, serviceId })),
        })
      }
      return tx.servicePackage.update({
        where: { id: packageId, tenantId },
        data: {
          name: data.name,
          description: data.description,
          price: data.price !== undefined ? new Prisma.Decimal(data.price) : undefined,
          imageUrl: data.imageUrl,
        },
        include: INCLUDE,
      })
    })
  }

  async deactivate(tenantId: string, packageId: string) {
    return prisma.servicePackage.update({
      where: { id: packageId, tenantId },
      data: { active: false },
    })
  }
}

export const packageRepository = new PackageRepository()
```

- [ ] **Rodar testes — esperar PASS**

```bash
npx vitest run src/domains/scheduling/__tests__/package.repository.test.ts
```

Expected: PASS (4 testes)

- [ ] **Commit**

```bash
git add src/domains/scheduling/package.repository.ts src/domains/scheduling/__tests__/package.repository.test.ts
git commit -m "feat(scheduling): PackageRepository com CRUD e filtro por tenantId"
```

---

## Task 5: PromotionRepository — TDD

**Files:**
- Create: `src/domains/scheduling/__tests__/promotion.repository.test.ts`
- Create: `src/domains/scheduling/promotion.repository.ts`

- [ ] **Escrever testes que falham**

```typescript
// src/domains/scheduling/__tests__/promotion.repository.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { prismaMock } from '@/shared/test/prisma-mock'
import { PromotionRepository } from '../promotion.repository'
import { Prisma, PromoDiscountType } from '@prisma/client'

const repo = new PromotionRepository()

const futureDate = new Date(Date.now() + 86400000)
const pastDate = new Date(Date.now() - 86400000)

const makePromo = (overrides = {}) => ({
  id: 'promo-1',
  tenantId: 'tenant-1',
  name: '20% off corte',
  description: null,
  discountType: PromoDiscountType.PERCENTAGE,
  discountValue: new Prisma.Decimal('20.00'),
  startsAt: null,
  endsAt: null,
  active: true,
  imageUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [],
  ...overrides,
})

describe('PromotionRepository', () => {
  beforeEach(() => {
    prismaMock.promotion.findMany.mockResolvedValue([makePromo()] as never)
    prismaMock.promotion.findFirst.mockResolvedValue(makePromo() as never)
    prismaMock.promotion.create.mockResolvedValue(makePromo() as never)
    prismaMock.promotion.update.mockResolvedValue(makePromo() as never)
  })

  it('list() filtra por tenantId', async () => {
    await repo.list('tenant-1')
    expect(prismaMock.promotion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1' }),
      }),
    )
  })

  it('list() retorna expired: false quando endsAt é null', async () => {
    prismaMock.promotion.findMany.mockResolvedValue([makePromo({ endsAt: null })] as never)
    const result = await repo.list('tenant-1')
    expect(result[0].expired).toBe(false)
  })

  it('list() retorna expired: true quando endsAt está no passado', async () => {
    prismaMock.promotion.findMany.mockResolvedValue([makePromo({ endsAt: pastDate })] as never)
    const result = await repo.list('tenant-1')
    expect(result[0].expired).toBe(true)
  })

  it('list() retorna expired: false quando endsAt está no futuro', async () => {
    prismaMock.promotion.findMany.mockResolvedValue([makePromo({ endsAt: futureDate })] as never)
    const result = await repo.list('tenant-1')
    expect(result[0].expired).toBe(false)
  })

  it('create() injeta tenantId', async () => {
    await repo.create('tenant-1', {
      name: '20% off',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      items: [{ serviceId: 'svc-1' }],
    })
    expect(prismaMock.promotion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: 'tenant-1', name: '20% off' }),
      }),
    )
  })

  it('deactivate() seta active: false', async () => {
    await repo.deactivate('tenant-1', 'promo-1')
    expect(prismaMock.promotion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'promo-1', tenantId: 'tenant-1' },
        data: { active: false },
      }),
    )
  })
})
```

- [ ] **Rodar testes — esperar FAIL**

```bash
npx vitest run src/domains/scheduling/__tests__/promotion.repository.test.ts
```

Expected: FAIL — `Cannot find module '../promotion.repository'`

- [ ] **Implementar PromotionRepository**

```typescript
// src/domains/scheduling/promotion.repository.ts
import { Prisma, PromoDiscountType } from '@prisma/client'
import { prisma } from '@/shared/database/prisma'

const INCLUDE = {
  items: {
    include: {
      service: { select: { id: true, name: true, price: true } },
      package: { select: { id: true, name: true, price: true } },
    },
  },
}

type PromoItemInput = { serviceId?: string; packageId?: string }

type CreatePromotionData = {
  name: string
  description?: string
  discountType: 'PERCENTAGE' | 'FIXED'
  discountValue: number
  startsAt?: string
  endsAt?: string
  imageUrl?: string
  items: PromoItemInput[]
}

type UpdatePromotionData = {
  name?: string
  description?: string
  discountType?: 'PERCENTAGE' | 'FIXED'
  discountValue?: number
  startsAt?: string | null
  endsAt?: string | null
  active?: boolean
  imageUrl?: string | null
  items?: PromoItemInput[]
}

function withExpired<T extends { endsAt: Date | null }>(promo: T) {
  return { ...promo, expired: promo.endsAt !== null && promo.endsAt < new Date() }
}

export class PromotionRepository {
  async list(tenantId: string) {
    const rows = await prisma.promotion.findMany({
      where: { tenantId },
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(withExpired)
  }

  async findById(tenantId: string, promotionId: string) {
    const row = await prisma.promotion.findFirst({
      where: { id: promotionId, tenantId },
      include: INCLUDE,
    })
    return row ? withExpired(row) : null
  }

  async create(tenantId: string, data: CreatePromotionData) {
    const row = await prisma.promotion.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description,
        discountType: data.discountType as PromoDiscountType,
        discountValue: new Prisma.Decimal(data.discountValue),
        startsAt: data.startsAt ? new Date(data.startsAt) : undefined,
        endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
        imageUrl: data.imageUrl,
        items: {
          create: data.items.map((i) => ({ serviceId: i.serviceId, packageId: i.packageId })),
        },
      },
      include: INCLUDE,
    })
    return withExpired(row)
  }

  async update(tenantId: string, promotionId: string, data: UpdatePromotionData) {
    return prisma.$transaction(async (tx) => {
      if (data.items) {
        await tx.promotionItem.deleteMany({ where: { promotionId } })
        await tx.promotionItem.createMany({
          data: data.items.map((i) => ({ promotionId, serviceId: i.serviceId, packageId: i.packageId })),
        })
      }
      const row = await tx.promotion.update({
        where: { id: promotionId, tenantId },
        data: {
          name: data.name,
          description: data.description,
          discountType: data.discountType as PromoDiscountType | undefined,
          discountValue: data.discountValue !== undefined ? new Prisma.Decimal(data.discountValue) : undefined,
          startsAt: data.startsAt !== undefined ? (data.startsAt ? new Date(data.startsAt) : null) : undefined,
          endsAt: data.endsAt !== undefined ? (data.endsAt ? new Date(data.endsAt) : null) : undefined,
          active: data.active,
          imageUrl: data.imageUrl,
        },
        include: INCLUDE,
      })
      return withExpired(row)
    })
  }

  async deactivate(tenantId: string, promotionId: string) {
    return prisma.promotion.update({
      where: { id: promotionId, tenantId },
      data: { active: false },
    })
  }
}

export const promotionRepository = new PromotionRepository()
```

- [ ] **Rodar testes — esperar PASS**

```bash
npx vitest run src/domains/scheduling/__tests__/promotion.repository.test.ts
```

Expected: PASS (6 testes)

- [ ] **Commit**

```bash
git add src/domains/scheduling/promotion.repository.ts src/domains/scheduling/__tests__/promotion.repository.test.ts
git commit -m "feat(scheduling): PromotionRepository com CRUD, tenantId e flag expired"
```

---

## Task 6: SchedulingService — métodos de Package e Promotion

**Files:**
- Modify: `src/domains/scheduling/scheduling.service.ts`

- [ ] **Adicionar imports no topo de `scheduling.service.ts`** (após os imports existentes)

```typescript
import { packageRepository } from './package.repository'
import { promotionRepository } from './promotion.repository'
import type { CreatePackageInput, UpdatePackageInput, CreatePromotionInput, UpdatePromotionInput } from './types'
```

- [ ] **Adicionar métodos de Package e Promotion na classe `SchedulingService`** (antes do método privado `resolveStatusEvent`):

```typescript
  async listPackages(tenantId: string) {
    return packageRepository.list(tenantId)
  }

  async createPackage(tenantId: string, input: CreatePackageInput) {
    return packageRepository.create(tenantId, {
      name: input.name,
      description: input.description,
      price: input.price,
      serviceIds: input.serviceIds,
      imageUrl: input.imageUrl,
    })
  }

  async updatePackage(tenantId: string, packageId: string, input: UpdatePackageInput) {
    return packageRepository.update(tenantId, packageId, input)
  }

  async deactivatePackage(tenantId: string, packageId: string) {
    return packageRepository.deactivate(tenantId, packageId)
  }

  async listPromotions(tenantId: string) {
    return promotionRepository.list(tenantId)
  }

  async createPromotion(tenantId: string, input: CreatePromotionInput) {
    return promotionRepository.create(tenantId, {
      name: input.name,
      description: input.description,
      discountType: input.discountType as 'PERCENTAGE' | 'FIXED',
      discountValue: input.discountValue,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      imageUrl: input.imageUrl,
      items: input.items,
    })
  }

  async updatePromotion(tenantId: string, promotionId: string, input: UpdatePromotionInput) {
    return promotionRepository.update(tenantId, promotionId, {
      ...input,
      discountType: input.discountType as 'PERCENTAGE' | 'FIXED' | undefined,
    })
  }

  async deactivatePromotion(tenantId: string, promotionId: string) {
    return promotionRepository.deactivate(tenantId, promotionId)
  }
```

- [ ] **Commit**

```bash
git add src/domains/scheduling/scheduling.service.ts
git commit -m "feat(scheduling): métodos de Package e Promotion no SchedulingService"
```

---

## Task 7: API Routes — Packages

**Files:**
- Create: `src/app/api/scheduling/packages/route.ts`
- Create: `src/app/api/scheduling/packages/[id]/route.ts`

- [ ] **Criar `src/app/api/scheduling/packages/route.ts`**

```typescript
import { schedulingService } from '@/domains/scheduling/scheduling.service'
import { createPackageSchema } from '@/domains/scheduling/types'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { ensurePermission, PERMISSIONS } from '@/shared/auth/permissions'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { created } from '@/shared/http/responses'
import { validateInput } from '@/shared/http/validate-input'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.services.view)
    const packages = await schedulingService.listPackages(session.tenantId)
    return Response.json(packages)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.services.manage)
    const input = await validateInput(request, createPackageSchema)
    const pkg = await schedulingService.createPackage(session.tenantId, input)
    return created(pkg)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Criar `src/app/api/scheduling/packages/[id]/route.ts`**

```typescript
import { schedulingService } from '@/domains/scheduling/scheduling.service'
import { updatePackageSchema } from '@/domains/scheduling/types'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { ensurePermission, PERMISSIONS } from '@/shared/auth/permissions'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.services.manage)
    const { id } = await params
    const input = await validateInput(request, updatePackageSchema)
    const pkg = await schedulingService.updatePackage(session.tenantId, id, input)
    return Response.json(pkg)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.services.manage)
    const { id } = await params
    await schedulingService.deactivatePackage(session.tenantId, id)
    return new Response(null, { status: 204 })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Commit**

```bash
git add src/app/api/scheduling/packages/
git commit -m "feat(api): rotas GET/POST e PATCH/DELETE para packages"
```

---

## Task 8: API Routes — Promotions

**Files:**
- Create: `src/app/api/scheduling/promotions/route.ts`
- Create: `src/app/api/scheduling/promotions/[id]/route.ts`

- [ ] **Criar `src/app/api/scheduling/promotions/route.ts`**

```typescript
import { schedulingService } from '@/domains/scheduling/scheduling.service'
import { createPromotionSchema } from '@/domains/scheduling/types'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { ensurePermission, PERMISSIONS } from '@/shared/auth/permissions'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { created } from '@/shared/http/responses'
import { validateInput } from '@/shared/http/validate-input'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.services.view)
    const promotions = await schedulingService.listPromotions(session.tenantId)
    return Response.json(promotions)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.services.manage)
    const input = await validateInput(request, createPromotionSchema)
    const promotion = await schedulingService.createPromotion(session.tenantId, input)
    return created(promotion)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Criar `src/app/api/scheduling/promotions/[id]/route.ts`**

```typescript
import { schedulingService } from '@/domains/scheduling/scheduling.service'
import { updatePromotionSchema } from '@/domains/scheduling/types'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { ensurePermission, PERMISSIONS } from '@/shared/auth/permissions'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.services.manage)
    const { id } = await params
    const input = await validateInput(request, updatePromotionSchema)
    const promotion = await schedulingService.updatePromotion(session.tenantId, id, input)
    return Response.json(promotion)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.services.manage)
    const { id } = await params
    await schedulingService.deactivatePromotion(session.tenantId, id)
    return new Response(null, { status: 204 })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Commit**

```bash
git add src/app/api/scheduling/promotions/
git commit -m "feat(api): rotas GET/POST e PATCH/DELETE para promotions"
```

---

## Task 9: API Route — Upload de imagens

**Files:**
- Create: `src/app/api/uploads/service-images/route.ts`

- [ ] **Criar `src/app/api/uploads/service-images/route.ts`**

```typescript
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { supabaseAdmin } from '@/integrations/supabase/admin'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const ALLOWED_ENTITY_TYPES = new Set(['services', 'packages', 'promotions'])
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

export async function POST(request: Request) {
  try {
    const session = await getSessionContext(request)
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const entityType = formData.get('entityType') as string | null
    const entityId = formData.get('entityId') as string | null

    if (!file) {
      return Response.json({ error: 'Arquivo não informado' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return Response.json({ error: 'Formato não suportado. Use JPEG, PNG ou WebP.' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return Response.json({ error: 'Arquivo excede o limite de 5 MB.' }, { status: 400 })
    }
    if (!entityType || !ALLOWED_ENTITY_TYPES.has(entityType)) {
      return Response.json({ error: 'entityType inválido' }, { status: 400 })
    }
    if (!entityId) {
      return Response.json({ error: 'entityId não informado' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${session.tenantId}/${entityType}/${entityId}/${Date.now()}.${ext}`
    const bytes = await file.arrayBuffer()

    const { error } = await supabaseAdmin.storage
      .from('service-images')
      .upload(path, bytes, { contentType: file.type, upsert: true })

    if (error) {
      return Response.json({ error: 'Falha no upload. Tente novamente.' }, { status: 500 })
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('service-images')
      .getPublicUrl(path)

    return Response.json({ url: publicUrl })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Commit**

```bash
git add src/app/api/uploads/
git commit -m "feat(api): rota de upload de imagens para Supabase Storage"
```

---

## Task 10: CurrencyInput e PercentageInput

**Files:**
- Create: `src/components/ui/currency-input.tsx`
- Create: `src/components/ui/percentage-input.tsx`

- [ ] **Criar `src/components/ui/currency-input.tsx`**

```typescript
'use client'

import { forwardRef, useState, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type CurrencyInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  value: string
  onChange: (rawValue: string) => void
}

function centsToDisplay(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function valueToDisplay(value: string): string {
  if (!value) return ''
  const num = parseFloat(value)
  if (isNaN(num)) return ''
  return centsToDisplay(Math.round(num * 100))
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, className, ...props }, ref) => {
    const [display, setDisplay] = useState(() => valueToDisplay(value))

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const digits = e.target.value.replace(/\D/g, '')
        if (!digits) {
          setDisplay('')
          onChange('')
          return
        }
        const cents = parseInt(digits, 10)
        setDisplay(centsToDisplay(cents))
        onChange((cents / 100).toFixed(2))
      },
      [onChange],
    )

    return (
      <Input
        ref={ref}
        {...props}
        value={display}
        onChange={handleChange}
        inputMode="numeric"
        className={cn(className)}
      />
    )
  },
)
CurrencyInput.displayName = 'CurrencyInput'
```

- [ ] **Criar `src/components/ui/percentage-input.tsx`**

```typescript
'use client'

import { forwardRef, useState, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type PercentageInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  value: string
  onChange: (rawValue: string) => void
}

export const PercentageInput = forwardRef<HTMLInputElement, PercentageInputProps>(
  ({ value, onChange, className, ...props }, ref) => {
    const [display, setDisplay] = useState(value ? `${value}%` : '')

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.')
        if (!raw) {
          setDisplay('')
          onChange('')
          return
        }
        const num = parseFloat(raw)
        if (isNaN(num) || num < 0 || num > 100) return
        setDisplay(`${raw}%`)
        onChange(num.toFixed(2))
      },
      [onChange],
    )

    const handleBlur = useCallback(() => {
      const raw = display.replace('%', '').trim().replace(',', '.')
      const num = parseFloat(raw)
      if (!isNaN(num) && num >= 0 && num <= 100) {
        const formatted = num.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
        setDisplay(`${formatted}%`)
        onChange(num.toFixed(2))
      }
    }, [display, onChange])

    return (
      <Input
        ref={ref}
        {...props}
        value={display}
        onChange={handleChange}
        onBlur={handleBlur}
        inputMode="decimal"
        placeholder="0%"
        className={cn(className)}
      />
    )
  },
)
PercentageInput.displayName = 'PercentageInput'
```

- [ ] **Commit**

```bash
git add src/components/ui/currency-input.tsx src/components/ui/percentage-input.tsx
git commit -m "feat(ui): CurrencyInput e PercentageInput com máscara pt-BR"
```

---

## Task 11: Migrar ServiceCatalog e ServiceFormModal + CurrencyInput + imageUrl

**Files:**
- Create: `src/components/domain/services/service-catalog.tsx`
- Create: `src/components/domain/services/service-form-modal.tsx`
- Modify: `src/hooks/scheduling/use-services.ts`
- Delete: `src/components/domain/settings/service-catalog.tsx`
- Delete: `src/components/domain/settings/service-form-modal.tsx`

- [ ] **Atualizar tipo `Service` em `use-services.ts` para incluir `imageUrl`**

No arquivo `src/hooks/scheduling/use-services.ts`, modificar o tipo `Service`:

```typescript
export type Service = {
  id: string
  name: string
  duration: number
  price: string
  active: boolean
  imageUrl: string | null
}
```

- [ ] **Criar `src/components/domain/services/service-catalog.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { Edit2, Plus, Power } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useDeactivateService, useServices, type Service } from '@/hooks/scheduling/use-services'
import { ServiceFormModal } from './service-form-modal'

export function ServiceCatalog() {
  const { data: services, isLoading, isError, refetch } = useServices()
  const { mutate: deactivate } = useDeactivateService()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingService, setEditingService] = useState<Service | undefined>()

  function handleEdit(service: Service) {
    setEditingService(service)
    setModalOpen(true)
  }

  function handleCreate() {
    setEditingService(undefined)
    setModalOpen(true)
  }

  function handleDeactivate(service: Service) {
    if (!confirm(`Desativar "${service.name}"?`)) return
    deactivate(service.id)
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-dashed border-destructive/30 px-6 py-10 text-center">
        <p className="text-sm text-destructive">Erro ao carregar serviços.</p>
        <Button onClick={() => refetch()} variant="outline" size="sm" className="mt-3">
          Tentar novamente
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {services?.length ?? 0} serviço(s) cadastrado(s)
        </p>
        <Button onClick={handleCreate} size="sm" className="gap-2">
          <Plus className="size-4" />
          Novo serviço
        </Button>
      </div>

      {services?.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">Nenhum serviço cadastrado ainda.</p>
          <Button onClick={handleCreate} variant="outline" size="sm" className="mt-3">
            Criar primeiro serviço
          </Button>
        </div>
      )}

      {services && services.length > 0 && (
        <div className="space-y-2">
          {services.map((service) => (
            <div
              key={service.id}
              className="flex items-center gap-4 rounded-2xl border border-border/50 bg-card px-4 py-3 shadow-sm"
            >
              {service.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={service.imageUrl}
                  alt={service.name}
                  className="size-12 shrink-0 rounded-xl object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{service.name}</span>
                  {!service.active && (
                    <Badge variant="secondary" className="text-xs">Inativo</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {service.duration} min ·{' '}
                  {Number(service.price).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => handleEdit(service)} className="size-8" title="Editar">
                  <Edit2 className="size-3.5" />
                </Button>
                {service.active && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeactivate(service)}
                    className="size-8 text-muted-foreground hover:text-destructive"
                    title="Desativar"
                  >
                    <Power className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ServiceFormModal open={modalOpen} onClose={() => setModalOpen(false)} service={editingService} />
    </div>
  )
}
```

- [ ] **Criar `src/components/domain/services/service-form-modal.tsx`**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/ui/currency-input'
import { useCreateService, useUpdateService, type Service } from '@/hooks/scheduling/use-services'

type Props = {
  open: boolean
  onClose: () => void
  service?: Service
}

export function ServiceFormModal({ open, onClose, service }: Props) {
  const isEditing = !!service
  const { mutate: create, isPending: creating } = useCreateService()
  const { mutate: update, isPending: updating } = useUpdateService()

  const [name, setName] = useState('')
  const [duration, setDuration] = useState('60')
  const [price, setPrice] = useState('')

  useEffect(() => {
    if (open && service) {
      setName(service.name)
      setDuration(String(service.duration))
      setPrice(Number(service.price).toFixed(2))
    } else if (!open) {
      setName('')
      setDuration('60')
      setPrice('')
    }
  }, [open, service])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const durationNum = parseInt(duration, 10)
    const priceNum = parseFloat(price)
    if (isNaN(durationNum) || isNaN(priceNum) || priceNum <= 0) return

    if (isEditing) {
      update(
        { id: service.id, name: name.trim(), duration: durationNum, price: priceNum },
        { onSuccess: onClose },
      )
    } else {
      create(
        { name: name.trim(), duration: durationNum, price: priceNum },
        { onSuccess: onClose },
      )
    }
  }

  const isPending = creating || updating

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar serviço' : 'Novo serviço'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="service-name">Nome do serviço</Label>
            <Input
              id="service-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Corte masculino"
              required
              minLength={2}
              maxLength={100}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="service-duration">Duração (min)</Label>
              <Input
                id="service-duration"
                type="number"
                min={5}
                max={480}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-price">Preço</Label>
              <CurrencyInput
                id="service-price"
                value={price}
                onChange={setPrice}
                placeholder="R$ 0,00"
                required
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending} className="flex-1">
              {isPending ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar serviço'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Deletar arquivos antigos de settings/**

```bash
rm src/components/domain/settings/service-catalog.tsx
rm src/components/domain/settings/service-form-modal.tsx
```

- [ ] **Commit**

```bash
git add src/components/domain/services/ src/hooks/scheduling/use-services.ts
git rm src/components/domain/settings/service-catalog.tsx src/components/domain/settings/service-form-modal.tsx
git commit -m "feat(ui): migra ServiceCatalog/ServiceFormModal para domain/services + CurrencyInput"
```

---

## Task 12: Hooks use-packages e use-promotions

**Files:**
- Create: `src/hooks/scheduling/use-packages.ts`
- Create: `src/hooks/scheduling/use-promotions.ts`

- [ ] **Criar `src/hooks/scheduling/use-packages.ts`**

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export type PackageService = {
  id: string
  name: string
  duration: number
  price: string
}

export type PackageItem = {
  id: string
  serviceId: string
  service: PackageService
}

export type ServicePackage = {
  id: string
  name: string
  description: string | null
  price: string
  imageUrl: string | null
  active: boolean
  items: PackageItem[]
}

export type CreatePackageInput = {
  name: string
  description?: string
  price: string
  serviceIds: string[]
  imageUrl?: string
}

export type UpdatePackageInput = {
  name?: string
  description?: string
  price?: string
  serviceIds?: string[]
  imageUrl?: string | null
}

async function listPackages(): Promise<ServicePackage[]> {
  const res = await fetch('/api/scheduling/packages')
  if (!res.ok) throw new Error('Falha ao carregar pacotes')
  return res.json()
}

async function createPackage(input: CreatePackageInput): Promise<ServicePackage> {
  const res = await fetch('/api/scheduling/packages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, price: parseFloat(input.price) }),
  })
  if (!res.ok) throw new Error('Falha ao criar pacote')
  return res.json()
}

async function updatePackage({ id, ...input }: UpdatePackageInput & { id: string }): Promise<ServicePackage> {
  const res = await fetch(`/api/scheduling/packages/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...input,
      price: input.price !== undefined ? parseFloat(input.price) : undefined,
    }),
  })
  if (!res.ok) throw new Error('Falha ao atualizar pacote')
  return res.json()
}

async function deactivatePackage(id: string): Promise<void> {
  const res = await fetch(`/api/scheduling/packages/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Falha ao desativar pacote')
}

export function usePackages() {
  return useQuery({ queryKey: ['packages'], queryFn: listPackages, staleTime: 5 * 60 * 1000 })
}

export function useCreatePackage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createPackage,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['packages'] }),
  })
}

export function useUpdatePackage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updatePackage,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['packages'] }),
  })
}

export function useDeactivatePackage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deactivatePackage,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['packages'] }),
  })
}
```

- [ ] **Criar `src/hooks/scheduling/use-promotions.ts`**

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export type PromoItemService = { id: string; name: string; price: string }
export type PromoItemPackage = { id: string; name: string; price: string }

export type PromotionItem = {
  id: string
  serviceId: string | null
  packageId: string | null
  service: PromoItemService | null
  package: PromoItemPackage | null
}

export type Promotion = {
  id: string
  name: string
  description: string | null
  discountType: 'PERCENTAGE' | 'FIXED'
  discountValue: string
  startsAt: string | null
  endsAt: string | null
  active: boolean
  imageUrl: string | null
  expired: boolean
  items: PromotionItem[]
}

export type PromoItemInput = {
  serviceId?: string
  packageId?: string
}

export type CreatePromotionInput = {
  name: string
  description?: string
  discountType: 'PERCENTAGE' | 'FIXED'
  discountValue: string
  startsAt?: string
  endsAt?: string
  imageUrl?: string
  items: PromoItemInput[]
}

export type UpdatePromotionInput = {
  name?: string
  description?: string
  discountType?: 'PERCENTAGE' | 'FIXED'
  discountValue?: string
  startsAt?: string | null
  endsAt?: string | null
  active?: boolean
  imageUrl?: string | null
  items?: PromoItemInput[]
}

async function listPromotions(): Promise<Promotion[]> {
  const res = await fetch('/api/scheduling/promotions')
  if (!res.ok) throw new Error('Falha ao carregar promoções')
  return res.json()
}

async function createPromotion(input: CreatePromotionInput): Promise<Promotion> {
  const res = await fetch('/api/scheduling/promotions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, discountValue: parseFloat(input.discountValue) }),
  })
  if (!res.ok) throw new Error('Falha ao criar promoção')
  return res.json()
}

async function updatePromotion({ id, ...input }: UpdatePromotionInput & { id: string }): Promise<Promotion> {
  const res = await fetch(`/api/scheduling/promotions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...input,
      discountValue: input.discountValue !== undefined ? parseFloat(input.discountValue) : undefined,
    }),
  })
  if (!res.ok) throw new Error('Falha ao atualizar promoção')
  return res.json()
}

async function deactivatePromotion(id: string): Promise<void> {
  const res = await fetch(`/api/scheduling/promotions/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Falha ao desativar promoção')
}

export function usePromotions() {
  return useQuery({ queryKey: ['promotions'], queryFn: listPromotions, staleTime: 5 * 60 * 1000 })
}

export function useCreatePromotion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createPromotion,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['promotions'] }),
  })
}

export function useUpdatePromotion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updatePromotion,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['promotions'] }),
  })
}

export function useDeactivatePromotion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deactivatePromotion,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['promotions'] }),
  })
}
```

- [ ] **Commit**

```bash
git add src/hooks/scheduling/use-packages.ts src/hooks/scheduling/use-promotions.ts
git commit -m "feat(hooks): use-packages e use-promotions com TanStack Query"
```

---

## Task 13: PackageCatalog e PackageFormModal

**Files:**
- Create: `src/components/domain/services/package-catalog.tsx`
- Create: `src/components/domain/services/package-form-modal.tsx`

- [ ] **Criar `src/components/domain/services/package-catalog.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { Edit2, Plus, Power } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { usePackages, useDeactivatePackage, type ServicePackage } from '@/hooks/scheduling/use-packages'
import { PackageFormModal } from './package-form-modal'

export function PackageCatalog() {
  const { data: packages, isLoading, isError, refetch } = usePackages()
  const { mutate: deactivate } = useDeactivatePackage()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPackage, setEditingPackage] = useState<ServicePackage | undefined>()

  function handleEdit(pkg: ServicePackage) {
    setEditingPackage(pkg)
    setModalOpen(true)
  }

  function handleCreate() {
    setEditingPackage(undefined)
    setModalOpen(true)
  }

  function handleDeactivate(pkg: ServicePackage) {
    if (!confirm(`Desativar pacote "${pkg.name}"?`)) return
    deactivate(pkg.id)
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-dashed border-destructive/30 px-6 py-10 text-center">
        <p className="text-sm text-destructive">Erro ao carregar pacotes.</p>
        <Button onClick={() => refetch()} variant="outline" size="sm" className="mt-3">Tentar novamente</Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{packages?.length ?? 0} pacote(s) cadastrado(s)</p>
        <Button onClick={handleCreate} size="sm" className="gap-2">
          <Plus className="size-4" />
          Novo pacote
        </Button>
      </div>

      {packages?.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">Nenhum pacote cadastrado ainda.</p>
          <Button onClick={handleCreate} variant="outline" size="sm" className="mt-3">Criar primeiro pacote</Button>
        </div>
      )}

      {packages && packages.length > 0 && (
        <div className="space-y-2">
          {packages.map((pkg) => (
            <div key={pkg.id} className="flex items-center gap-4 rounded-2xl border border-border/50 bg-card px-4 py-3 shadow-sm">
              {pkg.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pkg.imageUrl} alt={pkg.name} className="size-12 shrink-0 rounded-xl object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-foreground">{pkg.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {pkg.items.length} serviço(s)
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {Number(pkg.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                {pkg.items.length > 0 && (
                  <p className="mt-0.5 text-xs text-muted-foreground/70">
                    {pkg.items.map((i) => i.service.name).join(' + ')}
                  </p>
                )}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => handleEdit(pkg)} className="size-8" title="Editar">
                  <Edit2 className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeactivate(pkg)}
                  className="size-8 text-muted-foreground hover:text-destructive"
                  title="Desativar"
                >
                  <Power className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <PackageFormModal open={modalOpen} onClose={() => setModalOpen(false)} pkg={editingPackage} />
    </div>
  )
}
```

- [ ] **Criar `src/components/domain/services/package-form-modal.tsx`**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { CurrencyInput } from '@/components/ui/currency-input'
import { useServices } from '@/hooks/scheduling/use-services'
import { useCreatePackage, useUpdatePackage, type ServicePackage } from '@/hooks/scheduling/use-packages'

type Props = {
  open: boolean
  onClose: () => void
  pkg?: ServicePackage
}

export function PackageFormModal({ open, onClose, pkg }: Props) {
  const isEditing = !!pkg
  const { data: services } = useServices()
  const { mutate: create, isPending: creating } = useCreatePackage()
  const { mutate: update, isPending: updating } = useUpdatePackage()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])

  useEffect(() => {
    if (open && pkg) {
      setName(pkg.name)
      setDescription(pkg.description ?? '')
      setPrice(Number(pkg.price).toFixed(2))
      setSelectedServiceIds(pkg.items.map((i) => i.serviceId))
    } else if (!open) {
      setName('')
      setDescription('')
      setPrice('')
      setSelectedServiceIds([])
    }
  }, [open, pkg])

  function toggleService(id: string) {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const priceNum = parseFloat(price)
    if (isNaN(priceNum) || priceNum <= 0 || selectedServiceIds.length === 0) return

    if (isEditing) {
      update(
        { id: pkg.id, name: name.trim(), description: description.trim() || undefined, price, serviceIds: selectedServiceIds },
        { onSuccess: onClose },
      )
    } else {
      create(
        { name: name.trim(), description: description.trim() || undefined, price, serviceIds: selectedServiceIds },
        { onSuccess: onClose },
      )
    }
  }

  const isPending = creating || updating

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar pacote' : 'Novo pacote'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="pkg-name">Nome do pacote</Label>
            <Input id="pkg-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Combo Corte + Barba" required minLength={2} maxLength={100} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pkg-description">Descrição (opcional)</Label>
            <Input id="pkg-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva o que está incluído" maxLength={500} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pkg-price">Preço do pacote</Label>
            <CurrencyInput id="pkg-price" value={price} onChange={setPrice} placeholder="R$ 0,00" required />
          </div>

          <div className="space-y-2">
            <Label>Serviços incluídos <span className="text-destructive">*</span></Label>
            {services?.length === 0 && (
              <p className="text-xs text-muted-foreground">Cadastre serviços primeiro.</p>
            )}
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-border p-3">
              {services?.filter((s) => s.active).map((service) => (
                <label key={service.id} className="flex cursor-pointer items-center gap-3">
                  <Checkbox
                    checked={selectedServiceIds.includes(service.id)}
                    onCheckedChange={() => toggleService(service.id)}
                  />
                  <span className="text-sm text-foreground">{service.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {Number(service.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </label>
              ))}
            </div>
            {selectedServiceIds.length === 0 && (
              <p className="text-xs text-destructive">Selecione ao menos 1 serviço.</p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button type="submit" disabled={isPending || selectedServiceIds.length === 0} className="flex-1">
              {isPending ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar pacote'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Commit**

```bash
git add src/components/domain/services/package-catalog.tsx src/components/domain/services/package-form-modal.tsx
git commit -m "feat(ui): PackageCatalog e PackageFormModal"
```

---

## Task 14: PromotionCatalog e PromotionFormModal

**Files:**
- Create: `src/components/domain/services/promotion-catalog.tsx`
- Create: `src/components/domain/services/promotion-form-modal.tsx`

- [ ] **Criar `src/components/domain/services/promotion-catalog.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { Edit2, Plus, Power } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { usePromotions, useDeactivatePromotion, type Promotion } from '@/hooks/scheduling/use-promotions'
import { PromotionFormModal } from './promotion-form-modal'

function PromotionStatusBadge({ promo }: { promo: Promotion }) {
  if (!promo.active) return <Badge variant="secondary" className="text-xs">Inativa</Badge>
  if (promo.expired) return <Badge variant="secondary" className="text-xs text-muted-foreground">Expirada</Badge>
  if (promo.startsAt && new Date(promo.startsAt) > new Date()) {
    return <Badge className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-100">Agendada</Badge>
  }
  return <Badge className="text-xs bg-green-100 text-green-700 hover:bg-green-100">Ativa</Badge>
}

function formatDiscount(promo: Promotion): string {
  if (promo.discountType === 'PERCENTAGE') {
    return `${Number(promo.discountValue).toLocaleString('pt-BR')}% de desconto`
  }
  return `${Number(promo.discountValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} de desconto`
}

export function PromotionCatalog() {
  const { data: promotions, isLoading, isError, refetch } = usePromotions()
  const { mutate: deactivate } = useDeactivatePromotion()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPromotion, setEditingPromotion] = useState<Promotion | undefined>()

  function handleEdit(promo: Promotion) {
    setEditingPromotion(promo)
    setModalOpen(true)
  }

  function handleCreate() {
    setEditingPromotion(undefined)
    setModalOpen(true)
  }

  function handleDeactivate(promo: Promotion) {
    if (!confirm(`Desativar promoção "${promo.name}"?`)) return
    deactivate(promo.id)
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-dashed border-destructive/30 px-6 py-10 text-center">
        <p className="text-sm text-destructive">Erro ao carregar promoções.</p>
        <Button onClick={() => refetch()} variant="outline" size="sm" className="mt-3">Tentar novamente</Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{promotions?.length ?? 0} promoção(ões) cadastrada(s)</p>
        <Button onClick={handleCreate} size="sm" className="gap-2">
          <Plus className="size-4" />
          Nova promoção
        </Button>
      </div>

      {promotions?.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">Nenhuma promoção cadastrada ainda.</p>
          <Button onClick={handleCreate} variant="outline" size="sm" className="mt-3">Criar primeira promoção</Button>
        </div>
      )}

      {promotions && promotions.length > 0 && (
        <div className="space-y-2">
          {promotions.map((promo) => (
            <div key={promo.id} className="flex items-center gap-4 rounded-2xl border border-border/50 bg-card px-4 py-3 shadow-sm">
              {promo.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={promo.imageUrl} alt={promo.name} className="size-12 shrink-0 rounded-xl object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-foreground">{promo.name}</span>
                  <PromotionStatusBadge promo={promo} />
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{formatDiscount(promo)}</p>
                {promo.endsAt && (
                  <p className="mt-0.5 text-xs text-muted-foreground/70">
                    Válida até {new Date(promo.endsAt).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => handleEdit(promo)} className="size-8" title="Editar">
                  <Edit2 className="size-3.5" />
                </Button>
                {promo.active && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeactivate(promo)}
                    className="size-8 text-muted-foreground hover:text-destructive"
                    title="Desativar"
                  >
                    <Power className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <PromotionFormModal open={modalOpen} onClose={() => setModalOpen(false)} promotion={editingPromotion} />
    </div>
  )
}
```

- [ ] **Criar `src/components/domain/services/promotion-form-modal.tsx`**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { CurrencyInput } from '@/components/ui/currency-input'
import { PercentageInput } from '@/components/ui/percentage-input'
import { useServices } from '@/hooks/scheduling/use-services'
import { usePackages } from '@/hooks/scheduling/use-packages'
import {
  useCreatePromotion,
  useUpdatePromotion,
  type Promotion,
  type PromoItemInput,
} from '@/hooks/scheduling/use-promotions'

type Props = {
  open: boolean
  onClose: () => void
  promotion?: Promotion
}

export function PromotionFormModal({ open, onClose, promotion }: Props) {
  const isEditing = !!promotion
  const { data: services } = useServices()
  const { data: packages } = usePackages()
  const { mutate: create, isPending: creating } = useCreatePromotion()
  const { mutate: update, isPending: updating } = useUpdatePromotion()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE')
  const [discountValue, setDiscountValue] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [selectedItems, setSelectedItems] = useState<PromoItemInput[]>([])

  useEffect(() => {
    if (open && promotion) {
      setName(promotion.name)
      setDescription(promotion.description ?? '')
      setDiscountType(promotion.discountType)
      setDiscountValue(Number(promotion.discountValue).toFixed(2))
      setStartsAt(promotion.startsAt ? promotion.startsAt.slice(0, 16) : '')
      setEndsAt(promotion.endsAt ? promotion.endsAt.slice(0, 16) : '')
      setSelectedItems(promotion.items.map((i) => ({ serviceId: i.serviceId ?? undefined, packageId: i.packageId ?? undefined })))
    } else if (!open) {
      setName('')
      setDescription('')
      setDiscountType('PERCENTAGE')
      setDiscountValue('')
      setStartsAt('')
      setEndsAt('')
      setSelectedItems([])
    }
  }, [open, promotion])

  function toggleService(id: string) {
    setSelectedItems((prev) => {
      const exists = prev.some((i) => i.serviceId === id)
      return exists ? prev.filter((i) => i.serviceId !== id) : [...prev, { serviceId: id }]
    })
  }

  function togglePackage(id: string) {
    setSelectedItems((prev) => {
      const exists = prev.some((i) => i.packageId === id)
      return exists ? prev.filter((i) => i.packageId !== id) : [...prev, { packageId: id }]
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const valueNum = parseFloat(discountValue)
    if (isNaN(valueNum) || valueNum <= 0 || selectedItems.length === 0) return

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      discountType,
      discountValue,
      startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
      endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
      items: selectedItems,
    }

    if (isEditing) {
      update({ id: promotion.id, ...payload }, { onSuccess: onClose })
    } else {
      create(payload, { onSuccess: onClose })
    }
  }

  const isPending = creating || updating

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar promoção' : 'Nova promoção'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="promo-name">Nome da promoção</Label>
            <Input id="promo-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Janeiro com desconto" required minLength={2} maxLength={100} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="promo-desc">Descrição (opcional)</Label>
            <Input id="promo-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de desconto</Label>
              <Select value={discountType} onValueChange={(v) => { setDiscountType(v as 'PERCENTAGE' | 'FIXED'); setDiscountValue('') }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENTAGE">Percentual (%)</SelectItem>
                  <SelectItem value="FIXED">Valor fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor do desconto</Label>
              {discountType === 'PERCENTAGE' ? (
                <PercentageInput value={discountValue} onChange={setDiscountValue} required />
              ) : (
                <CurrencyInput value={discountValue} onChange={setDiscountValue} placeholder="R$ 0,00" required />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="promo-starts">Início (opcional)</Label>
              <Input id="promo-starts" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="promo-ends">Validade (opcional)</Label>
              <Input id="promo-ends" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Itens incluídos <span className="text-destructive">*</span></Label>
            <div className="max-h-48 space-y-3 overflow-y-auto rounded-xl border border-border p-3">
              {services && services.filter((s) => s.active).length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Serviços</p>
                  {services.filter((s) => s.active).map((service) => (
                    <label key={service.id} className="flex cursor-pointer items-center gap-3 py-1">
                      <Checkbox
                        checked={selectedItems.some((i) => i.serviceId === service.id)}
                        onCheckedChange={() => toggleService(service.id)}
                      />
                      <span className="text-sm">{service.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {Number(service.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              {packages && packages.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Pacotes</p>
                  {packages.map((pkg) => (
                    <label key={pkg.id} className="flex cursor-pointer items-center gap-3 py-1">
                      <Checkbox
                        checked={selectedItems.some((i) => i.packageId === pkg.id)}
                        onCheckedChange={() => togglePackage(pkg.id)}
                      />
                      <span className="text-sm">{pkg.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {Number(pkg.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            {selectedItems.length === 0 && (
              <p className="text-xs text-destructive">Selecione ao menos 1 item.</p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button type="submit" disabled={isPending || selectedItems.length === 0} className="flex-1">
              {isPending ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar promoção'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Commit**

```bash
git add src/components/domain/services/promotion-catalog.tsx src/components/domain/services/promotion-form-modal.tsx
git commit -m "feat(ui): PromotionCatalog e PromotionFormModal com badges e inputs de desconto"
```

---

## Task 15: Página /servicos

**Files:**
- Create: `src/app/(app)/servicos/page.tsx`

- [ ] **Criar `src/app/(app)/servicos/page.tsx`**

```typescript
'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ServiceCatalog } from '@/components/domain/services/service-catalog'
import { PackageCatalog } from '@/components/domain/services/package-catalog'
import { PromotionCatalog } from '@/components/domain/services/promotion-catalog'

export default function ServicosPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Serviços</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie seus serviços, pacotes e promoções
        </p>
      </div>

      <Tabs defaultValue="servicos">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="servicos">Serviços</TabsTrigger>
          <TabsTrigger value="pacotes">Pacotes</TabsTrigger>
          <TabsTrigger value="promocoes">Promoções</TabsTrigger>
        </TabsList>

        <TabsContent value="servicos" className="mt-6">
          <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-foreground">Catálogo de serviços</h2>
            <ServiceCatalog />
          </div>
        </TabsContent>

        <TabsContent value="pacotes" className="mt-6">
          <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-foreground">Pacotes</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Agrupe serviços em pacotes com preço especial.
            </p>
            <PackageCatalog />
          </div>
        </TabsContent>

        <TabsContent value="promocoes" className="mt-6">
          <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-foreground">Promoções</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Crie descontos temporários para serviços ou pacotes.
            </p>
            <PromotionCatalog />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/app/\(app\)/servicos/
git commit -m "feat(ui): página /servicos com abas Serviços, Pacotes e Promoções"
```

---

## Task 16: Sidebar — adicionar item Serviços

**Files:**
- Modify: `src/components/app/app-shell.tsx`

- [ ] **Adicionar `Scissors` ao import de lucide-react**

No arquivo `src/components/app/app-shell.tsx`, na linha de imports do lucide-react, adicionar `Scissors`:

```typescript
import {
  BarChart2,
  CalendarDays,
  CreditCard,
  LogOut,
  Menu,
  Scissors,
  Settings,
  Users,
  UserCog,
} from 'lucide-react'
```

- [ ] **Adicionar item "Serviços" ao array `NAV_ITEMS`**

Após o item de Agenda e antes de Clientes:

```typescript
const NAV_ITEMS = [
  {
    label: 'Agenda',
    description: 'Atendimentos e encaixes',
    icon: CalendarDays,
    href: '/agenda',
    permission: 'appointments:view',
  },
  {
    label: 'Serviços',
    description: 'Serviços, Pacotes e Promoções',
    icon: Scissors,
    href: '/servicos',
    permission: 'services:view',
  },
  {
    label: 'Clientes',
    description: 'CRM e recorrência',
    icon: Users,
    href: '/clientes',
    permission: 'customers:view',
  },
  // ... resto dos itens mantidos ...
] as const
```

- [ ] **Commit**

```bash
git add src/components/app/app-shell.tsx
git commit -m "feat(ui): adiciona item Serviços ao sidebar entre Agenda e Clientes"
```

---

## Task 17: Remover aba Serviços das Configurações

**Files:**
- Modify: `src/app/(app)/configuracoes/page.tsx`

- [ ] **Remover import de `ServiceCatalog`**

Na linha 8 de `src/app/(app)/configuracoes/page.tsx`, remover:

```typescript
import { ServiceCatalog } from '@/components/domain/settings/service-catalog'
```

- [ ] **Remover `TabsTrigger` e `TabsContent` de Serviços**

Remover `<TabsTrigger value="servicos">Serviços</TabsTrigger>` do `TabsList`.

Remover o bloco:
```typescript
<TabsContent value="servicos" className="mt-6">
  <div className="rounded-2xl border border-white/80 bg-white/85 p-6 shadow-sm">
    <h2 className="mb-4 text-base font-semibold text-slate-950">
      Catálogo de serviços
    </h2>
    <ServiceCatalog />
  </div>
</TabsContent>
```

- [ ] **Atualizar grid-cols de 7 para 6**

```typescript
<TabsList className="grid w-full grid-cols-6 min-w-140">
```

E atualizar a descrição da página:
```typescript
<p className="mt-1 text-sm text-slate-500">
  Gerencie os dados do seu negócio e integrações
</p>
```

- [ ] **Commit**

```bash
git add src/app/\(app\)/configuracoes/page.tsx
git commit -m "feat(ui): remove aba Serviços de /configuracoes (migrado para /servicos)"
```

---

## Task 18: TypeScript — zero erros

**Files:** todos os arquivos modificados/criados

- [ ] **Rodar TypeScript check**

```bash
npx tsc --noEmit
```

Expected: sem erros. Se houver erros, corrija-os antes de prosseguir. Erros comuns:
- Tipo `Checkbox` não encontrado → verificar import de `@/components/ui/checkbox`
- Tipos de `PromoDiscountType` incompatíveis → ajustar cast em `promotion.repository.ts`
- `updateServiceSchema` sem `imageUrl` em `UpdateServiceInput` type → garantir que o type está atualizado

- [ ] **Commit das correções (se houver)**

```bash
git add -A
git commit -m "fix(types): ajustes de tipagem TypeScript"
```

---

## Task 19: Vitest — todos os testes passando

- [ ] **Rodar todos os testes**

```bash
npx vitest run
```

Expected: todos os testes passando (incluindo os novos de PackageRepository e PromotionRepository).

Se algum teste falhar, investigue o erro e corrija antes de prosseguir.

- [ ] **Commit final (se houver correções)**

```bash
git add -A
git commit -m "fix(tests): ajustes para todos os testes passarem"
```

---

## Task 20: PR para main

- [ ] **Push da branch**

```bash
git push -u origin feat/servicos-pacotes-promocoes
```

- [ ] **Abrir Pull Request**

```bash
gh pr create \
  --title "feat: página Serviços com Pacotes e Promoções + CurrencyInput" \
  --body "$(cat <<'EOF'
## Resumo

- Migra Serviços da aba de Configurações para item dedicado no menu lateral
- Cria página `/servicos` com 3 abas: Serviços | Pacotes | Promoções
- Pacotes agrupam serviços com preço próprio
- Promoções aplicam desconto percentual ou fixo, com validade opcional e desativação manual
- Suporte a imagem em Serviços, Pacotes e Promoções (Supabase Storage)
- `CurrencyInput` e `PercentageInput` padronizam todos os campos monetários
- Backend completo: repositórios, service, API routes com `services:view/manage`

## Plano de testes

- [ ] Navegar para `/servicos` via sidebar
- [ ] Criar, editar e desativar um Serviço
- [ ] Criar um Pacote com 2+ serviços — verificar preço livre
- [ ] Criar Promoção com desconto % e com validade — verificar badge "Expirada" após a data
- [ ] Criar Promoção com desconto fixo em R$ — verificar máscara no input
- [ ] Verificar que aba Serviços sumiu de /configuracoes
- [ ] `npx tsc --noEmit` — zero erros
- [ ] `npx vitest run` — todos passando

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: URL do PR criado.

---

## Notas de implementação

- **Enum `PromoDiscountType`**: O schema já tem `DiscountApplyType` (para o model `DiscountType` de descontos de agendamento). O novo enum `PromoDiscountType` é separado e exclusivo para Promoções.
- **`supabaseAdmin`**: O upload usa `supabaseAdmin` (service role key) para bypassar RLS no bucket de storage.
- **`CurrencyInput`**: O valor é armazenado internamente como `string` (ex: `"100.00"`) e convertido para `number` apenas no envio à API (`parseFloat`).
- **Testes de UI**: Os componentes de catálogo têm estados de loading, error e empty — validar manualmente no browser após deploy.
