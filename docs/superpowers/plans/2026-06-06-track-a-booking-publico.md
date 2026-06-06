# Track A — Booking Público, Políticas de Agendamento e Bloqueio de Cliente

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que clientes finais agendem serviços sem login via URL pública do salão, com políticas de agendamento configuráveis e bloqueio de clientes problemáticos.

**Architecture:** Route group `(public)` sem middleware de autenticação. API Routes públicas resolvem o tenant pelo slug. Rate limiting implementado com tabela Prisma. Booking UI em 6 steps com SSR para branding do tenant. Autenticação de cliente por telefone apenas (zero cadastro). SchedulingPolicy como model separado por tenant. Bloqueio de cliente verificado em toda criação de agendamento.

**Tech Stack:** Next.js 15 App Router, Prisma, TanStack Query (SWR para slots), Zod, Evolution API (notificação pós-agendamento), Shadcn UI.

**Spec de referência:** `docs/superpowers/specs/2026-06-06-producao-completa-master-spec.md` seções 2 (A1, A2, A3)

---

## Mapa de Arquivos

### Criar
```
prisma/migrations/[timestamp]_track_a/     ← migration aditiva
src/app/(public)/layout.tsx                ← layout público sem sidebar
src/app/(public)/agendar/[slug]/page.tsx   ← booking page (SSR)
src/app/(public)/agendar/[slug]/booking-client.tsx ← stepper client component
src/components/domain/booking/service-step.tsx
src/components/domain/booking/professional-step.tsx
src/components/domain/booking/datetime-step.tsx
src/components/domain/booking/personal-step.tsx
src/components/domain/booking/confirmation-step.tsx
src/components/domain/booking/booking-success.tsx
src/app/api/public/[slug]/route.ts         ← GET: dados do salão
src/app/api/public/[slug]/availability/route.ts ← GET: slots disponíveis
src/app/api/public/[slug]/appointments/route.ts ← POST: criar agendamento
src/app/api/scheduling/policy/route.ts     ← GET/PUT: política do tenant
src/domains/scheduling/public-booking.repository.ts
src/domains/scheduling/scheduling-policy.repository.ts
src/domains/scheduling/scheduling-policy.service.ts
src/shared/rate-limit/public-rate-limit.ts
src/shared/errors/domain-errors.ts        ← adicionar CustomerBlockedError, PublicBookingDisabledError
```

### Modificar
```
prisma/schema.prisma                       ← novos models + campos
src/domains/crm/customer.repository.ts    ← block/unblock + findOrCreateByPhone
src/domains/scheduling/scheduling.service.ts ← verificar isBlocked + SchedulingPolicy
src/app/(app)/clientes/[id]/page.tsx      ← botão bloquear/desbloquear
src/app/(app)/configuracoes/page.tsx      ← nova aba "Agendamento Online"
src/middleware.ts                          ← garantir que (public) não passa por auth
```

---

## Task 1: Schema Migration (Fundação)

**Files:**
- Modify: `prisma/schema.prisma`
- Create: via `npx prisma migrate dev`

- [ ] **Step 1: Adicionar enums e campos ao schema**

Abra `prisma/schema.prisma` e adicione após o bloco de enums existentes:

```prisma
enum PriceType {
  FIXED
  RANGE
  ON_CONSULTATION
}
```

No model `Service`, adicione após `price`:
```prisma
  priceType  PriceType @default(FIXED)
  priceMin   Decimal?  @db.Decimal(10, 2)
  priceMax   Decimal?  @db.Decimal(10, 2)
```

No model `Customer`, adicione antes de `createdAt`:
```prisma
  isBlocked     Boolean   @default(false)
  blockedReason String?
  blockedAt     DateTime?
```

No model `Tenant`, adicione antes de `createdAt`:
```prisma
  autoReplyEnabled        Boolean @default(false)
  autoReplyIntervalHours  Int     @default(6)
  autoReplyMessage        String?
  offHoursEnabled         Boolean @default(false)
  offHoursMessage         String?
  dailyStatusEnabled      Boolean @default(false)
  dailyStatusHour         Int     @default(9)
  birthdayEnabled         Boolean @default(false)
  birthdayMessage         String?
  birthdayGiftServiceId   String?
  isBlocked               Boolean @default(false)
  blockedReason           String?
```

- [ ] **Step 2: Adicionar novos models ao schema**

Adicione ao final de `prisma/schema.prisma`:

```prisma
model SchedulingPolicy {
  id                 String   @id @default(cuid())
  tenantId           String   @unique
  paddingMinutes     Int      @default(0)
  minAdvanceMinutes  Int      @default(15)
  maxAdvanceDays     Int      @default(60)
  allowPublicBooking Boolean  @default(true)
  updatedAt          DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}

model PublicRateLimit {
  id          String   @id @default(cuid())
  ip          String?
  phone       String?
  action      String
  count       Int      @default(1)
  windowStart DateTime @default(now())

  @@index([ip, action, windowStart])
  @@index([phone, action, windowStart])
}
```

No model `Tenant`, adicione as relações:
```prisma
  schedulingPolicy    SchedulingPolicy?
```

- [ ] **Step 3: Adicionar relação inversa no Tenant**

Verifique que o model `Tenant` tem a relação `schedulingPolicy SchedulingPolicy?` (já adicionada no step anterior).

- [ ] **Step 4: Executar migration**

```bash
npx prisma migrate dev --name track_a_booking_publico
```

Resultado esperado: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 5: Regenerar client e verificar tipos**

```bash
npx prisma generate
npx tsc --noEmit
```

Resultado esperado: zero erros TypeScript.

- [ ] **Step 6: Commit**

```bash
git add prisma/
git commit -m "feat(db): migration Track A — PriceType, SchedulingPolicy, PublicRateLimit, isBlocked"
```

---

## Task 2: SchedulingPolicy — Backend

**Files:**
- Create: `src/domains/scheduling/scheduling-policy.repository.ts`
- Create: `src/domains/scheduling/scheduling-policy.service.ts`
- Create: `src/app/api/scheduling/policy/route.ts`

- [ ] **Step 1: Escrever teste para o repository**

Crie `src/domains/scheduling/__tests__/scheduling-policy.repository.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from '@/shared/test/prisma-mock'
import { SchedulingPolicyRepository } from '../scheduling-policy.repository'

const repo = new SchedulingPolicyRepository()

describe('SchedulingPolicyRepository', () => {
  it('deve retornar política existente', async () => {
    const policy = { id: '1', tenantId: 't1', paddingMinutes: 10, minAdvanceMinutes: 30, maxAdvanceDays: 60, allowPublicBooking: true, updatedAt: new Date() }
    prismaMock.schedulingPolicy.findUnique.mockResolvedValue(policy)
    const result = await repo.findByTenant('t1')
    expect(result).toEqual(policy)
  })

  it('deve criar política com defaults quando não existe', async () => {
    prismaMock.schedulingPolicy.findUnique.mockResolvedValue(null)
    prismaMock.schedulingPolicy.create.mockResolvedValue({ id: '2', tenantId: 't1', paddingMinutes: 0, minAdvanceMinutes: 15, maxAdvanceDays: 60, allowPublicBooking: true, updatedAt: new Date() })
    const result = await repo.findOrCreateByTenant('t1')
    expect(result.tenantId).toBe('t1')
    expect(result.paddingMinutes).toBe(0)
  })

  it('deve atualizar política', async () => {
    const updated = { id: '1', tenantId: 't1', paddingMinutes: 15, minAdvanceMinutes: 30, maxAdvanceDays: 30, allowPublicBooking: false, updatedAt: new Date() }
    prismaMock.schedulingPolicy.upsert.mockResolvedValue(updated)
    const result = await repo.upsert('t1', { paddingMinutes: 15, minAdvanceMinutes: 30, maxAdvanceDays: 30, allowPublicBooking: false })
    expect(result.paddingMinutes).toBe(15)
    expect(result.allowPublicBooking).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar teste e confirmar falha**

```bash
npx vitest run src/domains/scheduling/__tests__/scheduling-policy.repository.test.ts
```

Esperado: `FAIL` — `SchedulingPolicyRepository` não existe.

- [ ] **Step 3: Implementar repository**

Crie `src/domains/scheduling/scheduling-policy.repository.ts`:

```typescript
import { prisma } from '@/shared/database/prisma'

export class SchedulingPolicyRepository {
  async findByTenant(tenantId: string) {
    return prisma.schedulingPolicy.findUnique({ where: { tenantId } })
  }

  async findOrCreateByTenant(tenantId: string) {
    const existing = await this.findByTenant(tenantId)
    if (existing) return existing
    return prisma.schedulingPolicy.create({ data: { tenantId } })
  }

  async upsert(tenantId: string, data: {
    paddingMinutes?: number
    minAdvanceMinutes?: number
    maxAdvanceDays?: number
    allowPublicBooking?: boolean
  }) {
    return prisma.schedulingPolicy.upsert({
      where: { tenantId },
      create: { tenantId, ...data },
      update: data,
    })
  }
}

export const schedulingPolicyRepository = new SchedulingPolicyRepository()
```

- [ ] **Step 4: Rodar teste e confirmar aprovação**

```bash
npx vitest run src/domains/scheduling/__tests__/scheduling-policy.repository.test.ts
```

Esperado: `PASS` — 3 testes passando.

- [ ] **Step 5: Implementar service**

Crie `src/domains/scheduling/scheduling-policy.service.ts`:

```typescript
import { schedulingPolicyRepository } from './scheduling-policy.repository'

export class SchedulingPolicyService {
  async getPolicy(tenantId: string) {
    return schedulingPolicyRepository.findOrCreateByTenant(tenantId)
  }

  async updatePolicy(tenantId: string, data: {
    paddingMinutes?: number
    minAdvanceMinutes?: number
    maxAdvanceDays?: number
    allowPublicBooking?: boolean
  }) {
    return schedulingPolicyRepository.upsert(tenantId, data)
  }
}

export const schedulingPolicyService = new SchedulingPolicyService()
```

- [ ] **Step 6: Implementar API Route**

Crie `src/app/api/scheduling/policy/route.ts`:

```typescript
import { z } from 'zod'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/errors/handle-api-error'
import { schedulingPolicyService } from '@/domains/scheduling/scheduling-policy.service'

const UpdatePolicySchema = z.object({
  paddingMinutes: z.number().int().min(0).max(120).optional(),
  minAdvanceMinutes: z.number().int().min(0).max(1440).optional(),
  maxAdvanceDays: z.number().int().min(1).max(365).optional(),
  allowPublicBooking: z.boolean().optional(),
})

export async function GET(req: Request) {
  try {
    const { tenantId } = await getSessionContext(req)
    const policy = await schedulingPolicyService.getPolicy(tenantId)
    return Response.json(policy)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(req: Request) {
  try {
    const { tenantId } = await getSessionContext(req)
    const body = await req.json()
    const data = UpdatePolicySchema.parse(body)
    const policy = await schedulingPolicyService.updatePolicy(tenantId, data)
    return Response.json(policy)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 7: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 8: Commit**

```bash
git add src/domains/scheduling/scheduling-policy.repository.ts src/domains/scheduling/scheduling-policy.service.ts src/app/api/scheduling/policy/route.ts src/domains/scheduling/__tests__/scheduling-policy.repository.test.ts
git commit -m "feat(scheduling): SchedulingPolicy — repository, service e API Route"
```

---

## Task 3: Erros de Domínio + Bloqueio de Cliente — Backend

**Files:**
- Modify: `src/shared/errors/domain-errors.ts` (ou equivalente)
- Modify: `src/domains/crm/customer.repository.ts`
- Modify: `src/domains/scheduling/scheduling.service.ts`

- [ ] **Step 1: Verificar onde os erros de domínio estão definidos**

```bash
find src/shared/errors -name "*.ts" | head -10
```

Identifique o arquivo onde `AppError` ou erros de domínio são definidos (provavelmente `src/shared/errors/`).

- [ ] **Step 2: Adicionar novos erros de domínio**

No arquivo de erros (ex: `src/shared/errors/domain-errors.ts` ou onde os erros existentes estão), adicione:

```typescript
export class CustomerBlockedError extends AppError {
  constructor(customerName: string) {
    super(`Cliente "${customerName}" está bloqueado e não pode realizar agendamentos.`, 'CUSTOMER_BLOCKED', 403)
  }
}

export class PublicBookingDisabledError extends AppError {
  constructor() {
    super('Este salão não está aceitando agendamentos online no momento.', 'PUBLIC_BOOKING_DISABLED', 403)
  }
}
```

> Adapte ao padrão de erro existente no projeto (verifique a classe base usada nos outros erros).

- [ ] **Step 3: Adicionar block/unblock ao CustomerRepository**

Em `src/domains/crm/customer.repository.ts`, adicione os métodos:

```typescript
async findOrCreateByPhone(tenantId: string, phone: string, name: string) {
  const existing = await prisma.customer.findFirst({
    where: { tenantId, phone },
  })
  if (existing) return existing
  return prisma.customer.create({
    data: { tenantId, phone, name },
  })
}

async block(tenantId: string, customerId: string, reason?: string) {
  return prisma.customer.update({
    where: { id: customerId, tenantId },
    data: { isBlocked: true, blockedReason: reason ?? null, blockedAt: new Date() },
  })
}

async unblock(tenantId: string, customerId: string) {
  return prisma.customer.update({
    where: { id: customerId, tenantId },
    data: { isBlocked: false, blockedReason: null, blockedAt: null },
  })
}
```

- [ ] **Step 4: Escrever teste para verificação de bloqueio no scheduling**

Adicione em `src/domains/scheduling/__tests__/scheduling.service.block.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { CustomerBlockedError } from '@/shared/errors/domain-errors'

// Importar mocks existentes do setup de testes
vi.mock('@/shared/database/prisma', () => ({ prisma: prismaMock }))

describe('SchedulingService - cliente bloqueado', () => {
  it('deve lançar CustomerBlockedError ao criar agendamento para cliente bloqueado', async () => {
    // Adapte o mock ao padrão existente nos outros testes de scheduling
    prismaMock.customer.findFirst.mockResolvedValue({
      id: 'c1', tenantId: 't1', name: 'Ana', phone: '11999', isBlocked: true,
      blockedReason: 'No-show repetido', blockedAt: new Date(),
    } as any)

    await expect(
      schedulingService.createAppointment('t1', 'u1', {
        customerId: 'c1', serviceId: 's1', professionalId: 'p1',
        startsAt: new Date(Date.now() + 86_400_000),
      })
    ).rejects.toThrow(CustomerBlockedError)
  })
})
```

- [ ] **Step 5: Rodar teste e confirmar falha**

```bash
npx vitest run src/domains/scheduling/__tests__/scheduling.service.block.test.ts
```

Esperado: `FAIL` — CustomerBlockedError não é lançado ainda.

- [ ] **Step 6: Adicionar verificação de bloqueio no SchedulingService**

Em `src/domains/scheduling/scheduling.service.ts`, localize o método `createAppointment` e adicione a verificação logo após buscar o customer:

```typescript
// Após buscar o customer:
if (customer.isBlocked) {
  throw new CustomerBlockedError(customer.name)
}
```

- [ ] **Step 7: Rodar teste e confirmar aprovação**

```bash
npx vitest run src/domains/scheduling/__tests__/scheduling.service.block.test.ts
```

Esperado: `PASS`.

- [ ] **Step 8: Adicionar API Route para block/unblock**

Crie `src/app/api/crm/customers/[id]/block/route.ts`:

```typescript
import { z } from 'zod'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/errors/handle-api-error'
import { customerRepository } from '@/domains/crm/customer.repository'

const BlockSchema = z.object({ reason: z.string().max(500).optional() })

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = await getSessionContext(req)
    const body = await req.json().catch(() => ({}))
    const { reason } = BlockSchema.parse(body)
    const customer = await customerRepository.block(tenantId, params.id, reason)
    return Response.json(customer)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = await getSessionContext(req)
    const customer = await customerRepository.unblock(tenantId, params.id)
    return Response.json(customer)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 9: Verificar TypeScript e rodar todos os testes**

```bash
npx tsc --noEmit && npx vitest run
```

Esperado: zero erros TypeScript, todos os testes passando.

- [ ] **Step 10: Commit**

```bash
git add src/
git commit -m "feat(crm): bloqueio de cliente — erros de domínio, block/unblock, verificação no scheduling"
```

---

## Task 4: Rate Limiting e Infraestrutura Pública

**Files:**
- Create: `src/shared/rate-limit/public-rate-limit.ts`
- Create: `src/app/(public)/layout.tsx`
- Modify: `src/middleware.ts`

- [ ] **Step 1: Implementar utilitário de rate limiting**

Crie `src/shared/rate-limit/public-rate-limit.ts`:

```typescript
import { prisma } from '@/shared/database/prisma'

const WINDOW_MS = 60 * 60 * 1000 // 1 hora

export async function checkRateLimit(params: {
  ip?: string
  phone?: string
  action: 'appointment'
  maxPerWindow: number
}): Promise<{ allowed: boolean; remaining: number }> {
  const { ip, phone, action, maxPerWindow } = params
  const windowStart = new Date(Date.now() - WINDOW_MS)

  const where = {
    action,
    windowStart: { gte: windowStart },
    ...(ip ? { ip } : {}),
    ...(phone ? { phone } : {}),
  }

  const record = await prisma.publicRateLimit.findFirst({ where })

  if (!record) {
    await prisma.publicRateLimit.create({
      data: { ip, phone, action, count: 1, windowStart: new Date() },
    })
    return { allowed: true, remaining: maxPerWindow - 1 }
  }

  if (record.count >= maxPerWindow) {
    return { allowed: false, remaining: 0 }
  }

  await prisma.publicRateLimit.update({
    where: { id: record.id },
    data: { count: { increment: 1 } },
  })

  return { allowed: true, remaining: maxPerWindow - record.count - 1 }
}
```

- [ ] **Step 2: Criar layout do route group público**

Crie `src/app/(public)/layout.tsx`:

```typescript
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-slate-50 antialiased">
        {children}
      </body>
    </html>
  )
}
```

> Nota: o `(public)` route group não exige `html`/`body` se já estiver no `app/layout.tsx` raiz. Verifique se o projeto tem um layout raiz — se tiver, simplifique para apenas `<>{children}</>`.

- [ ] **Step 3: Verificar que middleware não bloqueia rotas públicas**

Abra `src/middleware.ts` e confirme que as rotas `/agendar/` e `/api/public/` estão na lista de exceções. Se não estiver, adicione:

```typescript
// No matcher ou na lógica de exclusão do middleware:
if (
  pathname.startsWith('/agendar/') ||
  pathname.startsWith('/api/public/') ||
  pathname.startsWith('/planos')
) {
  return NextResponse.next()
}
```

> Adapte ao padrão exato do middleware existente — o projeto usa Supabase Auth, então verifique como as rotas públicas já são tratadas (ex: `/anamnese/` já é pública).

- [ ] **Step 4: Commit**

```bash
git add src/shared/rate-limit/ src/app/\(public\)/ src/middleware.ts
git commit -m "feat(public): infraestrutura de rate limiting e route group público"
```

---

## Task 5: API Routes Públicas — Dados do Salão e Disponibilidade

**Files:**
- Create: `src/domains/scheduling/public-booking.repository.ts`
- Create: `src/app/api/public/[slug]/route.ts`
- Create: `src/app/api/public/[slug]/availability/route.ts`

- [ ] **Step 1: Criar repository de dados públicos**

Crie `src/domains/scheduling/public-booking.repository.ts`:

```typescript
import { prisma } from '@/shared/database/prisma'
import { NotFoundError } from '@/shared/errors/domain-errors'

export class PublicBookingRepository {
  async findTenantBySlug(slug: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        phone: true,
        address: true,
        timezone: true,
        businessHours: true,
        evolutionConnected: true,
        brandingConfig: {
          select: {
            logoUrl: true,
            primaryColor: true,
            secondaryColor: true,
            accentColor: true,
            backgroundColor: true,
            foregroundColor: true,
            borderRadius: true,
            fontFamily: true,
          },
        },
        schedulingPolicy: true,
      },
    })
    if (!tenant) throw new NotFoundError('Salão não encontrado.')
    return tenant
  }

  async findPublicServices(tenantId: string) {
    return prisma.service.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        name: true,
        duration: true,
        price: true,
        priceType: true,
        priceMin: true,
        priceMax: true,
        category: true,
        imageUrl: true,
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    })
  }

  async findPublicProfessionals(tenantId: string) {
    return prisma.user.findMany({
      where: { tenantId, role: { in: ['PROFESSIONAL', 'OWNER', 'MANAGER'] } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
  }
}

export const publicBookingRepository = new PublicBookingRepository()
```

- [ ] **Step 2: Criar rota GET /api/public/[slug]**

Crie `src/app/api/public/[slug]/route.ts`:

```typescript
import { publicBookingRepository } from '@/domains/scheduling/public-booking.repository'
import { handleApiError } from '@/shared/errors/handle-api-error'

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const tenant = await publicBookingRepository.findTenantBySlug(params.slug)
    const [services, professionals] = await Promise.all([
      publicBookingRepository.findPublicServices(tenant.id),
      publicBookingRepository.findPublicProfessionals(tenant.id),
    ])

    const policy = tenant.schedulingPolicy

    return Response.json({
      name: tenant.name,
      slug: tenant.slug,
      address: tenant.address,
      timezone: tenant.timezone,
      businessHours: tenant.businessHours,
      branding: tenant.brandingConfig,
      services,
      professionals,
      allowPublicBooking: policy?.allowPublicBooking ?? true,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 3: Criar rota GET /api/public/[slug]/availability**

Crie `src/app/api/public/[slug]/availability/route.ts`:

```typescript
import { publicBookingRepository } from '@/domains/scheduling/public-booking.repository'
import { availabilityService } from '@/domains/scheduling/availability.service'
import { handleApiError } from '@/shared/errors/handle-api-error'

export async function GET(
  req: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')       // "2026-06-15"
    const serviceId = searchParams.get('serviceId')
    const professionalId = searchParams.get('professionalId') // opcional

    if (!date || !serviceId) {
      return Response.json({ error: 'Parâmetros date e serviceId são obrigatórios.' }, { status: 400 })
    }

    const tenant = await publicBookingRepository.findTenantBySlug(params.slug)
    const policy = tenant.schedulingPolicy

    if (policy && !policy.allowPublicBooking) {
      return Response.json({ slots: [] })
    }

    const slots = await availabilityService.getAvailableSlots({
      tenantId: tenant.id,
      date,
      serviceId,
      professionalId: professionalId ?? undefined,
      paddingMinutes: policy?.paddingMinutes ?? 0,
    })

    return Response.json({ slots })
  } catch (error) {
    return handleApiError(error)
  }
}
```

> **Nota:** Verifique a assinatura real de `availabilityService.getAvailableSlots()` em `src/domains/scheduling/availability.service.ts` e adapte os parâmetros se necessário (o `paddingMinutes` pode precisar ser adicionado ao serviço existente).

- [ ] **Step 4: Adaptar AvailabilityService para suportar paddingMinutes**

Abra `src/domains/scheduling/availability.service.ts` e localize `getAvailableSlots`. Adicione `paddingMinutes?: number` como parâmetro opcional e use-o para alargar a ocupação de slots (após cada slot ocupado, bloqueie `paddingMinutes` extras).

- [ ] **Step 5: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 6: Commit**

```bash
git add src/domains/scheduling/public-booking.repository.ts src/app/api/public/
git commit -m "feat(api): API pública de dados do salão e disponibilidade de slots"
```

---

## Task 6: API Route Pública — Criar Agendamento (POST)

**Files:**
- Create: `src/app/api/public/[slug]/appointments/route.ts`

- [ ] **Step 1: Implementar rota POST /api/public/[slug]/appointments**

Crie `src/app/api/public/[slug]/appointments/route.ts`:

```typescript
import { z } from 'zod'
import { publicBookingRepository } from '@/domains/scheduling/public-booking.repository'
import { customerRepository } from '@/domains/crm/customer.repository'
import { schedulingService } from '@/domains/scheduling/scheduling.service'
import { schedulingPolicyService } from '@/domains/scheduling/scheduling-policy.service'
import { checkRateLimit } from '@/shared/rate-limit/public-rate-limit'
import { handleApiError } from '@/shared/errors/handle-api-error'
import { PublicBookingDisabledError, CustomerBlockedError } from '@/shared/errors/domain-errors'

const CreatePublicAppointmentSchema = z.object({
  serviceId: z.string().cuid(),
  professionalId: z.string().cuid().optional(),
  startsAt: z.string().datetime(),
  customerName: z.string().min(2).max(100),
  customerPhone: z.string().min(10).max(20),
  notes: z.string().max(500).optional(),
})

export async function POST(
  req: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
    const body = await req.json()
    const input = CreatePublicAppointmentSchema.parse(body)

    // Rate limit por IP (5/hora)
    const ipLimit = await checkRateLimit({ ip, action: 'appointment', maxPerWindow: 5 })
    if (!ipLimit.allowed) {
      return Response.json({ error: 'Muitas tentativas. Tente novamente em 1 hora.' }, { status: 429 })
    }

    // Rate limit por telefone (3/dia)
    const phoneLimit = await checkRateLimit({ phone: input.customerPhone, action: 'appointment', maxPerWindow: 3 })
    if (!phoneLimit.allowed) {
      return Response.json({ error: 'Limite de agendamentos por número atingido hoje.' }, { status: 429 })
    }

    const tenant = await publicBookingRepository.findTenantBySlug(params.slug)
    const policy = await schedulingPolicyService.getPolicy(tenant.id)

    if (!policy.allowPublicBooking) {
      throw new PublicBookingDisabledError()
    }

    // Validar antecedência mínima
    const startsAt = new Date(input.startsAt)
    const minStart = new Date(Date.now() + policy.minAdvanceMinutes * 60_000)
    if (startsAt < minStart) {
      return Response.json({ error: `Agendamentos precisam ser feitos com no mínimo ${policy.minAdvanceMinutes} minutos de antecedência.` }, { status: 422 })
    }

    // Validar janela máxima
    const maxStart = new Date(Date.now() + policy.maxAdvanceDays * 86_400_000)
    if (startsAt > maxStart) {
      return Response.json({ error: `Não é possível agendar com mais de ${policy.maxAdvanceDays} dias de antecedência.` }, { status: 422 })
    }

    // Criar ou recuperar cliente
    const customer = await customerRepository.findOrCreateByPhone(
      tenant.id,
      input.customerPhone,
      input.customerName
    )

    if (customer.isBlocked) {
      // Mensagem genérica — não revela o motivo ao cliente
      return Response.json({ error: 'Não foi possível completar o agendamento. Entre em contato com o salão.' }, { status: 403 })
    }

    // Criar agendamento (usa sistema existente com SYSTEM como criador)
    const appointment = await schedulingService.createAppointment(tenant.id, 'SYSTEM', {
      customerId: customer.id,
      serviceId: input.serviceId,
      professionalId: input.professionalId,
      startsAt,
      notes: input.notes,
      isPublicBooking: true,
    })

    return Response.json({ appointmentId: appointment.id, startsAt: appointment.startsAt }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
```

> **Nota:** `schedulingService.createAppointment` pode precisar receber `isPublicBooking: true` para enviar o template correto de WhatsApp. Verifique a assinatura e adapte se necessário — se não aceitar esse parâmetro, use uma flag diferente ou crie um método `createPublicAppointment`.

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Testar manualmente com curl**

```bash
# Substitua o slug pelo slug de um tenant real no banco de dev
curl -X POST http://localhost:3000/api/public/meu-salao/appointments \
  -H "Content-Type: application/json" \
  -d '{"serviceId":"SERVICE_ID","startsAt":"2026-06-20T10:00:00.000Z","customerName":"Ana Teste","customerPhone":"11999999999"}'
```

Esperado: `{"appointmentId":"...","startsAt":"..."}` com status 201.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/public/
git commit -m "feat(api): POST /api/public/[slug]/appointments — agendamento público com rate limit"
```

---

## Task 7: Booking UI — Page SSR + Vitrine + Step de Serviço

**Files:**
- Create: `src/app/(public)/agendar/[slug]/page.tsx`
- Create: `src/app/(public)/agendar/[slug]/booking-client.tsx`
- Create: `src/components/domain/booking/service-step.tsx`

- [ ] **Step 1: Criar página SSR com branding**

Crie `src/app/(public)/agendar/[slug]/page.tsx`:

```typescript
import { notFound } from 'next/navigation'
import { BookingClient } from './booking-client'

async function getTenantData(slug: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/public/${slug}`, { next: { revalidate: 60 } })
  if (!res.ok) return null
  return res.json()
}

export default async function BookingPage({ params }: { params: { slug: string } }) {
  const data = await getTenantData(params.slug)
  if (!data) notFound()

  const { branding } = data

  // CSS vars injetadas via SSR — zero flash de branding
  const brandingVars = branding ? `
    --color-primary: ${branding.primaryColor};
    --color-background: ${branding.backgroundColor};
    --color-foreground: ${branding.foregroundColor};
    --color-accent: ${branding.accentColor};
  ` : ''

  return (
    <div style={{ '--color-primary': branding?.primaryColor, '--color-background': branding?.backgroundColor } as React.CSSProperties}
      className="min-h-screen"
    >
      {brandingVars && <style>{`:root { ${brandingVars} }`}</style>}

      {/* Vitrine fixa no topo */}
      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          {branding?.logoUrl ? (
            <img src={branding.logoUrl} alt={data.name} className="h-10 w-10 rounded-lg object-contain" />
          ) : (
            <div className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-lg"
              style={{ backgroundColor: branding?.primaryColor ?? '#191919' }}>
              {data.name[0]}
            </div>
          )}
          <div>
            <h1 className="font-semibold text-slate-900 text-base leading-tight">{data.name}</h1>
            {data.address && <p className="text-xs text-slate-500">{data.address}</p>}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        <BookingClient tenantData={data} />
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Criar client component (stepper)**

Crie `src/app/(public)/agendar/[slug]/booking-client.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { ServiceStep } from '@/components/domain/booking/service-step'
import { ProfessionalStep } from '@/components/domain/booking/professional-step'
import { DateTimeStep } from '@/components/domain/booking/datetime-step'
import { PersonalStep } from '@/components/domain/booking/personal-step'
import { ConfirmationStep } from '@/components/domain/booking/confirmation-step'
import { BookingSuccess } from '@/components/domain/booking/booking-success'

export type BookingState = {
  serviceId?: string
  serviceName?: string
  serviceDuration?: number
  professionalId?: string
  professionalName?: string
  startsAt?: Date
  customerName?: string
  customerPhone?: string
  notes?: string
}

type Step = 'service' | 'professional' | 'datetime' | 'personal' | 'confirmation' | 'success'

export function BookingClient({ tenantData }: { tenantData: any }) {
  const [step, setStep] = useState<Step>('service')
  const [booking, setBooking] = useState<BookingState>({})
  const [appointmentId, setAppointmentId] = useState<string>()

  const singleProfessional = tenantData.professionals?.length === 1

  function handleServiceSelect(service: any) {
    setBooking(b => ({ ...b, serviceId: service.id, serviceName: service.name, serviceDuration: service.duration }))
    setStep(singleProfessional ? 'datetime' : 'professional')
  }

  function handleProfessionalSelect(professional: any) {
    setBooking(b => ({ ...b, professionalId: professional?.id, professionalName: professional?.name }))
    setStep('datetime')
  }

  function handleDateTimeSelect(startsAt: Date) {
    setBooking(b => ({ ...b, startsAt }))
    setStep('personal')
  }

  function handlePersonalData(data: { customerName: string; customerPhone: string; notes?: string }) {
    setBooking(b => ({ ...b, ...data }))
    setStep('confirmation')
  }

  async function handleConfirm() {
    const res = await fetch(`/api/public/${tenantData.slug}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceId: booking.serviceId,
        professionalId: booking.professionalId,
        startsAt: booking.startsAt?.toISOString(),
        customerName: booking.customerName,
        customerPhone: booking.customerPhone,
        notes: booking.notes,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      alert(err.error ?? 'Erro ao confirmar agendamento. Tente novamente.')
      return
    }

    const { appointmentId } = await res.json()
    setAppointmentId(appointmentId)
    setStep('success')
  }

  if (step === 'success') return <BookingSuccess booking={booking} appointmentId={appointmentId!} />

  return (
    <div className="space-y-4">
      {step === 'service' && (
        <ServiceStep services={tenantData.services} onSelect={handleServiceSelect} />
      )}
      {step === 'professional' && (
        <ProfessionalStep
          professionals={tenantData.professionals}
          onSelect={handleProfessionalSelect}
          onBack={() => setStep('service')}
        />
      )}
      {step === 'datetime' && (
        <DateTimeStep
          tenantSlug={tenantData.slug}
          serviceId={booking.serviceId!}
          professionalId={booking.professionalId}
          maxAdvanceDays={tenantData.schedulingPolicy?.maxAdvanceDays ?? 60}
          onSelect={handleDateTimeSelect}
          onBack={() => setStep(singleProfessional ? 'service' : 'professional')}
        />
      )}
      {step === 'personal' && (
        <PersonalStep onSubmit={handlePersonalData} onBack={() => setStep('datetime')} />
      )}
      {step === 'confirmation' && (
        <ConfirmationStep booking={booking} onConfirm={handleConfirm} onBack={() => setStep('personal')} />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Criar ServiceStep component**

Crie `src/components/domain/booking/service-step.tsx`:

```typescript
'use client'

type Service = {
  id: string
  name: string
  duration: number
  price: number
  priceType: 'FIXED' | 'RANGE' | 'ON_CONSULTATION'
  priceMin?: number | null
  priceMax?: number | null
  category?: string | null
}

function formatPrice(service: Service): string {
  if (service.priceType === 'ON_CONSULTATION') return 'Sob consulta'
  if (service.priceType === 'RANGE' && service.priceMin != null && service.priceMax != null) {
    return `R$ ${Number(service.priceMin).toFixed(2).replace('.', ',')} – R$ ${Number(service.priceMax).toFixed(2).replace('.', ',')}`
  }
  return `R$ ${Number(service.price).toFixed(2).replace('.', ',')}`
}

export function ServiceStep({ services, onSelect }: { services: Service[]; onSelect: (s: Service) => void }) {
  const categories = [...new Set(services.map(s => s.category ?? 'Outros'))]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Escolha o serviço</h2>
        <p className="text-sm text-slate-500 mt-1">Selecione o serviço que deseja agendar</p>
      </div>

      {categories.map(category => (
        <div key={category} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{category}</h3>
          {services.filter(s => (s.category ?? 'Outros') === category).map(service => (
            <button
              key={service.id}
              onClick={() => onSelect(service)}
              className="w-full text-left rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-400 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">{service.name}</p>
                  <p className="text-sm text-slate-500 mt-0.5">{service.duration} min</p>
                </div>
                <span className="text-sm font-semibold text-slate-700 shrink-0">{formatPrice(service)}</span>
              </div>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/app/\(public\)/ src/components/domain/booking/service-step.tsx
git commit -m "feat(booking): page SSR com branding + stepper client + ServiceStep"
```

---

## Task 8: Booking UI — Steps Professional, DateTime e Personal

**Files:**
- Create: `src/components/domain/booking/professional-step.tsx`
- Create: `src/components/domain/booking/datetime-step.tsx`
- Create: `src/components/domain/booking/personal-step.tsx`

- [ ] **Step 1: Criar ProfessionalStep**

Crie `src/components/domain/booking/professional-step.tsx`:

```typescript
'use client'

import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'

type Professional = { id: string; name: string }

export function ProfessionalStep({
  professionals,
  onSelect,
  onBack,
}: {
  professionals: Professional[]
  onSelect: (p: Professional | null) => void
  onBack: () => void
}) {
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ChevronLeft className="size-4" /> Voltar
      </button>
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Escolha o profissional</h2>
        <p className="text-sm text-slate-500 mt-1">Ou selecione o primeiro disponível</p>
      </div>

      <button
        onClick={() => onSelect(null)}
        className="w-full text-left rounded-xl border-2 border-dashed border-slate-200 bg-white p-4 hover:border-slate-400 transition-all"
      >
        <p className="font-medium text-slate-700">Qualquer disponível</p>
        <p className="text-sm text-slate-400 mt-0.5">Primeiro horário livre entre todos</p>
      </button>

      {professionals.map(p => (
        <button
          key={p.id}
          onClick={() => onSelect(p)}
          className="w-full text-left rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-400 hover:shadow-sm transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-slate-100 flex items-center justify-center font-semibold text-slate-600">
              {p.name[0]}
            </div>
            <p className="font-medium text-slate-900">{p.name}</p>
          </div>
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Criar DateTimeStep com calendar e slots**

Crie `src/components/domain/booking/datetime-step.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DAYS_PT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

export function DateTimeStep({
  tenantSlug,
  serviceId,
  professionalId,
  maxAdvanceDays,
  onSelect,
  onBack,
}: {
  tenantSlug: string
  serviceId: string
  professionalId?: string
  maxAdvanceDays: number
  onSelect: (date: Date) => void
  onBack: () => void
}) {
  const [viewDate, setViewDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [slots, setSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const maxDate = new Date(today.getTime() + maxAdvanceDays * 86_400_000)

  useEffect(() => {
    if (!selectedDay) return
    setLoadingSlots(true)
    const params = new URLSearchParams({ date: selectedDay, serviceId })
    if (professionalId) params.set('professionalId', professionalId)
    fetch(`/api/public/${tenantSlug}/availability?${params}`)
      .then(r => r.json())
      .then(d => setSlots(d.slots ?? []))
      .finally(() => setLoadingSlots(false))
  }, [selectedDay, serviceId, professionalId, tenantSlug])

  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate()
  const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay()

  function isDisabled(day: number): boolean {
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day)
    d.setHours(0, 0, 0, 0)
    return d < today || d > maxDate
  }

  function toDateString(day: number): string {
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day)
    return d.toISOString().split('T')[0]
  }

  function handleSlotClick(slot: string) {
    if (!selectedDay) return
    const [h, m] = slot.split(':').map(Number)
    const dt = new Date(selectedDay)
    dt.setHours(h, m, 0, 0)
    onSelect(dt)
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ChevronLeft className="size-4" /> Voltar
      </button>

      <h2 className="text-lg font-semibold text-slate-900">Escolha data e horário</h2>

      {/* Calendário */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            className="p-1 rounded hover:bg-slate-100">
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm font-semibold">{MONTHS_PT[viewDate.getMonth()]} {viewDate.getFullYear()}</span>
          <button onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            className="p-1 rounded hover:bg-slate-100">
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {DAYS_PT.map(d => <div key={d} className="text-xs text-slate-400 py-1">{d}</div>)}
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const ds = toDateString(day)
            const disabled = isDisabled(day)
            const selected = selectedDay === ds
            return (
              <button
                key={day}
                disabled={disabled}
                onClick={() => setSelectedDay(ds)}
                className={`rounded-lg py-2 text-sm transition-colors
                  ${disabled ? 'text-slate-300 cursor-not-allowed' : 'hover:bg-slate-100'}
                  ${selected ? 'bg-slate-900 text-white hover:bg-slate-800' : ''}`}
              >
                {day}
              </button>
            )
          })}
        </div>
      </div>

      {/* Slots */}
      {selectedDay && (
        <div>
          {loadingSlots ? (
            <p className="text-sm text-slate-400 text-center py-4">Carregando horários...</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">Nenhum horário disponível nesta data.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {slots.map(slot => (
                <button
                  key={slot}
                  onClick={() => handleSlotClick(slot)}
                  className="rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 hover:border-slate-900 hover:bg-slate-900 hover:text-white transition-all"
                >
                  {slot}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Criar PersonalStep**

Crie `src/components/domain/booking/personal-step.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 7) return `(${digits.slice(0,2)}) ${digits.slice(2)}`
  return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`
}

export function PersonalStep({
  onSubmit,
  onBack,
}: {
  onSubmit: (data: { customerName: string; customerPhone: string; notes?: string }) => void
  onBack: () => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [returning, setReturning] = useState<string | null>(null)
  const [lookupDone, setLookupDone] = useState(false)

  async function lookupByPhone(rawPhone: string) {
    // Lookup assíncrono após 11 dígitos (telefone completo)
    const digits = rawPhone.replace(/\D/g, '')
    if (digits.length < 11 || lookupDone) return
    setLookupDone(true)
    // Endpoint simples de lookup — se retornar nome, pré-preenche
    try {
      const res = await fetch(`/api/public/customer-lookup?phone=${digits}`)
      if (res.ok) {
        const data = await res.json()
        if (data.name) {
          setName(data.name)
          setReturning(data.name)
        }
      }
    } catch {
      // silencioso — não é crítico
    }
  }

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatPhone(e.target.value)
    setPhone(formatted)
    setLookupDone(false)
    setReturning(null)
    lookupByPhone(formatted)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit({ customerName: name, customerPhone: phone.replace(/\D/g, ''), notes: notes || undefined })
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ChevronLeft className="size-4" /> Voltar
      </button>

      <h2 className="text-lg font-semibold text-slate-900">Seus dados</h2>

      {returning && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
          Bem-vinda de volta, <strong>{returning}</strong>!
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Telefone WhatsApp</Label>
          <Input
            type="tel"
            placeholder="(00) 00000-0000"
            value={phone}
            onChange={handlePhoneChange}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Seu nome</Label>
          <Input
            placeholder="Nome completo"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            minLength={2}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Observações <span className="text-slate-400">(opcional)</span></Label>
          <Textarea
            placeholder="Alguma observação para o profissional?"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
          />
        </div>
        <Button type="submit" className="w-full">Continuar →</Button>
      </form>
    </div>
  )
}
```

> **Nota:** A rota `/api/public/customer-lookup?phone=` ainda não existe — crie-a na Task seguinte ou simplifique removendo o lookup por ora. O fluxo funciona sem ela; o cliente apenas preenche o nome manualmente.

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/components/domain/booking/
git commit -m "feat(booking): steps Professional, DateTime e Personal"
```

---

## Task 9: Booking UI — ConfirmationStep, BookingSuccess e Customer Lookup

**Files:**
- Create: `src/components/domain/booking/confirmation-step.tsx`
- Create: `src/components/domain/booking/booking-success.tsx`
- Create: `src/app/api/public/customer-lookup/route.ts`

- [ ] **Step 1: Criar ConfirmationStep**

Crie `src/components/domain/booking/confirmation-step.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { ChevronLeft, Calendar, Clock, User, Scissors } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { BookingState } from '@/app/(public)/agendar/[slug]/booking-client'

function formatDateTime(date?: Date): string {
  if (!date) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  }).format(date)
}

export function ConfirmationStep({
  booking,
  onConfirm,
  onBack,
}: {
  booking: BookingState
  onConfirm: () => Promise<void>
  onBack: () => void
}) {
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    try {
      await onConfirm()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ChevronLeft className="size-4" /> Voltar
      </button>

      <h2 className="text-lg font-semibold text-slate-900">Confirmar agendamento</h2>

      <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
        <div className="flex items-center gap-3 p-4">
          <Scissors className="size-4 text-slate-400 shrink-0" />
          <div>
            <p className="text-xs text-slate-400">Serviço</p>
            <p className="font-medium text-slate-900">{booking.serviceName}</p>
            {booking.serviceDuration && <p className="text-sm text-slate-500">{booking.serviceDuration} min</p>}
          </div>
        </div>
        {booking.professionalName && (
          <div className="flex items-center gap-3 p-4">
            <User className="size-4 text-slate-400 shrink-0" />
            <div>
              <p className="text-xs text-slate-400">Profissional</p>
              <p className="font-medium text-slate-900">{booking.professionalName}</p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-3 p-4">
          <Calendar className="size-4 text-slate-400 shrink-0" />
          <div>
            <p className="text-xs text-slate-400">Data e horário</p>
            <p className="font-medium text-slate-900 capitalize">{formatDateTime(booking.startsAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4">
          <User className="size-4 text-slate-400 shrink-0" />
          <div>
            <p className="text-xs text-slate-400">Cliente</p>
            <p className="font-medium text-slate-900">{booking.customerName}</p>
            <p className="text-sm text-slate-500">{booking.customerPhone}</p>
          </div>
        </div>
      </div>

      <Button onClick={handleConfirm} disabled={loading} className="w-full" size="lg">
        {loading ? 'Confirmando...' : 'Confirmar agendamento'}
      </Button>

      <p className="text-xs text-center text-slate-400">
        Você receberá uma confirmação via WhatsApp.
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Criar BookingSuccess**

Crie `src/components/domain/booking/booking-success.tsx`:

```typescript
'use client'

import { CheckCircle2 } from 'lucide-react'
import type { BookingState } from '@/app/(public)/agendar/[slug]/booking-client'

function generateICSContent(booking: BookingState, tenantName: string): string {
  if (!booking.startsAt) return ''
  const start = booking.startsAt
  const end = new Date(start.getTime() + (booking.serviceDuration ?? 60) * 60_000)
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0',
    'BEGIN:VEVENT',
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${booking.serviceName} - ${tenantName}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
}

function downloadICS(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/calendar' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export function BookingSuccess({
  booking,
  appointmentId,
  tenantName = 'Salão',
}: {
  booking: BookingState
  appointmentId: string
  tenantName?: string
}) {
  function formatDate(d?: Date) {
    if (!d) return ''
    return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(d)
  }

  return (
    <div className="text-center space-y-6 py-8">
      <div className="flex justify-center">
        <CheckCircle2 className="size-16 text-green-500" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-slate-900">Agendamento confirmado!</h2>
        <p className="text-slate-500 mt-2">
          Você receberá uma confirmação via WhatsApp em breve.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 text-left space-y-2">
        <p className="font-medium text-slate-900">{booking.serviceName}</p>
        {booking.professionalName && <p className="text-sm text-slate-500">com {booking.professionalName}</p>}
        <p className="text-sm font-medium text-slate-700 capitalize">{formatDate(booking.startsAt)}</p>
      </div>

      <button
        onClick={() => downloadICS(generateICSContent(booking, tenantName), 'agendamento.ics')}
        className="text-sm text-blue-600 hover:underline"
      >
        Adicionar ao calendário
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Criar rota de lookup de cliente**

Crie `src/app/api/public/customer-lookup/route.ts`:

```typescript
import { prisma } from '@/shared/database/prisma'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const phone = searchParams.get('phone')

  if (!phone || phone.length < 10) {
    return Response.json({ name: null })
  }

  // Busca o customer mais recente com esse telefone (qualquer tenant)
  const customer = await prisma.customer.findFirst({
    where: { phone, isBlocked: false },
    select: { name: true },
    orderBy: { createdAt: 'desc' },
  })

  return Response.json({ name: customer?.name ?? null })
}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Testar fluxo manualmente**

Inicie o servidor de dev e acesse `http://localhost:3000/agendar/{slug-de-tenant-dev}`.

```bash
npm run dev
```

Percorra todos os 6 steps e confirme que o agendamento é criado.

- [ ] **Step 6: Commit**

```bash
git add src/components/domain/booking/ src/app/api/public/customer-lookup/
git commit -m "feat(booking): ConfirmationStep, BookingSuccess, customer lookup e geração de .ics"
```

---

## Task 10: Configurações — Aba Agendamento Online

**Files:**
- Modify: `src/app/(app)/configuracoes/page.tsx`
- Create: `src/components/domain/settings/scheduling-policy-form.tsx`
- Create: `src/hooks/use-scheduling-policy.ts`

- [ ] **Step 1: Criar hook TanStack Query para policy**

Crie `src/hooks/use-scheduling-policy.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/hooks/use-session' // adapte ao hook de sessão do projeto
import { toast } from 'sonner'

export function useSchedulingPolicy() {
  const { session } = useSession()
  return useQuery({
    queryKey: ['scheduling-policy'],
    queryFn: async () => {
      const res = await fetch('/api/scheduling/policy', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (!res.ok) throw new Error('Erro ao carregar política')
      return res.json()
    },
    enabled: !!session,
  })
}

export function useUpdateSchedulingPolicy() {
  const { session } = useSession()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      paddingMinutes?: number
      minAdvanceMinutes?: number
      maxAdvanceDays?: number
      allowPublicBooking?: boolean
    }) => {
      const res = await fetch('/api/scheduling/policy', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Erro ao salvar política')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scheduling-policy'] })
      toast.success('Configurações de agendamento salvas.')
    },
    onError: () => toast.error('Erro ao salvar. Tente novamente.'),
  })
}
```

- [ ] **Step 2: Criar formulário de política**

Crie `src/components/domain/settings/scheduling-policy-form.tsx`:

```typescript
'use client'

import { useSchedulingPolicy, useUpdateSchedulingPolicy } from '@/hooks/use-scheduling-policy'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useState, useEffect } from 'react'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'

const PADDING_OPTIONS = [
  { value: '0', label: 'Sem intervalo' }, { value: '5', label: '5 min' },
  { value: '10', label: '10 min' }, { value: '15', label: '15 min' },
  { value: '20', label: '20 min' }, { value: '30', label: '30 min' },
  { value: '45', label: '45 min' }, { value: '60', label: '60 min' },
]

const ADVANCE_OPTIONS = [
  { value: '0', label: 'Sem trava' }, { value: '5', label: '5 min' },
  { value: '10', label: '10 min' }, { value: '15', label: '15 min' },
  { value: '30', label: '30 min' }, { value: '60', label: '1 hora' },
  { value: '120', label: '2 horas' },
]

const MAX_DAYS_OPTIONS = [
  { value: '15', label: '15 dias' }, { value: '30', label: '30 dias' },
  { value: '45', label: '45 dias' }, { value: '60', label: '60 dias' },
  { value: '90', label: '90 dias' },
]

export function SchedulingPolicyForm({ tenantSlug }: { tenantSlug: string }) {
  const { data: policy, isLoading } = useSchedulingPolicy()
  const { mutate: update, isPending } = useUpdateSchedulingPolicy()
  const [form, setForm] = useState({
    allowPublicBooking: true,
    paddingMinutes: 0,
    minAdvanceMinutes: 15,
    maxAdvanceDays: 60,
  })

  useEffect(() => {
    if (policy) setForm({
      allowPublicBooking: policy.allowPublicBooking,
      paddingMinutes: policy.paddingMinutes,
      minAdvanceMinutes: policy.minAdvanceMinutes,
      maxAdvanceDays: policy.maxAdvanceDays,
    })
  }, [policy])

  if (isLoading) return <p className="text-sm text-slate-400">Carregando...</p>

  const bookingLink = `${process.env.NEXT_PUBLIC_APP_URL}/agendar/${tenantSlug}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Label>Aceitar agendamentos online</Label>
          <p className="text-sm text-slate-500 mt-0.5">Clientes podem agendar pelo link público</p>
        </div>
        <Switch
          checked={form.allowPublicBooking}
          onCheckedChange={v => setForm(f => ({ ...f, allowPublicBooking: v }))}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Intervalo entre atendimentos</Label>
        <Select value={String(form.paddingMinutes)} onValueChange={v => setForm(f => ({ ...f, paddingMinutes: Number(v) }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{PADDING_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Antecedência mínima</Label>
        <Select value={String(form.minAdvanceMinutes)} onValueChange={v => setForm(f => ({ ...f, minAdvanceMinutes: Number(v) }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{ADVANCE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Janela de agendamento</Label>
        <Select value={String(form.maxAdvanceDays)} onValueChange={v => setForm(f => ({ ...f, maxAdvanceDays: Number(v) }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{MAX_DAYS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Link de agendamento público</Label>
        <div className="flex gap-2">
          <input
            readOnly
            value={bookingLink}
            className="flex-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 font-mono"
          />
          <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(bookingLink); toast.success('Link copiado!') }}>
            <Copy className="size-4" />
          </Button>
        </div>
      </div>

      <Button onClick={() => update(form)} disabled={isPending}>
        {isPending ? 'Salvando...' : 'Salvar configurações'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 3: Adicionar aba em /configuracoes**

Em `src/app/(app)/configuracoes/page.tsx`, localize onde as abas são definidas e adicione:

```typescript
// Nos imports:
import { SchedulingPolicyForm } from '@/components/domain/settings/scheduling-policy-form'

// Na lista de abas (adapte ao padrão existente da página):
{ value: 'agendamento', label: 'Agendamento Online' }

// No conteúdo da aba:
<SchedulingPolicyForm tenantSlug={tenant.slug} />
```

> Verifique como `tenant.slug` é acessível na página de configurações — pode ser via query ao banco ou via contexto de sessão.

- [ ] **Step 4: Verificar TypeScript e testar manualmente**

```bash
npx tsc --noEmit
npm run dev
```

Acesse `/configuracoes`, vá para a aba "Agendamento Online" e teste salvar uma configuração.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-scheduling-policy.ts src/components/domain/settings/scheduling-policy-form.tsx src/app/\(app\)/configuracoes/page.tsx
git commit -m "feat(settings): aba Agendamento Online com SchedulingPolicy e link copiável"
```

---

## Task 11: Bloqueio de Cliente — UI

**Files:**
- Modify: `src/app/(app)/clientes/[id]/page.tsx`
- Create: `src/hooks/use-block-customer.ts`

- [ ] **Step 1: Criar hook de bloqueio**

Crie `src/hooks/use-block-customer.ts`:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/hooks/use-session'
import { toast } from 'sonner'

export function useBlockCustomer() {
  const { session } = useSession()
  const qc = useQueryClient()

  const block = useMutation({
    mutationFn: async ({ customerId, reason }: { customerId: string; reason?: string }) => {
      const res = await fetch(`/api/crm/customers/${customerId}/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ reason }),
      })
      if (!res.ok) throw new Error('Erro ao bloquear cliente')
      return res.json()
    },
    onSuccess: (_, { customerId }) => {
      qc.invalidateQueries({ queryKey: ['customer', customerId] })
      qc.invalidateQueries({ queryKey: ['customers'] })
      toast.success('Cliente bloqueado.')
    },
    onError: () => toast.error('Erro ao bloquear cliente.'),
  })

  const unblock = useMutation({
    mutationFn: async ({ customerId }: { customerId: string }) => {
      const res = await fetch(`/api/crm/customers/${customerId}/block`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (!res.ok) throw new Error('Erro ao desbloquear cliente')
      return res.json()
    },
    onSuccess: (_, { customerId }) => {
      qc.invalidateQueries({ queryKey: ['customer', customerId] })
      qc.invalidateQueries({ queryKey: ['customers'] })
      toast.success('Cliente desbloqueado.')
    },
    onError: () => toast.error('Erro ao desbloquear cliente.'),
  })

  return { block, unblock }
}
```

- [ ] **Step 2: Adicionar UI de bloqueio no perfil do cliente**

Em `src/app/(app)/clientes/[id]/page.tsx` (ou no componente de detalhe do cliente), adicione:

```typescript
// Nos imports:
import { useBlockCustomer } from '@/hooks/use-block-customer'
import { AlertTriangle, ShieldOff } from 'lucide-react'
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

// Dentro do componente:
const { block, unblock } = useBlockCustomer()
const [blockDialogOpen, setBlockDialogOpen] = useState(false)
const [blockReason, setBlockReason] = useState('')

// Banner para clientes bloqueados (adicionar no topo do perfil):
{customer.isBlocked && (
  <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
    <AlertTriangle className="size-4 shrink-0" />
    <div>
      <span className="font-medium">Cliente bloqueado</span>
      {customer.blockedReason && <span className="text-red-600"> — {customer.blockedReason}</span>}
    </div>
  </div>
)}

// Botões de ação (adicionar nas ações do perfil):
{customer.isBlocked ? (
  <Button variant="outline" size="sm" onClick={() => unblock.mutate({ customerId: customer.id })} disabled={unblock.isPending}>
    <ShieldOff className="size-4 mr-1.5" /> Desbloquear
  </Button>
) : (
  <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setBlockDialogOpen(true)}>
    <AlertTriangle className="size-4 mr-1.5" /> Bloquear
  </Button>
)}

// Dialog de confirmação:
<Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Bloquear cliente</DialogTitle>
    </DialogHeader>
    <p className="text-sm text-slate-600">Este cliente não poderá mais agendar. Informe o motivo (opcional):</p>
    <textarea
      className="w-full rounded-md border border-slate-200 p-2 text-sm"
      rows={3}
      placeholder="Ex: não compareceu 3 vezes sem aviso"
      value={blockReason}
      onChange={e => setBlockReason(e.target.value)}
    />
    <DialogFooter>
      <Button variant="outline" onClick={() => setBlockDialogOpen(false)}>Cancelar</Button>
      <Button
        variant="destructive"
        onClick={() => {
          block.mutate({ customerId: customer.id, reason: blockReason || undefined })
          setBlockDialogOpen(false)
        }}
        disabled={block.isPending}
      >
        Confirmar bloqueio
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Rodar todos os testes**

```bash
npx vitest run
```

Esperado: todos os testes passando.

- [ ] **Step 5: Commit e push**

```bash
git add src/
git commit -m "feat(crm): UI de bloqueio/desbloqueio de cliente com dialog de confirmação"
git push origin main
```

---

## Verificação Final do Track A

- [ ] Acessar `http://localhost:3000/agendar/{slug}` no mobile (DevTools → dispositivo 375px)
- [ ] Percorrer todos os 6 steps e criar um agendamento de ponta a ponta
- [ ] Verificar que o agendamento aparece na agenda do salão
- [ ] Verificar que o WhatsApp de confirmação foi disparado (log em NotificationLog)
- [ ] Tentar agendar com cliente bloqueado → mensagem genérica de erro
- [ ] Verificar `SchedulingPolicy` na aba "Agendamento Online" de configurações
- [ ] `npx tsc --noEmit` → zero erros
- [ ] `npx vitest run` → todos os testes passando

```bash
git push origin main
```

---

*Próximo plano: Track B — Stripe Billing (`2026-06-06-track-b-stripe-billing.md`)*
