# Melhorias: Produtos, Serviços, Clientes e Combobox Global — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir lacunas funcionais em Produtos, Serviços e Clientes, adicionar pacotes/promoções ao agendamento público e criar componente ComboboxField reutilizável.

**Architecture:** Alterações cirúrgicas por módulo — domain types → API routes → hooks → componentes UI. A migration Prisma é aditiva (nullable columns). Paginação client-side nos catálogos internos (listas pequenas); server-side onde já existe.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma, Zod, TanStack Query, Shadcn UI (Command/Popover), Vitest

---

## Mapa de arquivos

| Arquivo | Ação | Tarefa |
|---|---|---|
| `src/components/ui/combobox-field.tsx` | Criar | 1 |
| `src/domains/inventory/types.ts` | Modificar | 2 |
| `src/components/domain/inventory/ProductFormModal.tsx` | Modificar | 2, 3, 4 |
| `src/app/api/uploads/service-images/route.ts` | Modificar | 3 |
| `src/components/ui/image-upload-field.tsx` | Modificar | 3 |
| `src/app/api/products/[id]/adjust/route.ts` | Criar | 4 |
| `src/domains/inventory/inventory.service.ts` | Modificar | 4 |
| `src/app/(app)/produtos/page.tsx` | Modificar | 5 |
| `src/hooks/scheduling/use-services.ts` | Modificar | 6 |
| `src/components/domain/services/service-catalog.tsx` | Modificar | 6 |
| `src/components/domain/services/service-form-modal.tsx` | Modificar | 7 |
| `src/components/domain/services/package-catalog.tsx` | Modificar | 8 |
| `src/components/domain/services/promotion-catalog.tsx` | Modificar | 8 |
| `src/domains/crm/types.ts` | Modificar | 9 |
| `src/components/domain/crm/create-customer-modal.tsx` | Modificar | 9 |
| `src/components/domain/crm/edit-customer-modal.tsx` | Criar | 10 |
| `src/app/(app)/clientes/[id]/page.tsx` | Modificar | 10 |
| `src/components/domain/crm/customer-list.tsx` | Modificar | 11 |
| `src/components/domain/inventory/ProductFormModal.tsx` | Modificar | 12 |
| `src/components/domain/services/service-form-modal.tsx` | Modificar | 12 |
| `src/components/domain/inventory/StockPurchaseModal.tsx` | Modificar | 12 |
| `src/components/domain/inventory/StockSaleModal.tsx` | Modificar | 12 |
| `prisma/schema.prisma` | Modificar | 13 |
| `src/domains/scheduling/public-booking.repository.ts` | Modificar | 14 |
| `src/app/api/public/[slug]/route.ts` | Modificar | 14 |
| `src/app/api/public/[slug]/appointments/route.ts` | Modificar | 14 |
| `src/app/(public)/agendar/[slug]/types.ts` | Modificar | 15 |
| `src/app/(public)/agendar/[slug]/booking-client.tsx` | Modificar | 15 |
| `src/components/domain/booking/service-step.tsx` | Modificar | 15 |

---

## Task 1: ComboboxField — componente base

**Files:**
- Criar: `src/components/ui/combobox-field.tsx`

- [ ] **Criar o componente ComboboxField**

```tsx
// src/components/ui/combobox-field.tsx
'use client'

import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type Option = { value: string; label: string }

type ComboboxFieldProps = {
  options: Option[]
  value?: string
  onChange: (value: string | undefined) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
}

export function ComboboxField({
  options,
  value,
  onChange,
  placeholder = 'Selecionar...',
  searchPlaceholder = 'Buscar...',
  emptyMessage = 'Nenhum resultado.',
  disabled,
  className,
}: ComboboxFieldProps) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', className)}
        >
          <span className={cn(!selected && 'text-muted-foreground')}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onChange(option.value === value ? undefined : option.value)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 size-4',
                      value === option.value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
```

> Nota: `CommandItem.value` recebe `option.label` (texto de exibição) para que a busca interna do Command filtre pelo label visível ao usuário.

- [ ] **Verificar que os pacotes shadcn necessários estão instalados**

```bash
grep -E '"@radix-ui/react-popover"|"cmdk"' package.json
```

Esperado: ambas as entradas presentes. Se não estiverem: `npx shadcn@latest add command popover`

- [ ] **Commit**

```bash
git add src/components/ui/combobox-field.tsx
git commit -m "feat(ui): adiciona ComboboxField com busca por digitação"
```

---

## Task 2: Produtos — salePrice opcional

**Files:**
- Modificar: `src/domains/inventory/types.ts`
- Modificar: `src/components/domain/inventory/ProductFormModal.tsx`

- [ ] **Tornar salePrice opcional no schema de domínio**

Em `src/domains/inventory/types.ts`, alterar a linha do `salePrice`:

```typescript
// Antes:
salePrice: z.number().positive(),

// Depois:
salePrice: z.number().nonnegative().optional(),
```

- [ ] **Atualizar o modal de produto — remover obrigatoriedade de salePrice**

Em `src/components/domain/inventory/ProductFormModal.tsx`, alterar o schema do form:

```typescript
// Antes:
salePrice: z
  .string()
  .min(1, 'Preço de venda é obrigatório')
  .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, 'Valor inválido'),

// Depois:
salePrice: z
  .string()
  .optional()
  .refine(
    (v) => v === undefined || v === '' || (!isNaN(parseFloat(v)) && parseFloat(v) >= 0),
    'Valor inválido',
  ),
```

Também remover o asterisco e alterar o `onSubmit` para passar `salePrice` como optional:

```typescript
// No onSubmit, alterar:
const basePayload = {
  name: values.name,
  categoryId: values.categoryId || undefined,
  costPrice: parseFloat(values.costPrice),
  salePrice: values.salePrice !== undefined && values.salePrice !== ''
    ? parseFloat(values.salePrice)
    : undefined,
  lowStockAlert: values.lowStockAlert !== undefined && values.lowStockAlert !== ''
    ? parseInt(values.lowStockAlert)
    : undefined,
}
```

No JSX, remover o `<span className="text-rose-500">*</span>` do label de Preço de Venda.

- [ ] **Corrigir cálculo de patrimônio na tabela**

Em `src/components/domain/inventory/ProductsTable.tsx`, o tipo `Product` tem `salePrice: string`. Garantir que o cálculo usa fallback:

```typescript
// Linha de cálculo do patrimônio (dentro do .map):
const patrimony = (Number(product.salePrice) || 0) * product.stockQuantity
```

- [ ] **Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Esperado: zero erros relacionados a `salePrice`.

- [ ] **Commit**

```bash
git add src/domains/inventory/types.ts src/components/domain/inventory/ProductFormModal.tsx src/components/domain/inventory/ProductsTable.tsx
git commit -m "feat(produtos): torna preço de venda opcional no cadastro"
```

---

## Task 3: Produtos — upload de imagem

**Files:**
- Modificar: `src/app/api/uploads/service-images/route.ts`
- Modificar: `src/components/ui/image-upload-field.tsx`
- Modificar: `src/components/domain/inventory/ProductFormModal.tsx`

- [ ] **Adicionar 'products' como entityType permitido na rota de upload**

Em `src/app/api/uploads/service-images/route.ts`:

```typescript
// Antes:
const ALLOWED_ENTITY_TYPES = new Set(['services', 'packages', 'promotions'])

// Depois:
const ALLOWED_ENTITY_TYPES = new Set(['services', 'packages', 'promotions', 'products'])
```

- [ ] **Expandir o tipo do ImageUploadField para aceitar 'products'**

Em `src/components/ui/image-upload-field.tsx`:

```typescript
// Antes:
type Props = {
  entityType: 'services' | 'packages' | 'promotions'
  // ...
}

// Depois:
type Props = {
  entityType: 'services' | 'packages' | 'promotions' | 'products'
  // ...
}
```

- [ ] **Adicionar campo de imagem no ProductFormModal (modo edição apenas)**

Em `src/components/domain/inventory/ProductFormModal.tsx`, adicionar import e estado:

```typescript
import { ImageUploadField } from '@/components/ui/image-upload-field'

// No tipo Product (já tem imageUrl: string | null) — sem mudança.

// No useEffect de reset, adicionar inicialização de imageUrl (já existe no estado do product):
// Precisamos adicionar um estado local para imageUrl
const [localImageUrl, setLocalImageUrl] = useState<string | null>(null)

useEffect(() => {
  if (open && product) {
    reset({ /* ... campos existentes ... */ })
    setLocalImageUrl(product.imageUrl)
  } else if (open && !product) {
    reset({ /* ... */ })
    setLocalImageUrl(null)
  }
}, [open, product, reset])
```

No formulário, após o campo de `lowStockAlert` e antes dos botões, adicionar:

```tsx
{isEditing && product && (
  <ImageUploadField
    entityType="products"
    entityId={product.id}
    value={localImageUrl}
    onChange={(url) => {
      setLocalImageUrl(url)
      // Persiste imediatamente via PATCH
      updateProduct.mutate({ id: product.id, imageUrl: url ?? undefined })
    }}
    label="Imagem do produto"
  />
)}

{!isEditing && (
  <p className="text-xs text-muted-foreground">
    Salve o produto para adicionar uma imagem.
  </p>
)}
```

- [ ] **Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -i "image\|product" | head -10
```

Esperado: zero erros.

- [ ] **Commit**

```bash
git add src/app/api/uploads/service-images/route.ts src/components/ui/image-upload-field.tsx src/components/domain/inventory/ProductFormModal.tsx
git commit -m "feat(produtos): adiciona upload de imagem no modo edição"
```

---

## Task 4: Produtos — ajuste direto de estoque

**Files:**
- Criar: `src/app/api/products/[id]/adjust/route.ts`
- Modificar: `src/domains/inventory/inventory.service.ts`
- Modificar: `src/domains/inventory/types.ts`
- Modificar: `src/components/domain/inventory/ProductFormModal.tsx`

- [ ] **Adicionar schema de ajuste de estoque nos tipos do domínio**

Em `src/domains/inventory/types.ts`, adicionar após `recordSaleSchema`:

```typescript
export const adjustStockSchema = z.object({
  targetQuantity: z.number().int().min(0, 'Quantidade não pode ser negativa'),
})
export type AdjustStockInput = z.infer<typeof adjustStockSchema>
```

- [ ] **Adicionar método adjustStock no inventory service**

Em `src/domains/inventory/inventory.service.ts`, verificar se há um método `recordPurchase` como referência, depois adicionar:

```typescript
async adjustStock(tenantId: string, productId: string, input: AdjustStockInput) {
  const product = await this.repo.findById(tenantId, productId)
  if (!product) throw new NotFoundError('Produto')

  const current = product.stockQuantity
  const target = input.targetQuantity
  if (current === target) return product

  const quantity = Math.abs(target - current)
  const type = target > current ? StockMovementType.PURCHASE : StockMovementType.SALE

  return this.repo.recordMovement(tenantId, productId, {
    type: StockMovementType.ADJUSTMENT,
    quantity: target - current, // pode ser negativo para ADJUSTMENT
    unitPrice: new Prisma.Decimal(0),
    notes: 'Ajuste manual de estoque',
  })
}
```

> Nota: se o repositório não tiver `recordMovement` genérico, usar `recordPurchase` e `recordSale` separadamente dependendo da direção. Consultar `src/domains/inventory/inventory.repository.ts` para o método correto a chamar.

- [ ] **Criar endpoint de ajuste de estoque**

Criar `src/app/api/products/[id]/adjust/route.ts`:

```typescript
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { ensurePermission } from '@/shared/auth/permissions'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { inventoryService } from '@/domains/inventory/inventory.service'
import { adjustStockSchema } from '@/domains/inventory/types'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, 'produtos', 'edit')
    const { id } = await params
    const input = await validateInput(request, adjustStockSchema)
    const result = await inventoryService.adjustStock(session.tenantId, id, input)
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Adicionar UI de ajuste no ProductFormModal**

Em `src/components/domain/inventory/ProductFormModal.tsx`, adicionar estado e handler:

```typescript
const [adjustTarget, setAdjustTarget] = useState('')
const [adjusting, setAdjusting] = useState(false)

async function handleAdjustStock() {
  if (!product || adjustTarget === '') return
  const target = parseInt(adjustTarget)
  if (isNaN(target) || target < 0) return
  setAdjusting(true)
  try {
    const res = await fetch(`/api/products/${product.id}/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetQuantity: target }),
    })
    if (!res.ok) throw new Error('Falha ao ajustar estoque')
    toast.success(`Estoque ajustado para ${target} unidades`)
    setAdjustTarget('')
    updateProduct.mutate({ id: product.id }) // força revalidação via TanStack Query
  } catch {
    toast.error('Erro ao ajustar estoque')
  } finally {
    setAdjusting(false)
  }
}
```

Substituir o bloco de exibição de estoque atual por:

```tsx
{isEditing && product?.stockQuantity !== undefined && (
  <div className="space-y-2">
    <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
      Estoque atual: <strong className="text-foreground">{product.stockQuantity}</strong> unidades
    </div>
    <div className="flex gap-2">
      <Input
        type="number"
        min="0"
        placeholder="Ajustar para..."
        value={adjustTarget}
        onChange={(e) => setAdjustTarget(e.target.value)}
        className="flex-1"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={adjusting || adjustTarget === ''}
        onClick={handleAdjustStock}
      >
        {adjusting ? 'Ajustando...' : 'Ajustar'}
      </Button>
    </div>
  </div>
)}
```

- [ ] **Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -i "adjust\|stock" | head -10
```

- [ ] **Commit**

```bash
git add src/app/api/products/[id]/adjust/route.ts src/domains/inventory/types.ts src/domains/inventory/inventory.service.ts src/components/domain/inventory/ProductFormModal.tsx
git commit -m "feat(produtos): adiciona ajuste direto de quantidade em estoque"
```

---

## Task 5: Produtos — paginação

**Files:**
- Modificar: `src/app/(app)/produtos/page.tsx`

- [ ] **Adicionar paginação à aba de Produtos**

Em `src/app/(app)/produtos/page.tsx`, adicionar estado de página e alterar a chamada de `useProducts`:

```typescript
// Adicionar estado de paginação
const [page, setPage] = useState(1)
const PAGE_SIZE = 10

// Alterar chamada useProducts para incluir paginação
const { data: productsData, isLoading: loadingProducts } = useProducts({
  name: search || undefined,
  categoryId: categoryFilter,
  page,
  pageSize: PAGE_SIZE,
})

const totalPages = productsData ? Math.ceil(productsData.total / PAGE_SIZE) : 1

// Resetar página ao mudar filtros — adicionar nos onChange:
onChange={(e) => {
  setSearch(e.target.value)
  setPage(1)
}}
// E no select de categoria:
onValueChange={(v) => {
  setCategoryFilter(v === 'all' ? undefined : v)
  setPage(1)
}}
```

Após `<ProductsTable>`, adicionar controles de paginação:

```tsx
{totalPages > 1 && (
  <div className="flex items-center justify-center gap-2 pt-2">
    <Button
      variant="outline"
      size="sm"
      onClick={() => setPage((p) => p - 1)}
      disabled={page <= 1}
    >
      Anterior
    </Button>
    <span className="text-xs text-muted-foreground">
      {page} / {totalPages}
    </span>
    <Button
      variant="outline"
      size="sm"
      onClick={() => setPage((p) => p + 1)}
      disabled={page >= totalPages}
    >
      Próxima
    </Button>
  </div>
)}
```

- [ ] **Adicionar paginação às abas Compras e Vendas**

No mesmo arquivo, adicionar estados separados para movimentações:

```typescript
const [purchasePage, setPurchasePage] = useState(1)
const [salePage, setSalePage] = useState(1)

const { data: purchasesData } = useStockMovements({ type: 'PURCHASE', page: purchasePage, pageSize: PAGE_SIZE })
const { data: salesData } = useStockMovements({ type: 'SALE', page: salePage, pageSize: PAGE_SIZE })

const purchaseTotalPages = purchasesData ? Math.ceil(purchasesData.total / PAGE_SIZE) : 1
const saleTotalPages = salesData ? Math.ceil(salesData.total / PAGE_SIZE) : 1
```

Adicionar controles de paginação abaixo de cada `<StockMovementsTable>`.

- [ ] **Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Commit**

```bash
git add src/app/(app)/produtos/page.tsx
git commit -m "feat(produtos): adiciona paginação de 10 itens por página"
```

---

## Task 6: Serviços — reativar serviço desativado

**Files:**
- Modificar: `src/hooks/scheduling/use-services.ts`
- Modificar: `src/components/domain/services/service-catalog.tsx`

- [ ] **Adicionar hook useActivateService**

Em `src/hooks/scheduling/use-services.ts`, após `useDeactivateService`, adicionar:

```typescript
async function activateService(id: string): Promise<Service> {
  const res = await fetch(`/api/scheduling/services/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active: true }),
  })
  if (!res.ok) throw new Error('Falha ao reativar serviço')
  return res.json()
}

export function useActivateService() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: activateService,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['services'] }),
  })
}
```

> Nota: o endpoint `PATCH /api/scheduling/services/[id]` já aceita `{ active: true }` via `updateServiceSchema`. Sem mudança de backend.

- [ ] **Adicionar botão Reativar no ServiceCatalog**

Em `src/components/domain/services/service-catalog.tsx`:

```typescript
// Adicionar import
import { useActivateService, useDeactivateService, useServices, type Service } from '@/hooks/scheduling/use-services'
import { PowerOff } from 'lucide-react'

// No componente, adicionar:
const { mutate: activate } = useActivateService()

function handleActivate(service: Service) {
  if (!confirm(`Reativar "${service.name}"?`)) return
  activate(service.id)
}
```

Substituir o bloco de botões de ação:

```tsx
<div className="flex gap-1">
  <Button
    variant="ghost"
    size="icon"
    onClick={() => handleEdit(service)}
    className="size-8"
    title="Editar"
  >
    <Edit2 className="size-3.5" />
  </Button>
  {service.active ? (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => handleDeactivate(service)}
      className="size-8 text-muted-foreground hover:text-destructive"
      title="Desativar"
    >
      <Power className="size-3.5" />
    </Button>
  ) : (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => handleActivate(service)}
      className="size-8 text-muted-foreground hover:text-emerald-600"
      title="Reativar"
    >
      <PowerOff className="size-3.5" />
    </Button>
  )}
</div>
```

- [ ] **Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -i "service\|active" | head -10
```

- [ ] **Commit**

```bash
git add src/hooks/scheduling/use-services.ts src/components/domain/services/service-catalog.tsx
git commit -m "feat(servicos): adiciona botão de reativar serviço desativado"
```

---

## Task 7: Serviços — imagem somente na edição

**Files:**
- Modificar: `src/components/domain/services/service-form-modal.tsx`

- [ ] **Condicionar ImageUploadField ao modo edição**

Em `src/components/domain/services/service-form-modal.tsx`, localizar o bloco do `ImageUploadField` (linhas ~233-239) e envolver com condição:

```tsx
{/* Imagem — somente na edição */}
{isEditing ? (
  <ImageUploadField
    entityType="services"
    entityId={service?.id ?? null}
    value={imageUrl}
    onChange={setImageUrl}
    label="Imagem do serviço"
  />
) : (
  <p className="text-xs text-muted-foreground">
    Salve o serviço para adicionar uma imagem.
  </p>
)}
```

- [ ] **Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Commit**

```bash
git add src/components/domain/services/service-form-modal.tsx
git commit -m "fix(servicos): oculta campo de imagem no cadastro novo, mantém na edição"
```

---

## Task 8: Serviços, Pacotes e Promoções — paginação nos catálogos

**Files:**
- Modificar: `src/components/domain/services/service-catalog.tsx`
- Modificar: `src/components/domain/services/package-catalog.tsx`
- Modificar: `src/components/domain/services/promotion-catalog.tsx`

Os hooks `useServices`, `usePackages` e `usePromotions` retornam arrays. A paginação será client-side (slice) já que estas listas são pequenas em uso real.

- [ ] **Adicionar paginação client-side ao ServiceCatalog**

Em `src/components/domain/services/service-catalog.tsx`, adicionar:

```typescript
const PAGE_SIZE = 10
const [page, setPage] = useState(1)

// Derivar items da página atual
const allServices = services ?? []
const totalPages = Math.ceil(allServices.length / PAGE_SIZE)
const pagedServices = allServices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
```

Substituir `{services.map(...)}` por `{pagedServices.map(...)}`.

Adicionar controles após a lista:

```tsx
{totalPages > 1 && (
  <div className="flex items-center justify-center gap-2 pt-2">
    <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>Anterior</Button>
    <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
    <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>Próxima</Button>
  </div>
)}
```

- [ ] **Idem para PackageCatalog**

Em `src/components/domain/services/package-catalog.tsx`, aplicar o mesmo padrão de paginação client-side com `PAGE_SIZE = 10`.

- [ ] **Idem para PromotionCatalog**

Em `src/components/domain/services/promotion-catalog.tsx`, aplicar o mesmo padrão.

- [ ] **Commit**

```bash
git add src/components/domain/services/service-catalog.tsx src/components/domain/services/package-catalog.tsx src/components/domain/services/promotion-catalog.tsx
git commit -m "feat(servicos): adiciona paginação de 10 itens nos catálogos de serviços, pacotes e promoções"
```

---

## Task 9: Clientes — campo birthDate

**Files:**
- Modificar: `src/domains/crm/types.ts`
- Modificar: `src/components/domain/crm/create-customer-modal.tsx`

- [ ] **Adicionar birthDate ao schema de criação de clientes**

Em `src/domains/crm/types.ts`, alterar `createCustomerSchema`:

```typescript
export const createCustomerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(8).max(30).optional(),
  email: z.email().optional(),
  notes: z.string().trim().max(500).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  birthDate: z.string().date().optional(),
})
```

> `updateCustomerSchema` usa `.partial()` sobre `createCustomerSchema` — herda `birthDate` automaticamente.

- [ ] **Adicionar campo birthDate ao CreateCustomerModal**

Em `src/components/domain/crm/create-customer-modal.tsx`, adicionar estado e campo:

```typescript
const [birthDate, setBirthDate] = useState('')

// Limpar no handleClose:
setBirthDate('')

// No mutate, adicionar ao payload:
createCustomer.mutate({
  name: name.trim(),
  phone: phone.trim() || undefined,
  email: email.trim() || undefined,
  birthDate: birthDate || undefined,
})
```

No JSX, após o campo de e-mail:

```tsx
<div className="space-y-1.5">
  <Label>Data de Nascimento</Label>
  <Input
    type="date"
    value={birthDate}
    onChange={(e) => setBirthDate(e.target.value)}
    max={new Date().toISOString().split('T')[0]}
  />
</div>
```

- [ ] **Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -i "birth\|customer" | head -10
```

- [ ] **Commit**

```bash
git add src/domains/crm/types.ts src/components/domain/crm/create-customer-modal.tsx
git commit -m "feat(clientes): adiciona campo de data de nascimento opcional"
```

---

## Task 10: Clientes — modal de edição

**Files:**
- Criar: `src/components/domain/crm/edit-customer-modal.tsx`
- Modificar: `src/app/(app)/clientes/[id]/page.tsx`

- [ ] **Criar o EditCustomerModal**

```tsx
// src/components/domain/crm/edit-customer-modal.tsx
'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useUpdateCustomer, type Customer } from '@/hooks/crm/use-customers'

type Props = {
  open: boolean
  onClose: () => void
  customer: Customer
}

export function EditCustomerModal({ open, onClose, customer }: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const updateCustomer = useUpdateCustomer()

  useEffect(() => {
    if (open) {
      setName(customer.name)
      setPhone(customer.phone ?? '')
      setEmail(customer.email ?? '')
      setBirthDate(customer.birthDate ? customer.birthDate.split('T')[0] : '')
    }
  }, [open, customer])

  function handleClose() {
    onClose()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    updateCustomer.mutate(
      {
        id: customer.id,
        input: {
          name: name.trim(),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          birthDate: birthDate || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success('Dados atualizados com sucesso')
          handleClose()
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Erro ao atualizar cliente')
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar dados do cliente</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input
              placeholder="Nome completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input
              placeholder="(00) 00000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
            />
          </div>

          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input
              placeholder="email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Data de Nascimento</Label>
            <Input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleClose}
              disabled={updateCustomer.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-slate-950 text-white hover:bg-slate-800"
              disabled={!name.trim() || updateCustomer.isPending}
            >
              {updateCustomer.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

> Nota: o tipo `Customer` em `use-customers.ts` já tem `birthDate: string | null`. Se não tiver, adicionar ao tipo.

- [ ] **Adicionar birthDate ao tipo Customer (se necessário)**

Em `src/hooks/crm/use-customers.ts`, verificar se `birthDate` está no tipo `Customer`. Se não:

```typescript
export type Customer = {
  // ... campos existentes ...
  birthDate: string | null  // adicionar se não existir
}
```

- [ ] **Adicionar botão Editar e modal na página de perfil**

Em `src/app/(app)/clientes/[id]/page.tsx`, adicionar:

```typescript
import { EditCustomerModal } from '@/components/domain/crm/edit-customer-modal'
import { Pencil } from 'lucide-react'

// Adicionar estado:
const [editOpen, setEditOpen] = useState(false)
```

No header da página (próximo ao botão de voltar), adicionar:

```tsx
{customer && (
  <Button
    variant="outline"
    size="sm"
    onClick={() => setEditOpen(true)}
    className="gap-1.5"
  >
    <Pencil className="size-3.5" />
    Editar dados
  </Button>
)}
```

Ao final do JSX, antes de fechar o `<div>` principal:

```tsx
{customer && (
  <EditCustomerModal
    open={editOpen}
    onClose={() => setEditOpen(false)}
    customer={customer}
  />
)}
```

- [ ] **Exibir birthDate no perfil quando preenchido**

Em `src/components/domain/crm/customer-profile-header.tsx` (ou onde os dados são exibidos), adicionar exibição da data de nascimento:

```tsx
{customer.birthDate && (
  <span className="flex items-center gap-1 text-xs text-slate-500">
    {new Date(customer.birthDate).toLocaleDateString('pt-BR')}
    {' · '}
    {new Date().getFullYear() - new Date(customer.birthDate).getFullYear()} anos
  </span>
)}
```

- [ ] **Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -i "customer\|birth\|edit" | head -10
```

- [ ] **Commit**

```bash
git add src/components/domain/crm/edit-customer-modal.tsx src/app/(app)/clientes/[id]/page.tsx src/hooks/crm/use-customers.ts src/components/domain/crm/customer-profile-header.tsx
git commit -m "feat(clientes): adiciona modal de edição de dados no perfil do cliente"
```

---

## Task 11: Clientes — paginação 10 itens

**Files:**
- Modificar: `src/components/domain/crm/customer-list.tsx`

- [ ] **Alterar pageSize para 10**

Em `src/components/domain/crm/customer-list.tsx`, alterar:

```typescript
// Antes:
pageSize: 20,

// Depois:
pageSize: 10,
```

- [ ] **Commit**

```bash
git add src/components/domain/crm/customer-list.tsx
git commit -m "feat(clientes): reduz paginação para 10 itens por página"
```

---

## Task 12: ComboboxField — substituições nos modais

**Files:**
- Modificar: `src/components/domain/inventory/ProductFormModal.tsx`
- Modificar: `src/components/domain/services/service-form-modal.tsx`
- Modificar: `src/components/domain/inventory/StockPurchaseModal.tsx`
- Modificar: `src/components/domain/inventory/StockSaleModal.tsx`

- [ ] **Substituir Select de Categoria no ProductFormModal**

Em `src/components/domain/inventory/ProductFormModal.tsx`:

```typescript
// Adicionar import:
import { ComboboxField } from '@/components/ui/combobox-field'

// Remover imports de Select* não mais usados nesse campo
```

Substituir o bloco do Select de categoria:

```tsx
{/* Antes: <Select value={categoryId ?? ''} ...> ... </Select> */}

{/* Depois: */}
<div className="space-y-1.5">
  <Label>Categoria</Label>
  <ComboboxField
    options={categories.map((c) => ({ value: c.id, label: c.name }))}
    value={categoryId ?? undefined}
    onChange={(v) => setValue('categoryId', v)}
    placeholder="Selecionar categoria"
    searchPlaceholder="Buscar categoria..."
    emptyMessage="Nenhuma categoria encontrada."
  />
</div>
```

- [ ] **Substituir Select de Categoria no ServiceFormModal**

Em `src/components/domain/services/service-form-modal.tsx`, adicionar import do `ComboboxField` e substituir o Select de categoria:

```typescript
import { ComboboxField } from '@/components/ui/combobox-field'
```

```tsx
{/* Categoria */}
<div className="space-y-2">
  <Label htmlFor="service-category">Categoria</Label>
  <ComboboxField
    options={categories.map((c) => ({ value: c.id, label: c.name }))}
    value={categoryId ?? undefined}
    onChange={(v) => setCategoryId(v ?? null)}
    placeholder="Sem categoria"
    searchPlaceholder="Buscar categoria..."
    emptyMessage="Nenhuma categoria."
  />
</div>
```

Manter o Select de "Adicionar produto ao kit" como está (já é um Select com busca implícita de lista pequena, pode ser migrado em etapa futura se necessário).

- [ ] **Substituir Select de Produto no StockPurchaseModal**

Ler o arquivo `src/components/domain/inventory/StockPurchaseModal.tsx` para identificar o campo de seleção de produto e substituir pelo `ComboboxField`. O padrão é:

```tsx
import { ComboboxField } from '@/components/ui/combobox-field'

// Onde seleciona produto:
<ComboboxField
  options={products.map((p) => ({ value: p.id, label: p.name }))}
  value={productId}
  onChange={(v) => setProductId(v ?? '')}
  placeholder="Selecionar produto"
  searchPlaceholder="Buscar produto..."
  emptyMessage="Nenhum produto encontrado."
/>
```

- [ ] **Substituir Select de Produto no StockSaleModal**

Idem para `src/components/domain/inventory/StockSaleModal.tsx`.

- [ ] **Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Commit**

```bash
git add src/components/domain/inventory/ProductFormModal.tsx src/components/domain/services/service-form-modal.tsx src/components/domain/inventory/StockPurchaseModal.tsx src/components/domain/inventory/StockSaleModal.tsx
git commit -m "feat(ui): substitui selects por ComboboxField com busca por digitação"
```

---

## Task 13: Pacotes/Promoções — migration Prisma

**Files:**
- Modificar: `prisma/schema.prisma`

- [ ] **Tornar serviceId opcional e adicionar packageId/promotionId no Appointment**

Em `prisma/schema.prisma`, localizar o modelo `Appointment` e alterar:

```prisma
model Appointment {
  id              String            @id @default(cuid())
  tenantId        String
  customerId      String
  professionalId  String
  serviceId       String?           // era String (obrigatório)
  packageId       String?           // novo campo
  promotionId     String?           // novo campo
  startsAt        DateTime
  endsAt          DateTime
  // ... demais campos sem mudança ...

  service         Service?          @relation(fields: [serviceId], references: [id], onDelete: Restrict)
  package         ServicePackage?   @relation(fields: [packageId], references: [id], onDelete: SetNull)
  promotion       Promotion?        @relation(fields: [promotionId], references: [id], onDelete: SetNull)
  // ... demais relations sem mudança ...

  @@index([tenantId])
  @@index([tenantId, startsAt])
  @@index([tenantId, professionalId, startsAt])
  @@index([packageId])
  @@index([promotionId])
}
```

Também adicionar `appointments` na relation do `ServicePackage` e `Promotion` no schema (se não existirem):

```prisma
// Em ServicePackage:
appointments  Appointment[]

// Em Promotion:
appointments  Appointment[]
```

- [ ] **Gerar e executar a migration**

```bash
npx prisma migrate dev --name "appointment-package-promotion-optional-service"
```

Esperado: migration criada em `prisma/migrations/` e aplicada ao banco.

- [ ] **Verificar schema gerado**

```bash
npx prisma generate
npx tsc --noEmit 2>&1 | head -20
```

Esperado: zero erros de TypeScript.

- [ ] **Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): torna serviceId opcional em Appointment, adiciona packageId e promotionId"
```

---

## Task 14: Pacotes/Promoções — backend

**Files:**
- Modificar: `src/domains/scheduling/public-booking.repository.ts`
- Modificar: `src/app/api/public/[slug]/route.ts`
- Modificar: `src/app/api/public/[slug]/appointments/route.ts`

- [ ] **Adicionar findPublicPackages e findPublicPromotions ao repositório**

Em `src/domains/scheduling/public-booking.repository.ts`, adicionar os dois métodos à classe `PublicBookingRepository`:

```typescript
async findPublicPackages(tenantId: string) {
  const packages = await prisma.servicePackage.findMany({
    where: { tenantId, active: true },
    select: {
      id: true,
      name: true,
      description: true,
      imageUrl: true,
      price: true,
      items: {
        select: {
          service: { select: { id: true, duration: true, name: true } },
        },
      },
    },
    orderBy: { name: 'asc' },
  })
  return packages.map((pkg) => ({
    ...pkg,
    duration: pkg.items.reduce((sum, item) => sum + item.service.duration, 0),
    serviceNames: pkg.items.map((i) => i.service.name),
  }))
}

async findPublicPromotions(tenantId: string) {
  const now = new Date()
  const promotions = await prisma.promotion.findMany({
    where: {
      tenantId,
      active: true,
      OR: [
        { startsAt: null },
        { startsAt: { lte: now } },
      ],
      AND: [
        {
          OR: [
            { endsAt: null },
            { endsAt: { gte: now } },
          ],
        },
      ],
    },
    select: {
      id: true,
      name: true,
      description: true,
      imageUrl: true,
      discountType: true,
      discountValue: true,
      startsAt: true,
      endsAt: true,
      items: {
        select: {
          serviceId: true,
          packageId: true,
          service: { select: { id: true, name: true, price: true, duration: true } },
          package: { select: { id: true, name: true, price: true } },
        },
      },
    },
    orderBy: { name: 'asc' },
  })
  return promotions
}
```

- [ ] **Expor pacotes e promoções na rota pública**

Em `src/app/api/public/[slug]/route.ts`, alterar o handler:

```typescript
const [services, professionals, packages, promotions] = await Promise.all([
  publicBookingRepository.findPublicServices(tenant.id),
  publicBookingRepository.findPublicProfessionals(tenant.id),
  publicBookingRepository.findPublicPackages(tenant.id),
  publicBookingRepository.findPublicPromotions(tenant.id),
])

return Response.json({
  name: tenant.name,
  slug: tenant.slug,
  address: tenant.address,
  timezone: tenant.timezone,
  businessHours: tenant.businessHours,
  branding: tenant.brandingConfig,
  services,
  professionals,
  packages,
  promotions,
  allowPublicBooking: tenant.schedulingPolicy?.allowPublicBooking ?? true,
})
```

- [ ] **Atualizar o endpoint de criação de agendamento público para aceitar packageId**

Em `src/app/api/public/[slug]/appointments/route.ts`, alterar o schema de validação:

```typescript
const CreatePublicAppointmentSchema = z.object({
  serviceId: z.string().min(1).optional(),
  packageId: z.string().min(1).optional(),
  professionalId: z.string().min(1).optional(),
  startsAt: z.string().datetime(),
  customerName: z.string().min(2).max(100),
  customerPhone: z.string().min(10).max(20),
  notes: z.string().max(500).optional(),
}).refine(
  (data) => data.serviceId || data.packageId,
  { message: 'serviceId ou packageId é obrigatório' }
)
```

Após a validação do `input`, adicionar o branch para pacotes (antes do bloco "13. Criar appointment"):

```typescript
// 13. Criar appointment — serviceId ou packageId
let appointment
if (input.packageId) {
  // Validar que o pacote pertence ao tenant
  const pkg = await prisma.servicePackage.findFirst({
    where: { id: input.packageId, tenantId: tenant.id, active: true },
    include: { items: { include: { service: { select: { duration: true } } } } },
  })
  if (!pkg) {
    return Response.json(
      { error: { code: 'NOT_FOUND', message: 'Pacote não encontrado.' } },
      { status: 404 },
    )
  }
  const duration = pkg.items.reduce((sum, item) => sum + item.service.duration, 0)
  const startsAtDate = new Date(input.startsAt)
  const endsAt = new Date(startsAtDate.getTime() + duration * 60 * 1000)

  await availabilityService.ensureSlotAvailable(tenant.id, professionalId, startsAtDate, endsAt)

  appointment = await prisma.appointment.create({
    data: {
      tenantId: tenant.id,
      customerId: customer.id,
      professionalId,
      serviceId: null,
      packageId: input.packageId,
      startsAt: startsAtDate,
      endsAt,
      notes: input.notes,
      price: pkg.price,
      createdByUserId: owner.id,
      allowOverlap: false,
      paymentStatus: 'PENDING',
    },
  })
} else {
  // Fluxo existente com serviceId
  appointment = await schedulingService.createAppointment(
    tenant.id,
    owner.id,
    {
      customerId: customer.id,
      professionalId,
      serviceId: input.serviceId!,
      startsAt: input.startsAt,
      notes: input.notes,
      allowOverlap: false,
    },
  )
}
```

> Nota: importar `availabilityService` se ainda não estiver importado: `import { availabilityService } from '@/domains/scheduling/availability.service'`

- [ ] **Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Commit**

```bash
git add src/domains/scheduling/public-booking.repository.ts src/app/api/public/[slug]/route.ts src/app/api/public/[slug]/appointments/route.ts
git commit -m "feat(agendamento): expõe pacotes e promoções na API pública e aceita packageId no agendamento"
```

---

## Task 15: Pacotes/Promoções — tipos e ServiceStep

**Files:**
- Modificar: `src/app/(public)/agendar/[slug]/types.ts`
- Modificar: `src/components/domain/booking/service-step.tsx`
- Modificar: `src/app/(public)/agendar/[slug]/booking-client.tsx`

- [ ] **Adicionar tipos públicos de pacote e promoção**

Em `src/app/(public)/agendar/[slug]/types.ts`:

```typescript
export type PublicPackage = {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  price: string
  duration: number
  serviceNames: string[]
}

export type PublicPromotion = {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  discountType: 'PERCENTAGE' | 'FIXED'
  discountValue: string
  startsAt: string | null
  endsAt: string | null
  items: Array<{
    serviceId: string | null
    packageId: string | null
    service: { id: string; name: string; price: string; duration: number } | null
    package: { id: string; name: string; price: string } | null
  }>
}

// Atualizar TenantPublicData:
export type TenantPublicData = {
  name: string
  slug: string
  address?: string | null
  timezone: string
  businessHours?: unknown
  branding?: TenantBranding | null
  services: PublicService[]
  professionals: PublicProfessional[]
  packages: PublicPackage[]
  promotions: PublicPromotion[]
  allowPublicBooking: boolean
}

// Atualizar BookingState para suportar pacote:
export type BookingState = {
  serviceId?: string
  packageId?: string
  promotionId?: string
  serviceName?: string
  serviceDuration?: number
  servicePrice?: string
  professionalId?: string
  professionalName?: string
  startsAt?: Date
  customerName?: string
  customerPhone?: string
  notes?: string
}
```

- [ ] **Atualizar ServiceStep para exibir Serviços, Pacotes e Promoções**

Em `src/components/domain/booking/service-step.tsx`, refatorar para receber também pacotes e promoções:

```tsx
'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { PublicService, PublicPackage, PublicPromotion } from '@/app/(public)/agendar/[slug]/types'
import { ServicePickerWithCategories, type PickerService } from '@/components/domain/services/service-picker-with-categories'

function deriveCategories(services: PublicService[]): Array<{ id: string; name: string }> {
  const seen = new Set<string>()
  const result: Array<{ id: string; name: string }> = []
  for (const s of services) {
    if (s.categoryId && s.categoryName && !seen.has(s.categoryId)) {
      seen.add(s.categoryId)
      result.push({ id: s.categoryId, name: s.categoryName })
    }
  }
  return result
}

function toPickerService(s: PublicService): PickerService {
  return {
    id: s.id,
    name: s.name,
    duration: s.duration,
    price: s.price,
    priceType: s.priceType,
    priceMax: s.priceMax,
    description: s.description,
    imageUrl: s.imageUrl,
    categoryId: s.categoryId,
    categoryName: s.categoryName,
  }
}

type ServiceStepProps = {
  services: PublicService[]
  packages: PublicPackage[]
  promotions: PublicPromotion[]
  onSelectService: (service: PublicService) => void
  onSelectPackage: (pkg: PublicPackage) => void
  primaryColor: string
}

export function ServiceStep({
  services,
  packages,
  promotions,
  onSelectService,
  onSelectPackage,
  primaryColor,
}: ServiceStepProps) {
  const categories = deriveCategories(services)
  const pickerServices = services.map(toPickerService)

  const hasPackages = packages.length > 0
  const hasPromotions = promotions.length > 0
  const showTabs = hasPackages || hasPromotions

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Escolha o serviço</h2>
        <p className="text-sm text-slate-500 mt-1">Selecione o que deseja agendar</p>
      </div>

      {showTabs ? (
        <Tabs defaultValue="servicos">
          <TabsList className="w-full">
            <TabsTrigger value="servicos" className="flex-1">Serviços</TabsTrigger>
            {hasPackages && <TabsTrigger value="pacotes" className="flex-1">Pacotes</TabsTrigger>}
            {hasPromotions && <TabsTrigger value="promocoes" className="flex-1">Promoções</TabsTrigger>}
          </TabsList>

          <TabsContent value="servicos" className="mt-4">
            <ServicePickerWithCategories
              services={pickerServices}
              categories={categories}
              onSelect={(picked) => {
                const original = services.find((s) => s.id === picked.id)
                if (original) onSelectService(original)
              }}
            />
          </TabsContent>

          {hasPackages && (
            <TabsContent value="pacotes" className="mt-4 space-y-2">
              {packages.map((pkg) => (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => onSelectPackage(pkg)}
                  className="w-full rounded-xl border border-border/50 bg-card p-4 text-left hover:border-primary/50 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start gap-3">
                    {pkg.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pkg.imageUrl} alt={pkg.name} className="size-12 rounded-lg object-cover shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{pkg.name}</p>
                      {pkg.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{pkg.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {pkg.serviceNames.join(' + ')} · {pkg.duration} min
                      </p>
                    </div>
                    <p className="font-semibold text-foreground shrink-0">
                      {Number(pkg.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  </div>
                </button>
              ))}
            </TabsContent>
          )}

          {hasPromotions && (
            <TabsContent value="promocoes" className="mt-4 space-y-2">
              {promotions.map((promo) => (
                <div key={promo.id} className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                  <p className="font-medium text-foreground">{promo.name}</p>
                  {promo.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{promo.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Desconto: {promo.discountType === 'PERCENTAGE'
                      ? `${promo.discountValue}%`
                      : Number(promo.discountValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                    }
                  </p>
                  <div className="mt-2 space-y-1">
                    {promo.items.map((item, idx) => item.service && (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          const svc = services.find((s) => s.id === item.service!.id)
                          if (svc) onSelectService(svc)
                        }}
                        className="block w-full rounded-lg bg-white border border-amber-200 px-3 py-2 text-left text-sm hover:border-amber-400 transition-colors"
                      >
                        {item.service.name} — {Number(item.service.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </TabsContent>
          )}
        </Tabs>
      ) : (
        <ServicePickerWithCategories
          services={pickerServices}
          categories={categories}
          onSelect={(picked) => {
            const original = services.find((s) => s.id === picked.id)
            if (original) onSelectService(original)
          }}
        />
      )}
    </div>
  )
}
```

- [ ] **Atualizar BookingClient para passar pacotes/promoções e tratar seleção de pacote**

Em `src/app/(public)/agendar/[slug]/booking-client.tsx`, atualizar o handler de serviço e adicionar handler de pacote:

```typescript
// Adicionar import do tipo:
import type { PublicPackage } from './types'

// Handler de pacote:
function handlePackageSelect(pkg: PublicPackage) {
  setBooking({
    packageId: pkg.id,
    serviceName: pkg.name,
    serviceDuration: pkg.duration,
    servicePrice: Number(pkg.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
  })

  if (singleProfessional) {
    setProfessionalsForService(tenantData.professionals)
    setStep('datetime')
  } else {
    setProfessionalsForService(tenantData.professionals)
    setStep('professional')
  }
}
```

Atualizar o `<ServiceStep>` no render:

```tsx
<ServiceStep
  services={tenantData.services}
  packages={tenantData.packages ?? []}
  promotions={tenantData.promotions ?? []}
  onSelectService={handleServiceSelect}
  onSelectPackage={handlePackageSelect}
  primaryColor={primaryColor}
/>
```

Atualizar o payload enviado para o endpoint de agendamento (em `ConfirmationStep` ou onde `POST` é feito) para incluir `packageId`:

```typescript
body: JSON.stringify({
  serviceId: booking.serviceId,
  packageId: booking.packageId,
  professionalId: booking.professionalId,
  startsAt: booking.startsAt?.toISOString(),
  customerName: booking.customerName,
  customerPhone: booking.customerPhone,
  notes: booking.notes,
})
```

- [ ] **Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Commit**

```bash
git add src/app/(public)/agendar/[slug]/types.ts src/components/domain/booking/service-step.tsx src/app/(public)/agendar/[slug]/booking-client.tsx
git commit -m "feat(agendamento): exibe pacotes e promoções na tela de seleção do agendamento público"
```

---

## Task 16: Verificação final

- [ ] **Build completo**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Testes existentes passando**

```bash
npx vitest run 2>&1 | tail -20
```

Esperado: todos os testes passando (sem regressões).

- [ ] **Push e abertura de PR**

```bash
git push origin feat/melhorias-produtos-servicos-clientes-combobox
gh pr create --title "feat: melhorias em produtos, serviços, clientes e combobox com busca" --body "$(cat <<'EOF'
## Resumo

- Produtos: salePrice opcional, upload de imagem (edição), ajuste direto de estoque, paginação 10 itens
- Serviços: botão reativar, imagem só na edição, paginação nos catálogos
- Clientes: modal de edição, campo birthDate, paginação 10 itens  
- ComboboxField: componente base com busca por digitação, aplicado em Categoria e Produto
- Agendamento público: pacotes e promoções disponíveis para seleção

## Test plan

- [ ] Criar produto sem salePrice — deve salvar sem erro
- [ ] Editar produto e adicionar imagem — deve fazer upload e exibir
- [ ] Ajustar estoque diretamente — quantidade deve atualizar e registrar movimentação
- [ ] Paginação em produtos/clientes/serviços — 10 itens por página
- [ ] Reativar serviço desativado — deve aparecer como ativo
- [ ] Criar serviço — campo de imagem não deve aparecer
- [ ] Editar cliente pelo perfil — dados devem salvar e refletir
- [ ] birthDate aparece no perfil quando preenchido
- [ ] Agendamento público com pacote — fluxo completo até confirmação
- [ ] ComboboxField: digitar filtra opções; seleção fecha o dropdown

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**Cobertura do spec:**
- ✅ salePrice opcional (Task 2)
- ✅ Imagem de produto na edição (Task 3)
- ✅ Ajuste direto de estoque (Task 4)
- ✅ Paginação produtos (Task 5)
- ✅ Reativar serviço (Task 6)
- ✅ Imagem de serviço somente na edição (Task 7)
- ✅ Paginação serviços/pacotes/promoções (Task 8)
- ✅ birthDate no schema e modal de criação (Task 9)
- ✅ EditCustomerModal + perfil (Task 10)
- ✅ Paginação clientes (Task 11)
- ✅ ComboboxField base (Task 1) + substituições (Task 12)
- ✅ Migration Prisma (Task 13)
- ✅ Backend pacotes/promoções API pública (Task 14)
- ✅ Frontend ServiceStep com tabs (Task 15)

**Pontos de atenção para o implementador:**
- Task 4 (adjustStock): verificar o método correto no `inventory.repository.ts` para registrar a movimentação — pode ser `recordMovement` ou métodos separados `recordPurchase`/`recordSale`.
- Task 10 (EditCustomerModal): verificar se `customer-profile-header.tsx` é o componente correto para exibir birthDate, ou se está diretamente em `clientes/[id]/page.tsx`.
- Task 14 (appointments route): importar `availabilityService` e verificar que `prisma` está disponível diretamente (ou usar o repositório de appointments).
- Task 15 (BookingClient): localizar onde o POST de agendamento é feito — pode estar em `ConfirmationStep` — e atualizar o payload para incluir `packageId`.
