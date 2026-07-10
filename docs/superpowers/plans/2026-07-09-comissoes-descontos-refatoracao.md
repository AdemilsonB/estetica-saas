# Comissões (Equipe) e Descontos (Serviços) — Refatoração — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mover "Comissões" da aba Serviços para a página Equipe (com aplicação em massa por cargo) e dar a "Descontos" um ponto de entrada visível em Serviços, com permissões RBAC próprias e infraestrutura de gate por plano.

**Architecture:** Duas novas chaves de permissão (`comissoes`, `descontos`) vivem num registro paralelo ao `NAV_REGISTRY` (não geram item de sidebar), validadas pelo `role.service.ts` e consumidas via `ensurePermission`/`usePermissions().can()` do jeito já existente no projeto. A grade de comissões (`CommissionsGrid`) e o gerenciador de descontos (`DiscountTypesManager`) são reaproveitados quase sem mudança, só ganhando `readOnly` e novos pontos de entrada (botão em Equipe, botão em Serviços). Uma ação nova de "aplicar taxa a todos do cargo" grava registros reais de `ServiceCommission` em lote, sem mudar o modelo de dados.

**Tech Stack:** Next.js 15 App Router, Prisma, Zod, TanStack Query, shadcn/ui (Dialog, Sheet), Vitest + vitest-mock-extended.

## Global Constraints

- Todo output (código, comentários, commits, textos de UI) em Português do Brasil.
- Multi-tenancy: toda query nova filtra por `tenantId`; `tenantId` sempre vem da sessão (`getSessionContext`), nunca do body/URL.
- TypeScript strict — sem `any`.
- Zod para validação de input em toda API Route nova.
- Erros tipados de `src/shared/errors` — nunca `throw new Error('string')`.
- Commits atômicos por task, seguindo Conventional Commits (`feat(...)`, `refactor(...)`, `test(...)`), sem `--no-verify`.
- Branch: `refactor/comissoes-descontos-equipe-servicos` (criar a partir de `main` atualizada antes da Task 1).
- Testes automatizados neste projeto cobrem apenas service/repository/API route (não há testes de componente React) — siga esse padrão: cada mudança de UI é validada por `npx tsc --noEmit` + verificação manual/mobile, não por teste unitário de componente.

---

### Task 0: Criar branch de trabalho

**Files:** nenhum (comando git)

- [ ] **Step 1:** Atualizar `main` e criar a branch

```bash
git checkout main
git pull origin main
git checkout -b refactor/comissoes-descontos-equipe-servicos
```

---

### Task 1: Registro de permissões extras (`comissoes`, `descontos`)

**Files:**
- Create: `src/shared/permissions/extra-permission-registry.ts`
- Modify: `src/shared/permissions/capability-registry.ts`

**Interfaces:**
- Produces: `EXTRA_PERMISSION_REGISTRY: NavSection[]` (chaves `comissoes`, `descontos`, cada uma com `actions: ['view','edit']`), `buildDefaultExtraPermissions(preset): Record<string,string[]>`. Usados pelas Tasks 2, 4 e 5.

- [ ] **Step 1: Criar o registro**

```ts
// src/shared/permissions/extra-permission-registry.ts
import type { NavSection } from './nav-registry'

export const EXTRA_PERMISSION_REGISTRY: NavSection[] = [
  {
    key: 'comissoes',
    label: 'Comissões',
    description: 'Comissão de cada profissional por serviço',
    icon: 'Percent',
    href: '',
    actions: ['view', 'edit'],
    defaultPermissions: {
      MANAGER:      ['view', 'edit'],
      PROFESSIONAL: [],
      RECEPTIONIST: [],
    },
  },
  {
    key: 'descontos',
    label: 'Descontos',
    description: 'Tipos de desconto aplicáveis em atendimentos',
    icon: 'BadgePercent',
    href: '',
    actions: ['view', 'edit'],
    defaultPermissions: {
      MANAGER:      ['view', 'edit'],
      PROFESSIONAL: ['view', 'edit'],
      RECEPTIONIST: ['view'],
    },
  },
]

export function buildDefaultExtraPermissions(
  preset: 'MANAGER' | 'PROFESSIONAL' | 'RECEPTIONIST',
): Record<string, string[]> {
  return Object.fromEntries(
    EXTRA_PERMISSION_REGISTRY.map((s) => [s.key, [...s.defaultPermissions[preset]]]),
  )
}
```

`comissoes` fica restrita a MANAGER por padrão (PROFESSIONAL/RECEPTIONIST sem acesso) — corrige a exposição de dado sensível descrita na spec. `descontos` mantém o padrão mais aberto que já existia via `configuracoes`.

- [ ] **Step 2: Registrar as duas chaves como capabilities gateáveis por plano**

Em `src/shared/permissions/capability-registry.ts`, adicionar ao array `CAPABILITY_ENTRIES` (depois da entrada `reports_advanced`, linha ~45):

```ts
  { key: 'comissoes', label: 'Comissões da equipe', category: 'capability', essential: false, benefitLabel: 'Comissão por profissional e por cargo', status: 'ga', group: CAPABILITY_GROUPS.ACESSO },
  { key: 'descontos', label: 'Descontos configuráveis', category: 'capability', essential: false, benefitLabel: 'Tipos de desconto no atendimento', status: 'ga', group: CAPABILITY_GROUPS.OPERACAO },
```

- [ ] **Step 3: Verificar tipos**

```bash
npx tsc --noEmit
```
Expected: sem erros novos relacionados a este arquivo.

- [ ] **Step 4: Commit**

```bash
git add src/shared/permissions/extra-permission-registry.ts src/shared/permissions/capability-registry.ts
git commit -m "feat(iam): adiciona registro de permissões extras comissoes/descontos"
```

---

### Task 2: `role.service.ts` e `session.ts` reconhecem as chaves extras

**Files:**
- Modify: `src/domains/iam/role.service.ts`
- Modify: `src/domains/iam/role.service.test.ts`
- Modify: `src/shared/auth/session.ts`

**Interfaces:**
- Consumes: `EXTRA_PERMISSION_REGISTRY`, `buildDefaultExtraPermissions` (Task 1).

- [ ] **Step 1: Escrever teste que falha — seção extra deve ser aceita na validação**

Adicionar ao final do `describe('createRole', ...)` em `src/domains/iam/role.service.test.ts`:

```ts
    it('aceita seção extra "comissoes" (fora do NAV_REGISTRY)', async () => {
      vi.mocked(repo.countByTenant).mockResolvedValue(1)
      vi.mocked(repo.create).mockResolvedValue(fakeRole as any)
      await expect(
        service.createRole(TENANT_ID, {
          name: 'Novo',
          permissions: { comissoes: ['view', 'edit'] },
        })
      ).resolves.toBeDefined()
    })

    it('lança ValidationError quando a ação não existe para a seção extra "comissoes"', async () => {
      vi.mocked(repo.countByTenant).mockResolvedValue(1)
      await expect(
        service.createRole(TENANT_ID, {
          name: 'Novo',
          permissions: { comissoes: ['delete' as any] },
        })
      ).rejects.toThrow(ValidationError)
    })
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx vitest run src/domains/iam/role.service.test.ts
```
Expected: FAIL em `aceita seção extra "comissoes"` com `ValidationError: Seção "comissoes" não existe no sistema.`

- [ ] **Step 3: Implementar — `role.service.ts` passa a validar contra `NAV_REGISTRY ∪ EXTRA_PERMISSION_REGISTRY`**

Em `src/domains/iam/role.service.ts`, trocar o import (linha 4):

```ts
import { NAV_REGISTRY, buildDefaultRolePermissions } from '@/shared/permissions/nav-registry'
import { EXTRA_PERMISSION_REGISTRY, buildDefaultExtraPermissions } from '@/shared/permissions/extra-permission-registry'
```

No método `listRoles`, trocar (linha 32):

```ts
        permissions: buildDefaultRolePermissions(preset),
```
por:
```ts
        permissions: {
          ...buildDefaultRolePermissions(preset),
          ...buildDefaultExtraPermissions(preset),
        },
```

No método `validatePermissions`, trocar (linha 84):

```ts
    const registryMap = new Map(NAV_REGISTRY.map((s) => [s.key, s.actions]))
```
por:
```ts
    const registryMap = new Map(
      [...NAV_REGISTRY, ...EXTRA_PERMISSION_REGISTRY].map((s) => [s.key, s.actions]),
    )
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npx vitest run src/domains/iam/role.service.test.ts
```
Expected: PASS em todos os testes do arquivo.

- [ ] **Step 5: Atualizar fallback legado de sessão (`session.ts`)**

Usuários sem `roleId` (migração pendente) caem no fallback `LEGACY_ROLE_PERMISSIONS`. Sem esta mudança, esses usuários perderiam acesso a Comissões/Descontos mesmo quando já tinham (via `configuracoes`) antes desta refatoração. Em `src/shared/auth/session.ts`, trocar (linhas 18-22):

```ts
const LEGACY_ROLE_PERMISSIONS: Record<string, Record<string, string[]>> = {
  MANAGER:      { agenda: ['view','create','edit','delete'], servicos: ['view','create','edit','delete'], clientes: ['view','create','edit'], financeiro: ['view','create','edit'], relatorios: ['view'], equipe: ['view'], configuracoes: ['view','edit'] },
  PROFESSIONAL: { agenda: ['view','create'], servicos: ['view'], clientes: ['view'] },
  RECEPTIONIST: { agenda: ['view','create','edit'], servicos: ['view'], clientes: ['view','create','edit'] },
}
```
por:
```ts
const LEGACY_ROLE_PERMISSIONS: Record<string, Record<string, string[]>> = {
  MANAGER:      { agenda: ['view','create','edit','delete'], servicos: ['view','create','edit','delete'], clientes: ['view','create','edit'], financeiro: ['view','create','edit'], relatorios: ['view'], equipe: ['view'], configuracoes: ['view','edit'], comissoes: ['view','edit'], descontos: ['view','edit'] },
  PROFESSIONAL: { agenda: ['view','create'], servicos: ['view'], clientes: ['view'], descontos: ['view','edit'] },
  RECEPTIONIST: { agenda: ['view','create','edit'], servicos: ['view'], clientes: ['view','create','edit'], descontos: ['view'] },
}
```

Não há teste automatizado para `session.ts` hoje (arquivo de integração com cookies/Supabase) — validar manualmente com um usuário de teste sem `roleId`, se disponível, ou via revisão de código.

- [ ] **Step 6: Verificar tipos e rodar toda a suíte do domínio iam**

```bash
npx tsc --noEmit
npx vitest run src/domains/iam
```
Expected: sem erros de tipo; todos os testes passando.

- [ ] **Step 7: Commit**

```bash
git add src/domains/iam/role.service.ts src/domains/iam/role.service.test.ts src/shared/auth/session.ts
git commit -m "feat(iam): valida e propaga permissoes extras comissoes/descontos"
```

---

### Task 3: API + hook para expor as permissões extras (matriz de Cargos)

**Files:**
- Create: `src/app/api/iam/extra-permissions/route.ts`
- Create: `src/app/api/iam/extra-permissions/route.test.ts`
- Create: `src/hooks/iam/use-extra-permissions.ts`

**Interfaces:**
- Consumes: `EXTRA_PERMISSION_REGISTRY` (Task 1), `featureGuard.resolveGate(tenantId, key)` (já existe em `src/domains/billing/feature-guard.ts`).
- Produces: `GET /api/iam/extra-permissions` → `ExtraPermissionWithLock[]`; `useExtraPermissions()` hook. Consumido pela Task 4.

- [ ] **Step 1: Escrever o teste da rota (falha por não existir ainda)**

```ts
// src/app/api/iam/extra-permissions/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const getSessionContext = vi.fn();
vi.mock("@/shared/auth/session", () => ({ getSessionContext: (...a: unknown[]) => getSessionContext(...a) }));
vi.mock("@/app/api/_lib/runtime", () => ({ initializeDomainRuntime: () => {} }));
const resolveGate = vi.fn();
vi.mock("@/domains/billing/feature-guard", () => ({
  featureGuard: { resolveGate: (...a: unknown[]) => resolveGate(...a) },
}));

import { GET } from "./route";

describe("GET /api/iam/extra-permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionContext.mockResolvedValue({ tenantId: "t1", userId: "u1" });
    resolveGate.mockResolvedValue({ allowed: true, currentPlan: "PRO", requiredPlan: null, requiredPlanLabel: null });
  });

  it("retorna as duas seções extras com o gate resolvido", async () => {
    const res = await GET(new Request("http://x/api/iam/extra-permissions"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.map((s: { key: string }) => s.key)).toEqual(["comissoes", "descontos"]);
    expect(body[0].locked).toBe(false);
  });

  it("marca locked quando o gate nega acesso", async () => {
    resolveGate.mockResolvedValue({ allowed: false, currentPlan: "FREE", requiredPlan: "PRO", requiredPlanLabel: "Pro" });
    const res = await GET(new Request("http://x/api/iam/extra-permissions"));
    const body = await res.json();
    expect(body[0].locked).toBe(true);
    expect(body[0].requiredPlanLabel).toBe("Pro");
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx vitest run src/app/api/iam/extra-permissions/route.test.ts
```
Expected: FAIL — módulo `./route` não existe.

- [ ] **Step 3: Implementar a rota**

```ts
// src/app/api/iam/extra-permissions/route.ts
import { EXTRA_PERMISSION_REGISTRY } from '@/shared/permissions/extra-permission-registry'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { featureGuard } from '@/domains/billing/feature-guard'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)

    const sections = await Promise.all(
      EXTRA_PERMISSION_REGISTRY.map(async (s) => {
        const gate = await featureGuard.resolveGate(session.tenantId, s.key)
        return {
          ...s,
          locked: !gate.allowed,
          requiredPlan: gate.requiredPlan,
          requiredPlanLabel: gate.requiredPlanLabel,
        }
      }),
    )

    return Response.json(sections)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npx vitest run src/app/api/iam/extra-permissions/route.test.ts
```
Expected: PASS nos dois testes.

- [ ] **Step 5: Criar o hook**

```ts
// src/hooks/iam/use-extra-permissions.ts
import { useQuery } from '@tanstack/react-query'
import type { NavSection } from '@/shared/permissions/nav-registry'

export type ExtraPermissionWithLock = NavSection & {
  locked: boolean
  requiredPlan: string | null
  requiredPlanLabel: string | null
}

async function fetchExtraPermissions(): Promise<ExtraPermissionWithLock[]> {
  const res = await fetch('/api/iam/extra-permissions')
  if (!res.ok) throw new Error('Falha ao carregar permissões extras')
  return res.json()
}

export function useExtraPermissions() {
  return useQuery({
    queryKey: ['extra-permissions'],
    queryFn: fetchExtraPermissions,
    staleTime: 5 * 60 * 1000,
  })
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/iam/extra-permissions src/hooks/iam/use-extra-permissions.ts
git commit -m "feat(iam): expõe rota e hook de permissões extras (comissoes/descontos)"
```

---

### Task 4: Matriz de Cargos mostra "Permissões extras"

**Files:**
- Modify: `src/components/domain/iam/role-editor.tsx`

**Interfaces:**
- Consumes: `useExtraPermissions()` (Task 3), `RolePermissionMatrix` (já existe, sem mudança de assinatura).

- [ ] **Step 1: Adicionar o bloco "Permissões extras" ao editor de cargo**

Em `src/components/domain/iam/role-editor.tsx`, adicionar o import:

```ts
import { useExtraPermissions } from '@/hooks/iam/use-extra-permissions'
```

Dentro do componente, logo após a linha `const updateRole = useUpdateRole()`:

```ts
  const { data: extraSections = [] } = useExtraPermissions()
```

E no JSX, imediatamente depois do bloco `<RolePermissionMatrix sections={sections} .../>` (antes do bloco `RoleFilterPermissions`):

```tsx
      {extraSections.length > 0 && (
        <div>
          <p className="mb-3 text-sm font-medium text-slate-700">Permissões extras</p>
          <RolePermissionMatrix
            sections={extraSections}
            permissions={permissions}
            onChange={setPermissions}
            disabled={updateRole.isPending}
          />
        </div>
      )}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```
Expected: sem erros.

- [ ] **Step 3: Verificação manual**

Rodar o app (`npm run dev`), abrir Equipe → Cargos → editar um cargo, e confirmar que aparece a seção "Permissões extras" com as linhas Comissões/Descontos e os toggles Ver/Editar funcionando (marcar, salvar, reabrir e confirmar persistência).

- [ ] **Step 4: Commit**

```bash
git add src/components/domain/iam/role-editor.tsx
git commit -m "feat(iam): exibe permissoes extras na matriz de cargos"
```

---

### Task 5: `CommissionRepository.applyRateToRole` — aplicar comissão em massa por cargo

**Files:**
- Modify: `src/domains/financial/commission.repository.ts`
- Create: `src/domains/financial/commission.repository.test.ts`

**Interfaces:**
- Consumes: `prisma.user.findMany`, `prisma.$transaction`, `prisma.serviceCommission.upsert` (via `prismaMock`).
- Produces: `commissionRepository.applyRateToRole(tenantId: string, roleId: string, rate: number): Promise<{ applied: number }>`. Consumido pela Task 6.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/domains/financial/commission.repository.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { prismaMock } from '@/shared/test/prisma-mock'
import { Prisma } from '@prisma/client'
import { CommissionRepository } from './commission.repository'

const TENANT_ID = 'tenant-abc'
const ROLE_ID = 'role-barbeiro'

describe('CommissionRepository.applyRateToRole', () => {
  let repo: CommissionRepository

  beforeEach(() => {
    repo = new CommissionRepository()
    prismaMock.$transaction.mockImplementation((ops: unknown) =>
      Promise.all(ops as Promise<unknown>[]),
    )
  })

  it('aplica a taxa a cada serviço vinculado de cada profissional do cargo', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'user-1', professionalServices: [{ serviceId: 'svc-1' }, { serviceId: 'svc-2' }] },
      { id: 'user-2', professionalServices: [{ serviceId: 'svc-1' }] },
    ] as any)
    prismaMock.serviceCommission.upsert.mockResolvedValue({} as any)

    const result = await repo.applyRateToRole(TENANT_ID, ROLE_ID, 40)

    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT_ID, roleId: ROLE_ID },
      select: { id: true, professionalServices: { select: { serviceId: true } } },
    })
    expect(prismaMock.serviceCommission.upsert).toHaveBeenCalledTimes(3)
    expect(prismaMock.serviceCommission.upsert).toHaveBeenCalledWith({
      where: { tenantId_serviceId_professionalId: { tenantId: TENANT_ID, serviceId: 'svc-1', professionalId: 'user-1' } },
      update: { rate: new Prisma.Decimal(40) },
      create: { tenantId: TENANT_ID, serviceId: 'svc-1', professionalId: 'user-1', rate: new Prisma.Decimal(40) },
    })
    expect(result).toEqual({ applied: 3 })
  })

  it('não chama upsert nem $transaction quando ninguém do cargo tem serviço vinculado', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'user-1', professionalServices: [] },
    ] as any)

    const result = await repo.applyRateToRole(TENANT_ID, ROLE_ID, 40)

    expect(prismaMock.serviceCommission.upsert).not.toHaveBeenCalled()
    expect(result).toEqual({ applied: 0 })
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx vitest run src/domains/financial/commission.repository.test.ts
```
Expected: FAIL — `repo.applyRateToRole is not a function`.

- [ ] **Step 3: Implementar**

Adicionar ao final da classe `CommissionRepository`, em `src/domains/financial/commission.repository.ts` (antes do `}` de fechamento, depois de `findRate`):

```ts
  async applyRateToRole(tenantId: string, roleId: string, rate: number) {
    const users = await prisma.user.findMany({
      where: { tenantId, roleId },
      select: { id: true, professionalServices: { select: { serviceId: true } } },
    });

    const pairs = users.flatMap((u) =>
      u.professionalServices.map((ps) => ({ serviceId: ps.serviceId, professionalId: u.id })),
    );

    if (pairs.length === 0) return { applied: 0 };

    await prisma.$transaction(
      pairs.map(({ serviceId, professionalId }) =>
        prisma.serviceCommission.upsert({
          where: { tenantId_serviceId_professionalId: { tenantId, serviceId, professionalId } },
          update: { rate: new Prisma.Decimal(rate) },
          create: { tenantId, serviceId, professionalId, rate: new Prisma.Decimal(rate) },
        }),
      ),
    );

    return { applied: pairs.length };
  }
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npx vitest run src/domains/financial/commission.repository.test.ts
```
Expected: PASS nos dois testes.

- [ ] **Step 5: Commit**

```bash
git add src/domains/financial/commission.repository.ts src/domains/financial/commission.repository.test.ts
git commit -m "feat(financial): aplica comissao em massa para todos profissionais de um cargo"
```

---

### Task 6: Rotas de Comissões — nova permissão `comissoes` + endpoint de aplicação em massa

**Files:**
- Modify: `src/app/api/settings/commissions/route.ts`
- Modify: `src/app/api/settings/commissions/[id]/route.ts`
- Create: `src/app/api/settings/commissions/route.test.ts`
- Create: `src/app/api/settings/commissions/apply-role/route.ts`
- Create: `src/app/api/settings/commissions/apply-role/route.test.ts`
- Modify: `src/hooks/settings/use-commissions.ts`

**Interfaces:**
- Consumes: `commissionRepository.applyRateToRole` (Task 5).
- Produces: `POST /api/settings/commissions/apply-role`, `useApplyCommissionToRole()`. Consumido pela Task 8.

- [ ] **Step 1: Escrever teste que falha para a checagem de permissão em `commissions/route.ts`**

```ts
// src/app/api/settings/commissions/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const getSessionContext = vi.fn();
vi.mock("@/shared/auth/session", () => ({ getSessionContext: (...a: unknown[]) => getSessionContext(...a) }));
vi.mock("@/app/api/_lib/runtime", () => ({ initializeDomainRuntime: () => {} }));
const listByTenant = vi.fn();
vi.mock("@/domains/financial/commission.repository", () => ({
  commissionRepository: { listByTenant: (...a: unknown[]) => listByTenant(...a) },
}));

import { GET } from "./route";

describe("GET /api/settings/commissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna 200 quando o usuário tem comissoes:view", async () => {
    getSessionContext.mockResolvedValue({
      tenantId: "t1", userId: "u1", isOwner: false, permissions: { comissoes: ["view"] },
    });
    listByTenant.mockResolvedValue([]);

    const res = await GET(new Request("http://x/api/settings/commissions"));

    expect(res.status).toBe(200);
    expect(listByTenant).toHaveBeenCalledWith("t1");
  });

  it("retorna 403 quando falta comissoes:view (mesmo tendo configuracoes:view)", async () => {
    getSessionContext.mockResolvedValue({
      tenantId: "t1", userId: "u1", isOwner: false, permissions: { configuracoes: ["view", "edit"] },
    });

    const res = await GET(new Request("http://x/api/settings/commissions"));

    expect(res.status).toBe(403);
    expect(listByTenant).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx vitest run src/app/api/settings/commissions/route.test.ts
```
Expected: FAIL no segundo teste (hoje a rota usa `settings:view`, então `configuracoes:view,edit` concede acesso — 200 em vez de 403).

- [ ] **Step 3: Implementar — trocar a permissão em `commissions/route.ts` e `[id]/route.ts`**

Em `src/app/api/settings/commissions/route.ts`, remover o import de `PERMISSIONS` (trocar linha 3):

```ts
import { ensurePermission } from "@/shared/auth/permissions";
```

E trocar as duas checagens:

```ts
    ensurePermission(session, PERMISSIONS.settings.view);
```
por
```ts
    ensurePermission(session, "comissoes", "view");
```
```ts
    ensurePermission(session, PERMISSIONS.settings.manage);
```
por
```ts
    ensurePermission(session, "comissoes", "edit");
```

Em `src/app/api/settings/commissions/[id]/route.ts`, mesma troca de import e:
```ts
    ensurePermission(session, PERMISSIONS.settings.manage);
```
por
```ts
    ensurePermission(session, "comissoes", "edit");
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npx vitest run src/app/api/settings/commissions/route.test.ts
```
Expected: PASS nos dois testes.

- [ ] **Step 5: Escrever teste que falha para o endpoint de aplicação em massa**

```ts
// src/app/api/settings/commissions/apply-role/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const getSessionContext = vi.fn();
vi.mock("@/shared/auth/session", () => ({ getSessionContext: (...a: unknown[]) => getSessionContext(...a) }));
vi.mock("@/app/api/_lib/runtime", () => ({ initializeDomainRuntime: () => {} }));
const applyRateToRole = vi.fn();
vi.mock("@/domains/financial/commission.repository", () => ({
  commissionRepository: { applyRateToRole: (...a: unknown[]) => applyRateToRole(...a) },
}));

import { POST } from "./route";

const ROLE_ID_CUID = "cabcdefghijklmnopqrstuvwx";

function makeRequest(body: unknown) {
  return new Request("http://x/api/settings/commissions/apply-role", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/settings/commissions/apply-role", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aplica a taxa quando o usuário tem comissoes:edit", async () => {
    getSessionContext.mockResolvedValue({
      tenantId: "t1", userId: "u1", isOwner: false, permissions: { comissoes: ["view", "edit"] },
    });
    applyRateToRole.mockResolvedValue({ applied: 3 });

    const res = await POST(makeRequest({ roleId: ROLE_ID_CUID, rate: 40 }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ applied: 3 });
    expect(applyRateToRole).toHaveBeenCalledWith("t1", ROLE_ID_CUID, 40);
  });

  it("retorna 403 quando falta comissoes:edit", async () => {
    getSessionContext.mockResolvedValue({
      tenantId: "t1", userId: "u1", isOwner: false, permissions: { comissoes: ["view"] },
    });

    const res = await POST(makeRequest({ roleId: ROLE_ID_CUID, rate: 40 }));

    expect(res.status).toBe(403);
    expect(applyRateToRole).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Rodar e confirmar que falha**

```bash
npx vitest run src/app/api/settings/commissions/apply-role/route.test.ts
```
Expected: FAIL — módulo `./route` não existe.

- [ ] **Step 7: Implementar a rota**

```ts
// src/app/api/settings/commissions/apply-role/route.ts
import { z } from "zod";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";
import { commissionRepository } from "@/domains/financial/commission.repository";

const applyRoleSchema = z.object({
  roleId: z.string().cuid(),
  rate: z.number().min(0).max(100),
});

export async function POST(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, "comissoes", "edit");
    const input = await validateInput(request, applyRoleSchema);
    const result = await commissionRepository.applyRateToRole(
      session.tenantId, input.roleId, input.rate,
    );
    return Response.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 8: Rodar e confirmar que passa**

```bash
npx vitest run src/app/api/settings/commissions/apply-role/route.test.ts
```
Expected: PASS nos dois testes.

- [ ] **Step 9: Adicionar o hook de mutation**

Em `src/hooks/settings/use-commissions.ts`, adicionar ao final do arquivo:

```ts
async function applyCommissionToRole(input: { roleId: string; rate: number }) {
  const res = await fetch("/api/settings/commissions/apply-role", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Erro ao aplicar comissão ao cargo");
  return res.json() as Promise<{ applied: number }>;
}

export function useApplyCommissionToRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: applyCommissionToRole,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["commissions"] }),
  });
}
```

- [ ] **Step 10: Rodar toda a suíte afetada**

```bash
npx tsc --noEmit
npx vitest run src/app/api/settings/commissions src/domains/financial
```
Expected: sem erros de tipo; todos os testes passando.

- [ ] **Step 11: Commit**

```bash
git add src/app/api/settings/commissions src/hooks/settings/use-commissions.ts
git commit -m "feat(financial): endpoint e permissao dedicada para comissoes (comissoes:view/edit)"
```

---

### Task 7: Rotas de Descontos — nova permissão `descontos`

**Files:**
- Modify: `src/app/api/settings/discount-types/route.ts`
- Modify: `src/app/api/settings/discount-types/[id]/route.ts`
- Create: `src/app/api/settings/discount-types/route.test.ts`

**Interfaces:** nenhuma nova (só troca de chave de permissão).

- [ ] **Step 1: Escrever teste que falha**

```ts
// src/app/api/settings/discount-types/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const getSessionContext = vi.fn();
vi.mock("@/shared/auth/session", () => ({ getSessionContext: (...a: unknown[]) => getSessionContext(...a) }));
vi.mock("@/app/api/_lib/runtime", () => ({ initializeDomainRuntime: () => {} }));
const list = vi.fn();
vi.mock("@/domains/financial/discount-type.repository", () => ({
  discountTypeRepository: { list: (...a: unknown[]) => list(...a) },
}));

import { GET } from "./route";

describe("GET /api/settings/discount-types", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna 200 quando o usuário tem descontos:view", async () => {
    getSessionContext.mockResolvedValue({
      tenantId: "t1", userId: "u1", isOwner: false, permissions: { descontos: ["view"] },
    });
    list.mockResolvedValue([]);

    const res = await GET(new Request("http://x/api/settings/discount-types"));

    expect(res.status).toBe(200);
    expect(list).toHaveBeenCalledWith("t1", false);
  });

  it("retorna 403 quando falta descontos:view (mesmo tendo configuracoes:view)", async () => {
    getSessionContext.mockResolvedValue({
      tenantId: "t1", userId: "u1", isOwner: false, permissions: { configuracoes: ["view", "edit"] },
    });

    const res = await GET(new Request("http://x/api/settings/discount-types"));

    expect(res.status).toBe(403);
    expect(list).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx vitest run src/app/api/settings/discount-types/route.test.ts
```
Expected: FAIL no segundo teste (hoje `configuracoes:view,edit` concede acesso).

- [ ] **Step 3: Implementar — trocar a permissão nas duas rotas**

Em `src/app/api/settings/discount-types/route.ts`, remover `PERMISSIONS` do import (linha 4) e trocar:
```ts
    ensurePermission(session, PERMISSIONS.settings.view);
```
→
```ts
    ensurePermission(session, "descontos", "view");
```
```ts
    ensurePermission(session, PERMISSIONS.settings.manage);
```
→
```ts
    ensurePermission(session, "descontos", "edit");
```

Em `src/app/api/settings/discount-types/[id]/route.ts`, mesma troca de import e as duas ocorrências:
```ts
    ensurePermission(session, PERMISSIONS.settings.manage);
```
→
```ts
    ensurePermission(session, "descontos", "edit");
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npx vitest run src/app/api/settings/discount-types/route.test.ts
```
Expected: PASS nos dois testes.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/settings/discount-types
git commit -m "fix(financial): descontos usa permissao dedicada descontos:view/edit em vez de configuracoes"
```

---

### Task 8: `CommissionsGrid` — modo somente-leitura + "aplicar a todos do cargo"

**Files:**
- Modify: `src/components/domain/settings/commissions-grid.tsx`

**Interfaces:**
- Consumes: `useRoles()` (`src/hooks/iam/use-roles.ts`, já existe), `useApplyCommissionToRole()` (Task 6).
- Produces: `CommissionsGrid({ readOnly?: boolean })`. Consumido pela Task 10.

- [ ] **Step 1: Reescrever o componente com `readOnly` e o bloco de aplicação em massa**

```tsx
// src/components/domain/settings/commissions-grid.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCommissions, useUpsertCommission, useApplyCommissionToRole } from "@/hooks/settings/use-commissions";
import { useRoles } from "@/hooks/iam/use-roles";
import { useQuery } from "@tanstack/react-query";

async function fetchServices() {
  const res = await fetch("/api/scheduling/services");
  if (!res.ok) throw new Error("Erro");
  return res.json();
}

async function fetchProfessionals() {
  const res = await fetch("/api/iam/users");
  if (!res.ok) throw new Error("Erro");
  return res.json();
}

type Props = { readOnly?: boolean };

export function CommissionsGrid({ readOnly = false }: Props) {
  const { data: commissions = [] } = useCommissions();
  const { data: services = [] } = useQuery({ queryKey: ["services"], queryFn: fetchServices });
  const { data: professionals = [] } = useQuery({ queryKey: ["professionals"], queryFn: fetchProfessionals });
  const { data: roles = [] } = useRoles();
  const upsert = useUpsertCommission();
  const applyToRole = useApplyCommissionToRole();

  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [bulkRoleId, setBulkRoleId] = useState<string>("");
  const [bulkRate, setBulkRate] = useState<string>("");

  function getCellKey(serviceId: string, professionalId: string) {
    return `${serviceId}:${professionalId}`;
  }

  function getCommittedRate(serviceId: string, professionalId: string): string {
    const found = commissions.find(
      (c: { serviceId: string; professionalId: string; rate: number }) =>
        c.serviceId === serviceId && c.professionalId === professionalId,
    );
    return found ? String(Number(found.rate)) : "";
  }

  function getCellValue(serviceId: string, professionalId: string): string {
    const key = getCellKey(serviceId, professionalId);
    return key in localValues ? localValues[key] : getCommittedRate(serviceId, professionalId);
  }

  function handleChange(serviceId: string, professionalId: string, value: string) {
    setLocalValues((prev) => ({ ...prev, [getCellKey(serviceId, professionalId)]: value }));
  }

  function handleBlur(serviceId: string, professionalId: string, value: string) {
    setLocalValues((prev) => {
      const next = { ...prev };
      delete next[getCellKey(serviceId, professionalId)];
      return next;
    });
    if (value === "") return;
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed < 0 || parsed > 100) return;
    upsert.mutate(
      { serviceId, professionalId, rate: parsed },
      { onError: () => toast.error("Erro ao salvar comissão") },
    );
  }

  function handleApplyToRole() {
    const parsed = parseFloat(bulkRate);
    if (!bulkRoleId || isNaN(parsed) || parsed < 0 || parsed > 100) return;
    applyToRole.mutate(
      { roleId: bulkRoleId, rate: parsed },
      {
        onSuccess: ({ applied }) => {
          toast.success(applied > 0 ? `Comissão aplicada a ${applied} combinação(ões)` : "Ninguém desse cargo tem serviço vinculado");
          setBulkRate("");
        },
        onError: () => toast.error("Erro ao aplicar comissão ao cargo"),
      },
    );
  }

  if (!services.length || !professionals.length) {
    return <div className="h-24 animate-pulse rounded-xl bg-slate-100" />;
  }

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <div className="min-w-40 flex-1 space-y-1">
            <p className="text-xs font-medium text-slate-500">Aplicar a todos do cargo</p>
            <Select value={bulkRoleId} onValueChange={setBulkRoleId}>
              <SelectTrigger><SelectValue placeholder="Escolha um cargo..." /></SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            type="number"
            min={0}
            max={100}
            step={1}
            placeholder="%"
            className="w-20"
            value={bulkRate}
            onChange={(e) => setBulkRate(e.target.value)}
          />
          <Button
            type="button"
            size="sm"
            disabled={!bulkRoleId || !bulkRate || applyToRole.isPending}
            onClick={handleApplyToRole}
          >
            {applyToRole.isPending ? "Aplicando..." : "Aplicar"}
          </Button>
        </div>
      )}

      <div className="space-y-3">
        <p className="text-sm font-semibold text-slate-700">Comissões por profissional × serviço (%)</p>
        <div
          className="overflow-x-auto rounded-xl border border-white/80 bg-white/85"
          style={{
            maskImage: 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)',
            WebkitMaskImage: 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)',
          }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Profissional</th>
                {services.map((s: { id: string; name: string }) => (
                  <th key={s.id} className="px-3 py-2 text-center text-xs font-semibold text-slate-500">{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {professionals
                .filter((p: { role: string }) => p.role === "PROFESSIONAL")
                .map((p: { id: string; name: string }) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2 font-medium text-slate-800">{p.name}</td>
                    {services.map((s: { id: string }) => (
                      <td key={s.id} className="px-3 py-2 text-center">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          disabled={readOnly}
                          className="h-8 w-16 text-center"
                          style={{ fontSize: '16px' }}
                          value={getCellValue(s.id, p.id)}
                          placeholder="—"
                          onChange={(e) => handleChange(s.id, p.id, e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onBlur={(e) => handleBlur(s.id, p.id, e.target.value)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400">Deixe em branco para sem comissão. Salva automaticamente ao sair do campo.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/settings/commissions-grid.tsx
git commit -m "feat(financial): CommissionsGrid ganha modo somente-leitura e aplicacao em massa por cargo"
```

---

### Task 9: `DiscountTypesManager` — modo somente-leitura

**Files:**
- Modify: `src/components/domain/settings/discount-types-manager.tsx`

**Interfaces:**
- Produces: `DiscountTypesManager({ readOnly?: boolean })`. Consumido pela Task 11.

- [ ] **Step 1: Adicionar a prop `readOnly` e esconder ações de escrita**

Em `src/components/domain/settings/discount-types-manager.tsx`, trocar a assinatura da função (linha 64):

```ts
export function DiscountTypesManager() {
```
por
```ts
export function DiscountTypesManager({ readOnly = false }: { readOnly?: boolean }) {
```

Envolver o `Dialog` do botão "Novo" (linhas 90-100) com a condição `{!readOnly && (...)}`:

```tsx
        {!readOnly && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5">
                <Plus className="size-3.5" /> Novo
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader><DialogTitle>Novo tipo de desconto</DialogTitle></DialogHeader>
              <DiscountForm onSubmit={handleCreate} loading={create.isPending} />
            </DialogContent>
          </Dialog>
        )}
```

E o botão de arquivar (linhas 119-123):
```tsx
                {!readOnly && d.active && (
                  <Button size="icon" variant="ghost" className="size-7" onClick={() => handleArchive(d.id)}>
                    <Archive className="size-3.5" />
                  </Button>
                )}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/settings/discount-types-manager.tsx
git commit -m "feat(financial): DiscountTypesManager ganha modo somente-leitura"
```

---

### Task 10: Botão "Comissões" na página Equipe

**Files:**
- Modify: `src/app/(app)/equipe/page.tsx`

**Interfaces:**
- Consumes: `CommissionsGrid` (Task 8), `FeatureLock` (`src/components/domain/billing/feature-lock.tsx`, já existe).

- [ ] **Step 1: Adicionar botão, estado e Dialog de Comissões**

Em `src/app/(app)/equipe/page.tsx`, adicionar aos imports:

```ts
import { Percent } from 'lucide-react'
import { CommissionsGrid } from '@/components/domain/settings/commissions-grid'
import { FeatureLock } from '@/components/domain/billing/feature-lock'
```

Dentro do componente, junto com `const [rolesOpen, setRolesOpen] = useState(false)`:

```ts
  const [commissionsOpen, setCommissionsOpen] = useState(false)
  const canViewCommissions = can('comissoes', 'view')
  const canEditCommissions = can('comissoes', 'edit')
```

No cabeçalho, adicionar o botão entre o de "Cargos" e o de "Convidar" (o bloco `{user?.isOwner && (...)}` de Cargos continua igual):

```tsx
          {canViewCommissions && (
            <Button
              variant="outline"
              onClick={() => setCommissionsOpen(true)}
              className="flex-1 rounded-full sm:flex-none"
            >
              <Percent className="size-4" />
              Comissões
            </Button>
          )}
```

E, junto com o `Dialog` de Cargos já existente, adicionar:

```tsx
      <Dialog open={commissionsOpen} onOpenChange={setCommissionsOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Comissões</DialogTitle>
            <DialogDescription>
              Defina a comissão de cada profissional por serviço.
            </DialogDescription>
          </DialogHeader>
          <FeatureLock capability="comissoes">
            <CommissionsGrid readOnly={!canEditCommissions} />
          </FeatureLock>
        </DialogContent>
      </Dialog>
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```
Expected: sem erros.

- [ ] **Step 3: Verificação manual (inclui mobile)**

Rodar `npm run dev`, abrir `/equipe`:
- Como OWNER/MANAGER: botão "Comissões" aparece, abre o Dialog, grade editável, "aplicar a todos do cargo" funciona.
- Como usuário com cargo sem `comissoes:view` (padrão para PROFESSIONAL): botão não aparece.
- Testar em viewport mobile (375px): botões do header não quebram linha de forma estranha, Dialog é utilizável em tela pequena (scroll ok).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/equipe/page.tsx"
git commit -m "feat(equipe): adiciona botao Comissoes com aplicacao em massa por cargo"
```

---

### Task 11: Botão "Descontos" na página Serviços + remoção do bloco "Precificação"

**Files:**
- Create: `src/components/domain/services/discount-types-entry-button.tsx`
- Modify: `src/app/(app)/servicos/page.tsx`

**Interfaces:**
- Consumes: `DiscountTypesManager` (Task 9), `FeatureLock`, `usePermissions()`.

- [ ] **Step 1: Criar o botão de entrada (componente cliente)**

```tsx
// src/components/domain/services/discount-types-entry-button.tsx
'use client'

import { useState } from 'react'
import { Percent } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { DiscountTypesManager } from '@/components/domain/settings/discount-types-manager'
import { FeatureLock } from '@/components/domain/billing/feature-lock'
import { usePermissions } from '@/hooks/use-permissions'

export function DiscountTypesEntryButton() {
  const [open, setOpen] = useState(false)
  const { can, isLoading } = usePermissions()

  if (isLoading || !can('descontos', 'view')) return null

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 rounded-full">
          <Percent className="size-3.5" />
          Descontos
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Descontos</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-4">
          <FeatureLock capability="descontos">
            <DiscountTypesManager readOnly={!can('descontos', 'edit')} />
          </FeatureLock>
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2: Atualizar `servicos/page.tsx` — remover o bloco "Precificação" e adicionar o botão no header**

Trocar o arquivo inteiro por:

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ServiceCatalog } from '@/components/domain/services/service-catalog'
import { PackageCatalog } from '@/components/domain/services/package-catalog'
import { PromotionCatalog } from '@/components/domain/services/promotion-catalog'
import { CategoryCatalog } from '@/components/domain/services/category-catalog'
import { DiscountTypesEntryButton } from '@/components/domain/services/discount-types-entry-button'

export const metadata = { title: 'Serviços · Estética SaaS' }

export default function ServicosPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Serviços</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie seus serviços, pacotes e promoções
          </p>
        </div>
        <DiscountTypesEntryButton />
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Catálogo</p>
        <Tabs defaultValue="servicos">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="categorias">Categorias</TabsTrigger>
            <TabsTrigger value="servicos">Serviços</TabsTrigger>
            <TabsTrigger value="pacotes">Pacotes</TabsTrigger>
            <TabsTrigger value="promocoes">Promoções</TabsTrigger>
          </TabsList>

          <TabsContent value="servicos" className="mt-6">
            <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-foreground">Catálogo de serviços</h2>
              <ServiceCatalog />
            </div>
          </TabsContent>

          <TabsContent value="pacotes" className="mt-6">
            <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-foreground">Pacotes</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Agrupe serviços em pacotes com preço especial.
              </p>
              <PackageCatalog />
            </div>
          </TabsContent>

          <TabsContent value="promocoes" className="mt-6">
            <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-foreground">Promoções</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Crie descontos temporários para serviços ou pacotes.
              </p>
              <PromotionCatalog />
            </div>
          </TabsContent>

          <TabsContent value="categorias" className="mt-6">
            <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-foreground">Categorias de serviços</h2>
              <CategoryCatalog />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verificar tipos**

```bash
npx tsc --noEmit
```
Expected: sem erros.

- [ ] **Step 4: Verificação manual (inclui mobile)**

Rodar `npm run dev`, abrir `/servicos`:
- Botão "Descontos" aparece ao lado do título, sempre visível independente da aba de catálogo selecionada.
- Abre o Sheet lateral com a lista de tipos de desconto; criar/arquivar funciona para quem tem `descontos:edit`.
- Confirmar que a antiga seção "Precificação" não aparece mais.
- Testar em viewport mobile (375px): Sheet ocupa a tela corretamente, alvo de toque do botão é adequado.

- [ ] **Step 5: Commit**

```bash
git add src/components/domain/services/discount-types-entry-button.tsx "src/app/(app)/servicos/page.tsx"
git commit -m "feat(servicos): botao de acesso a Descontos no header, remove bloco Precificacao"
```

---

### Task 12: Seed de `PlanFeatureConfig` para `comissoes`/`descontos` (obrigatório antes de liberar em produção)

**Files:**
- Create: `scripts/seed-plan-features-comissoes-descontos.mjs`

**Contexto crítico:** `FeatureGuard.canAccess` (`src/domains/billing/feature-guard.ts:31-38`) é **opt-in**: se não existir uma linha em `PlanFeatureConfig` com `enabled:true` para um `(plano, sectionKey)`, o acesso é **negado** por padrão. Isso é o oposto do comportamento "opt-out" da validação de RBAC (`role.service.ts`). Como as Tasks 10 e 11 envolvem os novos pontos de entrada com `<FeatureLock capability="comissoes">` / `<FeatureLock capability="descontos">`, **sem este seed a feature ficaria bloqueada para 100% dos tenants assim que o código for pro ar** — o oposto do que foi decidido ("deixar liberado por enquanto"). Este script precisa rodar contra o banco de produção antes ou junto do deploy desta branch.

- [ ] **Step 1: Criar o script idempotente**

```js
// scripts/seed-plan-features-comissoes-descontos.mjs
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const KEYS = ['comissoes', 'descontos']
const PLANS = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE']

async function main() {
  for (const plan of PLANS) {
    for (const sectionKey of KEYS) {
      await prisma.planFeatureConfig.upsert({
        where: { plan_sectionKey: { plan, sectionKey } },
        update: { enabled: true },
        create: { plan, sectionKey, enabled: true },
      })
      console.log(`OK: ${plan} / ${sectionKey} = enabled`)
    }
  }
}

main()
  .catch((err) => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 2: Rodar localmente contra o banco de dev, se acessível na sessão**

```bash
node scripts/seed-plan-features-comissoes-descontos.mjs
```
Expected: 8 linhas "OK: ..." (4 planos × 2 chaves), sem erro. Se o banco de dev não estiver acessível na sessão, marcar este step como pendente e documentar no resumo final — mesma situação já registrada no `CLAUDE.md` para a migration de notificações.

- [ ] **Step 3: Commit do script**

```bash
git add scripts/seed-plan-features-comissoes-descontos.mjs
git commit -m "chore(billing): script de seed para liberar comissoes/descontos em todos os planos"
```

- [ ] **Step 4: Registrar pendência de produção**

Se o Step 2 não pôde rodar contra produção nesta sessão, adicionar ao `CLAUDE.md`, na seção "Próximo passo crítico", a linha:
`- Rodar node scripts/seed-plan-features-comissoes-descontos.mjs em produção antes de considerar Comissões/Descontos liberados (sem isso, FeatureLock bloqueia os dois para todo mundo)`

---

### Task 13: Verificação final e atualização de documentação

**Files:**
- Modify: `CLAUDE.md` (tabela de status dos domínios)
- Modify: `AGENTS.md` (se referenciar a estrutura antiga da aba Serviços)

- [ ] **Step 1: Rodar a suíte completa e o typecheck**

```bash
npx tsc --noEmit
npx vitest run
```
Expected: zero erros de tipo; todos os testes passando (incluindo os novos das Tasks 2, 3, 5, 6, 7).

- [ ] **Step 2: Atualizar a linha de "Serviços" e "IAM" na tabela de status do `CLAUDE.md`**

Refletir que Comissões saiu de Serviços e mora em Equipe, e que Descontos ganhou botão de acesso dedicado; mencionar as permissões `comissoes`/`descontos`.

- [ ] **Step 3: Rodar o checklist `agent-mobile` nos dois novos pontos de entrada**

Confirmar (Task 10 e 11 já cobriram isso manualmente): alvo de toque, scroll em telas pequenas, sem overflow horizontal.

- [ ] **Step 4: Commit da documentação**

```bash
git add CLAUDE.md AGENTS.md
git commit -m "docs: atualiza status dos dominios apos mover comissoes para Equipe"
```

---

## Pendências conhecidas ao final do plano

- Task 12, Step 2 pode não ser executável nesta sessão se o banco de produção/dev não estiver acessível — é bloqueante para o gate por plano funcionar como "liberado por enquanto" (ver contexto crítico na Task 12).
- Abrir PR para `main` seguindo `.claude/BRANCHING.md` assim que todas as tasks acima estiverem verdes.
