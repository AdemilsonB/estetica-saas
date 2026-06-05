# Spec: Ajustes de Cargos, Permissões de Filtro e Estoque em Atendimento Concluído

**Data:** 2026-06-05
**Status:** Aprovado

---

## Escopo

Três entregas independentes, sem dependência entre si:

1. **Bug:** `view_all` não salva nas configurações de cargos
2. **Layout:** Separação visual de "Permissões de filtro" no editor de cargo
3. **Funcionalidade:** Opção de ajuste de estoque ao editar produtos de atendimento concluído

---

## Tarefa 1 — Bug: `view_all` rejeitado no save de cargo

### Problema

`src/domains/iam/role.schemas.ts` define:

```ts
const validActions = ['view', 'create', 'edit', 'delete'] as const
```

`view_all` está ausente. Quando o usuário marca "Ver todos" na matrix e clica Salvar, o Zod rejeita o valor e o PUT `/api/iam/roles/[id]` retorna erro de validação.

### Solução

Adicionar `'view_all'` ao array `validActions`:

```ts
const validActions = ['view', 'create', 'edit', 'delete', 'view_all'] as const
```

### Arquivo

- Modify: `src/domains/iam/role.schemas.ts` — linha 4

---

## Tarefa 2 — Layout: Seção "Permissões de filtro"

### Objetivo

Separar visualmente as permissões de filtro (atualmente coluna `view_all` na tabela principal) em uma seção própria abaixo da tabela, com label contextual por tela.

### Mudanças de dados

**`src/shared/permissions/nav-registry.ts`**

Adicionar campo opcional ao tipo `NavSection`:

```ts
export type NavSection = {
  // ... campos existentes
  filterLabel?: string  // descrição contextual do que view_all significa nesta tela
}
```

Adicionar `filterLabel` à seção `agenda`:

```ts
{
  key: 'agenda',
  filterLabel: 'Ver atendimentos de outros profissionais',
  // ... resto
}
```

### Mudanças de componentes

**`src/components/domain/iam/role-permission-matrix.tsx`**

Remover `'view_all'` de `ALL_ACTIONS`. A tabela passa a ter 4 colunas: Visualizar, Criar, Editar, Excluir.

```ts
const ALL_ACTIONS: NavAction[] = ['view', 'create', 'edit', 'delete']
```

**`src/components/domain/iam/role-filter-permissions.tsx`** (novo)

Componente que lista as seções com `filterLabel`. Cada item é um checkbox row:

```
☑  Ver atendimentos de outros profissionais  —  Agenda
```

Props:
```ts
type Props = {
  sections: NavSection[]
  permissions: Record<string, string[]>
  onChange: (next: Record<string, string[]>) => void
  disabled?: boolean
}
```

Lógica: filtra `sections` onde `section.filterLabel` existe e `section.actions.includes('view_all')`. Para cada um, exibe checkbox que lê/escreve `permissions[section.key]` no valor `view_all`.

**`src/components/domain/iam/role-editor.tsx`**

Adicionar bloco abaixo da tabela existente:

```tsx
{sections.some(s => s.filterLabel) && (
  <div>
    <p className="mb-3 text-sm font-medium text-slate-700">Permissões de filtro</p>
    <RoleFilterPermissions
      sections={sections}
      permissions={permissions}
      onChange={setPermissions}
      disabled={updateRole.isPending}
    />
  </div>
)}
```

### Resultado visual

```
Permissões por tela
┌──────────┬────────────┬───────┬───────┬─────────┐
│ Tela     │ Visualizar │ Criar │ Editar│ Excluir │
├──────────┴────────────┴───────┴───────┴─────────┤
│ Agenda     ☑            ☑       ☑       □       │
│ Serviços   ☑            □       □       □       │
└────────────────────────────────────────────────┘

Permissões de filtro
☑  Ver atendimentos de outros profissionais  —  Agenda
```

---

## Tarefa 3 — Funcionalidade: Ajuste de estoque em atendimento concluído

### Problema atual

`finalizeAppointmentProducts` no service sempre decrementa estoque para toda a lista nova. Chamado em atendimento já concluído, causa duplo-decremento.

### Solução

#### Backend

**`src/domains/inventory/types.ts`**

Estender `appointmentProductsSchema`:

```ts
export const appointmentProductsSchema = z.object({
  products: z.array(z.object({
    productId: z.string().cuid(),
    quantity: z.number().int().min(1),
  })),
  stockAction: z.enum(['deduct', 'restore', 'none']).default('none'),
})
```

**`src/domains/inventory/inventory.service.ts`**

Novo método `updateCompletedAppointmentProducts`:

```ts
async updateCompletedAppointmentProducts(
  tenantId: string,
  appointmentId: string,
  newProducts: Array<{ productId: string; quantity: number }>,
  stockAction: 'deduct' | 'restore' | 'none',
  createdByUserId: string,
)
```

Lógica:
1. Busca `oldProducts = getAppointmentProducts(tenantId, appointmentId)`
2. Computa diff:
   - `added`: produtos em `newProducts` com `quantity > oldQuantity` (ou não existiam)
   - `removed`: produtos em `oldProducts` com `quantity > newQuantity` (ou foram removidos)
3. Aplica conforme `stockAction`:
   - `'deduct'`: para cada item em `added` → `decrementStock(diff_qty)` + `StockMovement ADJUSTMENT`
   - `'restore'`: para cada item em `removed` → `incrementStock(diff_qty)` + `StockMovement ADJUSTMENT`
   - `'none'`: sem toque no estoque
4. `saveAppointmentProducts(tenantId, appointmentId, newProducts)`

**`src/app/api/appointments/[id]/products/route.ts`**

O `PATCH` verifica se o atendimento está concluído (via query ao appointment). Se `COMPLETED`, chama `updateCompletedAppointmentProducts`. Se não, mantém `finalizeAppointmentProducts` como hoje.

> A API Route busca o appointment via `prisma.appointment.findFirst({ where: { id, tenantId } })` antes de rotear. Se `status === 'COMPLETED'` → `updateCompletedAppointmentProducts`. Caso contrário → `finalizeAppointmentProducts`. A consulta direta ao Prisma na API Route é aceitável pois routes são a camada de integração (não pertencem a domínio).

#### Frontend

**`src/components/domain/inventory/AppointmentProductsSection.tsx`**

Adicionar prop `isCompleted: boolean`.

Adicionar estado local `stockAction: 'deduct' | 'restore' | 'none'` e `dialogOpen: boolean`.

`handleSave`:
- Se `isCompleted`: abre `dialogOpen = true` em vez de salvar diretamente
- Se não: salva diretamente (comportamento atual)

Dialog (`AlertDialog` do Shadcn):

```
Atualizar estoque?

● Deixar como está
  Apenas atualiza o registro, sem alterar o estoque.

○ Retirar do estoque
  Produtos adicionados ou aumentados serão descontados do estoque.

○ Repor no estoque
  Produtos removidos ou reduzidos serão devolvidos ao estoque.

          [Cancelar]  [Confirmar]
```

Ao confirmar: chama `saveProducts.mutateAsync({ products, stockAction })`.

**`src/components/domain/scheduling/appointment-drawer.tsx`**

Passar `isCompleted={!isActive}` para `<AppointmentProductsSection>`.

**`src/hooks/inventory/use-appointment-products.ts`**

`useSaveAppointmentProducts` já passa o body completo — nenhuma mudança necessária além de o tipo aceitar `stockAction`.

---

## Arquivos tocados

| Arquivo | Tipo | Tarefa |
|---|---|---|
| `src/domains/iam/role.schemas.ts` | Modify | 1 |
| `src/shared/permissions/nav-registry.ts` | Modify | 2 |
| `src/components/domain/iam/role-permission-matrix.tsx` | Modify | 2 |
| `src/components/domain/iam/role-filter-permissions.tsx` | Create | 2 |
| `src/components/domain/iam/role-editor.tsx` | Modify | 2 |
| `src/domains/inventory/types.ts` | Modify | 3 |
| `src/domains/inventory/inventory.service.ts` | Modify | 3 |
| `src/app/api/appointments/[id]/products/route.ts` | Modify | 3 |
| `src/components/domain/inventory/AppointmentProductsSection.tsx` | Modify | 3 |
| `src/components/domain/scheduling/appointment-drawer.tsx` | Modify | 3 |

---

## Sem testes novos obrigatórios

- Tarefa 1: trivial (uma linha)
- Tarefa 2: apenas componentes visuais
- Tarefa 3: `updateCompletedAppointmentProducts` deve ter teste de unidade cobrindo os 3 `stockAction` valores (deduct/restore/none) e o diff correto
