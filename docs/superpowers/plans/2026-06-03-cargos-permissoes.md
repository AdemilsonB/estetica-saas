# Cargos e Permissões Dinâmicos — Plano de Implementação

> **Para agentes:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar task por task. Steps usam checkbox (`- [ ]`) para rastreamento.

**Goal:** Substituir as 4 roles hardcoded (OWNER/MANAGER/PROFESSIONAL/RECEPTIONIST) por um sistema dinâmico onde o dono do tenant cria e edita cargos com permissões granulares por tela.

**Architecture:** Tabela `Role` por tenant com `permissions: Json` como fonte de verdade. `getSessionContext` busca permissões do banco a cada request (sem ler do JWT), cacheando por `React.cache` no escopo do request. `NAV_REGISTRY` é o catálogo de todas as telas e ações, usado tanto pelo sidebar quanto pela UI de gerenciamento de cargos.

**Tech Stack:** Next.js 15 App Router, Prisma, Supabase Auth, Zod, TanStack Query, Shadcn UI, Vitest

---

## Mapa de Arquivos

### Novos arquivos
| Arquivo | Responsabilidade |
|---|---|
| `src/shared/permissions/nav-registry.ts` | Catálogo de seções do menu e ações disponíveis |
| `src/domains/iam/role.repository.ts` | CRUD de Role no banco, sempre filtrado por tenantId |
| `src/domains/iam/role.service.ts` | Regras: limite de plano, validação de permissões, guard de exclusão |
| `src/domains/iam/role.schemas.ts` | Zod schemas para input de criação e edição de cargo |
| `src/domains/iam/role.service.test.ts` | Testes unitários do RoleService |
| `src/domains/iam/role.repository.test.ts` | Testes do RoleRepository com prismaMock |
| `src/app/api/iam/roles/route.ts` | GET lista cargos / POST cria cargo |
| `src/app/api/iam/roles/[id]/route.ts` | PUT edita cargo / DELETE exclui cargo |
| `src/app/api/iam/nav-sections/route.ts` | GET seções do menu filtradas pelo plano do tenant |
| `src/hooks/iam/use-roles.ts` | useRoles, useCreateRole, useUpdateRole, useDeleteRole |
| `src/hooks/iam/use-nav-sections.ts` | useNavSections |
| `src/components/domain/iam/roles-manager.tsx` | Lista lateral de cargos |
| `src/components/domain/iam/role-editor.tsx` | Painel de edição de cargo (nome + matriz) |
| `src/components/domain/iam/role-permission-matrix.tsx` | Tabela de checkboxes com regras de pré-requisito |
| `src/components/domain/iam/role-delete-button.tsx` | Botão excluir com guard de usuários vinculados |
| `scripts/seed-plan-features.ts` | Seed de PlanFeatureConfig para todos os planos |
| `scripts/migrate-user-roles.ts` | Migração: preenche User.roleId para tenants existentes |

### Arquivos modificados
| Arquivo | O que muda |
|---|---|
| `prisma/schema.prisma` | +`Role`, +`PlanFeatureConfig`, +`User.roleId`, +`User.customRole` relation |
| `src/shared/types/auth.ts` | `SessionContext` com `isOwner` e `permissions: Record<string,string[]>` |
| `src/shared/auth/permissions.ts` | `ensurePermission(session, sectionKey, action)` — nova assinatura |
| `src/shared/auth/session.ts` | Lê permissões do banco (com fallback hardcoded enquanto migração não completa) |
| `src/domains/iam/iam.repository.ts` | `createTenantWithOwner` semeia 3 Roles padrão; `findAllUsers` inclui `roleName` |
| `src/domains/iam/iam.service.ts` | `createInvite` e `joinTenant` aceitam `roleId: string` |
| `src/app/api/iam/invites/route.ts` | Schema aceita `roleId` no lugar de `role: UserRole` enum |
| `src/app/api/iam/users/[userId]/route.ts` | `PATCH` aceita `roleId` no lugar de `role` |
| `src/hooks/use-current-user.ts` | Tipo `CurrentUser` com `isOwner` e `permissions: Record<string,string[]>` |
| `src/hooks/use-permissions.ts` | Remove ROLE_PERMISSIONS hardcoded; `can(sectionKey, action)` |
| `src/components/app/app-shell.tsx` | NAV_ITEMS vira dinâmico a partir do NAV_REGISTRY |
| `src/components/domain/iam/invite-member-modal.tsx` | Dropdown de cargos via `useRoles()`, envia `roleId` |
| `src/components/domain/iam/team-member-card.tsx` | Exibe `roleName` dinâmico; select carrega cargos do tenant |
| `src/app/(app)/configuracoes/page.tsx` | Adiciona aba "Cargos" (7ª aba, apenas OWNER) |
| `src/app/(app)/equipe/page.tsx` | Atualiza chamadas de `can()` para nova assinatura |
| `src/app/(app)/financeiro/page.tsx` | Atualiza `can()` |
| `src/app/(app)/financeiro/transacoes/page.tsx` | Atualiza `can()` |
| `src/app/(app)/configuracoes/page.tsx` | Atualiza `can()` |
| `src/app/(app)/relatorios/agendamentos/page.tsx` | Atualiza `can()` |
| `src/app/(app)/relatorios/financeiro/page.tsx` | Atualiza `can()` |
| `src/app/(app)/relatorios/clientes/page.tsx` | Atualiza `can()` |
| `src/app/(app)/relatorios/profissionais/page.tsx` | Atualiza `can()` |
| `src/components/domain/scheduling/agenda-day-view.tsx` | Atualiza `can()` |
| `src/components/domain/scheduling/create-appointment-modal.tsx` | Atualiza `can()` |
| `src/components/domain/crm/customer-list.tsx` | Atualiza `can()` |
| `src/shared/test/factories/user.factory.ts` | Adiciona `roleId: null` ao factory |

---

## PR 1 — Schema + Registry + Seed

### Task 1: NAV_REGISTRY — catálogo de telas e ações

**Files:**
- Create: `src/shared/permissions/nav-registry.ts`

- [ ] **Criar `src/shared/permissions/nav-registry.ts`**

```ts
export type NavAction = 'view' | 'create' | 'edit' | 'delete'

export type NavSection = {
  key: string
  label: string
  icon: string
  href: string
  actions: NavAction[]
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
    icon: 'CalendarDays',
    href: '/agenda',
    actions: ['view', 'create', 'edit', 'delete'],
    defaultPermissions: {
      MANAGER:      ['view', 'create', 'edit', 'delete'],
      PROFESSIONAL: ['view', 'create'],
      RECEPTIONIST: ['view', 'create', 'edit'],
    },
  },
  {
    key: 'servicos',
    label: 'Serviços',
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
    key: 'clientes',
    label: 'Clientes',
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

- [ ] **Commit**

```bash
git add src/shared/permissions/nav-registry.ts
git commit -m "feat(iam): adiciona NAV_REGISTRY como catálogo de telas e ações"
```

---

### Task 2: Prisma schema — novas tabelas e campo User.roleId

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Adicionar tabela `Role` ao schema** (antes do model `User`)

```prisma
model Role {
  id          String   @id @default(cuid())
  tenantId    String
  name        String
  isDefault   Boolean  @default(false)
  permissions Json     @default("{}")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  users  User[] @relation("UserCustomRole")

  @@unique([tenantId, name])
  @@index([tenantId])
}
```

- [ ] **Adicionar tabela `PlanFeatureConfig`** (após `Role`)

```prisma
model PlanFeatureConfig {
  id         String   @id @default(cuid())
  plan       PlanName
  sectionKey String
  enabled    Boolean  @default(true)
  updatedAt  DateTime @updatedAt

  @@unique([plan, sectionKey])
  @@index([plan])
}
```

- [ ] **Adicionar relação `Role[]` ao model `Tenant`** (após `invites TenantInvite[]`)

```prisma
  roles               Role[]
```

- [ ] **Adicionar campos ao model `User`** (após `permissions String[]`)

```prisma
  roleId     String?
  customRole Role?   @relation("UserCustomRole", fields: [roleId], references: [id])
```

- [ ] **Rodar migration**

```bash
npx prisma migrate dev --name add_role_and_plan_feature_config
```

Esperado: migration criada sem erros e `PrismaClient` regenerado.

- [ ] **Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(iam): adiciona tabelas Role e PlanFeatureConfig ao schema"
```

---

### Task 3: Seed de PlanFeatureConfig e atualização de createTenantWithOwner

**Files:**
- Create: `scripts/seed-plan-features.ts`
- Create: `scripts/migrate-user-roles.ts`
- Modify: `src/domains/iam/iam.repository.ts`

- [ ] **Criar `scripts/seed-plan-features.ts`**

```ts
import { PrismaClient, PlanName } from '@prisma/client'
import { NAV_REGISTRY } from '../src/shared/permissions/nav-registry'

const prisma = new PrismaClient()

async function main() {
  const plans = [PlanName.FREE, PlanName.STARTER, PlanName.PRO, PlanName.ENTERPRISE]

  for (const plan of plans) {
    for (const section of NAV_REGISTRY) {
      await prisma.planFeatureConfig.upsert({
        where: { plan_sectionKey: { plan, sectionKey: section.key } },
        update: {},
        create: { plan, sectionKey: section.key, enabled: true },
      })
    }
  }

  console.log('PlanFeatureConfig populado com sucesso.')
}

main().finally(() => prisma.$disconnect())
```

- [ ] **Criar `scripts/migrate-user-roles.ts`** — preenche `roleId` para usuários existentes

```ts
import { PrismaClient, UserRole } from '@prisma/client'

const prisma = new PrismaClient()

const ROLE_NAME_MAP: Record<string, string> = {
  [UserRole.MANAGER]:      'Gerente',
  [UserRole.PROFESSIONAL]: 'Profissional',
  [UserRole.RECEPTIONIST]: 'Recepcionista',
}

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true } })

  for (const tenant of tenants) {
    const roles = await prisma.role.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, name: true },
    })

    const roleByName = Object.fromEntries(roles.map((r) => [r.name, r.id]))

    const users = await prisma.user.findMany({
      where: { tenantId: tenant.id, role: { not: UserRole.OWNER } },
      select: { id: true, role: true },
    })

    for (const user of users) {
      const roleName = ROLE_NAME_MAP[user.role]
      const roleId = roleName ? roleByName[roleName] : undefined
      if (roleId) {
        await prisma.user.update({ where: { id: user.id }, data: { roleId } })
      }
    }
  }

  console.log('Migração de roleId concluída.')
}

main().finally(() => prisma.$disconnect())
```

- [ ] **Atualizar `src/domains/iam/iam.repository.ts` — `createTenantWithOwner` semeia 3 Roles padrão**

Adicionar import no topo do arquivo:

```ts
import { NAV_REGISTRY, buildDefaultRolePermissions } from '@/shared/permissions/nav-registry'
```

Dentro da transaction em `createTenantWithOwner`, após criar o `User`, adicionar:

```ts
await tx.role.createMany({
  data: (
    [
      { preset: 'MANAGER' as const,      name: 'Gerente' },
      { preset: 'PROFESSIONAL' as const, name: 'Profissional' },
      { preset: 'RECEPTIONIST' as const, name: 'Recepcionista' },
    ] as const
  ).map(({ preset, name }) => ({
    tenantId: tenant.id,
    name,
    isDefault: true,
    permissions: buildDefaultRolePermissions(preset),
  })),
})
```

- [ ] **Rodar seed e migration de dados**

```bash
npx ts-node --project tsconfig.json -e "require('./scripts/seed-plan-features.ts')"
npx ts-node --project tsconfig.json -e "require('./scripts/migrate-user-roles.ts')"
```

> Alternativamente adicionar ao `package.json` como scripts: `"seed:plan-features"` e `"migrate:user-roles"` e rodar com `npm run`.

- [ ] **Commit**

```bash
git add scripts/ src/domains/iam/iam.repository.ts
git commit -m "feat(iam): seed PlanFeatureConfig e migra roleId dos usuários existentes"
```

---

### Task 4: Abrir PR 1

- [ ] **Push e abrir PR para main**

```bash
git push origin HEAD
gh pr create --title "feat(iam): schema Role + PlanFeatureConfig + NAV_REGISTRY [PR 1/3]" \
  --body "$(cat <<'EOF'
## Resumo
- Adiciona tabelas `Role` e `PlanFeatureConfig` ao schema Prisma
- Adiciona `User.roleId` (nullable) para FK com `Role`
- Cria `NAV_REGISTRY` como catálogo de telas e ações
- Semeia 3 cargos padrão no `createTenantWithOwner`
- Scripts de seed de `PlanFeatureConfig` e migração de `roleId` para usuários existentes

## Como testar
- Criar novo tenant → verificar que 3 Roles (Gerente/Profissional/Recepcionista) foram criados no banco
- Verificar PlanFeatureConfig com todas as seções habilitadas para todos os planos
EOF
)"
```

- [ ] **Fazer merge do PR 1 antes de iniciar o PR 2**

---

## PR 2 — Backend + Auth + UI

Criar branch: `git checkout -b feat/iam-cargos-pr2`

### Task 5: RoleRepository — CRUD de cargos (TDD)

**Files:**
- Create: `src/domains/iam/role.repository.ts`
- Create: `src/domains/iam/role.repository.test.ts`

- [ ] **Escrever `src/domains/iam/role.repository.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { prismaMock } from '@/shared/test/prisma-mock'
import { RoleRepository } from './role.repository'

const TENANT_ID = 'tenant-abc'
const ROLE_ID   = 'role-xyz'

const fakeRole = {
  id: ROLE_ID,
  tenantId: TENANT_ID,
  name: 'Gerente',
  isDefault: true,
  permissions: { agenda: ['view', 'create'] },
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  _count: { users: 3 },
}

describe('RoleRepository', () => {
  let repo: RoleRepository

  beforeEach(() => {
    repo = new RoleRepository()
  })

  describe('findAll', () => {
    it('retorna cargos do tenant com contagem de usuários', async () => {
      prismaMock.role.findMany.mockResolvedValue([fakeRole] as any)
      const result = await repo.findAll(TENANT_ID)
      expect(prismaMock.role.findMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID },
        include: { _count: { select: { users: true } } },
        orderBy: { createdAt: 'asc' },
      })
      expect(result).toHaveLength(1)
    })
  })

  describe('findById', () => {
    it('retorna cargo pelo id filtrando tenantId', async () => {
      prismaMock.role.findFirst.mockResolvedValue(fakeRole as any)
      await repo.findById(TENANT_ID, ROLE_ID)
      expect(prismaMock.role.findFirst).toHaveBeenCalledWith({
        where: { id: ROLE_ID, tenantId: TENANT_ID },
      })
    })

    it('retorna null quando não encontrado', async () => {
      prismaMock.role.findFirst.mockResolvedValue(null)
      const result = await repo.findById(TENANT_ID, 'inexistente')
      expect(result).toBeNull()
    })
  })

  describe('countByTenant', () => {
    it('conta cargos do tenant', async () => {
      prismaMock.role.count.mockResolvedValue(3)
      const count = await repo.countByTenant(TENANT_ID)
      expect(count).toBe(3)
      expect(prismaMock.role.count).toHaveBeenCalledWith({ where: { tenantId: TENANT_ID } })
    })
  })

  describe('create', () => {
    it('cria cargo com tenantId correto', async () => {
      prismaMock.role.create.mockResolvedValue(fakeRole as any)
      await repo.create(TENANT_ID, { name: 'Gerente', permissions: { agenda: ['view'] } })
      expect(prismaMock.role.create).toHaveBeenCalledWith({
        data: { tenantId: TENANT_ID, name: 'Gerente', permissions: { agenda: ['view'] } },
      })
    })
  })

  describe('update', () => {
    it('atualiza cargo filtrando tenantId', async () => {
      prismaMock.role.updateMany.mockResolvedValue({ count: 1 })
      prismaMock.role.findFirstOrThrow.mockResolvedValue(fakeRole as any)
      await repo.update(TENANT_ID, ROLE_ID, { name: 'Gerente Sênior' })
      expect(prismaMock.role.updateMany).toHaveBeenCalledWith({
        where: { id: ROLE_ID, tenantId: TENANT_ID },
        data: { name: 'Gerente Sênior' },
      })
    })
  })

  describe('countUsers', () => {
    it('conta usuários vinculados ao cargo', async () => {
      prismaMock.user.count.mockResolvedValue(5)
      const count = await repo.countUsers(TENANT_ID, ROLE_ID)
      expect(prismaMock.user.count).toHaveBeenCalledWith({
        where: { roleId: ROLE_ID, tenantId: TENANT_ID },
      })
      expect(count).toBe(5)
    })
  })

  describe('delete', () => {
    it('exclui cargo filtrando tenantId', async () => {
      prismaMock.role.deleteMany.mockResolvedValue({ count: 1 })
      await repo.delete(TENANT_ID, ROLE_ID)
      expect(prismaMock.role.deleteMany).toHaveBeenCalledWith({
        where: { id: ROLE_ID, tenantId: TENANT_ID },
      })
    })
  })
})
```

- [ ] **Rodar testes — verificar que FALHAM**

```bash
npx vitest run src/domains/iam/role.repository.test.ts
```

Esperado: `FAIL — Cannot find module './role.repository'`

- [ ] **Criar `src/domains/iam/role.repository.ts`**

```ts
import { prisma } from '@/shared/database/prisma'

type CreateRoleInput = {
  name: string
  permissions: Record<string, string[]>
}

type UpdateRoleInput = {
  name?: string
  permissions?: Record<string, string[]>
}

export class RoleRepository {
  async findAll(tenantId: string) {
    return prisma.role.findMany({
      where: { tenantId },
      include: { _count: { select: { users: true } } },
      orderBy: { createdAt: 'asc' },
    })
  }

  async findById(tenantId: string, id: string) {
    return prisma.role.findFirst({ where: { id, tenantId } })
  }

  async countByTenant(tenantId: string) {
    return prisma.role.count({ where: { tenantId } })
  }

  async countUsers(tenantId: string, roleId: string) {
    return prisma.user.count({ where: { roleId, tenantId } })
  }

  async create(tenantId: string, data: CreateRoleInput) {
    return prisma.role.create({ data: { tenantId, ...data } })
  }

  async update(tenantId: string, id: string, data: UpdateRoleInput) {
    await prisma.role.updateMany({ where: { id, tenantId }, data })
    return prisma.role.findFirstOrThrow({ where: { id, tenantId } })
  }

  async delete(tenantId: string, id: string) {
    return prisma.role.deleteMany({ where: { id, tenantId } })
  }
}

export const roleRepository = new RoleRepository()
```

- [ ] **Rodar testes — verificar que PASSAM**

```bash
npx vitest run src/domains/iam/role.repository.test.ts
```

Esperado: `PASS — 7 tests passed`

- [ ] **Commit**

```bash
git add src/domains/iam/role.repository.ts src/domains/iam/role.repository.test.ts
git commit -m "feat(iam): adiciona RoleRepository com testes"
```

---

### Task 6: RoleService — regras de negócio (TDD)

**Files:**
- Create: `src/domains/iam/role.service.ts`
- Create: `src/domains/iam/role.service.test.ts`

- [ ] **Escrever `src/domains/iam/role.service.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PlanName } from '@prisma/client'
import { RoleService } from './role.service'
import type { RoleRepository } from './role.repository'
import { ForbiddenError, ValidationError } from '@/shared/errors'

vi.mock('@/shared/database/prisma', () => ({
  prisma: {
    tenant: {
      findFirst: vi.fn(),
    },
    planFeatureConfig: {
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from '@/shared/database/prisma'

const TENANT_ID = 'tenant-abc'
const ROLE_ID   = 'role-xyz'

const fakeRole = {
  id: ROLE_ID,
  tenantId: TENANT_ID,
  name: 'Esteticista',
  isDefault: false,
  permissions: { agenda: ['view'] },
  createdAt: new Date(),
  updatedAt: new Date(),
  _count: { users: 0 },
}

function makeRepoMock(): RoleRepository {
  return {
    findAll:      vi.fn(),
    findById:     vi.fn(),
    countByTenant: vi.fn(),
    countUsers:   vi.fn(),
    create:       vi.fn(),
    update:       vi.fn(),
    delete:       vi.fn(),
  } as unknown as RoleRepository
}

describe('RoleService', () => {
  let repo: RoleRepository
  let service: RoleService

  beforeEach(() => {
    repo = makeRepoMock()
    service = new RoleService(repo)
    vi.clearAllMocks()
  })

  describe('createRole', () => {
    beforeEach(() => {
      vi.mocked(prisma.tenant.findFirst).mockResolvedValue({ plan: PlanName.FREE } as any)
      vi.mocked(prisma.planFeatureConfig.findMany).mockResolvedValue([
        { sectionKey: 'agenda', enabled: true } as any,
        { sectionKey: 'clientes', enabled: true } as any,
      ])
    })

    it('lança PlanLimitError quando FREE já tem 3 cargos', async () => {
      vi.mocked(repo.countByTenant).mockResolvedValue(3)
      await expect(
        service.createRole(TENANT_ID, { name: 'Novo', permissions: {} })
      ).rejects.toThrow('Limite de roles atingido')
    })

    it('lança ValidationError quando sectionKey não existe no NAV_REGISTRY', async () => {
      vi.mocked(repo.countByTenant).mockResolvedValue(1)
      await expect(
        service.createRole(TENANT_ID, {
          name: 'Novo',
          permissions: { secao_inexistente: ['view'] },
        })
      ).rejects.toThrow(ValidationError)
    })

    it('lança ValidationError quando action não existe para a seção', async () => {
      vi.mocked(repo.countByTenant).mockResolvedValue(1)
      await expect(
        service.createRole(TENANT_ID, {
          name: 'Novo',
          permissions: { agenda: ['voar' as any] },
        })
      ).rejects.toThrow(ValidationError)
    })

    it('lança ValidationError quando seção não está habilitada no plano', async () => {
      vi.mocked(repo.countByTenant).mockResolvedValue(1)
      await expect(
        service.createRole(TENANT_ID, {
          name: 'Novo',
          permissions: { financeiro: ['view'] }, // financeiro não está no mock
        })
      ).rejects.toThrow(ValidationError)
    })

    it('cria cargo quando dados são válidos', async () => {
      vi.mocked(repo.countByTenant).mockResolvedValue(1)
      vi.mocked(repo.create).mockResolvedValue(fakeRole as any)
      const result = await service.createRole(TENANT_ID, {
        name: 'Novo',
        permissions: { agenda: ['view'] },
      })
      expect(repo.create).toHaveBeenCalledWith(TENANT_ID, {
        name: 'Novo',
        permissions: { agenda: ['view'] },
      })
      expect(result).toEqual(fakeRole)
    })
  })

  describe('deleteRole', () => {
    it('lança ForbiddenError quando cargo tem usuários vinculados', async () => {
      vi.mocked(repo.countUsers).mockResolvedValue(2)
      await expect(
        service.deleteRole(TENANT_ID, ROLE_ID)
      ).rejects.toThrow(ForbiddenError)
    })

    it('exclui cargo quando não há usuários vinculados', async () => {
      vi.mocked(repo.countUsers).mockResolvedValue(0)
      vi.mocked(repo.delete).mockResolvedValue({ count: 1 } as any)
      await service.deleteRole(TENANT_ID, ROLE_ID)
      expect(repo.delete).toHaveBeenCalledWith(TENANT_ID, ROLE_ID)
    })
  })
})
```

- [ ] **Rodar testes — verificar que FALHAM**

```bash
npx vitest run src/domains/iam/role.service.test.ts
```

Esperado: `FAIL — Cannot find module './role.service'`

- [ ] **Criar `src/domains/iam/role.service.ts`**

```ts
import { PlanName } from '@prisma/client'
import { prisma } from '@/shared/database/prisma'
import { ForbiddenError, ValidationError, NotFoundError } from '@/shared/errors'
import { NAV_REGISTRY } from '@/shared/permissions/nav-registry'
import type { RoleRepository } from './role.repository'

const ROLE_LIMITS: Record<PlanName, number> = {
  FREE:       3,
  STARTER:    3,
  PRO:        5,
  ENTERPRISE: Infinity,
}

type RoleInput = {
  name: string
  permissions: Record<string, string[]>
}

export class RoleService {
  constructor(private readonly repo: RoleRepository) {}

  async listRoles(tenantId: string) {
    return this.repo.findAll(tenantId)
  }

  async createRole(tenantId: string, input: RoleInput) {
    const tenant = await prisma.tenant.findFirst({ where: { id: tenantId }, select: { plan: true } })
    if (!tenant) throw new NotFoundError('Tenant')

    const count = await this.repo.countByTenant(tenantId)
    const limit = ROLE_LIMITS[tenant.plan]
    if (count >= limit) {
      throw new ForbiddenError(
        `Limite de roles atingido para o plano ${tenant.plan} (máximo ${limit === Infinity ? '∞' : limit}).`
      )
    }

    await this.validatePermissions(tenantId, input.permissions)

    return this.repo.create(tenantId, input)
  }

  async updateRole(tenantId: string, roleId: string, input: Partial<RoleInput>) {
    const role = await this.repo.findById(tenantId, roleId)
    if (!role) throw new NotFoundError('Cargo')

    if (input.permissions) {
      await this.validatePermissions(tenantId, input.permissions)
    }

    return this.repo.update(tenantId, roleId, input)
  }

  async deleteRole(tenantId: string, roleId: string) {
    const userCount = await this.repo.countUsers(tenantId, roleId)
    if (userCount > 0) {
      throw new ForbiddenError(
        `Cargo possui ${userCount} usuário(s) vinculado(s). Reatribua-os antes de excluir.`
      )
    }
    return this.repo.delete(tenantId, roleId)
  }

  private async validatePermissions(
    tenantId: string,
    permissions: Record<string, string[]>
  ) {
    const enabledSections = await prisma.planFeatureConfig.findMany({
      where: { enabled: true },
      select: { sectionKey: true },
    })
    const enabledKeys = new Set(enabledSections.map((s) => s.sectionKey))

    const registryMap = new Map(NAV_REGISTRY.map((s) => [s.key, s.actions]))

    for (const [sectionKey, actions] of Object.entries(permissions)) {
      if (actions.length === 0) continue

      if (!registryMap.has(sectionKey)) {
        throw new ValidationError(`Seção "${sectionKey}" não existe no sistema.`)
      }

      if (!enabledKeys.has(sectionKey)) {
        throw new ValidationError(
          `Seção "${sectionKey}" não está disponível no plano atual.`
        )
      }

      const allowedActions = registryMap.get(sectionKey)!
      for (const action of actions) {
        if (!allowedActions.includes(action as any)) {
          throw new ValidationError(
            `Ação "${action}" não é válida para a seção "${sectionKey}".`
          )
        }
      }
    }
  }
}

import { roleRepository } from './role.repository'
export const roleService = new RoleService(roleRepository)
```

- [ ] **Rodar testes — verificar que PASSAM**

```bash
npx vitest run src/domains/iam/role.service.test.ts
```

Esperado: `PASS — 7 tests passed`

- [ ] **Commit**

```bash
git add src/domains/iam/role.service.ts src/domains/iam/role.service.test.ts
git commit -m "feat(iam): adiciona RoleService com regras de limite e validação"
```

---

### Task 7: Zod schemas e API Routes de cargos

**Files:**
- Create: `src/domains/iam/role.schemas.ts`
- Create: `src/app/api/iam/roles/route.ts`
- Create: `src/app/api/iam/roles/[id]/route.ts`
- Create: `src/app/api/iam/nav-sections/route.ts`

- [ ] **Criar `src/domains/iam/role.schemas.ts`**

```ts
import { z } from 'zod'
import { NAV_REGISTRY } from '@/shared/permissions/nav-registry'

const validSectionKeys = NAV_REGISTRY.map((s) => s.key) as [string, ...string[]]
const validActions = ['view', 'create', 'edit', 'delete'] as const

export const permissionsSchema = z.record(
  z.enum(validSectionKeys),
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

- [ ] **Criar `src/app/api/iam/roles/route.ts`**

```ts
import { roleService } from '@/domains/iam/role.service'
import { createRoleSchema } from '@/domains/iam/role.schemas'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { ForbiddenError } from '@/shared/errors'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    const roles = await roleService.listRoles(session.tenantId)
    return Response.json(roles)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    if (!session.isOwner) throw new ForbiddenError('Apenas o dono pode criar cargos.')
    const input = await validateInput(request, createRoleSchema)
    const role = await roleService.createRole(session.tenantId, input)
    return Response.json(role, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Criar `src/app/api/iam/roles/[id]/route.ts`**

```ts
import { roleService } from '@/domains/iam/role.service'
import { updateRoleSchema } from '@/domains/iam/role.schemas'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { ForbiddenError } from '@/shared/errors'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

type Params = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    if (!session.isOwner) throw new ForbiddenError('Apenas o dono pode editar cargos.')
    const { id } = await params
    const input = await validateInput(request, updateRoleSchema)
    const role = await roleService.updateRole(session.tenantId, id, input)
    return Response.json(role)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    if (!session.isOwner) throw new ForbiddenError('Apenas o dono pode excluir cargos.')
    const { id } = await params
    await roleService.deleteRole(session.tenantId, id)
    return new Response(null, { status: 204 })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Criar `src/app/api/iam/nav-sections/route.ts`**

```ts
import { prisma } from '@/shared/database/prisma'
import { NAV_REGISTRY } from '@/shared/permissions/nav-registry'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)

    const tenant = await prisma.tenant.findFirst({
      where: { id: session.tenantId },
      select: { plan: true },
    })

    const enabledConfigs = await prisma.planFeatureConfig.findMany({
      where: { plan: tenant?.plan, enabled: true },
      select: { sectionKey: true },
    })

    const enabledKeys = new Set(enabledConfigs.map((c) => c.sectionKey))

    const sections = NAV_REGISTRY.filter((s) =>
      enabledKeys.size === 0 || enabledKeys.has(s.key)
    )

    return Response.json(sections)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Commit**

```bash
git add src/domains/iam/role.schemas.ts \
        src/app/api/iam/roles/route.ts \
        src/app/api/iam/roles/[id]/route.ts \
        src/app/api/iam/nav-sections/route.ts
git commit -m "feat(iam): adiciona API Routes de cargos e nav-sections"
```

---

### Task 8: Atualizar SessionContext + getSessionContext

**Files:**
- Modify: `src/shared/types/auth.ts`
- Modify: `src/shared/auth/session.ts`
- Modify: `src/shared/auth/permissions.ts`

- [ ] **Substituir `src/shared/types/auth.ts`**

```ts
export type SessionContext = {
  tenantId: string
  userId: string
  isOwner: boolean
  permissions: Record<string, string[]>
}
```

- [ ] **Atualizar `src/shared/auth/permissions.ts` — nova assinatura de `ensurePermission`**

Substituir a função `ensurePermission` existente:

```ts
import type { NavAction } from '@/shared/permissions/nav-registry'
import { ForbiddenError } from '@/shared/errors'
import type { SessionContext } from '@/shared/types/auth'

export function ensurePermission(
  session: SessionContext,
  sectionKey: string,
  action: NavAction
): void {
  if (session.isOwner) return
  const actions = session.permissions[sectionKey] ?? []
  if (!actions.includes(action)) {
    throw new ForbiddenError('Permissao insuficiente para esta operacao.')
  }
}
```

Remover as constantes `PERMISSIONS` e `ROLE_PERMISSIONS` do arquivo (serão usadas apenas até o PR 3 via fallback no session.ts).

> **Nota:** Durante o PR 2, os API routes que chamavam `ensurePermission(session, PERMISSIONS.users.view)` serão atualizados para a nova assinatura na Task 9.

- [ ] **Atualizar `src/shared/auth/session.ts` — lê permissões do banco com fallback**

Substituir o conteúdo após a lógica de validação do cookie (manter autenticação Supabase intacta). A seção que monta `SessionContext` passa a:

```ts
import { UserRole } from '@prisma/client'
import { buildOwnerPermissions } from '@/shared/permissions/nav-registry'
import { ROLE_PERMISSIONS } from '@/shared/auth/permissions-legacy' // fallback temporário

// ... (código de extração do token do Supabase inalterado) ...

// Após obter userId e tenantId do token:
const dbUser = await prisma.user.findFirst({
  where: { id: user.id, tenantId },
  select: {
    role: true,
    roleId: true,
    customRole: { select: { permissions: true } },
  },
})

const isOwner = dbUser?.role === UserRole.OWNER

let permissions: Record<string, string[]>
if (isOwner) {
  permissions = buildOwnerPermissions()
} else if (dbUser?.customRole?.permissions) {
  permissions = dbUser.customRole.permissions as Record<string, string[]>
} else {
  // fallback: usuário ainda sem roleId (período de migração)
  const legacyRole = dbUser?.role ?? UserRole.PROFESSIONAL
  permissions = ROLE_PERMISSIONS[legacyRole] ?? {}
}

return { tenantId, userId: user.id, isOwner, permissions }
```

- [ ] **Criar `src/shared/auth/permissions-legacy.ts`** — fallback temporário

```ts
import type { UserRole } from '@prisma/client'
import { NAV_REGISTRY } from '@/shared/permissions/nav-registry'

const OLD_TO_NEW: Record<string, { key: string; action: string }[]> = {
  'appointments:view':   [{ key: 'agenda',         action: 'view'   }],
  'appointments:create': [{ key: 'agenda',         action: 'create' }],
  'appointments:edit':   [{ key: 'agenda',         action: 'edit'   }],
  'appointments:delete': [{ key: 'agenda',         action: 'delete' }],
  'customers:view':      [{ key: 'clientes',       action: 'view'   }],
  'customers:create':    [{ key: 'clientes',       action: 'create' }],
  'customers:edit':      [{ key: 'clientes',       action: 'edit'   }],
  'financial:view':      [{ key: 'financeiro',     action: 'view'   }],
  'financial:manage':    [{ key: 'financeiro',     action: 'edit'   }],
  'services:view':       [{ key: 'servicos',       action: 'view'   }],
  'services:manage':     [{ key: 'servicos',       action: 'edit'   }],
  'users:view':          [{ key: 'equipe',         action: 'view'   }],
  'users:invite':        [{ key: 'equipe',         action: 'create' }],
  'users:manage':        [{ key: 'equipe',         action: 'edit'   }],
  'settings:view':       [{ key: 'configuracoes',  action: 'view'   }],
  'settings:manage':     [{ key: 'configuracoes',  action: 'edit'   }],
}

const HARDCODED: Record<string, string[]> = {
  OWNER: [
    'appointments:view','appointments:create','appointments:edit','appointments:delete',
    'customers:view','customers:create','customers:edit',
    'financial:view','financial:manage',
    'users:view','users:invite','users:manage',
    'services:view','services:manage',
    'settings:view','settings:manage',
  ],
  MANAGER: [
    'appointments:view','appointments:create','appointments:edit',
    'customers:view','customers:create','customers:edit',
    'financial:view','services:view','services:manage',
    'users:view','settings:view','settings:manage',
  ],
  PROFESSIONAL: ['appointments:view','appointments:create','customers:view','services:view'],
  RECEPTIONIST: [
    'appointments:view','appointments:create','appointments:edit',
    'customers:view','customers:create','customers:edit','services:view',
  ],
}

function legacyToNew(oldPerms: string[]): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const perm of oldPerms) {
    const mappings = OLD_TO_NEW[perm] ?? []
    for (const { key, action } of mappings) {
      if (!result[key]) result[key] = []
      if (!result[key].includes(action)) result[key].push(action)
    }
  }
  return result
}

export const ROLE_PERMISSIONS: Record<string, Record<string, string[]>> = {
  OWNER:        legacyToNew(HARDCODED.OWNER),
  MANAGER:      legacyToNew(HARDCODED.MANAGER),
  PROFESSIONAL: legacyToNew(HARDCODED.PROFESSIONAL),
  RECEPTIONIST: legacyToNew(HARDCODED.RECEPTIONIST),
}
```

- [ ] **Commit**

```bash
git add src/shared/types/auth.ts \
        src/shared/auth/permissions.ts \
        src/shared/auth/permissions-legacy.ts \
        src/shared/auth/session.ts
git commit -m "feat(iam): SessionContext com isOwner+permissions do banco; fallback legacy"
```

---

### Task 9: Atualizar API Routes que usam ensurePermission + invites com roleId

**Files:**
- Modify: `src/app/api/iam/invites/route.ts`
- Modify: `src/app/api/iam/users/[userId]/route.ts`
- Modify: `src/domains/iam/iam.service.ts`
- Modify: `src/domains/iam/iam.repository.ts`

- [ ] **Atualizar `src/app/api/iam/invites/route.ts`** — aceita `roleId` e usa nova `ensurePermission`

```ts
import { z } from 'zod'
import { iamService } from '@/domains/iam/iam.service'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { ensurePermission } from '@/shared/auth/permissions'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'

const createInviteSchema = z.object({
  email:  z.string().email(),
  roleId: z.string().min(1),
})

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, 'equipe', 'view')
    const invites = await iamService.listInvites(session.tenantId)
    return Response.json(invites)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, 'equipe', 'create')
    const { email, roleId } = await validateInput(request, createInviteSchema)
    const origin = request.headers.get('origin') ?? 'https://estetica-saas-product.vercel.app'
    const invite = await iamService.createInvite(session.tenantId, email, roleId, origin)
    return Response.json(invite, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Atualizar `src/app/api/iam/users/[userId]/route.ts`** — aceita `roleId`

Substituir o schema e o handler PATCH para usar `roleId: z.string()` no lugar de `role: z.enum(UserRole)`.

```ts
import { z } from 'zod'
import { iamService } from '@/domains/iam/iam.service'
import { ensurePermission } from '@/shared/auth/permissions'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

const updateRoleSchema = z.object({ roleId: z.string().min(1) })

type Params = { params: Promise<{ userId: string }> }

export async function PATCH(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, 'equipe', 'edit')
    const { userId } = await params
    const { roleId } = await validateInput(request, updateRoleSchema)
    const user = await iamService.updateUserRoleById(session.tenantId, session.userId, userId, roleId)
    return Response.json(user)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Atualizar `src/domains/iam/iam.service.ts`** — `createInvite` e `joinTenant` usam `roleId`

Em `createInvite`, trocar parâmetro `role: UserRole` por `roleId: string`. Buscar o Role pelo `roleId` para validar que pertence ao tenant antes de criar o convite. Passar `roleId` para `iamRepository.createInvite`.

```ts
async createInvite(tenantId: string, email: string, roleId: string, origin?: string) {
  const userCount = await iamRepository.countActiveUsers(tenantId)
  await featureGuard.assertWithinLimit(tenantId, 'users', userCount)

  const role = await prisma.role.findFirst({ where: { id: roleId, tenantId } })
  if (!role) throw new NotFoundError('Cargo')

  const invite = await iamRepository.createInviteByRoleId(tenantId, email, roleId)
  const baseUrl = (origin ?? 'https://estetica-saas-product.vercel.app').replace(/\/$/, '')
  await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${baseUrl}/callback`,
    data: { pendingTenantId: tenantId, pendingRoleId: roleId },
  })
  return invite
}
```

Em `joinTenant`, trocar `pendingRole: UserRole` por `pendingRoleId: string`:

```ts
async joinTenant(
  userId: string,
  email: string,
  pendingTenantId: string,
  pendingRoleId: string,
  userName: string,
) {
  const invite = await iamRepository.findInviteByEmailAndTenant(email, pendingTenantId)
  if (!invite) throw new ForbiddenError('Convite nao encontrado ou expirado.')

  const user = await iamRepository.createUserInTenant({
    userId,
    tenantId: pendingTenantId,
    email,
    name: userName,
    roleId: pendingRoleId,
  })

  await supabaseAdmin.auth.admin.updateUserById(userId, {
    app_metadata: { tenantId: pendingTenantId },
  })

  await iamRepository.acceptInvite(invite.id)
  return user
}
```

- [ ] **Atualizar `src/domains/iam/iam.repository.ts`** — métodos de convite com roleId

Adicionar `createInviteByRoleId` (guarda `roleId` no convite em vez de `role: UserRole`) e atualizar `createUserInTenant` para aceitar `roleId`:

```ts
async createInviteByRoleId(tenantId: string, email: string, roleId: string) {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)
  return prisma.tenantInvite.upsert({
    where: { tenantId_email: { tenantId, email } },
    update: { roleId, status: 'PENDING', expiresAt },
    create: { tenantId, email, roleId, expiresAt },
  })
}
```

> **Nota:** O model `TenantInvite` no Prisma precisa de `roleId String?` adicionado no schema e uma migration rodada. Adicionar ao schema antes desta task se não foi feito.

Atualizar `createUserInTenant` para receber `roleId` e não mais `role: UserRole`:

```ts
async createUserInTenant(input: {
  userId: string; tenantId: string; email: string; name: string; roleId: string
}) {
  return prisma.user.create({
    data: {
      id: input.userId,
      tenantId: input.tenantId,
      email: input.email,
      name: input.name,
      role: UserRole.PROFESSIONAL, // valor do enum mantido por compatibilidade
      roleId: input.roleId,
      permissions: [],
    },
  })
}
```

- [ ] **Commit**

```bash
git add src/app/api/iam/invites/route.ts \
        src/app/api/iam/users/ \
        src/domains/iam/iam.service.ts \
        src/domains/iam/iam.repository.ts
git commit -m "feat(iam): invites e joinTenant usam roleId dinâmico"
```

---

### Task 10: Atualizar /api/iam/me + getCurrentUser

**Files:**
- Modify: `src/domains/iam/iam.service.ts` — `getCurrentUser` retorna novo formato
- Modify: `src/hooks/use-current-user.ts` — tipo `CurrentUser` atualizado

- [ ] **Atualizar `getCurrentUser` em `iam.service.ts`**

O método agora retorna `isOwner` e `permissions` no formato novo. O `SessionContext` já tem `permissions`, então podemos retorná-lo diretamente:

```ts
async getCurrentUser(session: SessionContext) {
  const user = await prisma.user.findFirst({
    where: { id: session.userId, tenantId: session.tenantId },
    select: {
      id: true,
      tenantId: true,
      email: true,
      name: true,
      role: true,
      roleId: true,
      customRole: { select: { id: true, name: true } },
      tenant: { select: { name: true } },
    },
  })

  if (!user) throw new NotFoundError('Usuario')

  return {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    name: user.name,
    isOwner: session.isOwner,
    roleId: user.roleId,
    roleName: session.isOwner ? 'Dono' : (user.customRole?.name ?? 'Sem cargo'),
    permissions: session.permissions,
    businessName: user.tenant.name,
  }
}
```

- [ ] **Atualizar `src/hooks/use-current-user.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

export type CurrentUser = {
  id: string
  tenantId: string
  email: string
  name: string
  isOwner: boolean
  roleId: string | null
  roleName: string
  permissions: Record<string, string[]>
  businessName: string
}

async function fetchCurrentUser(): Promise<CurrentUser> {
  const res = await fetch('/api/iam/me')
  if (res.status === 401) throw new Error('NAO_AUTENTICADO')
  if (!res.ok) throw new Error('Falha ao buscar usuario')
  return res.json()
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ['current-user'],
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}
```

- [ ] **Commit**

```bash
git add src/domains/iam/iam.service.ts src/hooks/use-current-user.ts
git commit -m "feat(iam): getCurrentUser retorna isOwner e permissions no novo formato"
```

---

### Task 11: Atualizar usePermissions + todos os call sites de can()

**Files:**
- Modify: `src/hooks/use-permissions.ts`
- Modify: `src/app/(app)/equipe/page.tsx`
- Modify: `src/app/(app)/financeiro/page.tsx`
- Modify: `src/app/(app)/financeiro/transacoes/page.tsx`
- Modify: `src/app/(app)/configuracoes/page.tsx`
- Modify: `src/app/(app)/relatorios/agendamentos/page.tsx`
- Modify: `src/app/(app)/relatorios/financeiro/page.tsx`
- Modify: `src/app/(app)/relatorios/clientes/page.tsx`
- Modify: `src/app/(app)/relatorios/profissionais/page.tsx`
- Modify: `src/components/domain/scheduling/agenda-day-view.tsx`
- Modify: `src/components/domain/scheduling/create-appointment-modal.tsx`
- Modify: `src/components/domain/crm/customer-list.tsx`

- [ ] **Substituir `src/hooks/use-permissions.ts`**

```ts
import { useCurrentUser } from './use-current-user'
import type { NavAction } from '@/shared/permissions/nav-registry'

export function usePermissions() {
  const { data: user, isLoading } = useCurrentUser()

  function can(sectionKey: string, action: NavAction): boolean {
    if (!user) return false
    if (user.isOwner) return true
    return user.permissions[sectionKey]?.includes(action) ?? false
  }

  function canAccess(sectionKey: string): boolean {
    return can(sectionKey, 'view')
  }

  return { can, canAccess, user, isLoading }
}
```

- [ ] **Atualizar `src/app/(app)/equipe/page.tsx`**

```ts
const canManage = can('equipe', 'edit')
const canInvite = can('equipe', 'create')

if (!can('equipe', 'view')) { ... }
```

- [ ] **Atualizar `src/app/(app)/financeiro/page.tsx`**

```ts
if (!can('financeiro', 'view')) { ... }
```

- [ ] **Atualizar `src/app/(app)/financeiro/transacoes/page.tsx`**

```ts
if (!can('financeiro', 'view')) { ... }
```

- [ ] **Atualizar `src/app/(app)/configuracoes/page.tsx`**

```ts
if (!isLoading && !can('configuracoes', 'view')) { router.replace('/agenda') }
if (!can('configuracoes', 'view')) return null
```

- [ ] **Atualizar páginas de relatórios** — todas usam `can('relatorios', 'view')`

```ts
// relatorios/agendamentos/page.tsx
if (!can('relatorios', 'view')) { ... }

// relatorios/financeiro/page.tsx
if (!can('relatorios', 'view')) { ... }

// relatorios/clientes/page.tsx
if (!can('relatorios', 'view')) { ... }

// relatorios/profissionais/page.tsx
if (!can('relatorios', 'view')) { ... }
```

- [ ] **Atualizar componentes de scheduling**

```ts
// agenda-day-view.tsx (2 ocorrências)
{can('agenda', 'create') && ( ... )}

// create-appointment-modal.tsx
const canManage = can('agenda', 'edit')
```

- [ ] **Atualizar `customer-list.tsx`**

```ts
{can('clientes', 'create') && ( ... )}
```

- [ ] **Verificar que não há mais `can(` com string de permissão antiga** (ex: `'appointments:view'`)

```bash
grep -r "can('" src/ --include="*.tsx" --include="*.ts" | grep -v "node_modules" | grep -v ".test."
```

Esperado: todas as ocorrências usam o novo formato `can('secao', 'acao')`.

- [ ] **Commit**

```bash
git add src/hooks/use-permissions.ts \
        src/app/(app)/ \
        src/components/domain/scheduling/ \
        src/components/domain/crm/customer-list.tsx
git commit -m "feat(iam): atualiza usePermissions e todos os call sites de can()"
```

---

### Task 12: Sidebar dinâmico a partir do NAV_REGISTRY

**Files:**
- Modify: `src/components/app/app-shell.tsx`

- [ ] **Substituir `NAV_ITEMS` hardcoded por itens derivados do NAV_REGISTRY**

No `app-shell.tsx`, remover a constante `NAV_ITEMS` e substituir pela lógica dinâmica. Mudar o tipo de `item` para `NavSection` do registry.

Remover:
```ts
const NAV_ITEMS = [ ... ] as const
```

Adicionar imports:
```ts
import { NAV_REGISTRY, type NavSection } from '@/shared/permissions/nav-registry'
import * as Icons from 'lucide-react'
```

Substituir a lógica de `visibleItems`:
```ts
const visibleItems = NAV_REGISTRY.filter((section) =>
  canAccess(section.key)
)

const mainItems = visibleItems.filter((s) => s.key !== 'configuracoes')
const configItem = visibleItems.find((s) => s.key === 'configuracoes')
```

Atualizar `NavLink` para aceitar `NavSection`:
```ts
function NavLink({ item, showLabel }: { item: NavSection; showLabel: boolean }) {
  const Icon = (Icons as Record<string, React.ElementType>)[item.icon] ?? Icons.Circle
  const isActive = pathname.startsWith(item.href)
  // ... resto do componente inalterado
}
```

Adicionar `canAccess` ao destructuring de `usePermissions()`:
```ts
const { can, canAccess, user, isLoading } = usePermissions()
```

- [ ] **Commit**

```bash
git add src/components/app/app-shell.tsx
git commit -m "feat(iam): sidebar gerado dinamicamente a partir do NAV_REGISTRY"
```

---

### Task 13: Hooks de cargos — use-roles.ts e use-nav-sections.ts

**Files:**
- Create: `src/hooks/iam/use-roles.ts`
- Create: `src/hooks/iam/use-nav-sections.ts`

- [ ] **Criar `src/hooks/iam/use-roles.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export type Role = {
  id: string
  tenantId: string
  name: string
  isDefault: boolean
  permissions: Record<string, string[]>
  createdAt: string
  updatedAt: string
  _count: { users: number }
}

type RoleInput = {
  name: string
  permissions: Record<string, string[]>
}

async function fetchRoles(): Promise<Role[]> {
  const res = await fetch('/api/iam/roles')
  if (!res.ok) throw new Error('Falha ao carregar cargos')
  return res.json()
}

async function createRole(input: RoleInput): Promise<Role> {
  const res = await fetch('/api/iam/roles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? 'Falha ao criar cargo')
  }
  return res.json()
}

async function updateRole({ id, ...input }: RoleInput & { id: string }): Promise<Role> {
  const res = await fetch(`/api/iam/roles/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? 'Falha ao atualizar cargo')
  }
  return res.json()
}

async function deleteRole(id: string): Promise<void> {
  const res = await fetch(`/api/iam/roles/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? 'Falha ao excluir cargo')
  }
}

export function useRoles() {
  return useQuery({ queryKey: ['roles'], queryFn: fetchRoles, staleTime: 30 * 1000 })
}

export function useCreateRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createRole,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  })
}

export function useUpdateRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateRole,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  })
}

export function useDeleteRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteRole,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  })
}
```

- [ ] **Criar `src/hooks/iam/use-nav-sections.ts`**

```ts
import { useQuery } from '@tanstack/react-query'
import type { NavSection } from '@/shared/permissions/nav-registry'

async function fetchNavSections(): Promise<NavSection[]> {
  const res = await fetch('/api/iam/nav-sections')
  if (!res.ok) throw new Error('Falha ao carregar seções')
  return res.json()
}

export function useNavSections() {
  return useQuery({
    queryKey: ['nav-sections'],
    queryFn: fetchNavSections,
    staleTime: 5 * 60 * 1000,
  })
}
```

- [ ] **Commit**

```bash
git add src/hooks/iam/use-roles.ts src/hooks/iam/use-nav-sections.ts
git commit -m "feat(iam): adiciona hooks useRoles e useNavSections"
```

---

### Task 14: role-permission-matrix.tsx

**Files:**
- Create: `src/components/domain/iam/role-permission-matrix.tsx`

- [ ] **Criar `src/components/domain/iam/role-permission-matrix.tsx`**

```tsx
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
  view:   'Visualizar',
  create: 'Criar',
  edit:   'Editar',
  delete: 'Excluir',
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

- [ ] **Commit**

```bash
git add src/components/domain/iam/role-permission-matrix.tsx
git commit -m "feat(iam): adiciona RolePermissionMatrix com lógica de pré-requisito de view"
```

---

### Task 15: role-editor.tsx e roles-manager.tsx

**Files:**
- Create: `src/components/domain/iam/role-editor.tsx`
- Create: `src/components/domain/iam/roles-manager.tsx`

- [ ] **Criar `src/components/domain/iam/role-editor.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RolePermissionMatrix } from './role-permission-matrix'
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

- [ ] **Criar `src/components/domain/iam/roles-manager.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { RoleEditor } from './role-editor'
import { RoleDeleteButton } from './role-delete-button'
import { useRoles, useCreateRole, type Role } from '@/hooks/iam/use-roles'
import { useNavSections } from '@/hooks/iam/use-nav-sections'
import type { NavSection } from '@/shared/permissions/nav-registry'

export function RolesManager() {
  const { data: roles, isLoading: loadingRoles } = useRoles()
  const { data: sections = [], isLoading: loadingSections } = useNavSections()
  const createRole = useCreateRole()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creatingNew, setCreatingNew] = useState(false)
  const [newName, setNewName] = useState('')

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
    <div className="flex gap-6">
      {/* Lista de cargos */}
      <div className="w-56 shrink-0 space-y-2">
        {roles?.map((role) => (
          <div
            key={role.id}
            className={`flex items-center justify-between rounded-xl border p-3 cursor-pointer transition ${
              editingId === role.id
                ? 'border-slate-950 bg-slate-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
            onClick={() => { setEditingId(role.id); setCreatingNew(false) }}
          >
            <div>
              <p className="text-sm font-medium text-slate-900">{role.name}</p>
              <p className="text-xs text-slate-400">{role._count.users} usuário(s)</p>
            </div>
            <RoleDeleteButton
              roleId={role.id}
              roleName={role.name}
              userCount={role._count.users}
              onDeleted={() => { if (editingId === role.id) setEditingId(null) }}
            />
          </div>
        ))}

        {creatingNew ? (
          <form onSubmit={handleCreateSubmit} className="space-y-2 rounded-xl border border-slate-300 p-3">
            <Label className="text-xs">Nome do cargo</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex: Esteticista"
              autoFocus
              maxLength={50}
            />
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => { setCreatingNew(false); setNewName('') }}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={!newName.trim() || createRole.isPending}>
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

      {/* Painel de edição */}
      <div className="flex-1">
        {editingRole ? (
          <RoleEditor
            role={editingRole}
            sections={sections as NavSection[]}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-200">
            <p className="text-sm text-slate-400">Selecione um cargo para editar</p>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/components/domain/iam/role-editor.tsx \
        src/components/domain/iam/roles-manager.tsx
git commit -m "feat(iam): adiciona RoleEditor e RolesManager"
```

---

### Task 16: role-delete-button.tsx

**Files:**
- Create: `src/components/domain/iam/role-delete-button.tsx`

- [ ] **Criar `src/components/domain/iam/role-delete-button.tsx`**

```tsx
'use client'

import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useDeleteRole } from '@/hooks/iam/use-roles'

type Props = {
  roleId: string
  roleName: string
  userCount: number
  onDeleted: () => void
}

export function RoleDeleteButton({ roleId, roleName, userCount, onDeleted }: Props) {
  const deleteRole = useDeleteRole()
  const hasUsers = userCount > 0

  function handleDelete() {
    deleteRole.mutate(roleId, {
      onSuccess: () => {
        toast.success(`Cargo "${roleName}" excluído`)
        onDeleted()
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro ao excluir cargo'),
    })
  }

  if (hasUsers) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-slate-300 cursor-not-allowed"
              disabled
              onClick={(e) => e.stopPropagation()}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {userCount} usuário(s) vinculado(s). Reatribua-os antes de excluir.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-slate-400 hover:text-red-500"
          onClick={(e) => e.stopPropagation()}
          disabled={deleteRole.isPending}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir cargo "{roleName}"?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

- [ ] **Commit**

```bash
git add src/components/domain/iam/role-delete-button.tsx
git commit -m "feat(iam): adiciona RoleDeleteButton com guard de usuários vinculados"
```

---

### Task 17: Nova aba Cargos em Configurações + atualizar invite modal + team-member-card

**Files:**
- Modify: `src/app/(app)/configuracoes/page.tsx`
- Modify: `src/components/domain/iam/invite-member-modal.tsx`
- Modify: `src/components/domain/iam/team-member-card.tsx`
- Modify: `src/hooks/iam/use-team.ts`

- [ ] **Adicionar aba "Cargos" em `src/app/(app)/configuracoes/page.tsx`**

Adicionar import do `RolesManager`:
```ts
import { RolesManager } from '@/components/domain/iam/roles-manager'
```

Mudar `grid-cols-6` para `grid-cols-7` no `TabsList` e adicionar o trigger:
```tsx
<TabsTrigger value="cargos">Cargos</TabsTrigger>
```

Adicionar `TabsContent` ao final (antes de fechar `</Tabs>`):
```tsx
<TabsContent value="cargos" className="mt-6">
  <div className="rounded-2xl border border-white/80 bg-white/85 p-6 shadow-sm">
    <h2 className="mb-1 text-base font-semibold text-slate-950">
      Cargos e Permissões
    </h2>
    <p className="mb-6 text-sm text-slate-500">
      Defina o que cada cargo pode ver e fazer no sistema.
    </p>
    <RolesManager />
  </div>
</TabsContent>
```

A aba só deve aparecer para OWNER — adicionar condição no TabsList:
```tsx
{user?.isOwner && <TabsTrigger value="cargos">Cargos</TabsTrigger>}
```

- [ ] **Atualizar `src/hooks/iam/use-team.ts`** — invite usa `roleId`

Substituir a função `createInvite` para usar `roleId: string`:

```ts
async function createInvite(input: { email: string; roleId: string }): Promise<TeamInvite> {
  const res = await fetch('/api/iam/invites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? 'Falha ao enviar convite')
  }
  return res.json()
}
```

Atualizar `useInviteMember` para aceitar `{ email, roleId }`.

Atualizar `updateMemberRole` para usar `roleId`:
```ts
async function updateMemberRole(input: { userId: string; roleId: string }): Promise<TeamMember> {
  const res = await fetch(`/api/iam/users/${input.userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roleId: input.roleId }),
  })
  // ...
}
```

Adicionar ao tipo `TeamMember`:
```ts
export type TeamMember = {
  id: string
  name: string
  email: string
  isOwner: boolean
  roleId: string | null
  roleName: string
  createdAt: string
}
```

- [ ] **Atualizar `src/components/domain/iam/invite-member-modal.tsx`** — carrega cargos dinâmicos

```tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useInviteMember } from '@/hooks/iam/use-team'
import { useRoles } from '@/hooks/iam/use-roles'

type Props = { open: boolean; onClose: () => void }

export function InviteMemberModal({ open, onClose }: Props) {
  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState('')
  const invite = useInviteMember()
  const { data: roles = [], isLoading: loadingRoles } = useRoles()

  function handleClose() {
    setEmail('')
    setRoleId('')
    onClose()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !roleId) return
    invite.mutate(
      { email: email.trim(), roleId },
      {
        onSuccess: () => {
          toast.success(`Convite enviado para ${email}`)
          handleClose()
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro ao enviar convite'),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Convidar membro</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>E-mail *</Label>
            <Input
              type="email"
              placeholder="profissional@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Cargo *</Label>
            <Select value={roleId} onValueChange={setRoleId} disabled={loadingRoles}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o cargo..." />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-slate-500">Um e-mail de convite será enviado. O link expira em 7 dias.</p>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={handleClose} disabled={invite.isPending}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-slate-950 text-white hover:bg-slate-800"
              disabled={!email || !roleId || invite.isPending}
            >
              {invite.isPending ? 'Enviando...' : 'Enviar convite'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Atualizar `src/components/domain/iam/team-member-card.tsx`** — exibe `roleName` dinâmico

Remover `ROLE_LABELS` e `ROLE_COLORS` hardcoded. Mostrar `member.roleName` com badge neutro para não-OWNER:

```tsx
{member.isOwner ? (
  <Badge className="text-xs bg-slate-950 text-white">Dono</Badge>
) : canEditRole ? (
  <Select
    value={member.roleId ?? ''}
    onValueChange={(v) => updateRole.mutate(
      { userId: member.id, roleId: v },
      {
        onSuccess: () => toast.success('Cargo atualizado'),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro'),
      }
    )}
    disabled={updateRole.isPending}
  >
    <SelectTrigger className="w-40 text-xs">
      <SelectValue>{member.roleName}</SelectValue>
    </SelectTrigger>
    <SelectContent>
      {roles?.map((role) => (
        <SelectItem key={role.id} value={role.id}>
          {role.name}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
) : (
  <Badge className="text-xs bg-slate-100 text-slate-700">{member.roleName}</Badge>
)}
```

Adicionar `useRoles` e atualizar imports conforme necessário.

- [ ] **Rodar verificação de tipos**

```bash
npx tsc --noEmit
```

Corrigir todos os erros de tipo encontrados antes de commitar.

- [ ] **Commit**

```bash
git add src/app/(app)/configuracoes/page.tsx \
        src/components/domain/iam/invite-member-modal.tsx \
        src/components/domain/iam/team-member-card.tsx \
        src/hooks/iam/use-team.ts
git commit -m "feat(iam): aba Cargos em Configurações + invite e team-card com roleId dinâmico"
```

---

### Task 18: Testes de integração + verificação final do PR 2

- [ ] **Rodar todos os testes**

```bash
npx vitest run
```

Esperado: todos os testes passando. Corrigir falhas antes de continuar.

- [ ] **Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Abrir PR 2**

```bash
git push origin HEAD
gh pr create --title "feat(iam): sistema dinâmico de cargos e permissões [PR 2/3]" \
  --body "$(cat <<'EOF'
## Resumo
- RoleRepository e RoleService com TDD
- API Routes: GET/POST /api/iam/roles, PUT/DELETE /api/iam/roles/[id], GET /api/iam/nav-sections
- SessionContext atualizado: isOwner + permissions do banco (fallback legacy para migração)
- ensurePermission com nova assinatura (sectionKey, action)
- usePermissions com can(sectionKey, action) — todos os call sites atualizados
- Sidebar gerado dinamicamente a partir do NAV_REGISTRY
- Nova aba "Cargos e Permissões" em Configurações (apenas OWNER)
- InviteMemberModal carrega cargos dinâmicos via useRoles
- TeamMemberCard exibe roleName dinâmico
EOF
)"
```

- [ ] **Fazer merge do PR 2 antes de iniciar PR 3**

---

## PR 3 — Limpeza do código legado

Criar branch: `git checkout -b feat/iam-cargos-pr3`

### Task 19: Remover fallback hardcoded + arquivo de legado

**Files:**
- Modify: `src/shared/auth/session.ts`
- Delete: `src/shared/auth/permissions-legacy.ts`
- Modify: `src/shared/auth/permissions.ts`
- Modify: `src/shared/test/factories/user.factory.ts`

- [ ] **Remover o bloco de fallback do `session.ts`**

Localizar e remover o trecho:
```ts
// fallback: usuário ainda sem roleId (período de migração)
const legacyRole = dbUser?.role ?? UserRole.PROFESSIONAL
permissions = ROLE_PERMISSIONS[legacyRole] ?? {}
```

Simplificar para:
```ts
const isOwner = dbUser?.role === UserRole.OWNER

const permissions: Record<string, string[]> = isOwner
  ? buildOwnerPermissions()
  : (dbUser?.customRole?.permissions as Record<string, string[]> ?? {})

return { tenantId, userId: user.id, isOwner, permissions }
```

Remover import de `ROLE_PERMISSIONS` e `permissions-legacy`.

- [ ] **Deletar `src/shared/auth/permissions-legacy.ts`**

```bash
rm src/shared/auth/permissions-legacy.ts
```

- [ ] **Limpar `src/shared/auth/permissions.ts`**

O arquivo agora só contém a função `ensurePermission`. Remover qualquer constante `PERMISSIONS` ou `ROLE_PERMISSIONS` remanescente.

- [ ] **Atualizar `src/shared/test/factories/user.factory.ts`** — adiciona `roleId: null`

```ts
import type { User } from '@prisma/client'
import { UserRole } from '@prisma/client'

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-test-id',
    tenantId: 'tenant-test-id',
    email: 'user@test.com',
    name: 'Usuário Teste',
    role: UserRole.PROFESSIONAL,
    permissions: [],
    roleId: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}
```

- [ ] **Rodar todos os testes**

```bash
npx vitest run
```

Esperado: todos passando.

- [ ] **Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Commit**

```bash
git add -A
git commit -m "chore(iam): remove código legado de permissões hardcoded"
```

- [ ] **Abrir e mergear PR 3**

```bash
git push origin HEAD
gh pr create --title "chore(iam): remove fallback de permissões legado [PR 3/3]" \
  --body "Remove permissions-legacy.ts, fallback de ROLE_PERMISSIONS do session.ts e constante PERMISSIONS do permissions.ts. Sistema agora usa exclusivamente Role.permissions do banco."
```

---

## Self-review do plano

### Cobertura da spec

| Requisito da spec | Task que implementa |
|---|---|
| Tabela `Role` com `permissions: Json` | Task 2 |
| Tabela `PlanFeatureConfig` | Task 2 |
| `User.roleId` nullable | Task 2 |
| NAV_REGISTRY como fonte de verdade | Task 1 |
| `buildOwnerPermissions()` derivado do registry | Task 1 |
| `buildDefaultRolePermissions` para 3 presets | Task 1 |
| Seed de cargos padrão no `createTenantWithOwner` | Task 3 |
| Script de migração para tenants existentes | Task 3 |
| Seed de `PlanFeatureConfig` | Task 3 |
| RoleRepository com multi-tenancy | Task 5 |
| RoleService com limite por plano | Task 6 |
| RoleService com validação de permissões | Task 6 |
| deleteRole com guard de usuários | Task 6 |
| API Routes CRUD de cargos | Task 7 |
| GET /api/iam/nav-sections filtrado por plano | Task 7 |
| SessionContext com `isOwner` e `permissions: Record` | Task 8 |
| `getSessionContext` lê do banco com cache | Task 8 |
| Fallback legacy para período de migração | Task 8 |
| `ensurePermission` nova assinatura | Task 8 |
| Invites com `roleId` | Task 9 |
| `joinTenant` com `roleId` | Task 9 |
| `getCurrentUser` retorna novo formato | Task 10 |
| `usePermissions` sem hardcode | Task 11 |
| Todos os call sites de `can()` atualizados | Task 11 |
| Sidebar dinâmico via NAV_REGISTRY | Task 12 |
| `useRoles`, `useNavSections` | Task 13 |
| `RolePermissionMatrix` com pré-requisito de view | Task 14 |
| `RoleEditor` e `RolesManager` | Task 15 |
| `RoleDeleteButton` com tooltip para usuários vinculados | Task 16 |
| Aba Cargos em Configurações (só OWNER) | Task 17 |
| `InviteMemberModal` com cargos dinâmicos | Task 17 |
| `TeamMemberCard` com roleName dinâmico | Task 17 |
| Remoção do código legado | Task 19 |

### Consistência de tipos

- `NavAction = 'view' | 'create' | 'edit' | 'delete'` — definido em Task 1, usado em Tasks 6, 8, 11, 14
- `SessionContext.permissions: Record<string, string[]>` — definido em Task 8, lido por `ensurePermission` em Task 8 e `usePermissions` em Task 11
- `Role._count.users` — retornado pelo `findAll` do repository (Task 5), lido por `RolesManager` e `RoleDeleteButton` (Tasks 15–16)
- `TeamMember.isOwner` e `TeamMember.roleName` — definidos em `use-team.ts` (Task 17), lidos por `team-member-card.tsx` (Task 17)
- `useUpdateMemberRole` muta `{ userId, roleId }` — alinhado com `PATCH /api/iam/users/[userId]` (Task 9)

### Nota sobre TenantInvite

O model `TenantInvite` no Prisma atual tem campo `role: UserRole`. A Task 9 adiciona `roleId: String?` a esse model. Isso requer um `prisma migrate dev` adicional antes dos testes de convite. Verificar se a migration foi adicionada ao Task 2 ou criar uma migration separada no início do Task 9.
