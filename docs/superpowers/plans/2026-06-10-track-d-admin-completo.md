# Track D — Admin Panel Completo: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar D1 (detalhe do tenant + ações manuais), D2 (impersonação admin), D3 (snapshots de uso + barras de progresso) e D4 (MRR/ARR via Stripe API) no painel admin do sistema.

**Architecture:** Nova página `/admin/tenants/[tenantId]` com API routes dedicadas para cada ação (block, reset-trial, change-plan, send-message, impersonate). Impersonação usa JWT com `jose` armazenado em `sessionStorage`, interceptado no `getSessionContext()` via header `X-Impersonate-Token`. UsageSnapshot é capturado por job pg-boss mensal. MRR/ARR vem direto da Stripe API com cache de 1h via `unstable_cache`.

**Tech Stack:** Next.js 15 App Router, Prisma, jose@^5, pg-boss, Stripe API, TanStack Query, Shadcn UI

---

## File Map

**Criar:**
- `src/domains/admin/admin.repository.ts` — queries admin-specific (detalhe, block, snapshots)
- `src/domains/admin/admin.repository.test.ts` — testes do repository
- `src/shared/auth/impersonation.ts` — sign/verify JWT de impersonação
- `src/shared/auth/impersonation.test.ts` — testes do JWT
- `src/lib/impersonation-client.ts` — helpers client-side (sessionStorage + fetch patch)
- `src/app/api/admin/tenants/[tenantId]/route.ts` — GET detalhe do tenant
- `src/app/api/admin/tenants/[tenantId]/block/route.ts` — PATCH bloquear/desbloquear
- `src/app/api/admin/tenants/[tenantId]/reset-trial/route.ts` — POST resetar trial
- `src/app/api/admin/tenants/[tenantId]/plan/route.ts` — PATCH mudar plano + status
- `src/app/api/admin/tenants/[tenantId]/send-message/route.ts` — POST enviar mensagem WA
- `src/app/api/admin/tenants/[tenantId]/impersonate/route.ts` — POST criar token de impersonação
- `src/app/api/admin/mrr/route.ts` — GET MRR/ARR via Stripe com cache
- `src/shared/queue/jobs/usage-snapshot.ts` — job pg-boss mensal
- `src/app/(admin)/admin/tenants/[tenantId]/page.tsx` — página detalhe (D1)
- `src/components/admin/impersonation-banner.tsx` — banner de impersonação (D2)
- `src/hooks/admin/use-admin-tenant-detail.ts` — TanStack Query hook
- `src/hooks/admin/use-admin-mrr.ts` — TanStack Query hook

**Modificar:**
- `prisma/schema.prisma` — adicionar model `UsageSnapshot` + relação em `Tenant`
- `src/shared/errors/domain-error.ts` — adicionar `TenantBlockedError`
- `src/shared/types/auth.ts` — adicionar `isImpersonating?: boolean` em `SessionContext`
- `src/shared/auth/session.ts` — checar `isBlocked` + suporte a `X-Impersonate-Token`
- `src/domains/billing/billing.repository.ts` — adicionar `trialEndsAt` em `UpdateSubscriptionData`
- `src/domains/billing/billing.service.ts` — adicionar método `resetTrial(tenantId, adminId)`
- `src/app/api/_lib/runtime.ts` — registrar job `usage-snapshot`
- `src/app/api/admin/tenants/route.ts` — adicionar `isBlocked` + contagem de agendamentos do mês
- `src/hooks/admin/use-admin-tenants.ts` — atualizar tipo `AdminTenant`
- `src/app/(admin)/admin/tenants/page.tsx` — rows clicáveis + badge de bloqueio + barra de uso
- `src/app/(admin)/admin/page.tsx` — adicionar cards MRR/ARR
- `src/app/(app)/layout.tsx` — adicionar `<ImpersonationBanner />`

---

## Task 1: Criar branch + adicionar `UsageSnapshot` ao schema Prisma

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Criar branch de feature**

```bash
git checkout main && git pull
git checkout -b feat/track-d-admin-completo
```

- [ ] **Step 2: Adicionar `UsageSnapshot` ao schema**

Adicionar ao final de `prisma/schema.prisma`, antes do último model:

```prisma
model UsageSnapshot {
  id        String   @id @default(cuid())
  tenantId  String
  limitKey  String
  count     Int
  period    String   // "2026-06" (YYYY-MM)
  createdAt DateTime @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, limitKey, period])
  @@index([tenantId])
}
```

Adicionar relação no model `Tenant` (após `serviceCategories`):

```prisma
  usageSnapshots       UsageSnapshot[]
```

- [ ] **Step 3: Rodar migration**

```bash
npx prisma migrate dev --name add-usage-snapshot
```

Saída esperada: `The following migration(s) have been created and applied...`

- [ ] **Step 4: Verificar geração do client Prisma**

```bash
npx prisma generate
```

Sem erros.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(database): adiciona model UsageSnapshot para snapshots mensais de consumo"
```

---

## Task 2: Infraestrutura compartilhada — erros, tipos e JWT de impersonação

**Files:**
- Modify: `src/shared/errors/domain-error.ts`
- Modify: `src/shared/types/auth.ts`
- Create: `src/shared/auth/impersonation.ts`
- Create: `src/shared/auth/impersonation.test.ts`

- [ ] **Step 1: Escrever teste de impersonação (TDD)**

Criar `src/shared/auth/impersonation.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { signImpersonationToken, verifyImpersonationToken } from './impersonation'

describe('impersonation JWT', () => {
  beforeEach(() => {
    process.env.ADMIN_IMPERSONATE_SECRET = 'test-secret-must-be-at-least-32-chars!!'
  })

  it('assina e verifica um token válido', async () => {
    const token = await signImpersonationToken({ tenantId: 'tenant-1', adminId: 'admin-1' })
    expect(typeof token).toBe('string')

    const payload = await verifyImpersonationToken(token)
    expect(payload.tenantId).toBe('tenant-1')
    expect(payload.adminId).toBe('admin-1')
    expect(payload.isImpersonating).toBe(true)
  })

  it('rejeita token inválido', async () => {
    await expect(verifyImpersonationToken('invalid.token.here')).rejects.toThrow()
  })

  it('rejeita token de outra secret', async () => {
    const token = await signImpersonationToken({ tenantId: 'tenant-1', adminId: 'admin-1' })
    process.env.ADMIN_IMPERSONATE_SECRET = 'outra-secret-completamente-diferente!!'
    await expect(verifyImpersonationToken(token)).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Rodar teste — deve FALHAR**

```bash
npx vitest run src/shared/auth/impersonation.test.ts
```

Esperado: FAIL (arquivo não existe)

- [ ] **Step 3: Instalar `jose`**

```bash
npm install jose
```

- [ ] **Step 4: Criar `src/shared/auth/impersonation.ts`**

```typescript
import { SignJWT, jwtVerify } from 'jose'

const ALG = 'HS256'

function getSecret(): Uint8Array {
  const secret = process.env.ADMIN_IMPERSONATE_SECRET
  if (!secret) throw new Error('ADMIN_IMPERSONATE_SECRET não configurada.')
  return new TextEncoder().encode(secret)
}

export type ImpersonationPayload = {
  tenantId: string
  adminId: string
  isImpersonating: true
}

export async function signImpersonationToken(
  payload: Omit<ImpersonationPayload, 'isImpersonating'>,
): Promise<string> {
  return new SignJWT({ ...payload, isImpersonating: true as const })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime('30m')
    .sign(getSecret())
}

export async function verifyImpersonationToken(token: string): Promise<ImpersonationPayload> {
  const { payload } = await jwtVerify(token, getSecret())
  return payload as unknown as ImpersonationPayload
}
```

- [ ] **Step 5: Rodar teste — deve PASSAR**

```bash
npx vitest run src/shared/auth/impersonation.test.ts
```

Esperado: 3 testes passando.

- [ ] **Step 6: Adicionar `TenantBlockedError` aos erros tipados**

Em `src/shared/errors/domain-error.ts`, adicionar após `CustomerBlockedError`:

```typescript
export class TenantBlockedError extends DomainError {
  constructor() {
    super(
      'Este negócio está suspenso. Entre em contato com o suporte.',
      'TENANT_BLOCKED',
      403,
    )
  }
}
```

- [ ] **Step 7: Adicionar `isImpersonating` ao tipo `SessionContext`**

Em `src/shared/types/auth.ts`:

```typescript
export type SessionContext = {
  tenantId: string
  userId: string
  isOwner: boolean
  permissions: Record<string, string[]>
  isImpersonating?: boolean
}
```

- [ ] **Step 8: Commit**

```bash
git add src/shared/auth/impersonation.ts src/shared/auth/impersonation.test.ts \
        src/shared/errors/domain-error.ts src/shared/types/auth.ts
git commit -m "feat(auth): adiciona JWT de impersonação, TenantBlockedError e isImpersonating no SessionContext"
```

---

## Task 3: Session Context — bloqueio de tenant + suporte a impersonação

**Files:**
- Modify: `src/shared/auth/session.ts`

- [ ] **Step 1: Atualizar `buildSessionFromUserId` para checar `isBlocked`**

Substituir a função `buildSessionFromUserId` em `src/shared/auth/session.ts`:

```typescript
async function buildSessionFromUserId(
  userId: string,
  tenantId: string,
  isImpersonating = false,
): Promise<SessionContext> {
  const [dbUser, dbTenant] = await Promise.all([
    prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: {
        role: true,
        roleId: true,
        customRole: { select: { permissions: true } },
      },
    }),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { isBlocked: true },
    }),
  ])

  if (dbTenant?.isBlocked) throw new TenantBlockedError()

  if (!dbUser) {
    throw new UnauthorizedError('Usuario nao encontrado no tenant.')
  }

  const isOwner = dbUser.role === UserRole.OWNER

  let permissions: Record<string, string[]>
  if (isOwner) {
    permissions = buildOwnerPermissions()
  } else if (dbUser.customRole?.permissions) {
    permissions = dbUser.customRole.permissions as Record<string, string[]>
  } else {
    permissions = buildLegacyPermissions(dbUser.role)
  }

  return { tenantId, userId, isOwner, permissions, isImpersonating }
}
```

Adicionar o import necessário no topo de `session.ts` (após os imports existentes):

```typescript
import { TenantBlockedError } from '@/shared/errors'
import { verifyImpersonationToken } from '@/shared/auth/impersonation'
```

- [ ] **Step 2: Adicionar tratamento do header `X-Impersonate-Token` no topo de `getSessionContext`**

Substituir o início da função `getSessionContext` para adicionar o bloco de impersonação **antes** do bloco de Bearer token:

```typescript
export const getSessionContext = cache(async (request: Request): Promise<SessionContext> => {
  // 0. Impersonação — admin visualizando como dono do tenant
  const impersonateHeader = request.headers.get('x-impersonate-token')
  if (impersonateHeader) {
    const payload = await verifyImpersonationToken(impersonateHeader)

    const [owner, tenant] = await Promise.all([
      prisma.user.findFirst({
        where: { tenantId: payload.tenantId, role: UserRole.OWNER },
        select: { id: true },
      }),
      prisma.tenant.findUnique({
        where: { id: payload.tenantId },
        select: { isBlocked: true },
      }),
    ])

    if (tenant?.isBlocked) throw new TenantBlockedError()
    if (!owner) throw new UnauthorizedError('Owner do tenant não encontrado.')

    return {
      tenantId: payload.tenantId,
      userId: owner.id,
      isOwner: true,
      permissions: buildOwnerPermissions(),
      isImpersonating: true,
    }
  }

  // 1. Bearer token
  const accessToken = extractAccessToken(request)
  // ... resto do código existente permanece igual
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Zero erros.

- [ ] **Step 4: Rodar testes existentes de sessão (se houver)**

```bash
npx vitest run src/domains/iam
```

Todos passando.

- [ ] **Step 5: Commit**

```bash
git add src/shared/auth/session.ts
git commit -m "feat(auth): bloqueio de tenant no SessionContext e suporte a impersonação via X-Impersonate-Token"
```

---

## Task 4: Admin Repository

**Files:**
- Create: `src/domains/admin/admin.repository.ts`
- Create: `src/domains/admin/admin.repository.test.ts`

- [ ] **Step 1: Escrever testes do admin repository (TDD)**

Criar `src/domains/admin/admin.repository.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from '@/shared/test/prisma-mock'

vi.mock('@/shared/database/prisma', () => ({ prisma: prismaMock }))

const { adminRepository } = await import('./admin.repository')

describe('adminRepository.findTenantDetail', () => {
  it('retorna null quando tenant não existe', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue(null)
    const result = await adminRepository.findTenantDetail('inexistente')
    expect(result).toBeNull()
  })

  it('inclui subscription e _count na query', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      name: 'Salão Teste',
      slug: 'salao-teste',
      isBlocked: false,
    } as never)
    await adminRepository.findTenantDetail('tenant-1')
    expect(prismaMock.tenant.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tenant-1' },
        select: expect.objectContaining({ subscription: expect.any(Object) }),
      }),
    )
  })
})

describe('adminRepository.blockTenant / unblockTenant', () => {
  it('blockTenant seta isBlocked=true com motivo', async () => {
    prismaMock.tenant.update.mockResolvedValue({ isBlocked: true } as never)
    await adminRepository.blockTenant('tenant-1', 'inadimplência')
    expect(prismaMock.tenant.update).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      data: { isBlocked: true, blockedReason: 'inadimplência' },
    })
  })

  it('unblockTenant seta isBlocked=false e limpa motivo', async () => {
    prismaMock.tenant.update.mockResolvedValue({ isBlocked: false } as never)
    await adminRepository.unblockTenant('tenant-1')
    expect(prismaMock.tenant.update).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      data: { isBlocked: false, blockedReason: null },
    })
  })
})
```

- [ ] **Step 2: Rodar testes — FAIL**

```bash
npx vitest run src/domains/admin/admin.repository.test.ts
```

Esperado: FAIL (arquivo não existe)

- [ ] **Step 3: Criar `src/domains/admin/admin.repository.ts`**

```typescript
import { prisma } from '@/shared/database/prisma'

export const adminRepository = {
  async findTenantDetail(tenantId: string) {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    return prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        phone: true,
        address: true,
        isBlocked: true,
        blockedReason: true,
        evolutionConnected: true,
        evolutionPhone: true,
        evolutionStatus: true,
        createdAt: true,
        subscription: {
          select: {
            id: true,
            plan: true,
            status: true,
            trialEndsAt: true,
            currentPeriodEnd: true,
            cancelAtPeriodEnd: true,
            stripeCustomerId: true,
            history: {
              orderBy: { createdAt: 'desc' },
              take: 10,
              select: {
                id: true,
                fromPlan: true,
                toPlan: true,
                fromStatus: true,
                toStatus: true,
                reason: true,
                changedBy: true,
                createdAt: true,
              },
            },
          },
        },
        usageSnapshots: {
          where: { period: formatPeriod(now) },
          select: { limitKey: true, count: true, period: true },
        },
        _count: {
          select: {
            appointments: { where: { createdAt: { gte: startOfMonth } } },
            notifications: { where: { createdAt: { gte: startOfMonth } } },
            customers: true,
            users: true,
          },
        },
      },
    })
  },

  async blockTenant(tenantId: string, reason?: string) {
    return prisma.tenant.update({
      where: { id: tenantId },
      data: { isBlocked: true, blockedReason: reason ?? null },
    })
  },

  async unblockTenant(tenantId: string) {
    return prisma.tenant.update({
      where: { id: tenantId },
      data: { isBlocked: false, blockedReason: null },
    })
  },

  async findTenantsWithUsage() {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    return prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        plan: true,
        isBlocked: true,
        createdAt: true,
        _count: {
          select: {
            users: true,
            appointments: { where: { createdAt: { gte: startOfMonth } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  },
}

function formatPeriod(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
```

- [ ] **Step 4: Rodar testes — PASS**

```bash
npx vitest run src/domains/admin/admin.repository.test.ts
```

Esperado: todos passando.

- [ ] **Step 5: Commit**

```bash
git add src/domains/admin/
git commit -m "feat(admin): adiciona AdminRepository com queries de detalhe, block/unblock e uso mensal"
```

---

## Task 5: BillingService — método `resetTrial`

**Files:**
- Modify: `src/domains/billing/billing.repository.ts`
- Modify: `src/domains/billing/billing.service.ts`

- [ ] **Step 1: Atualizar `UpdateSubscriptionData` no repository para incluir `trialEndsAt`**

Em `src/domains/billing/billing.repository.ts`, atualizar o tipo:

```typescript
type UpdateSubscriptionData = {
  plan?: PlanName;
  status?: SubscriptionStatus;
  trialEndsAt?: Date | null;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelledAt?: Date | null;
};
```

- [ ] **Step 2: Adicionar `resetTrial` ao `BillingService`**

Em `src/domains/billing/billing.service.ts`, adicionar após `runExpireSweep()`:

```typescript
async resetTrial(tenantId: string, adminId: string) {
  const now = new Date()
  const trialEndsAt = addDays(now, 14)

  const current = await billingRepository.getSubscription(tenantId)

  const updated = await billingRepository.updateSubscription(tenantId, {
    plan: PlanName.STARTER,
    status: SubscriptionStatus.TRIALING,
    trialEndsAt,
    currentPeriodStart: now,
    currentPeriodEnd: trialEndsAt,
    cancelledAt: null,
  })

  await billingRepository.addHistory({
    subscriptionId: updated.id,
    fromPlan: current?.plan ?? null,
    toPlan: PlanName.STARTER,
    fromStatus: current?.status ?? null,
    toStatus: SubscriptionStatus.TRIALING,
    reason: 'admin_reset_trial',
    changedBy: adminId,
  })

  await billingRepository.updateTenantPlanCache(tenantId, PlanName.STARTER)

  return updated
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Zero erros.

- [ ] **Step 4: Commit**

```bash
git add src/domains/billing/
git commit -m "feat(billing): adiciona resetTrial no BillingService e trialEndsAt no UpdateSubscriptionData"
```

---

## Task 6: API Routes — Detalhe do tenant + ações manuais (D1)

**Files:**
- Create: `src/app/api/admin/tenants/[tenantId]/route.ts`
- Create: `src/app/api/admin/tenants/[tenantId]/block/route.ts`
- Create: `src/app/api/admin/tenants/[tenantId]/reset-trial/route.ts`
- Create: `src/app/api/admin/tenants/[tenantId]/plan/route.ts`
- Create: `src/app/api/admin/tenants/[tenantId]/send-message/route.ts`

- [ ] **Step 1: Criar `src/app/api/admin/tenants/[tenantId]/route.ts` (GET detalhe)**

```typescript
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { NotFoundError } from '@/shared/errors'
import { adminRepository } from '@/domains/admin/admin.repository'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  initializeDomainRuntime()
  try {
    await getAdminContext(request)
    const { tenantId } = await params
    const tenant = await adminRepository.findTenantDetail(tenantId)
    if (!tenant) throw new NotFoundError('Tenant')
    return Response.json(tenant)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 2: Criar `src/app/api/admin/tenants/[tenantId]/block/route.ts`**

```typescript
import { z } from 'zod'
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { adminRepository } from '@/domains/admin/admin.repository'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

const blockSchema = z.object({
  blocked: z.boolean(),
  reason: z.string().max(500).optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  initializeDomainRuntime()
  try {
    await getAdminContext(request)
    const { tenantId } = await params
    const input = await validateInput(request, blockSchema)

    if (input.blocked) {
      await adminRepository.blockTenant(tenantId, input.reason)
    } else {
      await adminRepository.unblockTenant(tenantId)
    }

    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 3: Criar `src/app/api/admin/tenants/[tenantId]/reset-trial/route.ts`**

```typescript
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { billingService } from '@/domains/billing/billing.service'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  initializeDomainRuntime()
  try {
    const session = await getAdminContext(request)
    const { tenantId } = await params
    const updated = await billingService.resetTrial(tenantId, session.userId)
    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 4: Criar `src/app/api/admin/tenants/[tenantId]/plan/route.ts`**

```typescript
import { z } from 'zod'
import { PlanName, SubscriptionStatus } from '@prisma/client'
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { billingService } from '@/domains/billing/billing.service'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

const changePlanSchema = z.object({
  plan: z.nativeEnum(PlanName),
  status: z.nativeEnum(SubscriptionStatus),
  reason: z.string().max(200).default('admin_manual_change'),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  initializeDomainRuntime()
  try {
    const session = await getAdminContext(request)
    const { tenantId } = await params
    const input = await validateInput(request, changePlanSchema)
    const updated = await billingService.changePlan(
      tenantId,
      input.plan,
      input.status,
      session.userId,
      input.reason,
    )
    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 5: Criar `src/app/api/admin/tenants/[tenantId]/send-message/route.ts`**

```typescript
import { z } from 'zod'
import { NotificationChannel } from '@prisma/client'
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { DomainError } from '@/shared/errors'
import { prisma } from '@/shared/database/prisma'
import { notificationService } from '@/domains/notifications/notification.service'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

const sendMessageSchema = z.object({
  message: z.string().min(1).max(1000),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  initializeDomainRuntime()
  try {
    await getAdminContext(request)
    const { tenantId } = await params
    const { message } = await validateInput(request, sendMessageSchema)

    const [tenant, ownerUser] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { evolutionInstanceId: true, evolutionConnected: true, phone: true },
      }),
      prisma.user.findFirst({
        where: { tenantId, role: 'OWNER' },
        select: { email: true },
      }),
    ])

    if (!tenant?.evolutionConnected || !tenant.evolutionInstanceId) {
      throw new DomainError('WhatsApp não está conectado neste tenant.', 'WHATSAPP_NOT_CONNECTED', 400)
    }

    const recipient = ownerUser?.email
      ? await prisma.customer.findFirst({
          where: { tenantId, email: ownerUser.email },
          select: { id: true, phone: true, name: true },
        })
      : null

    const phone = recipient?.phone ?? tenant.phone
    if (!phone) {
      throw new DomainError('Destinatário sem telefone cadastrado.', 'NO_PHONE', 400)
    }

    const customerId = recipient?.id ?? null

    await notificationService.logAndDispatch({
      tenantId,
      customerId,
      channel: NotificationChannel.WHATSAPP,
      template: 'admin-system-message',
      recipient: phone,
      provider: 'evolution',
      payload: { message },
    })

    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 6: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Zero erros.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/admin/tenants/
git commit -m "feat(admin): adiciona rotas de detalhe do tenant, block, reset-trial, plan e send-message"
```

---

## Task 7: API Route — Impersonação (D2)

**Files:**
- Create: `src/app/api/admin/tenants/[tenantId]/impersonate/route.ts`

- [ ] **Step 1: Criar `src/app/api/admin/tenants/[tenantId]/impersonate/route.ts`**

```typescript
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { NotFoundError, ForbiddenError } from '@/shared/errors'
import { signImpersonationToken } from '@/shared/auth/impersonation'
import { prisma } from '@/shared/database/prisma'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  initializeDomainRuntime()
  try {
    const session = await getAdminContext(request)
    const { tenantId } = await params

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, isBlocked: true },
    })

    if (!tenant) throw new NotFoundError('Tenant')
    if (tenant.isBlocked) throw new ForbiddenError('Tenant bloqueado — impersonação não permitida.')

    const token = await signImpersonationToken({
      tenantId,
      adminId: session.userId,
    })

    return Response.json({ token, tenantId, tenantName: tenant.name })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/tenants/
git commit -m "feat(admin): adiciona rota POST /impersonate para iniciar impersonação de tenant"
```

---

## Task 8: API Route — MRR/ARR via Stripe (D4)

**Files:**
- Create: `src/app/api/admin/mrr/route.ts`

- [ ] **Step 1: Criar `src/app/api/admin/mrr/route.ts`**

```typescript
import { unstable_cache } from 'next/cache'
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { prisma } from '@/shared/database/prisma'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

async function computeMrrData() {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  let mrr = 0
  let newPayingThisMonth = 0

  try {
    const { stripe } = await import('@/domains/billing/stripe.client')

    let hasMore = true
    let startingAfter: string | undefined

    while (hasMore) {
      const page = await stripe.subscriptions.list({
        status: 'active',
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
        expand: ['data.items.data.price'],
      })

      for (const sub of page.data) {
        for (const item of sub.items.data) {
          const amount = item.price.unit_amount ?? 0
          const interval = item.price.recurring?.interval
          if (interval === 'month') mrr += amount / 100
          else if (interval === 'year') mrr += (amount / 100) / 12
        }
        if (sub.start_date >= Math.floor(startOfMonth.getTime() / 1000)) {
          newPayingThisMonth++
        }
      }

      hasMore = page.has_more
      if (hasMore && page.data.length > 0) {
        startingAfter = page.data[page.data.length - 1].id
      }
    }
  } catch {
    // Stripe não configurado — retorna zeros
  }

  const [trialToActiveThisMonth, churnThisMonth, totalActivePaying, trialing] = await Promise.all([
    prisma.subscriptionHistory.count({
      where: {
        fromStatus: 'TRIALING',
        toStatus: 'ACTIVE',
        createdAt: { gte: startOfMonth },
      },
    }),
    prisma.subscriptionHistory.count({
      where: {
        toStatus: { in: ['CANCELLED', 'EXPIRED'] },
        fromStatus: { in: ['ACTIVE', 'TRIALING'] },
        createdAt: { gte: startOfMonth },
      },
    }),
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    prisma.subscription.count({ where: { status: 'TRIALING' } }),
  ])

  const trialConversionRate =
    trialing + trialToActiveThisMonth > 0
      ? Math.round((trialToActiveThisMonth / (trialing + trialToActiveThisMonth)) * 100)
      : 0

  return {
    mrr: Math.round(mrr * 100) / 100,
    arr: Math.round(mrr * 12 * 100) / 100,
    newPayingThisMonth,
    churnThisMonth,
    trialToActiveThisMonth,
    totalActivePaying,
    trialing,
    trialConversionRate,
  }
}

const getCachedMrrData = unstable_cache(computeMrrData, ['admin-mrr'], { revalidate: 3600 })

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    await getAdminContext(request)
    const data = await getCachedMrrData()
    return Response.json(data)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/mrr/
git commit -m "feat(admin): adiciona rota GET /admin/mrr com MRR/ARR via Stripe API e cache de 1h"
```

---

## Task 9: Job pg-boss — Snapshot de uso mensal (D3) + atualizar runtime

**Files:**
- Create: `src/shared/queue/jobs/usage-snapshot.ts`
- Modify: `src/app/api/_lib/runtime.ts`
- Modify: `src/app/api/admin/tenants/route.ts`

- [ ] **Step 1: Criar `src/shared/queue/jobs/usage-snapshot.ts`**

```typescript
import type { PgBoss, Job } from 'pg-boss'
import { prisma } from '@/shared/database/prisma'

export const USAGE_SNAPSHOT_JOB = 'usage:snapshot'

function formatPeriod(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

export async function handleUsageSnapshot(_jobs: Job<Record<string, never>>[]): Promise<void> {
  const now = new Date()

  // Captura o mês anterior (job roda no 1º do mês corrente)
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevYear = prevMonthDate.getFullYear()
  const prevMonth = prevMonthDate.getMonth()
  const period = formatPeriod(prevYear, prevMonth)

  const startOfPrevMonth = new Date(prevYear, prevMonth, 1)
  const endOfPrevMonth = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59, 999)

  const tenants = await prisma.tenant.findMany({ select: { id: true } })

  for (const tenant of tenants) {
    const [appointments, whatsapp, customers, users] = await Promise.all([
      prisma.appointment.count({
        where: { tenantId: tenant.id, createdAt: { gte: startOfPrevMonth, lte: endOfPrevMonth } },
      }),
      prisma.notificationLog.count({
        where: {
          tenantId: tenant.id,
          channel: 'WHATSAPP',
          createdAt: { gte: startOfPrevMonth, lte: endOfPrevMonth },
        },
      }),
      prisma.customer.count({ where: { tenantId: tenant.id } }),
      prisma.user.count({ where: { tenantId: tenant.id } }),
    ])

    const snapshots = [
      { limitKey: 'appointments_month', count: appointments },
      { limitKey: 'whatsapp_month', count: whatsapp },
      { limitKey: 'customers_total', count: customers },
      { limitKey: 'users_total', count: users },
    ]

    for (const snap of snapshots) {
      await prisma.usageSnapshot.upsert({
        where: {
          tenantId_limitKey_period: {
            tenantId: tenant.id,
            limitKey: snap.limitKey,
            period,
          },
        },
        create: { tenantId: tenant.id, limitKey: snap.limitKey, count: snap.count, period },
        update: { count: snap.count },
      })
    }
  }
}

export async function registerUsageSnapshotJob(boss: PgBoss): Promise<void> {
  // Roda no 1º dia de cada mês às 01:00 UTC
  await boss.schedule(USAGE_SNAPSHOT_JOB, '0 1 1 * *', {})
  boss.work(USAGE_SNAPSHOT_JOB, handleUsageSnapshot)
}
```

- [ ] **Step 2: Registrar o job no runtime**

Em `src/app/api/_lib/runtime.ts`, adicionar import e chamada:

```typescript
import { registerUsageSnapshotJob } from '@/shared/queue/jobs/usage-snapshot'
```

Dentro do `.then(async (boss) => { ... })`, adicionar após o último `await`:

```typescript
      await registerUsageSnapshotJob(boss);
```

- [ ] **Step 3: Atualizar `/api/admin/tenants` com campos de uso e bloqueio**

Substituir o handler em `src/app/api/admin/tenants/route.ts`:

```typescript
import { prisma } from '@/shared/database/prisma'
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    await getAdminContext(request)

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [tenants, planLimits] = await Promise.all([
      prisma.tenant.findMany({
        select: {
          id: true,
          name: true,
          plan: true,
          isBlocked: true,
          createdAt: true,
          _count: {
            select: {
              users: true,
              appointments: { where: { createdAt: { gte: startOfMonth } } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.planLimitConfig.findMany({
        where: { limitKey: 'appointments_month' },
        select: { plan: true, value: true },
      }),
    ])

    const limitByPlan = Object.fromEntries(planLimits.map((l) => [l.plan, l.value]))

    return Response.json(
      tenants.map((t) => ({
        ...t,
        appointmentsThisMonth: t._count.appointments,
        appointmentsLimit: limitByPlan[t.plan] ?? null,
      })),
    )
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Zero erros.

- [ ] **Step 5: Commit**

```bash
git add src/shared/queue/jobs/usage-snapshot.ts src/app/api/_lib/runtime.ts \
        src/app/api/admin/tenants/route.ts
git commit -m "feat(jobs): adiciona usage-snapshot job mensal (D3) e enriquece GET /admin/tenants com dados de uso"
```

---

## Task 10: Frontend — Hooks de dados

**Files:**
- Modify: `src/hooks/admin/use-admin-tenants.ts`
- Create: `src/hooks/admin/use-admin-tenant-detail.ts`
- Create: `src/hooks/admin/use-admin-mrr.ts`

- [ ] **Step 1: Atualizar tipo `AdminTenant` em `use-admin-tenants.ts`**

Substituir o conteúdo de `src/hooks/admin/use-admin-tenants.ts`:

```typescript
import { useQuery } from '@tanstack/react-query'

export type AdminTenant = {
  id: string
  name: string
  plan: string
  isBlocked: boolean
  createdAt: string
  appointmentsThisMonth: number
  appointmentsLimit: number | null
  _count: { users: number; appointments: number }
}

async function fetchAdminTenants(): Promise<AdminTenant[]> {
  const res = await fetch('/api/admin/tenants')
  if (!res.ok) throw new Error('Falha ao carregar tenants')
  return res.json()
}

export function useAdminTenants() {
  return useQuery({
    queryKey: ['admin', 'tenants'],
    queryFn: fetchAdminTenants,
    staleTime: 60_000,
  })
}
```

- [ ] **Step 2: Criar `src/hooks/admin/use-admin-tenant-detail.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { PlanName, SubscriptionStatus } from '@prisma/client'

export type TenantDetail = {
  id: string
  name: string
  slug: string
  phone: string | null
  address: string | null
  isBlocked: boolean
  blockedReason: string | null
  evolutionConnected: boolean
  evolutionPhone: string | null
  evolutionStatus: string
  createdAt: string
  subscription: {
    id: string
    plan: PlanName
    status: SubscriptionStatus
    trialEndsAt: string | null
    currentPeriodEnd: string
    cancelAtPeriodEnd: boolean
    stripeCustomerId: string | null
    history: Array<{
      id: string
      fromPlan: PlanName | null
      toPlan: PlanName
      fromStatus: SubscriptionStatus | null
      toStatus: SubscriptionStatus
      reason: string | null
      changedBy: string | null
      createdAt: string
    }>
  } | null
  usageSnapshots: Array<{ limitKey: string; count: number; period: string }>
  _count: { appointments: number; notifications: number; customers: number; users: number }
}

async function fetchTenantDetail(tenantId: string): Promise<TenantDetail> {
  const res = await fetch(`/api/admin/tenants/${tenantId}`)
  if (!res.ok) throw new Error('Falha ao carregar tenant')
  return res.json()
}

export function useAdminTenantDetail(tenantId: string) {
  return useQuery({
    queryKey: ['admin', 'tenants', tenantId],
    queryFn: () => fetchTenantDetail(tenantId),
    staleTime: 30_000,
  })
}

export function useBlockTenant(tenantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { blocked: boolean; reason?: string }) =>
      fetch(`/api/admin/tenants/${tenantId}/block`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => { if (!r.ok) throw new Error('Falha ao bloquear'); return r.json() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'tenants', tenantId] }),
  })
}

export function useResetTrial(tenantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      fetch(`/api/admin/tenants/${tenantId}/reset-trial`, { method: 'POST' })
        .then((r) => { if (!r.ok) throw new Error('Falha ao resetar trial'); return r.json() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'tenants', tenantId] }),
  })
}

export function useChangePlan(tenantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { plan: PlanName; status: SubscriptionStatus; reason?: string }) =>
      fetch(`/api/admin/tenants/${tenantId}/plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => { if (!r.ok) throw new Error('Falha ao alterar plano'); return r.json() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'tenants', tenantId] }),
  })
}

export function useSendAdminMessage(tenantId: string) {
  return useMutation({
    mutationFn: (message: string) =>
      fetch(`/api/admin/tenants/${tenantId}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      }).then((r) => { if (!r.ok) throw new Error('Falha ao enviar mensagem'); return r.json() }),
  })
}
```

- [ ] **Step 3: Criar `src/hooks/admin/use-admin-mrr.ts`**

```typescript
import { useQuery } from '@tanstack/react-query'

export type MrrData = {
  mrr: number
  arr: number
  newPayingThisMonth: number
  churnThisMonth: number
  trialToActiveThisMonth: number
  totalActivePaying: number
  trialing: number
  trialConversionRate: number
}

async function fetchMrr(): Promise<MrrData> {
  const res = await fetch('/api/admin/mrr')
  if (!res.ok) throw new Error('Falha ao carregar métricas')
  return res.json()
}

export function useAdminMrr() {
  return useQuery({
    queryKey: ['admin', 'mrr'],
    queryFn: fetchMrr,
    staleTime: 3_600_000, // 1 hora — alinhado com cache do servidor
  })
}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Zero erros.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/admin/
git commit -m "feat(hooks): adiciona use-admin-tenant-detail e use-admin-mrr; atualiza tipo AdminTenant"
```

---

## Task 11: Frontend — Página de detalhe do tenant (D1)

**Files:**
- Create: `src/app/(admin)/admin/tenants/[tenantId]/page.tsx`

- [ ] **Step 1: Criar `src/app/(admin)/admin/tenants/[tenantId]/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PlanName, SubscriptionStatus } from '@prisma/client'
import { ArrowLeft, Shield, ShieldOff, RotateCcw, MessageSquare, Eye } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  useAdminTenantDetail,
  useBlockTenant,
  useResetTrial,
  useChangePlan,
  useSendAdminMessage,
} from '@/hooks/admin/use-admin-tenant-detail'
import { storeImpersonationSession } from '@/lib/impersonation-client'

const PLAN_LABELS: Record<PlanName, string> = {
  FREE: 'Free', STARTER: 'Starter', PRO: 'Pro', ENTERPRISE: 'Enterprise',
}

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  TRIALING: 'Trial', ACTIVE: 'Ativo', PAST_DUE: 'Pagamento pendente',
  CANCELLED: 'Cancelado', EXPIRED: 'Expirado',
}

const STATUS_COLORS: Record<SubscriptionStatus, string> = {
  TRIALING: 'bg-blue-100 text-blue-700',
  ACTIVE: 'bg-green-100 text-green-700',
  PAST_DUE: 'bg-orange-100 text-orange-700',
  CANCELLED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-slate-100 text-slate-700',
}

export default function TenantDetailPage() {
  const params = useParams<{ tenantId: string }>()
  const router = useRouter()
  const { data: tenant, isLoading } = useAdminTenantDetail(params.tenantId)

  const blockMutation = useBlockTenant(params.tenantId)
  const resetTrialMutation = useResetTrial(params.tenantId)
  const changePlanMutation = useChangePlan(params.tenantId)
  const sendMessageMutation = useSendAdminMessage(params.tenantId)

  const [blockDialog, setBlockDialog] = useState(false)
  const [blockReason, setBlockReason] = useState('')
  const [messageDialog, setMessageDialog] = useState(false)
  const [message, setMessage] = useState('')
  const [selectedPlan, setSelectedPlan] = useState<PlanName | ''>('')
  const [selectedStatus, setSelectedStatus] = useState<SubscriptionStatus | ''>('')

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  if (!tenant) {
    return <p className="text-slate-500">Tenant não encontrado.</p>
  }

  const sub = tenant.subscription
  const currentPlan = (sub?.plan ?? 'FREE') as PlanName
  const currentStatus = (sub?.status ?? 'ACTIVE') as SubscriptionStatus

  const handleImpersonate = async () => {
    const res = await fetch(`/api/admin/tenants/${params.tenantId}/impersonate`, {
      method: 'POST',
    })
    if (!res.ok) return alert('Falha ao iniciar impersonação.')
    const data = await res.json()
    storeImpersonationSession({ token: data.token, tenantId: data.tenantId, tenantName: data.tenantName })
    router.push('/agenda')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/tenants" className="text-slate-400 hover:text-slate-700">
            <ArrowLeft className="size-4" />
          </Link>
          <h1 className="text-xl font-semibold text-slate-950">{tenant.name}</h1>
          {tenant.isBlocked && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              Bloqueado
            </span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleImpersonate} className="gap-1.5">
          <Eye className="size-4" />
          Visualizar como dono
        </Button>
      </div>

      {/* Info + Subscription */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Dados do negócio */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Dados do negócio</h2>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Slug</dt>
              <dd className="font-mono text-slate-900">{tenant.slug}</dd>
            </div>
            {tenant.phone && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Telefone</dt>
                <dd className="text-slate-900">{tenant.phone}</dd>
              </div>
            )}
            {tenant.address && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Endereço</dt>
                <dd className="text-slate-900 text-right max-w-48 truncate">{tenant.address}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-slate-500">Cadastro</dt>
              <dd className="text-slate-900">{new Date(tenant.createdAt).toLocaleDateString('pt-BR')}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">WhatsApp</dt>
              <dd>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  tenant.evolutionConnected ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  {tenant.evolutionConnected ? `Conectado (${tenant.evolutionPhone ?? ''})` : 'Desconectado'}
                </span>
              </dd>
            </div>
          </dl>
        </div>

        {/* Assinatura */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Assinatura</h2>
          {sub ? (
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Plano</dt>
                <dd className="font-medium text-slate-900">{PLAN_LABELS[sub.plan]}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Status</dt>
                <dd>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[sub.status]}`}>
                    {STATUS_LABELS[sub.status]}
                  </span>
                </dd>
              </div>
              {sub.trialEndsAt && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Trial até</dt>
                  <dd className="text-slate-900">{new Date(sub.trialEndsAt).toLocaleDateString('pt-BR')}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-slate-500">Período até</dt>
                <dd className="text-slate-900">{new Date(sub.currentPeriodEnd).toLocaleDateString('pt-BR')}</dd>
              </div>
              {sub.stripeCustomerId && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Stripe</dt>
                  <dd className="font-mono text-xs text-slate-500">{sub.stripeCustomerId}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-slate-400">Sem assinatura</p>
          )}
        </div>
      </div>

      {/* Métricas do mês */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Métricas deste mês</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Agendamentos', value: tenant._count.appointments },
            { label: 'WhatsApp enviados', value: tenant._count.notifications },
            { label: 'Clientes', value: tenant._count.customers },
            { label: 'Usuários', value: tenant._count.users },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border border-slate-100 p-3 text-center">
              <p className="text-xl font-bold text-slate-950">{value}</p>
              <p className="mt-0.5 text-xs text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Ações */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-5">
        <h2 className="text-sm font-semibold text-slate-700">Ações manuais</h2>

        {/* Mudar plano */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500">Mudar plano / status</p>
          <div className="flex flex-wrap gap-2">
            <Select
              value={selectedPlan || currentPlan}
              onValueChange={(v) => setSelectedPlan(v as PlanName)}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PLAN_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={selectedStatus || currentStatus}
              onValueChange={(v) => setSelectedStatus(v as SubscriptionStatus)}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={changePlanMutation.isPending}
              onClick={() => {
                if (!selectedPlan || !selectedStatus) return
                changePlanMutation.mutate({ plan: selectedPlan, status: selectedStatus })
              }}
            >
              Aplicar
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {/* Resetar trial */}
          <Button
            variant="outline"
            size="sm"
            disabled={resetTrialMutation.isPending}
            onClick={() => {
              if (confirm('Resetar trial por 14 dias?')) resetTrialMutation.mutate()
            }}
            className="gap-1.5"
          >
            <RotateCcw className="size-3.5" />
            Resetar trial (+14 dias)
          </Button>

          {/* Bloquear / Desbloquear */}
          {tenant.isBlocked ? (
            <Button
              variant="outline"
              size="sm"
              disabled={blockMutation.isPending}
              onClick={() => blockMutation.mutate({ blocked: false })}
              className="gap-1.5 text-green-700 border-green-300 hover:bg-green-50"
            >
              <ShieldOff className="size-3.5" />
              Desbloquear tenant
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBlockDialog(true)}
              className="gap-1.5 text-red-700 border-red-300 hover:bg-red-50"
            >
              <Shield className="size-3.5" />
              Bloquear tenant
            </Button>
          )}

          {/* Enviar mensagem */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMessageDialog(true)}
            className="gap-1.5"
          >
            <MessageSquare className="size-3.5" />
            Enviar mensagem WA
          </Button>
        </div>
      </div>

      {/* Histórico de plano */}
      {sub?.history && sub.history.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Histórico de assinatura</h2>
          <div className="space-y-1">
            {sub.history.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
                <span className="text-slate-700">
                  {h.fromPlan ? `${PLAN_LABELS[h.fromPlan]} → ` : ''}{PLAN_LABELS[h.toPlan]}
                  {h.reason && <span className="ml-1 text-slate-400">({h.reason})</span>}
                </span>
                <span className="text-slate-400">{new Date(h.createdAt).toLocaleDateString('pt-BR')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dialog: Bloquear */}
      <Dialog open={blockDialog} onOpenChange={setBlockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bloquear tenant</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              O tenant <strong>{tenant.name}</strong> ficará inacessível para todos os usuários.
            </p>
            <Input
              placeholder="Motivo (opcional)"
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockDialog(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={blockMutation.isPending}
              onClick={() => {
                blockMutation.mutate({ blocked: true, reason: blockReason || undefined })
                setBlockDialog(false)
              }}
            >
              Bloquear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Enviar mensagem */}
      <Dialog open={messageDialog} onOpenChange={setMessageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar mensagem via WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-slate-500">Enviada para o proprietário do negócio.</p>
            <Textarea
              placeholder="Digite a mensagem..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMessageDialog(false)}>Cancelar</Button>
            <Button
              disabled={sendMessageMutation.isPending || !message.trim()}
              onClick={() => {
                sendMessageMutation.mutate(message, {
                  onSuccess: () => { setMessageDialog(false); setMessage('') },
                })
              }}
            >
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/(admin)/admin/tenants/
git commit -m "feat(admin): adiciona página de detalhe do tenant com ações manuais (D1)"
```

---

## Task 12: Frontend — Lista com uso, impersonação e MRR

**Files:**
- Modify: `src/app/(admin)/admin/tenants/page.tsx`
- Create: `src/lib/impersonation-client.ts`
- Create: `src/components/admin/impersonation-banner.tsx`
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/app/(admin)/admin/page.tsx`

- [ ] **Step 1: Criar `src/lib/impersonation-client.ts`**

```typescript
export type ImpersonationSession = {
  token: string
  tenantId: string
  tenantName: string
}

const STORAGE_KEY = 'impersonation_session'
let _originalFetch: typeof fetch | null = null

export function getImpersonationSession(): ImpersonationSession | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    return stored ? (JSON.parse(stored) as ImpersonationSession) : null
  } catch {
    return null
  }
}

export function storeImpersonationSession(session: ImpersonationSession): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function applyImpersonationPatch(token: string): void {
  if (typeof window === 'undefined' || _originalFetch) return
  _originalFetch = window.fetch
  window.fetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers = new Headers((init.headers as HeadersInit | undefined) ?? {})
    headers.set('x-impersonate-token', token)
    return _originalFetch!(input, { ...init, headers })
  }
}

export function removeImpersonationPatch(): void {
  if (_originalFetch) {
    window.fetch = _originalFetch
    _originalFetch = null
  }
}

export function endImpersonation(tenantId: string): void {
  sessionStorage.removeItem(STORAGE_KEY)
  removeImpersonationPatch()
  window.location.href = `/admin/tenants/${tenantId}`
}
```

- [ ] **Step 2: Criar `src/components/admin/impersonation-banner.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Eye, X } from 'lucide-react'
import {
  getImpersonationSession,
  applyImpersonationPatch,
  endImpersonation,
  type ImpersonationSession,
} from '@/lib/impersonation-client'

export function ImpersonationBanner() {
  const [session, setSession] = useState<ImpersonationSession | null>(null)

  useEffect(() => {
    const stored = getImpersonationSession()
    if (stored) {
      setSession(stored)
      applyImpersonationPatch(stored.token)
    }
  }, [])

  if (!session) return null

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-md">
      <div className="flex items-center gap-2">
        <Eye className="size-4 shrink-0" />
        <span>
          Visualizando como <strong>{session.tenantName}</strong>
        </span>
      </div>
      <button
        onClick={() => endImpersonation(session.tenantId)}
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium hover:bg-amber-600 transition-colors"
      >
        <X className="size-3.5" />
        Encerrar impersonação
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Adicionar `<ImpersonationBanner />` ao layout da app**

Em `src/app/(app)/layout.tsx`, adicionar o import e o componente.

Adicionar import após os imports existentes:
```typescript
import { ImpersonationBanner } from '@/components/admin/impersonation-banner'
```

Alterar o return para incluir o banner antes do `AppShell`:
```tsx
  return (
    <>
      {brandingCss && (
        <style dangerouslySetInnerHTML={{ __html: `:root { ${brandingCss} }` }} />
      )}
      <ImpersonationBanner />
      <AppShell logoUrl={logoUrl} businessName={businessName}>
        {children}
      </AppShell>
    </>
  )
```

- [ ] **Step 4: Atualizar `/admin/tenants/page.tsx` — rows clicáveis + bloqueio + barra de uso**

Substituir o conteúdo de `src/app/(admin)/admin/tenants/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminTenants } from '@/hooks/admin/use-admin-tenants'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'

const PLAN_COLORS: Record<string, string> = {
  FREE: 'bg-slate-100 text-slate-700',
  STARTER: 'bg-blue-100 text-blue-700',
  PRO: 'bg-violet-100 text-violet-700',
  ENTERPRISE: 'bg-amber-100 text-amber-700',
}

export default function AdminTenantsPage() {
  const router = useRouter()
  const { data: tenants = [], isLoading } = useAdminTenants()
  const [search, setSearch] = useState('')

  const filtered = tenants.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-950">Tenants</h1>
        <Input
          placeholder="Buscar por nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-60"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Negócio</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Plano</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Usuários</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Uso (mês)</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    Nenhum tenant encontrado
                  </td>
                </tr>
              ) : (
                filtered.map((tenant) => {
                  const pct =
                    tenant.appointmentsLimit && tenant.appointmentsLimit > 0
                      ? Math.min((tenant.appointmentsThisMonth / tenant.appointmentsLimit) * 100, 100)
                      : null

                  return (
                    <tr
                      key={tenant.id}
                      className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors"
                      onClick={() => router.push(`/admin/tenants/${tenant.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">{tenant.name}</span>
                          {tenant.isBlocked && (
                            <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                              Bloqueado
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            PLAN_COLORS[tenant.plan] ?? 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {tenant.plan}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{tenant._count.users}</td>
                      <td className="px-4 py-3">
                        {pct !== null ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 text-xs">
                              <span className={pct >= 80 ? 'font-medium text-orange-600' : 'text-slate-500'}>
                                {tenant.appointmentsThisMonth}/{tenant.appointmentsLimit}
                              </span>
                              {pct >= 80 && (
                                <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-600">
                                  {Math.round(pct)}%
                                </span>
                              )}
                            </div>
                            <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full rounded-full ${pct >= 80 ? 'bg-orange-500' : 'bg-blue-500'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {new Date(tenant.createdAt).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Atualizar `/admin/page.tsx` com cards MRR/ARR (D4)**

Em `src/app/(admin)/admin/page.tsx`, adicionar os imports:

```typescript
import { Suspense } from 'react'
```

E criar um novo Server Component para as métricas Stripe. Como esta é uma Server Component, vamos buscar os dados via `fetch` server-side:

Substituir o export default por:

```tsx
import { prisma } from '@/shared/database/prisma'
import { PlanName } from '@prisma/client'
import { unstable_cache } from 'next/cache'

export const dynamic = 'force-dynamic'

const PLAN_LABELS: Record<PlanName, string> = {
  FREE: 'Free', STARTER: 'Starter', PRO: 'Pro', ENTERPRISE: 'Enterprise',
}
const PLAN_COLORS: Record<PlanName, string> = {
  FREE: 'bg-slate-100 text-slate-700',
  STARTER: 'bg-blue-100 text-blue-700',
  PRO: 'bg-violet-100 text-violet-700',
  ENTERPRISE: 'bg-amber-100 text-amber-700',
}

const getMrrCached = unstable_cache(
  async () => {
    let mrr = 0
    try {
      const { stripe } = await import('@/domains/billing/stripe.client')
      const subs = await stripe.subscriptions.list({ status: 'active', limit: 100, expand: ['data.items.data.price'] })
      for (const sub of subs.data) {
        for (const item of sub.items.data) {
          const amount = item.price.unit_amount ?? 0
          const interval = item.price.recurring?.interval
          if (interval === 'month') mrr += amount / 100
          else if (interval === 'year') mrr += (amount / 100) / 12
        }
      }
    } catch { /* Stripe não configurado */ }
    return { mrr: Math.round(mrr * 100) / 100, arr: Math.round(mrr * 12 * 100) / 100 }
  },
  ['admin-overview-mrr'],
  { revalidate: 3600 },
)

export default async function AdminOverviewPage() {
  const [totalTenants, planCounts, recentCount, mrrData] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.groupBy({ by: ['plan'], _count: { _all: true } }),
    prisma.tenant.count({
      where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    }),
    getMrrCached(),
  ])

  const countByPlan = Object.fromEntries(
    planCounts.map((r) => [r.plan, r._count._all]),
  ) as Partial<Record<PlanName, number>>

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-950">Visão Geral do Sistema</h1>

      {/* Cards principais */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-2xl font-bold text-slate-950">{totalTenants}</p>
          <p className="mt-1 text-sm text-slate-500">Total de tenants</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-2xl font-bold text-slate-950">{recentCount}</p>
          <p className="mt-1 text-sm text-slate-500">Últimos 30 dias</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-2xl font-bold text-slate-950">
            R$ {mrrData.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
          </p>
          <p className="mt-1 text-sm text-slate-500">MRR</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-2xl font-bold text-slate-950">
            R$ {mrrData.arr.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
          </p>
          <p className="mt-1 text-sm text-slate-500">ARR</p>
        </div>
      </div>

      {/* Distribuição por plano */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Distribuição por plano</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(Object.keys(PLAN_LABELS) as PlanName[]).map((plan) => (
            <div key={plan} className="rounded-lg border border-slate-100 p-4 text-center">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PLAN_COLORS[plan]}`}>
                {PLAN_LABELS[plan]}
              </span>
              <p className="mt-2 text-xl font-bold text-slate-950">{countByPlan[plan] ?? 0}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Zero erros.

- [ ] **Step 7: Commit**

```bash
git add src/lib/impersonation-client.ts src/components/admin/impersonation-banner.tsx \
        src/app/(app)/layout.tsx src/app/(admin)/admin/tenants/page.tsx \
        src/app/(admin)/admin/page.tsx
git commit -m "feat(admin): lista com barras de uso (D3), banner de impersonação (D2) e MRR/ARR no overview (D4)"
```

---

## Task 13: Verificação final — TypeScript, testes e PR

**Files:**
- Modify: `.env.example` (documentar novas variáveis)

- [ ] **Step 1: Rodar todos os testes**

```bash
npx vitest run
```

Todos passando. Se falhar, investigar e corrigir antes de continuar.

- [ ] **Step 2: Checar TypeScript**

```bash
npx tsc --noEmit
```

Zero erros.

- [ ] **Step 3: Documentar variável de ambiente em `.env.example` (se existir)**

Verificar se existe `.env.example` e adicionar:

```bash
# Track D — Impersonação admin
ADMIN_IMPERSONATE_SECRET=your-random-secret-min-32-chars
```

- [ ] **Step 4: Commit de documentação**

```bash
git add .env.example 2>/dev/null || true
git commit -m "chore: documenta ADMIN_IMPERSONATE_SECRET no .env.example"
```

- [ ] **Step 5: Abrir Pull Request**

```bash
git push -u origin feat/track-d-admin-completo
gh pr create \
  --title "feat(admin): Track D — Admin Panel Completo (D1-D4)" \
  --body "$(cat <<'EOF'
## Resumo

- **D1** — Página `/admin/tenants/[tenantId]` com dados detalhados, histórico de assinatura e ações manuais (mudar plano, resetar trial, bloquear tenant, enviar mensagem via WhatsApp)
- **D2** — Impersonação: admin visualiza o sistema como dono do salão via JWT 30min + banner "Visualizando como..."
- **D3** — Model `UsageSnapshot` + job pg-boss mensal + barras de progresso na listagem de tenants
- **D4** — Cards MRR/ARR no overview do admin via Stripe API com cache de 1h

## Checklist técnico

- [x] `UsageSnapshot` model no schema com migration
- [x] `TenantBlockedError` — tenant bloqueado não consegue autenticar
- [x] JWT de impersonação com `jose` (TTL 30min) — testes unitários passando
- [x] `getSessionContext()` suporta `X-Impersonate-Token` + check `isBlocked`
- [x] `billingService.resetTrial()` com histórico
- [x] API routes: GET detail, PATCH block, POST reset-trial, PATCH plan, POST send-message, POST impersonate
- [x] GET `/api/admin/mrr` com cache de 1h via `unstable_cache`
- [x] Job `usage:snapshot` registrado no runtime (cron 1º do mês)
- [x] Frontend: página detalhe com todas as ações
- [x] Frontend: lista com rows clicáveis + badge bloqueio + barra de uso
- [x] Frontend: banner de impersonação com patch de `window.fetch`
- [x] Frontend: cards MRR/ARR na visão geral
- [x] `npx tsc --noEmit` — zero erros
- [x] `npx vitest run` — todos passando

## Variável de ambiente nova

```
ADMIN_IMPERSONATE_SECRET=<random-secret-min-32-chars>
```

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Revisão do plano contra a spec

### Cobertura de requisitos

| Requisito | Task | Status |
|---|---|---|
| D1: página `/admin/tenants/[tenantId]` | Task 11 | ✅ |
| D1: dados do negócio + plano + subscription | Task 11 | ✅ |
| D1: métricas do mês | Task 4 + Task 11 | ✅ |
| D1: histórico `SubscriptionHistory` | Task 4 + Task 11 | ✅ |
| D1: status Evolution | Task 4 + Task 11 | ✅ |
| D1: mudar plano (changePlan) | Task 6 + Task 11 | ✅ |
| D1: resetar trial | Task 5 + Task 6 + Task 11 | ✅ |
| D1: bloquear/desbloquear tenant | Task 4 + Task 6 + Task 11 | ✅ |
| D1: enviar mensagem WA ao owner | Task 6 + Task 11 | ✅ |
| D1: `isBlocked` middleware | Task 3 | ✅ |
| D2: JWT 30min com `ADMIN_IMPERSONATE_SECRET` | Task 2 + Task 7 | ✅ |
| D2: sessionStorage (não localStorage) | Task 12 | ✅ |
| D2: `X-Impersonate-Token` em todas requisições | Task 12 (fetch patch) | ✅ |
| D2: `SessionContext.isImpersonating: true` | Task 2 + Task 3 | ✅ |
| D2: banner "Visualizando como..." | Task 12 | ✅ |
| D2: encerrar → limpa sessionStorage + redireciona | Task 12 | ✅ |
| D3: model `UsageSnapshot` | Task 1 | ✅ |
| D3: job cron 1º do mês | Task 9 | ✅ |
| D3: métricas: appointments_month, whatsapp_month, customers_total, users_total | Task 9 | ✅ |
| D3: barra de progresso na listagem | Task 12 | ✅ |
| D3: badge laranja >80% do limite | Task 12 | ✅ |
| D4: MRR + ARR via Stripe API | Task 8 + Task 12 | ✅ |
| D4: cache TTL 1h | Task 8 + Task 12 | ✅ |
| D4: novos pagantes, churn, trial→pago | Task 8 | ✅ |
| D4: cards no dashboard `/admin` | Task 12 | ✅ |
| `ADMIN_IMPERSONATE_SECRET` env var | Task 2 + Task 13 | ✅ |
| branch `feat/track-d-admin-completo` | Task 1 | ✅ |
| PR para main ao concluir | Task 13 | ✅ |
