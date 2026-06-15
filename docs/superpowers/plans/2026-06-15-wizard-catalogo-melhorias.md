# Wizard Catálogo — Melhorias e Bug Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir tela branca + redirect loop no wizard de catálogo, adicionar tabs por segmento, botão de desativar serviço/produto, e atualizar textos do header.

**Architecture:** Cinco mudanças independentes no wizard `/onboarding/catalogo`. Bugs no layout (loading.tsx + separação de cache). Features no CatalogGrid (tabs + deactivate mutation) e nos card components (botão toggle). Backend com DELETE endpoints e métodos de repository.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma, TanStack Query, Shadcn UI (Tabs, Button, Skeleton), Vitest

---

## Mapa de arquivos

| Arquivo | Ação |
|---------|------|
| `src/app/(app)/onboarding/catalogo/loading.tsx` | **Criar** |
| `src/app/(app)/onboarding/catalogo/page.tsx` | Modificar — textos STEP_CONTENT |
| `src/app/(app)/layout.tsx` | Modificar — separar onboardingCompleted do cache |
| `src/domains/iam/iam.repository.ts` | Modificar — novo método findTenantOnboardingStatus |
| `src/domains/scheduling/service.repository.ts` | Modificar — novo método deleteByCatalogId |
| `src/domains/inventory/product.repository.ts` | Modificar — novo método deleteByCatalogId |
| `src/domains/catalog/catalog.service.ts` | Modificar — deactivateService + deactivateProduct |
| `src/domains/catalog/__tests__/catalog.service.test.ts` | Modificar — testes para deactivate |
| `src/app/api/catalog/services/[id]/activate/route.ts` | Modificar — adicionar DELETE handler |
| `src/app/api/catalog/products/[id]/activate/route.ts` | Modificar — adicionar DELETE handler |
| `src/components/domain/catalog/CatalogServiceCard.tsx` | Modificar — botão desativar |
| `src/components/domain/catalog/CatalogProductCard.tsx` | Modificar — botão desativar |
| `src/components/domain/catalog/CatalogGrid.tsx` | Modificar — deactivate mutation + tabs |

---

## Task 1: Textos do header do wizard

**Files:**
- Modify: `src/app/(app)/onboarding/catalogo/page.tsx`

- [ ] **Step 1: Atualizar STEP_CONTENT no page.tsx**

Substituir o objeto `STEP_CONTENT` (linhas 28–45) por:

```typescript
const STEP_CONTENT: Record<number, StepContent> = {
  1: {
    title: 'Qual é o seu tipo de negócio?',
    description: 'Selecione todos que se aplicam. Você pode alterar depois.',
  },
  2: {
    title: 'Ative seus serviços iniciais',
    description: 'Selecione os serviços que você oferece. Você pode personalizar depois e criar novos exclusivos.',
  },
  3: {
    title: 'Ative seus produtos iniciais',
    description: 'Controle seu estoque de insumos e produtos de revenda. Você pode personalizar depois e adicionar mais.',
  },
  4: {
    title: 'Tudo pronto!',
    description: 'Seu catálogo está configurado. Você pode adicionar mais itens a qualquer momento.',
  },
}
```

- [ ] **Step 2: Verificar TypeScript**

```powershell
npx tsc --noEmit
```

Expected: zero erros

- [ ] **Step 3: Commit**

```powershell
git add src/app/(app)/onboarding/catalogo/page.tsx
git commit -m "ux(wizard): atualiza textos do header de serviços e produtos"
```

---

## Task 2: Loading skeleton para primeira navegação

**Files:**
- Create: `src/app/(app)/onboarding/catalogo/loading.tsx`

- [ ] **Step 1: Criar o arquivo loading.tsx**

```typescript
import { Skeleton } from '@/components/ui/skeleton'

export default function OnboardingCatalogoLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
      {/* Stepper placeholder */}
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="flex items-center gap-2 flex-1 last:flex-none">
            <Skeleton className="size-8 rounded-full shrink-0" />
            {n < 4 && <Skeleton className="h-0.5 flex-1" />}
          </div>
        ))}
      </div>

      {/* Título e descrição */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      {/* Grid de cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <div className="flex items-center justify-between pt-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```powershell
npx tsc --noEmit
```

Expected: zero erros

- [ ] **Step 3: Commit**

```powershell
git add src/app/(app)/onboarding/catalogo/loading.tsx
git commit -m "fix(wizard): adiciona loading skeleton para eliminar tela branca no primeiro carregamento"
```

---

## Task 3: Corrigir redirect loop — separar onboardingCompleted do cache

**Contexto:** `(app)/layout.tsx` usa `unstable_cache` (TTL 1h) para o tenant. Após `completeOnboarding`, o cache demora a propagar no Vercel, fazendo o layout redirecionar de volta para `/onboarding/catalogo` em loop. Fix: ler `onboardingCompleted` sempre fresco, sem cache.

**Files:**
- Modify: `src/domains/iam/iam.repository.ts`
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Adicionar `findTenantOnboardingStatus` ao IamRepository**

Em `src/domains/iam/iam.repository.ts`, dentro da classe `IamRepository`, após o método `findTenant` (linha ~295):

```typescript
  async findTenantOnboardingStatus(tenantId: string): Promise<{ onboardingCompleted: boolean } | null> {
    return prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { onboardingCompleted: true },
    })
  }
```

- [ ] **Step 2: Atualizar o layout — adicionar função uncached e uso em paralelo**

Em `src/app/(app)/layout.tsx`, adicionar a função após `getTenantCached` (antes de `export default`):

```typescript
async function getTenantOnboardingStatus(tenantId: string): Promise<boolean> {
  try {
    const result = await iamRepository.findTenantOnboardingStatus(tenantId)
    return result?.onboardingCompleted ?? false
  } catch {
    return false
  }
}
```

Ainda em `src/app/(app)/layout.tsx`, dentro de `AppLayout`, substituir o bloco do `if (tenantId)` (linhas 58–90 aprox.) por:

```typescript
  if (tenantId) {
    const [config, tenant, onboardingCompleted] = await Promise.all([
      getBrandingCached(tenantId),
      getTenantCached(tenantId),
      getTenantOnboardingStatus(tenantId),
    ])

    logoUrl = config?.logoUrl ?? null
    businessName = tenant?.name ?? ''

    if (!onboardingCompleted && pathname !== '/onboarding/catalogo') {
      return <ClientRedirect to="/onboarding/catalogo" />
    }
    if (onboardingCompleted && pathname === '/onboarding/catalogo') {
      return <ClientRedirect to="/agenda" />
    }

    if (config) {
      const { styleTag } = buildCssVariables({
        primaryColor: config.primaryColor,
        accentColor: config.accentColor,
        backgroundColor: config.backgroundColor,
        borderColor: config.borderColor ?? '#e8ddd3',
        foregroundColor: config.foregroundColor ?? '#3d2b1f',
        mutedColor: config.mutedColor ?? '#8a7060',
        fontFamily: config.fontFamily as 'inter' | 'manrope' | 'geist' | 'dm-sans' | 'plus-jakarta-sans' | 'lato',
        borderRadius: config.borderRadius as 'none' | 'medium' | 'full',
        colorScheme: config.colorScheme as 'light' | 'dark',
        logoUrl: config.logoUrl,
      })
      brandingCss = styleTag
    }
  }
```

- [ ] **Step 3: Verificar TypeScript**

```powershell
npx tsc --noEmit
```

Expected: zero erros

- [ ] **Step 4: Commit**

```powershell
git add src/domains/iam/iam.repository.ts src/app/(app)/layout.tsx
git commit -m "fix(wizard): separa onboardingCompleted do cache do tenant para eliminar redirect loop"
```

---

## Task 4: Repositories — método deleteByCatalogId

**Files:**
- Modify: `src/domains/scheduling/service.repository.ts`
- Modify: `src/domains/inventory/product.repository.ts`

- [ ] **Step 1: Adicionar `deleteByCatalogId` ao CatalogServiceRepository**

Em `src/domains/scheduling/service.repository.ts`, dentro da classe `CatalogServiceRepository`, após o método `findByCatalogId` (linha ~24):

```typescript
  async deleteByCatalogId(tenantId: string, catalogServiceId: string): Promise<void> {
    await prisma.service.deleteMany({
      where: { tenantId, catalogServiceId },
    })
  }
```

- [ ] **Step 2: Adicionar `deleteByCatalogId` ao ProductRepository**

Em `src/domains/inventory/product.repository.ts`, dentro da classe `ProductRepository`, após o método `findByCatalogId` (linha ~15):

```typescript
  async deleteByCatalogId(tenantId: string, catalogProductId: string): Promise<void> {
    await prisma.product.deleteMany({
      where: { tenantId, catalogProductId },
    })
  }
```

- [ ] **Step 3: Verificar TypeScript**

```powershell
npx tsc --noEmit
```

Expected: zero erros

- [ ] **Step 4: Commit**

```powershell
git add src/domains/scheduling/service.repository.ts src/domains/inventory/product.repository.ts
git commit -m "feat(catalog): adiciona deleteByCatalogId nos repositories de serviço e produto"
```

---

## Task 5: Service — deactivateService + deactivateProduct + testes

**Files:**
- Modify: `src/domains/catalog/catalog.service.ts`
- Modify: `src/domains/catalog/__tests__/catalog.service.test.ts`

- [ ] **Step 1: Atualizar mocks no arquivo de teste**

Em `src/domains/catalog/__tests__/catalog.service.test.ts`, atualizar os dois `vi.mock` para incluir `deleteByCatalogId`:

```typescript
vi.mock('@/domains/scheduling/service.repository', () => ({
  catalogServiceRepository: {
    findByCatalogId: vi.fn(),
    create: vi.fn(),
    deleteByCatalogId: vi.fn(),
  },
}))

vi.mock('@/domains/inventory/product.repository', () => ({
  productRepository: {
    findByCatalogId: vi.fn(),
    createFromCatalog: vi.fn(),
    deleteByCatalogId: vi.fn(),
  },
}))
```

- [ ] **Step 2: Escrever testes para deactivateService e deactivateProduct**

No mesmo arquivo, após o `describe('completeOnboarding', ...)`, adicionar:

```typescript
describe('deactivateService', () => {
  it('deleta o serviço do tenant pelo catalogServiceId', async () => {
    vi.mocked(catalogServiceRepository.deleteByCatalogId).mockResolvedValue(undefined as any)

    await service.deactivateService('t1', 'catalog-svc-1')

    expect(catalogServiceRepository.deleteByCatalogId).toHaveBeenCalledWith('t1', 'catalog-svc-1')
  })
})

describe('deactivateProduct', () => {
  it('deleta o produto do tenant pelo catalogProductId', async () => {
    vi.mocked(productRepository.deleteByCatalogId).mockResolvedValue(undefined as any)

    await service.deactivateProduct('t1', 'catalog-prod-1')

    expect(productRepository.deleteByCatalogId).toHaveBeenCalledWith('t1', 'catalog-prod-1')
  })
})
```

- [ ] **Step 3: Rodar os testes — confirmar que falham**

```powershell
npx vitest run src/domains/catalog/__tests__/catalog.service.test.ts
```

Expected: FAIL — `service.deactivateService is not a function`

- [ ] **Step 4: Implementar deactivateService e deactivateProduct no service**

Em `src/domains/catalog/catalog.service.ts`, dentro da classe `CatalogDomainService`, após `activateProduct`:

```typescript
  async deactivateService(tenantId: string, catalogServiceId: string): Promise<void> {
    await catalogServiceRepository.deleteByCatalogId(tenantId, catalogServiceId)
  }

  async deactivateProduct(tenantId: string, catalogProductId: string): Promise<void> {
    await productRepository.deleteByCatalogId(tenantId, catalogProductId)
  }
```

- [ ] **Step 5: Rodar os testes — confirmar que passam**

```powershell
npx vitest run src/domains/catalog/__tests__/catalog.service.test.ts
```

Expected: PASS — todos os testes verdes

- [ ] **Step 6: Rodar a suíte completa**

```powershell
npx vitest run
```

Expected: PASS — zero falhas

- [ ] **Step 7: Commit**

```powershell
git add src/domains/catalog/catalog.service.ts src/domains/catalog/__tests__/catalog.service.test.ts
git commit -m "feat(catalog): adiciona deactivateService e deactivateProduct ao CatalogDomainService"
```

---

## Task 6: API Routes — handlers DELETE para desativação

**Files:**
- Modify: `src/app/api/catalog/services/[id]/activate/route.ts`
- Modify: `src/app/api/catalog/products/[id]/activate/route.ts`

- [ ] **Step 1: Adicionar DELETE ao route de serviços**

Em `src/app/api/catalog/services/[id]/activate/route.ts`, adicionar após o `export async function POST`:

```typescript
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    const { id } = await params
    await catalogDomainService.deactivateService(session.tenantId, id)
    return new Response(null, { status: 204 })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 2: Adicionar DELETE ao route de produtos**

Em `src/app/api/catalog/products/[id]/activate/route.ts`, adicionar após o `export async function POST`:

```typescript
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    const { id } = await params
    await catalogDomainService.deactivateProduct(session.tenantId, id)
    return new Response(null, { status: 204 })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 3: Verificar TypeScript**

```powershell
npx tsc --noEmit
```

Expected: zero erros

- [ ] **Step 4: Commit**

```powershell
git add src/app/api/catalog/services/[id]/activate/route.ts src/app/api/catalog/products/[id]/activate/route.ts
git commit -m "feat(catalog): adiciona endpoint DELETE para desativar serviço e produto do catálogo"
```

---

## Task 7: CatalogServiceCard e CatalogProductCard — botão de desativar

**Files:**
- Modify: `src/components/domain/catalog/CatalogServiceCard.tsx`
- Modify: `src/components/domain/catalog/CatalogProductCard.tsx`

- [ ] **Step 1: Atualizar CatalogServiceCard**

Substituir o conteúdo completo de `src/components/domain/catalog/CatalogServiceCard.tsx` por:

```typescript
import type { Prisma } from '@prisma/client'
import { Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatPrice, formatDuration } from './catalog-utils'

interface CatalogServiceCardProps {
  service: {
    id: string
    name: string
    description: string | null
    imageUrl: string | null
    suggestedDuration: number
    suggestedPrice: Prisma.Decimal | number
    priceType: 'FIXED' | 'STARTING_FROM'
    category: { name: string } | null
  }
  isActivated: boolean
  onActivate: (serviceId: string) => void
  isActivating?: boolean
  onDeactivate: (serviceId: string) => void
  isDeactivating?: boolean
}

export function CatalogServiceCard({
  service,
  isActivated,
  onActivate,
  isActivating = false,
  onDeactivate,
  isDeactivating = false,
}: CatalogServiceCardProps) {
  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        {service.category && (
          <Badge variant="outline" className="w-fit text-xs">
            {service.category.name}
          </Badge>
        )}

        <div className="flex-1 space-y-1">
          <p className="font-semibold leading-snug">{service.name}</p>
          {service.description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {service.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="size-4 shrink-0" />
          <span>{formatDuration(service.suggestedDuration)}</span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">
            {service.priceType === 'STARTING_FROM'
              ? `A partir de ${formatPrice(service.suggestedPrice)}`
              : formatPrice(service.suggestedPrice)}
          </p>

          {isActivated ? (
            <Button
              size="sm"
              variant="outline"
              className="border-green-500 text-green-700 hover:bg-red-50 hover:border-red-400 hover:text-red-600"
              disabled={isDeactivating}
              onClick={() => onDeactivate(service.id)}
            >
              {isDeactivating ? 'Removendo...' : '✓ Ativado'}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={isActivating}
              onClick={() => onActivate(service.id)}
            >
              {isActivating ? 'Ativando...' : 'Ativar'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
```

Notas de remoção: `ActivationBadge` e `activatedHref` foram removidos — o botão de toggle substitui os dois.

- [ ] **Step 2: Atualizar CatalogProductCard**

Substituir o conteúdo completo de `src/components/domain/catalog/CatalogProductCard.tsx` por:

```typescript
import type { Prisma } from '@prisma/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatPrice } from './catalog-utils'

interface CatalogProductCardProps {
  product: {
    id: string
    name: string
    description: string | null
    imageUrl: string | null
    suggestedPrice: Prisma.Decimal | number
    category: { name: string } | null
  }
  isActivated: boolean
  onActivate: (productId: string) => void
  isActivating?: boolean
  onDeactivate: (productId: string) => void
  isDeactivating?: boolean
}

export function CatalogProductCard({
  product,
  isActivated,
  onActivate,
  isActivating = false,
  onDeactivate,
  isDeactivating = false,
}: CatalogProductCardProps) {
  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        {product.category && (
          <Badge variant="outline" className="w-fit text-xs">
            {product.category.name}
          </Badge>
        )}

        <div className="flex-1 space-y-1">
          <p className="font-semibold leading-snug">{product.name}</p>
          {product.description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {product.description}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{formatPrice(product.suggestedPrice)}</p>

          {isActivated ? (
            <Button
              size="sm"
              variant="outline"
              className="border-green-500 text-green-700 hover:bg-red-50 hover:border-red-400 hover:text-red-600"
              disabled={isDeactivating}
              onClick={() => onDeactivate(product.id)}
            >
              {isDeactivating ? 'Removendo...' : '✓ Ativado'}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={isActivating}
              onClick={() => onActivate(product.id)}
            >
              {isActivating ? 'Ativando...' : 'Ativar'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Verificar TypeScript**

```powershell
npx tsc --noEmit
```

Expected: erros de tipo nos usages de `CatalogServiceCard` e `CatalogProductCard` dentro de `CatalogGrid` — isso é esperado, será corrigido na Task 8.

- [ ] **Step 4: Commit parcial dos cards**

```powershell
git add src/components/domain/catalog/CatalogServiceCard.tsx src/components/domain/catalog/CatalogProductCard.tsx
git commit -m "feat(catalog): substitui ActivationBadge por botão de toggle ativar/desativar nos cards"
```

---

## Task 8: CatalogGrid — deactivate mutation

**Files:**
- Modify: `src/components/domain/catalog/CatalogGrid.tsx`

- [ ] **Step 1: Adicionar estado deactivatingIds e deactivateMutation**

Em `src/components/domain/catalog/CatalogGrid.tsx`:

1. Após a declaração de `activatingIds` (linha ~124), adicionar:
```typescript
  const [deactivatingIds, setDeactivatingIds] = useState<Set<string>>(new Set())
```

2. Após o `activateMutation` (linha ~210), adicionar:
```typescript
  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/catalog/${type}/${id}/activate`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Erro ao desativar item do catálogo')
    },
    onMutate: (id) => {
      setDeactivatingIds(prev => new Set(prev).add(id))
    },
    onSuccess: (_data, id) => {
      setLocalActivatedIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      toast.success(type === 'services' ? 'Serviço desativado.' : 'Produto desativado.')
    },
    onError: () => {
      toast.error('Erro ao desativar item. Tente novamente.')
    },
    onSettled: (_data, _error, id) => {
      setDeactivatingIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      queryClient.invalidateQueries({
        queryKey: [type === 'services' ? 'services' : 'products'],
      })
    },
  })
```

- [ ] **Step 2: Atualizar os renders dos cards para passar as novas props**

No bloco de render de serviços (dentro do `type === 'services'`), substituir o `<CatalogServiceCard>` por:

```tsx
<CatalogServiceCard
  key={service.id}
  service={service}
  isActivated={(activatedCatalogIds?.has(service.id) ?? false) || localActivatedIds.has(service.id)}
  onActivate={id => activateMutation.mutate(id)}
  isActivating={activatingIds.has(service.id)}
  onDeactivate={id => deactivateMutation.mutate(id)}
  isDeactivating={deactivatingIds.has(service.id)}
/>
```

No bloco de render de produtos, substituir o `<CatalogProductCard>` por:

```tsx
<CatalogProductCard
  key={product.id}
  product={product}
  isActivated={(activatedCatalogIds?.has(product.id) ?? false) || localActivatedIds.has(product.id)}
  onActivate={id => activateMutation.mutate(id)}
  isActivating={activatingIds.has(product.id)}
  onDeactivate={id => deactivateMutation.mutate(id)}
  isDeactivating={deactivatingIds.has(product.id)}
/>
```

Também remover as props `activatedHref` e `buildEditHref` do render de ambos os cards (a função `buildEditHref` pode ser mantida no arquivo se for usada em outro contexto, mas removida dos cards). Se `buildEditHref` só era usado nos cards, remover a função inteira e a prop `activatedIdMap` dos tipos de `CatalogGridProps`.

- [ ] **Step 3: Verificar TypeScript**

```powershell
npx tsc --noEmit
```

Expected: zero erros

- [ ] **Step 4: Rodar os testes**

```powershell
npx vitest run
```

Expected: PASS — zero falhas

- [ ] **Step 5: Commit**

```powershell
git add src/components/domain/catalog/CatalogGrid.tsx
git commit -m "feat(catalog): adiciona deactivate mutation ao CatalogGrid com estado otimista"
```

---

## Task 9: CatalogGrid — tabs por segmento

**Files:**
- Modify: `src/components/domain/catalog/CatalogGrid.tsx`

- [ ] **Step 1: Adicionar import de Tabs do Shadcn**

No topo de `src/components/domain/catalog/CatalogGrid.tsx`, adicionar ao bloco de imports UI:

```typescript
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
```

- [ ] **Step 2: Adicionar o mapa de labels de segmento**

Logo após os imports (antes de `interface CatalogServiceItem`), adicionar:

```typescript
const SEGMENT_LABELS: Record<string, string> = {
  HAIR_SALON: 'Salão de Beleza',
  BARBERSHOP: 'Barbearia',
  NAIL_DESIGN: 'Nail Design',
  AESTHETICS: 'Estética',
}
```

- [ ] **Step 3: Adicionar estado activeSegment e lógica de querySegments**

Dentro do componente `CatalogGrid`, após a declaração de `[searchInput, setSearchInput]`, adicionar:

```typescript
  const [activeSegment, setActiveSegment] = useState<string | undefined>(segments?.[0])

  useEffect(() => {
    setActiveSegment(segments?.[0])
  }, [segments?.join(',')])

  const querySegments = searchInput.length > 0
    ? segments
    : (activeSegment ? [activeSegment] : segments)
```

- [ ] **Step 4: Substituir `segments` por `querySegments` nas queries**

Na `servicesQuery` (queryKey e queryFn), substituir:
```typescript
queryKey: ['catalog', 'services', { segments, search, page }],
// e dentro do queryFn:
segments?.forEach(s => params.append('segments', s))
```
por:
```typescript
queryKey: ['catalog', 'services', { segments: querySegments, search, page }],
// e dentro do queryFn:
querySegments?.forEach(s => params.append('segments', s))
```

Fazer o mesmo para `productsQuery`:
```typescript
queryKey: ['catalog', 'products', { segments: querySegments, search, page }],
// e dentro do queryFn:
querySegments?.forEach(s => params.append('segments', s))
```

- [ ] **Step 5: Renderizar as tabs acima do input de busca**

No bloco `return` do componente, substituir a seção atual da busca (`{/* Busca */}`) por:

```tsx
      {/* Tabs de segmento — visíveis quando 2+ segmentos selecionados */}
      {segments && segments.length >= 2 && (
        <Tabs
          value={activeSegment}
          onValueChange={setActiveSegment}
          className="w-full"
        >
          <TabsList>
            {segments.map(seg => (
              <TabsTrigger key={seg} value={seg}>
                {SEGMENT_LABELS[seg] ?? seg}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {/* Busca */}
      <Input
        aria-label="Buscar no catálogo"
        placeholder="Buscar..."
        value={searchInput}
        onChange={e => setSearchInput(e.target.value)}
        className="max-w-sm"
      />
```

- [ ] **Step 6: Verificar TypeScript**

```powershell
npx tsc --noEmit
```

Expected: zero erros

- [ ] **Step 7: Rodar os testes**

```powershell
npx vitest run
```

Expected: PASS — zero falhas

- [ ] **Step 8: Commit**

```powershell
git add src/components/domain/catalog/CatalogGrid.tsx
git commit -m "feat(catalog): adiciona tabs por segmento ao CatalogGrid com busca unificada"
```

---

## Verificação final

- [ ] **Rodar suite completa de testes**

```powershell
npx vitest run
```

Expected: PASS — zero falhas

- [ ] **Verificar TypeScript**

```powershell
npx tsc --noEmit
```

Expected: zero erros

- [ ] **Abrir PR para main**

```powershell
git push origin HEAD
gh pr create --title "fix+feat(wizard): tela branca, redirect loop, tabs por segmento e desativar serviços" --body "$(cat <<'EOF'
## O que muda

### Bug fixes
- `loading.tsx` elimina tela branca no primeiro carregamento de `/onboarding/catalogo`
- `onboardingCompleted` lido sem cache no layout — elimina redirect loop após concluir onboarding

### Features
- Tabs por segmento no wizard quando 2+ segmentos selecionados; busca unifica todos os segmentos
- Botão de desativar serviço/produto ativado (delete direto, sem confirmação)

### UX
- Textos do header atualizados nos steps 2 e 3 do wizard

## Como testar
- [ ] Navegar para `/onboarding/catalogo` pela primeira vez — deve mostrar skeleton, não tela branca
- [ ] Completar o wizard → clicar "Ir para a Agenda" → deve ir para `/agenda` sem loop
- [ ] Selecionar 2 segmentos no step 1 → step 2 deve mostrar tabs
- [ ] Buscar no step 2 com tab ativa → resultados de todos os segmentos
- [ ] Ativar um serviço → botão muda para "✓ Ativado" verde
- [ ] Clicar em "✓ Ativado" → serviço volta para "Ativar"
EOF
)"
```

---

## Self-review checklist

- [x] **Spec coverage:** todos os 5 pontos do spec têm tasks correspondentes (loading, redirect, tabs, deactivate, textos)
- [x] **Sem placeholders:** todos os steps têm código completo
- [x] **Consistência de tipos:** `onDeactivate`/`isDeactivating` definidos em Task 7 e usados em Task 8 com os mesmos nomes; `deactivatingIds` declarado em Task 8 Step 1 e usado no mesmo step
- [x] **`activatedHref` / `buildEditHref`:** Task 8 instrui remoção das props dos cards e possível remoção da função helper — coberto
- [x] **`querySegments` vs `segments`:** substituição nas duas queries (services + products) coberta em Task 9 Step 4
- [x] **Mocks de teste atualizados:** Task 5 Step 1 atualiza os mocks antes de escrever os testes
