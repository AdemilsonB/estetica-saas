# Admin Catálogo Mestre — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a área de administração do catálogo mestre global em `/admin/catalogo`, permitindo ao superadmin listar, criar, editar e desativar serviços e produtos mestres.

**Architecture:** API Routes admin protegidas por `getAdminContext`, queries Prisma diretas (sem repository), página client-side com TanStack Query v5, Sheet lateral para criação/edição.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Prisma 7, TanStack Query v5, Shadcn UI (Sheet, Tabs, Input, Select, Switch, Button, Badge), Zod, sonner (toast)

---

## Contexto obrigatório antes de iniciar

### Padrão de API Route admin
```typescript
import { prisma } from '@/shared/database/prisma'
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    await getAdminContext(request)
    // prisma direto, sem repository
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
```

### Modelos Prisma (já existem — sem migrations)
```
CatalogServiceCategory: id, slug, name, segments[], order, active
CatalogProductCategory: id, slug, name, segments[], order, active
CatalogService: id, slug, name, description?, imageUrl?, segments[], categoryId?, suggestedDuration(min), suggestedPrice(Decimal), priceType(FIXED|STARTING_FROM), active, order, metadata?
CatalogProduct: id, slug, name, description?, imageUrl?, segments[], categoryId?, suggestedPrice(Decimal), active, order, metadata?
enum BusinessSegment: HAIR_SALON | BARBERSHOP | NAIL_DESIGN | AESTHETICS
```

### Utilitários de formatação (usar em toda a UI)
```typescript
const SEGMENT_LABEL: Record<string, string> = {
  HAIR_SALON: 'Salão', BARBERSHOP: 'Barbearia',
  NAIL_DESIGN: 'Nail Design', AESTHETICS: 'Estética',
}
const formatBRL = (v: number | string) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const formatDuration = (min: number) =>
  min < 60 ? `${min}min` : min % 60 === 0 ? `${min / 60}h` : `${Math.floor(min / 60)}h${min % 60}min`
const toSlug = (name: string) =>
  name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
```

### Layout admin existente (`src/app/(admin)/layout.tsx`)
Sidebar com array `NAV` definido diretamente no arquivo. Adicionar:
```typescript
import { BookOpen } from 'lucide-react'
// no array NAV:
{ href: '/admin/catalogo', label: 'Catálogo', icon: BookOpen }
```

---

## Task 1: Branch e API Routes de categorias

**Files:**
- Modify: `src/app/(admin)/layout.tsx`
- Create: `src/app/api/admin/catalogo/categories/route.ts`

- [ ] **Step 1: Criar branch**
```bash
git checkout -b feat/admin-catalogo-mestre
```

- [ ] **Step 2: Adicionar Catálogo ao NAV do layout admin**

Em `src/app/(admin)/layout.tsx`, adicionar import `BookOpen` e o item no array NAV:
```typescript
import { LayoutDashboard, CreditCard, Building2, Settings, ArrowLeft, BookOpen } from 'lucide-react'

const NAV = [
  { href: '/admin',             label: 'Visão Geral',   icon: LayoutDashboard },
  { href: '/admin/planos',      label: 'Planos',        icon: CreditCard },
  { href: '/admin/tenants',     label: 'Tenants',       icon: Building2 },
  { href: '/admin/catalogo',    label: 'Catálogo',      icon: BookOpen },
  { href: '/admin/configuracoes', label: 'Configurações', icon: Settings },
]
```

- [ ] **Step 3: Criar `src/app/api/admin/catalogo/categories/route.ts`**
```typescript
import { prisma } from '@/shared/database/prisma'
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    await getAdminContext(request)
    const [services, products] = await Promise.all([
      prisma.catalogServiceCategory.findMany({ orderBy: { order: 'asc' } }),
      prisma.catalogProductCategory.findMany({ orderBy: { order: 'asc' } }),
    ])
    return Response.json({ services, products })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 4: Commit**
```bash
git add src/app/(admin)/layout.tsx src/app/api/admin/catalogo/categories/route.ts
git commit -m "feat(admin): adiciona Catálogo ao nav e rota de categorias"
```

---

## Task 2: API Routes de serviços

**Files:**
- Create: `src/app/api/admin/catalogo/services/route.ts`
- Create: `src/app/api/admin/catalogo/services/[id]/route.ts`

- [ ] **Step 1: Criar `src/app/api/admin/catalogo/services/route.ts`**
```typescript
import { z } from 'zod'
import { BusinessSegment, PriceType } from '@prisma/client'
import { prisma } from '@/shared/database/prisma'
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

const createSchema = z.object({
  slug:              z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug inválido'),
  name:              z.string().min(1),
  description:       z.string().optional(),
  segments:          z.array(z.nativeEnum(BusinessSegment)).min(1),
  categoryId:        z.string().cuid().optional(),
  suggestedDuration: z.number().int().min(1),
  suggestedPrice:    z.number().min(0),
  priceType:         z.nativeEnum(PriceType).default('FIXED'),
  order:             z.number().int().default(0),
  metadata:          z.record(z.unknown()).optional(),
})

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    await getAdminContext(request)
    const { searchParams } = new URL(request.url)
    const segments = searchParams.getAll('segments') as BusinessSegment[]
    const categoryId = searchParams.get('categoryId') ?? undefined
    const name = searchParams.get('name') ?? undefined
    const active = searchParams.get('active')
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? 20)))

    const where = {
      ...(active !== null ? { active: active === 'true' } : {}),
      ...(segments.length && { segments: { hasSome: segments } }),
      ...(categoryId && { categoryId }),
      ...(name && { name: { contains: name, mode: 'insensitive' as const } }),
    }

    const [data, total] = await Promise.all([
      prisma.catalogService.findMany({
        where,
        include: { category: true },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.catalogService.count({ where }),
    ])

    return Response.json({ data, total, page, pageSize })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  initializeDomainRuntime()
  try {
    await getAdminContext(request)
    const body = await request.json()
    const input = createSchema.parse(body)

    const existing = await prisma.catalogService.findUnique({ where: { slug: input.slug } })
    if (existing) {
      return Response.json({ error: { message: 'Slug já em uso' } }, { status: 409 })
    }

    const service = await prisma.catalogService.create({ data: input, include: { category: true } })
    return Response.json(service, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 2: Criar `src/app/api/admin/catalogo/services/[id]/route.ts`**
```typescript
import { z } from 'zod'
import { BusinessSegment, PriceType } from '@prisma/client'
import { prisma } from '@/shared/database/prisma'
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

const patchSchema = z.object({
  slug:              z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  name:              z.string().min(1).optional(),
  description:       z.string().optional(),
  segments:          z.array(z.nativeEnum(BusinessSegment)).min(1).optional(),
  categoryId:        z.string().cuid().nullable().optional(),
  suggestedDuration: z.number().int().min(1).optional(),
  suggestedPrice:    z.number().min(0).optional(),
  priceType:         z.nativeEnum(PriceType).optional(),
  order:             z.number().int().optional(),
  active:            z.boolean().optional(),
  metadata:          z.record(z.unknown()).optional(),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  initializeDomainRuntime()
  try {
    await getAdminContext(request)
    const { id } = await params
    const body = await request.json()
    const input = patchSchema.parse(body)

    if (input.slug) {
      const conflict = await prisma.catalogService.findFirst({
        where: { slug: input.slug, NOT: { id } },
      })
      if (conflict) {
        return Response.json({ error: { message: 'Slug já em uso' } }, { status: 409 })
      }
    }

    const service = await prisma.catalogService.update({
      where: { id },
      data: input,
      include: { category: true },
    })
    return Response.json(service)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  initializeDomainRuntime()
  try {
    await getAdminContext(request)
    const { id } = await params
    await prisma.catalogService.update({ where: { id }, data: { active: false } })
    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 3: Commit**
```bash
git add src/app/api/admin/catalogo/services/
git commit -m "feat(admin): API routes de serviços do catálogo mestre"
```

---

## Task 3: API Routes de produtos

**Files:**
- Create: `src/app/api/admin/catalogo/products/route.ts`
- Create: `src/app/api/admin/catalogo/products/[id]/route.ts`

- [ ] **Step 1: Criar `src/app/api/admin/catalogo/products/route.ts`**

Igual ao de serviços mas sem `suggestedDuration` e `priceType`:
```typescript
import { z } from 'zod'
import { BusinessSegment } from '@prisma/client'
import { prisma } from '@/shared/database/prisma'
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

const createSchema = z.object({
  slug:          z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug inválido'),
  name:          z.string().min(1),
  description:   z.string().optional(),
  segments:      z.array(z.nativeEnum(BusinessSegment)).min(1),
  categoryId:    z.string().cuid().optional(),
  suggestedPrice: z.number().min(0),
  order:         z.number().int().default(0),
  metadata:      z.record(z.unknown()).optional(),
})

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    await getAdminContext(request)
    const { searchParams } = new URL(request.url)
    const segments = searchParams.getAll('segments') as BusinessSegment[]
    const categoryId = searchParams.get('categoryId') ?? undefined
    const name = searchParams.get('name') ?? undefined
    const active = searchParams.get('active')
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? 20)))

    const where = {
      ...(active !== null ? { active: active === 'true' } : {}),
      ...(segments.length && { segments: { hasSome: segments } }),
      ...(categoryId && { categoryId }),
      ...(name && { name: { contains: name, mode: 'insensitive' as const } }),
    }

    const [data, total] = await Promise.all([
      prisma.catalogProduct.findMany({
        where,
        include: { category: true },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.catalogProduct.count({ where }),
    ])

    return Response.json({ data, total, page, pageSize })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  initializeDomainRuntime()
  try {
    await getAdminContext(request)
    const body = await request.json()
    const input = createSchema.parse(body)

    const existing = await prisma.catalogProduct.findUnique({ where: { slug: input.slug } })
    if (existing) {
      return Response.json({ error: { message: 'Slug já em uso' } }, { status: 409 })
    }

    const product = await prisma.catalogProduct.create({ data: input, include: { category: true } })
    return Response.json(product, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 2: Criar `src/app/api/admin/catalogo/products/[id]/route.ts`**
```typescript
import { z } from 'zod'
import { BusinessSegment } from '@prisma/client'
import { prisma } from '@/shared/database/prisma'
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

const patchSchema = z.object({
  slug:           z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  name:           z.string().min(1).optional(),
  description:    z.string().optional(),
  segments:       z.array(z.nativeEnum(BusinessSegment)).min(1).optional(),
  categoryId:     z.string().cuid().nullable().optional(),
  suggestedPrice: z.number().min(0).optional(),
  order:          z.number().int().optional(),
  active:         z.boolean().optional(),
  metadata:       z.record(z.unknown()).optional(),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  initializeDomainRuntime()
  try {
    await getAdminContext(request)
    const { id } = await params
    const body = await request.json()
    const input = patchSchema.parse(body)

    if (input.slug) {
      const conflict = await prisma.catalogProduct.findFirst({
        where: { slug: input.slug, NOT: { id } },
      })
      if (conflict) {
        return Response.json({ error: { message: 'Slug já em uso' } }, { status: 409 })
      }
    }

    const product = await prisma.catalogProduct.update({
      where: { id },
      data: input,
      include: { category: true },
    })
    return Response.json(product)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  initializeDomainRuntime()
  try {
    await getAdminContext(request)
    const { id } = await params
    await prisma.catalogProduct.update({ where: { id }, data: { active: false } })
    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 3: Commit**
```bash
git add src/app/api/admin/catalogo/products/
git commit -m "feat(admin): API routes de produtos do catálogo mestre"
```

---

## Task 4: Hook TanStack Query

**Files:**
- Create: `src/hooks/admin/use-admin-catalog.ts`

- [ ] **Step 1: Criar `src/hooks/admin/use-admin-catalog.ts`**
```typescript
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BusinessSegment } from '@prisma/client'

// ---- tipos ----

export interface CatalogCategory {
  id: string
  slug: string
  name: string
  segments: BusinessSegment[]
  order: number
  active: boolean
}

export interface CatalogServiceItem {
  id: string
  slug: string
  name: string
  description: string | null
  segments: BusinessSegment[]
  categoryId: string | null
  category: CatalogCategory | null
  suggestedDuration: number
  suggestedPrice: string // Decimal serializado como string
  priceType: 'FIXED' | 'STARTING_FROM'
  active: boolean
  order: number
  metadata: Record<string, unknown> | null
}

export interface CatalogProductItem {
  id: string
  slug: string
  name: string
  description: string | null
  segments: BusinessSegment[]
  categoryId: string | null
  category: CatalogCategory | null
  suggestedPrice: string
  active: boolean
  order: number
  metadata: Record<string, unknown> | null
}

interface PaginatedResponse<T> { data: T[]; total: number; page: number; pageSize: number }

// ---- helpers ----

function buildParams(filters: Record<string, unknown>) {
  const p = new URLSearchParams()
  for (const [key, val] of Object.entries(filters)) {
    if (val === undefined || val === null || val === '') continue
    if (Array.isArray(val)) val.forEach(v => p.append(key, String(v)))
    else p.set(key, String(val))
  }
  return p.toString()
}

// ---- hooks de listagem ----

export function useAdminCatalogServices(filters: {
  segments?: BusinessSegment[]
  categoryId?: string
  name?: string
  active?: boolean
  page?: number
  pageSize?: number
}) {
  return useQuery<PaginatedResponse<CatalogServiceItem>>({
    queryKey: ['admin', 'catalog', 'services', filters],
    queryFn: async () => {
      const res = await fetch(`/api/admin/catalogo/services?${buildParams(filters)}`)
      if (!res.ok) throw new Error('Erro ao carregar serviços')
      return res.json()
    },
  })
}

export function useAdminCatalogProducts(filters: {
  segments?: BusinessSegment[]
  categoryId?: string
  name?: string
  active?: boolean
  page?: number
  pageSize?: number
}) {
  return useQuery<PaginatedResponse<CatalogProductItem>>({
    queryKey: ['admin', 'catalog', 'products', filters],
    queryFn: async () => {
      const res = await fetch(`/api/admin/catalogo/products?${buildParams(filters)}`)
      if (!res.ok) throw new Error('Erro ao carregar produtos')
      return res.json()
    },
  })
}

export function useAdminCatalogCategories() {
  return useQuery<{ services: CatalogCategory[]; products: CatalogCategory[] }>({
    queryKey: ['admin', 'catalog', 'categories'],
    queryFn: async () => {
      const res = await fetch('/api/admin/catalogo/categories')
      if (!res.ok) throw new Error('Erro ao carregar categorias')
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })
}

// ---- hooks de mutação — serviços ----

export function useCreateCatalogService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Omit<CatalogServiceItem, 'id' | 'category' | 'createdAt' | 'updatedAt'>) => {
      const res = await fetch('/api/admin/catalogo/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: { message?: string } })?.error?.message ?? 'Erro ao criar serviço')
      }
      return res.json() as Promise<CatalogServiceItem>
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'catalog', 'services'] }),
  })
}

export function useUpdateCatalogService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<CatalogServiceItem> & { id: string }) => {
      const res = await fetch(`/api/admin/catalogo/services/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: { message?: string } })?.error?.message ?? 'Erro ao atualizar serviço')
      }
      return res.json() as Promise<CatalogServiceItem>
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'catalog', 'services'] }),
  })
}

export function useDeactivateCatalogService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/catalogo/services/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao desativar serviço')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'catalog', 'services'] }),
  })
}

// ---- hooks de mutação — produtos ----

export function useCreateCatalogProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Omit<CatalogProductItem, 'id' | 'category' | 'createdAt' | 'updatedAt'>) => {
      const res = await fetch('/api/admin/catalogo/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: { message?: string } })?.error?.message ?? 'Erro ao criar produto')
      }
      return res.json() as Promise<CatalogProductItem>
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'catalog', 'products'] }),
  })
}

export function useUpdateCatalogProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<CatalogProductItem> & { id: string }) => {
      const res = await fetch(`/api/admin/catalogo/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: { message?: string } })?.error?.message ?? 'Erro ao atualizar produto')
      }
      return res.json() as Promise<CatalogProductItem>
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'catalog', 'products'] }),
  })
}

export function useDeactivateCatalogProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/catalogo/products/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao desativar produto')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'catalog', 'products'] }),
  })
}
```

- [ ] **Step 2: Commit**
```bash
git add src/hooks/admin/use-admin-catalog.ts
git commit -m "feat(admin): hook TanStack Query para catálogo mestre"
```

---

## Task 5: Sheet de serviço

**Files:**
- Create: `src/components/admin/catalog/CatalogServiceSheet.tsx`

- [ ] **Step 1: Criar `src/components/admin/catalog/CatalogServiceSheet.tsx`**
```typescript
'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useCreateCatalogService, useUpdateCatalogService, type CatalogServiceItem, type CatalogCategory } from '@/hooks/admin/use-admin-catalog'

const SEGMENTS = [
  { value: 'HAIR_SALON',  label: 'Salão' },
  { value: 'BARBERSHOP',  label: 'Barbearia' },
  { value: 'NAIL_DESIGN', label: 'Nail Design' },
  { value: 'AESTHETICS',  label: 'Estética' },
] as const

const toSlug = (name: string) =>
  name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

interface Props {
  open: boolean
  onClose: () => void
  service?: CatalogServiceItem | null
  categories: CatalogCategory[]
}

export function CatalogServiceSheet({ open, onClose, service, categories }: Props) {
  const isEditing = !!service
  const createMutation = useCreateCatalogService()
  const updateMutation = useUpdateCatalogService()
  const isPending = createMutation.isPending || updateMutation.isPending

  const [form, setForm] = useState({
    name: '', slug: '', description: '', segments: [] as string[],
    categoryId: '', suggestedDuration: 60, suggestedPrice: 0,
    priceType: 'FIXED' as 'FIXED' | 'STARTING_FROM', order: 0, active: true,
  })
  const [slugManual, setSlugManual] = useState(false)

  useEffect(() => {
    if (service) {
      setForm({
        name: service.name, slug: service.slug, description: service.description ?? '',
        segments: service.segments, categoryId: service.categoryId ?? '',
        suggestedDuration: service.suggestedDuration,
        suggestedPrice: Number(service.suggestedPrice),
        priceType: service.priceType, order: service.order, active: service.active,
      })
      setSlugManual(true)
    } else {
      setForm({ name: '', slug: '', description: '', segments: [], categoryId: '',
        suggestedDuration: 60, suggestedPrice: 0, priceType: 'FIXED', order: 0, active: true })
      setSlugManual(false)
    }
  }, [service, open])

  function handleNameChange(name: string) {
    setForm(f => ({ ...f, name, ...(!slugManual ? { slug: toSlug(name) } : {}) }))
  }

  function toggleSegment(seg: string) {
    setForm(f => ({
      ...f,
      segments: f.segments.includes(seg) ? f.segments.filter(s => s !== seg) : [...f.segments, seg],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.slug || form.segments.length === 0) {
      toast.error('Preencha nome, slug e ao menos um segmento.')
      return
    }
    try {
      const payload = {
        ...form,
        categoryId: form.categoryId || undefined,
        description: form.description || undefined,
      }
      if (isEditing) {
        await updateMutation.mutateAsync({ id: service!.id, ...payload })
        toast.success('Serviço atualizado!')
      } else {
        await createMutation.mutateAsync(payload as Parameters<typeof createMutation.mutateAsync>[0])
        toast.success('Serviço criado!')
      }
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar serviço')
    }
  }

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Editar Serviço' : 'Novo Serviço'}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {/* Nome */}
          <div className="space-y-1">
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" value={form.name} onChange={e => handleNameChange(e.target.value)} required />
          </div>
          {/* Slug */}
          <div className="space-y-1">
            <Label htmlFor="slug">Slug *</Label>
            <Input id="slug" value={form.slug}
              onChange={e => { setSlugManual(true); setForm(f => ({ ...f, slug: e.target.value })) }}
              pattern="^[a-z0-9-]+$" required />
            <p className="text-xs text-slate-400">Apenas letras minúsculas, números e hífens</p>
          </div>
          {/* Descrição */}
          <div className="space-y-1">
            <Label htmlFor="desc">Descrição</Label>
            <Input id="desc" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          {/* Segmentos */}
          <div className="space-y-2">
            <Label>Segmentos *</Label>
            <div className="grid grid-cols-2 gap-2">
              {SEGMENTS.map(s => (
                <label key={s.value} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={form.segments.includes(s.value)}
                    onCheckedChange={() => toggleSegment(s.value)} />
                  <span className="text-sm">{s.label}</span>
                </label>
              ))}
            </div>
          </div>
          {/* Categoria */}
          <div className="space-y-1">
            <Label>Categoria</Label>
            <Select value={form.categoryId || 'none'} onValueChange={v => setForm(f => ({ ...f, categoryId: v === 'none' ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem categoria</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {/* Duração e Preço */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="dur">Duração (min) *</Label>
              <Input id="dur" type="number" min={1} value={form.suggestedDuration}
                onChange={e => setForm(f => ({ ...f, suggestedDuration: Number(e.target.value) }))} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="price">Preço sugerido (R$) *</Label>
              <Input id="price" type="number" min={0} step={0.01} value={form.suggestedPrice}
                onChange={e => setForm(f => ({ ...f, suggestedPrice: Number(e.target.value) }))} required />
            </div>
          </div>
          {/* Tipo de preço */}
          <div className="space-y-1">
            <Label>Tipo de preço</Label>
            <div className="flex gap-4">
              {(['FIXED', 'STARTING_FROM'] as const).map(t => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="priceType" value={t} checked={form.priceType === t}
                    onChange={() => setForm(f => ({ ...f, priceType: t }))} />
                  <span className="text-sm">{t === 'FIXED' ? 'Fixo' : 'A partir de'}</span>
                </label>
              ))}
            </div>
          </div>
          {/* Ordem e Ativo */}
          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="space-y-1">
              <Label htmlFor="order">Ordem</Label>
              <Input id="order" type="number" value={form.order}
                onChange={e => setForm(f => ({ ...f, order: Number(e.target.value) }))} />
            </div>
            <div className="flex items-center gap-2 pb-1">
              <Switch id="active" checked={form.active}
                onCheckedChange={v => setForm(f => ({ ...f, active: v }))} />
              <Label htmlFor="active">Ativo</Label>
            </div>
          </div>
          <SheetFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2: Commit**
```bash
git add src/components/admin/catalog/CatalogServiceSheet.tsx
git commit -m "feat(admin): Sheet de criação/edição de serviço mestre"
```

---

## Task 6: Sheet de produto

**Files:**
- Create: `src/components/admin/catalog/CatalogProductSheet.tsx`

- [ ] **Step 1: Criar `src/components/admin/catalog/CatalogProductSheet.tsx`**

Igual ao `CatalogServiceSheet` mas sem `suggestedDuration` e `priceType`:
```typescript
'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useCreateCatalogProduct, useUpdateCatalogProduct, type CatalogProductItem, type CatalogCategory } from '@/hooks/admin/use-admin-catalog'

const SEGMENTS = [
  { value: 'HAIR_SALON',  label: 'Salão' },
  { value: 'BARBERSHOP',  label: 'Barbearia' },
  { value: 'NAIL_DESIGN', label: 'Nail Design' },
  { value: 'AESTHETICS',  label: 'Estética' },
] as const

const toSlug = (name: string) =>
  name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

interface Props {
  open: boolean
  onClose: () => void
  product?: CatalogProductItem | null
  categories: CatalogCategory[]
}

export function CatalogProductSheet({ open, onClose, product, categories }: Props) {
  const isEditing = !!product
  const createMutation = useCreateCatalogProduct()
  const updateMutation = useUpdateCatalogProduct()
  const isPending = createMutation.isPending || updateMutation.isPending

  const [form, setForm] = useState({
    name: '', slug: '', description: '', segments: [] as string[],
    categoryId: '', suggestedPrice: 0, order: 0, active: true,
  })
  const [slugManual, setSlugManual] = useState(false)

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name, slug: product.slug, description: product.description ?? '',
        segments: product.segments, categoryId: product.categoryId ?? '',
        suggestedPrice: Number(product.suggestedPrice), order: product.order, active: product.active,
      })
      setSlugManual(true)
    } else {
      setForm({ name: '', slug: '', description: '', segments: [], categoryId: '',
        suggestedPrice: 0, order: 0, active: true })
      setSlugManual(false)
    }
  }, [product, open])

  function handleNameChange(name: string) {
    setForm(f => ({ ...f, name, ...(!slugManual ? { slug: toSlug(name) } : {}) }))
  }

  function toggleSegment(seg: string) {
    setForm(f => ({
      ...f,
      segments: f.segments.includes(seg) ? f.segments.filter(s => s !== seg) : [...f.segments, seg],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.slug || form.segments.length === 0) {
      toast.error('Preencha nome, slug e ao menos um segmento.')
      return
    }
    try {
      const payload = {
        ...form,
        categoryId: form.categoryId || undefined,
        description: form.description || undefined,
      }
      if (isEditing) {
        await updateMutation.mutateAsync({ id: product!.id, ...payload })
        toast.success('Produto atualizado!')
      } else {
        await createMutation.mutateAsync(payload as Parameters<typeof createMutation.mutateAsync>[0])
        toast.success('Produto criado!')
      }
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar produto')
    }
  }

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Editar Produto' : 'Novo Produto'}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-1">
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" value={form.name} onChange={e => handleNameChange(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="slug">Slug *</Label>
            <Input id="slug" value={form.slug}
              onChange={e => { setSlugManual(true); setForm(f => ({ ...f, slug: e.target.value })) }}
              pattern="^[a-z0-9-]+$" required />
            <p className="text-xs text-slate-400">Apenas letras minúsculas, números e hífens</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="desc">Descrição</Label>
            <Input id="desc" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Segmentos *</Label>
            <div className="grid grid-cols-2 gap-2">
              {SEGMENTS.map(s => (
                <label key={s.value} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={form.segments.includes(s.value)}
                    onCheckedChange={() => toggleSegment(s.value)} />
                  <span className="text-sm">{s.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label>Categoria</Label>
            <Select value={form.categoryId || 'none'} onValueChange={v => setForm(f => ({ ...f, categoryId: v === 'none' ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem categoria</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="price">Preço sugerido (R$) *</Label>
            <Input id="price" type="number" min={0} step={0.01} value={form.suggestedPrice}
              onChange={e => setForm(f => ({ ...f, suggestedPrice: Number(e.target.value) }))} required />
          </div>
          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="space-y-1">
              <Label htmlFor="order">Ordem</Label>
              <Input id="order" type="number" value={form.order}
                onChange={e => setForm(f => ({ ...f, order: Number(e.target.value) }))} />
            </div>
            <div className="flex items-center gap-2 pb-1">
              <Switch id="active" checked={form.active}
                onCheckedChange={v => setForm(f => ({ ...f, active: v }))} />
              <Label htmlFor="active">Ativo</Label>
            </div>
          </div>
          <SheetFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2: Commit**
```bash
git add src/components/admin/catalog/CatalogProductSheet.tsx
git commit -m "feat(admin): Sheet de criação/edição de produto mestre"
```

---

## Task 7: Página principal `/admin/catalogo`

**Files:**
- Create: `src/app/(admin)/admin/catalogo/page.tsx`

- [ ] **Step 1: Criar `src/app/(admin)/admin/catalogo/page.tsx`**
```typescript
'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, PowerOff, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { CatalogServiceSheet } from '@/components/admin/catalog/CatalogServiceSheet'
import { CatalogProductSheet } from '@/components/admin/catalog/CatalogProductSheet'
import {
  useAdminCatalogServices,
  useAdminCatalogProducts,
  useAdminCatalogCategories,
  useDeactivateCatalogService,
  useDeactivateCatalogProduct,
  useUpdateCatalogService,
  useUpdateCatalogProduct,
  type CatalogServiceItem,
  type CatalogProductItem,
} from '@/hooks/admin/use-admin-catalog'

const SEGMENT_LABEL: Record<string, string> = {
  HAIR_SALON: 'Salão', BARBERSHOP: 'Barbearia',
  NAIL_DESIGN: 'Nail Design', AESTHETICS: 'Estética',
}

const formatBRL = (v: number | string) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const formatDuration = (min: number) =>
  min < 60 ? `${min}min` : min % 60 === 0 ? `${min / 60}h` : `${Math.floor(min / 60)}h${min % 60}min`

function SegmentBadges({ segments }: { segments: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {segments.map(s => (
        <span key={s} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
          {SEGMENT_LABEL[s] ?? s}
        </span>
      ))}
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  )
}

export default function AdminCatalogoPage() {
  const { data: categories } = useAdminCatalogCategories()

  // ---- estado de filtros ----
  const [nameInput, setNameInput] = useState('')
  const [name, setName] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setName(nameInput), 300)
    return () => clearTimeout(t)
  }, [nameInput])

  // ---- estado de sheets ----
  const [serviceSheet, setServiceSheet] = useState<{ open: boolean; item?: CatalogServiceItem | null }>({ open: false })
  const [productSheet, setProductSheet] = useState<{ open: boolean; item?: CatalogProductItem | null }>({ open: false })

  // ---- queries ----
  const serviceFilters = { name: name || undefined, active: showInactive ? undefined : true, pageSize: 100 }
  const productFilters = { name: name || undefined, active: showInactive ? undefined : true, pageSize: 100 }

  const { data: servicesData, isLoading: sLoading } = useAdminCatalogServices(serviceFilters)
  const { data: productsData, isLoading: pLoading } = useAdminCatalogProducts(productFilters)

  // ---- mutações ----
  const deactivateService = useDeactivateCatalogService()
  const deactivateProduct = useDeactivateCatalogProduct()
  const updateService = useUpdateCatalogService()
  const updateProduct = useUpdateCatalogProduct()

  async function handleReactivateService(id: string) {
    try {
      await updateService.mutateAsync({ id, active: true })
      toast.success('Serviço reativado!')
    } catch {
      toast.error('Erro ao reativar serviço')
    }
  }

  async function handleReactivateProduct(id: string) {
    try {
      await updateProduct.mutateAsync({ id, active: true })
      toast.success('Produto reativado!')
    } catch {
      toast.error('Erro ao reativar produto')
    }
  }

  async function handleDeactivateService(id: string) {
    try {
      await deactivateService.mutateAsync(id)
      toast.success('Serviço desativado!')
    } catch {
      toast.error('Erro ao desativar serviço')
    }
  }

  async function handleDeactivateProduct(id: string) {
    try {
      await deactivateProduct.mutateAsync(id)
      toast.success('Produto desativado!')
    } catch {
      toast.error('Erro ao desativar produto')
    }
  }

  const services = servicesData?.data ?? []
  const products = productsData?.data ?? []

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-950">Catálogo Mestre</h1>

      {/* Filtros globais */}
      <div className="flex items-center gap-4">
        <Input
          placeholder="Buscar por nome..."
          value={nameInput}
          onChange={e => setNameInput(e.target.value)}
          className="w-64"
        />
        <div className="flex items-center gap-2">
          <Switch id="inactive" checked={showInactive} onCheckedChange={setShowInactive} />
          <Label htmlFor="inactive" className="text-sm text-slate-600">Mostrar inativos</Label>
        </div>
      </div>

      <Tabs defaultValue="services">
        <TabsList>
          <TabsTrigger value="services">
            Serviços {servicesData && <span className="ml-1.5 text-xs text-slate-400">({servicesData.total})</span>}
          </TabsTrigger>
          <TabsTrigger value="products">
            Produtos {productsData && <span className="ml-1.5 text-xs text-slate-400">({productsData.total})</span>}
          </TabsTrigger>
        </TabsList>

        {/* ---- Tab Serviços ---- */}
        <TabsContent value="services" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setServiceSheet({ open: true, item: null })}>
              <Plus className="size-4 mr-1.5" /> Novo Serviço
            </Button>
          </div>
          {sLoading ? <TableSkeleton /> : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Nome</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Categoria</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Segmentos</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Duração</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Preço</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Status</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-500">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {services.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Nenhum serviço encontrado</td></tr>
                  ) : services.map(s => (
                    <tr key={s.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-900">{s.name}</p>
                          <p className="text-xs text-slate-400">{s.slug}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{s.category?.name ?? '—'}</td>
                      <td className="px-4 py-3"><SegmentBadges segments={s.segments} /></td>
                      <td className="px-4 py-3 text-slate-600">{formatDuration(s.suggestedDuration)}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {s.priceType === 'STARTING_FROM' ? `A partir de ${formatBRL(s.suggestedPrice)}` : formatBRL(s.suggestedPrice)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {s.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" className="size-8"
                            onClick={() => setServiceSheet({ open: true, item: s })}>
                            <Pencil className="size-3.5" />
                          </Button>
                          {s.active ? (
                            <Button size="icon" variant="ghost" className="size-8 text-red-500 hover:text-red-600"
                              onClick={() => handleDeactivateService(s.id)}>
                              <PowerOff className="size-3.5" />
                            </Button>
                          ) : (
                            <Button size="icon" variant="ghost" className="size-8 text-green-600 hover:text-green-700"
                              onClick={() => handleReactivateService(s.id)}>
                              <RotateCcw className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ---- Tab Produtos ---- */}
        <TabsContent value="products" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setProductSheet({ open: true, item: null })}>
              <Plus className="size-4 mr-1.5" /> Novo Produto
            </Button>
          </div>
          {pLoading ? <TableSkeleton /> : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Nome</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Categoria</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Segmentos</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Preço</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Status</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-500">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {products.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Nenhum produto encontrado</td></tr>
                  ) : products.map(p => (
                    <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-900">{p.name}</p>
                          <p className="text-xs text-slate-400">{p.slug}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{p.category?.name ?? '—'}</td>
                      <td className="px-4 py-3"><SegmentBadges segments={p.segments} /></td>
                      <td className="px-4 py-3 text-slate-600">{formatBRL(p.suggestedPrice)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {p.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" className="size-8"
                            onClick={() => setProductSheet({ open: true, item: p })}>
                            <Pencil className="size-3.5" />
                          </Button>
                          {p.active ? (
                            <Button size="icon" variant="ghost" className="size-8 text-red-500 hover:text-red-600"
                              onClick={() => handleDeactivateProduct(p.id)}>
                              <PowerOff className="size-3.5" />
                            </Button>
                          ) : (
                            <Button size="icon" variant="ghost" className="size-8 text-green-600 hover:text-green-700"
                              onClick={() => handleReactivateProduct(p.id)}>
                              <RotateCcw className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Sheets */}
      <CatalogServiceSheet
        open={serviceSheet.open}
        item={serviceSheet.item}
        categories={categories?.services ?? []}
        onClose={() => setServiceSheet({ open: false })}
      />
      <CatalogProductSheet
        open={productSheet.open}
        item={productSheet.item}
        categories={categories?.products ?? []}
        onClose={() => setProductSheet({ open: false })}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**
```bash
git add src/app/(admin)/admin/catalogo/
git commit -m "feat(admin): página de gestão do catálogo mestre"
```

---

## Task 8: Verificação final

- [ ] **Step 1: TypeScript**
```bash
npx tsc --noEmit
```
Esperado: zero erros.

- [ ] **Step 2: Verificar que o Shadcn tem os componentes necessários**

Se algum componente não existir, instalar:
```bash
npx shadcn@latest add sheet switch checkbox select tabs
```

- [ ] **Step 3: Commit final se necessário**
```bash
git add -A
git commit -m "chore(admin): ajustes finais TypeScript no catálogo mestre"
```

- [ ] **Step 4: Confirmar branch e não abrir PR**
```bash
git log --oneline -8
git branch
```
Reportar o nome da branch (`feat/admin-catalogo-mestre`) e os commits realizados.
