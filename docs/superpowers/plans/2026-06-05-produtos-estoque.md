# Módulo Produtos & Estoque — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o domínio `inventory` completo — catálogo de produtos com controle de estoque, movimentações financeiras via eventos de domínio, e UI integrada ao fluxo de agendamento.

**Architecture:** Domínio `inventory` independente (types → repository → service → subscriptions → API Routes → Frontend). Eventos `product.sold` e `stock.purchased` publicados para `financial` criar Transactions. Estoque decrementado em atendimento não gera transação financeira adicional.

**Tech Stack:** Next.js 15 App Router, Prisma, Zod, TanStack Query v5, Shadcn UI, Vitest

---

## Mapa de Arquivos

### Criados
| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/domains/inventory/types.ts` | Zod schemas + tipos TypeScript |
| `src/domains/inventory/product.repository.ts` | CRUD Product, ProductCategory, ServiceProduct, AppointmentProduct |
| `src/domains/inventory/stock.repository.ts` | StockMovement CRUD + queries de histórico |
| `src/domains/inventory/inventory.service.ts` | Regras de negócio |
| `src/domains/inventory/subscriptions.ts` | Registro de subscriptions (placeholder) |
| `src/domains/inventory/__tests__/inventory.service.test.ts` | Testes do service (80%) |
| `src/domains/inventory/__tests__/product.repository.test.ts` | Testes do product repo (60%) |
| `src/domains/inventory/__tests__/stock.repository.test.ts` | Testes do stock repo (60%) |
| `src/shared/test/factories/product.factory.ts` | Factories de Product e StockMovement |
| `src/app/api/products/route.ts` | GET lista + POST criar |
| `src/app/api/products/[id]/route.ts` | PATCH + DELETE |
| `src/app/api/products/categories/route.ts` | GET + POST categorias |
| `src/app/api/products/categories/[id]/route.ts` | DELETE categoria |
| `src/app/api/products/[id]/purchase/route.ts` | POST registrar compra |
| `src/app/api/products/[id]/sell/route.ts` | POST registrar venda |
| `src/app/api/products/movements/route.ts` | GET histórico |
| `src/app/api/services/[id]/products/route.ts` | GET + PUT template de serviço |
| `src/app/api/appointments/[id]/products/route.ts` | GET + PATCH produtos do atendimento |
| `src/hooks/use-products.ts` | TanStack Query para produtos |
| `src/hooks/use-product-categories.ts` | TanStack Query para categorias |
| `src/hooks/use-stock-movements.ts` | TanStack Query para movimentações |
| `src/hooks/use-service-template.ts` | TanStack Query para template de serviço |
| `src/hooks/use-appointment-products.ts` | TanStack Query para produtos do atendimento |
| `src/components/domain/inventory/ProductsTable.tsx` | Tabela com badges de estoque |
| `src/components/domain/inventory/CategoryManagerModal.tsx` | CRUD de categorias |
| `src/components/domain/inventory/ProductFormModal.tsx` | Criar/editar produto |
| `src/components/domain/inventory/StockPurchaseModal.tsx` | Registrar entrada |
| `src/components/domain/inventory/StockSaleModal.tsx` | Registrar venda avulsa |
| `src/components/domain/inventory/StockMovementsTable.tsx` | Tabela de movimentações |
| `src/components/domain/inventory/AppointmentProductsSection.tsx` | Seção no AppointmentDrawer |
| `src/app/(app)/produtos/page.tsx` | Página principal com 3 abas |

### Modificados
| Arquivo | O que muda |
|---------|-----------|
| `prisma/schema.prisma` | +5 modelos + enum StockMovementType |
| `src/shared/events/domain-events.ts` | +`product.sold` e `stock.purchased` |
| `src/shared/errors/domain-error.ts` | +4 erros de inventário |
| `src/shared/permissions/nav-registry.ts` | +item `produtos` entre serviços e financeiro |
| `src/domains/financial/subscriptions.ts` | +handlers para `product.sold` e `stock.purchased` |
| `src/app/api/_lib/runtime.ts` | +`registerInventorySubscriptions()` |
| `src/components/domain/scheduling/appointment-drawer.tsx` | +`AppointmentProductsSection` |

---

## Task 1: Prisma Schema — novos modelos

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Adicionar enum e modelos ao schema**

Ao final do arquivo `prisma/schema.prisma`, antes do último model, adicionar:

```prisma
enum StockMovementType {
  PURCHASE
  SALE
  APPOINTMENT_USE
  ADJUSTMENT
}

model ProductCategory {
  id        String    @id @default(cuid())
  tenantId  String
  name      String
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  tenant   Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  products Product[]

  @@unique([tenantId, name])
  @@index([tenantId])
}

model Product {
  id            String  @id @default(cuid())
  tenantId      String
  name          String
  categoryId    String?
  costPrice     Decimal @db.Decimal(10, 2)
  salePrice     Decimal @db.Decimal(10, 2)
  stockQuantity Int     @default(0)
  lowStockAlert Int     @default(5)
  active        Boolean @default(true)
  imageUrl      String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  tenant              Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  category            ProductCategory?    @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  stockMovements      StockMovement[]
  appointmentProducts AppointmentProduct[]
  serviceProducts     ServiceProduct[]

  @@index([tenantId])
  @@index([tenantId, categoryId])
}

model StockMovement {
  id              String            @id @default(cuid())
  tenantId        String
  productId       String
  type            StockMovementType
  quantity        Int
  unitPrice       Decimal?          @db.Decimal(10, 2)
  totalAmount     Decimal?          @db.Decimal(10, 2)
  notes           String?
  appointmentId   String?
  createdByUserId String
  createdAt       DateTime          @default(now())

  tenant  Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  product Product @relation(fields: [productId], references: [id], onDelete: Restrict)

  @@index([tenantId])
  @@index([tenantId, productId])
  @@index([tenantId, type, createdAt])
}

model AppointmentProduct {
  id            String @id @default(cuid())
  tenantId      String
  appointmentId String
  productId     String
  quantity      Int    @default(1)

  tenant      Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  appointment Appointment @relation(fields: [appointmentId], references: [id], onDelete: Cascade)
  product     Product     @relation(fields: [productId], references: [id], onDelete: Restrict)

  @@unique([appointmentId, productId])
  @@index([tenantId])
  @@index([appointmentId])
}

model ServiceProduct {
  id        String @id @default(cuid())
  tenantId  String
  serviceId String
  productId String
  quantity  Int    @default(1)

  tenant  Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  service Service @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  product Product @relation(fields: [productId], references: [id], onDelete: Restrict)

  @@unique([serviceId, productId])
  @@index([tenantId])
}
```

- [ ] **Step 2: Adicionar relações inversas nos modelos existentes**

No model `Tenant`, adicionar ao final das relações:
```prisma
  products            Product[]
  productCategories   ProductCategory[]
  stockMovements      StockMovement[]
  appointmentProducts AppointmentProduct[]
  serviceProducts     ServiceProduct[]
```

No model `Appointment`, adicionar:
```prisma
  appointmentProducts AppointmentProduct[]
```

No model `Service`, adicionar:
```prisma
  serviceProducts ServiceProduct[]
```

- [ ] **Step 3: Gerar e executar migration**

```bash
npx prisma migrate dev --name add-inventory-module
```

Saída esperada: `The following migration(s) have been applied: .../add-inventory-module`

- [ ] **Step 4: Verificar geração do Prisma Client**

```bash
npx prisma generate
```

Saída esperada: sem erros, `Generated Prisma Client`.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(database): adiciona modelos de inventário (Product, StockMovement, AppointmentProduct, ServiceProduct)"
```

---

## Task 2: Domain Events e Errors

**Files:**
- Modify: `src/shared/events/domain-events.ts`
- Modify: `src/shared/errors/domain-error.ts`

- [ ] **Step 1: Adicionar eventos de inventário em `domain-events.ts`**

Localizar o tipo `DomainEvent` (union type) e adicionar antes do fechamento `|` final:

```typescript
  | {
      type: 'product.sold'
      payload: {
        tenantId: string
        productId: string
        quantity: number
        totalAmount: number
        customerId?: string
      }
    }
  | {
      type: 'stock.purchased'
      payload: {
        tenantId: string
        productId: string
        quantity: number
        totalAmount: number
      }
    }
```

- [ ] **Step 2: Adicionar erros de inventário em `domain-error.ts`**

Ao final do arquivo, adicionar:

```typescript
// --- Inventory ---

export class ProductNotFoundError extends DomainError {
  constructor() {
    super('Produto não encontrado.', 'PRODUCT_NOT_FOUND', 404)
  }
}

export class InsufficientStockError extends DomainError {
  constructor(available: number, requested: number) {
    super(
      `Estoque insuficiente. Disponível: ${available}, solicitado: ${requested}.`,
      'INSUFFICIENT_STOCK',
      422,
      { available, requested },
    )
  }
}

export class CategoryHasProductsError extends DomainError {
  constructor() {
    super(
      'Não é possível remover categoria com produtos vinculados.',
      'CATEGORY_HAS_PRODUCTS',
      409,
    )
  }
}

export class CategoryNameConflictError extends DomainError {
  constructor(name: string) {
    super(`Categoria "${name}" já existe.`, 'CATEGORY_NAME_CONFLICT', 409, { name })
  }
}
```

- [ ] **Step 3: Adicionar item `produtos` ao NAV_REGISTRY**

Em `src/shared/permissions/nav-registry.ts`, dentro do array `NAV_REGISTRY`, inserir entre o item `servicos` e o item `clientes`:

```typescript
  {
    key: 'produtos',
    label: 'Produtos',
    description: 'Catálogo e estoque',
    icon: 'ShoppingBag',
    href: '/produtos',
    actions: ['view', 'create', 'edit', 'delete'],
    defaultPermissions: {
      MANAGER:      ['view', 'create', 'edit', 'delete'],
      PROFESSIONAL: ['view'],
      RECEPTIONIST: [],
    },
  },
```

- [ ] **Step 4: Commit**

```bash
git add src/shared/events/domain-events.ts src/shared/errors/domain-error.ts src/shared/permissions/nav-registry.ts
git commit -m "feat(inventory): adiciona eventos de domínio, erros tipados e item de navegação"
```

---

## Task 3: Types e Schemas

**Files:**
- Create: `src/domains/inventory/types.ts`

- [ ] **Step 1: Criar arquivo de tipos**

```typescript
// src/domains/inventory/types.ts
import { z } from 'zod'
import { StockMovementType } from '@prisma/client'

export const createProductSchema = z.object({
  name: z.string().trim().min(2).max(100),
  categoryId: z.string().cuid().optional(),
  costPrice: z.number().nonnegative(),
  salePrice: z.number().positive(),
  lowStockAlert: z.number().int().min(0).default(5),
  imageUrl: z.string().url().optional(),
})
export type CreateProductInput = z.infer<typeof createProductSchema>

export const updateProductSchema = createProductSchema.partial()
export type UpdateProductInput = z.infer<typeof updateProductSchema>

export const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(60),
})
export type CreateCategoryInput = z.infer<typeof createCategorySchema>

export const recordPurchaseSchema = z.object({
  quantity: z.number().int().min(1),
  unitPrice: z.number().nonnegative(),
  notes: z.string().trim().max(200).optional(),
})
export type RecordPurchaseInput = z.infer<typeof recordPurchaseSchema>

export const recordSaleSchema = z.object({
  quantity: z.number().int().min(1),
  unitPrice: z.number().nonnegative().optional(),
  customerId: z.string().cuid().optional(),
})
export type RecordSaleInput = z.infer<typeof recordSaleSchema>

export const appointmentProductsSchema = z.object({
  products: z.array(z.object({
    productId: z.string().cuid(),
    quantity: z.number().int().min(1),
  })),
})
export type AppointmentProductsInput = z.infer<typeof appointmentProductsSchema>

export const serviceTemplateSchema = z.object({
  products: z.array(z.object({
    productId: z.string().cuid(),
    quantity: z.number().int().min(1),
  })),
})
export type ServiceTemplateInput = z.infer<typeof serviceTemplateSchema>

export const listProductsSchema = z.object({
  name: z.string().trim().optional(),
  categoryId: z.string().cuid().optional(),
  lowStock: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})
export type ListProductsQuery = z.infer<typeof listProductsSchema>

export const listMovementsSchema = z.object({
  type: z.nativeEnum(StockMovementType).optional(),
  productId: z.string().cuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})
export type ListMovementsQuery = z.infer<typeof listMovementsSchema>
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/inventory/types.ts
git commit -m "feat(inventory): adiciona Zod schemas e tipos do domínio"
```

---

## Task 4: Product Repository

**Files:**
- Create: `src/domains/inventory/product.repository.ts`

- [ ] **Step 1: Criar repository**

```typescript
// src/domains/inventory/product.repository.ts
import { Prisma } from '@prisma/client'
import { prisma } from '@/shared/database/prisma'
import type { CreateProductInput, UpdateProductInput, ListProductsQuery } from './types'

export class ProductRepository {
  async findById(tenantId: string, id: string) {
    return prisma.product.findFirst({ where: { id, tenantId, active: true }, include: { category: true } })
  }

  async list(tenantId: string, filters: ListProductsQuery) {
    const { name, categoryId, lowStock, page = 1, pageSize = 20 } = filters

    const where: Prisma.ProductWhereInput = {
      tenantId,
      active: true,
      ...(name && { name: { contains: name, mode: 'insensitive' } }),
      ...(categoryId && { categoryId }),
    }

    const all = await prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: { name: 'asc' },
    })

    const filtered = lowStock ? all.filter(p => p.stockQuantity <= p.lowStockAlert) : all
    const total = filtered.length
    const skip = (page - 1) * pageSize
    const data = filtered.slice(skip, skip + pageSize)

    return { data, total, page, pageSize }
  }

  async create(tenantId: string, input: CreateProductInput) {
    return prisma.product.create({
      data: {
        tenantId,
        name: input.name,
        categoryId: input.categoryId,
        costPrice: new Prisma.Decimal(input.costPrice),
        salePrice: new Prisma.Decimal(input.salePrice),
        lowStockAlert: input.lowStockAlert ?? 5,
        imageUrl: input.imageUrl,
      },
      include: { category: true },
    })
  }

  async update(tenantId: string, id: string, input: UpdateProductInput) {
    return prisma.product.update({
      where: { id },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
        ...(input.costPrice !== undefined && { costPrice: new Prisma.Decimal(input.costPrice) }),
        ...(input.salePrice !== undefined && { salePrice: new Prisma.Decimal(input.salePrice) }),
        ...(input.lowStockAlert !== undefined && { lowStockAlert: input.lowStockAlert }),
        ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl }),
      },
      include: { category: true },
    })
  }

  async softDelete(tenantId: string, id: string) {
    return prisma.product.update({ where: { id }, data: { active: false } })
  }

  async incrementStock(tenantId: string, id: string, quantity: number) {
    return prisma.product.update({
      where: { id },
      data: { stockQuantity: { increment: quantity } },
    })
  }

  async decrementStock(tenantId: string, id: string, quantity: number) {
    return prisma.product.update({
      where: { id },
      data: { stockQuantity: { decrement: quantity } },
    })
  }

  // Categories
  async listCategories(tenantId: string) {
    return prisma.productCategory.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    })
  }

  async findCategoryById(tenantId: string, id: string) {
    return prisma.productCategory.findFirst({ where: { id, tenantId } })
  }

  async createCategory(tenantId: string, name: string) {
    return prisma.productCategory.create({ data: { tenantId, name } })
  }

  async deleteCategory(tenantId: string, id: string) {
    return prisma.productCategory.delete({ where: { id } })
  }

  async countProductsByCategory(tenantId: string, categoryId: string) {
    return prisma.product.count({ where: { tenantId, categoryId, active: true } })
  }

  // Service template
  async getServiceTemplate(tenantId: string, serviceId: string) {
    return prisma.serviceProduct.findMany({
      where: { tenantId, serviceId },
      include: { product: true },
    })
  }

  async saveServiceTemplate(tenantId: string, serviceId: string, products: Array<{ productId: string; quantity: number }>) {
    await prisma.serviceProduct.deleteMany({ where: { tenantId, serviceId } })
    if (products.length === 0) return []
    await prisma.serviceProduct.createMany({
      data: products.map(p => ({ tenantId, serviceId, productId: p.productId, quantity: p.quantity })),
    })
    return this.getServiceTemplate(tenantId, serviceId)
  }

  // Appointment products
  async getAppointmentProducts(tenantId: string, appointmentId: string) {
    return prisma.appointmentProduct.findMany({
      where: { tenantId, appointmentId },
      include: { product: true },
    })
  }

  async saveAppointmentProducts(tenantId: string, appointmentId: string, products: Array<{ productId: string; quantity: number }>) {
    await prisma.appointmentProduct.deleteMany({ where: { tenantId, appointmentId } })
    if (products.length === 0) return []
    await prisma.appointmentProduct.createMany({
      data: products.map(p => ({ tenantId, appointmentId, productId: p.productId, quantity: p.quantity })),
    })
  }
}

export const productRepository = new ProductRepository()
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/inventory/product.repository.ts
git commit -m "feat(inventory): adiciona ProductRepository com CRUD, categorias e templates"
```

---

## Task 5: Stock Repository

**Files:**
- Create: `src/domains/inventory/stock.repository.ts`

- [ ] **Step 1: Criar repository**

```typescript
// src/domains/inventory/stock.repository.ts
import { Prisma, StockMovementType } from '@prisma/client'
import { prisma } from '@/shared/database/prisma'
import type { ListMovementsQuery } from './types'

type CreateMovementData = {
  productId: string
  type: StockMovementType
  quantity: number
  unitPrice?: Prisma.Decimal
  totalAmount?: Prisma.Decimal
  notes?: string
  appointmentId?: string
  createdByUserId: string
}

export class StockRepository {
  async create(tenantId: string, data: CreateMovementData) {
    return prisma.stockMovement.create({
      data: { tenantId, ...data },
      include: { product: true },
    })
  }

  async list(tenantId: string, filters: ListMovementsQuery) {
    const { type, productId, from, to, page = 1, pageSize = 20 } = filters
    const skip = (page - 1) * pageSize

    const where: Prisma.StockMovementWhereInput = {
      tenantId,
      ...(type && { type }),
      ...(productId && { productId }),
      ...(from || to ? { createdAt: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } } : {}),
    }

    const [data, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        include: { product: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.stockMovement.count({ where }),
    ])

    return { data, total, page, pageSize }
  }
}

export const stockRepository = new StockRepository()
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/inventory/stock.repository.ts
git commit -m "feat(inventory): adiciona StockRepository"
```

---

## Task 6: Inventory Service

**Files:**
- Create: `src/domains/inventory/inventory.service.ts`

- [ ] **Step 1: Escrever teste que falha primeiro**

Criar `src/domains/inventory/__tests__/inventory.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InventoryService } from '../inventory.service'
import { InsufficientStockError, ProductNotFoundError, CategoryHasProductsError } from '@/shared/errors'
import { makeProduct } from '@/shared/test/factories/product.factory'

vi.mock('../product.repository', () => ({
  productRepository: {
    findById: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    incrementStock: vi.fn(),
    decrementStock: vi.fn(),
    listCategories: vi.fn(),
    findCategoryById: vi.fn(),
    createCategory: vi.fn(),
    deleteCategory: vi.fn(),
    countProductsByCategory: vi.fn(),
    getServiceTemplate: vi.fn(),
    saveServiceTemplate: vi.fn(),
    getAppointmentProducts: vi.fn(),
    saveAppointmentProducts: vi.fn(),
  },
}))

vi.mock('../stock.repository', () => ({
  stockRepository: {
    create: vi.fn(),
    list: vi.fn(),
  },
}))

vi.mock('@/shared/events/event-bus', () => ({
  eventBus: { publish: vi.fn(), subscribe: vi.fn() },
}))

import { productRepository } from '../product.repository'
import { stockRepository } from '../stock.repository'
import { eventBus } from '@/shared/events/event-bus'

const service = new InventoryService()

beforeEach(() => vi.clearAllMocks())

describe('recordSale', () => {
  it('lança InsufficientStockError quando estoque insuficiente', async () => {
    vi.mocked(productRepository.findById).mockResolvedValue(makeProduct({ stockQuantity: 2 }))
    await expect(service.recordSale('t1', { quantity: 5 }, 'u1')).rejects.toBeInstanceOf(InsufficientStockError)
  })

  it('decrementa estoque e publica evento product.sold', async () => {
    const product = makeProduct({ stockQuantity: 10, salePrice: '25.00' as unknown as any })
    vi.mocked(productRepository.findById).mockResolvedValue(product)
    vi.mocked(productRepository.decrementStock).mockResolvedValue(product)
    vi.mocked(stockRepository.create).mockResolvedValue({} as any)

    await service.recordSale('t1', { quantity: 2 }, 'u1')

    expect(productRepository.decrementStock).toHaveBeenCalledWith('t1', product.id, 2)
    expect(eventBus.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'product.sold' }))
  })
})

describe('recordPurchase', () => {
  it('incrementa estoque e publica evento stock.purchased', async () => {
    const product = makeProduct({ stockQuantity: 0 })
    vi.mocked(productRepository.findById).mockResolvedValue(product)
    vi.mocked(productRepository.incrementStock).mockResolvedValue(product)
    vi.mocked(stockRepository.create).mockResolvedValue({} as any)

    await service.recordPurchase('t1', { quantity: 10, unitPrice: 15 }, 'u1')

    expect(productRepository.incrementStock).toHaveBeenCalledWith('t1', product.id, 10)
    expect(eventBus.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'stock.purchased' }))
  })
})

describe('deleteCategory', () => {
  it('lança CategoryHasProductsError quando há produtos vinculados', async () => {
    vi.mocked(productRepository.countProductsByCategory).mockResolvedValue(3)
    await expect(service.deleteCategory('t1', 'cat1')).rejects.toBeInstanceOf(CategoryHasProductsError)
  })
})

describe('finalizeAppointmentProducts', () => {
  it('lança InsufficientStockError se algum produto não tem estoque suficiente', async () => {
    vi.mocked(productRepository.findById).mockResolvedValue(makeProduct({ stockQuantity: 1 }))
    await expect(
      service.finalizeAppointmentProducts('t1', 'appt1', { products: [{ productId: 'p1', quantity: 5 }] }, 'u1')
    ).rejects.toBeInstanceOf(InsufficientStockError)
  })
})
```

- [ ] **Step 2: Rodar teste para confirmar que falha**

```bash
npx vitest run src/domains/inventory/__tests__/inventory.service.test.ts
```

Esperado: `FAIL` com `Cannot find module '../inventory.service'`

- [ ] **Step 3: Criar factory de produtos**

Criar `src/shared/test/factories/product.factory.ts`:

```typescript
import type { Product } from '@prisma/client'
import { Prisma } from '@prisma/client'

export function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'product-test-id',
    tenantId: 'tenant-test-id',
    name: 'Shampoo Profissional',
    categoryId: null,
    costPrice: new Prisma.Decimal('10.00'),
    salePrice: new Prisma.Decimal('25.00'),
    stockQuantity: 10,
    lowStockAlert: 5,
    active: true,
    imageUrl: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}
```

- [ ] **Step 4: Criar inventory.service.ts**

```typescript
// src/domains/inventory/inventory.service.ts
import { Prisma } from '@prisma/client'
import { eventBus } from '@/shared/events/event-bus'
import {
  ProductNotFoundError,
  InsufficientStockError,
  CategoryHasProductsError,
  CategoryNameConflictError,
} from '@/shared/errors'
import { productRepository } from './product.repository'
import { stockRepository } from './stock.repository'
import type {
  CreateProductInput,
  UpdateProductInput,
  RecordPurchaseInput,
  RecordSaleInput,
  AppointmentProductsInput,
  ServiceTemplateInput,
  ListProductsQuery,
  ListMovementsQuery,
} from './types'

export class InventoryService {
  async listProducts(tenantId: string, filters: ListProductsQuery) {
    return productRepository.list(tenantId, filters)
  }

  async createProduct(tenantId: string, input: CreateProductInput) {
    return productRepository.create(tenantId, input)
  }

  async updateProduct(tenantId: string, id: string, input: UpdateProductInput) {
    const product = await productRepository.findById(tenantId, id)
    if (!product) throw new ProductNotFoundError()
    return productRepository.update(tenantId, id, input)
  }

  async deleteProduct(tenantId: string, id: string) {
    const product = await productRepository.findById(tenantId, id)
    if (!product) throw new ProductNotFoundError()
    return productRepository.softDelete(tenantId, id)
  }

  async listCategories(tenantId: string) {
    return productRepository.listCategories(tenantId)
  }

  async createCategory(tenantId: string, name: string) {
    return productRepository.createCategory(tenantId, name)
  }

  async deleteCategory(tenantId: string, id: string) {
    const count = await productRepository.countProductsByCategory(tenantId, id)
    if (count > 0) throw new CategoryHasProductsError()
    return productRepository.deleteCategory(tenantId, id)
  }

  async recordPurchase(tenantId: string, input: RecordPurchaseInput, createdByUserId: string) {
    const product = await productRepository.findById(tenantId, input.productId ?? '')
    if (!product) throw new ProductNotFoundError()

    const totalAmount = input.quantity * input.unitPrice

    await productRepository.incrementStock(tenantId, product.id, input.quantity)

    const movement = await stockRepository.create(tenantId, {
      productId: product.id,
      type: 'PURCHASE',
      quantity: input.quantity,
      unitPrice: new Prisma.Decimal(input.unitPrice),
      totalAmount: new Prisma.Decimal(totalAmount),
      notes: input.notes,
      createdByUserId,
    })

    eventBus.publish({
      type: 'stock.purchased',
      payload: { tenantId, productId: product.id, quantity: input.quantity, totalAmount },
    })

    return movement
  }

  async recordSale(tenantId: string, input: RecordSaleInput & { productId?: string }, createdByUserId: string) {
    const product = await productRepository.findById(tenantId, input.productId ?? '')
    if (!product) throw new ProductNotFoundError()

    if (product.stockQuantity < input.quantity) {
      throw new InsufficientStockError(product.stockQuantity, input.quantity)
    }

    const unitPrice = input.unitPrice ?? Number(product.salePrice)
    const totalAmount = input.quantity * unitPrice

    await productRepository.decrementStock(tenantId, product.id, input.quantity)

    const movement = await stockRepository.create(tenantId, {
      productId: product.id,
      type: 'SALE',
      quantity: -input.quantity,
      unitPrice: new Prisma.Decimal(unitPrice),
      totalAmount: new Prisma.Decimal(totalAmount),
      createdByUserId,
    })

    eventBus.publish({
      type: 'product.sold',
      payload: {
        tenantId,
        productId: product.id,
        quantity: input.quantity,
        totalAmount,
        customerId: input.customerId,
      },
    })

    return movement
  }

  async getServiceTemplate(tenantId: string, serviceId: string) {
    return productRepository.getServiceTemplate(tenantId, serviceId)
  }

  async saveServiceTemplate(tenantId: string, serviceId: string, input: ServiceTemplateInput) {
    return productRepository.saveServiceTemplate(tenantId, serviceId, input.products)
  }

  async finalizeAppointmentProducts(
    tenantId: string,
    appointmentId: string,
    input: AppointmentProductsInput,
    createdByUserId: string,
  ) {
    for (const item of input.products) {
      const product = await productRepository.findById(tenantId, item.productId)
      if (!product) throw new ProductNotFoundError()
      if (product.stockQuantity < item.quantity) {
        throw new InsufficientStockError(product.stockQuantity, item.quantity)
      }
    }

    await productRepository.saveAppointmentProducts(tenantId, appointmentId, input.products)

    for (const item of input.products) {
      await productRepository.decrementStock(tenantId, item.productId, item.quantity)
      await stockRepository.create(tenantId, {
        productId: item.productId,
        type: 'APPOINTMENT_USE',
        quantity: -item.quantity,
        appointmentId,
        createdByUserId,
      })
    }

    return productRepository.getAppointmentProducts(tenantId, appointmentId)
  }

  async getAppointmentProducts(tenantId: string, appointmentId: string) {
    return productRepository.getAppointmentProducts(tenantId, appointmentId)
  }

  async listMovements(tenantId: string, filters: ListMovementsQuery) {
    return stockRepository.list(tenantId, filters)
  }
}

export const inventoryService = new InventoryService()
```

Nota: o `recordPurchase` e `recordSale` nas API routes receberão o `productId` via path param e injetarão em `input` antes de chamar o service. Veja Task 8.

- [ ] **Step 5: Rodar testes para confirmar que passam**

```bash
npx vitest run src/domains/inventory/__tests__/inventory.service.test.ts
```

Esperado: `PASS` — todos os testes verdes.

- [ ] **Step 6: Commit**

```bash
git add src/domains/inventory/inventory.service.ts src/domains/inventory/__tests__/inventory.service.test.ts src/shared/test/factories/product.factory.ts
git commit -m "feat(inventory): adiciona InventoryService com testes (recordSale, recordPurchase, deleteCategory, finalizeAppointmentProducts)"
```

---

## Task 7: Subscriptions e Runtime

**Files:**
- Create: `src/domains/inventory/subscriptions.ts`
- Modify: `src/domains/financial/subscriptions.ts`
- Modify: `src/app/api/_lib/runtime.ts`

- [ ] **Step 1: Criar subscriptions de inventário**

```typescript
// src/domains/inventory/subscriptions.ts
let inventorySubscriptionsRegistered = false

export function registerInventorySubscriptions() {
  if (inventorySubscriptionsRegistered) return
  inventorySubscriptionsRegistered = true
  // Sem eventos externos para ouvir nesta fase
}
```

- [ ] **Step 2: Adicionar handlers em `financial/subscriptions.ts`**

Dentro de `registerFinancialSubscriptions()`, após os handlers existentes, adicionar:

```typescript
import { Prisma, TransactionType } from "@prisma/client";
// ... (já importado)

// Adicionar dentro da função, após os handlers existentes:
eventBus.subscribe('product.sold', async (payload) => {
  await transactionRepository.create(payload.tenantId, {
    type: TransactionType.INCOME,
    category: 'Venda de Produto',
    description: `Venda de produto (qtd: ${payload.quantity})`,
    amount: new Prisma.Decimal(payload.totalAmount),
    paidAt: new Date(),
  })
})

eventBus.subscribe('stock.purchased', async (payload) => {
  await transactionRepository.create(payload.tenantId, {
    type: TransactionType.EXPENSE,
    category: 'Compra de Estoque',
    description: `Compra de estoque (qtd: ${payload.quantity})`,
    amount: new Prisma.Decimal(payload.totalAmount),
    paidAt: new Date(),
  })
})
```

- [ ] **Step 3: Registrar no runtime**

Em `src/app/api/_lib/runtime.ts`, adicionar o import e a chamada:

```typescript
import { registerInventorySubscriptions } from '@/domains/inventory/subscriptions'

// Dentro de initializeDomainRuntime(), junto com os outros registros:
registerInventorySubscriptions()
```

- [ ] **Step 4: Commit**

```bash
git add src/domains/inventory/subscriptions.ts src/domains/financial/subscriptions.ts src/app/api/_lib/runtime.ts
git commit -m "feat(inventory): registra subscriptions e handlers financeiros para eventos de produto"
```

---

## Task 8: API Routes

**Files:**
- Create: `src/app/api/products/route.ts`
- Create: `src/app/api/products/[id]/route.ts`
- Create: `src/app/api/products/categories/route.ts`
- Create: `src/app/api/products/categories/[id]/route.ts`
- Create: `src/app/api/products/[id]/purchase/route.ts`
- Create: `src/app/api/products/[id]/sell/route.ts`
- Create: `src/app/api/products/movements/route.ts`
- Create: `src/app/api/services/[id]/products/route.ts`
- Create: `src/app/api/appointments/[id]/products/route.ts`

- [ ] **Step 1: Criar `/api/products/route.ts`**

```typescript
// src/app/api/products/route.ts
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { ensurePermission } from '@/shared/auth/permissions'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { inventoryService } from '@/domains/inventory/inventory.service'
import { createProductSchema, listProductsSchema } from '@/domains/inventory/types'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, 'produtos', 'view')
    const url = new URL(request.url)
    const filters = listProductsSchema.parse(Object.fromEntries(url.searchParams))
    const result = await inventoryService.listProducts(session.tenantId, filters)
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, 'produtos', 'create')
    const input = await validateInput(request, createProductSchema)
    const result = await inventoryService.createProduct(session.tenantId, input)
    return Response.json(result, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 2: Criar `/api/products/[id]/route.ts`**

```typescript
// src/app/api/products/[id]/route.ts
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { ensurePermission } from '@/shared/auth/permissions'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { inventoryService } from '@/domains/inventory/inventory.service'
import { updateProductSchema } from '@/domains/inventory/types'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, 'produtos', 'edit')
    const { id } = await params
    const input = await validateInput(request, updateProductSchema)
    const result = await inventoryService.updateProduct(session.tenantId, id, input)
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    const request = _request
    const session = await getSessionContext(request)
    ensurePermission(session, 'produtos', 'delete')
    const { id } = await params
    await inventoryService.deleteProduct(session.tenantId, id)
    return new Response(null, { status: 204 })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 3: Criar `/api/products/categories/route.ts`**

```typescript
// src/app/api/products/categories/route.ts
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { ensurePermission } from '@/shared/auth/permissions'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { inventoryService } from '@/domains/inventory/inventory.service'
import { createCategorySchema } from '@/domains/inventory/types'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, 'produtos', 'view')
    const result = await inventoryService.listCategories(session.tenantId)
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, 'produtos', 'create')
    const input = await validateInput(request, createCategorySchema)
    const result = await inventoryService.createCategory(session.tenantId, input.name)
    return Response.json(result, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 4: Criar `/api/products/categories/[id]/route.ts`**

```typescript
// src/app/api/products/categories/[id]/route.ts
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { ensurePermission } from '@/shared/auth/permissions'
import { handleApiError } from '@/shared/http/handle-api-error'
import { inventoryService } from '@/domains/inventory/inventory.service'

type Params = { params: Promise<{ id: string }> }

export async function DELETE(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, 'produtos', 'delete')
    const { id } = await params
    await inventoryService.deleteCategory(session.tenantId, id)
    return new Response(null, { status: 204 })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 5: Criar `/api/products/[id]/purchase/route.ts`**

```typescript
// src/app/api/products/[id]/purchase/route.ts
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { ensurePermission } from '@/shared/auth/permissions'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { inventoryService } from '@/domains/inventory/inventory.service'
import { recordPurchaseSchema } from '@/domains/inventory/types'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, 'produtos', 'edit')
    const { id } = await params
    const input = await validateInput(request, recordPurchaseSchema)
    const result = await inventoryService.recordPurchase(
      session.tenantId,
      { ...input, productId: id },
      session.userId,
    )
    return Response.json(result, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 6: Criar `/api/products/[id]/sell/route.ts`**

```typescript
// src/app/api/products/[id]/sell/route.ts
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { ensurePermission } from '@/shared/auth/permissions'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { inventoryService } from '@/domains/inventory/inventory.service'
import { recordSaleSchema } from '@/domains/inventory/types'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, 'produtos', 'edit')
    const { id } = await params
    const input = await validateInput(request, recordSaleSchema)
    const result = await inventoryService.recordSale(
      session.tenantId,
      { ...input, productId: id },
      session.userId,
    )
    return Response.json(result, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 7: Criar `/api/products/movements/route.ts`**

```typescript
// src/app/api/products/movements/route.ts
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { ensurePermission } from '@/shared/auth/permissions'
import { handleApiError } from '@/shared/http/handle-api-error'
import { inventoryService } from '@/domains/inventory/inventory.service'
import { listMovementsSchema } from '@/domains/inventory/types'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, 'produtos', 'view')
    const url = new URL(request.url)
    const filters = listMovementsSchema.parse(Object.fromEntries(url.searchParams))
    const result = await inventoryService.listMovements(session.tenantId, filters)
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 8: Criar `/api/services/[id]/products/route.ts`**

```typescript
// src/app/api/services/[id]/products/route.ts
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { ensurePermission } from '@/shared/auth/permissions'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { inventoryService } from '@/domains/inventory/inventory.service'
import { serviceTemplateSchema } from '@/domains/inventory/types'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, 'produtos', 'view')
    const { id } = await params
    const result = await inventoryService.getServiceTemplate(session.tenantId, id)
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, 'produtos', 'edit')
    const { id } = await params
    const input = await validateInput(request, serviceTemplateSchema)
    const result = await inventoryService.saveServiceTemplate(session.tenantId, id, input)
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 9: Criar `/api/appointments/[id]/products/route.ts`**

```typescript
// src/app/api/appointments/[id]/products/route.ts
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { ensurePermission } from '@/shared/auth/permissions'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { inventoryService } from '@/domains/inventory/inventory.service'
import { appointmentProductsSchema } from '@/domains/inventory/types'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, 'produtos', 'view')
    const { id } = await params
    const result = await inventoryService.getAppointmentProducts(session.tenantId, id)
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, 'produtos', 'edit')
    const { id } = await params
    const input = await validateInput(request, appointmentProductsSchema)
    const result = await inventoryService.finalizeAppointmentProducts(
      session.tenantId,
      id,
      input,
      session.userId,
    )
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 10: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 11: Commit**

```bash
git add src/app/api/products/ src/app/api/services/ src/app/api/appointments/
git commit -m "feat(inventory): adiciona todas as API Routes do módulo de produtos e estoque"
```

---

## Task 9: Repository Tests

**Files:**
- Create: `src/domains/inventory/__tests__/product.repository.test.ts`
- Create: `src/domains/inventory/__tests__/stock.repository.test.ts`

- [ ] **Step 1: Criar testes do product repository**

```typescript
// src/domains/inventory/__tests__/product.repository.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'
import { makeProduct } from '@/shared/test/factories/product.factory'

vi.mock('@/shared/database/prisma', () => ({
  prisma: {
    product: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    productCategory: {
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    serviceProduct: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    appointmentProduct: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
  },
}))

import { prisma } from '@/shared/database/prisma'
import { ProductRepository } from '../product.repository'

const repo = new ProductRepository()

beforeEach(() => vi.clearAllMocks())

describe('findById', () => {
  it('sempre filtra por tenantId', async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValue(null)
    await repo.findById('tenant-A', 'prod-1')
    expect(prisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-A', id: 'prod-1' }) })
    )
  })
})

describe('list', () => {
  it('aplica filtro lowStock em memória', async () => {
    const products = [
      makeProduct({ id: 'p1', stockQuantity: 3, lowStockAlert: 5 }),
      makeProduct({ id: 'p2', stockQuantity: 10, lowStockAlert: 5 }),
    ]
    vi.mocked(prisma.product.findMany).mockResolvedValue(products as any)

    const result = await repo.list('t1', { lowStock: true, page: 1, pageSize: 20 })

    expect(result.data).toHaveLength(1)
    expect(result.data[0].id).toBe('p1')
  })

  it('retorna todos quando lowStock não está definido', async () => {
    const products = [makeProduct({ id: 'p1' }), makeProduct({ id: 'p2' })]
    vi.mocked(prisma.product.findMany).mockResolvedValue(products as any)

    const result = await repo.list('t1', { page: 1, pageSize: 20 })
    expect(result.data).toHaveLength(2)
  })
})

describe('incrementStock / decrementStock', () => {
  it('usa increment do Prisma ao registrar compra', async () => {
    vi.mocked(prisma.product.update).mockResolvedValue(makeProduct() as any)
    await repo.incrementStock('t1', 'p1', 10)
    expect(prisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { stockQuantity: { increment: 10 } } })
    )
  })

  it('usa decrement do Prisma ao registrar venda', async () => {
    vi.mocked(prisma.product.update).mockResolvedValue(makeProduct() as any)
    await repo.decrementStock('t1', 'p1', 3)
    expect(prisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { stockQuantity: { decrement: 3 } } })
    )
  })
})
```

- [ ] **Step 2: Criar testes do stock repository**

```typescript
// src/domains/inventory/__tests__/stock.repository.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/shared/database/prisma', () => ({
  prisma: {
    stockMovement: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}))

import { prisma } from '@/shared/database/prisma'
import { StockRepository } from '../stock.repository'

const repo = new StockRepository()

beforeEach(() => vi.clearAllMocks())

describe('list', () => {
  it('sempre filtra por tenantId', async () => {
    vi.mocked(prisma.stockMovement.findMany).mockResolvedValue([])
    vi.mocked(prisma.stockMovement.count).mockResolvedValue(0)

    await repo.list('tenant-X', { page: 1, pageSize: 20 })

    expect(prisma.stockMovement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-X' }) })
    )
  })

  it('aplica filtro por tipo de movimentação', async () => {
    vi.mocked(prisma.stockMovement.findMany).mockResolvedValue([])
    vi.mocked(prisma.stockMovement.count).mockResolvedValue(0)

    await repo.list('t1', { type: 'PURCHASE', page: 1, pageSize: 20 })

    expect(prisma.stockMovement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ type: 'PURCHASE' }) })
    )
  })
})
```

- [ ] **Step 3: Rodar todos os testes**

```bash
npx vitest run src/domains/inventory/
```

Esperado: todos passando.

- [ ] **Step 4: Commit**

```bash
git add src/domains/inventory/__tests__/
git commit -m "test(inventory): adiciona testes dos repositories (isolamento de tenant, filtros)"
```

---

## Task 10: Frontend — Hooks

**Files:**
- Create: `src/hooks/use-products.ts`
- Create: `src/hooks/use-product-categories.ts`
- Create: `src/hooks/use-stock-movements.ts`
- Create: `src/hooks/use-service-template.ts`
- Create: `src/hooks/use-appointment-products.ts`

- [ ] **Step 1: Criar hooks**

```typescript
// src/hooks/use-products.ts
'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ListProductsQuery, CreateProductInput, UpdateProductInput } from '@/domains/inventory/types'

async function fetchProducts(filters: Partial<ListProductsQuery>) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => v !== undefined && params.set(k, String(v)))
  const res = await fetch(`/api/products?${params}`)
  if (!res.ok) throw new Error('Falha ao buscar produtos')
  return res.json()
}

export function useProducts(filters: Partial<ListProductsQuery> = {}) {
  return useQuery({ queryKey: ['products', filters], queryFn: () => fetchProducts(filters) })
}

export function useCreateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateProductInput) => {
      const res = await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
      if (!res.ok) throw new Error((await res.json())?.error?.message ?? 'Erro ao criar produto')
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}

export function useUpdateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateProductInput & { id: string }) => {
      const res = await fetch(`/api/products/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
      if (!res.ok) throw new Error((await res.json())?.error?.message ?? 'Erro ao atualizar produto')
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}

export function useDeleteProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao remover produto')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}

export function useRecordPurchase(productId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { quantity: number; unitPrice: number; notes?: string }) => {
      const res = await fetch(`/api/products/${productId}/purchase`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
      if (!res.ok) throw new Error((await res.json())?.error?.message ?? 'Erro ao registrar compra')
      return res.json()
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); qc.invalidateQueries({ queryKey: ['stock-movements'] }) },
  })
}

export function useRecordSale(productId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { quantity: number; unitPrice?: number; customerId?: string }) => {
      const res = await fetch(`/api/products/${productId}/sell`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
      if (!res.ok) throw new Error((await res.json())?.error?.message ?? 'Erro ao registrar venda')
      return res.json()
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); qc.invalidateQueries({ queryKey: ['stock-movements'] }) },
  })
}
```

```typescript
// src/hooks/use-product-categories.ts
'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export function useProductCategories() {
  return useQuery({
    queryKey: ['product-categories'],
    queryFn: async () => {
      const res = await fetch('/api/products/categories')
      if (!res.ok) throw new Error('Falha ao buscar categorias')
      return res.json()
    },
  })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch('/api/products/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
      if (!res.ok) throw new Error((await res.json())?.error?.message ?? 'Erro ao criar categoria')
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product-categories'] }),
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/products/categories/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json())?.error?.message ?? 'Erro ao remover categoria')
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['product-categories'] }); qc.invalidateQueries({ queryKey: ['products'] }) },
  })
}
```

```typescript
// src/hooks/use-stock-movements.ts
'use client'
import { useQuery } from '@tanstack/react-query'
import type { ListMovementsQuery } from '@/domains/inventory/types'

export function useStockMovements(filters: Partial<ListMovementsQuery> = {}) {
  return useQuery({
    queryKey: ['stock-movements', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([k, v]) => v !== undefined && params.set(k, String(v)))
      const res = await fetch(`/api/products/movements?${params}`)
      if (!res.ok) throw new Error('Falha ao buscar movimentações')
      return res.json()
    },
  })
}
```

```typescript
// src/hooks/use-service-template.ts
'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ServiceTemplateInput } from '@/domains/inventory/types'

export function useServiceTemplate(serviceId: string | undefined) {
  return useQuery({
    queryKey: ['service-template', serviceId],
    queryFn: async () => {
      const res = await fetch(`/api/services/${serviceId}/products`)
      if (!res.ok) throw new Error('Falha ao buscar template')
      return res.json()
    },
    enabled: !!serviceId,
  })
}

export function useSaveServiceTemplate(serviceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: ServiceTemplateInput) => {
      const res = await fetch(`/api/services/${serviceId}/products`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
      if (!res.ok) throw new Error('Erro ao salvar template')
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['service-template', serviceId] }),
  })
}
```

```typescript
// src/hooks/use-appointment-products.ts
'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AppointmentProductsInput } from '@/domains/inventory/types'

export function useAppointmentProducts(appointmentId: string | undefined) {
  return useQuery({
    queryKey: ['appointment-products', appointmentId],
    queryFn: async () => {
      const res = await fetch(`/api/appointments/${appointmentId}/products`)
      if (!res.ok) throw new Error('Falha ao buscar produtos do atendimento')
      return res.json()
    },
    enabled: !!appointmentId,
  })
}

export function useSaveAppointmentProducts(appointmentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: AppointmentProductsInput) => {
      const res = await fetch(`/api/appointments/${appointmentId}/products`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
      if (!res.ok) throw new Error((await res.json())?.error?.message ?? 'Erro ao salvar produtos')
      return res.json()
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['appointment-products', appointmentId] }); qc.invalidateQueries({ queryKey: ['products'] }) },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/use-products.ts src/hooks/use-product-categories.ts src/hooks/use-stock-movements.ts src/hooks/use-service-template.ts src/hooks/use-appointment-products.ts
git commit -m "feat(inventory): adiciona hooks TanStack Query para produtos, categorias e movimentações"
```

---

## Task 11: Componentes Base

**Files:**
- Create: `src/components/domain/inventory/ProductsTable.tsx`
- Create: `src/components/domain/inventory/CategoryManagerModal.tsx`

- [ ] **Step 1: Criar ProductsTable.tsx**

```tsx
// src/components/domain/inventory/ProductsTable.tsx
'use client'
import { Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type Product = {
  id: string
  name: string
  category: { name: string } | null
  salePrice: string | number
  stockQuantity: number
  lowStockAlert: number
}

type Props = {
  products: Product[]
  onEdit: (product: Product) => void
  onDelete: (product: Product) => void
}

function formatCurrency(value: string | number) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function ProductsTable({ products, onEdit, onDelete }: Props) {
  if (products.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Nenhum produto encontrado. Adicione o primeiro produto.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Produto</TableHead>
          <TableHead>Categoria</TableHead>
          <TableHead className="text-right">Preço de Venda</TableHead>
          <TableHead className="text-right">Estoque</TableHead>
          <TableHead className="text-right">Patrimônio</TableHead>
          <TableHead className="w-20" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => {
          const isLowStock = product.stockQuantity <= product.lowStockAlert
          const patrimony = Number(product.salePrice) * product.stockQuantity
          return (
            <TableRow key={product.id}>
              <TableCell className="font-medium">{product.name}</TableCell>
              <TableCell className="text-muted-foreground">
                {product.category?.name ?? '—'}
              </TableCell>
              <TableCell className="text-right">{formatCurrency(product.salePrice)}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <span>{product.stockQuantity}</span>
                  <Badge
                    variant="secondary"
                    className={isLowStock
                      ? 'bg-orange-100 text-orange-700 text-xs'
                      : 'bg-emerald-100 text-emerald-700 text-xs'}
                  >
                    {isLowStock ? 'POUCO ESTOQUE' : 'COM ESTOQUE'}
                  </Badge>
                </div>
              </TableCell>
              <TableCell className="text-right">{formatCurrency(patrimony)}</TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => onEdit(product)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={() => onDelete(product)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 2: Criar CategoryManagerModal.tsx**

```tsx
// src/components/domain/inventory/CategoryManagerModal.tsx
'use client'
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useProductCategories, useCreateCategory, useDeleteCategory } from '@/hooks/use-product-categories'

type Props = { open: boolean; onClose: () => void }

export function CategoryManagerModal({ open, onClose }: Props) {
  const [name, setName] = useState('')
  const { data: categories = [], isLoading } = useProductCategories()
  const createCategory = useCreateCategory()
  const deleteCategory = useDeleteCategory()

  async function handleCreate() {
    if (!name.trim()) return
    try {
      await createCategory.mutateAsync(name.trim())
      setName('')
      toast.success('Categoria criada')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar categoria')
    }
  }

  async function handleDelete(id: string, catName: string) {
    try {
      await deleteCategory.mutateAsync(id)
      toast.success(`Categoria "${catName}" removida`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover categoria')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Gerenciar Categorias</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Nome da categoria"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <Button onClick={handleCreate} disabled={createCategory.isPending || !name.trim()}>
              <Plus className="size-4" />
            </Button>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1">
            {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
            {categories.map((cat: { id: string; name: string }) => (
              <div key={cat.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <span className="text-sm">{cat.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(cat.id, cat.name)}
                  disabled={deleteCategory.isPending}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
            {!isLoading && categories.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma categoria</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/inventory/ProductsTable.tsx src/components/domain/inventory/CategoryManagerModal.tsx
git commit -m "feat(inventory): adiciona ProductsTable e CategoryManagerModal"
```

---

## Task 12: Modais de Produto e Estoque

**Files:**
- Create: `src/components/domain/inventory/ProductFormModal.tsx`
- Create: `src/components/domain/inventory/StockPurchaseModal.tsx`
- Create: `src/components/domain/inventory/StockSaleModal.tsx`
- Create: `src/components/domain/inventory/StockMovementsTable.tsx`

- [ ] **Step 1: Criar ProductFormModal.tsx**

```tsx
// src/components/domain/inventory/ProductFormModal.tsx
'use client'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createProductSchema, type CreateProductInput } from '@/domains/inventory/types'
import { useCreateProduct, useUpdateProduct } from '@/hooks/use-products'
import { useProductCategories } from '@/hooks/use-product-categories'

type Product = { id: string; name: string; categoryId?: string | null; costPrice: string | number; salePrice: string | number; lowStockAlert: number; imageUrl?: string | null }

type Props = {
  open: boolean
  onClose: () => void
  product?: Product | null
}

export function ProductFormModal({ open, onClose, product }: Props) {
  const isEdit = !!product
  const { data: categories = [] } = useProductCategories()
  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct()

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<CreateProductInput>({
    resolver: zodResolver(createProductSchema),
    defaultValues: { lowStockAlert: 5 },
  })

  useEffect(() => {
    if (product) {
      reset({
        name: product.name,
        categoryId: product.categoryId ?? undefined,
        costPrice: Number(product.costPrice),
        salePrice: Number(product.salePrice),
        lowStockAlert: product.lowStockAlert,
        imageUrl: product.imageUrl ?? undefined,
      })
    } else {
      reset({ lowStockAlert: 5 })
    }
  }, [product, reset])

  async function onSubmit(data: CreateProductInput) {
    try {
      if (isEdit && product) {
        await updateProduct.mutateAsync({ id: product.id, ...data })
        toast.success('Produto atualizado')
      } else {
        await createProduct.mutateAsync(data)
        toast.success('Produto criado')
      }
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar produto')
    }
  }

  const isPending = createProduct.isPending || updateProduct.isPending

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" {...register('name')} placeholder="Ex: Shampoo Profissional" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select onValueChange={(v) => setValue('categoryId', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat: { id: string; name: string }) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="costPrice">Preço de Custo *</Label>
              <Input id="costPrice" type="number" step="0.01" min="0" {...register('costPrice', { valueAsNumber: true })} placeholder="0,00" />
              {errors.costPrice && <p className="text-xs text-destructive">{errors.costPrice.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="salePrice">Preço de Venda *</Label>
              <Input id="salePrice" type="number" step="0.01" min="0.01" {...register('salePrice', { valueAsNumber: true })} placeholder="0,00" />
              {errors.salePrice && <p className="text-xs text-destructive">{errors.salePrice.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lowStockAlert">Alerta de baixo estoque</Label>
            <Input id="lowStockAlert" type="number" min="0" {...register('lowStockAlert', { valueAsNumber: true })} />
            <p className="text-xs text-muted-foreground">Quantidade mínima antes de alertar</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar produto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Criar StockPurchaseModal.tsx**

```tsx
// src/components/domain/inventory/StockPurchaseModal.tsx
'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useProducts, useRecordPurchase } from '@/hooks/use-products'

type Props = { open: boolean; onClose: () => void }

export function StockPurchaseModal({ open, onClose }: Props) {
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [unitPrice, setUnitPrice] = useState(0)
  const [notes, setNotes] = useState('')

  const { data } = useProducts({ pageSize: 100 })
  const products: Array<{ id: string; name: string; costPrice: string | number }> = data?.data ?? []

  const recordPurchase = useRecordPurchase(productId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!productId) { toast.error('Selecione um produto'); return }
    try {
      await recordPurchase.mutateAsync({ quantity, unitPrice, notes: notes || undefined })
      toast.success('Compra registrada com sucesso')
      onClose()
      setProductId(''); setQuantity(1); setUnitPrice(0); setNotes('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao registrar compra')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Registrar Compra de Estoque</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Produto *</Label>
            <Select onValueChange={(v) => { setProductId(v); const p = products.find(x => x.id === v); if (p) setUnitPrice(Number(p.costPrice)) }}>
              <SelectTrigger><SelectValue placeholder="Selecionar produto" /></SelectTrigger>
              <SelectContent>
                {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Quantidade *</Label>
              <Input type="number" min="1" value={quantity} onChange={e => setQuantity(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor Unitário *</Label>
              <Input type="number" step="0.01" min="0" value={unitPrice} onChange={e => setUnitPrice(Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcional" rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={recordPurchase.isPending}>
              {recordPurchase.isPending ? 'Registrando...' : 'Registrar Compra'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Criar StockSaleModal.tsx**

```tsx
// src/components/domain/inventory/StockSaleModal.tsx
'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useProducts, useRecordSale } from '@/hooks/use-products'

type Props = { open: boolean; onClose: () => void }

export function StockSaleModal({ open, onClose }: Props) {
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [unitPrice, setUnitPrice] = useState<number | undefined>(undefined)

  const { data } = useProducts({ pageSize: 100 })
  const products: Array<{ id: string; name: string; salePrice: string | number; stockQuantity: number }> = data?.data ?? []

  const recordSale = useRecordSale(productId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!productId) { toast.error('Selecione um produto'); return }
    try {
      await recordSale.mutateAsync({ quantity, unitPrice })
      toast.success('Venda registrada com sucesso')
      onClose()
      setProductId(''); setQuantity(1); setUnitPrice(undefined)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao registrar venda')
    }
  }

  const selectedProduct = products.find(p => p.id === productId)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Registrar Venda Avulsa</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Produto *</Label>
            <Select onValueChange={(v) => { setProductId(v); const p = products.find(x => x.id === v); if (p) setUnitPrice(Number(p.salePrice)) }}>
              <SelectTrigger><SelectValue placeholder="Selecionar produto" /></SelectTrigger>
              <SelectContent>
                {products.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} (Estoque: {p.stockQuantity})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedProduct && (
            <p className="text-xs text-muted-foreground">
              Estoque disponível: {selectedProduct.stockQuantity} · Preço sugerido: R$ {Number(selectedProduct.salePrice).toFixed(2)}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Quantidade *</Label>
              <Input type="number" min="1" value={quantity} onChange={e => setQuantity(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor Unitário</Label>
              <Input type="number" step="0.01" min="0" value={unitPrice ?? ''} onChange={e => setUnitPrice(e.target.value ? Number(e.target.value) : undefined)} placeholder="Preço do produto" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={recordSale.isPending}>
              {recordSale.isPending ? 'Registrando...' : 'Registrar Venda'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Criar StockMovementsTable.tsx**

```tsx
// src/components/domain/inventory/StockMovementsTable.tsx
'use client'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type Movement = {
  id: string
  createdAt: string
  product: { name: string }
  quantity: number
  unitPrice?: string | number | null
  totalAmount?: string | number | null
  notes?: string | null
}

type Props = {
  movements: Movement[]
  mode: 'purchase' | 'sale'
}

function formatCurrency(value?: string | number | null) {
  if (value == null) return '—'
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function StockMovementsTable({ movements, mode }: Props) {
  if (movements.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Nenhuma movimentação encontrada.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>Produto</TableHead>
          <TableHead className="text-right">Quantidade</TableHead>
          <TableHead className="text-right">Valor Unitário</TableHead>
          <TableHead className="text-right">Total</TableHead>
          {mode === 'purchase' && <TableHead>Observações</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {movements.map((m) => (
          <TableRow key={m.id}>
            <TableCell className="text-sm text-muted-foreground">{formatDate(m.createdAt)}</TableCell>
            <TableCell className="font-medium">{m.product.name}</TableCell>
            <TableCell className="text-right">{Math.abs(m.quantity)}</TableCell>
            <TableCell className="text-right">{formatCurrency(m.unitPrice)}</TableCell>
            <TableCell className="text-right">{formatCurrency(m.totalAmount)}</TableCell>
            {mode === 'purchase' && <TableCell className="text-muted-foreground">{m.notes ?? '—'}</TableCell>}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/domain/inventory/
git commit -m "feat(inventory): adiciona modais de produto, compra, venda e tabela de movimentações"
```

---

## Task 13: AppointmentProductsSection

**Files:**
- Create: `src/components/domain/inventory/AppointmentProductsSection.tsx`
- Modify: `src/components/domain/scheduling/appointment-drawer.tsx`

- [ ] **Step 1: Criar AppointmentProductsSection.tsx**

```tsx
// src/components/domain/inventory/AppointmentProductsSection.tsx
'use client'
import { useState } from 'react'
import { ChevronDown, ChevronUp, Minus, Plus, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAppointmentProducts, useSaveAppointmentProducts } from '@/hooks/use-appointment-products'
import { useServiceTemplate } from '@/hooks/use-service-template'
import { useProducts } from '@/hooks/use-products'

type ProductItem = { productId: string; quantity: number; name: string }

type Props = {
  appointmentId: string
  serviceId: string
}

export function AppointmentProductsSection({ appointmentId, serviceId }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [items, setItems] = useState<ProductItem[]>([])
  const [loaded, setLoaded] = useState(false)

  const { data: savedProducts } = useAppointmentProducts(expanded ? appointmentId : undefined)
  const { data: template } = useServiceTemplate(expanded && !loaded ? serviceId : undefined)
  const { data: productsData } = useProducts({ pageSize: 100 })
  const saveProducts = useSaveAppointmentProducts(appointmentId)

  const allProducts: Array<{ id: string; name: string }> = productsData?.data ?? []

  function handleExpand() {
    setExpanded(true)
    if (!loaded) {
      const base = (savedProducts as ProductItem[] | undefined) ?? []
      const fallback = (template as Array<{ productId: string; quantity: number; product: { name: string } }> | undefined) ?? []
      const initial = base.length > 0
        ? base
        : fallback.map(t => ({ productId: t.productId, quantity: t.quantity, name: t.product.name }))
      setItems(initial)
      setLoaded(true)
    }
  }

  function updateQuantity(productId: string, delta: number) {
    setItems(prev => prev.map(item =>
      item.productId === productId
        ? { ...item, quantity: Math.max(1, item.quantity + delta) }
        : item
    ))
  }

  function removeItem(productId: string) {
    setItems(prev => prev.filter(i => i.productId !== productId))
  }

  function addProduct(productId: string) {
    if (items.find(i => i.productId === productId)) return
    const product = allProducts.find(p => p.id === productId)
    if (!product) return
    setItems(prev => [...prev, { productId, quantity: 1, name: product.name }])
  }

  async function handleSave() {
    try {
      await saveProducts.mutateAsync({ products: items.map(i => ({ productId: i.productId, quantity: i.quantity })) })
      toast.success('Produtos do atendimento salvos')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar produtos')
    }
  }

  return (
    <div className="rounded-xl border border-border/50">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
        onClick={expanded ? () => setExpanded(false) : handleExpand}
      >
        <span>Produtos Utilizados</span>
        {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </button>

      {expanded && (
        <div className="border-t border-border/50 px-4 pb-4 pt-3 space-y-3">
          <p className="text-xs text-muted-foreground">Opcional — pré-preenchido pelo template do serviço</p>

          {items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">Nenhum produto adicionado</p>
          )}

          {items.map(item => (
            <div key={item.productId} className="flex items-center gap-2">
              <span className="flex-1 text-sm truncate">{item.name}</span>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => updateQuantity(item.productId, -1)}>
                <Minus className="size-3" />
              </Button>
              <span className="w-6 text-center text-sm">{item.quantity}</span>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => updateQuantity(item.productId, 1)}>
                <Plus className="size-3" />
              </Button>
              <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={() => removeItem(item.productId)}>
                ×
              </Button>
            </div>
          ))}

          <Select onValueChange={addProduct}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="+ Adicionar produto" />
            </SelectTrigger>
            <SelectContent>
              {allProducts
                .filter(p => !items.find(i => i.productId === p.id))
                .map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Button size="sm" className="w-full" onClick={handleSave} disabled={saveProducts.isPending}>
            <Save className="size-3.5 mr-1.5" />
            {saveProducts.isPending ? 'Salvando...' : 'Salvar consumo'}
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Integrar no AppointmentDrawer**

Em `src/components/domain/scheduling/appointment-drawer.tsx`:

Adicionar import:
```typescript
import { AppointmentProductsSection } from '@/components/domain/inventory/AppointmentProductsSection'
```

Dentro do `<SheetContent>`, após o bloco de informações do agendamento (antes dos botões de ação), adicionar:
```tsx
{/* Seção de produtos — opcional */}
<AppointmentProductsSection
  appointmentId={appointment.id}
  serviceId={appointment.serviceId}
/>
```

O `appointment.serviceId` já existe no tipo `Appointment`. Confirme que o campo está exposto na query existente; se não estiver, adicione `serviceId` ao `include` da query de agendamentos.

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/inventory/AppointmentProductsSection.tsx src/components/domain/scheduling/appointment-drawer.tsx
git commit -m "feat(inventory): adiciona AppointmentProductsSection integrada ao AppointmentDrawer"
```

---

## Task 14: Página Principal `/produtos`

**Files:**
- Create: `src/app/(app)/produtos/page.tsx`

- [ ] **Step 1: Criar a página com três abas**

```tsx
// src/app/(app)/produtos/page.tsx
'use client'
import { useState } from 'react'
import { Plus, Tags } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useProducts, useDeleteProduct } from '@/hooks/use-products'
import { useProductCategories } from '@/hooks/use-product-categories'
import { useStockMovements } from '@/hooks/use-stock-movements'
import { ProductsTable } from '@/components/domain/inventory/ProductsTable'
import { CategoryManagerModal } from '@/components/domain/inventory/CategoryManagerModal'
import { ProductFormModal } from '@/components/domain/inventory/ProductFormModal'
import { StockPurchaseModal } from '@/components/domain/inventory/StockPurchaseModal'
import { StockSaleModal } from '@/components/domain/inventory/StockSaleModal'
import { StockMovementsTable } from '@/components/domain/inventory/StockMovementsTable'
import { toast } from 'sonner'

export default function ProdutosPage() {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>()
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false)
  const [saleModalOpen, setSaleModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<any>(null)

  const { data: productsData, isLoading: loadingProducts } = useProducts({
    name: search || undefined,
    categoryId: categoryFilter,
  })
  const { data: categories = [] } = useProductCategories()
  const { data: purchasesData } = useStockMovements({ type: 'PURCHASE' })
  const { data: salesData } = useStockMovements({ type: 'SALE' })
  const deleteProduct = useDeleteProduct()

  const products = productsData?.data ?? []
  const purchases = purchasesData?.data ?? []
  const sales = salesData?.data ?? []

  const totalStock = products.reduce((acc: number, p: any) => acc + p.stockQuantity, 0)
  const totalPatrimony = products.reduce((acc: number, p: any) => acc + Number(p.salePrice) * p.stockQuantity, 0)

  async function handleDelete(product: any) {
    if (!confirm(`Remover "${product.name}" do catálogo?`)) return
    try {
      await deleteProduct.mutateAsync(product.id)
      toast.success('Produto removido do catálogo')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover produto')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Produtos & Estoque</h1>
        <p className="text-sm text-muted-foreground">Gerencie seu catálogo, estoque e vendas</p>
      </div>

      <Tabs defaultValue="produtos">
        <TabsList>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="compras">Compra de Estoque</TabsTrigger>
          <TabsTrigger value="vendas">Vendas</TabsTrigger>
        </TabsList>

        {/* ─── Aba Produtos ─── */}
        <TabsContent value="produtos" className="space-y-4 mt-4">
          {/* Barra de resumo */}
          <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Quantidade total em estoque: <strong className="text-foreground">{totalStock}</strong>
            {' · '}
            Patrimônio total:{' '}
            <strong className="text-foreground">
              {totalPatrimony.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </strong>
          </div>

          {/* Filtros e ações */}
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Buscar produto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Select onValueChange={v => setCategoryFilter(v === 'all' ? undefined : v)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Todas categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {(categories as Array<{ id: string; name: string }>).map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={() => setCategoryModalOpen(true)}>
                <Tags className="mr-2 size-4" />
                CATEGORIAS
              </Button>
              <Button onClick={() => { setEditingProduct(null); setProductModalOpen(true) }}>
                <Plus className="mr-2 size-4" />
                ADICIONAR PRODUTO
              </Button>
            </div>
          </div>

          {loadingProducts ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : (
            <ProductsTable
              products={products}
              onEdit={(p) => { setEditingProduct(p); setProductModalOpen(true) }}
              onDelete={handleDelete}
            />
          )}
        </TabsContent>

        {/* ─── Aba Compras ─── */}
        <TabsContent value="compras" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={() => setPurchaseModalOpen(true)}>
              <Plus className="mr-2 size-4" />
              REGISTRAR COMPRA
            </Button>
          </div>
          <StockMovementsTable movements={purchases} mode="purchase" />
        </TabsContent>

        {/* ─── Aba Vendas ─── */}
        <TabsContent value="vendas" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={() => setSaleModalOpen(true)}>
              <Plus className="mr-2 size-4" />
              REGISTRAR VENDA
            </Button>
          </div>
          <StockMovementsTable movements={sales} mode="sale" />
        </TabsContent>
      </Tabs>

      <CategoryManagerModal open={categoryModalOpen} onClose={() => setCategoryModalOpen(false)} />
      <ProductFormModal
        open={productModalOpen}
        onClose={() => { setProductModalOpen(false); setEditingProduct(null) }}
        product={editingProduct}
      />
      <StockPurchaseModal open={purchaseModalOpen} onClose={() => setPurchaseModalOpen(false)} />
      <StockSaleModal open={saleModalOpen} onClose={() => setSaleModalOpen(false)} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(app)/produtos/
git commit -m "feat(inventory): adiciona página /produtos com abas de catálogo, compras e vendas"
```

---

## Task 15: Verificação Final e PR

- [ ] **Step 1: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros. Se houver erros, corrigir antes de prosseguir.

- [ ] **Step 2: Rodar todos os testes**

```bash
npx vitest run
```

Esperado: todos os testes passando, incluindo os testes de inventory.

- [ ] **Step 3: Verificar itens do checklist do CLAUDE.md**

- [ ] `tenantId` em todos os novos models Prisma ✓
- [ ] Repository filtra `tenantId` em todas as queries ✓
- [ ] Service com regras de negócio e publicação de eventos ✓
- [ ] Zod schemas em `domains/inventory/types.ts` ✓
- [ ] API Routes com `getSessionContext()` e validação Zod ✓
- [ ] Erros tipados para todos os casos de falha ✓
- [ ] Componentes com loading state e empty state ✓
- [ ] Sem `any` no TypeScript (verificar manualmente os componentes) ✓

- [ ] **Step 4: Criar PR para main**

```bash
git push origin HEAD
gh pr create \
  --title "feat(inventory): módulo Produtos & Estoque — catálogo, estoque e integração com agenda" \
  --body "$(cat <<'EOF'
## Resumo
- Domínio \`inventory\` completo com Product, ProductCategory, StockMovement, AppointmentProduct, ServiceProduct
- API Routes para catálogo, categorias, movimentações, templates de serviço e produtos de atendimento
- Eventos \`product.sold\` e \`stock.purchased\` integrados ao domínio financial (cria Transaction automaticamente)
- Página \`/produtos\` com 3 abas: catálogo, compras e vendas
- Seção colapsável no AppointmentDrawer com pré-preenchimento por template de serviço
- Testes: service (80%), repositories (60%)

## Decisões implementadas
- Produtos usados em atendimento: apenas decrementa estoque, sem transação financeira
- Venda avulsa: decrementa estoque + Transaction(INCOME) via evento
- Compra de reabastecimento: incrementa estoque + Transaction(EXPENSE) via evento
- Filtro de baixo estoque aplicado em memória (MVP — catálogos pequenos)

## Test plan
- [ ] Criar produto e verificar aparece no catálogo
- [ ] Registrar compra e verificar incremento de estoque + Transaction EXPENSE criada
- [ ] Registrar venda avulsa e verificar decremento + Transaction INCOME criada
- [ ] Tentar vender mais do que o estoque disponível — deve exibir erro
- [ ] Abrir AppointmentDrawer, expandir "Produtos Utilizados", salvar consumo — verificar decremento de estoque
- [ ] Criar categoria e associar a produto — verificar filtro funcionando
- [ ] Tentar deletar categoria com produtos — deve exibir erro

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Notas de Implementação

### Sobre `recordPurchase` e `recordSale` no service

O service recebe `productId` embutido no `input` (injetado pela API Route a partir do path param `[id]`). Isso é intencional — os schemas Zod de `recordPurchaseSchema` e `recordSaleSchema` não incluem `productId` (vem da URL), mas o service os aceita como `input & { productId?: string }`.

### Sobre o filtro de baixo estoque

O filtro `lowStock` busca todos os produtos que passam pelos outros filtros e aplica a comparação `stockQuantity <= lowStockAlert` em memória. Para tenants com catálogos grandes (> 500 produtos), substituir por `$queryRaw` com `WHERE stock_quantity <= low_stock_alert`.

### Sobre o `serviceId` no AppointmentDrawer

O campo `serviceId` já existe no model `Appointment`. Verificar se o hook `useAppointments` inclui esse campo no retorno da query; se não incluir, adicionar ao `select` ou `include` da query de agendamentos.
