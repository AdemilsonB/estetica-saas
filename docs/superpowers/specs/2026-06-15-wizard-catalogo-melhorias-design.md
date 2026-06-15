# Spec — Wizard de Catálogo: Melhorias e Bug Fixes

**Data:** 2026-06-15
**Rota afetada:** `/onboarding/catalogo`
**Status:** Aprovado

---

## Escopo

Cinco mudanças independentes na tela de onboarding de catálogo:

1. Bug: tela branca no primeiro carregamento
2. Bug: redirect loop — todos os usuários vão para `/onboarding/catalogo` mesmo após onboarding concluído
3. Feature: tabs de segmento quando múltiplos segmentos selecionados
4. Feature: desativar serviço/produto ativado (delete direto, sem confirmação)
5. UX: melhoria nos textos do header do wizard

---

## Bug 1 — Tela branca no primeiro carregamento

### Causa

`(app)/layout.tsx` é um Server Component async com duas chamadas de rede (Supabase auth + banco). Durante soft navigation vinda do fluxo auth, o App Router espera o layout resolver antes de renderizar qualquer coisa. Sem um Suspense fallback declarado, o navegador exibe tela em branco.

### Fix

Criar `src/app/(app)/onboarding/catalogo/loading.tsx`.

Conteúdo: skeleton do wizard com stepper simplificado (4 círculos placeholder) + grid 3×2 de cards skeleton (usando `<Skeleton>` do Shadcn). Next.js usa esse arquivo automaticamente como fallback de Suspense para a rota.

Nenhuma alteração em outros arquivos.

---

## Bug 2 — Redirect loop após onboarding completo

### Causa

`(app)/layout.tsx` usa `unstable_cache` com TTL de 1h para o tenant inteiro, incluindo `onboardingCompleted`. O fluxo:

1. Usuário conclui o wizard → `POST /api/onboarding/complete` → banco atualiza `onboardingCompleted = true` + `revalidateTag` disparado
2. `router.push('/agenda')` executa imediatamente no cliente
3. Layout em `/agenda` ainda serve o tenant cacheado (`onboardingCompleted = false`) antes da invalidação se propagar no cache distribuído do Vercel
4. Layout vê `!onboardingCompleted && pathname !== '/onboarding/catalogo'` → redireciona de volta
5. Loop

### Fix

Separar `onboardingCompleted` do cache de branding no layout.

**Antes:**
```typescript
async function getTenantCached(tenantId: string) {
  const cached = unstable_cache(
    () => iamRepository.findTenant(tenantId),
    [`tenant-${tenantId}`],
    { tags: [`tenant-${tenantId}`], revalidate: 3600 },
  )
  return cached()
}
```

**Depois:**

Manter `getTenantCached` apenas para branding (nome do negócio, CSS vars, logo — dados que raramente mudam).

Adicionar `getTenantOnboardingStatus(tenantId: string)` — **sem cache** — que executa uma query mínima:

```typescript
async function getTenantOnboardingStatus(tenantId: string): Promise<boolean> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { onboardingCompleted: true },
  })
  return tenant?.onboardingCompleted ?? false
}
```

No layout, substituir `tenant?.onboardingCompleted` por `onboardingCompleted` vindo dessa função.

**Impacto de performance:** 1 query extra simples por page load dentro de `(app)`. Aceitável — é uma query de 1 coluna por PK.

O `revalidateTag` no endpoint `/api/onboarding/complete` pode ser mantido ou removido (torna-se redundante para esse dado, mas pode ajudar em outros leitores futuros do cache). Manter por segurança.

---

## Feature 1 — Tabs por segmento no CatalogGrid

### Comportamento

| Condição | Comportamento |
|----------|---------------|
| `segments.length <= 1` | Sem tabs — comportamento atual mantido |
| `segments.length >= 2` | Tabs acima do grid, uma por segmento |
| Tab ativa + sem busca | Query passa `?segments=SEGMENTO_ATIVO` apenas |
| Qualquer texto na busca | Ignora tab ativa, query passa todos os segmentos |
| Busca limpa | Volta ao filtro da tab ativa |

### Implementação

Dentro de `CatalogGrid`:

- Estado: `const [activeSegment, setActiveSegment] = useState(segments?.[0])`
- `activeSegment` é resetado para `segments[0]` via `useEffect` quando `segments` muda
- A query usa:
  ```typescript
  const querySegments = searchInput.length > 0 ? segments : (activeSegment ? [activeSegment] : segments)
  ```
- Renderizar `<Tabs>` do Shadcn (`value={activeSegment}`, `onValueChange={setActiveSegment}`) acima do `<Input>` de busca, condicionado a `segments && segments.length >= 2`
- Labels das tabs: usar o mapa de `SEGMENT_LABELS` local (`HAIR_SALON → 'Salão de Beleza'`, etc.)

### Mapa de labels

```typescript
const SEGMENT_LABELS: Record<string, string> = {
  HAIR_SALON: 'Salão de Beleza',
  BARBERSHOP: 'Barbearia',
  NAIL_DESIGN: 'Nail Design',
  AESTHETICS: 'Estética',
}
```

---

## Feature 2 — Desativar serviço/produto ativado

### Backend

**Novo endpoint de serviços:** `DELETE /api/catalog/services/[id]/activate/route.ts`

```typescript
export async function DELETE(request, { params }) {
  const session = await getSessionContext(request)
  const { id } = await params
  await catalogDomainService.deactivateService(session.tenantId, id)
  return new Response(null, { status: 204 })
}
```

**Novo método no service:**

```typescript
async deactivateService(tenantId: string, catalogServiceId: string) {
  await catalogServiceRepository.deleteByCatalogId(tenantId, catalogServiceId)
}
```

**Novo método no repository de serviços do tenant:**

```typescript
async deleteByCatalogId(tenantId: string, catalogServiceId: string) {
  await prisma.service.deleteMany({
    where: { tenantId, catalogServiceId },
  })
}
```

Mesmo padrão para produtos: `DELETE /api/catalog/products/[id]/activate` → `deactivateProduct` → `productRepository.deleteByCatalogId`.

### Frontend — CatalogServiceCard

Quando `isActivated = true`, substituir `<ActivationBadge>` por:

```tsx
<Button
  size="sm"
  variant="outline"
  className="border-green-500 text-green-700 hover:bg-red-50 hover:border-red-400 hover:text-red-600"
  disabled={isDeactivating}
  onClick={() => onDeactivate(service.id)}
>
  {isDeactivating ? 'Removendo...' : '✓ Ativado'}
</Button>
```

Sem modal de confirmação.

### Frontend — CatalogGrid

Adicionar `deactivateMutation` paralelo ao `activateMutation`:

- `mutationFn`: `DELETE /api/catalog/{type}/{id}/activate`
- `onMutate`: adiciona id a `deactivatingIds` (Set local)
- `onSuccess`: remove id de `localActivatedIds`
- `onError`: toast de erro
- `onSettled`: remove de `deactivatingIds`

Props adicionadas ao card: `onDeactivate` e `isDeactivating`.

Mesmo padrão para `CatalogProductCard`.

---

## UX — Textos do header

Em `src/app/(app)/onboarding/catalogo/page.tsx`, objeto `STEP_CONTENT`:

| Step | Campo | Antes | Depois |
|------|-------|-------|--------|
| 2 | `title` | `'Ative seus serviços'` | `'Ative seus serviços iniciais'` |
| 2 | `description` | `'Selecione os serviços que você oferece. Você pode personalizar depois.'` | `'Selecione os serviços que você oferece. Você pode personalizar depois e criar novos exclusivos.'` |
| 3 | `title` | `'Ative seus produtos'` | `'Ative seus produtos iniciais'` |
| 3 | `description` | `'Controle seu estoque de insumos. Você pode adicionar mais depois.'` | `'Controle seu estoque de insumos e produtos de revenda. Você pode personalizar depois e adicionar mais.'` |

---

## Fora de escopo

**Admin de catálogo mestre (`/admin/catalogo`):** CRUD de `CatalogService` e `CatalogProduct` via painel admin. Feature separada — requer brainstorming próprio.

---

## Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/app/(app)/onboarding/catalogo/loading.tsx` | **Criar** — skeleton do wizard |
| `src/app/(app)/layout.tsx` | Separar `onboardingCompleted` do cache |
| `src/components/domain/catalog/CatalogGrid.tsx` | Tabs por segmento + deactivate mutation |
| `src/components/domain/catalog/CatalogServiceCard.tsx` | Botão de desativar |
| `src/components/domain/catalog/CatalogProductCard.tsx` | Botão de desativar |
| `src/app/api/catalog/services/[id]/activate/route.ts` | Adicionar handler `DELETE` |
| `src/app/api/catalog/products/[id]/activate/route.ts` | Adicionar handler `DELETE` |
| `src/domains/catalog/catalog.service.ts` | Métodos `deactivateService` e `deactivateProduct` |
| `src/domains/scheduling/service.repository.ts` | Método `deleteByCatalogId` |
| `src/domains/inventory/product.repository.ts` | Método `deleteByCatalogId` |
| `src/app/(app)/onboarding/catalogo/page.tsx` | Atualizar textos `STEP_CONTENT` |
