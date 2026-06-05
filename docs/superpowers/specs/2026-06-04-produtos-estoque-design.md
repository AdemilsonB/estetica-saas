# Design — Módulo Produtos & Estoque

**Data:** 2026-06-04
**Referência UX:** MinhaAgenda (`portal.minhaagendaapp.com.br/produtos-estoque`)
**Abordagem arquitetural:** Domínio `inventory` independente (Abordagem 1 aprovada)

---

## Escopo

Três funcionalidades mapeadas no `2026-05-31-minha-agenda-feature-mapping.md` (Seção 6 — Produtos):

| Feature | Status atual | O que será entregue |
|---------|-------------|---------------------|
| Catálogo de produtos | ❌ | `Product` + `ProductCategory` com costPrice, salePrice, estoque, alertas |
| Produto no agendamento | ❌ | Template por serviço (`ServiceProduct`) + registro por atendimento (`AppointmentProduct`) — opcional |
| Relatório de vendas de produtos | ❌ | Aba "Vendas" na página principal + futuro relatório em `/relatorios` |

---

## Decisões de design

- **Produtos usados em atendimento** → apenas decrementa estoque, sem transação financeira adicional (custo já incluso no valor do serviço)
- **Produtos vendidos avulso** → decrementa estoque + gera `Transaction(INCOME)` via evento
- **Compra de reabastecimento** → incrementa estoque + gera `Transaction(EXPENSE)` via evento
- **Template por serviço (Híbrido C)** → `ServiceProduct[]` pré-preenche o campo de produtos utilizados no atendimento; profissional ajusta ou ignora
- **Produtos utilizados no atendimento são opcionais** → sem validação obrigatória, sem bloqueio de conclusão do agendamento
- **Patrimônio** = `salePrice × stockQuantity` por produto; soma total exibida no topo da página
- **Baixo estoque** = `stockQuantity ≤ lowStockAlert` (configurável por produto, padrão 5)
- **Navegação** = item próprio na sidebar entre Serviços e Financeiro

---

## Modelos de Dados

### Novos modelos Prisma

```prisma
model ProductCategory {
  id        String    @id @default(cuid())
  tenantId  String
  name      String
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  tenant    Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  products  Product[]

  @@unique([tenantId, name])
  @@index([tenantId])
}

enum StockMovementType {
  PURCHASE          // compra de reabastecimento (entrada +)
  SALE              // venda avulsa ao cliente (saída -)
  APPOINTMENT_USE   // usado em atendimento (saída -)
  ADJUSTMENT        // ajuste manual de quantidade
}

model Product {
  id              String           @id @default(cuid())
  tenantId        String
  name            String
  categoryId      String?
  costPrice       Decimal          @db.Decimal(10, 2)
  salePrice       Decimal          @db.Decimal(10, 2)
  stockQuantity   Int              @default(0)
  lowStockAlert   Int              @default(5)
  active          Boolean          @default(true)
  imageUrl        String?
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  tenant              Tenant              @relation(...)
  category            ProductCategory?    @relation(...)
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
  quantity        Int               // positivo = entrada, negativo = saída
  unitPrice       Decimal?          @db.Decimal(10, 2)
  totalAmount     Decimal?          @db.Decimal(10, 2)
  notes           String?
  appointmentId   String?
  createdByUserId String
  createdAt       DateTime          @default(now())

  tenant   Tenant  @relation(...)
  product  Product @relation(...)

  @@index([tenantId])
  @@index([tenantId, productId])
  @@index([tenantId, type, createdAt])
}

model AppointmentProduct {
  id            String      @id @default(cuid())
  tenantId      String
  appointmentId String
  productId     String
  quantity      Int         @default(1)

  tenant      Tenant      @relation(...)
  appointment Appointment @relation(...)
  product     Product     @relation(...)

  @@unique([appointmentId, productId])
  @@index([tenantId])
  @@index([appointmentId])
}

model ServiceProduct {
  id        String   @id @default(cuid())
  tenantId  String
  serviceId String
  productId String
  quantity  Int      @default(1)

  tenant  Tenant  @relation(...)
  service Service @relation(...)
  product Product @relation(...)

  @@unique([serviceId, productId])
  @@index([tenantId])
}
```

### Modelos existentes com novas relações

- `Tenant` → `products`, `productCategories`, `stockMovements`, `appointmentProducts`, `serviceProducts`
- `Appointment` → `appointmentProducts AppointmentProduct[]`
- `Service` → `serviceProducts ServiceProduct[]`
- `Transaction` → sem mudança de schema; criada via evento

---

## Arquitetura de Domínio

### Estrutura de pastas

```
src/domains/inventory/
├── types.ts                    ← Zod schemas + tipos TypeScript
├── product.repository.ts       ← CRUD Product, ProductCategory, ServiceProduct
├── stock.repository.ts         ← StockMovement CRUD + queries de histórico
├── inventory.service.ts        ← regras de negócio
└── subscriptions.ts            ← escuta eventos de domínio externos
```

### Responsabilidades do `inventory.service.ts`

| Método | Descrição |
|--------|-----------|
| `createProduct(tenantId, input)` | Cria produto; valida nome único por tenant |
| `updateProduct(tenantId, id, input)` | Atualiza campos; não permite alterar stockQuantity diretamente |
| `deleteProduct(tenantId, id)` | Soft delete via `active = false` — produto some do catálogo, histórico de movimentações é preservado |
| `listProducts(tenantId, filters)` | Lista com filtros: categoria, baixo estoque, busca por nome |
| `createCategory(tenantId, name)` | Cria categoria; valida unicidade |
| `deleteCategory(tenantId, id)` | Remove se não houver produtos vinculados |
| `recordPurchase(tenantId, input)` | Incrementa `stockQuantity`; cria `StockMovement(PURCHASE)`; publica `stock.purchased` |
| `recordSale(tenantId, input)` | Valida estoque ≥ quantidade; decrementa; cria `StockMovement(SALE)`; publica `product.sold` |
| `getServiceTemplate(tenantId, serviceId)` | Retorna `ServiceProduct[]` para pré-preencher modal de atendimento |
| `saveServiceTemplate(tenantId, serviceId, products[])` | Upsert do template do serviço |
| `finalizeAppointmentProducts(tenantId, appointmentId, products[])` | Cria/atualiza `AppointmentProduct[]`; cria `StockMovement(APPOINTMENT_USE)` para cada item; decrementa estoque |

### Eventos publicados

| Evento | Payload | Quem escuta |
|--------|---------|-------------|
| `product.sold` | `{ tenantId, productId, quantity, totalAmount, customerId? }` | `financial/subscriptions.ts` |
| `stock.purchased` | `{ tenantId, productId, quantity, totalAmount }` | `financial/subscriptions.ts` |

### Financial escuta (adição em `financial/subscriptions.ts`)

- `product.sold` → cria `Transaction(INCOME, category: 'Venda de Produto', amount: totalAmount)`
- `stock.purchased` → cria `Transaction(EXPENSE, category: 'Compra de Estoque', amount: totalAmount)`

---

## API Routes

```
# Produtos
GET    /api/products                        lista com filtros (nome, categoria, baixo estoque, page)
POST   /api/products                        criar produto
PATCH  /api/products/[id]                   atualizar produto
DELETE /api/products/[id]                   desativar produto

# Categorias
GET    /api/products/categories             listar categorias do tenant
POST   /api/products/categories             criar categoria
DELETE /api/products/categories/[id]        remover categoria

# Movimentações
POST   /api/products/[id]/purchase          registrar compra (entrada de estoque)
POST   /api/products/[id]/sell              registrar venda avulsa
GET    /api/products/movements              histórico de movimentações (filtros: tipo, produto, período)

# Template por serviço
GET    /api/services/[id]/products          buscar template do serviço
PUT    /api/services/[id]/products          salvar template do serviço

# Produtos por atendimento
GET    /api/appointments/[id]/products      buscar produtos registrados no atendimento
PATCH  /api/appointments/[id]/products      salvar produtos utilizados no atendimento
```

---

## Frontend

### Navegação

Nova entrada na sidebar: **Produtos** com ícone `ShoppingBag` (Lucide), entre Serviços e Financeiro.

### Página principal: `/produtos`

`src/app/(app)/produtos/page.tsx` com três abas:

#### Aba "Produtos"

- Barra de resumo: `Quantidade total em estoque: X · Patrimônio total: R$ X.XXX,XX`
- Ações: botão `CATEGORIAS` (abre `CategoryManagerModal`) · botão `ADICIONAR PRODUTO` (abre `ProductFormModal`)
- Tabela colunas: Produto | Categoria | Preço de Venda | Estoque | Patrimônio | Ações
  - Badge estoque: `POUCO ESTOQUE` (laranja, `stockQuantity ≤ lowStockAlert`) ou `COM ESTOQUE` (verde)
  - Patrimônio = `salePrice × stockQuantity`
  - Ações: editar (lápis) · excluir (lixeira)
- Busca inline por nome e filtro por categoria

#### Aba "Compra de Estoque"

- Botão `REGISTRAR COMPRA` → abre `StockPurchaseModal`
- Tabela: Data | Produto | Quantidade | Valor Unitário | Total | Observações
- Filtros: produto, período

#### Aba "Vendas"

- Botão `REGISTRAR VENDA` → abre `StockSaleModal`
- Tabela: Data | Produto | Quantidade | Valor Unitário | Total | Cliente
- Filtros: produto, período

### Componentes novos

```
src/components/domain/inventory/
├── ProductsTable.tsx               catálogo principal com badges de estoque
├── ProductFormModal.tsx            criar/editar produto (inclui aba "Kit Padrão por Serviço")
├── StockPurchaseModal.tsx          registrar entrada de estoque
├── StockSaleModal.tsx              registrar venda avulsa
├── CategoryManagerModal.tsx        CRUD de categorias
├── StockMovementsTable.tsx         tabela compartilhada (Compra + Vendas)
└── AppointmentProductsSection.tsx  seção opcional dentro do AppointmentDrawer
```

### Integração no AppointmentDrawer

Dentro do `AppointmentDrawer` existente, nova seção colapsável **"Produtos Utilizados"** (opcional):

- Ao expandir: busca template via `GET /api/services/[serviceId]/products` e pré-preenche
- Profissional pode adicionar, remover ou ajustar quantidade por produto
- Sem validação obrigatória — agendamento pode ser concluído sem preencher
- Botão "Salvar consumo" chama `PATCH /api/appointments/[id]/products`

### Hooks TanStack Query

```
useProducts(filters)                → GET /api/products
useProductCategories()              → GET /api/products/categories
useStockMovements(filters)          → GET /api/products/movements
useServiceTemplate(serviceId)       → GET /api/services/[id]/products
useAppointmentProducts(appointmentId) → GET /api/appointments/[id]/products
```

---

## Validação e Erros

### Zod schemas (`domains/inventory/types.ts`)

- `createProductSchema` — name, categoryId?, costPrice, salePrice, lowStockAlert, imageUrl?
- `updateProductSchema` — partial de createProductSchema (sem stockQuantity direto)
- `recordPurchaseSchema` — productId, quantity (min 1), unitPrice, notes?
- `recordSaleSchema` — productId, quantity (min 1), unitPrice?, customerId?
- `appointmentProductsSchema` — array de `{ productId, quantity }`
- `serviceTemplateSchema` — array de `{ productId, quantity }`

### Erros de domínio tipados

| Código | Situação |
|--------|----------|
| `PRODUCT_NOT_FOUND` | Produto não encontrado no tenant |
| `INSUFFICIENT_STOCK` | Venda/uso solicitado excede `stockQuantity` |
| `CATEGORY_HAS_PRODUCTS` | Tentativa de deletar categoria com produtos vinculados |
| `CATEGORY_NAME_CONFLICT` | Nome de categoria já existe no tenant |

---

## Testes

| Arquivo | Cobertura alvo |
|---------|---------------|
| `inventory.service.test.ts` | 80% — validação de estoque, cálculo de patrimônio, eventos publicados |
| `product.repository.test.ts` | 60% — CRUD + isolamento de tenant |
| `stock.repository.test.ts` | 60% — queries de histórico, filtros por tipo/período |

---

## Fora do escopo desta entrega

- Relatório de vendas de produtos integrado à página `/relatorios` (entrega futura)
- Código de barras / QR code por produto
- Múltiplos fornecedores
- Alertas push de baixo estoque (notificação WhatsApp)
- Importação/exportação de catálogo em CSV
