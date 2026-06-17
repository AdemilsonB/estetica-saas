# Vitrine Pública + Portal do Cliente Final — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar a página pública de booking em vitrine completa do negócio com portal autenticado para o cliente final, sem breaking changes no fluxo de agendamento existente.

**Architecture:** Novas páginas SSR em `src/app/(public)/[slug]/*` consomem endpoints `/api/public/[slug]/*`. Autenticação de cliente usa cookie HttpOnly com payload HMAC-SHA256. Seção "Página Pública" adicionada em `/configuracoes`. A URL de agendamento existente (`/agendar/[slug]`) não muda.

**Tech Stack:** Next.js 15 App Router, Prisma, Shadcn UI, TailwindCSS, crypto (Node built-in)

## Global Constraints
- Todo output em Português do Brasil
- Multi-tenancy: toda query filtra por `tenantId` — nunca vem do body
- `tenantId` resolvido internamente via `slug`
- Mobile-first obrigatório (touch targets ≥ 44px)
- Sem `any` no TypeScript
- Zod em toda validação de API Route
- CPF nunca trafega em URL — sempre no body via POST
- Rate limit em `/auth` e `/customers`: 5 tentativas por IP por 15 minutos
- Branding tokens do `BrandingConfig` em toda UI pública
- URL `/agendar/[slug]` existente não muda — sem breaking changes
- Slugs reservados (agenda, login, configuracoes, etc.) não podem ser usados como tenant slug (documentar)

---

## Mapa de arquivos

**Criar:**
- `src/shared/auth/public-session.ts` — helper HMAC cookie para cliente final
- `src/app/api/public/[slug]/team/route.ts`
- `src/app/api/public/[slug]/products/route.ts`
- `src/app/api/public/[slug]/auth/route.ts`
- `src/app/api/public/[slug]/customers/route.ts`
- `src/app/api/public/[slug]/me/route.ts`
- `src/app/api/iam/tenant/cover-image/route.ts`
- `src/components/domain/settings/public-page-form.tsx`
- `src/components/domain/settings/team-visibility-list.tsx`
- `src/components/domain/booking/identification-step.tsx`
- `src/app/(public)/[slug]/layout.tsx`
- `src/app/(public)/[slug]/page.tsx`
- `src/app/(public)/[slug]/entrar/page.tsx`
- `src/app/(public)/[slug]/cliente/page.tsx`
- `src/components/domain/vitrine/vitrine-header.tsx`
- `src/components/domain/vitrine/vitrine-banner.tsx`
- `src/components/domain/vitrine/vitrine-team.tsx`
- `src/components/domain/vitrine/vitrine-tabs.tsx`

**Modificar:**
- `prisma/schema.prisma` — novos campos
- `src/shared/rate-limit/public-rate-limit.ts` — window configurável
- `src/domains/iam/iam.repository.ts` — updateUser + updateTenant estendidos
- `src/domains/iam/iam.service.ts` — updateMember + updateTenant estendidos
- `src/app/api/iam/tenant/route.ts` — schema estendido
- `src/app/api/iam/users/[userId]/route.ts` — schema estendido
- `src/app/api/public/[slug]/route.ts` — adicionar bio, instagramUrl, coverImageUrl, phone
- `src/domains/scheduling/public-booking.repository.ts` — findTenantBySlug estendido
- `src/app/(app)/configuracoes/page.tsx` — nova seção
- `src/components/domain/iam/edit-member-modal.tsx` — campo bio
- `src/app/(public)/agendar/[slug]/types.ts` — step 'identification'
- `src/app/(public)/agendar/[slug]/booking-client.tsx` — query params + identification step

---

## Task 1: Schema Prisma — campos novos (migração aditiva)

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `Tenant.instagramUrl`, `Tenant.coverImageUrl`, `Tenant.bio`; `User.bio`, `User.showOnPublicPage`; índice `[tenantId, cpf]` em `Customer`

- [ ] **Step 1: Adicionar campos ao schema**

Em `prisma/schema.prisma`, dentro do model `Tenant` (após `birthdayGiftServiceId`):
```prisma
  instagramUrl  String?
  coverImageUrl String?
  bio           String?
```

Dentro do model `User` (após `avatarUrl`):
```prisma
  bio              String?
  showOnPublicPage Boolean @default(true)
```

Dentro do model `Customer`, após os índices existentes, adicionar:
```prisma
  @@index([tenantId, cpf])
```

- [ ] **Step 2: Gerar e aplicar migration**

```bash
npx prisma migrate dev --name add_public_vitrine_fields
```

Expected: "Your database is now in sync with your schema."

- [ ] **Step 3: Verificar tipos gerados**

```bash
npx tsc --noEmit
```

Expected: zero erros.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): adiciona campos bio, coverImageUrl, instagramUrl, showOnPublicPage para vitrine pública"
```

---

## Task 2: Rate Limit — window configurável

**Files:**
- Modify: `src/shared/rate-limit/public-rate-limit.ts`
- Test: `src/shared/rate-limit/__tests__/public-rate-limit.test.ts`

**Interfaces:**
- Produces: `checkRateLimit({ ..., windowMs?: number })` — retrocompatível; padrão 1h

- [ ] **Step 1: Escrever teste de regressão + novo comportamento**

Em `src/shared/rate-limit/__tests__/public-rate-limit.test.ts`, adicionar após os testes existentes:

```typescript
it('respeita janela de 15 minutos quando windowMs=900000', async () => {
  prismaMock.publicRateLimit.findFirst.mockResolvedValue(null)
  prismaMock.publicRateLimit.create.mockResolvedValue({
    id: 'r1', ip: '1.1.1.1', phone: null, action: 'auth', count: 1, windowStart: new Date(),
  })

  const result = await checkRateLimit({
    ip: '1.1.1.1',
    action: 'auth',
    maxPerWindow: 5,
    windowMs: 15 * 60 * 1000,
  })

  expect(result.allowed).toBe(true)
  const createCall = prismaMock.publicRateLimit.create.mock.calls[0]![0]
  expect(createCall.data.action).toBe('auth')
})
```

- [ ] **Step 2: Rodar teste para ver falhar**

```bash
npx vitest run src/shared/rate-limit
```

Expected: 1 failing (checkRateLimit doesn't accept `windowMs` yet)

- [ ] **Step 3: Implementar a mudança**

Substituir o conteúdo de `src/shared/rate-limit/public-rate-limit.ts`:

```typescript
import { prisma } from '@/shared/database/prisma'

const DEFAULT_WINDOW_MS = 60 * 60 * 1000 // 1 hora

export async function checkRateLimit(params: {
  ip?: string
  phone?: string
  action: string
  maxPerWindow: number
  windowMs?: number
}): Promise<{ allowed: boolean; remaining: number }> {
  const { ip, phone, action, maxPerWindow, windowMs = DEFAULT_WINDOW_MS } = params
  const windowStart = new Date(Date.now() - windowMs)

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

- [ ] **Step 4: Rodar testes**

```bash
npx vitest run src/shared/rate-limit
```

Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add src/shared/rate-limit/
git commit -m "feat(rate-limit): torna janela de tempo configurável via windowMs"
```

---

## Task 3: Public Booking Repository — extensão para vitrine

**Files:**
- Modify: `src/domains/scheduling/public-booking.repository.ts`
- Modify: `src/app/api/public/[slug]/route.ts`

**Interfaces:**
- Produces: endpoint `GET /api/public/[slug]` agora retorna `bio`, `instagramUrl`, `coverImageUrl`, `phone`, `whatsappEnabled`; método `findPublicTeam(tenantId)` adicionado; método `findPublicProducts(tenantId)` adicionado

- [ ] **Step 1: Estender findTenantBySlug**

Em `src/domains/scheduling/public-booking.repository.ts`, no select de `findTenantBySlug`, adicionar após `evolutionConnected`:

```typescript
        whatsappEnabled: true,
        instagramUrl: true,
        coverImageUrl: true,
        bio: true,
```

- [ ] **Step 2: Adicionar findPublicTeam**

Após `findPublicPromotions`, adicionar:

```typescript
  async findPublicTeam(tenantId: string) {
    const members = await prisma.user.findMany({
      where: {
        tenantId,
        showOnPublicPage: true,
        role: { in: ['PROFESSIONAL', 'OWNER', 'MANAGER'] },
      },
      select: {
        id: true,
        name: true,
        role: true,
        avatarUrl: true,
        bio: true,
      },
      orderBy: { name: 'asc' },
    })
    return members
  }
```

- [ ] **Step 3: Adicionar findPublicProducts**

```typescript
  async findPublicProducts(tenantId: string) {
    return prisma.product.findMany({
      where: { tenantId, active: true },
      select: {
        id: true,
        name: true,
        salePrice: true,
        imageUrl: true,
        category: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    })
  }
```

- [ ] **Step 4: Atualizar GET /api/public/[slug]/route.ts**

Substituir o return com os novos campos (manter todos existentes):

```typescript
    return Response.json({
      name: tenant.name,
      slug: tenant.slug,
      phone: tenant.phone,
      address: tenant.address,
      timezone: tenant.timezone,
      businessHours: tenant.businessHours,
      branding: tenant.brandingConfig,
      bio: tenant.bio,
      instagramUrl: tenant.instagramUrl,
      coverImageUrl: tenant.coverImageUrl,
      whatsappEnabled: tenant.whatsappEnabled,
      services,
      professionals,
      packages,
      promotions,
      allowPublicBooking: tenant.schedulingPolicy?.allowPublicBooking ?? true,
    })
```

- [ ] **Step 5: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Expected: zero erros.

- [ ] **Step 6: Commit**

```bash
git add src/domains/scheduling/public-booking.repository.ts src/app/api/public/
git commit -m "feat(public-api): estende endpoint /api/public/[slug] com bio, instagram, coverImage, equipe e produtos"
```

---

## Task 4: Novos endpoints públicos — /team e /products

**Files:**
- Create: `src/app/api/public/[slug]/team/route.ts`
- Create: `src/app/api/public/[slug]/products/route.ts`

**Interfaces:**
- Produces:
  - `GET /api/public/{slug}/team` → `[{ id, name, role, avatarUrl, bio }]`
  - `GET /api/public/{slug}/products` → `[{ id, name, salePrice, imageUrl, categoryName }]`

- [ ] **Step 1: Criar /team/route.ts**

```typescript
// src/app/api/public/[slug]/team/route.ts
import { publicBookingRepository } from '@/domains/scheduling/public-booking.repository'
import { handleApiError } from '@/shared/http/handle-api-error'

export async function GET(
  _req: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params
    const tenant = await publicBookingRepository.findTenantBySlug(slug)
    const team = await publicBookingRepository.findPublicTeam(tenant.id)
    return Response.json(team)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 2: Criar /products/route.ts**

```typescript
// src/app/api/public/[slug]/products/route.ts
import { publicBookingRepository } from '@/domains/scheduling/public-booking.repository'
import { handleApiError } from '@/shared/http/handle-api-error'

export async function GET(
  _req: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params
    const tenant = await publicBookingRepository.findTenantBySlug(slug)
    const products = await publicBookingRepository.findPublicProducts(tenant.id)
    return Response.json(
      products.map((p) => ({
        id: p.id,
        name: p.name,
        salePrice: Number(p.salePrice),
        imageUrl: p.imageUrl,
        categoryName: p.category?.name ?? null,
      })),
    )
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 3: TypeScript**

```bash
npx tsc --noEmit
```

Expected: zero erros.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/public/[slug]/team/ src/app/api/public/[slug]/products/
git commit -m "feat(public-api): adiciona endpoints /team e /products para vitrine pública"
```

---

## Task 5: Public Customer Session — helper HMAC

**Files:**
- Create: `src/shared/auth/public-session.ts`

**Interfaces:**
- Produces: `createPublicSession(customerId, tenantId, slug): string`, `verifyPublicSession(token): Payload | null`, `COOKIE_NAME`, `MAX_AGE_SECONDS`

Requer `PUBLIC_SESSION_SECRET` em variáveis de ambiente (adicionar ao `.env.local` local e ao Vercel).

- [ ] **Step 1: Criar o helper**

```typescript
// src/shared/auth/public-session.ts
import { createHmac, timingSafeEqual } from 'crypto'

const SESSION_SECRET =
  process.env.PUBLIC_SESSION_SECRET ?? 'dev-secret-change-in-production'

export const COOKIE_NAME = 'agende_pub_sess'
export const MAX_AGE_SECONDS = 30 * 24 * 60 * 60 // 30 dias

export type PublicCustomerPayload = {
  customerId: string
  tenantId: string
  slug: string
  iat: number
  exp: number
}

function signToken(payload: PublicCustomerPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', SESSION_SECRET).update(data).digest('base64url')
  return `${data}.${sig}`
}

export function createPublicSession(
  customerId: string,
  tenantId: string,
  slug: string,
): string {
  const now = Math.floor(Date.now() / 1000)
  return signToken({
    customerId,
    tenantId,
    slug,
    iat: now,
    exp: now + MAX_AGE_SECONDS,
  })
}

export function verifyPublicSession(token: string): PublicCustomerPayload | null {
  try {
    const dotIdx = token.lastIndexOf('.')
    if (dotIdx < 0) return null
    const data = token.slice(0, dotIdx)
    const sig = token.slice(dotIdx + 1)
    const expected = createHmac('sha256', SESSION_SECRET)
      .update(data)
      .digest('base64url')
    if (
      sig.length !== expected.length ||
      !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    )
      return null
    const payload = JSON.parse(
      Buffer.from(data, 'base64url').toString(),
    ) as PublicCustomerPayload
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Expected: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/shared/auth/public-session.ts
git commit -m "feat(auth): helper HMAC para sessão de cliente final (cookie HttpOnly)"
```

---

## Task 6: APIs de autenticação do cliente final

**Files:**
- Create: `src/app/api/public/[slug]/auth/route.ts`
- Create: `src/app/api/public/[slug]/customers/route.ts`
- Create: `src/app/api/public/[slug]/me/route.ts`

**Interfaces:**
- Consumes: `publicBookingRepository.findTenantBySlug`, `checkRateLimit` (windowMs=900000), `createPublicSession`, `verifyPublicSession`, `COOKIE_NAME`, `MAX_AGE_SECONDS`
- Produces:
  - `POST /auth` → 200 + Set-Cookie ou 401 (genérico) ou 429
  - `POST /customers` → 200 + Set-Cookie
  - `GET /me` → dados do cliente ou 401
  - `PATCH /me` → dados atualizados

- [ ] **Step 1: Criar auth/route.ts**

```typescript
// src/app/api/public/[slug]/auth/route.ts
import { z } from 'zod'
import { prisma } from '@/shared/database/prisma'
import { publicBookingRepository } from '@/domains/scheduling/public-booking.repository'
import { checkRateLimit } from '@/shared/rate-limit/public-rate-limit'
import {
  createPublicSession,
  COOKIE_NAME,
  MAX_AGE_SECONDS,
} from '@/shared/auth/public-session'
import { handleApiError } from '@/shared/http/handle-api-error'

const AuthSchema = z.object({
  cpf: z.string().min(11).max(14),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, '')
}

type RouteContext = { params: Promise<{ slug: string }> }

export async function POST(req: Request, context: RouteContext) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const limit = await checkRateLimit({
      ip,
      action: 'customer_auth',
      maxPerWindow: 5,
      windowMs: 15 * 60 * 1000,
    })
    if (!limit.allowed) {
      return Response.json(
        { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Muitas tentativas. Aguarde 15 minutos.' } },
        { status: 429 },
      )
    }

    const body = await req.json()
    const parsed = AuthSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.' } }, { status: 422 })
    }

    const { slug } = await context.params
    const tenant = await publicBookingRepository.findTenantBySlug(slug)

    const cpf = normalizeCpf(parsed.data.cpf)
    const birthDate = new Date(parsed.data.birthDate)

    const customer = await prisma.customer.findFirst({
      where: {
        tenantId: tenant.id,
        cpf,
        birthDate: {
          gte: new Date(birthDate.getFullYear(), birthDate.getMonth(), birthDate.getDate()),
          lt: new Date(birthDate.getFullYear(), birthDate.getMonth(), birthDate.getDate() + 1),
        },
      },
      select: { id: true, name: true },
    })

    // Resposta genérica — não revela qual campo falhou
    if (!customer) {
      return Response.json(
        { error: { code: 'AUTH_FAILED', message: 'Dados não encontrados.' } },
        { status: 401 },
      )
    }

    const token = createPublicSession(customer.id, tenant.id, slug)
    return new Response(JSON.stringify({ name: customer.name }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${MAX_AGE_SECONDS}`,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 2: Criar customers/route.ts**

```typescript
// src/app/api/public/[slug]/customers/route.ts
import { z } from 'zod'
import { prisma } from '@/shared/database/prisma'
import { publicBookingRepository } from '@/domains/scheduling/public-booking.repository'
import { checkRateLimit } from '@/shared/rate-limit/public-rate-limit'
import {
  createPublicSession,
  COOKIE_NAME,
  MAX_AGE_SECONDS,
} from '@/shared/auth/public-session'
import { handleApiError } from '@/shared/http/handle-api-error'

const CreateCustomerSchema = z.object({
  name: z.string().min(2).max(100),
  cpf: z.string().min(11).max(14),
  phone: z.string().min(10).max(20),
  email: z.string().email().max(100),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, '')
}

type RouteContext = { params: Promise<{ slug: string }> }

export async function POST(req: Request, context: RouteContext) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const limit = await checkRateLimit({
      ip,
      action: 'customer_register',
      maxPerWindow: 5,
      windowMs: 15 * 60 * 1000,
    })
    if (!limit.allowed) {
      return Response.json(
        { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Muitas tentativas. Aguarde 15 minutos.' } },
        { status: 429 },
      )
    }

    const body = await req.json()
    const parsed = CreateCustomerSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.', details: parsed.error.flatten().fieldErrors } },
        { status: 422 },
      )
    }

    const { slug } = await context.params
    const tenant = await publicBookingRepository.findTenantBySlug(slug)

    const cpf = normalizeCpf(parsed.data.cpf)
    const birthDate = new Date(parsed.data.birthDate)

    // Verifica se já existe Customer com mesmo CPF no tenant
    const existing = await prisma.customer.findFirst({
      where: { tenantId: tenant.id, cpf },
      select: { id: true, name: true },
    })

    const customer =
      existing ??
      (await prisma.customer.create({
        data: {
          tenantId: tenant.id,
          name: parsed.data.name,
          cpf,
          phone: parsed.data.phone,
          email: parsed.data.email,
          birthDate,
          consentGiven: true,
          consentDate: new Date(),
          consentOrigin: 'public_booking',
        },
        select: { id: true, name: true },
      }))

    const token = createPublicSession(customer.id, tenant.id, slug)
    return new Response(JSON.stringify({ name: customer.name }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${MAX_AGE_SECONDS}`,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 3: Criar me/route.ts**

```typescript
// src/app/api/public/[slug]/me/route.ts
import { z } from 'zod'
import { prisma } from '@/shared/database/prisma'
import { publicBookingRepository } from '@/domains/scheduling/public-booking.repository'
import { verifyPublicSession, COOKIE_NAME, createPublicSession, MAX_AGE_SECONDS } from '@/shared/auth/public-session'
import { handleApiError } from '@/shared/http/handle-api-error'

function getSessionFromRequest(req: Request) {
  const cookieHeader = req.headers.get('cookie') ?? ''
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))
  if (!match?.[1]) return null
  return verifyPublicSession(match[1])
}

type RouteContext = { params: Promise<{ slug: string }> }

export async function GET(req: Request, context: RouteContext) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) {
      return Response.json({ error: { code: 'UNAUTHORIZED', message: 'Sessão inválida.' } }, { status: 401 })
    }

    const { slug } = await context.params
    const tenant = await publicBookingRepository.findTenantBySlug(slug)
    if (session.tenantId !== tenant.id) {
      return Response.json({ error: { code: 'UNAUTHORIZED', message: 'Sessão inválida.' } }, { status: 401 })
    }

    const customer = await prisma.customer.findFirst({
      where: { id: session.customerId, tenantId: tenant.id },
      select: {
        id: true,
        name: true,
        cpf: true,
        phone: true,
        email: true,
        birthDate: true,
        appointments: {
          where: { tenantId: tenant.id },
          orderBy: { startsAt: 'desc' },
          take: 21,
          select: {
            id: true,
            startsAt: true,
            status: true,
            price: true,
            service: { select: { name: true } },
            package: { select: { name: true } },
            professional: { select: { name: true } },
          },
        },
      },
    })

    if (!customer) {
      return Response.json({ error: { code: 'NOT_FOUND', message: 'Cliente não encontrado.' } }, { status: 404 })
    }

    return Response.json({
      id: customer.id,
      name: customer.name,
      cpf: customer.cpf,
      phone: customer.phone,
      email: customer.email,
      birthDate: customer.birthDate,
      appointments: customer.appointments.map((a) => ({
        id: a.id,
        startsAt: a.startsAt,
        status: a.status,
        price: Number(a.price),
        serviceName: a.service?.name ?? a.package?.name ?? null,
        professionalName: a.professional.name,
      })),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

const UpdateMeSchema = z
  .object({
    phone: z.string().min(10).max(20).optional(),
    email: z.string().email().max(100).optional(),
  })
  .refine((d) => d.phone ?? d.email, { message: 'Pelo menos um campo.' })

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) {
      return Response.json({ error: { code: 'UNAUTHORIZED', message: 'Sessão inválida.' } }, { status: 401 })
    }

    const { slug } = await context.params
    const tenant = await publicBookingRepository.findTenantBySlug(slug)
    if (session.tenantId !== tenant.id) {
      return Response.json({ error: { code: 'UNAUTHORIZED', message: 'Sessão inválida.' } }, { status: 401 })
    }

    const body = await req.json()
    const parsed = UpdateMeSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.' } }, { status: 422 })
    }

    const updated = await prisma.customer.update({
      where: { id: session.customerId },
      data: parsed.data,
      select: { id: true, name: true, phone: true, email: true },
    })

    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 4: TypeScript**

```bash
npx tsc --noEmit
```

Expected: zero erros.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/public/[slug]/auth/ src/app/api/public/[slug]/customers/ src/app/api/public/[slug]/me/
git commit -m "feat(public-api): autenticação e portal do cliente final (POST /auth, POST /customers, GET+PATCH /me)"
```

---

## Task 7: Admin Settings — campos bio, instagramUrl, coverImageUrl no Tenant

**Files:**
- Modify: `src/domains/iam/iam.repository.ts`
- Modify: `src/domains/iam/iam.service.ts`
- Modify: `src/app/api/iam/tenant/route.ts`
- Create: `src/app/api/iam/tenant/cover-image/route.ts`
- Create: `src/components/domain/settings/public-page-form.tsx`
- Modify: `src/app/(app)/configuracoes/page.tsx`

**Interfaces:**
- Produces: `PATCH /api/iam/tenant` aceita `{ bio?, instagramUrl?, coverImageUrl? }`; `POST /api/iam/tenant/cover-image` faz upload para Storage e retorna `{ coverImageUrl }`

- [ ] **Step 1: Estender iam.repository.ts updateTenant**

Em `src/domains/iam/iam.repository.ts`, atualizar assinatura e tipo do `updateTenant`:

```typescript
  async updateTenant(
    tenantId: string,
    data: {
      name?: string
      phone?: string | null
      address?: string | null
      bio?: string | null
      instagramUrl?: string | null
      coverImageUrl?: string | null
    },
  ) {
    return prisma.tenant.update({
      where: { id: tenantId },
      data,
      select: {
        id: true,
        name: true,
        slug: true,
        phone: true,
        address: true,
        bio: true,
        instagramUrl: true,
        coverImageUrl: true,
      },
    })
  }
```

- [ ] **Step 2: Estender iam.service.ts updateTenant**

```typescript
  async updateTenant(
    tenantId: string,
    data: {
      name?: string
      phone?: string | null
      address?: string | null
      bio?: string | null
      instagramUrl?: string | null
      coverImageUrl?: string | null
    },
  ) {
    return iamRepository.updateTenant(tenantId, data)
  }
```

- [ ] **Step 3: Estender PATCH /api/iam/tenant/route.ts**

Atualizar `updateTenantSchema`:

```typescript
const updateTenantSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  address: z.string().trim().max(200).nullable().optional(),
  bio: z.string().trim().max(280).nullable().optional(),
  instagramUrl: z.string().trim().url().max(200).nullable().optional(),
  coverImageUrl: z.string().trim().url().max(500).nullable().optional(),
})
```

- [ ] **Step 4: Criar cover-image upload endpoint**

```typescript
// src/app/api/iam/tenant/cover-image/route.ts
import { supabaseAdmin } from '@/integrations/supabase/admin'
import { getSessionContext } from '@/shared/auth/session'
import { DomainError, ValidationError } from '@/shared/errors'
import { handleApiError } from '@/shared/http/handle-api-error'
import { prisma } from '@/shared/database/prisma'

const BUCKET = 'cover-images'
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024 // 5MB

async function ensureBucketExists() {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets()
  if (buckets?.find((b) => b.id === BUCKET)) return
  await supabaseAdmin.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: ALLOWED_TYPES,
  })
}

export async function POST(req: Request) {
  try {
    const session = await getSessionContext(req)

    const formData = await req.formData()
    const file = formData.get('cover')

    if (!(file instanceof File)) {
      throw new ValidationError('Campo cover ausente ou inválido.')
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new ValidationError('Formato não suportado. Use PNG, JPG ou WebP.')
    }
    if (file.size > MAX_BYTES) {
      throw new ValidationError('Arquivo excede 5MB.')
    }

    await ensureBucketExists()

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `${session.tenantId}/cover.${ext}`

    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: true })

    if (error) throw new DomainError(`Upload falhou: ${error.message}`, 'STORAGE_ERROR', 502)

    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)

    await prisma.tenant.update({
      where: { id: session.tenantId },
      data: { coverImageUrl: data.publicUrl },
    })

    return Response.json({ coverImageUrl: data.publicUrl }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 5: Criar public-page-form.tsx**

```typescript
// src/components/domain/settings/public-page-form.tsx
'use client'

import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { Instagram, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type Props = {
  initial: {
    bio: string | null
    instagramUrl: string | null
    coverImageUrl: string | null
    phone: string | null
    whatsappEnabled: boolean
  }
}

export function PublicPageForm({ initial }: Props) {
  const [bio, setBio] = useState(initial.bio ?? '')
  const [instagramUrl, setInstagramUrl] = useState(initial.instagramUrl ?? '')
  const [coverImageUrl, setCoverImageUrl] = useState(initial.coverImageUrl ?? '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('cover', file)
      const res = await fetch('/api/iam/tenant/cover-image', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Erro no upload')
      const data = (await res.json()) as { coverImageUrl: string }
      setCoverImageUrl(data.coverImageUrl)
      toast.success('Foto de capa atualizada')
    } catch {
      toast.error('Falha no upload da foto de capa')
    } finally {
      setUploading(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/iam/tenant', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bio: bio || null,
          instagramUrl: instagramUrl || null,
        }),
      })
      if (!res.ok) throw new Error('Erro ao salvar')
      toast.success('Página pública atualizada')
    } catch {
      toast.error('Falha ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const whatsappPreview = initial.phone
    ? `wa.me/55${initial.phone.replace(/\D/g, '')}`
    : null

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {/* Foto de capa */}
      <div className="space-y-2">
        <Label>Foto de capa</Label>
        {coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverImageUrl}
            alt="Capa"
            className="h-24 w-full rounded-lg object-cover"
          />
        )}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          ref={fileRef}
          onChange={handleCoverUpload}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="size-4 mr-1.5" />
          {uploading ? 'Enviando...' : 'Enviar foto'}
        </Button>
        <p className="text-xs text-muted-foreground">PNG, JPG ou WebP · máx 5MB · ideal 1200×400px</p>
      </div>

      {/* Bio */}
      <div className="space-y-1.5">
        <Label htmlFor="pub-bio">Bio do negócio</Label>
        <Textarea
          id="pub-bio"
          placeholder="Conte sobre seu negócio em até 280 caracteres..."
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={280}
          rows={3}
        />
        <p className="text-xs text-muted-foreground text-right">{bio.length}/280</p>
      </div>

      {/* Instagram */}
      <div className="space-y-1.5">
        <Label htmlFor="pub-instagram" className="flex items-center gap-1.5">
          <Instagram className="size-3.5" />
          Instagram
        </Label>
        <Input
          id="pub-instagram"
          type="url"
          placeholder="https://instagram.com/seunegocio"
          value={instagramUrl}
          onChange={(e) => setInstagramUrl(e.target.value)}
        />
      </div>

      {/* WhatsApp — preview readonly */}
      {whatsappPreview && (
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-sm">WhatsApp (gerado automaticamente)</Label>
          <div className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">
            {whatsappPreview}
          </div>
          <p className="text-xs text-muted-foreground">
            Gerado a partir do telefone do negócio. Para alterar, edite "Dados do negócio".
          </p>
        </div>
      )}

      <Button type="submit" disabled={saving} className="rounded-full">
        {saving ? 'Salvando...' : 'Salvar'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 6: Adicionar seção em configuracoes/page.tsx**

Em `src/app/(app)/configuracoes/page.tsx`:

1. Adicionar import no topo:
```typescript
import { PublicPageForm } from '@/components/domain/settings/public-page-form'
import { Globe } from 'lucide-react'
```

2. Adicionar type:
```typescript
type TenantPublicInfo = {
  bio: string | null
  instagramUrl: string | null
  coverImageUrl: string | null
  phone: string | null
  whatsappEnabled: boolean
}
```

3. Adicionar state e effect após `businessInfo`:
```typescript
const [tenantPublicInfo, setTenantPublicInfo] = useState<TenantPublicInfo | null>(null)

useEffect(() => {
  fetch('/api/iam/tenant')
    .then((r) => r.json())
    .then((data) => setTenantPublicInfo(data as TenantPublicInfo))
    .catch(() => {})
}, [])
```

4. Adicionar SettingsCard dentro do grupo "Divulgue e automatize", após o card "Meu link de agendamento":
```tsx
<SettingsCard
  icon={Globe}
  title="Página pública"
  subtitle="Foto de capa, bio e redes sociais — aparecem na sua vitrine online"
>
  {tenantPublicInfo ? (
    <PublicPageForm initial={tenantPublicInfo} />
  ) : (
    <div className="flex items-center justify-center py-6">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  )}
</SettingsCard>
```

- [ ] **Step 7: TypeScript + teste visual**

```bash
npx tsc --noEmit
```

Expected: zero erros.

- [ ] **Step 8: Commit**

```bash
git add src/domains/iam/ src/app/api/iam/tenant/ src/components/domain/settings/public-page-form.tsx src/app/(app)/configuracoes/page.tsx
git commit -m "feat(settings): seção Página Pública com bio, instagram e foto de capa"
```

---

## Task 8: Admin Settings — toggle showOnPublicPage por membro

**Files:**
- Modify: `src/domains/iam/iam.repository.ts` — updateUser aceita showOnPublicPage
- Modify: `src/domains/iam/iam.service.ts` — updateMember aceita showOnPublicPage
- Modify: `src/app/api/iam/users/[userId]/route.ts` — schema estendido
- Create: `src/components/domain/settings/team-visibility-list.tsx`
- Modify: `src/app/(app)/configuracoes/page.tsx` — adicionar card de visibilidade da equipe

**Interfaces:**
- Produces: `PATCH /api/iam/users/[userId]` aceita `{ showOnPublicPage?: boolean }`

- [ ] **Step 1: Estender iam.repository.ts updateUser**

Atualizar a assinatura do `updateUser`:

```typescript
  async updateUser(
    tenantId: string,
    userId: string,
    data: {
      name?: string
      email?: string
      avatarUrl?: string | null
      bio?: string | null
      showOnPublicPage?: boolean
    },
  ) {
    await prisma.user.updateMany({ where: { id: userId, tenantId }, data })
    return prisma.user.findFirstOrThrow({
      where: { id: userId, tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        bio: true,
        showOnPublicPage: true,
        roleId: true,
        customRole: { select: { name: true } },
        createdAt: true,
      },
    })
  }
```

- [ ] **Step 2: Estender iam.service.ts updateMember**

Adicionar `bio` e `showOnPublicPage` ao tipo de input do `updateMember`:

```typescript
  async updateMember(
    tenantId: string,
    requesterId: string,
    targetId: string,
    input: { name?: string; email?: string; avatarUrl?: string | null; bio?: string | null; showOnPublicPage?: boolean },
  ) {
    // ... lógica existente (não muda)
    return iamRepository.updateUser(tenantId, targetId, input)
  }
```

- [ ] **Step 3: Estender PATCH /api/iam/users/[userId]/route.ts**

```typescript
const updateMemberSchema = z.object({
  roleId: z.string().min(1).optional(),
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().optional(),
  bio: z.string().max(280).nullable().optional(),
  showOnPublicPage: z.boolean().optional(),
}).refine((d) => d.roleId ?? d.name ?? d.email ?? d.bio !== undefined ?? d.showOnPublicPage !== undefined, {
  message: 'Pelo menos um campo deve ser fornecido.',
})
```

No handler PATCH, adicionar após o bloco `if (body.roleId)`:
```typescript
    if (body.bio !== undefined || body.showOnPublicPage !== undefined) {
      const user = await iamService.updateMember(session.tenantId, session.userId, userId, {
        bio: body.bio,
        showOnPublicPage: body.showOnPublicPage,
      })
      return Response.json(user)
    }
```

- [ ] **Step 4: Criar team-visibility-list.tsx**

```typescript
// src/components/domain/settings/team-visibility-list.tsx
'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'

type Member = {
  id: string
  name: string
  role: string
  avatarUrl: string | null
  showOnPublicPage: boolean
}

export function TeamVisibilityList() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/iam/users')
      .then((r) => r.json())
      .then((data) => setMembers(data as Member[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleToggle(memberId: string, value: boolean) {
    setPending((s) => new Set(s).add(memberId))
    try {
      const res = await fetch(`/api/iam/users/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showOnPublicPage: value }),
      })
      if (!res.ok) throw new Error()
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, showOnPublicPage: value } : m)),
      )
    } catch {
      toast.error('Falha ao atualizar visibilidade')
    } finally {
      setPending((s) => { const n = new Set(s); n.delete(memberId); return n })
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-3">
        Membros visíveis aparecem na seção "Nossa equipe" da sua vitrine online.
      </p>
      {members.map((m) => (
        <div
          key={m.id}
          className="flex items-center justify-between rounded-xl border bg-card px-4 py-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
              {m.name[0]?.toUpperCase()}
            </div>
            <span className="truncate text-sm font-medium">{m.name}</span>
          </div>
          <Switch
            checked={m.showOnPublicPage}
            disabled={pending.has(m.id)}
            onCheckedChange={(v) => handleToggle(m.id, v)}
            aria-label={`Exibir ${m.name} na página pública`}
          />
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Adicionar card em configuracoes/page.tsx**

Adicionar import:
```typescript
import { TeamVisibilityList } from '@/components/domain/settings/team-visibility-list'
import { Eye } from 'lucide-react'
```

Adicionar dentro do SettingsCard de "Página pública", após o `PublicPageForm`:
```tsx
<SettingsCard
  icon={Eye}
  title="Visibilidade da equipe"
  subtitle="Controle quais profissionais aparecem na sua vitrine pública"
>
  <TeamVisibilityList />
</SettingsCard>
```

- [ ] **Step 6: TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add src/domains/iam/ src/app/api/iam/users/ src/components/domain/settings/team-visibility-list.tsx src/app/(app)/configuracoes/page.tsx
git commit -m "feat(settings): toggle de visibilidade de membros na página pública"
```

---

## Task 9: Team member modal — campo bio

**Files:**
- Modify: `src/components/domain/iam/edit-member-modal.tsx`
- Modify: `src/hooks/iam/use-team.ts` (se existir, para incluir bio)

**Interfaces:**
- Consumes: `PATCH /api/iam/users/[userId]` com `{ bio }`
- Produces: campo bio visível no modal de edição, após e-mail

- [ ] **Step 1: Adicionar state bio ao EditMemberModal**

Em `src/components/domain/iam/edit-member-modal.tsx`:

Adicionar import:
```typescript
import { Textarea } from '@/components/ui/textarea'
```

Adicionar state:
```typescript
const [bio, setBio] = useState('')
```

No `useEffect` que carrega `member`:
```typescript
setBio(member.bio ?? '')
```

- [ ] **Step 2: Incluir bio no handleSubmit**

Adicionar ao bloco de `promises`:
```typescript
    if (bio !== (member.bio ?? '')) {
      promises.push(
        updateProfile.mutateAsync({ userId: member.id, bio }).catch((err) => {
          throw new Error(`Bio: ${err instanceof Error ? err.message : 'Erro'}`)
        }),
      )
    }
```

Nota: `useUpdateMemberProfile` precisa passar `bio` para o endpoint. Se o hook não suportar, adicionar ao payload do PATCH diretamente:

```typescript
// em useUpdateMemberProfile (hooks/iam/use-team.ts):
// Adicionar bio?: string | null ao tipo de input do mutateAsync
```

- [ ] **Step 3: Adicionar campo bio no JSX, após o campo e-mail e antes do Select de cargo**

```tsx
<div className="space-y-1.5">
  <Label htmlFor="edit-bio">
    Sobre mim{' '}
    <span className="text-slate-400 font-normal">(opcional)</span>
  </Label>
  <Textarea
    id="edit-bio"
    placeholder="Uma breve descrição sobre você..."
    value={bio}
    onChange={(e) => setBio(e.target.value)}
    maxLength={280}
    rows={3}
  />
  <p className="text-xs text-slate-400 text-right">{bio.length}/280</p>
</div>
```

- [ ] **Step 4: TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/components/domain/iam/edit-member-modal.tsx
git commit -m "feat(equipe): campo bio no modal de edição de membro"
```

---

## Task 10: Booking flow — pré-seleção via query params

**Files:**
- Modify: `src/app/(public)/agendar/[slug]/booking-client.tsx`
- Modify: `src/app/(public)/agendar/[slug]/page.tsx`

**Interfaces:**
- `?serviceId=xxx` → pré-seleciona serviço e avança para professional/datetime
- `?packageId=xxx` → pré-seleciona pacote e avança
- `?promotionId=xxx` — não aplicável diretamente (promoções têm seleção de serviço), ignora silenciosamente

- [ ] **Step 1: Ler params na page.tsx e passar para BookingClient**

Em `src/app/(public)/agendar/[slug]/page.tsx`, adicionar searchParams:

```typescript
export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ serviceId?: string; packageId?: string; promotionId?: string }>
}) {
  const { slug } = await params
  const sp = await searchParams
  const data = await fetchTenantData(slug)
  if (!data || !data.allowPublicBooking) notFound()
  // ...
  return (
    <div className="min-h-screen bg-[--booking-bg,#FAFAFA]">
      {/* ... header existente ... */}
      <main className="mx-auto max-w-lg px-4 py-6 pb-24">
        <BookingClient
          tenantData={data}
          preSelectServiceId={sp.serviceId}
          preSelectPackageId={sp.packageId}
        />
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Adicionar props e lógica de pré-seleção ao BookingClient**

Em `src/app/(public)/agendar/[slug]/booking-client.tsx`:

Adicionar às props:
```typescript
export function BookingClient({
  tenantData,
  preSelectServiceId,
  preSelectPackageId,
}: {
  tenantData: TenantPublicData
  preSelectServiceId?: string
  preSelectPackageId?: string
}) {
```

Adicionar `useEffect` de pré-seleção logo após os `useState`s (usa `useEffect` que roda apenas uma vez no mount):

```typescript
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (initialized) return
    setInitialized(true)

    if (preSelectServiceId) {
      const service = tenantData.services.find((s) => s.id === preSelectServiceId)
      if (service) {
        handleServiceSelect(service)
        return
      }
    }
    if (preSelectPackageId) {
      const pkg = tenantData.packages.find((p) => p.id === preSelectPackageId)
      if (pkg) {
        handlePackageSelect(pkg)
        return
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
```

- [ ] **Step 3: TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(public)/agendar/
git commit -m "feat(booking): pré-seleção de serviço/pacote via query params serviceId e packageId"
```

---

## Task 11: Booking flow — passo de identificação do cliente

**Files:**
- Modify: `src/app/(public)/agendar/[slug]/types.ts`
- Create: `src/components/domain/booking/identification-step.tsx`
- Modify: `src/app/(public)/agendar/[slug]/booking-client.tsx`

**Interfaces:**
- Novo step `'identification'` inserido entre `'personal'` e `'anamnese'`
- Sem sessão: tabs "Já sou cliente" / "Primeira vez aqui"
- Com sessão: "Agendando para [Nome]" + link "Não sou eu"
- Após identificação bem-sucedida: `booking.customerId` e `booking.identifiedCustomerName` são setados

- [ ] **Step 1: Adicionar tipo ao types.ts**

Em `src/app/(public)/agendar/[slug]/types.ts`, atualizar `BookingStep`:

```typescript
export type BookingStep =
  | 'service'
  | 'professional'
  | 'datetime'
  | 'personal'
  | 'identification'
  | 'anamnese'
  | 'confirmation'
  | 'success'
```

Adicionar aos campos de `BookingState`:

```typescript
  customerId?: string
  identifiedCustomerName?: string
```

- [ ] **Step 2: Criar identification-step.tsx**

```typescript
// src/components/domain/booking/identification-step.tsx
'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type Props = {
  tenantSlug: string
  onIdentified: (customerId: string, name: string) => void
  onBack: () => void
  primaryColor: string
}

function applyCpfMask(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function applyPhoneMask(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return `(${d}`
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export function IdentificationStep({ tenantSlug, onIdentified, onBack, primaryColor }: Props) {
  const [sessionName, setSessionName] = useState<string | null>(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [cpf, setCpf] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [newName, setNewName] = useState('')
  const [newCpf, setNewCpf] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newBirthDate, setNewBirthDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch(`/api/public/${tenantSlug}/me`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { name?: string } | null) => {
        if (data?.name) setSessionName(data.name)
      })
      .catch(() => {})
      .finally(() => setLoadingSession(false))
  }, [tenantSlug])

  async function handleLogout() {
    // Limpa cookie via endpoint (ou seta Max-Age=0)
    await fetch(`/api/public/${tenantSlug}/auth/logout`, { method: 'POST' }).catch(() => {})
    setSessionName(null)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/public/${tenantSlug}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: cpf.replace(/\D/g, ''), birthDate }),
      })
      const data = (await res.json()) as { name?: string; error?: { message: string } }
      if (!res.ok) {
        setError(data.error?.message ?? 'Dados não encontrados')
        return
      }
      onIdentified('', data.name ?? '')
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/public/${tenantSlug}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          cpf: newCpf.replace(/\D/g, ''),
          phone: newPhone.replace(/\D/g, ''),
          email: newEmail,
          birthDate: newBirthDate,
        }),
      })
      const data = (await res.json()) as { name?: string; error?: { message: string } }
      if (!res.ok) {
        setError(data.error?.message ?? 'Erro ao cadastrar')
        return
      }
      onIdentified('', data.name ?? newName)
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (loadingSession) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-5 animate-spin text-slate-400" />
      </div>
    )
  }

  if (sessionName) {
    return (
      <div className="space-y-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 -ml-1 py-1 px-1 rounded"
        >
          <ChevronLeft className="size-4" />
          Voltar
        </button>
        <div className="rounded-2xl border bg-white p-5 space-y-4">
          <div>
            <p className="text-sm text-slate-500">Agendando para</p>
            <p className="text-xl font-semibold text-slate-900">{sessionName} 👋</p>
          </div>
          <Button
            className="w-full"
            size="lg"
            style={{ backgroundColor: primaryColor }}
            onClick={() => onIdentified('', sessionName)}
          >
            Continuar
          </Button>
          <button
            className="w-full text-sm text-slate-400 hover:text-slate-600"
            onClick={handleLogout}
          >
            Não sou eu
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 -ml-1 py-1 px-1 rounded"
      >
        <ChevronLeft className="size-4" />
        Voltar
      </button>
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Quem vai ser atendido?</h2>
        <p className="text-sm text-slate-500 mt-1">Identifique-se para continuar.</p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <Tabs defaultValue="login">
        <TabsList className="w-full">
          <TabsTrigger value="login" className="flex-1">Já sou cliente</TabsTrigger>
          <TabsTrigger value="register" className="flex-1">Primeira vez aqui</TabsTrigger>
        </TabsList>

        <TabsContent value="login">
          <form onSubmit={handleLogin} className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <Label htmlFor="id-cpf">CPF</Label>
              <Input
                id="id-cpf"
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(applyCpfMask(e.target.value))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="id-birth">Data de nascimento</Label>
              <Input
                id="id-birth"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : 'Entrar'}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="register">
          <form onSubmit={handleRegister} className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <Label htmlFor="reg-name">Nome completo *</Label>
              <Input id="reg-name" value={newName} onChange={(e) => setNewName(e.target.value)} required minLength={2} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-cpf">CPF *</Label>
              <Input
                id="reg-cpf"
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={newCpf}
                onChange={(e) => setNewCpf(applyCpfMask(e.target.value))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-phone">Telefone/WhatsApp *</Label>
              <Input
                id="reg-phone"
                type="tel"
                inputMode="numeric"
                placeholder="(00) 00000-0000"
                value={newPhone}
                onChange={(e) => setNewPhone(applyPhoneMask(e.target.value))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-email">E-mail *</Label>
              <Input id="reg-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-birth">Data de nascimento *</Label>
              <Input id="reg-birth" type="date" value={newBirthDate} onChange={(e) => setNewBirthDate(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : 'Cadastrar e continuar'}
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 3: Adicionar endpoint de logout**

Criar `src/app/api/public/[slug]/auth/logout/route.ts`:

```typescript
import { COOKIE_NAME } from '@/shared/auth/public-session'

export async function POST() {
  return new Response(null, {
    status: 204,
    headers: {
      'Set-Cookie': `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`,
    },
  })
}
```

- [ ] **Step 4: Integrar identification step no booking-client.tsx**

Adicionar import:
```typescript
import { IdentificationStep } from '@/components/domain/booking/identification-step'
```

Atualizar `ALL_STEPS`:
```typescript
const ALL_STEPS: Exclude<BookingStep, 'success'>[] = [
  'service',
  'professional',
  'datetime',
  'personal',
  'identification',
  'anamnese',
  'confirmation',
]
```

Adicionar `STEP_LABELS`:
```typescript
identification: 'Identificação',
```

Atualizar `handlePersonalData` para ir para `identification` em vez de `anamnese`/`confirmation`:
```typescript
  function handlePersonalData(data: {
    customerName: string
    customerPhone: string
    notes?: string
  }) {
    setBooking((b) => ({ ...b, ...data }))
    setStep('identification')
  }
```

Adicionar handler:
```typescript
  function handleIdentified(_customerId: string, customerName: string) {
    setBooking((b) => ({ ...b, identifiedCustomerName: customerName }))
    const mode = booking.serviceAnamneseMode
    if (mode && mode !== 'NONE') {
      setStep('anamnese')
    } else {
      setStep('confirmation')
    }
  }
```

Adicionar o step no JSX, após `{step === 'personal' && ...}`:
```tsx
      {step === 'identification' && (
        <IdentificationStep
          tenantSlug={tenantData.slug}
          onIdentified={handleIdentified}
          onBack={() => setStep('personal')}
          primaryColor={primaryColor}
        />
      )}
```

- [ ] **Step 5: TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/components/domain/booking/identification-step.tsx src/app/(public)/agendar/ src/app/api/public/[slug]/auth/
git commit -m "feat(booking): passo de identificação do cliente antes da confirmação"
```

---

## Task 12: Layout compartilhado para /{slug}/*

**Files:**
- Create: `src/app/(public)/[slug]/layout.tsx`

**Interfaces:**
- Provides: header público (logo + nome + Instagram + WhatsApp) compartilhado entre vitrine, /entrar, /cliente

- [ ] **Step 1: Criar layout.tsx**

```typescript
// src/app/(public)/[slug]/layout.tsx
import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { Instagram, MessageCircle } from 'lucide-react'

type TenantMeta = {
  name: string
  slug: string
  instagramUrl?: string | null
  phone?: string | null
  whatsappEnabled?: boolean
  branding?: {
    logoUrl?: string | null
    primaryColor?: string | null
    accentColor?: string | null
    backgroundColor?: string | null
    foregroundColor?: string | null
  } | null
}

async function fetchTenantMeta(slug: string): Promise<TenantMeta | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  try {
    const res = await fetch(`${baseUrl}/api/public/${encodeURIComponent(slug)}`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    return res.json() as Promise<TenantMeta>
  } catch {
    return null
  }
}

export default async function SlugLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const tenant = await fetchTenantMeta(slug)
  if (!tenant) notFound()

  const bg = tenant.branding?.backgroundColor ?? '#fafafa'
  const primary = tenant.branding?.primaryColor ?? '#7C3AED'
  const fg = tenant.branding?.foregroundColor ?? '#1a1a1a'
  const whatsappUrl =
    tenant.whatsappEnabled && tenant.phone
      ? `https://wa.me/55${tenant.phone.replace(/\D/g, '')}`
      : null

  return (
    <div style={{ backgroundColor: bg, color: fg, minHeight: '100vh' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40 border-b"
        style={{ backgroundColor: bg, borderColor: tenant.branding?.accentColor ?? '#e5e5e5' }}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          {tenant.branding?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.branding.logoUrl}
              alt={tenant.name}
              className="size-9 rounded-lg object-contain"
            />
          ) : (
            <div
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ backgroundColor: primary }}
            >
              {tenant.name[0]?.toUpperCase()}
            </div>
          )}
          <span className="flex-1 truncate font-semibold text-sm">{tenant.name}</span>
          <div className="flex items-center gap-2">
            {tenant.instagramUrl && (
              <a
                href={tenant.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="flex size-9 items-center justify-center rounded-full hover:bg-black/5 transition-colors"
              >
                <Instagram className="size-4" />
              </a>
            )}
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="flex size-9 items-center justify-center rounded-full hover:bg-black/5 transition-colors"
              >
                <MessageCircle className="size-4" />
              </a>
            )}
          </div>
        </div>
      </header>

      {children}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(public)/[slug]/layout.tsx
git commit -m "feat(vitrine): layout compartilhado com header para /{slug}/*"
```

---

## Task 13: Vitrine pública /{slug}

**Files:**
- Create: `src/app/(public)/[slug]/page.tsx`
- Create: `src/components/domain/vitrine/vitrine-banner.tsx`
- Create: `src/components/domain/vitrine/vitrine-team.tsx`
- Create: `src/components/domain/vitrine/vitrine-tabs.tsx`

**Interfaces:**
- SSR com `next: { revalidate: 300 }`
- Busca paralela: main endpoint + /team + /products
- Não expõe tenantId na resposta
- CTA mobile fixo

- [ ] **Step 1: Criar vitrine-banner.tsx**

```typescript
// src/components/domain/vitrine/vitrine-banner.tsx
type Props = {
  coverImageUrl?: string | null
  primaryColor: string
  accentColor: string
  bio?: string | null
}

export function VitrineBanner({ coverImageUrl, primaryColor, accentColor, bio }: Props) {
  return (
    <>
      <div className="relative h-40 w-full overflow-hidden sm:h-52">
        {coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverImageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})`,
            }}
          />
        )}
      </div>
      {bio && (
        <div className="px-4 py-4 max-w-3xl mx-auto">
          <p className="text-sm leading-relaxed text-muted-foreground">{bio}</p>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 2: Criar vitrine-team.tsx**

```typescript
// src/components/domain/vitrine/vitrine-team.tsx
type TeamMember = {
  id: string
  name: string
  role: string
  avatarUrl?: string | null
  bio?: string | null
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Proprietário',
  MANAGER: 'Gerente',
  PROFESSIONAL: 'Profissional',
  RECEPTIONIST: 'Recepcionista',
}

export function VitrineTeam({ members }: { members: TeamMember[] }) {
  if (members.length === 0) return null

  return (
    <section className="mx-auto max-w-3xl px-4 py-6">
      <h2 className="mb-4 text-lg font-semibold">Nossa equipe</h2>
      <div className="flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:overflow-x-visible">
        {members.map((m) => (
          <div
            key={m.id}
            className="flex min-w-[140px] shrink-0 flex-col items-center gap-2 rounded-2xl border bg-card p-4 text-center sm:min-w-0"
          >
            {m.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={m.avatarUrl}
                alt={m.name}
                className="size-16 rounded-full object-cover"
              />
            ) : (
              <div className="flex size-16 items-center justify-center rounded-full bg-muted text-xl font-semibold">
                {m.name[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm font-medium leading-tight">{m.name}</p>
              <p className="text-xs text-muted-foreground">{ROLE_LABELS[m.role] ?? m.role}</p>
            </div>
            {m.bio && (
              <p className="line-clamp-2 text-xs text-muted-foreground">{m.bio}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Criar vitrine-tabs.tsx**

```typescript
// src/components/domain/vitrine/vitrine-tabs.tsx
'use client'

import { useState } from 'react'

type PublicService = {
  id: string; name: string; duration: number; price: number
  priceType: 'FIXED' | 'STARTING_FROM' | 'RANGE' | 'ON_CONSULTATION'
  priceMin?: number | null; priceMax?: number | null; imageUrl?: string | null; categoryName?: string | null
}
type PublicPackage = {
  id: string; name: string; price: number; imageUrl?: string | null
  services: { name: string }[]
}
type PublicPromotion = {
  id: string; name: string; discountType: 'PERCENTAGE' | 'FIXED'; discountValue: number
  imageUrl?: string | null; endsAt?: string | null
  services: { name: string }[]
}
type PublicProduct = { id: string; name: string; salePrice: number; imageUrl?: string | null; categoryName?: string | null }

type Props = {
  services: PublicService[]
  packages: PublicPackage[]
  promotions: PublicPromotion[]
  products: PublicProduct[]
  bookingBaseUrl: string
  primaryColor: string
}

function formatPrice(s: PublicService): string {
  if (s.priceType === 'ON_CONSULTATION') return 'Sob consulta'
  if (s.priceType === 'RANGE' && s.priceMin != null && s.priceMax != null)
    return `R$ ${s.priceMin.toFixed(2)} – R$ ${s.priceMax.toFixed(2)}`
  if (s.priceType === 'STARTING_FROM') return `A partir de R$ ${s.price.toFixed(2)}`
  return `R$ ${s.price.toFixed(2)}`
}

type Tab = 'services' | 'packages' | 'promotions' | 'products'

export function VitrineTabs({ services, packages, promotions, products, bookingBaseUrl, primaryColor }: Props) {
  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'services', label: 'Serviços', count: services.length },
    { key: 'packages', label: 'Pacotes', count: packages.length },
    { key: 'promotions', label: 'Promoções', count: promotions.length },
    { key: 'products', label: 'Produtos', count: products.length },
  ].filter((t) => t.count > 0)

  const [active, setActive] = useState<Tab>(tabs[0]?.key ?? 'services')

  if (tabs.length === 0) return null

  return (
    <section className="mx-auto max-w-3xl px-4 pb-24">
      {/* Tab list */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className="shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
            style={
              active === t.key
                ? { backgroundColor: primaryColor, color: '#fff' }
                : { backgroundColor: 'transparent', border: '1px solid #d1d5db' }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Services */}
      {active === 'services' && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {services.map((s) => (
            <div key={s.id} className="rounded-2xl border bg-card overflow-hidden flex flex-col">
              <div className="h-28 bg-muted flex items-center justify-center overflow-hidden">
                {s.imageUrl
                  ? <img src={s.imageUrl} alt={s.name} className="h-full w-full object-cover" /> // eslint-disable-line @next/next/no-img-element
                  : <span className="text-3xl">✂️</span>}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <p className="text-sm font-medium leading-tight">{s.name}</p>
                <p className="text-xs text-muted-foreground">{formatPrice(s)} · {s.duration}min</p>
                <a
                  href={`${bookingBaseUrl}?serviceId=${s.id}`}
                  className="mt-auto inline-flex min-h-[44px] items-center justify-center rounded-xl text-sm font-medium text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  Agendar
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Packages */}
      {active === 'packages' && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {packages.map((p) => (
            <div key={p.id} className="rounded-2xl border bg-card overflow-hidden flex flex-col">
              <div className="h-28 bg-muted flex items-center justify-center overflow-hidden">
                {p.imageUrl
                  ? <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" /> // eslint-disable-line @next/next/no-img-element
                  : <span className="text-3xl">📦</span>}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <p className="text-sm font-medium leading-tight">{p.name}</p>
                <p className="text-xs text-muted-foreground">R$ {p.price.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {p.services.map((s) => s.name).join(', ')}
                </p>
                <a
                  href={`${bookingBaseUrl}?packageId=${p.id}`}
                  className="mt-auto inline-flex min-h-[44px] items-center justify-center rounded-xl text-sm font-medium text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  Agendar
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Promotions */}
      {active === 'promotions' && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {promotions.map((promo) => (
            <div key={promo.id} className="rounded-2xl border bg-card overflow-hidden flex flex-col">
              <div className="h-28 bg-muted flex items-center justify-center overflow-hidden">
                {promo.imageUrl
                  ? <img src={promo.imageUrl} alt={promo.name} className="h-full w-full object-cover" /> // eslint-disable-line @next/next/no-img-element
                  : <span className="text-3xl">🎉</span>}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <p className="text-sm font-medium leading-tight">{promo.name}</p>
                <p className="text-xs font-semibold" style={{ color: primaryColor }}>
                  {promo.discountType === 'PERCENTAGE'
                    ? `${promo.discountValue}% OFF`
                    : `R$ ${promo.discountValue.toFixed(2)} OFF`}
                </p>
                {promo.endsAt && (
                  <p className="text-xs text-muted-foreground">
                    Até {new Date(promo.endsAt).toLocaleDateString('pt-BR')}
                  </p>
                )}
                <a
                  href={bookingBaseUrl}
                  className="mt-auto inline-flex min-h-[44px] items-center justify-center rounded-xl text-sm font-medium text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  Agendar
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Products (sem botão de agendar) */}
      {active === 'products' && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {products.map((p) => (
            <div key={p.id} className="rounded-2xl border bg-card overflow-hidden">
              <div className="h-28 bg-muted flex items-center justify-center overflow-hidden">
                {p.imageUrl
                  ? <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" /> // eslint-disable-line @next/next/no-img-element
                  : <span className="text-3xl">🧴</span>}
              </div>
              <div className="p-3">
                <p className="text-sm font-medium leading-tight">{p.name}</p>
                <p className="text-xs text-muted-foreground">R$ {p.salePrice.toFixed(2)}</p>
                {p.categoryName && (
                  <p className="text-xs text-muted-foreground">{p.categoryName}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Criar /{slug}/page.tsx**

```typescript
// src/app/(public)/[slug]/page.tsx
import { notFound } from 'next/navigation'
import { VitrineBanner } from '@/components/domain/vitrine/vitrine-banner'
import { VitrineTeam } from '@/components/domain/vitrine/vitrine-team'
import { VitrineTabs } from '@/components/domain/vitrine/vitrine-tabs'
import Link from 'next/link'

type TenantData = {
  name: string
  slug: string
  phone?: string | null
  whatsappEnabled?: boolean
  bio?: string | null
  instagramUrl?: string | null
  coverImageUrl?: string | null
  branding?: {
    primaryColor?: string | null
    accentColor?: string | null
    backgroundColor?: string | null
    foregroundColor?: string | null
  } | null
  services: object[]
  packages: object[]
  promotions: object[]
  allowPublicBooking: boolean
}

type TeamMember = { id: string; name: string; role: string; avatarUrl?: string | null; bio?: string | null }
type Product = { id: string; name: string; salePrice: number; imageUrl?: string | null; categoryName?: string | null }

async function fetchAll(slug: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const opts = { next: { revalidate: 300 } }
  const [tenantRes, teamRes, productsRes] = await Promise.all([
    fetch(`${base}/api/public/${encodeURIComponent(slug)}`, opts),
    fetch(`${base}/api/public/${encodeURIComponent(slug)}/team`, opts),
    fetch(`${base}/api/public/${encodeURIComponent(slug)}/products`, opts),
  ])
  if (!tenantRes.ok) return null
  const tenant = (await tenantRes.json()) as TenantData
  const team: TeamMember[] = teamRes.ok ? ((await teamRes.json()) as TeamMember[]) : []
  const products: Product[] = productsRes.ok ? ((await productsRes.json()) as Product[]) : []
  return { tenant, team, products }
}

export default async function VitrinePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const data = await fetchAll(slug)
  if (!data) notFound()

  const { tenant, team, products } = data
  const primary = tenant.branding?.primaryColor ?? '#7C3AED'
  const accent = tenant.branding?.accentColor ?? '#c084fc'
  const bookingUrl = `/agendar/${slug}`

  return (
    <>
      <VitrineBanner
        coverImageUrl={tenant.coverImageUrl}
        primaryColor={primary}
        accentColor={accent}
        bio={tenant.bio}
      />

      <VitrineTeam members={team} />

      <VitrineTabs
        services={tenant.services as Parameters<typeof VitrineTabs>[0]['services']}
        packages={tenant.packages as Parameters<typeof VitrineTabs>[0]['packages']}
        promotions={tenant.promotions as Parameters<typeof VitrineTabs>[0]['promotions']}
        products={products}
        bookingBaseUrl={bookingUrl}
        primaryColor={primary}
      />

      {/* CTA fixo mobile */}
      {tenant.allowPublicBooking && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:hidden">
          <Link
            href={bookingUrl}
            className="flex h-14 w-full items-center justify-center rounded-2xl text-base font-semibold text-white shadow-lg"
            style={{ backgroundColor: primary }}
          >
            Agendar agora
          </Link>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 5: TypeScript**

```bash
npx tsc --noEmit
```

Expected: zero erros.

- [ ] **Step 6: Commit**

```bash
git add src/app/(public)/[slug]/page.tsx src/components/domain/vitrine/
git commit -m "feat(vitrine): página pública /{slug} com banner, equipe e tabs de conteúdo"
```

---

## Task 14: Página de login do cliente — /{slug}/entrar

**Files:**
- Create: `src/app/(public)/[slug]/entrar/page.tsx`

- [ ] **Step 1: Criar entrar/page.tsx**

```typescript
// src/app/(public)/[slug]/entrar/page.tsx
'use client'

import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function applyCpfMask(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

export default function EntrarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const router = useRouter()
  const [cpf, setCpf] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/public/${slug}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: cpf.replace(/\D/g, ''), birthDate }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: { message: string } }
        if (res.status === 429) {
          setError('Muitas tentativas. Aguarde 15 minutos.')
        } else {
          setError(data.error?.message ?? 'Dados não encontrados')
        }
        return
      }
      router.replace(`/${slug}/cliente`)
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-10">
      <div className="space-y-1 mb-8 text-center">
        <h1 className="text-2xl font-semibold">Acesse sua conta</h1>
        <p className="text-sm text-muted-foreground">
          Consulte seu histórico e próximos agendamentos
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="login-cpf">CPF</Label>
          <Input
            id="login-cpf"
            inputMode="numeric"
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(e) => setCpf(applyCpfMask(e.target.value))}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="login-birth">Data de nascimento</Label>
          <Input
            id="login-birth"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full min-h-[48px]" disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : 'Entrar'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Primeira vez?{' '}
        <a href={`/agendar/${slug}`} className="font-medium underline">
          Faça seu primeiro agendamento
        </a>
      </p>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(public)/[slug]/entrar/
git commit -m "feat(vitrine): página de login do cliente /{slug}/entrar"
```

---

## Task 15: Portal do cliente — /{slug}/cliente

**Files:**
- Create: `src/app/(public)/[slug]/cliente/page.tsx`

**Interfaces:**
- Consumes: `GET /api/public/[slug]/me` (com cookie)
- Server component com redirect para /entrar se não autenticado

- [ ] **Step 1: Criar cliente/page.tsx**

```typescript
// src/app/(public)/[slug]/cliente/page.tsx
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { verifyPublicSession, COOKIE_NAME } from '@/shared/auth/public-session'
import { prisma } from '@/shared/database/prisma'
import { publicBookingRepository } from '@/domains/scheduling/public-booking.repository'
import { CustomerHistoryClient } from './customer-history-client'

export default async function ClientePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value ?? null
  const session = token ? verifyPublicSession(token) : null

  if (!session) {
    redirect(`/${slug}/entrar`)
  }

  let tenant: Awaited<ReturnType<typeof publicBookingRepository.findTenantBySlug>>
  try {
    tenant = await publicBookingRepository.findTenantBySlug(slug)
  } catch {
    redirect(`/${slug}/entrar`)
  }

  if (session.tenantId !== tenant.id) {
    redirect(`/${slug}/entrar`)
  }

  const customer = await prisma.customer.findFirst({
    where: { id: session.customerId, tenantId: tenant.id },
    select: {
      id: true,
      name: true,
      cpf: true,
      phone: true,
      email: true,
      birthDate: true,
      appointments: {
        where: { tenantId: tenant.id },
        orderBy: { startsAt: 'desc' },
        take: 20,
        select: {
          id: true,
          startsAt: true,
          status: true,
          price: true,
          service: { select: { name: true } },
          package: { select: { name: true } },
          professional: { select: { name: true } },
        },
      },
    },
  })

  if (!customer) {
    redirect(`/${slug}/entrar`)
  }

  const now = new Date()
  const upcoming = customer.appointments.filter(
    (a) => new Date(a.startsAt) >= now && (a.status === 'SCHEDULED' || a.status === 'CONFIRMED'),
  )
  const history = customer.appointments.filter(
    (a) => new Date(a.startsAt) < now || (a.status !== 'SCHEDULED' && a.status !== 'CONFIRMED'),
  )

  const whatsappUrl =
    tenant.whatsappEnabled && tenant.phone
      ? `https://wa.me/55${tenant.phone.replace(/\D/g, '')}`
      : null
  const primary = tenant.brandingConfig?.primaryColor ?? '#7C3AED'

  return (
    <CustomerHistoryClient
      customer={{
        id: customer.id,
        name: customer.name,
        cpf: customer.cpf,
        phone: customer.phone,
        email: customer.email,
        birthDate: customer.birthDate?.toISOString() ?? null,
      }}
      upcoming={upcoming.map((a) => ({
        id: a.id,
        startsAt: a.startsAt.toISOString(),
        status: a.status,
        price: Number(a.price),
        serviceName: a.service?.name ?? a.package?.name ?? '—',
        professionalName: a.professional.name,
      }))}
      history={history.map((a) => ({
        id: a.id,
        startsAt: a.startsAt.toISOString(),
        status: a.status,
        price: Number(a.price),
        serviceName: a.service?.name ?? a.package?.name ?? '—',
        professionalName: a.professional.name,
      }))}
      slug={slug}
      whatsappUrl={whatsappUrl}
      primaryColor={primary}
    />
  )
}
```

- [ ] **Step 2: Criar customer-history-client.tsx (client component)**

```typescript
// src/app/(public)/[slug]/cliente/customer-history-client.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MessageCircle, LogOut, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

type AppointmentRow = {
  id: string; startsAt: string; status: string
  price: number; serviceName: string; professionalName: string
}

type Customer = {
  id: string; name: string; cpf: string | null
  phone: string | null; email: string | null; birthDate: string | null
}

type Props = {
  customer: Customer
  upcoming: AppointmentRow[]
  history: AppointmentRow[]
  slug: string
  whatsappUrl: string | null
  primaryColor: string
}

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  SCHEDULED: { label: 'Agendado', variant: 'default' },
  CONFIRMED: { label: 'Confirmado', variant: 'default' },
  COMPLETED: { label: 'Concluído', variant: 'secondary' },
  CANCELLED: { label: 'Cancelado', variant: 'destructive' },
  NO_SHOW: { label: 'Não compareceu', variant: 'outline' },
}

const PAGE_SIZE = 10

export function CustomerHistoryClient({
  customer, upcoming, history, slug, whatsappUrl, primaryColor,
}: Props) {
  const router = useRouter()
  const [phone, setPhone] = useState(customer.phone ?? '')
  const [email, setEmail] = useState(customer.email ?? '')
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(0)

  const maskCpf = customer.cpf
    ? `***.***.${customer.cpf.slice(-5, -2)}-${customer.cpf.slice(-2)}`
    : '—'

  const visibleHistory = history.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(history.length / PAGE_SIZE)

  async function handleLogout() {
    await fetch(`/api/public/${slug}/auth/logout`, { method: 'POST' }).catch(() => {})
    router.replace(`/${slug}/entrar`)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/public/${slug}/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone || undefined,
          email: email || undefined,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Dados atualizados')
    } catch {
      toast.error('Falha ao atualizar dados')
    } finally {
      setSaving(false)
    }
  }

  const firstUpcoming = upcoming[0]

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-6 space-y-6">
      {/* Saudação */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Olá, {customer.name} 👋</h1>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <LogOut className="size-4" />
          Sair
        </button>
      </div>

      <Link
        href={`/agendar/${slug}`}
        className="flex h-12 w-full items-center justify-center rounded-2xl text-sm font-semibold text-white"
        style={{ backgroundColor: primaryColor }}
      >
        Novo agendamento
      </Link>

      {/* Próximo agendamento */}
      {firstUpcoming && (
        <div className="rounded-2xl border bg-card p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Próximo agendamento</p>
          <p className="font-medium">{firstUpcoming.serviceName}</p>
          <p className="text-sm text-muted-foreground">
            {new Date(firstUpcoming.startsAt).toLocaleString('pt-BR', {
              weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
            })}
          </p>
          <p className="text-sm text-muted-foreground">{firstUpcoming.professionalName}</p>
          {whatsappUrl && (
            <a
              href={`${whatsappUrl}?text=Olá! Gostaria de falar sobre meu agendamento.`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-green-600 hover:underline"
            >
              <MessageCircle className="size-4" />
              Falar pelo WhatsApp
            </a>
          )}
        </div>
      )}

      {/* Histórico */}
      {history.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Histórico</p>
          {visibleHistory.map((a) => {
            const s = STATUS_LABELS[a.status] ?? { label: a.status, variant: 'outline' as const }
            return (
              <div key={a.id} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
                <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.serviceName}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(a.startsAt).toLocaleDateString('pt-BR')} · {a.professionalName}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge variant={s.variant} className="text-xs">{s.label}</Badge>
                  <span className="text-xs text-muted-foreground">R$ {a.price.toFixed(2)}</span>
                </div>
              </div>
            )
          })}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                Próxima
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Meus dados */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Meus dados</p>
        <div className="rounded-xl border bg-card px-4 py-3 space-y-1">
          <p className="text-sm"><span className="text-muted-foreground">Nome:</span> {customer.name}</p>
          <p className="text-sm"><span className="text-muted-foreground">CPF:</span> {maskCpf}</p>
          {customer.birthDate && (
            <p className="text-sm">
              <span className="text-muted-foreground">Nascimento:</span>{' '}
              {new Date(customer.birthDate).toLocaleDateString('pt-BR')}
            </p>
          )}
        </div>
        <form onSubmit={handleSave} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-phone">Telefone</Label>
            <Input id="edit-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-email">E-mail</Label>
            <Input id="edit-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button type="submit" variant="outline" size="sm" disabled={saving}>
            {saving ? 'Salvando...' : 'Atualizar dados'}
          </Button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: TypeScript**

```bash
npx tsc --noEmit
```

Expected: zero erros.

- [ ] **Step 4: Commit**

```bash
git add src/app/(public)/[slug]/cliente/
git commit -m "feat(vitrine): portal do cliente /{slug}/cliente com histórico e edição de dados"
```

---

## Task 16: Verificação final e PR

- [ ] **Step 1: Build completo**

```bash
npx tsc --noEmit
npx vitest run
```

Expected: zero erros TypeScript, todos os testes passando.

- [ ] **Step 2: Teste manual da vitrine**

1. Acessar `/{slug}` — verificar que renderiza com branding, banner, equipe, tabs
2. Clicar "Agendar" em um serviço → verifica que vai para `/agendar/{slug}?serviceId=xxx`
3. Confirmar que serviço é pré-selecionado

- [ ] **Step 3: Teste manual do booking flow**

1. Avançar até o passo "Seus dados"
2. Confirmar que aparece o novo passo "Identificação"
3. Testar "Já sou cliente" com CPF + data (sem registro → erro genérico)
4. Testar "Primeira vez aqui" → completa cadastro → avança para confirmação

- [ ] **Step 4: Teste manual do portal**

1. Acessar `/{slug}/entrar` → fazer login com CPF + data
2. Verificar redirect para `/{slug}/cliente`
3. Verificar histórico e dados exibidos

- [ ] **Step 5: Teste das configurações**

1. Acessar `/configuracoes` → verificar nova seção "Página pública"
2. Preencher bio + instagram → salvar → verificar na vitrine
3. Upload de foto de capa → verificar na vitrine
4. Toggle showOnPublicPage → verificar na seção "Nossa equipe"

- [ ] **Step 6: Abrir PR**

```bash
gh pr create --title "feat: vitrine pública + portal do cliente final" --body "$(cat <<'EOF'
## Resumo

- Vitrine pública em `/{slug}` com branding, banner, bio, equipe e tabs de conteúdo
- Portal do cliente em `/{slug}/cliente` com histórico de agendamentos
- Login do cliente em `/{slug}/entrar` via CPF + data de nascimento
- Novo passo de identificação no fluxo de agendamento
- Pré-seleção de serviço/pacote via `?serviceId` e `?packageId`
- Admin: seção "Página pública" em Configurações (bio, instagram, foto de capa, visibilidade da equipe)
- Campo bio no modal de edição de membros

## Plano de testes

- [ ] `npx tsc --noEmit` — zero erros
- [ ] `npx vitest run` — todos passando
- [ ] Vitrine renderiza com branding do tenant
- [ ] Botão "Agendar" pré-seleciona item no booking
- [ ] Passo de identificação aparece antes da confirmação
- [ ] Portal do cliente mostra histórico e redireciona se sem sessão
- [ ] Login via CPF + data funciona; 5 tentativas bloqueiam por 15min
- [ ] Settings salva bio, instagram, coverImage
- [ ] Toggle showOnPublicPage reflete na vitrine

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Notas de implementação

**Slugs reservados** — Documentar que slugs iguais a rotas existentes não funcionarão: `agenda`, `clientes`, `configuracoes`, `financeiro`, `equipe`, `servicos`, `produtos`, `relatorios`, `onboarding`, `login`, `admin`, `api`, `anamnese`, `agendar`, `planos`.

**Variável de ambiente** — Adicionar `PUBLIC_SESSION_SECRET` ao `.env.local` e ao Vercel antes de ir para produção.

**Supabase Storage** — O bucket `cover-images` é criado automaticamente no primeiro upload. Verificar se as políticas de storage permitem acesso público às imagens.
