# Spec: Catálogo Mestre Multi-Segmento

**Data:** 2026-06-15
**Status:** Aprovado
**Domínio:** catalog (novo) + alterações em scheduling, inventory, iam

---

## Visão geral

Catálogo mestre imutável por segmento de negócio (Salão de Beleza, Barbearia, Nail Design, Estética). Tenants selecionam seus segmentos no onboarding, ativam itens do catálogo criando cópias isoladas (instâncias próprias), e podem editar essas cópias sem afetar o mestre. O catálogo mestre nunca muda por ação de tenant.

---

## Decisões de design

| Decisão | Escolha | Motivo |
|---|---|---|
| Origem dos dados | Seed estático no PostgreSQL | Performance máxima via SQL + índices; admin panel futuro usa as mesmas tabelas |
| Estrutura de campos | Híbrida (colunas fixas + `metadata Json?`) | Campos core indexáveis; campos extensíveis sem migration |
| Wizard | Onboarding único; reacessível em Configurações | Primeiro acesso guiado; sem bloqueio para uso posterior |
| Variações de serviço | Item único com variações em `metadata.variations` | Evita duplicação de itens, variação é contexto do item |
| Seed inicial | ~5 itens por segmento por tipo (~20 serviços + ~20 produtos) | Valida fluxo completo; conteúdo completo é etapa separada |
| Relação catálogo → tenant | Referência soft (`catalogServiceId String?`) sem `@relation` Prisma | Mantém domínio `catalog` desacoplado de `scheduling`/`inventory` |

---

## Banco de dados

### Novo enum

```prisma
enum BusinessSegment {
  HAIR_SALON    // Salão de Beleza (cabelo)
  BARBERSHOP    // Barbearia
  NAIL_DESIGN   // Nail Design
  AESTHETICS    // Estética
}
```

### Novos modelos

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
  id                String                   @id @default(cuid())
  slug              String                   @unique
  name              String
  description       String?
  imageUrl          String?
  segments          BusinessSegment[]
  categoryId        String?
  category          CatalogServiceCategory?  @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  suggestedDuration Int                      // minutos
  suggestedPrice    Decimal                  @db.Decimal(10, 2)
  priceType         PriceType                @default(FIXED)
  active            Boolean                  @default(true)
  order             Int                      @default(0)
  metadata          Json?
  // metadata shape (não enforçado pelo banco):
  // {
  //   tags: string[]
  //   difficulty: 'basico' | 'intermediario' | 'avancado'
  //   variations: Array<{ label: string; suggestedDuration: number; suggestedPrice: number }>
  //   aiTips: string
  // }
  createdAt         DateTime                 @default(now())
  updatedAt         DateTime                 @updatedAt

  @@index([active])
}

model CatalogProduct {
  id             String                  @id @default(cuid())
  slug           String                  @unique
  name           String
  description    String?
  imageUrl       String?
  segments       BusinessSegment[]
  categoryId     String?
  category       CatalogProductCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  suggestedPrice Decimal                 @db.Decimal(10, 2)
  active         Boolean                 @default(true)
  order          Int                     @default(0)
  metadata       Json?
  // metadata shape:
  // {
  //   tags: string[]
  //   brand: string
  //   yield: string        // ex: "50ml por aplicação"
  //   composition: string
  // }
  createdAt      DateTime                @default(now())
  updatedAt      DateTime                @updatedAt

  @@index([active])
}
```

### Alterações em modelos existentes

```prisma
// Tenant
segments            BusinessSegment[]  @default([])
onboardingCompleted Boolean            @default(false)

// Service (scheduling)
catalogServiceId    String?   // null = item customizado pelo tenant

// Product (inventory)
catalogProductId    String?   // null = item customizado pelo tenant
```

### Nota sobre `segments` em arrays PostgreSQL

`BusinessSegment[]` em Prisma com PostgreSQL usa o tipo array nativo. Filtro por segmento usa `hasSome` no Prisma Client (`{ segments: { hasSome: ['HAIR_SALON'] } }`). Não requer extension.

---

## Domínio `catalog`

### Estrutura de arquivos

```
src/domains/catalog/
  types.ts
  catalog-service.repository.ts
  catalog-product.repository.ts
  catalog.service.ts
```

### `types.ts` — schemas Zod relevantes

```typescript
export const listCatalogServicesSchema = z.object({
  segments:   z.array(z.nativeEnum(BusinessSegment)).optional(),
  categoryId: z.string().cuid().optional(),
  name:       z.string().trim().optional(),
  page:       z.coerce.number().int().min(1).default(1),
  pageSize:   z.coerce.number().int().min(1).max(100).default(20),
})

export const activateCatalogItemSchema = z.object({
  catalogId: z.string().cuid(),
})
```

### `catalog-service.repository.ts`

```typescript
export class CatalogServiceRepository {
  async list(query: ListCatalogServicesQuery) {
    return prisma.catalogService.findMany({
      where: {
        active: true,
        ...(query.segments?.length && { segments: { hasSome: query.segments } }),
        ...(query.categoryId && { categoryId: query.categoryId }),
        ...(query.name && { name: { contains: query.name, mode: 'insensitive' } }),
      },
      include: { category: true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    })
  }

  async findById(id: string) {
    return prisma.catalogService.findUnique({ where: { id }, include: { category: true } })
  }
}
```

### `catalog.service.ts` — ativação idempotente

```typescript
export class CatalogService {
  async activateService(tenantId: string, catalogServiceId: string): Promise<Service> {
    const catalogItem = await this.catalogServiceRepo.findById(catalogServiceId)
    if (!catalogItem) throw new CatalogItemNotFoundError(catalogServiceId)

    const existing = await this.serviceRepo.findByCatalogId(tenantId, catalogServiceId)
    if (existing) return existing

    return this.serviceRepo.create(tenantId, {
      name:             catalogItem.name,
      description:      catalogItem.description,
      imageUrl:         catalogItem.imageUrl,
      duration:         catalogItem.suggestedDuration,
      price:            catalogItem.suggestedPrice,
      priceType:        catalogItem.priceType,
      catalogServiceId: catalogItem.id,
      active:           true,
    })
  }

  async activateProduct(tenantId: string, catalogProductId: string): Promise<Product> {
    // mesma lógica para produto
  }

  async saveSegments(tenantId: string, segments: BusinessSegment[]): Promise<void> {
    await prisma.tenant.update({ where: { id: tenantId }, data: { segments } })
  }

  async completeOnboarding(tenantId: string): Promise<void> {
    await prisma.tenant.update({ where: { id: tenantId }, data: { onboardingCompleted: true } })
  }
}
```

---

## API Routes

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `GET` | `/api/catalog/services` | tenant autenticado | Lista serviços do catálogo; filtra por `segments`, `categoryId`, `name`, `page` |
| `GET` | `/api/catalog/products` | tenant autenticado | Lista produtos do catálogo; mesmos filtros |
| `POST` | `/api/catalog/services/:id/activate` | tenant autenticado | Ativa serviço; idempotente |
| `POST` | `/api/catalog/products/:id/activate` | tenant autenticado | Ativa produto; idempotente |
| `POST` | `/api/onboarding/segments` | tenant autenticado | Salva `segments[]` no Tenant |
| `POST` | `/api/onboarding/complete` | tenant autenticado | Marca `onboardingCompleted = true` |

### Erros tipados novos

```typescript
// src/shared/errors/
export class CatalogItemNotFoundError extends DomainError {
  code = 'CATALOG_ITEM_NOT_FOUND'
  statusCode = 404
}
```

---

## Frontend

### Rotas

```
/onboarding                   ← wizard (redireciona para /agenda se já completou)
/settings/catalog             ← browsing pós-onboarding
```

### Componentes

```
src/components/domain/catalog/
  SegmentSelector.tsx        ← cards multi-select com ícone + nome + exemplo
  CatalogServiceCard.tsx     ← imagem, nome, duração, preço, checkbox / badge "Ativo"
  CatalogProductCard.tsx     ← imagem, nome, preço, checkbox / badge "Ativo"
  CatalogGrid.tsx            ← grid com busca debounced, tabs por categoria
  WizardStepper.tsx          ← barra de progresso 4 steps
  ActivationBadge.tsx        ← badge "Já ativado" + link para o item do tenant
```

### Wizard — 4 steps

**Step 1 — Segmentos**
- 4 cards clicáveis, multi-select, mínimo 1 obrigatório
- `POST /api/onboarding/segments` ao avançar (persiste antes de ir ao step 2)

**Step 2 — Serviços sugeridos**
- `CatalogGrid` filtrado pelos segmentos do step 1
- Ativação otimista: clique no card ativa imediatamente (request em background)
- Botão "Ativar todos" por segmento/categoria
- Pode pular

**Step 3 — Produtos sugeridos**
- Mesmo padrão do step 2
- Mensagem contextual: "Controle seu estoque de insumos. Pode adicionar depois."
- Pode pular

**Step 4 — Confirmação**
- Resumo: X serviços + Y produtos ativados
- CTA: "Ir para a Agenda" → `/agenda`
- Link: "Configurar mais itens" → `/settings/catalog`
- `POST /api/onboarding/complete` ao clicar no CTA

### Configurações → Catálogo

- Duas abas: `[Serviços] [Produtos]`
- Filtros: segmento, categoria, busca, toggle "apenas não ativados"
- Item ativado: badge "Ativo" + botão "Ver meu serviço" (link para o item do tenant)
- Item não ativado: botão "Ativar"

### Estado

- **TanStack Query** para listagens de catálogo (`staleTime: Infinity` — catálogo mestre não muda em runtime)
- **useMutation** para ativação → invalida `['services']` / `['products']` ao concluir
- **Zustand local** para estado do wizard (step atual, segmentos selecionados em memória)

### Redirecionamento

```typescript
// No layout (app) ou middleware:
// onboardingCompleted === false → redirect('/onboarding')
// rota === /onboarding e onboardingCompleted === true → redirect('/agenda')
```

---

## Seed mínimo (`prisma/seed-catalog.ts`)

~5 serviços por segmento (20 total) + ~5 produtos por segmento (20 total):

| Segmento | Serviços (exemplos) | Produtos (exemplos) |
|---|---|---|
| HAIR_SALON | Corte Feminino, Escova, Coloração, Mechas, Hidratação | Shampoo Profissional, Condicionador, Máscara, Tinta, Progressiva |
| BARBERSHOP | Corte Masculino, Barba, Pigmentação, Sobrancelha, Nevou | Pomada, Óleo de Barba, Shampoo Masculino, Cera, Pós-Barba |
| NAIL_DESIGN | Manicure, Pedicure, Gel, Fibra de Vidro, Nail Art | Esmalte Base, Esmalte Cor, Top Coat, Gel UV, Removedor |
| AESTHETICS | Limpeza de Pele, Peeling, Massagem Relaxante, Design de Sobrancelha, Lifting de Cílios | Sabonete Facial, Ácido, Creme Hidratante, Henna Sobrancelha, Cola de Cílios |

Seed é executado com `npx prisma db seed` e é **idempotente** (usa `upsert` por `slug`).

---

## Fora do escopo desta entrega

- Admin panel para gerenciar o catálogo mestre (`/admin`)
- Conteúdo completo do catálogo (~110 serviços + ~160 produtos)
- Sincronização de atualizações do catálogo mestre para tenants que já ativaram
- Variações editáveis pelo tenant via UI (a lógica de variações existe no `metadata`, a UI de edição fica para depois)
- Analytics de uso do catálogo (quantos tenants ativaram cada item)
