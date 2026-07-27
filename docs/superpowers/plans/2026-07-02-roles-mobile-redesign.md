# Roles Mobile Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar a tela de Cargos e permissões para funcionar corretamente no mobile: navegação em 2 passos, matrix de permissões responsiva e defaults do cargo Profissional expandidos.

**Architecture:** `RolesManager` ganha estado `mobileView: 'list' | 'editor'` que controla visibilidade via classes Tailwind; `RolePermissionMatrix` exibe chips por seção no mobile e a tabela existente no desktop via `lg:hidden / hidden lg:block`; `nav-registry.ts` recebe defaults PROFESSIONAL expandidos; script em `scripts/` atualiza roles existentes com `isDefault: true` no banco.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, TailwindCSS, Prisma (Json field), vitest, `npx tsx` para scripts.

## Global Constraints

- Sem `any` no TypeScript — strict mode ativo
- Sem alteração de schema Prisma (apenas data mutation via script)
- Layout mobile-first: classes base → `lg:` para desktop
- `npx tsc --noEmit` e `npx vitest run` devem passar ao fim de cada task
- Scripts seguem o padrão de `scripts/migrate-user-roles.ts`: dotenv + PrismaPg adapter direto

---

## Mapa de arquivos

| Arquivo | Operação | Responsabilidade |
|---------|----------|-----------------|
| `src/shared/permissions/nav-registry.ts` | editar | Atualizar `defaultPermissions.PROFESSIONAL` de todas as seções |
| `scripts/update-professional-permissions.ts` | criar | Script one-shot que atualiza roles existentes no banco |
| `src/components/domain/iam/role-permission-matrix.tsx` | editar | Layout dual: chips (mobile) + tabela (desktop) |
| `src/components/domain/iam/roles-manager.tsx` | editar | Estado `mobileView` + navegação 2 passos |

---

### Task 1: Atualizar defaults do PROFESSIONAL em nav-registry.ts

**Files:**
- Modify: `src/shared/permissions/nav-registry.ts`

**Interfaces:**
- Produces: `buildDefaultRolePermissions('PROFESSIONAL')` retorna permissões completas por seção

- [ ] **Step 1: Atualizar o preset PROFESSIONAL em cada seção do NAV_REGISTRY**

Em `src/shared/permissions/nav-registry.ts`, alterar o campo `defaultPermissions.PROFESSIONAL` de cada objeto do array. O arquivo inteiro fica assim (somente os blocos `PROFESSIONAL` mudam):

```ts
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
      PROFESSIONAL: ['view', 'create', 'edit', 'delete', 'view_all'],
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
      PROFESSIONAL: ['view', 'create', 'edit', 'delete'],
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
      PROFESSIONAL: ['view', 'create', 'edit', 'delete'],
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
      PROFESSIONAL: ['view', 'create', 'edit'],
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
      PROFESSIONAL: ['view', 'create', 'edit'],
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
      PROFESSIONAL: ['view'],
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
      PROFESSIONAL: ['view'],
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
      PROFESSIONAL: ['view', 'edit'],
      RECEPTIONIST: [],
    },
  },
]
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 erros.

- [ ] **Step 3: Commit**

```bash
git add src/shared/permissions/nav-registry.ts
git commit -m "feat(iam): expande defaults do cargo Profissional para permissões completas"
```

---

### Task 2: Script de data migration para tenants existentes

**Files:**
- Create: `scripts/update-professional-permissions.ts`

**Interfaces:**
- Consumes: Banco via PrismaClient direto (padrão dos scripts do projeto)
- Produces: Roles com `name='Profissional'` e `isDefault=true` com permissions atualizadas

- [ ] **Step 1: Criar o script**

Criar `scripts/update-professional-permissions.ts`:

```ts
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter } as any)

const NEW_PROFESSIONAL_PERMISSIONS = {
  agenda:        ['view', 'create', 'edit', 'delete', 'view_all'],
  servicos:      ['view', 'create', 'edit', 'delete'],
  produtos:      ['view', 'create', 'edit', 'delete'],
  clientes:      ['view', 'create', 'edit'],
  financeiro:    ['view', 'create', 'edit'],
  relatorios:    ['view'],
  equipe:        ['view'],
  configuracoes: ['view', 'edit'],
}

async function main() {
  const result = await prisma.role.updateMany({
    where: {
      name: 'Profissional',
      isDefault: true,
    },
    data: {
      permissions: NEW_PROFESSIONAL_PERMISSIONS,
    },
  })

  console.log(`${result.count} role(s) atualizados`)
}

main()
  .catch((err) => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 erros.

- [ ] **Step 3: Executar contra o banco de desenvolvimento**

```bash
npx tsx scripts/update-professional-permissions.ts
```

Expected: `N role(s) atualizados` (N ≥ 1 se o tenant de dev tiver o role semeado).

- [ ] **Step 4: Commit**

```bash
git add scripts/update-professional-permissions.ts
git commit -m "feat(iam): script de migration para atualizar permissões do Profissional existente"
```

---

### Task 3: RolePermissionMatrix responsiva — chips mobile + tabela desktop

**Files:**
- Modify: `src/components/domain/iam/role-permission-matrix.tsx`

**Interfaces:**
- Consumes: mesmas props — sem mudança de interface externa
- Produces: mesmo comportamento de toggle — sem mudança de interface externa

- [ ] **Step 1: Reescrever o componente com layout dual**

Substituir o conteúdo completo de `src/components/domain/iam/role-permission-matrix.tsx`:

```tsx
'use client'

import { Check, X } from 'lucide-react'
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
    <>
      {/* Mobile: chips por seção */}
      <div className="space-y-4 lg:hidden">
        {sections.map((section) => {
          const sectionActions = permissions[section.key] ?? []
          const availableActions = ALL_ACTIONS.filter((a) => section.actions.includes(a))
          return (
            <div key={section.key}>
              <p className="mb-2 text-sm font-medium text-slate-800">{section.label}</p>
              <div className="flex flex-wrap gap-2">
                {availableActions.map((action) => {
                  const checked = sectionActions.includes(action)
                  return (
                    <button
                      key={action}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggle(section.key, action, !checked)}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                        checked
                          ? 'border-primary/30 bg-primary/10 text-primary'
                          : 'border-slate-200 bg-slate-50 text-slate-400'
                      }`}
                    >
                      {checked ? <Check className="size-3" /> : <X className="size-3" />}
                      {ACTION_LABELS[action]}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Desktop: tabela existente */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="min-w-[560px] w-full text-sm">
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
    </>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 erros.

- [ ] **Step 3: Rodar testes**

```bash
npx vitest run
```

Expected: todos passando.

- [ ] **Step 4: Commit**

```bash
git add src/components/domain/iam/role-permission-matrix.tsx
git commit -m "feat(iam): matrix de permissões responsiva — chips no mobile, tabela no desktop"
```

---

### Task 4: Navegação mobile em 2 passos no RolesManager

**Files:**
- Modify: `src/components/domain/iam/roles-manager.tsx`

**Interfaces:**
- Consumes: `RoleEditor` prop `onCancel: () => void` — sem mudança de assinatura, mas agora o callback também chama `setMobileView('list')`
- Produces: estado `mobileView: 'list' | 'editor'` controla qual painel é visível no mobile

- [ ] **Step 1: Reescrever o componente com navegação mobile**

Substituir o conteúdo completo de `src/components/domain/iam/roles-manager.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { RoleEditor } from './role-editor'
import { RoleDeleteButton } from './role-delete-button'
import { useRoles, useCreateRole } from '@/hooks/iam/use-roles'
import { useNavSections } from '@/hooks/iam/use-nav-sections'
import type { NavSection } from '@/shared/permissions/nav-registry'

export function RolesManager() {
  const { data: roles, isLoading: loadingRoles } = useRoles()
  const { data: sections = [], isLoading: loadingSections } = useNavSections()
  const createRole = useCreateRole()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creatingNew, setCreatingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list')

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    createRole.mutate(
      { name: newName.trim(), permissions: {} },
      {
        onSuccess: (created) => {
          toast.success(`Cargo "${created.name}" criado`)
          setCreatingNew(false)
          setNewName('')
          setEditingId(created.id)
          setMobileView('editor')
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro ao criar cargo'),
      },
    )
  }

  const editingRole = roles?.find((r) => r.id === editingId)

  if (loadingRoles || loadingSections) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* Lista de cargos — visível no mobile apenas no step 'list' */}
      <div
        className={`w-full shrink-0 space-y-2 lg:block lg:w-56 ${
          mobileView === 'editor' ? 'hidden' : 'block'
        }`}
      >
        {roles?.map((role) => (
          <div
            key={role.id}
            className={`flex items-center justify-between rounded-xl border p-3 cursor-pointer transition ${
              editingId === role.id
                ? 'border-slate-950 bg-slate-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
            onClick={() => {
              setEditingId(role.id)
              setCreatingNew(false)
              setMobileView('editor')
            }}
          >
            <div>
              <p className="text-sm font-medium text-slate-900">{role.name}</p>
              <p className="text-xs text-slate-400">{role._count.users} usuário(s)</p>
            </div>
            <RoleDeleteButton
              roleId={role.id}
              roleName={role.name}
              userCount={role._count.users}
              onDeleted={() => {
                if (editingId === role.id) {
                  setEditingId(null)
                  setMobileView('list')
                }
              }}
            />
          </div>
        ))}

        {creatingNew ? (
          <form
            onSubmit={handleCreateSubmit}
            className="space-y-2 rounded-xl border border-slate-300 p-3"
          >
            <Label className="text-xs">Nome do cargo</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex: Esteticista"
              maxLength={50}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { setCreatingNew(false); setNewName('') }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!newName.trim() || createRole.isPending}
              >
                {createRole.isPending ? '...' : 'Criar'}
              </Button>
            </div>
          </form>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => { setCreatingNew(true); setEditingId(null) }}
          >
            <Plus className="size-3.5" />
            Novo cargo
          </Button>
        )}
      </div>

      {/* Painel de edição — visível no mobile apenas no step 'editor' */}
      <div
        className={`min-w-0 flex-1 lg:block ${
          mobileView === 'list' ? 'hidden' : 'block'
        }`}
      >
        {editingRole ? (
          <>
            {/* Botão voltar — apenas no mobile */}
            <button
              onClick={() => setMobileView('list')}
              className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 lg:hidden"
            >
              <ChevronLeft className="size-4" />
              Cargos
            </button>
            <RoleEditor
              key={editingRole.id}
              role={editingRole}
              sections={sections as NavSection[]}
              onCancel={() => {
                setEditingId(null)
                setMobileView('list')
              }}
            />
          </>
        ) : (
          // Estado vazio — oculto no mobile (nunca alcançável no fluxo normal)
          <div className="hidden h-40 items-center justify-center rounded-xl border border-dashed border-slate-200 lg:flex">
            <p className="text-sm text-slate-400">Selecione um cargo para editar</p>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 erros.

- [ ] **Step 3: Rodar testes**

```bash
npx vitest run
```

Expected: todos passando.

- [ ] **Step 4: Commit**

```bash
git add src/components/domain/iam/roles-manager.tsx
git commit -m "feat(iam): navegação mobile em 2 passos na tela de cargos"
```

- [ ] **Step 5: Abrir PR**

```bash
gh pr create \
  --base main \
  --title "feat(iam): redesenho mobile da tela de cargos e permissões" \
  --body "$(cat <<'EOF'
## Resumo
- Navegação em 2 passos no mobile: lista → editor com botão ← Cargos
- Matrix de permissões responsiva: chips pill no mobile, tabela existente no desktop
- Defaults do cargo Profissional expandidos para máximo de permissões operacionais
- Script `scripts/update-professional-permissions.ts` para atualizar roles existentes (`isDefault=true`)

## Como executar o script de migration
Após o deploy, executar uma vez no ambiente de produção:
\`\`\`bash
npx tsx scripts/update-professional-permissions.ts
\`\`\`

## Plano de teste
- [ ] Mobile (≤1024px): abrir Cargos → selecionar cargo → verificar step 2 com botão ← Cargos
- [ ] Mobile: chips de permissão funcionando (toggle liga/desliga, cor primary quando ativo)
- [ ] Mobile: Salvar/Cancelar no editor retorna para a lista
- [ ] Mobile: excluir cargo no step 1 não quebra estado
- [ ] Desktop (≥1024px): layout lateral + tabela inalterados
- [ ] Cargo Profissional novo (criar novo tenant): verificar que vem com permissões completas

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review

**Cobertura do spec:**
- ✅ Navegação mobile 2 passos → Task 4
- ✅ Botão `← Cargos` apenas no mobile (`lg:hidden`) → Task 4, Step 1
- ✅ Matrix responsiva — chips mobile + tabela desktop → Task 3
- ✅ PROFESSIONAL defaults expandidos → Task 1
- ✅ Script para tenants existentes (`isDefault=true`) → Task 2
- ✅ Desktop inalterado — `lg:` classes preservam layout atual → Tasks 3 e 4

**Placeholder scan:** nenhum TBD, TODO ou seção incompleta.

**Consistência de tipos:**
- `NavAction`, `NavSection` usados identicamente em Tasks 3 e 4
- `toggle(sectionKey, action, checked)` assinatura idêntica em ambos os layouts (Task 3)
- `mobileView: 'list' | 'editor'` declarado e consumido apenas em Task 4
- Props de `RoleEditor` inalteradas — `onCancel: () => void` em Task 4 bate com a definição existente
