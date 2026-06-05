# Ajustes de Cargos, Permissões de Filtro e Estoque em Atendimento Concluído

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir bug de save de `view_all` em cargos, separar permissões de filtro em seção visual própria, e permitir ajuste de estoque ao editar produtos de atendimento já concluído.

**Architecture:** Três tarefas independentes — (1) correção trivial de schema Zod, (2) extensão do nav-registry com `filterLabel` + novo componente React, (3) novo método `updateCompletedAppointmentProducts` no service com lógica de diff + dialog de seleção no frontend.

**Tech Stack:** Next.js 15 App Router, TypeScript, Zod, Vitest, Shadcn UI, TanStack Query v5, Prisma

---

## Mapa de arquivos

| Arquivo | Tipo | Tarefa |
|---|---|---|
| `src/domains/iam/role.schemas.ts` | Modify | 1 |
| `src/shared/permissions/nav-registry.ts` | Modify | 2 |
| `src/components/domain/iam/role-permission-matrix.tsx` | Modify | 2 |
| `src/components/domain/iam/role-filter-permissions.tsx` | Create | 2 |
| `src/components/domain/iam/role-editor.tsx` | Modify | 2 |
| `src/domains/inventory/types.ts` | Modify | 3 |
| `src/domains/inventory/__tests__/inventory.service.test.ts` | Modify (TDD) | 3 |
| `src/domains/inventory/inventory.service.ts` | Modify | 3 |
| `src/app/api/appointments/[id]/products/route.ts` | Modify | 3 |
| `src/hooks/inventory/use-appointment-products.ts` | Modify | 3 |
| `src/components/domain/inventory/AppointmentProductsSection.tsx` | Modify | 3 |
| `src/components/domain/scheduling/appointment-drawer.tsx` | Modify | 3 |

---

## Task 1: Bug — `view_all` rejeitado no save de cargo

**Files:**
- Modify: `src/domains/iam/role.schemas.ts`

- [ ] **Step 1: Adicionar `view_all` ao validActions**

Abrir `src/domains/iam/role.schemas.ts` e substituir a linha 4:

```typescript
const validActions = ['view', 'create', 'edit', 'delete', 'view_all'] as const
```

O arquivo completo fica:

```typescript
import { z } from 'zod'
import { NAV_REGISTRY } from '@/shared/permissions/nav-registry'

const validActions = ['view', 'create', 'edit', 'delete', 'view_all'] as const

export const permissionsSchema = z.record(
  z.string(),
  z.array(z.enum(validActions))
)

export const createRoleSchema = z.object({
  name: z.string().min(1).max(50),
  permissions: permissionsSchema,
})

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  permissions: permissionsSchema.optional(),
})
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/domains/iam/role.schemas.ts
git commit -m "fix(iam): adiciona view_all ao validActions — permissão 'ver todos' agora salva corretamente"
```

---

## Task 2: Nav Registry — campo `filterLabel`

**Files:**
- Modify: `src/shared/permissions/nav-registry.ts`

- [ ] **Step 1: Adicionar `filterLabel` ao tipo `NavSection` e à seção `agenda`**

Substituir o conteúdo completo de `src/shared/permissions/nav-registry.ts`:

```typescript
export type NavAction = 'view' | 'create' | 'edit' | 'delete' | 'view_all'

export type NavSection = {
  key: string
  label: string
  description: string
  icon: string
  href: string
  actions: NavAction[]
  filterLabel?: string
  defaultPermissions: {
    MANAGER: NavAction[]
    PROFESSIONAL: NavAction[]
    RECEPTIONIST: NavAction[]
  }
}

export const NAV_REGISTRY: NavSection[] = [
  {
    key: 'agenda',
    label: 'Agenda',
    description: 'Atendimentos e encaixes',
    icon: 'CalendarDays',
    href: '/agenda',
    actions: ['view', 'create', 'edit', 'delete', 'view_all'],
    filterLabel: 'Ver atendimentos de outros profissionais',
    defaultPermissions: {
      MANAGER:      ['view', 'create', 'edit', 'delete', 'view_all'],
      PROFESSIONAL: ['view', 'create'],
      RECEPTIONIST: ['view', 'create', 'edit'],
    },
  },
  {
    key: 'servicos',
    label: 'Serviços',
    description: 'Serviços, Pacotes e Promoções',
    icon: 'Scissors',
    href: '/servicos',
    actions: ['view', 'create', 'edit', 'delete'],
    defaultPermissions: {
      MANAGER:      ['view', 'create', 'edit', 'delete'],
      PROFESSIONAL: ['view'],
      RECEPTIONIST: ['view'],
    },
  },
  {
    key: 'produtos',
    label: 'Produtos',
    description: 'Catálogo e estoque',
    icon: 'ShoppingBag',
    href: '/produtos',
    actions: ['view', 'create', 'edit', 'delete'],
    defaultPermissions: {
      MANAGER:      ['view', 'create', 'edit', 'delete'],
      PROFESSIONAL: ['view'],
      RECEPTIONIST: [],
    },
  },
  {
    key: 'clientes',
    label: 'Clientes',
    description: 'CRM e recorrência',
    icon: 'Users',
    href: '/clientes',
    actions: ['view', 'create', 'edit', 'delete'],
    defaultPermissions: {
      MANAGER:      ['view', 'create', 'edit'],
      PROFESSIONAL: ['view'],
      RECEPTIONIST: ['view', 'create', 'edit'],
    },
  },
  {
    key: 'financeiro',
    label: 'Financeiro',
    description: 'Receitas e caixa',
    icon: 'CreditCard',
    href: '/financeiro',
    actions: ['view', 'create', 'edit', 'delete'],
    defaultPermissions: {
      MANAGER:      ['view', 'create', 'edit'],
      PROFESSIONAL: [],
      RECEPTIONIST: [],
    },
  },
  {
    key: 'relatorios',
    label: 'Relatórios',
    description: 'Análises e exportações',
    icon: 'BarChart2',
    href: '/relatorios',
    actions: ['view'],
    defaultPermissions: {
      MANAGER:      ['view'],
      PROFESSIONAL: [],
      RECEPTIONIST: [],
    },
  },
  {
    key: 'equipe',
    label: 'Equipe',
    description: 'Usuários e permissões',
    icon: 'UserCog',
    href: '/equipe',
    actions: ['view', 'create', 'edit', 'delete'],
    defaultPermissions: {
      MANAGER:      ['view'],
      PROFESSIONAL: [],
      RECEPTIONIST: [],
    },
  },
  {
    key: 'configuracoes',
    label: 'Config.',
    description: 'Configurações',
    icon: 'Settings',
    href: '/configuracoes',
    actions: ['view', 'edit'],
    defaultPermissions: {
      MANAGER:      ['view', 'edit'],
      PROFESSIONAL: [],
      RECEPTIONIST: [],
    },
  },
]

export function buildOwnerPermissions(): Record<string, string[]> {
  return Object.fromEntries(
    NAV_REGISTRY.map((s) => [s.key, [...s.actions]])
  )
}

export function buildDefaultRolePermissions(
  preset: 'MANAGER' | 'PROFESSIONAL' | 'RECEPTIONIST'
): Record<string, string[]> {
  return Object.fromEntries(
    NAV_REGISTRY.map((s) => [s.key, [...s.defaultPermissions[preset]]])
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/permissions/nav-registry.ts
git commit -m "feat(iam): adiciona filterLabel ao NavSection — campo para permissões de filtro por tela"
```

---

## Task 3: RolePermissionMatrix — remover coluna `view_all`

**Files:**
- Modify: `src/components/domain/iam/role-permission-matrix.tsx`

- [ ] **Step 1: Remover `view_all` de `ALL_ACTIONS` e `ACTION_LABELS`**

Substituir o conteúdo completo de `src/components/domain/iam/role-permission-matrix.tsx`:

```typescript
'use client'

import { Checkbox } from '@/components/ui/checkbox'
import type { NavSection, NavAction } from '@/shared/permissions/nav-registry'

type Props = {
  sections: NavSection[]
  permissions: Record<string, string[]>
  onChange: (next: Record<string, string[]>) => void
  disabled?: boolean
}

const ACTION_LABELS: Record<NavAction, string> = {
  view:     'Visualizar',
  create:   'Criar',
  edit:     'Editar',
  delete:   'Excluir',
  view_all: 'Ver todos',
}

const ALL_ACTIONS: NavAction[] = ['view', 'create', 'edit', 'delete']

export function RolePermissionMatrix({ sections, permissions, onChange, disabled }: Props) {
  function toggle(sectionKey: string, action: NavAction, checked: boolean) {
    const current = permissions[sectionKey] ?? []
    let next: string[]

    if (action === 'view' && !checked) {
      next = []
    } else if (action !== 'view' && checked) {
      next = [...new Set([...current, 'view', action])]
    } else if (checked) {
      next = [...new Set([...current, action])]
    } else {
      next = current.filter((a) => a !== action)
    }

    onChange({ ...permissions, [sectionKey]: next })
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="pb-2 text-left font-medium text-slate-500">Tela</th>
            {ALL_ACTIONS.map((action) => (
              <th key={action} className="pb-2 text-center font-medium text-slate-500 w-24">
                {ACTION_LABELS[action]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sections.map((section) => {
            const sectionActions = permissions[section.key] ?? []
            return (
              <tr key={section.key} className="border-b border-slate-50">
                <td className="py-3 font-medium text-slate-800">{section.label}</td>
                {ALL_ACTIONS.map((action) => {
                  const exists = section.actions.includes(action)
                  const checked = sectionActions.includes(action)
                  if (!exists) {
                    return <td key={action} className="py-3 text-center text-slate-300">–</td>
                  }
                  return (
                    <td key={action} className="py-3 text-center">
                      <Checkbox
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={(v) => toggle(section.key, action, Boolean(v))}
                      />
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/domain/iam/role-permission-matrix.tsx
git commit -m "feat(iam): remove coluna view_all da tabela de permissões por tela"
```

---

## Task 4: RoleFilterPermissions — novo componente

**Files:**
- Create: `src/components/domain/iam/role-filter-permissions.tsx`

- [ ] **Step 1: Criar o componente**

```typescript
'use client'

import { Checkbox } from '@/components/ui/checkbox'
import type { NavSection } from '@/shared/permissions/nav-registry'

type Props = {
  sections: NavSection[]
  permissions: Record<string, string[]>
  onChange: (next: Record<string, string[]>) => void
  disabled?: boolean
}

export function RoleFilterPermissions({ sections, permissions, onChange, disabled }: Props) {
  const filterSections = sections.filter(
    (s) => s.filterLabel && s.actions.includes('view_all'),
  )

  if (filterSections.length === 0) return null

  function toggle(sectionKey: string, checked: boolean) {
    const current = permissions[sectionKey] ?? []
    const next = checked
      ? [...new Set([...current, 'view_all'])]
      : current.filter((a) => a !== 'view_all')
    onChange({ ...permissions, [sectionKey]: next })
  }

  return (
    <div className="space-y-2">
      {filterSections.map((section) => {
        const checked = (permissions[section.key] ?? []).includes('view_all')
        return (
          <div key={section.key} className="flex items-center gap-3">
            <Checkbox
              checked={checked}
              disabled={disabled}
              onCheckedChange={(v) => toggle(section.key, Boolean(v))}
            />
            <span className="text-sm text-slate-700">
              {section.filterLabel}
              <span className="ml-1 text-slate-400">— {section.label}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/domain/iam/role-filter-permissions.tsx
git commit -m "feat(iam): cria RoleFilterPermissions — seção de permissões de filtro com label contextual"
```

---

## Task 5: RoleEditor — adicionar seção "Permissões de filtro"

**Files:**
- Modify: `src/components/domain/iam/role-editor.tsx`

- [ ] **Step 1: Importar e renderizar RoleFilterPermissions**

Substituir o conteúdo completo de `src/components/domain/iam/role-editor.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RolePermissionMatrix } from './role-permission-matrix'
import { RoleFilterPermissions } from './role-filter-permissions'
import { useUpdateRole, type Role } from '@/hooks/iam/use-roles'
import type { NavSection } from '@/shared/permissions/nav-registry'

type Props = {
  role: Role
  sections: NavSection[]
  onCancel: () => void
}

export function RoleEditor({ role, sections, onCancel }: Props) {
  const [name, setName] = useState(role.name)
  const [permissions, setPermissions] = useState<Record<string, string[]>>(role.permissions)
  const updateRole = useUpdateRole()

  function handleSave() {
    updateRole.mutate(
      { id: role.id, name, permissions },
      {
        onSuccess: () => {
          toast.success('Cargo atualizado')
          onCancel()
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro ao salvar'),
      },
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Label>Nome do cargo</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          disabled={updateRole.isPending}
        />
      </div>

      <div>
        <p className="mb-3 text-sm font-medium text-slate-700">Permissões por tela</p>
        <RolePermissionMatrix
          sections={sections}
          permissions={permissions}
          onChange={setPermissions}
          disabled={updateRole.isPending}
        />
      </div>

      {sections.some((s) => s.filterLabel) && (
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

      <div className="flex gap-2 justify-end pt-2">
        <Button variant="outline" onClick={onCancel} disabled={updateRole.isPending}>
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          disabled={!name.trim() || updateRole.isPending}
          className="bg-slate-950 text-white hover:bg-slate-800"
        >
          {updateRole.isPending ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/iam/role-editor.tsx
git commit -m "feat(iam): adiciona seção Permissões de filtro no editor de cargo"
```

---

## Task 6: types.ts — `stockAction` no schema de produtos do atendimento

**Files:**
- Modify: `src/domains/inventory/types.ts`

- [ ] **Step 1: Estender `appointmentProductsSchema`**

Em `src/domains/inventory/types.ts`, substituir o bloco do schema (linhas 38–44):

```typescript
export const appointmentProductsSchema = z.object({
  products: z.array(z.object({
    productId: z.string().cuid(),
    quantity: z.number().int().min(1),
  })),
  stockAction: z.enum(['deduct', 'restore', 'none']).default('none'),
})
export type AppointmentProductsInput = z.infer<typeof appointmentProductsSchema>
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/inventory/types.ts
git commit -m "feat(inventory): adiciona stockAction ao appointmentProductsSchema"
```

---

## Task 7: TDD — testes para `updateCompletedAppointmentProducts`

**Files:**
- Modify: `src/domains/inventory/__tests__/inventory.service.test.ts`

- [ ] **Step 1: Adicionar helper local e describe ao arquivo de teste**

Adicionar ao final de `src/domains/inventory/__tests__/inventory.service.test.ts`:

```typescript
// Helper local para o describe abaixo
function makeApptProduct(productId: string, quantity: number) {
  return {
    id: `appt-${productId}`,
    tenantId: 't1',
    appointmentId: 'appt1',
    productId,
    quantity,
    product: makeProduct({ id: productId }),
  }
}

describe('updateCompletedAppointmentProducts', () => {
  it('deduct: decrementa a diferença para produtos adicionados ou com mais quantidade', async () => {
    vi.mocked(productRepository.getAppointmentProducts)
      .mockResolvedValueOnce([makeApptProduct('p1', 2)] as any)
      .mockResolvedValueOnce([] as any)
    vi.mocked(productRepository.decrementStock).mockResolvedValue({} as any)
    vi.mocked(stockRepository.create).mockResolvedValue({} as any)
    vi.mocked(productRepository.saveAppointmentProducts).mockResolvedValue(undefined as any)

    await service.updateCompletedAppointmentProducts(
      't1', 'appt1',
      [{ productId: 'p1', quantity: 3 }, { productId: 'p2', quantity: 1 }],
      'deduct', 'u1',
    )

    expect(productRepository.decrementStock).toHaveBeenCalledWith('t1', 'p1', 1)
    expect(productRepository.decrementStock).toHaveBeenCalledWith('t1', 'p2', 1)
    expect(productRepository.incrementStock).not.toHaveBeenCalled()
  })

  it('deduct: não toca em produtos com quantidade igual ou menor', async () => {
    vi.mocked(productRepository.getAppointmentProducts)
      .mockResolvedValueOnce([makeApptProduct('p1', 5)] as any)
      .mockResolvedValueOnce([] as any)
    vi.mocked(productRepository.saveAppointmentProducts).mockResolvedValue(undefined as any)

    await service.updateCompletedAppointmentProducts(
      't1', 'appt1',
      [{ productId: 'p1', quantity: 3 }],
      'deduct', 'u1',
    )

    expect(productRepository.decrementStock).not.toHaveBeenCalled()
  })

  it('restore: incrementa a diferença para produtos removidos ou com menos quantidade', async () => {
    vi.mocked(productRepository.getAppointmentProducts)
      .mockResolvedValueOnce([makeApptProduct('p1', 3), makeApptProduct('p2', 1)] as any)
      .mockResolvedValueOnce([] as any)
    vi.mocked(productRepository.incrementStock).mockResolvedValue({} as any)
    vi.mocked(stockRepository.create).mockResolvedValue({} as any)
    vi.mocked(productRepository.saveAppointmentProducts).mockResolvedValue(undefined as any)

    await service.updateCompletedAppointmentProducts(
      't1', 'appt1',
      [{ productId: 'p1', quantity: 2 }],
      'restore', 'u1',
    )

    expect(productRepository.incrementStock).toHaveBeenCalledWith('t1', 'p1', 1)
    expect(productRepository.incrementStock).toHaveBeenCalledWith('t1', 'p2', 1)
    expect(productRepository.decrementStock).not.toHaveBeenCalled()
  })

  it('restore: não toca em produtos com quantidade igual ou maior', async () => {
    vi.mocked(productRepository.getAppointmentProducts)
      .mockResolvedValueOnce([makeApptProduct('p1', 2)] as any)
      .mockResolvedValueOnce([] as any)
    vi.mocked(productRepository.saveAppointmentProducts).mockResolvedValue(undefined as any)

    await service.updateCompletedAppointmentProducts(
      't1', 'appt1',
      [{ productId: 'p1', quantity: 5 }],
      'restore', 'u1',
    )

    expect(productRepository.incrementStock).not.toHaveBeenCalled()
  })

  it('none: salva lista sem tocar estoque', async () => {
    vi.mocked(productRepository.getAppointmentProducts)
      .mockResolvedValueOnce([makeApptProduct('p1', 2)] as any)
      .mockResolvedValueOnce([] as any)
    vi.mocked(productRepository.saveAppointmentProducts).mockResolvedValue(undefined as any)

    await service.updateCompletedAppointmentProducts(
      't1', 'appt1',
      [{ productId: 'p1', quantity: 99 }],
      'none', 'u1',
    )

    expect(productRepository.decrementStock).not.toHaveBeenCalled()
    expect(productRepository.incrementStock).not.toHaveBeenCalled()
    expect(productRepository.saveAppointmentProducts).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Executar testes para confirmar que falham**

```bash
npx vitest run src/domains/inventory/__tests__/inventory.service.test.ts
```

Esperado: `FAIL` — `service.updateCompletedAppointmentProducts is not a function`.

---

## Task 8: Service — implementar `updateCompletedAppointmentProducts`

**Files:**
- Modify: `src/domains/inventory/inventory.service.ts`

- [ ] **Step 1: Adicionar método ao InventoryService**

Em `src/domains/inventory/inventory.service.ts`, adicionar o método antes do fechamento da classe (antes de `async listMovements`):

```typescript
  async updateCompletedAppointmentProducts(
    tenantId: string,
    appointmentId: string,
    newProducts: Array<{ productId: string; quantity: number }>,
    stockAction: 'deduct' | 'restore' | 'none',
    createdByUserId: string,
  ) {
    const oldProducts = await productRepository.getAppointmentProducts(tenantId, appointmentId)

    const oldMap = new Map(oldProducts.map((p) => [p.productId, p.quantity]))
    const newMap = new Map(newProducts.map((p) => [p.productId, p.quantity]))

    if (stockAction === 'deduct') {
      for (const [pid, newQty] of newMap) {
        const oldQty = oldMap.get(pid) ?? 0
        const diff = newQty - oldQty
        if (diff > 0) {
          await productRepository.decrementStock(tenantId, pid, diff)
          await stockRepository.create(tenantId, {
            productId: pid,
            type: 'ADJUSTMENT',
            quantity: -diff,
            appointmentId,
            createdByUserId,
          })
        }
      }
    }

    if (stockAction === 'restore') {
      for (const [pid, oldQty] of oldMap) {
        const newQty = newMap.get(pid) ?? 0
        const diff = oldQty - newQty
        if (diff > 0) {
          await productRepository.incrementStock(tenantId, pid, diff)
          await stockRepository.create(tenantId, {
            productId: pid,
            type: 'ADJUSTMENT',
            quantity: diff,
            appointmentId,
            createdByUserId,
          })
        }
      }
    }

    await productRepository.saveAppointmentProducts(tenantId, appointmentId, newProducts)
    return productRepository.getAppointmentProducts(tenantId, appointmentId)
  }
```

- [ ] **Step 2: Executar testes para confirmar que passam**

```bash
npx vitest run src/domains/inventory/__tests__/inventory.service.test.ts
```

Esperado: todos os testes do `describe('updateCompletedAppointmentProducts', ...)` passando.

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 4: Commit**

```bash
git add src/domains/inventory/inventory.service.ts src/domains/inventory/__tests__/inventory.service.test.ts
git commit -m "feat(inventory): adiciona updateCompletedAppointmentProducts com lógica de diff de estoque"
```

---

## Task 9: API Route — rotear PATCH conforme status do atendimento

**Files:**
- Modify: `src/app/api/appointments/[id]/products/route.ts`

- [ ] **Step 1: Adicionar import do Prisma e lógica de roteamento**

Substituir o conteúdo completo de `src/app/api/appointments/[id]/products/route.ts`:

```typescript
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { ensurePermission } from '@/shared/auth/permissions'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { inventoryService } from '@/domains/inventory/inventory.service'
import { appointmentProductsSchema } from '@/domains/inventory/types'
import { prisma } from '@/shared/database/prisma'
import { NotFoundError } from '@/shared/errors'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, 'produtos', 'view')
    const { id } = await params
    const result = await inventoryService.getAppointmentProducts(session.tenantId, id)
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, 'produtos', 'edit')
    const { id } = await params
    const input = await validateInput(request, appointmentProductsSchema)

    const appointment = await prisma.appointment.findFirst({
      where: { id, tenantId: session.tenantId },
      select: { status: true },
    })
    if (!appointment) throw new NotFoundError('Atendimento')

    if (appointment.status === 'COMPLETED') {
      const result = await inventoryService.updateCompletedAppointmentProducts(
        session.tenantId,
        id,
        input.products,
        input.stockAction,
        session.userId,
      )
      return Response.json(result)
    }

    const result = await inventoryService.finalizeAppointmentProducts(
      session.tenantId,
      id,
      input,
      session.userId,
    )
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/appointments/[id]/products/route.ts
git commit -m "feat(inventory): PATCH de produtos do atendimento roteia por status — COMPLETED usa diff de estoque"
```

---

## Task 10: Hook — adicionar `stockAction` ao tipo de input

**Files:**
- Modify: `src/hooks/inventory/use-appointment-products.ts`

- [ ] **Step 1: Atualizar o tipo `AppointmentProductsInput`**

Substituir o conteúdo completo de `src/hooks/inventory/use-appointment-products.ts`:

```typescript
// src/hooks/inventory/use-appointment-products.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export type AppointmentProduct = {
  productId: string
  quantity: number
  product: { id: string; name: string; salePrice: string }
}

export type AppointmentProductsInput = {
  products: Array<{ productId: string; quantity: number }>
  stockAction?: 'deduct' | 'restore' | 'none'
}

async function getAppointmentProducts(appointmentId: string): Promise<AppointmentProduct[]> {
  const res = await fetch(`/api/appointments/${appointmentId}/products`)
  if (!res.ok) throw new Error('Falha ao buscar produtos do agendamento')
  return res.json()
}

async function saveAppointmentProducts(
  appointmentId: string,
  input: AppointmentProductsInput,
): Promise<AppointmentProduct[]> {
  const res = await fetch(`/api/appointments/${appointmentId}/products`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      (err as { message?: string }).message ?? 'Falha ao salvar produtos do agendamento',
    )
  }
  return res.json()
}

export function useAppointmentProducts(appointmentId?: string) {
  return useQuery({
    queryKey: ['appointment-products', appointmentId],
    queryFn: () => getAppointmentProducts(appointmentId!),
    enabled: !!appointmentId,
    staleTime: 30 * 1000,
  })
}

export function useSaveAppointmentProducts(appointmentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: AppointmentProductsInput) => saveAppointmentProducts(appointmentId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment-products', appointmentId] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] })
    },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/inventory/use-appointment-products.ts
git commit -m "feat(inventory): adiciona stockAction opcional ao AppointmentProductsInput do hook"
```

---

## Task 11: AppointmentProductsSection — dialog de seleção de estoque

**Files:**
- Modify: `src/components/domain/inventory/AppointmentProductsSection.tsx`

- [ ] **Step 1: Reescrever o componente com suporte a `isCompleted` e dialog**

Substituir o conteúdo completo de `src/components/domain/inventory/AppointmentProductsSection.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Minus, Plus, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useAppointmentProducts,
  useSaveAppointmentProducts,
} from '@/hooks/inventory/use-appointment-products'
import { useServiceTemplate } from '@/hooks/inventory/use-service-template'
import { useProducts } from '@/hooks/inventory/use-products'

type ProductItem = { productId: string; quantity: number; name: string }

type Props = {
  appointmentId: string
  serviceId: string
  defaultExpanded?: boolean
  isCompleted?: boolean
}

const STOCK_OPTIONS = [
  {
    value: 'none' as const,
    label: 'Deixar como está',
    desc: 'Apenas atualiza o registro, sem alterar o estoque.',
  },
  {
    value: 'deduct' as const,
    label: 'Retirar do estoque',
    desc: 'Produtos adicionados ou com mais quantidade serão descontados do estoque.',
  },
  {
    value: 'restore' as const,
    label: 'Repor no estoque',
    desc: 'Produtos removidos ou com menos quantidade serão devolvidos ao estoque.',
  },
]

export function AppointmentProductsSection({
  appointmentId,
  serviceId,
  defaultExpanded = false,
  isCompleted = false,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [items, setItems] = useState<ProductItem[]>([])
  const [initialized, setInitialized] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [stockAction, setStockAction] = useState<'deduct' | 'restore' | 'none'>('none')

  const { data: savedProducts } = useAppointmentProducts(expanded ? appointmentId : undefined)
  const { data: template } = useServiceTemplate(
    expanded && !initialized ? serviceId : undefined,
  )
  const { data: productsData } = useProducts({ pageSize: 100 })
  const saveProducts = useSaveAppointmentProducts(appointmentId)

  const allProducts: Array<{ id: string; name: string }> = productsData?.data ?? []

  useEffect(() => {
    if (!expanded || initialized) return
    if (savedProducts !== undefined) {
      const saved = Array.isArray(savedProducts) ? savedProducts : []
      if (saved.length > 0) {
        setItems(
          saved.map(
            (p: { productId: string; quantity: number; product: { name: string } }) => ({
              productId: p.productId,
              quantity: p.quantity,
              name: p.product.name,
            }),
          ),
        )
        setInitialized(true)
      } else if (template !== undefined) {
        const templateItems = Array.isArray(template) ? template : []
        setItems(
          templateItems.map(
            (t: { productId: string; quantity: number; product: { name: string } }) => ({
              productId: t.productId,
              quantity: t.quantity,
              name: t.product.name,
            }),
          ),
        )
        setInitialized(true)
      }
    }
  }, [expanded, initialized, savedProducts, template])

  function handleExpand() {
    setExpanded((prev) => !prev)
    if (!expanded) setInitialized(false)
  }

  function updateQuantity(productId: string, delta: number) {
    setItems((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? { ...item, quantity: Math.max(1, item.quantity + delta) }
          : item,
      ),
    )
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((i) => i.productId !== productId))
  }

  function addProduct(productId: string) {
    if (items.find((i) => i.productId === productId)) return
    const product = allProducts.find((p) => p.id === productId)
    if (!product) return
    setItems((prev) => [...prev, { productId, quantity: 1, name: product.name }])
  }

  async function doSave(action: 'deduct' | 'restore' | 'none') {
    try {
      await saveProducts.mutateAsync({
        products: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        stockAction: action,
      })
      toast.success('Produtos do atendimento salvos')
      setDialogOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar produtos')
    }
  }

  async function handleSave() {
    if (isCompleted) {
      setStockAction('none')
      setDialogOpen(true)
      return
    }
    await doSave('none')
  }

  const availableProducts = allProducts.filter((p) => !items.find((i) => i.productId === p.id))

  return (
    <>
      <div className="rounded-xl border border-border/50">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-left"
          onClick={handleExpand}
        >
          <span>Produtos Utilizados</span>
          {expanded ? (
            <ChevronUp className="size-4 shrink-0" />
          ) : (
            <ChevronDown className="size-4 shrink-0" />
          )}
        </button>

        {expanded && (
          <div className="border-t border-border/50 px-4 pb-4 pt-3 space-y-3">
            <p className="text-xs text-muted-foreground">
              Opcional — pré-preenchido pelo template do serviço
            </p>

            {items.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                Nenhum produto adicionado
              </p>
            )}

            {items.map((item) => (
              <div key={item.productId} className="flex items-center gap-2">
                <span className="flex-1 text-sm truncate">{item.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => updateQuantity(item.productId, -1)}
                >
                  <Minus className="size-3" />
                </Button>
                <span className="w-6 text-center text-sm tabular-nums">{item.quantity}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => updateQuantity(item.productId, 1)}
                >
                  <Plus className="size-3" />
                </Button>
                <button
                  type="button"
                  className="text-destructive hover:text-destructive/80 text-sm px-1"
                  onClick={() => removeItem(item.productId)}
                  aria-label="Remover produto"
                >
                  ×
                </button>
              </div>
            ))}

            {availableProducts.length > 0 && (
              <Select onValueChange={addProduct}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="+ Adicionar produto" />
                </SelectTrigger>
                <SelectContent>
                  {availableProducts.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button
              size="sm"
              className="w-full"
              onClick={handleSave}
              disabled={saveProducts.isPending}
            >
              <Save className="size-3.5 mr-1.5" />
              {saveProducts.isPending ? 'Salvando...' : 'Salvar consumo'}
            </Button>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && setDialogOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Atualizar estoque?</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            {STOCK_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`w-full text-left rounded-lg border p-3 transition ${
                  stockAction === opt.value
                    ? 'border-slate-950 bg-slate-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
                onClick={() => setStockAction(opt.value)}
              >
                <p className="text-sm font-medium text-slate-900">{opt.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => doSave(stockAction)}
              disabled={saveProducts.isPending}
              className="bg-slate-950 text-white hover:bg-slate-800"
            >
              {saveProducts.isPending ? 'Salvando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/inventory/AppointmentProductsSection.tsx
git commit -m "feat(inventory): dialog de ajuste de estoque ao salvar produtos de atendimento concluído"
```

---

## Task 12: AppointmentDrawer — passar `isCompleted` para a seção de produtos

**Files:**
- Modify: `src/components/domain/scheduling/appointment-drawer.tsx`

- [ ] **Step 1: Passar a prop `isCompleted`**

Localizar em `src/components/domain/scheduling/appointment-drawer.tsx` o trecho onde `AppointmentProductsSection` é renderizado (próximo à linha 160):

```tsx
<AppointmentProductsSection
  appointmentId={appointment.id}
  serviceId={appointment.serviceId}
  defaultExpanded={isActive}
/>
```

Substituir por:

```tsx
<AppointmentProductsSection
  appointmentId={appointment.id}
  serviceId={appointment.serviceId}
  defaultExpanded={isActive}
  isCompleted={!isActive}
/>
```

- [ ] **Step 2: Rodar todos os testes do domínio de inventário**

```bash
npx vitest run src/domains/inventory/
```

Esperado: todos passando.

- [ ] **Step 3: Verificar TypeScript final**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 4: Commit**

```bash
git add src/components/domain/scheduling/appointment-drawer.tsx
git commit -m "feat(scheduling): passa isCompleted para AppointmentProductsSection"
```

---

## Verificação final

Após todas as tasks, rodar:

```bash
npx vitest run
npx tsc --noEmit
```

Ambos devem passar sem erros. Em seguida, abrir PR para `main`.
