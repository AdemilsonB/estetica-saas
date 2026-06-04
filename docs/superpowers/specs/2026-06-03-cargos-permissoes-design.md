# Spec: Sistema Dinâmico de Cargos e Permissões

**Data:** 2026-06-03
**Status:** Aprovado
**Domínio:** IAM

---

## Contexto

O sistema atualmente possui 4 roles fixas no enum do Prisma (`OWNER`, `MANAGER`, `PROFESSIONAL`, `RECEPTIONIST`) com permissões hardcoded em dois lugares: `src/shared/auth/permissions.ts` (backend) e `src/hooks/use-permissions.ts` (frontend). Não há como o dono do tenant criar cargos personalizados, renomear os existentes ou ajustar permissões por tela.

---

## Objetivo

Substituir o sistema de roles hardcoded por um sistema dinâmico onde:

1. O dono do tenant gerencia cargos e permissões via uma nova aba em Configurações
2. Cargos têm permissões granulares por seção do menu (visualizar / criar / editar / excluir)
3. Novas telas adicionadas ao sistema aparecem automaticamente na tela de gerenciamento
4. Limites de cargos são controlados pelo plano de billing do tenant
5. Permissões refletem imediatamente após alteração, sem necessidade de logout

---

## Decisões de design

| Questão | Decisão |
|---|---|
| Cargos existentes | Pré-definidos editáveis — criados automaticamente no onboarding, editáveis pelo dono |
| Granularidade | Híbrido: seção principal + ações (view, create, edit, delete) dentro de cada seção |
| Efeito ao alterar cargo | Reflete imediatamente (permissões lidas do banco, não do JWT) |
| Registro de telas | `NAV_REGISTRY` em código — sidebar importa daqui; novas telas entram aqui |
| Cargos customizados | Sim, com limite por plano (FREE/STARTER ≤ 3, PRO ≤ 5, ENTERPRISE ∞) |
| Abordagem de permissões | On-demand do banco: `User → roleId → Role.permissions` por request |

---

## Arquitetura — Duas camadas de controle

```
Camada 1 — Plano (Admin do sistema)
  PlanFeatureConfig: define quais seções cada plano (FREE/STARTER/PRO/ENTERPRISE) inclui
  Gerenciado por tela de Admin separada (fora do escopo deste feature)

Camada 2 — Cargo (Dono do tenant)
  Role.permissions: dentro das seções liberadas pelo plano,
  o dono define quais ações cada cargo pode fazer

Fluxo de resolução:
  Usuário acessa /relatorios
        ↓
  1. PlanFeatureConfig: plano do tenant libera "relatorios"?
        ↓ sim
  2. Role.permissions: cargo do usuário tem "relatorios" com action "view"?
        ↓ sim
  Acesso liberado
```

---

## Modelo de dados

### Nova tabela `Role`

```prisma
model Role {
  id          String   @id @default(cuid())
  tenantId    String
  name        String
  isDefault   Boolean  @default(false)
  permissions Json     @default("{}")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant  Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  users   User[]

  @@unique([tenantId, name])
  @@index([tenantId])
}
```

### Nova tabela `PlanFeatureConfig`

```prisma
model PlanFeatureConfig {
  id         String   @id @default(cuid())
  plan       PlanName
  sectionKey String
  enabled    Boolean  @default(false)
  updatedAt  DateTime @updatedAt

  @@unique([plan, sectionKey])
  @@index([plan])
}
```

### Mudanças em `User`

- Adiciona `roleId String?` — FK para `Role` (nullable para OWNER e período de migração)
- Mantém `role: UserRole` — usado apenas para detectar `isOwner` (`role === OWNER`)
- Mantém `permissions: String[]` — campo não removido do schema; deixa de ser lido na resolução

### Estrutura do JSON `Role.permissions`

```json
{
  "agenda":        ["view", "create", "edit", "delete"],
  "clientes":      ["view", "create", "edit"],
  "financeiro":    ["view"],
  "servicos":      ["view"],
  "relatorios":    [],
  "equipe":        [],
  "configuracoes": []
}
```

Seção ausente no JSON equivale a `[]` (sem acesso). OWNER tem acesso total resolvido em código a partir do `NAV_REGISTRY`, não armazenado no banco.

---

## Registro de navegação

### `src/shared/permissions/nav-registry.ts`

Fonte única de verdade para telas e ações. Sidebar e tela de Cargos importam daqui.

```ts
export type NavAction = 'view' | 'create' | 'edit' | 'delete'

export type NavSection = {
  key: string
  label: string
  icon: string
  href: string
  actions: NavAction[]
  defaultPermissions: {
    MANAGER:      NavAction[]
    PROFESSIONAL: NavAction[]
    RECEPTIONIST: NavAction[]
  }
}

export const NAV_REGISTRY: NavSection[] = [
  {
    key: 'agenda',
    label: 'Agenda',
    icon: 'Calendar',
    href: '/agenda',
    actions: ['view', 'create', 'edit', 'delete'],
    defaultPermissions: {
      MANAGER:      ['view', 'create', 'edit', 'delete'],
      PROFESSIONAL: ['view', 'create'],
      RECEPTIONIST: ['view', 'create', 'edit'],
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
    icon: 'DollarSign',
    href: '/financeiro',
    actions: ['view', 'create', 'edit', 'delete'],
    defaultPermissions: {
      MANAGER:      ['view', 'create', 'edit'],
      PROFESSIONAL: [],
      RECEPTIONIST: [],
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
    label: 'Configurações',
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
```

**Regra para novos itens:** ao adicionar uma tela ao sidebar, adicionar entry no `NAV_REGISTRY`. Cargos existentes recebem a nova seção com `[]` (sem acesso) automaticamente — inferência por ausência de chave no JSON. OWNER ganha acesso total automaticamente via `buildOwnerPermissions()`.

---

## Resolução de permissões

### `getSessionContext` — novo fluxo

```
Request com cookie/Bearer token
      ↓
Supabase valida token → retorna userId
      ↓
Query: User JOIN Role WHERE User.id = userId AND User.tenantId = tenantId
      ↓
Se User.role === OWNER → buildOwnerPermissions() [código, não banco]
Se User.roleId !== null → Role.permissions [banco]
      ↓
SessionContext = { tenantId, userId, isOwner, permissions: Record<string, string[]> }
```

Cache via `React.cache` (escopo de request) — no máximo 1 query por request, não por sub-component.

`app_metadata` do Supabase passa a guardar apenas `tenantId` e `userId`. Role e permissions saem do JWT.

### `buildOwnerPermissions()`

```ts
function buildOwnerPermissions(): Record<string, string[]> {
  return Object.fromEntries(
    NAV_REGISTRY.map(section => [section.key, section.actions])
  )
}
```

Derivado do registry — quando nova tela entra no registry, OWNER ganha acesso automaticamente.

### Novo `SessionContext`

```ts
type SessionContext = {
  tenantId: string
  userId: string
  isOwner: boolean
  permissions: Record<string, string[]>
}
```

### Hook `usePermissions` — sem hardcode

```ts
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

---

## Backend

### Novos endpoints

```
GET    /api/iam/roles              Lista cargos do tenant (com contagem de usuários)
POST   /api/iam/roles              Cria novo cargo
PUT    /api/iam/roles/[id]         Edita nome e/ou permissões
DELETE /api/iam/roles/[id]         Exclui cargo (bloqueia se tiver usuários)
GET    /api/iam/nav-sections       NAV_REGISTRY filtrado pelo plano do tenant
```

Endpoints existentes de convite e equipe passam a aceitar `roleId: string` no payload.

### RoleService — regras de negócio

**`createRole(tenantId, { name, permissions })`**
- Verifica limite do plano via `ROLE_LIMITS`
- Valida que todas as `sectionKey` existem no `NAV_REGISTRY`
- Valida que todas as `actions` são válidas para cada seção
- Valida que seções em `permissions` estão liberadas pelo plano do tenant

**`updateRole(tenantId, roleId, { name?, permissions? })`**
- Verifica que `roleId` pertence ao tenant (tenancy check)
- Mesma validação de permissões do create
- UPDATE único em `Role` — todos os usuários do cargo refletem na próxima request

**`deleteRole(tenantId, roleId)`**
- Bloqueia com `ForbiddenError` se `User.count({ roleId }) > 0`
- Mensagem: `"Cargo possui X usuários vinculados. Reatribua-os antes de excluir."`

**`listRoles(tenantId)`**
- Retorna cargos com `_count` de usuários em cada um

### Limites por plano

```ts
const ROLE_LIMITS: Record<PlanName, number> = {
  FREE:       3,
  STARTER:    3,
  PRO:        5,
  ENTERPRISE: Infinity,
}
```

### Seed de cargos padrão

Na `IamRepository.createTenantWithOwner`, dentro da transaction existente:

```ts
await tx.role.createMany({
  data: buildDefaultRoles(tenant.id)
})

function buildDefaultRoles(tenantId: string) {
  const presets = ['MANAGER', 'PROFESSIONAL', 'RECEPTIONIST'] as const
  const labels = { MANAGER: 'Gerente', PROFESSIONAL: 'Profissional', RECEPTIONIST: 'Recepcionista' }

  return presets.map(preset => ({
    tenantId,
    name: labels[preset],
    isDefault: true,
    permissions: Object.fromEntries(
      NAV_REGISTRY.map(s => [s.key, s.defaultPermissions[preset]])
    ),
  }))
}
```

---

## Frontend

### Nova aba em Configurações

Sétima aba `cargos` na página `/configuracoes`, visível apenas para OWNER.

```
Negócio | Horários | WhatsApp | Layout | Financeiro | CRM | Cargos
```

### Layout da tela de Cargos

```
┌─────────────────────┬────────────────────────────────────────┐
│ Lista de cargos     │ Painel de edição                       │
│                     │                                         │
│ Gerente         [✏] │ Nome: [Gerente              ]          │
│ 3 usuários          │                                         │
│                     │ Tela         Visualizar Criar Editar Excluir│
│ Profissional    [✏] │ ──────────────────────────────────────  │
│ 5 usuários          │ Agenda           ✅      ✅    ✅    ✅  │
│                     │ Clientes         ✅      ✅    ✅    ☐   │
│ Recepcionista   [✏] │ Financeiro       ✅      ✅    ✅    ☐   │
│ 2 usuários          │ Serviços         ✅      ✅    ✅    ✅  │
│                     │ Relatórios       ✅      –     –     –   │
│ [+ Novo cargo]      │ Equipe           ☐       –     –     –   │
│                     │ Configurações    ✅      –     ✅    –   │
│                     │                                         │
│                     │                  [Cancelar]  [Salvar]   │
└─────────────────────┴────────────────────────────────────────┘
```

### Regras da matriz de permissões

- `Visualizar` é pré-requisito: marcar qualquer ação marca `Visualizar` automaticamente
- Desmarcar `Visualizar` desmarca todas as ações da seção
- Ações inexistentes para a seção (ex: Relatórios sem `Criar`) mostram `–` (não checkbox)
- Seções não liberadas pelo plano do tenant não aparecem na lista
- Cargo com usuários: botão excluir desabilitado com tooltip explicativo
- Novo cargo parte de uma matriz totalmente em branco (exceto `view` em `agenda`)

### Componentes novos

```
src/components/domain/iam/
  roles-manager.tsx          Lista lateral de cargos com contagem de usuários
  role-editor.tsx            Painel direito — formulário de nome + matriz
  role-permission-matrix.tsx Tabela de checkboxes com lógica de pré-requisito
  role-delete-button.tsx     Botão com guard de usuários vinculados

src/hooks/iam/
  use-roles.ts               useRoles(), useCreateRole(), useUpdateRole(), useDeleteRole()
  use-nav-sections.ts        useNavSections() → GET /api/iam/nav-sections
```

### Sidebar dinâmico

```ts
const visibleSections = NAV_REGISTRY.filter(section =>
  planAllows(section.key) && canAccess(section.key)
)
```

Items invisíveis para o cargo ficam ocultos no menu (não apenas bloqueados).

### Modal de convite atualizado

`InviteMemberModal` carrega cargos via `useRoles()` e envia `roleId: string` no payload, substituindo o enum hardcoded.

---

## Migração (3 PRs sequenciais, zero downtime)

### PR 1 — Schema aditivo

- Adiciona tabelas `Role` e `PlanFeatureConfig`
- Adiciona `User.roleId String?` (nullable)
- Script de seed: cria 3 cargos padrão para cada tenant existente
- Script de migração: preenche `User.roleId` para todos os usuários não-OWNER

### PR 2 — Código novo convive com antigo

- `getSessionContext` resolve de `Role` se `roleId` existir; fallback para `ROLE_PERMISSIONS` hardcoded
- Nova aba "Cargos" em Configurações entra em produção
- Sidebar e modal de convite atualizados
- Novos convites já usam `roleId`

### PR 3 — Limpeza (após validar em produção)

- Remove fallback hardcoded do `getSessionContext`
- Remove `ROLE_PERMISSIONS` de `permissions.ts` e do hook
- Remove hardcode do `invite-member-modal`
- `User.permissions: String[]` pode ser removido do schema neste passo

---

## Segurança

| Risco | Guardrail |
|---|---|
| Acesso cross-tenant | `RoleRepository` filtra `tenantId` em todas as queries |
| Privilege escalation | Apenas `isOwner` pode criar/editar/deletar cargos |
| Payload inválido | `RoleService` valida `sectionKey` e `actions` contra `NAV_REGISTRY` |
| Exclusão com usuários vinculados | `deleteRole` verifica count antes de deletar |
| Acesso à `PlanFeatureConfig` | Rota de Admin protegida por flag de super-admin no `app_metadata` |
| Limite de plano ultrapassado | `createRole` verifica `ROLE_LIMITS[plan]` antes de inserir |

---

## Fora do escopo deste feature

- Tela de Admin do sistema para configurar `PlanFeatureConfig` por plano
- Permissões no nível de sub-página (ex: Financeiro/Transações vs Financeiro/Despesas separados)
- Override de permissões por usuário individual (cargo é o único nível)
- Auditoria de alterações de cargos (log de quem alterou o quê)
