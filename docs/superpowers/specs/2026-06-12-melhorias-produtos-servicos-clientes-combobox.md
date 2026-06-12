# Spec: Melhorias em Produtos, Serviços, Clientes e Combobox Global

**Data:** 2026-06-12  
**Status:** Aprovado para implementação  
**Prioridade:** Alta — impacta usabilidade diária do operador

---

## Contexto

Conjunto de melhorias pontuais identificadas em uso real do sistema. O objetivo é corrigir lacunas funcionais sem quebrar nenhum fluxo existente, priorizando agilidade do operador e segurança dos dados.

---

## 1. Produtos & Estoque

### 1.1 Preço de Venda opcional

**Problema:** `salePrice` exige valor no Zod schema (`z.number().positive()`), mas um produto pode existir apenas para consumo interno (sem venda ao cliente).

**Mudança:**
- `createProductSchema` e `updateProductSchema` em `src/domains/inventory/types.ts`: `salePrice` passa de `.positive()` para `.nonnegative().optional()`.
- `ProductFormModal.tsx`: remover asterisco e validação de obrigatoriedade do campo Preço de Venda. Campo continua visível mas opcional.
- Calcular patrimônio da tabela com `salePrice ?? 0` para evitar quebra na coluna "Patrimônio".

**Preservação:** Produtos que já têm `salePrice` não são afetados. A exibição na tabela e relatórios usa `?? 0` como fallback seguro.

---

### 1.2 Upload de imagem do produto

**Problema:** O `ProductFormModal` nunca expõe o campo de imagem, embora o domínio tenha `imageUrl`.

**Mudança:**
- Adicionar `ImageUploadField` no `ProductFormModal` **somente no modo edição** (`isEditing === true`).
- No modo criação, exibir nota discreta: _"Salve o produto para adicionar uma imagem."_
- O `entityType` do upload será `"products"`. Verificar se existe rota `/api/uploads/product-images` — se não, criar espelhando `/api/uploads/service-images`.
- Passar `entityId={product.id}` (disponível somente na edição).

**Preservação:** Produtos sem imagem continuam funcionando normalmente — `imageUrl` é nullable no banco.

---

### 1.3 Ajuste direto de estoque

**Problema:** O modal de edição exibe apenas "Estoque atual: X — use Compra de Estoque para ajustar", sem ação direta.

**Mudança:**
- No modo edição, adicionar campo "Ajustar estoque para (unidades)" — input numérico inteiro ≥ 0.
- Campo é separado do botão de salvar principal: tem seu próprio botão "Ajustar" inline.
- Ao confirmar: chama `POST /api/products/[id]/purchase` (ou novo endpoint `POST /api/products/[id]/adjust`) com `{ quantity: novaQtd - estoqueAtual, notes: "Ajuste manual" }`. Se a diferença for negativa, o endpoint interpreta como saída.
- Criar endpoint `POST /api/products/[id]/adjust` no backend que aceita `{ targetQuantity: number }`, calcula a diferença e registra `StockMovement` do tipo `ADJUSTMENT` (enum já existe em `StockMovementType`).
- Exibir toast de sucesso com a nova quantidade.

**Preservação:** O fluxo de Compra de Estoque e Venda de Estoque continua intacto e inalterado. O ajuste é apenas uma terceira via para correção pontual.

---

### 1.4 Paginação na tabela de produtos

**Problema:** `ProductsTable` renderiza todos os produtos sem paginação; em catálogos grandes isso degrada performance e UX.

**Mudança:**
- Alterar `useProducts` call na página `/produtos` para `pageSize: 10`.
- Adicionar controles de paginação abaixo da `ProductsTable` (Anterior / `página X de Y` / Próxima), idênticos ao padrão já usado em `CustomerList`.
- Paginação de movimentações (Compras e Vendas) também limitada a 10 por página.

**Preservação:** O hook `useProducts` já suporta `page` e `pageSize` — sem mudança de API.

---

## 2. Serviços

### 2.1 Reativar serviço desativado

**Problema:** `ServiceCatalog` oculta o botão de desativar quando `service.active === false`, sem oferecer reativação.

**Mudança:**
- Quando `service.active === false`: exibir botão "Reativar" (ícone `PowerOff → Power`) ao lado do botão de editar.
- Adicionar hook `useActivateService` em `use-services.ts`: chama `PATCH /api/scheduling/services/[id]` com `{ active: true }`.
- O endpoint PATCH já aceita `active` via `updateServiceSchema` — sem mudança de backend.
- Confirmar ação com `confirm()` antes de reativar (consistente com o padrão de desativação existente).

**Preservação:** Botão de desativar mantém comportamento atual. Serviços ativos não veem o botão de reativar.

---

### 2.2 Imagem no cadastro de serviço

**Problema:** `ImageUploadField` usa `entityId={service?.id ?? null}`. Com `null` no cadastro, o upload falha ou gera arquivo órfão.

**Mudança:**
- No modo criação (`isEditing === false`): remover o `ImageUploadField`. Exibir nota: _"Salve o serviço para adicionar uma imagem."_
- No modo edição: `ImageUploadField` permanece exatamente como está.

**Preservação:** Zero regressão. Serviços existentes com imagem continuam exibindo-a no catálogo.

---

### 2.3 Pacotes e promoções no agendamento público

**Problema:** A API pública `/api/public/[slug]` retorna apenas `services`. Pacotes e promoções não aparecem para o cliente agendar.

**Arquitetura:**

**Backend:**
- `publicBookingRepository` ganha dois métodos:
  - `findPublicPackages(tenantId)` — retorna pacotes ativos com seus itens e serviços associados. Campos: `id`, `name`, `description`, `imageUrl`, `price`, `items[{ service: { duration } }]`, `duration` (soma das durações dos itens).
  - `findPublicPromotions(tenantId)` — retorna promoções ativas (`active: true`) com `startsAt <= now <= endsAt` (ou sem datas definidas), com os itens associados (serviços/pacotes) e desconto calculado.
- Rota `GET /api/public/[slug]` passa a retornar também `packages` e `promotions`.

**Tipos públicos:**
- Adicionar `PublicPackage` e `PublicPromotion` em `src/app/(public)/agendar/[slug]/types.ts`.

**Frontend (ServiceStep):**
- Dividir em três seções visuais: **Serviços**, **Pacotes**, **Promoções** — usando abas ou grupos colapsáveis (preferir abas para consistência com o restante do sistema).
- Ao selecionar um pacote:
  - `BookingState` recebe: `packageId`, `serviceId: null`, `duration = soma das durações`, `price = pkg.price`, `priceLabelOverride = preço formatado do pacote`.
  - O fluxo de profissional → horário → dados pessoais → confirmação continua idêntico.
- Ao selecionar uma promoção:
  - `BookingState` recebe: `promotionId`, `serviceId = promotion.serviceId`, `duration = service.duration`, `price = preço com desconto`.
  - Exibir badge "Promoção" no card selecionado.

**Agendamento (POST /api/public/[slug]/appointments):**
- Aceitar `packageId?: string` e `promotionId?: string` opcionais além de `serviceId`.
- Validar que ao menos um dos dois (`serviceId`, `packageId`) foi fornecido.
- **Migration necessária (aditiva e segura):** `Appointment.serviceId` passa de obrigatório para opcional (`String?`); adicionar coluna `packageId String?` e `promotionId String?` com `@@index`. Registros existentes não são afetados — `serviceId` permanece preenchido em todos eles.

**Paginação nos catálogos admin:**
- `ServiceCatalog`, `PackageCatalog`, `PromotionCatalog` passam a 10 itens por página.
- Os hooks correspondentes já suportam `page`/`pageSize` ou serão atualizados para isso.

---

## 3. Clientes

### 3.1 Edição de dados pelo perfil

**Problema:** Não há modal de edição. O hook `useUpdateCustomer` existe mas nunca é chamado pela UI.

**Mudança:**
- Na página `/clientes/[id]/page.tsx`, adicionar botão "Editar dados" no header (ao lado do botão de voltar).
- Criar `EditCustomerModal` (novo arquivo `src/components/domain/crm/edit-customer-modal.tsx`):
  - Campos: Nome*, Telefone, E-mail, Data de Nascimento (opcional).
  - Pré-populado com dados atuais do cliente.
  - Chama `useUpdateCustomer` ao salvar.
  - Toast de sucesso/erro.
- O `useUpdateCustomer` já está em `use-customers.ts` — sem mudança de hook.

**Preservação:** `CreateCustomerModal` na lista permanece inalterado. A edição é exclusiva do perfil, evitando duplicidade de fluxos.

---

### 3.2 Campo data de nascimento

**Problema:** `birthDate` existe no banco e no repositório (filtro por mês de aniversário), mas não no schema de criação/edição.

**Mudança:**
- `createCustomerSchema` em `src/domains/crm/types.ts`: adicionar `birthDate: z.string().date().optional()`.
- `updateCustomerSchema` herda via `.partial()` — automaticamente inclui `birthDate`.
- `CreateCustomerModal`: adicionar campo de data (input `type="date"`) como opcional.
- `EditCustomerModal`: idem — campo de data pré-populado com valor existente.
- No perfil do cliente: exibir data de nascimento formatada quando preenchida (ex: "15/03/1990 · 34 anos").
- API `POST /api/crm/customers` e `PATCH /api/crm/customers/[id]`: validação automática via schema — sem mudança de código.

**Preservação:** Campo é 100% opcional. Clientes existentes sem `birthDate` continuam funcionando. O filtro por `birthdayMonth` no relatório permanece intacto.

---

### 3.3 Paginação de clientes

**Mudança:** `CustomerList` já pagina a 20 itens. Alterar para `pageSize: 10` para consistência com o padrão definido neste spec.

---

## 4. Combobox global (Select com busca)

### 4.1 Componente `ComboboxField`

**Problema:** Todos os `<Select>` do sistema não permitem digitação para filtrar. Em listas longas (produtos, clientes, profissionais) isso prejudica a agilidade do operador.

**Mudança:**

Criar `src/components/ui/combobox-field.tsx` usando `Command` + `Popover` do shadcn:

```typescript
type ComboboxFieldProps = {
  options: { value: string; label: string }[]
  value?: string
  onChange: (value: string | undefined) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
}
```

- Clique abre popover com input de busca.
- Digitação filtra opções em tempo real (client-side, case-insensitive, sem accent sensitivity).
- Seleção fecha o popover e exibe o label selecionado no trigger.
- Suporta "nenhum selecionado" (valor vazio/undefined).
- Acessível: navegação por teclado (↑↓ Enter Esc) funciona nativamente via `Command`.

### 4.2 Substituições

Substituir `<Select>` por `<ComboboxField>` nos seguintes locais prioritários:

| Arquivo | Campo |
|---|---|
| `ProductFormModal.tsx` | Categoria do produto |
| `ServiceFormModal.tsx` | Categoria do serviço |
| `ServiceFormModal.tsx` | Adicionar produto ao kit |
| `StockPurchaseModal.tsx` | Produto |
| `StockSaleModal.tsx` | Produto |
| `service-step.tsx` (booking público) | Serviço (se virar lista de select) |
| Criação de agendamento interno | Cliente, Serviço, Profissional |

Selects com ≤ 4 opções fixas (ex: tipo de preço, status) permanecem como `<Select>` — combobox é desnecessário nesses casos.

### 4.3 Estratégia de não-regressão

- O `ComboboxField` tem a mesma interface externa que `<Select>` — a substituição é mecânica campo a campo.
- Testes: verificar que ao selecionar um valor e reabrir o modal, o valor está pré-selecionado corretamente.
- O componente não faz fetch — trabalha com `options` já carregadas, evitando requests extras.

---

## 5. Segurança e validação

- Nenhuma rota nova expõe dados sem `getSessionContext` + `ensurePermission`.
- O endpoint de ajuste de estoque (`/api/products/[id]/adjust`) usa `ensurePermission(session, 'produtos', 'edit')`.
- A API pública de agendamento (`/api/public/[slug]/appointments`) valida que `packageId` ou `serviceId` pertencem ao tenant do slug — sem risco de IDOR.
- `birthDate` aceita apenas strings no formato ISO date (`YYYY-MM-DD`) via Zod — sem injeção de dados malformados.
- `targetQuantity` no ajuste de estoque é validado como `z.number().int().min(0)` — não aceita negativos.

---

## 6. Ordem de implementação sugerida

1. **ComboboxField** — componente base reutilizado por todos os outros itens.
2. **Produtos** — salePrice opcional + ajuste de estoque + imagem + paginação.
3. **Serviços** — reativar + imagem no cadastro + paginação nos catálogos.
4. **Clientes** — EditCustomerModal + birthDate + paginação.
5. **Pacotes/Promoções no agendamento** — maior escopo, feito por último para não bloquear os outros.

---

## 7. Critérios de aceitação

- [ ] Produto pode ser criado sem `salePrice`; tabela exibe "—" ou R$ 0,00 no campo.
- [ ] Imagem de produto aparece somente no modo edição; nota aparece no cadastro.
- [ ] Ajuste de estoque registra `StockMovement` e atualiza quantidade exibida sem recarregar página.
- [ ] Tabelas de produtos, serviços, clientes exibem 10 itens com paginação funcional.
- [ ] Serviço desativado exibe botão "Reativar"; ao clicar, serviço volta a aparecer como ativo.
- [ ] Imagem de serviço não aparece no cadastro novo; aparece na edição.
- [ ] Pacotes e promoções aparecem no agendamento público; seleção completa o fluxo até confirmação.
- [ ] Edição de cliente abre modal pré-populado; salva e reflete na UI sem reload.
- [ ] Campo `birthDate` aceita data ou vazio; exibido no perfil formatado quando presente.
- [ ] `ComboboxField` permite digitar para filtrar; navegação por teclado funciona; valor pré-selecionado ao reabrir.
- [ ] Nenhum fluxo existente quebrado: agendamento atual, criação de cliente, compra/venda de estoque, desativação de serviço.
