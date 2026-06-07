# Service Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar categorias de serviços, descrição, imagem, preço "a partir de", tempo HH:MM no cadastro e reformular o fluxo de seleção de serviço (público e interno) com scroll horizontal de categorias.

**Architecture:** Abordagem A mínima — novo model `ServiceCategory`, campos `description`/`categoryId` em `Service`, enum `STARTING_FROM`. `duration` permanece `Int` (minutos) no banco; conversão HH:MM só no frontend. Componente `ServicePickerWithCategories` compartilhado entre booking público e agenda interna.

**Tech Stack:** Next.js 15 App Router, Prisma, TypeScript strict, TanStack Query, Shadcn UI, Zod, Vitest + vitest-mock-extended.

---

## Mapa de arquivos

| Arquivo | Ação |
|---------|------|
| `prisma/schema.prisma` | Modificar — novo model, campos, enum |
| `src/domains/scheduling/types.ts` | Modificar — schemas Zod atualizados |
| `src/domains/scheduling/service.repository.ts` | Modificar — include category, novos campos |
| `src/domains/scheduling/service-category.repository.ts` | Criar |
| `src/domains/scheduling/scheduling.service.ts` | Modificar — novos campos em createService/updateService |
| `src/domains/scheduling/__tests__/service-category.repository.test.ts` | Criar |
| `src/app/api/scheduling/service-categories/route.ts` | Criar |
| `src/app/api/scheduling/service-categories/[id]/route.ts` | Criar |
| `src/app/api/scheduling/services/route.ts` | Modificar — novos campos |
| `src/app/api/scheduling/services/[id]/route.ts` | Modificar — novos campos |
| `src/domains/scheduling/public-booking.repository.ts` | Modificar — retorna novos campos |
| `src/app/(public)/agendar/[slug]/types.ts` | Modificar — PublicService atualizado |
| `src/hooks/scheduling/use-service-categories.ts` | Criar |
| `src/hooks/scheduling/use-services.ts` | Modificar — tipos atualizados |
| `src/lib/format-duration.ts` | Criar — formatDuration, minutesToHHMM, hhmmToMinutes |
| `src/components/ui/image-upload-field.tsx` | Criar |
| `src/components/domain/services/service-form-modal.tsx` | Modificar — novos campos |
| `src/components/domain/services/service-catalog.tsx` | Modificar — badge categoria, preço contextual |
| `src/components/domain/services/category-form-modal.tsx` | Criar |
| `src/components/domain/services/category-catalog.tsx` | Criar |
| `src/app/(app)/servicos/page.tsx` | Modificar — 4ª aba Categorias |
| `src/components/domain/booking/service-picker-with-categories.tsx` | Criar |
| `src/components/domain/booking/service-step.tsx` | Modificar — usa ServicePickerWithCategories |
| `src/app/(public)/agendar/[slug]/booking-client.tsx` | Modificar — label STARTING_FROM |
| `src/components/domain/scheduling/create-appointment-modal.tsx` | Modificar — ServicePickerWithCategories |

---

## Task 1: Branch git

**Files:**
- (nenhum arquivo modificado)

- [ ] **Step 1: Criar branch**
```bash
git checkout -b feat/service-categories
```

- [ ] **Step 2: Verificar que está na branch correta**
```bash
git branch --show-current
```
Expected: `feat/service-categories`

---

## Task 2: Prisma schema + migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Adicionar `STARTING_FROM` ao enum `PriceType`**

Em `prisma/schema.prisma`, localizar:
```prisma
enum PriceType {
  FIXED
  RANGE
  ON_CONSULTATION
}
```
Substituir por:
```prisma
enum PriceType {
  FIXED
  STARTING_FROM
  RANGE
  ON_CONSULTATION
}
```

- [ ] **Step 2: Adicionar model `ServiceCategory`**

Logo antes do model `Service` (linha ~334), inserir:
```prisma
model ServiceCategory {
  id        String    @id @default(cuid())
  tenantId  String
  name      String
  order     Int       @default(0)
  active    Boolean   @default(true)
  tenant    Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  services  Service[]

  @@index([tenantId])
}
```

- [ ] **Step 3: Adicionar relation em `Tenant`**

No model `Tenant`, adicionar na seção de relations:
```prisma
  serviceCategories ServiceCategory[]
```

- [ ] **Step 4: Atualizar model `Service`**

No model `Service`, adicionar após o campo `imageUrl`:
```prisma
  description  String?
  categoryId   String?
  category     ServiceCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
```

E adicionar índice composto (após `@@index([tenantId])`):
```prisma
  @@index([tenantId, categoryId])
```

- [ ] **Step 5: Gerar e aplicar migration**
```bash
cd c:/dev/estetica-saas
npx prisma migrate dev --name add_service_categories
```
Expected: migration criada e aplicada com sucesso, sem erros.

- [ ] **Step 6: Regenerar Prisma Client**
```bash
npx prisma generate
```
Expected: `✔ Generated Prisma Client`

- [ ] **Step 7: Verificar TypeScript do schema**
```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 8: Commit**
```bash
git add prisma/
git commit -m "feat(db): ServiceCategory, description/categoryId em Service, enum STARTING_FROM"
```

---

## Task 3: ServiceCategoryRepository + testes

**Files:**
- Create: `src/domains/scheduling/service-category.repository.ts`
- Create: `src/domains/scheduling/__tests__/service-category.repository.test.ts`

- [ ] **Step 1: Escrever os testes (TDD — falharão até o repository existir)**

Criar `src/domains/scheduling/__tests__/service-category.repository.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from '@/shared/test/prisma-mock'

vi.mock('@/shared/database/prisma', () => ({ prisma: prismaMock }))

import { ServiceCategoryRepository } from '../service-category.repository'
import { ConflictError } from '@/shared/errors'

const TENANT = 'tenant-1'

describe('ServiceCategoryRepository', () => {
  let repo: ServiceCategoryRepository

  beforeEach(() => {
    repo = new ServiceCategoryRepository()
  })

  describe('list', () => {
    it('retorna categorias ativas ordenadas por order', async () => {
      const cats = [
        { id: 'cat-1', tenantId: TENANT, name: 'Alisamentos', order: 0, active: true },
        { id: 'cat-2', tenantId: TENANT, name: 'Coloração', order: 1, active: true },
      ]
      prismaMock.serviceCategory.findMany.mockResolvedValue(cats as any)

      const result = await repo.list(TENANT)

      expect(prismaMock.serviceCategory.findMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT, active: true },
        orderBy: { order: 'asc' },
      })
      expect(result).toEqual(cats)
    })
  })

  describe('create', () => {
    it('cria categoria com tenantId', async () => {
      const created = { id: 'cat-1', tenantId: TENANT, name: 'Alisamentos', order: 0, active: true }
      prismaMock.serviceCategory.create.mockResolvedValue(created as any)

      const result = await repo.create(TENANT, { name: 'Alisamentos' })

      expect(prismaMock.serviceCategory.create).toHaveBeenCalledWith({
        data: { tenantId: TENANT, name: 'Alisamentos' },
      })
      expect(result).toEqual(created)
    })
  })

  describe('update', () => {
    it('atualiza nome e order', async () => {
      const updated = { id: 'cat-1', tenantId: TENANT, name: 'Novo Nome', order: 2, active: true }
      prismaMock.serviceCategory.update.mockResolvedValue(updated as any)

      const result = await repo.update(TENANT, 'cat-1', { name: 'Novo Nome', order: 2 })

      expect(prismaMock.serviceCategory.update).toHaveBeenCalledWith({
        where: { id: 'cat-1', tenantId: TENANT },
        data: { name: 'Novo Nome', order: 2 },
      })
      expect(result).toEqual(updated)
    })
  })

  describe('delete', () => {
    it('lança ConflictError se categoria tiver serviços vinculados', async () => {
      prismaMock.service.count.mockResolvedValue(2)

      await expect(repo.delete(TENANT, 'cat-1')).rejects.toThrow(ConflictError)
    })

    it('desativa categoria se não tiver serviços', async () => {
      prismaMock.service.count.mockResolvedValue(0)
      prismaMock.serviceCategory.update.mockResolvedValue({} as any)

      await repo.delete(TENANT, 'cat-1')

      expect(prismaMock.serviceCategory.update).toHaveBeenCalledWith({
        where: { id: 'cat-1', tenantId: TENANT },
        data: { active: false },
      })
    })
  })
})
```

- [ ] **Step 2: Rodar testes — confirmar que falham**
```bash
cd c:/dev/estetica-saas
npx vitest run src/domains/scheduling/__tests__/service-category.repository.test.ts
```
Expected: FAIL — `Cannot find module '../service-category.repository'`

- [ ] **Step 3: Criar `src/domains/scheduling/service-category.repository.ts`**
```typescript
import { prisma } from '@/shared/database/prisma'
import { ConflictError } from '@/shared/errors'

export type CreateCategoryInput = { name: string; order?: number }
export type UpdateCategoryInput = { name?: string; order?: number }

export class ServiceCategoryRepository {
  async list(tenantId: string) {
    return prisma.serviceCategory.findMany({
      where: { tenantId, active: true },
      orderBy: { order: 'asc' },
    })
  }

  async create(tenantId: string, input: CreateCategoryInput) {
    return prisma.serviceCategory.create({
      data: { tenantId, name: input.name, ...(input.order !== undefined && { order: input.order }) },
    })
  }

  async update(tenantId: string, id: string, input: UpdateCategoryInput) {
    return prisma.serviceCategory.update({
      where: { id, tenantId },
      data: input,
    })
  }

  async delete(tenantId: string, id: string) {
    const count = await prisma.service.count({ where: { categoryId: id, tenantId } })
    if (count > 0) {
      throw new ConflictError('Categoria possui serviços vinculados. Remova o vínculo antes de excluir.')
    }
    await prisma.serviceCategory.update({
      where: { id, tenantId },
      data: { active: false },
    })
  }
}

export const serviceCategoryRepository = new ServiceCategoryRepository()
```

- [ ] **Step 4: Rodar testes — confirmar que passam**
```bash
npx vitest run src/domains/scheduling/__tests__/service-category.repository.test.ts
```
Expected: PASS — 5 testes passando.

- [ ] **Step 5: Commit**
```bash
git add src/domains/scheduling/service-category.repository.ts src/domains/scheduling/__tests__/service-category.repository.test.ts
git commit -m "feat(scheduling): ServiceCategoryRepository com testes"
```

---

## Task 4: Atualizar Zod schemas em types.ts

**Files:**
- Modify: `src/domains/scheduling/types.ts`

- [ ] **Step 1: Atualizar `createServiceSchema` e `updateServiceSchema`**

Em `src/domains/scheduling/types.ts`, substituir os schemas de serviço:
```typescript
export const createServiceSchema = z.object({
  name: z.string().trim().min(2).max(100),
  duration: z.number().int().min(5).max(480),
  price: z.number().nonnegative(),
  priceType: z.enum(['FIXED', 'STARTING_FROM', 'RANGE', 'ON_CONSULTATION']).default('FIXED'),
  priceMin: z.number().positive().optional(),
  priceMax: z.number().positive().optional(),
  description: z.string().trim().max(1000).optional(),
  categoryId: z.string().cuid().optional().nullable(),
  active: z.boolean().default(true),
})

export const updateServiceSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  duration: z.number().int().min(5).max(480).optional(),
  price: z.number().nonnegative().optional(),
  priceType: z.enum(['FIXED', 'STARTING_FROM', 'RANGE', 'ON_CONSULTATION']).optional(),
  priceMin: z.number().positive().optional().nullable(),
  priceMax: z.number().positive().optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
  categoryId: z.string().cuid().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
})

export type CreateServiceInput = z.infer<typeof createServiceSchema>
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>
```

- [ ] **Step 2: Adicionar schemas de categoria no mesmo arquivo**
```typescript
export const createServiceCategorySchema = z.object({
  name: z.string().trim().min(2).max(60),
  order: z.number().int().min(0).optional(),
})

export const updateServiceCategorySchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  order: z.number().int().min(0).optional(),
})

export type CreateServiceCategoryInput = z.infer<typeof createServiceCategorySchema>
export type UpdateServiceCategoryInput = z.infer<typeof updateServiceCategorySchema>
```

- [ ] **Step 3: Verificar TypeScript**
```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**
```bash
git add src/domains/scheduling/types.ts
git commit -m "feat(scheduling): schemas Zod com novos campos de serviço e categoria"
```

---

## Task 5: Atualizar CatalogServiceRepository e SchedulingService

**Files:**
- Modify: `src/domains/scheduling/service.repository.ts`
- Modify: `src/domains/scheduling/scheduling.service.ts`

- [ ] **Step 1: Atualizar `CatalogServiceRepository.list()` para incluir categoria**

Em `src/domains/scheduling/service.repository.ts`, atualizar o método `list`:
```typescript
async list(tenantId: string) {
  return prisma.service.findMany({
    where: { tenantId },
    include: { category: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  })
}
```

- [ ] **Step 2: Atualizar `CatalogServiceRepository.create()` para novos campos**
```typescript
async create(
  tenantId: string,
  data: Omit<Prisma.ServiceUncheckedCreateInput, 'tenantId'>,
): Promise<Service> {
  return prisma.service.create({
    data: { ...data, tenantId },
    include: { category: { select: { id: true, name: true } } },
  })
}
```

- [ ] **Step 3: Atualizar `CatalogServiceRepository.update()`**
```typescript
async update(
  tenantId: string,
  serviceId: string,
  data: {
    name?: string
    duration?: number
    price?: number
    priceType?: string
    priceMin?: number | null
    priceMax?: number | null
    description?: string | null
    categoryId?: string | null
    imageUrl?: string | null
  },
) {
  return prisma.service.update({
    where: { id: serviceId, tenantId },
    data,
    include: { category: { select: { id: true, name: true } } },
  })
}
```

- [ ] **Step 4: Atualizar `SchedulingService.createService()`**

Em `src/domains/scheduling/scheduling.service.ts`, substituir o método `createService`:
```typescript
async createService(tenantId: string, input: CreateServiceInput) {
  return catalogServiceRepository.create(tenantId, {
    name: input.name,
    duration: input.duration,
    price: new Prisma.Decimal(input.price),
    priceType: input.priceType as PriceType,
    priceMin: input.priceMin != null ? new Prisma.Decimal(input.priceMin) : undefined,
    priceMax: input.priceMax != null ? new Prisma.Decimal(input.priceMax) : undefined,
    description: input.description,
    categoryId: input.categoryId,
    active: input.active,
  })
}
```

Adicionar ao import do Prisma no topo:
```typescript
import { AppointmentStatus, AppointmentPaymentStatus, PaymentMethod, Prisma, PriceType } from '@prisma/client'
```

- [ ] **Step 5: Adicionar `updateService` no `SchedulingService` (se não existir como método próprio)**

Verificar se `updateService` está no service. Se estiver apenas no repository, adicionar no service:
```typescript
async updateService(tenantId: string, serviceId: string, input: UpdateServiceInput) {
  return catalogServiceRepository.update(tenantId, serviceId, {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.duration !== undefined && { duration: input.duration }),
    ...(input.price !== undefined && { price: input.price }),
    ...(input.priceType !== undefined && { priceType: input.priceType as PriceType }),
    ...(input.priceMin !== undefined && { priceMin: input.priceMin != null ? input.priceMin : null }),
    ...(input.priceMax !== undefined && { priceMax: input.priceMax != null ? input.priceMax : null }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
    ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl }),
  })
}
```

- [ ] **Step 6: Verificar TypeScript**
```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 7: Commit**
```bash
git add src/domains/scheduling/service.repository.ts src/domains/scheduling/scheduling.service.ts
git commit -m "feat(scheduling): repository e service com suporte a categoria, descrição e tipo de preço"
```

---

## Task 6: API routes — categorias (4 endpoints)

**Files:**
- Create: `src/app/api/scheduling/service-categories/route.ts`
- Create: `src/app/api/scheduling/service-categories/[id]/route.ts`

- [ ] **Step 1: Criar `src/app/api/scheduling/service-categories/route.ts`**
```typescript
import { serviceCategoryRepository } from '@/domains/scheduling/service-category.repository'
import { createServiceCategorySchema } from '@/domains/scheduling/types'
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
    const categories = await serviceCategoryRepository.list(session.tenantId)
    return Response.json(categories)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.services.manage)
    const input = await validateInput(request, createServiceCategorySchema)
    const category = await serviceCategoryRepository.create(session.tenantId, input)
    return created(category)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 2: Criar `src/app/api/scheduling/service-categories/[id]/route.ts`**
```typescript
import { serviceCategoryRepository } from '@/domains/scheduling/service-category.repository'
import { updateServiceCategorySchema } from '@/domains/scheduling/types'
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
    const input = await validateInput(request, updateServiceCategorySchema)
    const category = await serviceCategoryRepository.update(session.tenantId, id, input)
    return Response.json(category)
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
    await serviceCategoryRepository.delete(session.tenantId, id)
    return new Response(null, { status: 204 })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 3: Verificar TypeScript**
```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**
```bash
git add src/app/api/scheduling/service-categories/
git commit -m "feat(api): endpoints CRUD para ServiceCategory"
```

---

## Task 7: Atualizar API de serviços + public booking repository

**Files:**
- Modify: `src/app/api/scheduling/services/route.ts` (GET/POST)
- Modify: `src/domains/scheduling/public-booking.repository.ts`

- [ ] **Step 1: Atualizar `GET /api/scheduling/services`**

O método `schedulingService.listServices` já retorna o include de categoria após Task 5. O route.ts não precisa de alteração estrutural — verificar que o handler existe e está correto. O schema `createServiceSchema` agora inclui os novos campos e o route.ts já usa `validateInput(request, createServiceSchema)`, então o POST também está coberto.

Verificar `src/app/api/scheduling/services/route.ts` — confirmar que o `POST` usa `createServiceSchema` e passa o input completo. Se estiver correto, nenhuma alteração necessária neste arquivo.

- [ ] **Step 2: Atualizar `public-booking.repository.ts` — `findPublicServices`**

Em `src/domains/scheduling/public-booking.repository.ts`, substituir o select de `findPublicServices`:
```typescript
async findPublicServices(tenantId: string) {
  const services = await prisma.service.findMany({
    where: { tenantId, active: true },
    select: {
      id: true,
      name: true,
      duration: true,
      price: true,
      priceType: true,
      priceMin: true,
      priceMax: true,
      imageUrl: true,
      description: true,
      categoryId: true,
      category: { select: { name: true } },
    },
    orderBy: { name: 'asc' },
  })
  return services.map((s) => ({
    ...s,
    categoryName: s.category?.name ?? null,
    category: undefined,
  }))
}
```

- [ ] **Step 3: Verificar TypeScript**
```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**
```bash
git add src/domains/scheduling/public-booking.repository.ts
git commit -m "feat(scheduling): public booking retorna description, categoryId, categoryName"
```

---

## Task 8: Hooks — useServiceCategories + atualizar useServices

**Files:**
- Create: `src/hooks/scheduling/use-service-categories.ts`
- Modify: `src/hooks/scheduling/use-services.ts`

- [ ] **Step 1: Criar `src/hooks/scheduling/use-service-categories.ts`**
```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export type ServiceCategory = {
  id: string
  name: string
  order: number
  active: boolean
}

async function listCategories(): Promise<ServiceCategory[]> {
  const res = await fetch('/api/scheduling/service-categories')
  if (!res.ok) throw new Error('Falha ao carregar categorias')
  return res.json()
}

async function createCategory(input: { name: string }): Promise<ServiceCategory> {
  const res = await fetch('/api/scheduling/service-categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Falha ao criar categoria')
  return res.json()
}

async function updateCategory({ id, ...input }: { id: string; name?: string; order?: number }): Promise<ServiceCategory> {
  const res = await fetch(`/api/scheduling/service-categories/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Falha ao atualizar categoria')
  return res.json()
}

async function deleteCategory(id: string): Promise<void> {
  const res = await fetch(`/api/scheduling/service-categories/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.message ?? 'Falha ao remover categoria')
  }
}

export function useServiceCategories() {
  return useQuery({
    queryKey: ['service-categories'],
    queryFn: listCategories,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createCategory,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['service-categories'] }),
  })
}

export function useUpdateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateCategory,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['service-categories'] }),
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['service-categories'] }),
  })
}
```

- [ ] **Step 2: Atualizar tipos em `src/hooks/scheduling/use-services.ts`**

Substituir o tipo `Service` e `UpdateServiceInput`:
```typescript
export type Service = {
  id: string
  name: string
  duration: number
  price: string
  priceType: 'FIXED' | 'STARTING_FROM' | 'RANGE' | 'ON_CONSULTATION'
  priceMin: string | null
  priceMax: string | null
  description: string | null
  imageUrl: string | null
  categoryId: string | null
  category: { id: string; name: string } | null
  active: boolean
}

export type CreateServiceInput = {
  name: string
  duration: number
  price: number
  priceType?: 'FIXED' | 'STARTING_FROM'
  priceMin?: number | null
  priceMax?: number | null
  description?: string | null
  categoryId?: string | null
  active?: boolean
}

export type UpdateServiceInput = {
  name?: string
  duration?: number
  price?: number
  priceType?: 'FIXED' | 'STARTING_FROM' | 'RANGE' | 'ON_CONSULTATION'
  priceMin?: number | null
  priceMax?: number | null
  description?: string | null
  categoryId?: string | null
  imageUrl?: string | null
}
```

- [ ] **Step 3: Verificar TypeScript**
```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**
```bash
git add src/hooks/scheduling/use-service-categories.ts src/hooks/scheduling/use-services.ts
git commit -m "feat(hooks): useServiceCategories e tipos atualizados em useServices"
```

---

## Task 9: Utilitários formatDuration, minutesToHHMM, hhmmToMinutes

**Files:**
- Create: `src/lib/format-duration.ts`

- [ ] **Step 1: Criar `src/lib/format-duration.ts`**
```typescript
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}min`
}

export function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function hhmmToMinutes(value: string): number | null {
  const trimmed = value.trim()
  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10)
    return n >= 5 && n <= 480 ? n : null
  }
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  if (m >= 60) return null
  const total = h * 60 + m
  return total >= 5 && total <= 480 ? total : null
}
```

- [ ] **Step 2: Commit**
```bash
git add src/lib/format-duration.ts
git commit -m "feat(lib): utilitários formatDuration, minutesToHHMM, hhmmToMinutes"
```

---

## Task 10: Componente ImageUploadField

**Files:**
- Create: `src/components/ui/image-upload-field.tsx`

- [ ] **Step 1: Criar `src/components/ui/image-upload-field.tsx`**
```typescript
'use client'

import { useRef, useState } from 'react'
import { ImageIcon, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

type Props = {
  entityType: 'services' | 'packages' | 'promotions'
  entityId: string | null
  value: string | null
  onChange: (url: string | null) => void
  label?: string
}

export function ImageUploadField({ entityType, entityId, value, onChange, label = 'Imagem' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(file: File) {
    if (!entityId) {
      toast.error('Salve o serviço primeiro para adicionar uma imagem.')
      return
    }
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('entityType', entityType)
      form.append('entityId', entityId)
      const res = await fetch('/api/uploads/service-images', { method: 'POST', body: form })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? 'Erro no upload')
      }
      const { url } = await res.json()
      onChange(url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao fazer upload.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {value ? (
        <div className="relative w-full h-36 rounded-xl overflow-hidden border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="preview" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
            aria-label="Remover imagem"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 py-8 text-sm text-muted-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
        >
          <ImageIcon className="size-6" />
          {uploading ? 'Enviando...' : 'Clique para adicionar foto'}
          <span className="text-xs">JPEG, PNG ou WebP · máx. 5 MB</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**
```bash
git add src/components/ui/image-upload-field.tsx
git commit -m "feat(ui): ImageUploadField com preview e upload para Supabase Storage"
```

---

## Task 11: Atualizar ServiceFormModal

**Files:**
- Modify: `src/components/domain/services/service-form-modal.tsx`

- [ ] **Step 1: Substituir o arquivo completo com os novos campos**

Escrever `src/components/domain/services/service-form-modal.tsx`:
```typescript
'use client'

import { useEffect, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { CurrencyInput } from '@/components/ui/currency-input'
import { ImageUploadField } from '@/components/ui/image-upload-field'
import { useCreateService, useUpdateService, type Service } from '@/hooks/scheduling/use-services'
import { useServiceCategories } from '@/hooks/scheduling/use-service-categories'
import { useProducts } from '@/hooks/inventory/use-products'
import { minutesToHHMM, hhmmToMinutes } from '@/lib/format-duration'

type ProductItem = { productId: string; quantity: number; name: string }
type PriceType = 'FIXED' | 'STARTING_FROM'

type Props = {
  open: boolean
  onClose: () => void
  service?: Service
}

export function ServiceFormModal({ open, onClose, service }: Props) {
  const isEditing = !!service
  const { mutate: create, isPending: creating } = useCreateService()
  const { mutate: update, isPending: updating } = useUpdateService()
  const { data: categories = [] } = useServiceCategories()
  const { data: productsData } = useProducts({ pageSize: 100 })
  const allProducts = productsData?.data ?? []

  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [priceType, setPriceType] = useState<PriceType>('FIXED')
  const [price, setPrice] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [durationHHMM, setDurationHHMM] = useState('01:00')
  const [productItems, setProductItems] = useState<ProductItem[]>([])
  const [savingTemplate, setSavingTemplate] = useState(false)

  useEffect(() => {
    if (open && service) {
      setName(service.name)
      setCategoryId(service.categoryId ?? null)
      setDescription(service.description ?? '')
      setImageUrl(service.imageUrl ?? null)
      const svcPriceType = service.priceType === 'STARTING_FROM' ? 'STARTING_FROM' : 'FIXED'
      setPriceType(svcPriceType)
      setPrice(Number(service.price).toFixed(2))
      setPriceMax(service.priceMax ? Number(service.priceMax).toFixed(2) : '')
      setDurationHHMM(minutesToHHMM(service.duration))
      fetch(`/api/services/${service.id}/products`)
        .then((r) => r.json())
        .then((data: Array<{ productId: string; quantity: number; product: { name: string } }>) => {
          if (Array.isArray(data)) {
            setProductItems(data.map((t) => ({ productId: t.productId, quantity: t.quantity, name: t.product.name })))
          }
        })
        .catch(() => {})
    } else if (!open) {
      setName('')
      setCategoryId(null)
      setDescription('')
      setImageUrl(null)
      setPriceType('FIXED')
      setPrice('')
      setPriceMax('')
      setDurationHHMM('01:00')
      setProductItems([])
    }
  }, [open, service])

  async function saveTemplate(serviceId: string) {
    if (productItems.length === 0) return
    await fetch(`/api/services/${serviceId}/products`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products: productItems.map((i) => ({ productId: i.productId, quantity: i.quantity })) }),
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const durationNum = hhmmToMinutes(durationHHMM)
    const priceNum = parseFloat(price)
    if (!durationNum) {
      toast.error('Tempo médio inválido. Use o formato HH:MM (ex: 01:30).')
      return
    }
    if (isNaN(priceNum) || priceNum < 0) return

    const priceMaxNum = priceMax ? parseFloat(priceMax) : undefined
    setSavingTemplate(true)

    const payload = {
      name: name.trim(),
      duration: durationNum,
      price: priceNum,
      priceType,
      priceMax: priceMaxNum ?? null,
      description: description.trim() || null,
      categoryId: categoryId || null,
      imageUrl,
    }

    if (isEditing) {
      update(
        { id: service.id, ...payload },
        {
          onSuccess: async () => {
            try { await saveTemplate(service.id) } catch {}
            setSavingTemplate(false)
            onClose()
          },
          onError: () => setSavingTemplate(false),
        },
      )
    } else {
      create(
        { ...payload, active: true },
        {
          onSuccess: async (created) => {
            try { await saveTemplate(created.id) } catch {}
            setSavingTemplate(false)
            onClose()
          },
          onError: () => setSavingTemplate(false),
        },
      )
    }
  }

  function addProduct(productId: string) {
    if (productItems.find((i) => i.productId === productId)) return
    const product = allProducts.find((p) => p.id === productId)
    if (!product) return
    setProductItems((prev) => [...prev, { productId, quantity: 1, name: product.name }])
  }

  function updateQty(productId: string, delta: number) {
    setProductItems((prev) =>
      prev.map((i) => i.productId === productId ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i),
    )
  }

  function removeProduct(productId: string) {
    setProductItems((prev) => prev.filter((i) => i.productId !== productId))
  }

  const availableProducts = allProducts.filter((p) => !productItems.find((i) => i.productId === p.id))
  const isPending = creating || updating || savingTemplate

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
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
              placeholder="Ex: Progressiva brasileira"
              required
              minLength={2}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={categoryId ?? 'none'} onValueChange={(v) => setCategoryId(v === 'none' ? null : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Sem categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem categoria</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="service-description">Descrição</Label>
            <Textarea
              id="service-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o serviço, diferenciais, cuidados..."
              rows={3}
              maxLength={1000}
              className="resize-none"
            />
          </div>

          <ImageUploadField
            entityType="services"
            entityId={service?.id ?? null}
            value={imageUrl}
            onChange={setImageUrl}
          />

          <div className="space-y-3">
            <Label>Tipo de preço</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="priceType"
                  value="FIXED"
                  checked={priceType === 'FIXED'}
                  onChange={() => setPriceType('FIXED')}
                  className="accent-primary"
                />
                <span className="text-sm">Valor fixo</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="priceType"
                  value="STARTING_FROM"
                  checked={priceType === 'STARTING_FROM'}
                  onChange={() => setPriceType('STARTING_FROM')}
                  className="accent-primary"
                />
                <span className="text-sm">A partir de</span>
              </label>
            </div>
            <div className={priceType === 'STARTING_FROM' ? 'grid grid-cols-2 gap-3' : ''}>
              <div className="space-y-1">
                <Label htmlFor="service-price" className="text-xs text-muted-foreground">
                  {priceType === 'STARTING_FROM' ? 'A partir de' : 'Valor'}
                </Label>
                <CurrencyInput
                  id="service-price"
                  value={price}
                  onChange={setPrice}
                  placeholder="R$ 0,00"
                  required
                />
              </div>
              {priceType === 'STARTING_FROM' && (
                <div className="space-y-1">
                  <Label htmlFor="service-price-max" className="text-xs text-muted-foreground">
                    Até (opcional)
                  </Label>
                  <CurrencyInput
                    id="service-price-max"
                    value={priceMax}
                    onChange={setPriceMax}
                    placeholder="R$ 0,00"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="service-duration">Tempo médio</Label>
            <Input
              id="service-duration"
              value={durationHHMM}
              onChange={(e) => setDurationHHMM(e.target.value)}
              placeholder="01:30"
              pattern="^\d{1,2}:\d{2}$"
              title="Use o formato HH:MM — ex: 01:30, 0:45"
              required
            />
            <p className="text-xs text-muted-foreground">Use HH:MM — ex: 01:30 para 1 hora e 30 minutos</p>
          </div>

          <Separator />

          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">Kit de Produtos</p>
              <p className="text-xs text-muted-foreground">
                Produtos pré-selecionados ao registrar consumo neste serviço
              </p>
            </div>
            {productItems.map((item) => (
              <div key={item.productId} className="flex items-center gap-2">
                <span className="flex-1 text-sm truncate">{item.name}</span>
                <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" onClick={() => updateQty(item.productId, -1)}>
                  <Minus className="size-3" />
                </Button>
                <span className="w-6 text-center text-sm tabular-nums shrink-0">{item.quantity}</span>
                <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" onClick={() => updateQty(item.productId, 1)}>
                  <Plus className="size-3" />
                </Button>
                <button type="button" className="text-destructive hover:text-destructive/80 text-sm px-1 shrink-0" onClick={() => removeProduct(item.productId)} aria-label="Remover">×</button>
              </div>
            ))}
            {productItems.length === 0 && <p className="text-xs text-muted-foreground">Nenhum produto no kit</p>}
            {availableProducts.length > 0 && (
              <Select onValueChange={addProduct}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="+ Adicionar produto ao kit" />
                </SelectTrigger>
                <SelectContent>
                  {availableProducts.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1" disabled={isPending}>
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

- [ ] **Step 2: Verificar TypeScript**
```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**
```bash
git add src/components/domain/services/service-form-modal.tsx
git commit -m "feat(services): formulário com categoria, descrição, imagem, preço a partir de e tempo HH:MM"
```

---

## Task 12: CategoryFormModal + CategoryCatalog

**Files:**
- Create: `src/components/domain/services/category-form-modal.tsx`
- Create: `src/components/domain/services/category-catalog.tsx`

- [ ] **Step 1: Criar `src/components/domain/services/category-form-modal.tsx`**
```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreateCategory, useUpdateCategory, type ServiceCategory } from '@/hooks/scheduling/use-service-categories'

type Props = {
  open: boolean
  onClose: () => void
  category?: ServiceCategory
}

export function CategoryFormModal({ open, onClose, category }: Props) {
  const isEditing = !!category
  const { mutate: create, isPending: creating } = useCreateCategory()
  const { mutate: update, isPending: updating } = useUpdateCategory()
  const [name, setName] = useState(category?.name ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isEditing) {
      update({ id: category.id, name: name.trim() }, { onSuccess: onClose })
    } else {
      create({ name: name.trim() }, { onSuccess: onClose })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar categoria' : 'Nova categoria'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="cat-name">Nome da categoria</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Alisamentos"
              required
              minLength={2}
              maxLength={60}
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1" disabled={creating || updating}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={creating || updating}>
              {creating || updating ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Criar `src/components/domain/services/category-catalog.tsx`**
```typescript
'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Edit2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useServiceCategories, useDeleteCategory, useUpdateCategory, type ServiceCategory } from '@/hooks/scheduling/use-service-categories'
import { CategoryFormModal } from './category-form-modal'

export function CategoryCatalog() {
  const { data: categories = [], isLoading, isError, refetch } = useServiceCategories()
  const { mutate: deleteCategory } = useDeleteCategory()
  const { mutate: updateCategory } = useUpdateCategory()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ServiceCategory | undefined>()

  function handleDelete(cat: ServiceCategory) {
    if (!confirm(`Remover a categoria "${cat.name}"?`)) return
    deleteCategory(cat.id, {
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro ao remover categoria.'),
    })
  }

  function handleMove(cat: ServiceCategory, direction: 'up' | 'down') {
    const idx = categories.findIndex((c) => c.id === cat.id)
    const newOrder = direction === 'up' ? Math.max(0, cat.order - 1) : cat.order + 1
    updateCategory({ id: cat.id, order: newOrder })
  }

  if (isLoading) {
    return <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-dashed border-destructive/30 px-6 py-8 text-center">
        <p className="text-sm text-destructive">Erro ao carregar categorias.</p>
        <Button onClick={() => refetch()} variant="outline" size="sm" className="mt-2">Tentar novamente</Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{categories.length} categoria(s)</p>
        <Button size="sm" className="gap-2" onClick={() => { setEditing(undefined); setModalOpen(true) }}>
          <Plus className="size-4" />Nova categoria
        </Button>
      </div>

      {categories.length === 0 && (
        <div className="rounded-xl border border-dashed border-border px-6 py-8 text-center">
          <p className="text-sm text-muted-foreground">Nenhuma categoria cadastrada.</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => { setEditing(undefined); setModalOpen(true) }}>
            Criar primeira categoria
          </Button>
        </div>
      )}

      {categories.length > 0 && (
        <div className="space-y-2">
          {categories.map((cat, idx) => (
            <div key={cat.id} className="flex items-center gap-3 rounded-xl border border-border/50 bg-card px-4 py-3 shadow-sm">
              <div className="flex flex-col gap-0.5">
                <Button variant="ghost" size="icon" className="size-5" onClick={() => handleMove(cat, 'up')} disabled={idx === 0}>
                  <ChevronUp className="size-3" />
                </Button>
                <Button variant="ghost" size="icon" className="size-5" onClick={() => handleMove(cat, 'down')} disabled={idx === categories.length - 1}>
                  <ChevronDown className="size-3" />
                </Button>
              </div>
              <span className="flex-1 font-medium text-sm">{cat.name}</span>
              <Button variant="ghost" size="icon" className="size-8" onClick={() => { setEditing(cat); setModalOpen(true) }}>
                <Edit2 className="size-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(cat)}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <CategoryFormModal open={modalOpen} onClose={() => setModalOpen(false)} category={editing} />
    </div>
  )
}
```

- [ ] **Step 3: Verificar TypeScript**
```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**
```bash
git add src/components/domain/services/category-form-modal.tsx src/components/domain/services/category-catalog.tsx
git commit -m "feat(services): CategoryFormModal e CategoryCatalog com reordenação"
```

---

## Task 13: Adicionar aba Categorias em ServicosPage + atualizar ServiceCatalog

**Files:**
- Modify: `src/app/(app)/servicos/page.tsx`
- Modify: `src/components/domain/services/service-catalog.tsx`

- [ ] **Step 1: Adicionar aba Categorias na página `/servicos`**

Substituir `src/app/(app)/servicos/page.tsx`:
```typescript
'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ServiceCatalog } from '@/components/domain/services/service-catalog'
import { PackageCatalog } from '@/components/domain/services/package-catalog'
import { PromotionCatalog } from '@/components/domain/services/promotion-catalog'
import { CategoryCatalog } from '@/components/domain/services/category-catalog'

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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="servicos">Serviços</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
          <TabsTrigger value="pacotes">Pacotes</TabsTrigger>
          <TabsTrigger value="promocoes">Promoções</TabsTrigger>
        </TabsList>

        <TabsContent value="servicos" className="mt-6">
          <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-foreground">Catálogo de serviços</h2>
            <ServiceCatalog />
          </div>
        </TabsContent>

        <TabsContent value="categorias" className="mt-6">
          <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-foreground">Categorias</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Organize seus serviços em categorias para facilitar a navegação dos clientes.
            </p>
            <CategoryCatalog />
          </div>
        </TabsContent>

        <TabsContent value="pacotes" className="mt-6">
          <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-foreground">Pacotes</h2>
            <p className="mb-4 text-sm text-muted-foreground">Agrupe serviços em pacotes com preço especial.</p>
            <PackageCatalog />
          </div>
        </TabsContent>

        <TabsContent value="promocoes" className="mt-6">
          <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-foreground">Promoções</h2>
            <p className="mb-4 text-sm text-muted-foreground">Crie descontos temporários para serviços ou pacotes.</p>
            <PromotionCatalog />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 2: Atualizar `ServiceCatalog` — badge de categoria e preço contextual**

Em `src/components/domain/services/service-catalog.tsx`, localizar o bloco de exibição do serviço e atualizar:

```typescript
// Adicionar import do Badge (já importado)
// Atualizar a exibição do preço — substituir a linha de p.text-xs:
<p className="text-xs text-muted-foreground">
  {service.duration} min ·{' '}
  {service.priceType === 'STARTING_FROM'
    ? `A partir de ${Number(service.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
    : Number(service.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
</p>
```

E adicionar badge de categoria ao lado do nome:
```typescript
<div className="flex items-center gap-2">
  <span className="font-medium text-foreground">{service.name}</span>
  {service.category && (
    <Badge variant="outline" className="text-xs font-normal">{service.category.name}</Badge>
  )}
  {!service.active && (
    <Badge variant="secondary" className="text-xs">Inativo</Badge>
  )}
</div>
```

- [ ] **Step 3: Verificar TypeScript**
```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**
```bash
git add src/app/\(app\)/servicos/page.tsx src/components/domain/services/service-catalog.tsx
git commit -m "feat(services): aba Categorias na página de serviços e badge no catálogo"
```

---

## Task 14: Componente ServicePickerWithCategories

**Files:**
- Create: `src/components/domain/booking/service-picker-with-categories.tsx`

- [ ] **Step 1: Criar `src/components/domain/booking/service-picker-with-categories.tsx`**
```typescript
'use client'

import { useState, useMemo } from 'react'
import { ImageIcon } from 'lucide-react'
import { formatDuration } from '@/lib/format-duration'

export type PickerService = {
  id: string
  name: string
  duration: number
  price: number | string
  priceType?: string | null
  priceMin?: number | string | null
  priceMax?: number | string | null
  imageUrl?: string | null
  description?: string | null
  categoryId?: string | null
  categoryName?: string | null
}

type Category = { id: string; name: string }

type Props = {
  services: PickerService[]
  onSelect: (service: PickerService) => void
  primaryColor?: string
}

function formatPickerPrice(service: PickerService): string {
  const price = Number(service.price)
  const priceMin = service.priceMin != null ? Number(service.priceMin) : null
  const priceMax = service.priceMax != null ? Number(service.priceMax) : null

  if (service.priceType === 'ON_CONSULTATION') return 'Sob consulta'
  if (service.priceType === 'STARTING_FROM') {
    const from = `A partir de ${price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
    if (priceMax) return `${from} – ${priceMax.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
    return from
  }
  if (service.priceType === 'RANGE' && priceMin != null) {
    return `${priceMin.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}${priceMax ? ` – ${priceMax.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : ''}`
  }
  return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function ServicePickerWithCategories({ services, onSelect, primaryColor = '#191919' }: Props) {
  const categories = useMemo<Category[]>(() => {
    const seen = new Set<string>()
    const cats: Category[] = []
    for (const svc of services) {
      if (svc.categoryId && svc.categoryName && !seen.has(svc.categoryId)) {
        seen.add(svc.categoryId)
        cats.push({ id: svc.categoryId, name: svc.categoryName })
      }
    }
    const hasUncategorized = services.some((s) => !s.categoryId)
    if (hasUncategorized) cats.push({ id: '__outros__', name: 'Outros' })
    return cats
  }, [services])

  const [activeCategoryId, setActiveCategoryId] = useState<string>(
    categories[0]?.id ?? '__outros__',
  )

  const visibleServices = useMemo(() => {
    if (activeCategoryId === '__outros__') return services.filter((s) => !s.categoryId)
    return services.filter((s) => s.categoryId === activeCategoryId)
  }, [services, activeCategoryId])

  if (services.length === 0) {
    return <p className="text-sm text-slate-500 text-center py-6">Nenhum serviço disponível.</p>
  }

  return (
    <div className="space-y-4">
      {/* Scroll horizontal de categorias */}
      {categories.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => {
            const active = cat.id === activeCategoryId
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategoryId(cat.id)}
                className="shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-all focus:outline-none"
                style={
                  active
                    ? { backgroundColor: primaryColor, borderColor: primaryColor, color: '#fff' }
                    : { borderColor: '#e2e8f0', color: '#64748b' }
                }
              >
                {cat.name}
              </button>
            )
          })}
        </div>
      )}

      {/* Grid de serviços */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {visibleServices.map((svc) => (
          <button
            key={svc.id}
            onClick={() => onSelect(svc)}
            className="flex flex-col rounded-2xl border border-slate-200 bg-white text-left transition-all hover:border-slate-400 hover:shadow-sm active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-1 overflow-hidden"
            style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
          >
            {/* Imagem */}
            <div className="relative w-full aspect-[4/3] bg-slate-100 flex items-center justify-center">
              {svc.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={svc.imageUrl} alt={svc.name} className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-1 text-slate-400">
                  <ImageIcon className="size-6" />
                  <span className="text-lg font-semibold">{svc.name.charAt(0).toUpperCase()}</span>
                </div>
              )}
            </div>
            {/* Info */}
            <div className="flex flex-col gap-1 p-3">
              <p className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">{svc.name}</p>
              <p className="text-xs font-medium" style={{ color: primaryColor }}>
                {formatPickerPrice(svc)}
              </p>
              <p className="text-xs text-slate-500">{formatDuration(svc.duration)}</p>
              {svc.description && (
                <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">{svc.description}</p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**
```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**
```bash
git add src/components/domain/booking/service-picker-with-categories.tsx
git commit -m "feat(booking): ServicePickerWithCategories com scroll horizontal e grid de serviços"
```

---

## Task 15: Atualizar ServiceStep público + booking-client

**Files:**
- Modify: `src/components/domain/booking/service-step.tsx`
- Modify: `src/app/(public)/agendar/[slug]/types.ts`
- Modify: `src/app/(public)/agendar/[slug]/booking-client.tsx`

- [ ] **Step 1: Atualizar `PublicService` em types.ts**

Em `src/app/(public)/agendar/[slug]/types.ts`, atualizar o tipo `PublicService`:
```typescript
export type PublicService = {
  id: string
  name: string
  duration: number
  price: number
  priceType: 'FIXED' | 'STARTING_FROM' | 'RANGE' | 'ON_CONSULTATION'
  priceMin?: number | null
  priceMax?: number | null
  imageUrl?: string | null
  description?: string | null
  categoryId?: string | null
  categoryName?: string | null
}
```

- [ ] **Step 2: Substituir `ServiceStep` para usar `ServicePickerWithCategories`**

Substituir `src/components/domain/booking/service-step.tsx`:
```typescript
'use client'

import type { PublicService } from '@/app/(public)/agendar/[slug]/types'
import { ServicePickerWithCategories } from './service-picker-with-categories'

export function ServiceStep({
  services,
  onSelect,
  primaryColor,
}: {
  services: PublicService[]
  onSelect: (service: PublicService) => void
  primaryColor: string
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Escolha o serviço</h2>
        <p className="text-sm text-slate-500 mt-1">Selecione o serviço que deseja agendar</p>
      </div>
      <ServicePickerWithCategories
        services={services}
        onSelect={onSelect}
        primaryColor={primaryColor}
      />
    </div>
  )
}
```

- [ ] **Step 3: Atualizar label de preço em `booking-client.tsx` para STARTING_FROM**

Em `src/app/(public)/agendar/[slug]/booking-client.tsx`, localizar a função `handleServiceSelect` e atualizar o cálculo de `priceLabel`:
```typescript
const priceLabel =
  service.priceType === 'ON_CONSULTATION'
    ? 'Sob consulta'
    : service.priceType === 'STARTING_FROM'
      ? `A partir de R$ ${Number(service.price).toFixed(2).replace('.', ',')}`
      : service.priceType === 'RANGE' && service.priceMin != null
        ? `R$ ${Number(service.priceMin).toFixed(2).replace('.', ',')}${service.priceMax ? ` – R$ ${Number(service.priceMax).toFixed(2).replace('.', ',')}` : ''}`
        : `R$ ${Number(service.price).toFixed(2).replace('.', ',')}`
```

- [ ] **Step 4: Verificar TypeScript**
```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 5: Commit**
```bash
git add src/components/domain/booking/service-step.tsx src/app/\(public\)/agendar/\[slug\]/types.ts src/app/\(public\)/agendar/\[slug\]/booking-client.tsx
git commit -m "feat(booking-publico): ServiceStep usa ServicePickerWithCategories com scroll de categorias"
```

---

## Task 16: Atualizar modal interno de criação de agendamento

**Files:**
- Modify: `src/components/domain/scheduling/create-appointment-modal.tsx`

- [ ] **Step 1: Substituir o Select de serviço pelo ServicePickerWithCategories**

Em `src/components/domain/scheduling/create-appointment-modal.tsx`:

Adicionar imports no topo:
```typescript
import { ServicePickerWithCategories, type PickerService } from '@/components/domain/booking/service-picker-with-categories'
```

Localizar a variável `activeServices`:
```typescript
const activeServices = services.filter((s) => s.active)
```

Adicionar logo após:
```typescript
const [showPicker, setShowPicker] = useState(!serviceId)

const pickerServices: PickerService[] = activeServices.map((s) => ({
  id: s.id,
  name: s.name,
  duration: s.duration,
  price: s.price,
  priceType: s.priceType,
  priceMin: s.priceMin,
  priceMax: s.priceMax,
  imageUrl: s.imageUrl,
  description: s.description,
  categoryId: s.categoryId,
  categoryName: s.category?.name ?? null,
}))

function handleServicePick(svc: PickerService) {
  setServiceId(svc.id)
  setShowPicker(false)
}
```

Substituir o bloco do Select de serviço:
```typescript
<div className="space-y-2">
  <div className="flex items-center justify-between">
    <Label>Serviço</Label>
    {serviceId && !showPicker && (
      <button
        type="button"
        className="text-xs text-muted-foreground underline"
        onClick={() => { setServiceId(''); setShowPicker(true) }}
      >
        Trocar
      </button>
    )}
  </div>
  {showPicker ? (
    <div className="max-h-72 overflow-y-auto rounded-xl border border-border p-2">
      <ServicePickerWithCategories
        services={pickerServices}
        onSelect={handleServicePick}
      />
    </div>
  ) : (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
      {activeServices.find((s) => s.id === serviceId)?.name ?? 'Serviço selecionado'}
    </div>
  )}
</div>
```

Garantir que `useState` de `showPicker` está importado (já deve estar pois o arquivo usa `useState`).

- [ ] **Step 2: Verificar TypeScript**
```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**
```bash
git add src/components/domain/scheduling/create-appointment-modal.tsx
git commit -m "feat(agenda): modal interno usa ServicePickerWithCategories para seleção de serviço"
```

---

## Task 17: Verificação final e PR

**Files:**
- (nenhum arquivo novo)

- [ ] **Step 1: Rodar todos os testes**
```bash
cd c:/dev/estetica-saas
npx vitest run
```
Expected: todos os testes passando.

- [ ] **Step 2: Verificar TypeScript sem erros**
```bash
npx tsc --noEmit
```
Expected: sem output (zero erros).

- [ ] **Step 3: Abrir Pull Request**
```bash
git push -u origin feat/service-categories
gh pr create \
  --title "feat: categorias de serviços, descrição, imagem e novo fluxo de agendamento" \
  --body "$(cat <<'EOF'
## Resumo
- Novo model `ServiceCategory` com CRUD completo
- Campos `description`, `categoryId`, `STARTING_FROM` em `Service`
- Formulário de serviço com categoria, descrição, upload de imagem, preço a partir de e tempo HH:MM
- Componente `ServicePickerWithCategories` com scroll horizontal de categorias e grid de cards
- Fluxo de seleção de serviço atualizado na página pública e no modal interno de agendamento

## Plano implementado
`docs/superpowers/plans/2026-06-07-service-categories.md`

## Test plan
- [ ] Criar categoria, editar nome, reordenar, tentar remover com serviço vinculado (erro esperado)
- [ ] Criar serviço com categoria, descrição, imagem e preço "A partir de"
- [ ] Verificar exibição correta no catálogo (badge de categoria, label "A partir de")
- [ ] Abrir página pública — verificar scroll de categorias e grid de serviços com foto/preço/descrição
- [ ] Criar agendamento interno — verificar picker de categorias dentro do modal
- [ ] Serviço sem categoria aparece em "Outros"
- [ ] `npx tsc --noEmit` — zero erros
- [ ] `npx vitest run` — todos passando

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review do Plano

**Cobertura da spec:**
- ✅ `ServiceCategory` model — Task 2
- ✅ `description`, `categoryId` em `Service` — Task 2
- ✅ `STARTING_FROM` em `PriceType` — Task 2
- ✅ `ServiceCategoryRepository` + testes — Task 3
- ✅ Schemas Zod atualizados — Task 4
- ✅ Repository + Service atualizados — Task 5
- ✅ 4 endpoints de categorias — Task 6
- ✅ API de serviços com novos campos — Task 5 + 7
- ✅ API pública retorna novos campos — Task 7
- ✅ `useServiceCategories` + mutações — Task 8
- ✅ `use-services` tipos atualizados — Task 8
- ✅ `formatDuration`, `minutesToHHMM`, `hhmmToMinutes` — Task 9
- ✅ `ImageUploadField` — Task 10
- ✅ `ServiceFormModal` atualizado — Task 11
- ✅ `CategoryFormModal` + `CategoryCatalog` — Task 12
- ✅ Aba Categorias em ServicosPage — Task 13
- ✅ `ServiceCatalog` badge + preço contextual — Task 13
- ✅ `ServicePickerWithCategories` — Task 14
- ✅ `ServiceStep` público substituído — Task 15
- ✅ `PublicService` com novos campos — Task 15
- ✅ `booking-client` label STARTING_FROM — Task 15
- ✅ Modal interno substituído — Task 16
- ✅ "Outros" para serviços sem categoria — Task 14
