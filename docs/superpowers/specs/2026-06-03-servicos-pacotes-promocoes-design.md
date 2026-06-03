# Design: Serviços, Pacotes e Promoções

**Data:** 2026-06-03
**Status:** Aprovado
**Branch alvo:** `feat/servicos-pacotes-promocoes`

---

## Visão geral

Migrar a seção de Serviços da aba de Configurações para um item dedicado no menu lateral, evoluindo o catálogo atual para uma página com três domínios: **Serviços**, **Pacotes** e **Promoções**.

Essa estrutura serve como base para a futura **página pública do cliente**, onde será possível visualizar e agendar serviços — com imagens que aumentam confiança e clareza.

---

## Objetivos

- Elevar Serviços de aba secundária (dentro de Configurações) para item primário na navegação
- Criar Pacotes: conjuntos de serviços com preço próprio (não necessariamente a soma dos itens)
- Criar Promoções: serviços ou pacotes com desconto percentual ou fixo e validade opcional
- Suporte a imagens em Serviços, Pacotes e Promoções (preparação para página do cliente)
- Padronizar todos os campos monetários com máscara de entrada (`CurrencyInput`, `PercentageInput`)

---

## 1. Banco de dados

### Alteração no modelo existente

```prisma
model Service {
  // ... campos existentes ...
  imageUrl  String?                  // NOVO
  packages  ServicePackageItem[]     // NOVO (relação reversa)
  promotions PromotionItem[]         // NOVO (relação reversa)
}
```

### Novos modelos

```prisma
enum DiscountType {
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
  id            String        @id @default(cuid())
  tenantId      String
  name          String
  description   String?
  discountType  DiscountType
  discountValue Decimal       @db.Decimal(10, 2)
  startsAt      DateTime?
  endsAt        DateTime?
  active        Boolean       @default(true)
  imageUrl      String?
  items         PromotionItem[]
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

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

  // Ao menos um dos dois deve estar preenchido (validado na camada de serviço)
}
```

### Regras do schema

- `ServicePackageItem`: `onDelete: Cascade` — ao deletar o pacote, os itens são removidos
- `PromotionItem`: `onDelete: Cascade` — ao deletar a promoção, os itens são removidos
- Pacote sem pelo menos 1 item: inválido (validado no service, não no banco)
- `discountValue` PERCENTAGE: validado entre `0.01` e `100` no service
- `discountValue` FIXED: validado como positivo no service

---

## 2. Imagens — Supabase Storage

**Bucket:** `service-images` (público)

**Path pattern:** `{tenantId}/{entityType}/{entityId}/{filename}`

- `entityType`: `services` | `packages` | `promotions`
- Upload via `POST /api/uploads/service-images`
- Resposta: `{ url: string }` — URL pública salva no campo `imageUrl` da entidade
- Tamanho máximo: 5 MB
- Formatos aceitos: `image/jpeg`, `image/png`, `image/webp`

---

## 3. Backend

### Estrutura de arquivos

```
src/domains/scheduling/
  ├── package.repository.ts         ← CRUD de ServicePackage + items
  ├── promotion.repository.ts       ← CRUD de Promotion + items
  └── scheduling.service.ts         ← recebe métodos de package e promotion

src/app/api/
  ├── scheduling/services/route.ts          (existente — add imageUrl ao schema Zod)
  ├── scheduling/services/[id]/route.ts     (existente — add imageUrl ao schema Zod)
  ├── scheduling/packages/route.ts          GET + POST
  ├── scheduling/packages/[id]/route.ts     PATCH + DELETE
  ├── scheduling/promotions/route.ts        GET + POST
  ├── scheduling/promotions/[id]/route.ts   PATCH + DELETE
  └── uploads/service-images/route.ts       POST
```

### Permissões

Reutilizar permissões existentes:
- `services:view` → acesso de leitura a serviços, pacotes e promoções
- `services:manage` → criação, edição e desativação

Sem criação de novas permissões nesta fase.

### Regras de negócio

| Entidade | Regra |
|---|---|
| Promoção | `endsAt` no passado → flag `expired: true` na listagem (não remove do banco) |
| Promoção | `active: false` → oculto na futura página do cliente |
| Pacote | Sem itens → erro de validação antes de salvar |
| Promoção | `discountType: PERCENTAGE` → `discountValue` entre 0.01 e 100 |
| Promoção | `discountType: FIXED` → `discountValue` > 0 |

### Padrão de repository (exemplo para packages)

```typescript
export class PackageRepository {
  async list(tenantId: string) {
    return prisma.servicePackage.findMany({
      where: { tenantId, active: true },
      include: { items: { include: { service: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  async create(tenantId: string, data: CreatePackageInput) {
    return prisma.servicePackage.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description,
        price: data.price,
        imageUrl: data.imageUrl,
        items: {
          create: data.serviceIds.map(serviceId => ({ serviceId })),
        },
      },
      include: { items: { include: { service: true } } },
    })
  }
}
```

---

## 4. Frontend

### Nova rota

```
src/app/(app)/servicos/page.tsx
```

### Sidebar

Posição: `Agenda → Serviços → Clientes → Financeiro → Relatórios → Equipe → Configurações`

- **Nome:** Serviços
- **Ícone:** `Scissors` (Lucide) — representa serviços de estética
- **Rota:** `/servicos`
- **Permissão:** `services:view`

### Estrutura de componentes

```
src/components/domain/services/          ← pasta nova (migrado de settings/)
  ├── service-catalog.tsx                ← migrado + image upload
  ├── service-form-modal.tsx             ← migrado + CurrencyInput + image upload
  ├── package-catalog.tsx                ← novo
  ├── package-form-modal.tsx             ← novo
  ├── promotion-catalog.tsx              ← novo
  └── promotion-form-modal.tsx           ← novo

src/components/ui/
  ├── currency-input.tsx                 ← novo (compartilhado)
  └── percentage-input.tsx               ← novo (compartilhado)
```

### Inputs com máscara

**`CurrencyInput`**
- Exibe: `R$ 1.000,00`
- Armazena: `string` numérico normalizado (`"1000.00"`) para envio à API
- Comportamento: aceita dígitos, formata ao sair do foco
- Usado em: preço de Serviço, preço de Pacote, desconto fixo de Promoção

**`PercentageInput`**
- Exibe: `15,5%`
- Armazena: `string` numérico (`"15.5"`)
- Limita entrada a 0–100
- Usado em: desconto percentual de Promoção

**No `PromotionFormModal`:** o campo de valor do desconto alterna entre `CurrencyInput` e `PercentageInput` conforme o `discountType` selecionado.

### Refatoração de campos existentes

- `ServiceFormModal` → campo `preço` migrado para `CurrencyInput`
- Outros campos monetários no projeto (comissões, taxas de cartão) devem receber o mesmo tratamento

### Hooks novos

```
src/hooks/scheduling/
  ├── use-packages.ts      ← usePackages, useCreatePackage, useUpdatePackage, useDeactivatePackage
  └── use-promotions.ts    ← usePromotions, useCreatePromotion, useUpdatePromotion, useDeactivatePromotion
```

### Estados da UI por catálogo (padrão obrigatório)

Cada catálogo (Serviços, Pacotes, Promoções) deve ter:
- `loading state` — skeleton cards
- `empty state` — mensagem + botão de criação
- `error state` — mensagem de erro com retry
- `list state` — cards com imagem, nome, preço/desconto, actions (editar, desativar)

Para Promoções, adicionar badge visual:
- `Ativa` — verde
- `Expirada` — cinza (endsAt no passado)
- `Agendada` — azul (startsAt no futuro)

### Remoção

- Aba "Serviços" removida de `src/app/(app)/configuracoes/page.tsx`
- Import de `ServiceCatalog` removido da página de configurações
- Componentes físicos movidos de `src/components/domain/settings/` para `src/components/domain/services/`

---

## 5. Checklist de entrega

- [ ] Migration Prisma gerada e aplicada
- [ ] `imageUrl` em Service sem breaking change (campo opcional)
- [ ] Bucket `service-images` criado no Supabase Storage
- [ ] `PackageRepository` + `PromotionRepository` com filtro de `tenantId` em todas as queries
- [ ] Zod schemas em `domains/scheduling/schemas.ts` para Package e Promotion
- [ ] API Routes protegidas com permissões corretas
- [ ] `CurrencyInput` e `PercentageInput` testados com valores-limite
- [ ] `ServiceFormModal` refatorado com `CurrencyInput`
- [ ] Sidebar com item "Serviços" na posição correta
- [ ] Página `/servicos` com 3 tabs funcionando
- [ ] Aba "Serviços" removida de `/configuracoes`
- [ ] Todos os estados de UI implementados (loading, empty, error, list)
- [ ] Badges de status na aba Promoções
- [ ] `npx tsc --noEmit` — zero erros
- [ ] `npx vitest run` — todos os testes passando
