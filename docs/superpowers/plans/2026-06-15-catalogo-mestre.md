# Catálogo Mestre Multi-Segmento — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar catálogo mestre imutável por segmento (Salão, Barbearia, Nail Design, Estética), com ativação seletiva de itens pelo tenant, wizard de onboarding guiado e página de catálogo em Configurações.

**Architecture:** Novo domínio `src/domains/catalog/` com repositórios e service de ativação idempotente. Tenant ativa itens do catálogo mestre criando cópias isoladas em `Service`/`Product` com referência soft via `catalogServiceId`/`catalogProductId`. Wizard de 4 steps persiste progressão via API antes de avançar de step.

**Tech Stack:** Next.js 15 App Router, Prisma 7 + PostgreSQL, Zod, TanStack Query, Zustand, Shadcn UI, Vitest

---

## Mapa de arquivos

### Criar
- `src/domains/catalog/types.ts` — schemas Zod + tipos TypeScript do domínio catalog
- `src/domains/catalog/catalog-master-service.repository.ts` — leitura do catálogo mestre de serviços
- `src/domains/catalog/catalog-master-product.repository.ts` — leitura do catálogo mestre de produtos
- `src/domains/catalog/catalog.service.ts` — ativação idempotente, saveSegments, completeOnboarding
- `src/domains/catalog/__tests__/catalog.service.test.ts` — testes unitários do service
- `src/app/api/catalog/services/route.ts` — GET listagem de serviços do catálogo
- `src/app/api/catalog/products/route.ts` — GET listagem de produtos do catálogo
- `src/app/api/catalog/services/[id]/activate/route.ts` — POST ativação de serviço
- `src/app/api/catalog/products/[id]/activate/route.ts` — POST ativação de produto
- `src/app/api/onboarding/segments/route.ts` — POST salvar segmentos do tenant
- `src/app/api/onboarding/complete/route.ts` — POST marcar onboarding como concluído
- `prisma/seed-catalog.mjs` — seed mínimo (~5 itens por segmento)
- `src/components/domain/catalog/SegmentSelector.tsx`
- `src/components/domain/catalog/CatalogServiceCard.tsx`
- `src/components/domain/catalog/CatalogProductCard.tsx`
- `src/components/domain/catalog/ActivationBadge.tsx`
- `src/components/domain/catalog/CatalogGrid.tsx`
- `src/components/domain/catalog/WizardStepper.tsx`
- `src/app/(app)/onboarding/page.tsx` — wizard 4-steps
- `src/app/(app)/configuracoes/catalogo/page.tsx` — browsing pós-onboarding

### Modificar
- `prisma/schema.prisma` — novo enum + 4 modelos + campos em Tenant, Service, Product
- `src/shared/errors/domain-error.ts` — adicionar `CatalogItemNotFoundError`
- `src/domains/scheduling/service.repository.ts` — adicionar método `findByCatalogId`
- `src/domains/inventory/product.repository.ts` — adicionar método `findByCatalogId`
- `prisma/seed.mjs` — chamar seed-catalog ao final
- `src/app/(app)/layout.tsx` — redirecionar para /onboarding se `onboardingCompleted === false`

---

## Task 1: Schema Prisma — enum + 4 modelos + campos existentes

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Adicionar enum BusinessSegment após os enums existentes no schema**

Abrir `prisma/schema.prisma`. Localizar o bloco de enums (próximo de `PriceType`, `AnamneseMode`, etc.) e adicionar:

```prisma
enum BusinessSegment {
  HAIR_SALON
  BARBERSHOP
  NAIL_DESIGN
  AESTHETICS
}
```

- [ ] **Step 2: Adicionar campos `segments` e `onboardingCompleted` ao model Tenant**

Dentro do `model Tenant {`, após o campo `dailyStatusEnabled`, adicionar:

```prisma
  segments            BusinessSegment[]  @default([])
  onboardingCompleted Boolean            @default(false)
```

- [ ] **Step 3: Adicionar campo `catalogServiceId` ao model Service**

Dentro do `model Service {`, após o campo `categoryId`, adicionar:

```prisma
  catalogServiceId  String?
```

- [ ] **Step 4: Adicionar campo `catalogProductId` ao model Product**

Dentro do `model Product {`, após o campo `imageUrl`, adicionar:

```prisma
  catalogProductId  String?
```

- [ ] **Step 5: Adicionar os 4 novos modelos ao final do schema**

Ao final do arquivo `prisma/schema.prisma`, antes do último enum ou no final, adicionar:

```prisma
model CatalogServiceCategory {
  id       String            @id @default(cuid())
  slug     String            @unique
  name     String
  segments BusinessSegment[]
  order    Int               @default(0)
  active   Boolean           @default(true)
  services CatalogService[]
}

model CatalogProductCategory {
  id       String            @id @default(cuid())
  slug     String            @unique
  name     String
  segments BusinessSegment[]
  order    Int               @default(0)
  active   Boolean           @default(true)
  products CatalogProduct[]
}

model CatalogService {
  id                String                  @id @default(cuid())
  slug              String                  @unique
  name              String
  description       String?
  imageUrl          String?
  segments          BusinessSegment[]
  categoryId        String?
  category          CatalogServiceCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  suggestedDuration Int
  suggestedPrice    Decimal                 @db.Decimal(10, 2)
  priceType         PriceType               @default(FIXED)
  active            Boolean                 @default(true)
  order             Int                     @default(0)
  metadata          Json?
  createdAt         DateTime                @default(now())
  updatedAt         DateTime                @updatedAt

  @@index([active])
}

model CatalogProduct {
  id             String                 @id @default(cuid())
  slug           String                 @unique
  name           String
  description    String?
  imageUrl       String?
  segments       BusinessSegment[]
  categoryId     String?
  category       CatalogProductCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  suggestedPrice Decimal                @db.Decimal(10, 2)
  active         Boolean                @default(true)
  order          Int                    @default(0)
  metadata       Json?
  createdAt      DateTime               @default(now())
  updatedAt      DateTime               @updatedAt

  @@index([active])
}
```

- [ ] **Step 6: Gerar e aplicar a migration**

```bash
npx prisma migrate dev --name "add_catalog_master_and_segments"
```

Saída esperada: `Your database is now in sync with your schema.`

- [ ] **Step 7: Verificar que o Prisma Client foi regenerado**

```bash
npx prisma generate
```

Saída esperada: `Generated Prisma Client ...`

- [ ] **Step 8: Verificar tipos TypeScript**

```bash
npx tsc --noEmit
```

Saída esperada: zero erros.

- [ ] **Step 9: Commit**

```bash
git add prisma/
git commit -m "feat(catalog): migration — enum BusinessSegment, modelos CatalogService/Product, campos tenant+service+product"
```

---

## Task 2: Erros de domínio e types.ts

**Files:**
- Modify: `src/shared/errors/domain-error.ts`
- Create: `src/domains/catalog/types.ts`

- [ ] **Step 1: Adicionar CatalogItemNotFoundError ao arquivo de erros**

Em `src/shared/errors/domain-error.ts`, ao final do arquivo, adicionar:

```typescript
// --- Catalog ---

export class CatalogItemNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Item de catálogo não encontrado: "${id}".`, 'CATALOG_ITEM_NOT_FOUND', 404, { id })
  }
}
```

- [ ] **Step 2: Criar src/domains/catalog/types.ts**

```typescript
import { z } from 'zod'
import { BusinessSegment } from '@prisma/client'

export const listCatalogServicesSchema = z.object({
  segments:   z.array(z.nativeEnum(BusinessSegment)).optional(),
  categoryId: z.string().cuid().optional(),
  name:       z.string().trim().optional(),
  page:       z.coerce.number().int().min(1).default(1),
  pageSize:   z.coerce.number().int().min(1).max(100).default(20),
})
export type ListCatalogServicesQuery = z.infer<typeof listCatalogServicesSchema>

export const listCatalogProductsSchema = z.object({
  segments:   z.array(z.nativeEnum(BusinessSegment)).optional(),
  categoryId: z.string().cuid().optional(),
  name:       z.string().trim().optional(),
  page:       z.coerce.number().int().min(1).default(1),
  pageSize:   z.coerce.number().int().min(1).max(100).default(20),
})
export type ListCatalogProductsQuery = z.infer<typeof listCatalogProductsSchema>

export const saveSegmentsSchema = z.object({
  segments: z.array(z.nativeEnum(BusinessSegment)).min(1, 'Selecione ao menos um segmento.'),
})
export type SaveSegmentsInput = z.infer<typeof saveSegmentsSchema>

// Shape esperado em metadata.variations (não enforçado pelo banco)
export type CatalogServiceVariation = {
  label: string
  suggestedDuration: number
  suggestedPrice: number
}

export type CatalogServiceMetadata = {
  tags?: string[]
  difficulty?: 'basico' | 'intermediario' | 'avancado'
  variations?: CatalogServiceVariation[]
  aiTips?: string
}

export type CatalogProductMetadata = {
  tags?: string[]
  brand?: string
  yield?: string
  composition?: string
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Saída esperada: zero erros.

- [ ] **Step 4: Commit**

```bash
git add src/shared/errors/domain-error.ts src/domains/catalog/types.ts
git commit -m "feat(catalog): CatalogItemNotFoundError e types Zod do domínio catalog"
```

---

## Task 3: Repositórios do catálogo mestre

**Files:**
- Create: `src/domains/catalog/catalog-master-service.repository.ts`
- Create: `src/domains/catalog/catalog-master-product.repository.ts`

- [ ] **Step 1: Criar catalog-master-service.repository.ts**

```typescript
import { prisma } from '@/shared/database/prisma'
import type { ListCatalogServicesQuery } from './types'

export class CatalogMasterServiceRepository {
  async list(query: ListCatalogServicesQuery) {
    const { segments, categoryId, name, page = 1, pageSize = 20 } = query

    const items = await prisma.catalogService.findMany({
      where: {
        active: true,
        ...(segments?.length && { segments: { hasSome: segments } }),
        ...(categoryId && { categoryId }),
        ...(name && { name: { contains: name, mode: 'insensitive' } }),
      },
      include: { category: true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    })

    const total = await prisma.catalogService.count({
      where: {
        active: true,
        ...(segments?.length && { segments: { hasSome: segments } }),
        ...(categoryId && { categoryId }),
        ...(name && { name: { contains: name, mode: 'insensitive' } }),
      },
    })

    return { data: items, total, page, pageSize }
  }

  async findById(id: string) {
    return prisma.catalogService.findUnique({
      where: { id },
      include: { category: true },
    })
  }

  async listCategories(segments?: string[]) {
    return prisma.catalogServiceCategory.findMany({
      where: {
        active: true,
        ...(segments?.length && { segments: { hasSome: segments as any } }),
      },
      orderBy: { order: 'asc' },
    })
  }
}

export const catalogMasterServiceRepository = new CatalogMasterServiceRepository()
```

- [ ] **Step 2: Criar catalog-master-product.repository.ts**

```typescript
import { prisma } from '@/shared/database/prisma'
import type { ListCatalogProductsQuery } from './types'

export class CatalogMasterProductRepository {
  async list(query: ListCatalogProductsQuery) {
    const { segments, categoryId, name, page = 1, pageSize = 20 } = query

    const items = await prisma.catalogProduct.findMany({
      where: {
        active: true,
        ...(segments?.length && { segments: { hasSome: segments } }),
        ...(categoryId && { categoryId }),
        ...(name && { name: { contains: name, mode: 'insensitive' } }),
      },
      include: { category: true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    })

    const total = await prisma.catalogProduct.count({
      where: {
        active: true,
        ...(segments?.length && { segments: { hasSome: segments } }),
        ...(categoryId && { categoryId }),
        ...(name && { name: { contains: name, mode: 'insensitive' } }),
      },
    })

    return { data: items, total, page, pageSize }
  }

  async findById(id: string) {
    return prisma.catalogProduct.findUnique({
      where: { id },
      include: { category: true },
    })
  }

  async listCategories(segments?: string[]) {
    return prisma.catalogProductCategory.findMany({
      where: {
        active: true,
        ...(segments?.length && { segments: { hasSome: segments as any } }),
      },
      orderBy: { order: 'asc' },
    })
  }
}

export const catalogMasterProductRepository = new CatalogMasterProductRepository()
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/domains/catalog/
git commit -m "feat(catalog): repositórios de leitura do catálogo mestre"
```

---

## Task 4: Adicionar findByCatalogId nos repositórios existentes

**Files:**
- Modify: `src/domains/scheduling/service.repository.ts`
- Modify: `src/domains/inventory/product.repository.ts`

- [ ] **Step 1: Adicionar findByCatalogId ao ServiceRepository (scheduling)**

Em `src/domains/scheduling/service.repository.ts`, dentro da classe `CatalogServiceRepository`, adicionar após o método `findById`:

```typescript
  async findByCatalogId(tenantId: string, catalogServiceId: string) {
    return prisma.service.findFirst({
      where: { tenantId, catalogServiceId },
    })
  }
```

- [ ] **Step 2: Adicionar findByCatalogId ao ProductRepository (inventory)**

Em `src/domains/inventory/product.repository.ts`, dentro da classe `ProductRepository`, adicionar após o método `findById`:

```typescript
  async findByCatalogId(tenantId: string, catalogProductId: string) {
    return prisma.product.findFirst({
      where: { tenantId, catalogProductId, active: true },
    })
  }
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/domains/scheduling/service.repository.ts src/domains/inventory/product.repository.ts
git commit -m "feat(catalog): adiciona findByCatalogId nos repositórios de service e product"
```

---

## Task 5: catalog.service.ts — ativação idempotente

**Files:**
- Create: `src/domains/catalog/catalog.service.ts`

- [ ] **Step 1: Criar o service**

```typescript
import { BusinessSegment, Prisma } from '@prisma/client'
import { prisma } from '@/shared/database/prisma'
import { CatalogItemNotFoundError } from '@/shared/errors'
import { catalogMasterServiceRepository } from './catalog-master-service.repository'
import { catalogMasterProductRepository } from './catalog-master-product.repository'
import { catalogServiceRepository } from '@/domains/scheduling/service.repository'
import { productRepository } from '@/domains/inventory/product.repository'
import type { SaveSegmentsInput } from './types'

export class CatalogDomainService {
  async listServices(query: Parameters<typeof catalogMasterServiceRepository.list>[0]) {
    return catalogMasterServiceRepository.list(query)
  }

  async listProducts(query: Parameters<typeof catalogMasterProductRepository.list>[0]) {
    return catalogMasterProductRepository.list(query)
  }

  async listServiceCategories(segments?: string[]) {
    return catalogMasterServiceRepository.listCategories(segments)
  }

  async listProductCategories(segments?: string[]) {
    return catalogMasterProductRepository.listCategories(segments)
  }

  async activateService(tenantId: string, catalogServiceId: string) {
    const catalogItem = await catalogMasterServiceRepository.findById(catalogServiceId)
    if (!catalogItem) throw new CatalogItemNotFoundError(catalogServiceId)

    const existing = await catalogServiceRepository.findByCatalogId(tenantId, catalogServiceId)
    if (existing) return existing

    return catalogServiceRepository.create(tenantId, {
      name:             catalogItem.name,
      description:      catalogItem.description ?? undefined,
      imageUrl:         catalogItem.imageUrl ?? undefined,
      duration:         catalogItem.suggestedDuration,
      price:            catalogItem.suggestedPrice,
      priceType:        catalogItem.priceType,
      catalogServiceId: catalogItem.id,
      active:           true,
    })
  }

  async activateProduct(tenantId: string, catalogProductId: string) {
    const catalogItem = await catalogMasterProductRepository.findById(catalogProductId)
    if (!catalogItem) throw new CatalogItemNotFoundError(catalogProductId)

    const existing = await productRepository.findByCatalogId(tenantId, catalogProductId)
    if (existing) return existing

    return prisma.product.create({
      data: {
        tenantId,
        name:            catalogItem.name,
        imageUrl:        catalogItem.imageUrl ?? undefined,
        costPrice:       new Prisma.Decimal(0),
        salePrice:       catalogItem.suggestedPrice,
        catalogProductId: catalogItem.id,
        active:           true,
      },
      include: { category: true },
    })
  }

  async saveSegments(tenantId: string, input: SaveSegmentsInput) {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { segments: input.segments },
    })
  }

  async completeOnboarding(tenantId: string) {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { onboardingCompleted: true },
    })
  }

  async getTenantSegments(tenantId: string): Promise<BusinessSegment[]> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { segments: true },
    })
    return tenant?.segments ?? []
  }
}

export const catalogDomainService = new CatalogDomainService()
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/domains/catalog/catalog.service.ts
git commit -m "feat(catalog): service de ativação idempotente com saveSegments e completeOnboarding"
```

---

## Task 6: Testes unitários do CatalogDomainService

**Files:**
- Create: `src/domains/catalog/__tests__/catalog.service.test.ts`

- [ ] **Step 1: Criar os mocks necessários**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CatalogDomainService } from '../catalog.service'
import { CatalogItemNotFoundError } from '@/shared/errors'

vi.mock('../catalog-master-service.repository', () => ({
  catalogMasterServiceRepository: {
    findById: vi.fn(),
    list: vi.fn(),
    listCategories: vi.fn(),
  },
}))

vi.mock('../catalog-master-product.repository', () => ({
  catalogMasterProductRepository: {
    findById: vi.fn(),
    list: vi.fn(),
    listCategories: vi.fn(),
  },
}))

vi.mock('@/domains/scheduling/service.repository', () => ({
  catalogServiceRepository: {
    findByCatalogId: vi.fn(),
    create: vi.fn(),
  },
}))

vi.mock('@/domains/inventory/product.repository', () => ({
  productRepository: {
    findByCatalogId: vi.fn(),
  },
}))

vi.mock('@/shared/database/prisma', () => ({
  prisma: {
    product: { create: vi.fn() },
    tenant: { update: vi.fn(), findUnique: vi.fn() },
  },
}))

import { catalogMasterServiceRepository } from '../catalog-master-service.repository'
import { catalogMasterProductRepository } from '../catalog-master-product.repository'
import { catalogServiceRepository } from '@/domains/scheduling/service.repository'
import { productRepository } from '@/domains/inventory/product.repository'
import { prisma } from '@/shared/database/prisma'
import { Prisma } from '@prisma/client'

const service = new CatalogDomainService()
beforeEach(() => vi.clearAllMocks())
```

- [ ] **Step 2: Escrever testes de activateService**

```typescript
describe('activateService', () => {
  const catalogItem = {
    id: 'catalog-svc-1',
    name: 'Corte Feminino',
    description: 'Corte profissional',
    imageUrl: null,
    suggestedDuration: 60,
    suggestedPrice: new Prisma.Decimal('80.00'),
    priceType: 'FIXED' as const,
  }

  it('lança CatalogItemNotFoundError quando item não existe no catálogo', async () => {
    vi.mocked(catalogMasterServiceRepository.findById).mockResolvedValue(null)

    await expect(
      service.activateService('t1', 'catalog-svc-1')
    ).rejects.toBeInstanceOf(CatalogItemNotFoundError)
  })

  it('retorna instância existente sem criar duplicata (idempotência)', async () => {
    vi.mocked(catalogMasterServiceRepository.findById).mockResolvedValue(catalogItem as any)
    const existingService = { id: 'svc-tenant-1', name: 'Corte Feminino' }
    vi.mocked(catalogServiceRepository.findByCatalogId).mockResolvedValue(existingService as any)

    const result = await service.activateService('t1', 'catalog-svc-1')

    expect(result).toBe(existingService)
    expect(catalogServiceRepository.create).not.toHaveBeenCalled()
  })

  it('cria Service do tenant quando item ainda não foi ativado', async () => {
    vi.mocked(catalogMasterServiceRepository.findById).mockResolvedValue(catalogItem as any)
    vi.mocked(catalogServiceRepository.findByCatalogId).mockResolvedValue(null)
    const created = { id: 'svc-new', name: 'Corte Feminino', catalogServiceId: 'catalog-svc-1' }
    vi.mocked(catalogServiceRepository.create).mockResolvedValue(created as any)

    const result = await service.activateService('t1', 'catalog-svc-1')

    expect(catalogServiceRepository.create).toHaveBeenCalledWith('t1', expect.objectContaining({
      name: 'Corte Feminino',
      duration: 60,
      catalogServiceId: 'catalog-svc-1',
    }))
    expect(result).toBe(created)
  })
})
```

- [ ] **Step 3: Escrever testes de activateProduct**

```typescript
describe('activateProduct', () => {
  const catalogProduct = {
    id: 'catalog-prod-1',
    name: 'Shampoo Profissional',
    imageUrl: null,
    suggestedPrice: new Prisma.Decimal('35.00'),
  }

  it('lança CatalogItemNotFoundError quando produto não existe no catálogo', async () => {
    vi.mocked(catalogMasterProductRepository.findById).mockResolvedValue(null)

    await expect(
      service.activateProduct('t1', 'catalog-prod-1')
    ).rejects.toBeInstanceOf(CatalogItemNotFoundError)
  })

  it('retorna instância existente sem criar duplicata (idempotência)', async () => {
    vi.mocked(catalogMasterProductRepository.findById).mockResolvedValue(catalogProduct as any)
    const existingProduct = { id: 'prod-tenant-1', name: 'Shampoo' }
    vi.mocked(productRepository.findByCatalogId).mockResolvedValue(existingProduct as any)

    const result = await service.activateProduct('t1', 'catalog-prod-1')

    expect(result).toBe(existingProduct)
    expect(prisma.product.create).not.toHaveBeenCalled()
  })

  it('cria Product do tenant quando item ainda não foi ativado', async () => {
    vi.mocked(catalogMasterProductRepository.findById).mockResolvedValue(catalogProduct as any)
    vi.mocked(productRepository.findByCatalogId).mockResolvedValue(null)
    const created = { id: 'prod-new', name: 'Shampoo', catalogProductId: 'catalog-prod-1' }
    vi.mocked(prisma.product.create).mockResolvedValue(created as any)

    await service.activateProduct('t1', 'catalog-prod-1')

    expect(prisma.product.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenantId: 't1',
        name: 'Shampoo Profissional',
        catalogProductId: 'catalog-prod-1',
      }),
    }))
  })
})

describe('saveSegments', () => {
  it('atualiza segments do tenant', async () => {
    vi.mocked(prisma.tenant.update).mockResolvedValue({} as any)

    await service.saveSegments('t1', { segments: ['HAIR_SALON', 'BARBERSHOP'] })

    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { segments: ['HAIR_SALON', 'BARBERSHOP'] },
    })
  })
})

describe('completeOnboarding', () => {
  it('marca onboardingCompleted como true', async () => {
    vi.mocked(prisma.tenant.update).mockResolvedValue({} as any)

    await service.completeOnboarding('t1')

    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { onboardingCompleted: true },
    })
  })
})
```

- [ ] **Step 4: Rodar os testes**

```bash
npx vitest run src/domains/catalog/__tests__/catalog.service.test.ts
```

Saída esperada: todos os testes passando.

- [ ] **Step 5: Commit**

```bash
git add src/domains/catalog/__tests__/
git commit -m "test(catalog): testes unitários do CatalogDomainService"
```

---

## Task 7: API Routes — listagem do catálogo

**Files:**
- Create: `src/app/api/catalog/services/route.ts`
- Create: `src/app/api/catalog/products/route.ts`

- [ ] **Step 1: Criar GET /api/catalog/services**

```typescript
// src/app/api/catalog/services/route.ts
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { catalogDomainService } from '@/domains/catalog/catalog.service'
import { listCatalogServicesSchema } from '@/domains/catalog/types'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    const url = new URL(request.url)

    // segments pode vir como múltiplos query params: ?segments=HAIR_SALON&segments=BARBERSHOP
    const rawSegments = url.searchParams.getAll('segments')
    const params = Object.fromEntries(url.searchParams)
    const query = listCatalogServicesSchema.parse({
      ...params,
      segments: rawSegments.length ? rawSegments : undefined,
    })

    const result = await catalogDomainService.listServices(query)
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 2: Criar GET /api/catalog/products**

```typescript
// src/app/api/catalog/products/route.ts
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { catalogDomainService } from '@/domains/catalog/catalog.service'
import { listCatalogProductsSchema } from '@/domains/catalog/types'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    const url = new URL(request.url)

    const rawSegments = url.searchParams.getAll('segments')
    const params = Object.fromEntries(url.searchParams)
    const query = listCatalogProductsSchema.parse({
      ...params,
      segments: rawSegments.length ? rawSegments : undefined,
    })

    const result = await catalogDomainService.listProducts(query)
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/catalog/
git commit -m "feat(catalog): API routes GET /api/catalog/services e /api/catalog/products"
```

---

## Task 8: API Routes — ativação de itens

**Files:**
- Create: `src/app/api/catalog/services/[id]/activate/route.ts`
- Create: `src/app/api/catalog/products/[id]/activate/route.ts`

- [ ] **Step 1: Criar POST /api/catalog/services/[id]/activate**

```typescript
// src/app/api/catalog/services/[id]/activate/route.ts
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { catalogDomainService } from '@/domains/catalog/catalog.service'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    const { id } = await params
    const result = await catalogDomainService.activateService(session.tenantId, id)
    return Response.json(result, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 2: Criar POST /api/catalog/products/[id]/activate**

```typescript
// src/app/api/catalog/products/[id]/activate/route.ts
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { catalogDomainService } from '@/domains/catalog/catalog.service'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    const { id } = await params
    const result = await catalogDomainService.activateProduct(session.tenantId, id)
    return Response.json(result, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/catalog/
git commit -m "feat(catalog): API routes POST activate para serviços e produtos do catálogo"
```

---

## Task 9: API Routes — onboarding

**Files:**
- Create: `src/app/api/onboarding/segments/route.ts`
- Create: `src/app/api/onboarding/complete/route.ts`

- [ ] **Step 1: Criar POST /api/onboarding/segments**

```typescript
// src/app/api/onboarding/segments/route.ts
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { catalogDomainService } from '@/domains/catalog/catalog.service'
import { saveSegmentsSchema } from '@/domains/catalog/types'

export async function POST(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    const input = await validateInput(request, saveSegmentsSchema)
    await catalogDomainService.saveSegments(session.tenantId, input)
    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 2: Criar POST /api/onboarding/complete**

```typescript
// src/app/api/onboarding/complete/route.ts
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { catalogDomainService } from '@/domains/catalog/catalog.service'

export async function POST(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    await catalogDomainService.completeOnboarding(session.tenantId)
    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/onboarding/
git commit -m "feat(catalog): API routes POST /api/onboarding/segments e /api/onboarding/complete"
```

---

## Task 10: Seed mínimo do catálogo

**Files:**
- Create: `prisma/seed-catalog.mjs`
- Modify: `prisma/seed.mjs`

- [ ] **Step 1: Criar prisma/seed-catalog.mjs**

```javascript
// prisma/seed-catalog.mjs
export async function seedCatalog(prisma) {
  // Categorias de serviço
  const serviceCategories = [
    { slug: 'corte', name: 'Corte', segments: ['HAIR_SALON', 'BARBERSHOP'] },
    { slug: 'coloracao', name: 'Coloração', segments: ['HAIR_SALON'] },
    { slug: 'tratamento', name: 'Tratamento', segments: ['HAIR_SALON'] },
    { slug: 'barba', name: 'Barba', segments: ['BARBERSHOP'] },
    { slug: 'unhas', name: 'Unhas', segments: ['NAIL_DESIGN'] },
    { slug: 'estetica-facial', name: 'Estética Facial', segments: ['AESTHETICS'] },
    { slug: 'estetica-corporal', name: 'Estética Corporal', segments: ['AESTHETICS'] },
  ]

  for (const cat of serviceCategories) {
    await prisma.catalogServiceCategory.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, segments: cat.segments },
      create: cat,
    })
  }

  // Categorias de produto
  const productCategories = [
    { slug: 'produtos-cabelo', name: 'Cabelo', segments: ['HAIR_SALON'] },
    { slug: 'produtos-barba', name: 'Barba', segments: ['BARBERSHOP'] },
    { slug: 'produtos-unhas', name: 'Unhas', segments: ['NAIL_DESIGN'] },
    { slug: 'produtos-estetica', name: 'Estética', segments: ['AESTHETICS'] },
  ]

  for (const cat of productCategories) {
    await prisma.catalogProductCategory.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, segments: cat.segments },
      create: cat,
    })
  }

  // Buscar IDs das categorias criadas
  const svcCats = Object.fromEntries(
    (await prisma.catalogServiceCategory.findMany()).map(c => [c.slug, c.id])
  )
  const prdCats = Object.fromEntries(
    (await prisma.catalogProductCategory.findMany()).map(c => [c.id, c.id])
  )
  const prdCatsBySlug = Object.fromEntries(
    (await prisma.catalogProductCategory.findMany()).map(c => [c.slug, c.id])
  )

  // Serviços do catálogo (~5 por segmento)
  const services = [
    // HAIR_SALON
    { slug: 'corte-feminino', name: 'Corte Feminino', description: 'Corte profissional com acabamento e finalização.', segments: ['HAIR_SALON'], categoryId: svcCats['corte'], suggestedDuration: 60, suggestedPrice: 80, priceType: 'STARTING_FROM', order: 1 },
    { slug: 'escova-progressiva', name: 'Escova Progressiva', description: 'Alisamento com produto profissional de longa duração.', segments: ['HAIR_SALON'], categoryId: svcCats['coloracao'], suggestedDuration: 120, suggestedPrice: 180, priceType: 'STARTING_FROM', order: 2 },
    { slug: 'coloracao-completa', name: 'Coloração Completa', description: 'Tintura completa com produtos de alta performance.', segments: ['HAIR_SALON'], categoryId: svcCats['coloracao'], suggestedDuration: 90, suggestedPrice: 150, priceType: 'STARTING_FROM', order: 3 },
    { slug: 'mechas-luzes', name: 'Mechas / Luzes', description: 'Técnica de iluminação com papel alumínio ou touca.', segments: ['HAIR_SALON'], categoryId: svcCats['coloracao'], suggestedDuration: 150, suggestedPrice: 200, priceType: 'STARTING_FROM', order: 4 },
    { slug: 'hidratacao-capilar', name: 'Hidratação Capilar', description: 'Tratamento intensivo de hidratação e nutrição dos fios.', segments: ['HAIR_SALON'], categoryId: svcCats['tratamento'], suggestedDuration: 60, suggestedPrice: 90, priceType: 'FIXED', order: 5 },
    // BARBERSHOP
    { slug: 'corte-masculino', name: 'Corte Masculino', description: 'Corte com máquina e tesoura, acabamento caprichado.', segments: ['BARBERSHOP'], categoryId: svcCats['corte'], suggestedDuration: 45, suggestedPrice: 50, priceType: 'FIXED', order: 1 },
    { slug: 'barba-completa', name: 'Barba Completa', description: 'Aparar, modelar e hidratar a barba com navalha.', segments: ['BARBERSHOP'], categoryId: svcCats['barba'], suggestedDuration: 30, suggestedPrice: 35, priceType: 'FIXED', order: 2 },
    { slug: 'corte-barba', name: 'Corte + Barba', description: 'Combo completo de corte masculino e barba.', segments: ['BARBERSHOP'], categoryId: svcCats['corte'], suggestedDuration: 60, suggestedPrice: 70, priceType: 'FIXED', order: 3 },
    { slug: 'pigmentacao-barba', name: 'Pigmentação de Barba', description: 'Cobertura de fios brancos com pigmento profissional.', segments: ['BARBERSHOP'], categoryId: svcCats['barba'], suggestedDuration: 30, suggestedPrice: 40, priceType: 'FIXED', order: 4 },
    { slug: 'design-sobrancelha-masc', name: 'Design de Sobrancelha', description: 'Modelagem masculina de sobrancelhas com pinça e linha.', segments: ['BARBERSHOP'], categoryId: svcCats['barba'], suggestedDuration: 20, suggestedPrice: 25, priceType: 'FIXED', order: 5 },
    // NAIL_DESIGN
    { slug: 'manicure', name: 'Manicure', description: 'Cuidado completo das unhas das mãos com esmaltação.', segments: ['NAIL_DESIGN'], categoryId: svcCats['unhas'], suggestedDuration: 60, suggestedPrice: 45, priceType: 'FIXED', order: 1 },
    { slug: 'pedicure', name: 'Pedicure', description: 'Cuidado completo das unhas dos pés com esmaltação.', segments: ['NAIL_DESIGN'], categoryId: svcCats['unhas'], suggestedDuration: 60, suggestedPrice: 55, priceType: 'FIXED', order: 2 },
    { slug: 'gel-unhas', name: 'Unhas em Gel', description: 'Alongamento e reforço com gel UV de longa duração.', segments: ['NAIL_DESIGN'], categoryId: svcCats['unhas'], suggestedDuration: 90, suggestedPrice: 120, priceType: 'STARTING_FROM', order: 3 },
    { slug: 'fibra-vidro', name: 'Fibra de Vidro', description: 'Alongamento resistente com fibra de vidro e gel.', segments: ['NAIL_DESIGN'], categoryId: svcCats['unhas'], suggestedDuration: 90, suggestedPrice: 130, priceType: 'STARTING_FROM', order: 4 },
    { slug: 'nail-art', name: 'Nail Art', description: 'Arte decorativa personalizada nas unhas.', segments: ['NAIL_DESIGN'], categoryId: svcCats['unhas'], suggestedDuration: 30, suggestedPrice: 30, priceType: 'STARTING_FROM', order: 5 },
    // AESTHETICS
    { slug: 'limpeza-pele', name: 'Limpeza de Pele', description: 'Higienização profunda com extração e hidratação final.', segments: ['AESTHETICS'], categoryId: svcCats['estetica-facial'], suggestedDuration: 60, suggestedPrice: 120, priceType: 'FIXED', order: 1 },
    { slug: 'peeling-facial', name: 'Peeling Facial', description: 'Renovação celular com ácidos de grau estético.', segments: ['AESTHETICS'], categoryId: svcCats['estetica-facial'], suggestedDuration: 45, suggestedPrice: 150, priceType: 'STARTING_FROM', order: 2 },
    { slug: 'massagem-relaxante', name: 'Massagem Relaxante', description: 'Massagem corporal com técnicas de relaxamento profundo.', segments: ['AESTHETICS'], categoryId: svcCats['estetica-corporal'], suggestedDuration: 60, suggestedPrice: 130, priceType: 'FIXED', order: 3 },
    { slug: 'design-sobrancelha-fem', name: 'Design de Sobrancelha', description: 'Modelagem feminina com henna e definição de arco.', segments: ['AESTHETICS'], categoryId: svcCats['estetica-facial'], suggestedDuration: 30, suggestedPrice: 50, priceType: 'FIXED', order: 4 },
    { slug: 'lifting-cilios', name: 'Lifting de Cílios', description: 'Curvatura e coloração dos cílios com efeito duradouro.', segments: ['AESTHETICS'], categoryId: svcCats['estetica-facial'], suggestedDuration: 60, suggestedPrice: 110, priceType: 'FIXED', order: 5 },
  ]

  for (const svc of services) {
    await prisma.catalogService.upsert({
      where: { slug: svc.slug },
      update: { name: svc.name, description: svc.description, suggestedPrice: svc.suggestedPrice, suggestedDuration: svc.suggestedDuration },
      create: { ...svc, suggestedPrice: svc.suggestedPrice },
    })
  }

  // Produtos do catálogo (~5 por segmento)
  const products = [
    // HAIR_SALON
    { slug: 'shampoo-profissional', name: 'Shampoo Profissional', description: 'Shampoo de limpeza profunda para uso profissional.', segments: ['HAIR_SALON'], categoryId: prdCatsBySlug['produtos-cabelo'], suggestedPrice: 45, order: 1 },
    { slug: 'condicionador-profissional', name: 'Condicionador Profissional', description: 'Condicionador hidratante de uso profissional.', segments: ['HAIR_SALON'], categoryId: prdCatsBySlug['produtos-cabelo'], suggestedPrice: 45, order: 2 },
    { slug: 'mascara-capilar', name: 'Máscara Capilar', description: 'Máscara de nutrição e reconstrução dos fios.', segments: ['HAIR_SALON'], categoryId: prdCatsBySlug['produtos-cabelo'], suggestedPrice: 60, order: 3 },
    { slug: 'tinta-capilar', name: 'Tinta Capilar', description: 'Tinta profissional de alta cobertura e fixação.', segments: ['HAIR_SALON'], categoryId: prdCatsBySlug['produtos-cabelo'], suggestedPrice: 30, order: 4 },
    { slug: 'progressiva-profissional', name: 'Progressiva Profissional', description: 'Produto de alisamento profissional de longa duração.', segments: ['HAIR_SALON'], categoryId: prdCatsBySlug['produtos-cabelo'], suggestedPrice: 90, order: 5 },
    // BARBERSHOP
    { slug: 'pomada-capilar', name: 'Pomada Capilar', description: 'Pomada de fixação média para finalização masculina.', segments: ['BARBERSHOP'], categoryId: prdCatsBySlug['produtos-barba'], suggestedPrice: 35, order: 1 },
    { slug: 'oleo-barba', name: 'Óleo de Barba', description: 'Óleo hidratante e amolecedor para barba.', segments: ['BARBERSHOP'], categoryId: prdCatsBySlug['produtos-barba'], suggestedPrice: 40, order: 2 },
    { slug: 'shampoo-masculino', name: 'Shampoo Masculino', description: 'Shampoo de uso frequente para cabelos masculinos.', segments: ['BARBERSHOP'], categoryId: prdCatsBySlug['produtos-barba'], suggestedPrice: 28, order: 3 },
    { slug: 'cera-capilar', name: 'Cera Capilar', description: 'Cera de fixação forte para penteados masculinos.', segments: ['BARBERSHOP'], categoryId: prdCatsBySlug['produtos-barba'], suggestedPrice: 32, order: 4 },
    { slug: 'pos-barba', name: 'Pós-Barba', description: 'Loção hidratante e calmante para uso após barbeação.', segments: ['BARBERSHOP'], categoryId: prdCatsBySlug['produtos-barba'], suggestedPrice: 38, order: 5 },
    // NAIL_DESIGN
    { slug: 'esmalte-base', name: 'Base Coat', description: 'Base protetora para unhas antes da esmaltação.', segments: ['NAIL_DESIGN'], categoryId: prdCatsBySlug['produtos-unhas'], suggestedPrice: 18, order: 1 },
    { slug: 'esmalte-colorido', name: 'Esmalte Colorido', description: 'Esmalte de longa duração em diversas cores.', segments: ['NAIL_DESIGN'], categoryId: prdCatsBySlug['produtos-unhas'], suggestedPrice: 15, order: 2 },
    { slug: 'top-coat', name: 'Top Coat', description: 'Selante de acabamento brilhante e longa duração.', segments: ['NAIL_DESIGN'], categoryId: prdCatsBySlug['produtos-unhas'], suggestedPrice: 20, order: 3 },
    { slug: 'gel-uv', name: 'Gel UV', description: 'Gel de alongamento e reforço para uso com cabine UV.', segments: ['NAIL_DESIGN'], categoryId: prdCatsBySlug['produtos-unhas'], suggestedPrice: 85, order: 4 },
    { slug: 'removedor-unhas', name: 'Removedor de Esmalte', description: 'Removedor sem acetona para proteção das unhas.', segments: ['NAIL_DESIGN'], categoryId: prdCatsBySlug['produtos-unhas'], suggestedPrice: 12, order: 5 },
    // AESTHETICS
    { slug: 'sabonete-facial', name: 'Sabonete Facial', description: 'Sabonete de limpeza para pele facial sensível.', segments: ['AESTHETICS'], categoryId: prdCatsBySlug['produtos-estetica'], suggestedPrice: 35, order: 1 },
    { slug: 'acido-glicolico', name: 'Ácido Glicólico', description: 'Ácido para peeling químico e renovação celular.', segments: ['AESTHETICS'], categoryId: prdCatsBySlug['produtos-estetica'], suggestedPrice: 70, order: 2 },
    { slug: 'creme-hidratante-facial', name: 'Creme Hidratante Facial', description: 'Creme de hidratação profunda para finalização.', segments: ['AESTHETICS'], categoryId: prdCatsBySlug['produtos-estetica'], suggestedPrice: 55, order: 3 },
    { slug: 'henna-sobrancelha', name: 'Henna para Sobrancelha', description: 'Henna de coloração e preenchimento de sobrancelhas.', segments: ['AESTHETICS'], categoryId: prdCatsBySlug['produtos-estetica'], suggestedPrice: 45, order: 4 },
    { slug: 'cola-cilios', name: 'Cola de Cílios', description: 'Cola profissional para aplicação de cílios e lifting.', segments: ['AESTHETICS'], categoryId: prdCatsBySlug['produtos-estetica'], suggestedPrice: 30, order: 5 },
  ]

  for (const prd of products) {
    await prisma.catalogProduct.upsert({
      where: { slug: prd.slug },
      update: { name: prd.name, description: prd.description, suggestedPrice: prd.suggestedPrice },
      create: { ...prd, suggestedPrice: prd.suggestedPrice },
    })
  }

  console.log('✅ Seed do catálogo mestre concluído: 20 serviços + 20 produtos')
}
```

- [ ] **Step 2: Importar seedCatalog no seed.mjs principal**

Em `prisma/seed.mjs`, no final da função `main()`, antes do `prisma.$disconnect()`, adicionar:

```javascript
import { seedCatalog } from './seed-catalog.mjs'

// ... no final da função main():
await seedCatalog(prisma)
```

Verificar que o import está no topo do arquivo junto com os demais.

- [ ] **Step 3: Rodar o seed**

```bash
node prisma/seed.mjs
```

Saída esperada: `✅ Seed do catálogo mestre concluído: 20 serviços + 20 produtos`

- [ ] **Step 4: Verificar no banco**

```bash
npx prisma studio
```

Confirmar que `CatalogService` e `CatalogProduct` têm 20 registros cada.

- [ ] **Step 5: Commit**

```bash
git add prisma/seed-catalog.mjs prisma/seed.mjs
git commit -m "feat(catalog): seed mínimo com 20 serviços e 20 produtos por segmento"
```

---

## Task 11: Componentes base do catálogo

**Files:**
- Create: `src/components/domain/catalog/ActivationBadge.tsx`
- Create: `src/components/domain/catalog/CatalogServiceCard.tsx`
- Create: `src/components/domain/catalog/CatalogProductCard.tsx`
- Create: `src/components/domain/catalog/WizardStepper.tsx`

- [ ] **Step 1: Criar ActivationBadge.tsx**

```tsx
// src/components/domain/catalog/ActivationBadge.tsx
import { CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface ActivationBadgeProps {
  tenantItemId?: string   // se definido, item já foi ativado
  tenantItemPath?: string // link para o item do tenant (ex: /servicos/id)
}

export function ActivationBadge({ tenantItemId, tenantItemPath }: ActivationBadgeProps) {
  if (!tenantItemId) return null

  return (
    <Badge variant="secondary" className="gap-1 text-xs">
      <CheckCircle2 className="h-3 w-3 text-green-600" />
      Ativo
    </Badge>
  )
}
```

- [ ] **Step 2: Criar CatalogServiceCard.tsx**

```tsx
// src/components/domain/catalog/CatalogServiceCard.tsx
'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Clock, DollarSign, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ActivationBadge } from './ActivationBadge'

interface CatalogServiceCardProps {
  id: string
  name: string
  description?: string | null
  imageUrl?: string | null
  suggestedDuration: number
  suggestedPrice: string | number
  priceType: string
  isActivated: boolean
  activatingId: string | null
  onActivate: (id: string) => void
  showCheckbox?: boolean
}

function formatPrice(price: string | number, priceType: string) {
  const value = Number(price)
  const formatted = value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  return priceType === 'STARTING_FROM' ? `A partir de ${formatted}` : formatted
}

export function CatalogServiceCard({
  id, name, description, imageUrl, suggestedDuration, suggestedPrice,
  priceType, isActivated, activatingId, onActivate, showCheckbox = false,
}: CatalogServiceCardProps) {
  const isLoading = activatingId === id

  return (
    <Card className={`relative transition-all ${isActivated ? 'ring-2 ring-green-500/40' : 'hover:shadow-md'}`}>
      {imageUrl && (
        <div className="relative h-32 w-full overflow-hidden rounded-t-lg">
          <Image src={imageUrl} alt={name} fill className="object-cover" />
        </div>
      )}
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-sm leading-tight">{name}</h3>
          <ActivationBadge tenantItemId={isActivated ? id : undefined} />
        </div>

        {description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
        )}

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {suggestedDuration}min
          </span>
          <span className="flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            {formatPrice(suggestedPrice, priceType)}
          </span>
        </div>

        {!isActivated && (
          showCheckbox ? (
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id={`svc-${id}`}
                checked={false}
                onCheckedChange={() => onActivate(id)}
                disabled={isLoading}
              />
              <label htmlFor={`svc-${id}`} className="text-xs cursor-pointer">
                {isLoading ? 'Ativando...' : 'Ativar este serviço'}
              </label>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="w-full mt-1"
              disabled={isLoading}
              onClick={() => onActivate(id)}
            >
              {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Ativar'}
            </Button>
          )
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Criar CatalogProductCard.tsx**

```tsx
// src/components/domain/catalog/CatalogProductCard.tsx
'use client'

import Image from 'next/image'
import { DollarSign, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ActivationBadge } from './ActivationBadge'

interface CatalogProductCardProps {
  id: string
  name: string
  description?: string | null
  imageUrl?: string | null
  suggestedPrice: string | number
  isActivated: boolean
  activatingId: string | null
  onActivate: (id: string) => void
}

export function CatalogProductCard({
  id, name, description, imageUrl, suggestedPrice,
  isActivated, activatingId, onActivate,
}: CatalogProductCardProps) {
  const isLoading = activatingId === id

  return (
    <Card className={`relative transition-all ${isActivated ? 'ring-2 ring-green-500/40' : 'hover:shadow-md'}`}>
      {imageUrl && (
        <div className="relative h-28 w-full overflow-hidden rounded-t-lg">
          <Image src={imageUrl} alt={name} fill className="object-cover" />
        </div>
      )}
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-sm leading-tight">{name}</h3>
          <ActivationBadge tenantItemId={isActivated ? id : undefined} />
        </div>

        {description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
        )}

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <DollarSign className="h-3 w-3" />
          {Number(suggestedPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </div>

        {!isActivated && (
          <Button
            size="sm"
            variant="outline"
            className="w-full mt-1"
            disabled={isLoading}
            onClick={() => onActivate(id)}
          >
            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Ativar'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Criar WizardStepper.tsx**

```tsx
// src/components/domain/catalog/WizardStepper.tsx
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Step {
  label: string
}

interface WizardStepperProps {
  steps: Step[]
  currentStep: number  // 0-indexed
}

export function WizardStepper({ steps, currentStep }: WizardStepperProps) {
  return (
    <div className="flex items-center gap-0 w-full max-w-lg mx-auto">
      {steps.map((step, index) => {
        const isCompleted = index < currentStep
        const isActive = index === currentStep

        return (
          <div key={index} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-medium transition-colors',
                isCompleted && 'border-primary bg-primary text-primary-foreground',
                isActive && 'border-primary bg-background text-primary',
                !isCompleted && !isActive && 'border-muted-foreground/30 text-muted-foreground',
              )}>
                {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span className={cn(
                'mt-1 text-xs whitespace-nowrap',
                isActive ? 'text-primary font-medium' : 'text-muted-foreground',
              )}>
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className={cn(
                'h-0.5 flex-1 mx-2 mb-4 transition-colors',
                isCompleted ? 'bg-primary' : 'bg-muted-foreground/20',
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/components/domain/catalog/
git commit -m "feat(catalog): componentes ActivationBadge, CatalogServiceCard, CatalogProductCard e WizardStepper"
```

---

## Task 12: Componente CatalogGrid

**Files:**
- Create: `src/components/domain/catalog/CatalogGrid.tsx`

- [ ] **Step 1: Criar CatalogGrid.tsx**

```tsx
// src/components/domain/catalog/CatalogGrid.tsx
'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { CatalogServiceCard } from './CatalogServiceCard'
import { CatalogProductCard } from './CatalogProductCard'
import { useDebounce } from '@/lib/hooks/use-debounce'

type Mode = 'services' | 'products'

interface CatalogGridProps {
  segments: string[]
  mode: Mode
  activatedIds: Set<string>
  onActivated?: (id: string) => void
  showActivateAll?: boolean
}

async function fetchCatalogServices(segments: string[], categoryId?: string, name?: string) {
  const params = new URLSearchParams()
  segments.forEach(s => params.append('segments', s))
  if (categoryId) params.set('categoryId', categoryId)
  if (name) params.set('name', name)
  params.set('pageSize', '100')

  const res = await fetch(`/api/catalog/services?${params}`)
  if (!res.ok) throw new Error('Erro ao carregar serviços do catálogo')
  return res.json()
}

async function fetchCatalogProducts(segments: string[], categoryId?: string, name?: string) {
  const params = new URLSearchParams()
  segments.forEach(s => params.append('segments', s))
  if (categoryId) params.set('categoryId', categoryId)
  if (name) params.set('name', name)
  params.set('pageSize', '100')

  const res = await fetch(`/api/catalog/products?${params}`)
  if (!res.ok) throw new Error('Erro ao carregar produtos do catálogo')
  return res.json()
}

async function activateCatalogService(id: string) {
  const res = await fetch(`/api/catalog/services/${id}/activate`, { method: 'POST' })
  if (!res.ok) throw new Error('Erro ao ativar serviço')
  return res.json()
}

async function activateCatalogProduct(id: string) {
  const res = await fetch(`/api/catalog/products/${id}/activate`, { method: 'POST' })
  if (!res.ok) throw new Error('Erro ao ativar produto')
  return res.json()
}

export function CatalogGrid({
  segments, mode, activatedIds, onActivated, showActivateAll = false,
}: CatalogGridProps) {
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<string | undefined>()
  const [activatingId, setActivatingId] = useState<string | null>(null)
  const debouncedSearch = useDebounce(search, 300)
  const queryClient = useQueryClient()

  const isServices = mode === 'services'

  const { data, isLoading } = useQuery({
    queryKey: isServices
      ? ['catalog-services', segments, categoryId, debouncedSearch]
      : ['catalog-products', segments, categoryId, debouncedSearch],
    queryFn: isServices
      ? () => fetchCatalogServices(segments, categoryId, debouncedSearch || undefined)
      : () => fetchCatalogProducts(segments, categoryId, debouncedSearch || undefined),
    staleTime: Infinity,
    enabled: segments.length > 0,
  })

  const activateMutation = useMutation({
    mutationFn: isServices ? activateCatalogService : activateCatalogProduct,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['services'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      onActivated?.(id)
      setActivatingId(null)
    },
    onError: () => setActivatingId(null),
  })

  const handleActivate = useCallback((id: string) => {
    if (activatingId) return
    setActivatingId(id)
    activateMutation.mutate(id)
  }, [activatingId, activateMutation])

  const handleActivateAll = useCallback(() => {
    if (!data?.data) return
    const notActivated = data.data.filter((item: any) => !activatedIds.has(item.id))
    for (const item of notActivated) {
      activateMutation.mutate(item.id)
    }
  }, [data, activatedIds, activateMutation])

  const items = data?.data ?? []
  const categories: { id: string; name: string }[] = []
  const seenCats = new Set<string>()
  for (const item of items) {
    if (item.category && !seenCats.has(item.category.id)) {
      categories.push(item.category)
      seenCats.add(item.category.id)
    }
  }

  const filteredItems = categoryId
    ? items.filter((item: any) => item.categoryId === categoryId)
    : items

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={isServices ? 'Buscar serviço...' : 'Buscar produto...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {showActivateAll && items.some((item: any) => !activatedIds.has(item.id)) && (
          <Button variant="outline" size="sm" onClick={handleActivateAll}>
            Ativar todos
          </Button>
        )}
      </div>

      {categories.length > 1 && (
        <Tabs value={categoryId ?? 'all'} onValueChange={v => setCategoryId(v === 'all' ? undefined : v)}>
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="all">Todos</TabsTrigger>
            {categories.map(cat => (
              <TabsTrigger key={cat.id} value={cat.id}>{cat.name}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Nenhum item encontrado para os filtros selecionados.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item: any) =>
            isServices ? (
              <CatalogServiceCard
                key={item.id}
                {...item}
                isActivated={activatedIds.has(item.id)}
                activatingId={activatingId}
                onActivate={handleActivate}
              />
            ) : (
              <CatalogProductCard
                key={item.id}
                {...item}
                isActivated={activatedIds.has(item.id)}
                activatingId={activatingId}
                onActivate={handleActivate}
              />
            )
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar se o hook useDebounce existe; criar se necessário**

```bash
# Verificar
ls src/lib/hooks/ 2>/dev/null
```

Se `use-debounce.ts` não existir, criar `src/lib/hooks/use-debounce.ts`:

```typescript
import { useState, useEffect } from 'react'

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/domain/catalog/ src/lib/hooks/
git commit -m "feat(catalog): componente CatalogGrid com busca, tabs e ativação otimista"
```

---

## Task 13: Componente SegmentSelector

**Files:**
- Create: `src/components/domain/catalog/SegmentSelector.tsx`

- [ ] **Step 1: Criar SegmentSelector.tsx**

```tsx
// src/components/domain/catalog/SegmentSelector.tsx
'use client'

import { Scissors, User2, Sparkles, Palette } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SegmentOption = {
  value: string
  label: string
  description: string
  example: string
  Icon: React.ElementType
}

export const SEGMENT_OPTIONS: SegmentOption[] = [
  {
    value: 'HAIR_SALON',
    label: 'Salão de Beleza',
    description: 'Serviços de cabelo',
    example: 'Ex: Corte, Coloração, Escova',
    Icon: Scissors,
  },
  {
    value: 'BARBERSHOP',
    label: 'Barbearia',
    description: 'Corte masculino e barba',
    example: 'Ex: Corte, Barba, Pigmentação',
    Icon: User2,
  },
  {
    value: 'NAIL_DESIGN',
    label: 'Nail Design',
    description: 'Unhas e manicure',
    example: 'Ex: Manicure, Gel, Nail Art',
    Icon: Sparkles,
  },
  {
    value: 'AESTHETICS',
    label: 'Estética',
    description: 'Tratamentos faciais e corporais',
    example: 'Ex: Limpeza de Pele, Massagem',
    Icon: Palette,
  },
]

interface SegmentSelectorProps {
  selected: string[]
  onChange: (segments: string[]) => void
}

export function SegmentSelector({ selected, onChange }: SegmentSelectorProps) {
  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter(s => s !== value))
    } else {
      onChange([...selected, value])
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {SEGMENT_OPTIONS.map(({ value, label, description, example, Icon }) => {
        const isSelected = selected.includes(value)
        return (
          <button
            key={value}
            type="button"
            onClick={() => toggle(value)}
            className={cn(
              'flex items-start gap-4 rounded-xl border-2 p-5 text-left transition-all',
              isSelected
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border hover:border-primary/40 hover:bg-muted/30',
            )}
          >
            <div className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
              isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
            )}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="space-y-0.5">
              <p className="font-semibold text-sm">{label}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
              <p className="text-xs text-muted-foreground/70">{example}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/catalog/SegmentSelector.tsx
git commit -m "feat(catalog): componente SegmentSelector com cards multi-select por segmento"
```

---

## Task 14: Página de onboarding (wizard 4-steps)

**Files:**
- Create: `src/app/(app)/onboarding/page.tsx`

- [ ] **Step 1: Criar a página do wizard**

```tsx
// src/app/(app)/onboarding/page.tsx
'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WizardStepper } from '@/components/domain/catalog/WizardStepper'
import { SegmentSelector } from '@/components/domain/catalog/SegmentSelector'
import { CatalogGrid } from '@/components/domain/catalog/CatalogGrid'

const STEPS = [
  { label: 'Seu negócio' },
  { label: 'Serviços' },
  { label: 'Produtos' },
  { label: 'Pronto!' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [segments, setSegments] = useState<string[]>([])
  const [activatedServiceIds, setActivatedServiceIds] = useState(new Set<string>())
  const [activatedProductIds, setActivatedProductIds] = useState(new Set<string>())
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSegmentsContinue = useCallback(async () => {
    if (segments.length === 0) return
    setIsSubmitting(true)
    try {
      await fetch('/api/onboarding/segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segments }),
      })
      setStep(1)
    } finally {
      setIsSubmitting(false)
    }
  }, [segments])

  const handleComplete = useCallback(async () => {
    setIsSubmitting(true)
    try {
      await fetch('/api/onboarding/complete', { method: 'POST' })
      router.push('/agenda')
    } finally {
      setIsSubmitting(false)
    }
  }, [router])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 container max-w-3xl mx-auto py-10 px-4 space-y-8">
        <WizardStepper steps={STEPS} currentStep={step} />

        {step === 0 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold">Qual tipo de serviço você oferece?</h1>
              <p className="text-muted-foreground mt-1">
                Selecione um ou mais segmentos. Isso define quais serviços e produtos aparecem para você.
              </p>
            </div>
            <SegmentSelector selected={segments} onChange={setSegments} />
            <Button
              className="w-full"
              disabled={segments.length === 0 || isSubmitting}
              onClick={handleSegmentsContinue}
            >
              {isSubmitting ? 'Salvando...' : 'Continuar'}
            </Button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold">Quais serviços você oferece?</h1>
              <p className="text-muted-foreground mt-1">
                Ative os serviços que fazem parte do seu cardápio. Você pode adicionar mais depois em Configurações.
              </p>
            </div>
            <CatalogGrid
              segments={segments}
              mode="services"
              activatedIds={activatedServiceIds}
              onActivated={id => setActivatedServiceIds(prev => new Set([...prev, id]))}
              showActivateAll
            />
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
                Pular
              </Button>
              <Button className="flex-1" onClick={() => setStep(2)}>
                Continuar ({activatedServiceIds.size} ativados)
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold">Produtos que você usa?</h1>
              <p className="text-muted-foreground mt-1">
                Controle seu estoque de insumos. Você pode adicionar depois em Configurações → Catálogo.
              </p>
            </div>
            <CatalogGrid
              segments={segments}
              mode="products"
              activatedIds={activatedProductIds}
              onActivated={id => setActivatedProductIds(prev => new Set([...prev, id]))}
            />
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(3)}>
                Pular
              </Button>
              <Button className="flex-1" onClick={() => setStep(3)}>
                Continuar ({activatedProductIds.size} ativados)
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            <div>
              <h1 className="text-2xl font-bold">Tudo pronto!</h1>
              <p className="text-muted-foreground mt-2">
                Seu negócio foi configurado com {activatedServiceIds.size} serviço(s) e{' '}
                {activatedProductIds.size} produto(s) ativados.
              </p>
            </div>
            <div className="space-y-3">
              <Button className="w-full" disabled={isSubmitting} onClick={handleComplete}>
                {isSubmitting ? 'Entrando...' : 'Ir para a Agenda'}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => router.push('/configuracoes/catalogo')}>
                Configurar mais itens
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/onboarding/"
git commit -m "feat(catalog): wizard de onboarding 4-steps com segmentos, serviços e produtos"
```

---

## Task 15: Página Configurações → Catálogo

**Files:**
- Create: `src/app/(app)/configuracoes/catalogo/page.tsx`

- [ ] **Step 1: Criar a página de configurações do catálogo**

```tsx
// src/app/(app)/configuracoes/catalogo/page.tsx
'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CatalogGrid } from '@/components/domain/catalog/CatalogGrid'
import { Loader2 } from 'lucide-react'

async function fetchTenantSegments(): Promise<string[]> {
  const res = await fetch('/api/onboarding/segments')
  if (!res.ok) return []
  const data = await res.json()
  return data.segments ?? []
}

export default function CatalogSettingsPage() {
  const [activatedServiceIds] = useState(new Set<string>())
  const [activatedProductIds] = useState(new Set<string>())

  const { data: segments = [], isLoading } = useQuery({
    queryKey: ['tenant-segments'],
    queryFn: fetchTenantSegments,
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container max-w-5xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Catálogo</h1>
        <p className="text-muted-foreground mt-1">
          Ative serviços e produtos do catálogo de referência para o seu negócio.
        </p>
      </div>

      <Tabs defaultValue="services">
        <TabsList>
          <TabsTrigger value="services">Serviços</TabsTrigger>
          <TabsTrigger value="products">Produtos</TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="mt-6">
          <CatalogGrid
            segments={segments}
            mode="services"
            activatedIds={activatedServiceIds}
          />
        </TabsContent>

        <TabsContent value="products" className="mt-6">
          <CatalogGrid
            segments={segments}
            mode="products"
            activatedIds={activatedProductIds}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 2: Adicionar rota GET /api/onboarding/segments para leitura**

Em `src/app/api/onboarding/segments/route.ts`, adicionar o método GET:

```typescript
export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    const segments = await catalogDomainService.getTenantSegments(session.tenantId)
    return Response.json({ segments })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/configuracoes/catalogo/" src/app/api/onboarding/segments/route.ts
git commit -m "feat(catalog): página Configurações > Catálogo com tabs serviços e produtos"
```

---

## Task 16: Redirecionamento automático por onboardingCompleted

**Files:**
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Adicionar lógica de redirecionamento no AppLayout**

Em `src/app/(app)/layout.tsx`, importar `redirect` do Next.js e consultar `onboardingCompleted` do tenant. Adicionar após o bloco existente de `if (tenantId)`:

```typescript
import { redirect } from 'next/navigation'
// ... imports existentes ...

// Dentro de AppLayout, após buscar o tenant:
// Checar se rota atual é /onboarding
const { headers } = await import('next/headers')
const headersList = await headers()
const pathname = headersList.get('x-pathname') ?? ''

if (tenantId) {
  const [config, tenant] = await Promise.all([
    getBrandingCached(tenantId),
    getTenantCached(tenantId),
  ])

  // Redirecionar para onboarding se não completou
  if (tenant && !tenant.onboardingCompleted && !pathname.startsWith('/onboarding')) {
    redirect('/onboarding')
  }

  // Se já completou e está tentando acessar /onboarding, redirecionar para agenda
  if (tenant?.onboardingCompleted && pathname.startsWith('/onboarding')) {
    redirect('/agenda')
  }

  // ... resto do código existente ...
}
```

- [ ] **Step 2: Expor o pathname via middleware**

Verificar se existe `middleware.ts` na raiz do projeto:

```bash
ls middleware.ts 2>/dev/null || ls src/middleware.ts 2>/dev/null
```

Se não existir, criar `middleware.ts` na raiz:

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  response.headers.set('x-pathname', request.nextUrl.pathname)
  return response
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
```

Se já existir middleware, adicionar apenas a linha que expõe o pathname:
```typescript
response.headers.set('x-pathname', request.nextUrl.pathname)
```

- [ ] **Step 3: Atualizar iamRepository.findTenant para incluir onboardingCompleted**

Verificar que `iamRepository.findTenant` retorna o campo `onboardingCompleted`:

```bash
grep -n "findTenant\|onboardingCompleted" src/domains/iam/iam.repository.ts | head -10
```

Se `onboardingCompleted` não estiver no select, adicionar ao select da query:
```typescript
select: {
  // ... campos existentes ...
  onboardingCompleted: true,
  segments: true,
}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/app/ middleware.ts src/domains/iam/
git commit -m "feat(catalog): redirecionamento automático para /onboarding baseado em onboardingCompleted"
```

---

## Task 17: Verificação final e testes completos

- [ ] **Step 1: Rodar todos os testes**

```bash
npx vitest run
```

Saída esperada: todos passando.

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Saída esperada: zero erros.

- [ ] **Step 3: Rodar o seed e verificar**

```bash
node prisma/seed.mjs
```

Verificar no Prisma Studio ou banco que:
- `CatalogService` tem 20 registros
- `CatalogProduct` tem 20 registros
- `CatalogServiceCategory` tem 7 registros
- `CatalogProductCategory` tem 4 registros

```bash
npx prisma studio
```

- [ ] **Step 4: Commit final**

```bash
git add .
git commit -m "chore(catalog): verificação final — todos os testes passando e seed validado"
```

---

## Self-Review do Plano

**Cobertura do spec:**
- ✅ Migration com enum + 4 modelos + campos Tenant/Service/Product (Task 1)
- ✅ Erro tipado CatalogItemNotFoundError (Task 2)
- ✅ Types Zod para listagem e segmentos (Task 2)
- ✅ Repositórios de leitura do catálogo (Task 3)
- ✅ findByCatalogId nos repos existentes (Task 4)
- ✅ Ativação idempotente de serviço e produto (Task 5)
- ✅ Testes unitários de activateService, activateProduct, saveSegments, completeOnboarding (Task 6)
- ✅ GET /api/catalog/services + /api/catalog/products (Task 7)
- ✅ POST /api/catalog/services/:id/activate + products (Task 8)
- ✅ POST /api/onboarding/segments + /complete + GET segments (Tasks 9 + 15)
- ✅ Seed mínimo 20 serviços + 20 produtos (Task 10)
- ✅ CatalogServiceCard, CatalogProductCard, ActivationBadge, WizardStepper (Task 11)
- ✅ CatalogGrid com busca, tabs, ativação otimista (Task 12)
- ✅ SegmentSelector com 4 cards multi-select (Task 13)
- ✅ Wizard 4-steps /onboarding (Task 14)
- ✅ Página /configuracoes/catalogo (Task 15)
- ✅ Redirecionamento onboardingCompleted (Task 16)

**Consistência de tipos:**
- `catalogDomainService` exportado como singleton — usado em todas as API routes ✅
- `catalogMasterServiceRepository.findById` retorna `CatalogService | null` — checado em activateService ✅
- `catalogServiceRepository.findByCatalogId` adicionado na Task 4 antes de ser usado na Task 5 ✅
- `segments` como `BusinessSegment[]` — consistente entre schema, types e componentes ✅

**Sem placeholders:** Nenhum TBD ou "implementar depois" no plano. ✅
