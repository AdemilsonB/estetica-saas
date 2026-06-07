# Design: Categorias de Serviços + Melhorias no Cadastro e Agendamento

**Data:** 2026-06-07  
**Status:** Aprovado  
**Branch alvo:** `feat/service-categories`

---

## Contexto

O cadastro de serviços atual não possui categorias, descrição nem suporte completo ao tipo de preço "A partir de". O fluxo de agendamento (público e interno) exibe uma lista simples sem agrupamento visual. O objetivo é introduzir categorias opcionais, enriquecer o cadastro de serviços e reformular o step de seleção de serviço nos dois contextos de agendamento.

---

## Abordagem escolhida

**Abordagem A — Mínima invasiva:**  
Novo model `ServiceCategory`, campos adicionais em `Service` (`description`, `categoryId`), novo valor `STARTING_FROM` no enum `PriceType`. A duração continua como `Int` (minutos) no banco — a conversão HH:MM é exclusivamente de UI. Nenhuma migração de dados destrutiva.

---

## 1. Banco de Dados

### Novo model `ServiceCategory`

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

### Alterações em `Service`

- Adicionar `description String?` — texto livre, suporta quebras de linha, máx. 1000 chars
- Adicionar `categoryId String?` com relation para `ServiceCategory` (onDelete: SetNull)
- Adicionar `@@index([tenantId, categoryId])`
- `duration` permanece `Int` (minutos) — sem alteração
- `imageUrl String?` já existe — sem alteração
- `priceMin Decimal?` já existe — sem alteração
- `priceMax Decimal?` já existe, permanece opcional

### Alteração no enum `PriceType`

Adicionar valor `STARTING_FROM`:

```prisma
enum PriceType {
  FIXED           // preço único — exibe "R$ X,XX"
  STARTING_FROM   // preço base — exibe "A partir de R$ X,XX"
  RANGE           // faixa — exibe "R$ X – R$ Y" (legado, mantido)
  ON_CONSULTATION // sob consulta (legado, mantido)
}
```

**Regra de preenchimento por tipo:**
| PriceType      | Campo obrigatório | Campo opcional |
|----------------|-------------------|----------------|
| FIXED          | `price`           | —              |
| STARTING_FROM  | `price`           | `priceMax`     |
| RANGE          | `priceMin`        | `priceMax`     |
| ON_CONSULTATION| —                 | —              |

---

## 2. Backend

### Novas rotas — Categorias

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/scheduling/service-categories` | Lista categorias ativas do tenant |
| POST | `/api/scheduling/service-categories` | Cria nova categoria |
| PATCH | `/api/scheduling/service-categories/[id]` | Edita nome ou ordem |
| DELETE | `/api/scheduling/service-categories/[id]` | Remove (apenas se sem serviços vinculados) |

Todas as rotas usam `getSessionContext` + `ensurePermission(PERMISSIONS.services.manage)`.

### Alterações nas rotas de serviço

**`POST /api/scheduling/services`** — schema atualizado:
```typescript
const createServiceSchema = z.object({
  name: z.string().trim().min(2).max(100),
  duration: z.number().int().min(5).max(480),
  price: z.number().nonnegative(),
  priceType: z.enum(['FIXED', 'STARTING_FROM', 'RANGE', 'ON_CONSULTATION']).default('FIXED'),
  priceMin: z.number().positive().optional(),
  priceMax: z.number().positive().optional(),
  description: z.string().trim().max(1000).optional(),
  categoryId: z.string().cuid().optional(),
  active: z.boolean().default(true),
})
```

**`PATCH /api/scheduling/services/[id]`** — aceita todos os campos acima como opcionais.

**`GET /api/scheduling/services`** — retorna `categoryId`, `categoryName` (via include), `description`, `priceType`, `priceMin`, `priceMax`.

### Rota pública de agendamento

A resposta de `GET /api/public/[slug]` passa a incluir nos serviços:
- `description`
- `categoryId`
- `categoryName` (desnormalizado — join na query)
- `priceType`
- `priceMin`
- `priceMax`
- `imageUrl` (já retornado)

A lógica de agrupamento por categoria é feita no **frontend**, não no backend. A API retorna lista flat.

### Novo `ServiceCategoryRepository`

```typescript
export class ServiceCategoryRepository {
  async list(tenantId: string): Promise<ServiceCategory[]>
  async create(tenantId: string, input: CreateCategoryInput): Promise<ServiceCategory>
  async update(tenantId: string, id: string, input: UpdateCategoryInput): Promise<ServiceCategory>
  async delete(tenantId: string, id: string): Promise<void> // lança erro se tiver serviços
}
```

---

## 3. Frontend — Cadastro de Serviços

### Nova aba "Categorias" em `/servicos`

A página `ServicosPage` ganha uma 4ª aba **"Categorias"** com o componente `CategoryCatalog`:
- Lista de categorias com nome e ordem
- Botão "+ Nova categoria" abre `CategoryFormModal` (inline simples: campo de nome + salvar)
- Botão de reordenar (up/down) altera o campo `order`
- Botão de remover (apenas categorias sem serviços)

### Formulário `ServiceFormModal` — campos adicionais

Ordem dos campos no form:

1. **Nome do serviço** (existente)
2. **Categoria** — `<Select>` populado via `useServiceCategories()`, label "Sem categoria" como opção padrão, valor `null`
3. **Descrição** — `<Textarea>` com `rows={3}`, máx. 1000 chars, placeholder "Descreva o serviço, diferenciais, cuidados..."
4. **Imagem** — `ImageUploadField` (componente reutilizável): mostra preview se `imageUrl` existe, botão de upload chama `/api/uploads/service-images`, limpa imagem com botão ×
5. **Tipo de preço** — radio group: "Valor fixo" | "A partir de". Exibe apenas o campo de preço correspondente. `priceMax` aparece como campo opcional quando `STARTING_FROM` selecionado (label "Até (opcional)")
6. **Tempo médio** — input de texto com máscara HH:MM, placeholder `01:30`. Conversão: parse `"HH:MM"` → minutos ao salvar; `duration / 60 → "HH:MM"` ao carregar
7. **Kit de Produtos** (existente, sem alteração)

### Catálogo `ServiceCatalog` — atualizações

- Badge de categoria ao lado do nome do serviço
- Exibição de preço contextual: "A partir de R$ X" para `STARTING_FROM`
- Imagem thumbnail (já existe, sem alteração)

---

## 4. Frontend — Fluxo de Agendamento

### Componente compartilhado `ServicePickerWithCategories`

Novo componente usado tanto na página pública quanto na agenda interna:

```
Props:
  services: PublicService[]
  onSelect: (service: PublicService) => void
  primaryColor?: string
```

**Layout:**
```
[Alisamentos] [Coloração] [Tratamentos] [Outros]   ← scroll horizontal, chips
──────────────────────────────────────────────────
┌──────────┐  ┌──────────┐  ┌──────────┐           ← grid serviços
│  [foto]  │  │  [foto]  │  │  [foto]  │
│ Nome     │  │ Nome     │  │ Nome     │
│ A partir │  │ R$220    │  │ R$170    │
│ R$170    │  │ ~1h30    │  │ ~3h      │
│ ~3h      │  │          │  │          │
│ Desc...  │  │ Desc...  │  │ Desc...  │
└──────────┘  └──────────┘  └──────────┘
  2 colunas mobile / 3 colunas desktop
```

**Comportamento:**
- Primeira categoria com serviços pré-selecionada ao montar
- Clicar em chip troca o grid (estado local, sem fetch extra)
- Chip ativo: borda/fundo na `primaryColor` do tenant
- "Outros" aparece apenas se existirem serviços sem `categoryId`
- Card de serviço sem imagem: placeholder com inicial do nome em fundo neutro
- Tempo exibido como `"1h 30min"`, `"45min"`, `"3h"` (função utilitária `formatDuration`)
- Preço exibido como `"A partir de R$ 170,00"` ou `"R$ 220,00"` conforme `priceType`

### Tipos atualizados

```typescript
// src/app/(public)/agendar/[slug]/types.ts
export type PublicService = {
  id: string
  name: string
  duration: number
  price: number
  priceType: 'FIXED' | 'STARTING_FROM' | 'RANGE' | 'ON_CONSULTATION'
  priceMin?: number | null
  priceMax?: number | null
  imageUrl?: string | null
  description?: string | null   // novo
  categoryId?: string | null    // novo
  categoryName?: string | null  // novo
}
```

### Substituições

- `ServiceStep` (público) passa a renderizar `ServicePickerWithCategories`
- Modal de criação de agendamento interno substitui seu seletor atual pelo mesmo componente

---

## 5. Hooks novos

| Hook | Finalidade |
|------|-----------|
| `useServiceCategories()` | Lista categorias do tenant (usado no form e no catalog) |
| `useCreateCategory()` | Mutação de criação |
| `useUpdateCategory()` | Mutação de edição/reordenação |
| `useDeleteCategory()` | Mutação de remoção |

Hooks em `src/hooks/scheduling/use-service-categories.ts`, seguindo padrão de `use-services.ts`.

---

## 6. O que NÃO muda

- Pacotes e promoções — sem alteração
- `duration` no banco (continua `Int`, minutos)
- Rota de upload `/api/uploads/service-images` — sem alteração
- Fluxo de checkout de atendimento (agenda interna) — sem alteração nesta feature
- Permissões existentes — categorias usam `PERMISSIONS.services.manage`

---

## Checklist de entrega

- [ ] Migration Prisma: `ServiceCategory`, `description` em `Service`, `categoryId` em `Service`, `STARTING_FROM` em `PriceType`
- [ ] `ServiceCategoryRepository` + `ServiceCategoryService`
- [ ] API routes de categorias (4 endpoints)
- [ ] Schemas Zod atualizados em `domains/scheduling/types.ts`
- [ ] API routes de serviços atualizadas (createService, updateService, listServices)
- [ ] API pública retorna novos campos
- [ ] Hook `useServiceCategories` + mutações
- [ ] Hook `useServices` retorna novos campos
- [ ] `CategoryCatalog` + `CategoryFormModal`
- [ ] Aba "Categorias" em `ServicosPage`
- [ ] `ServiceFormModal` com todos os novos campos
- [ ] `ImageUploadField` (componente reutilizável)
- [ ] Componente `ServicePickerWithCategories`
- [ ] `ServiceStep` público substituído
- [ ] Seletor interno de agendamento substituído
- [ ] Utilitário `formatDuration(minutes: number): string`
- [ ] `npx tsc --noEmit` — zero erros
- [ ] Testes: `ServiceCategoryRepository`, `ServiceCategoryService`
