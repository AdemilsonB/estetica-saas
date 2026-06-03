# Layout Redesign — Visual Polish + Responsividade — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevar o visual do produto para estilo warm profissional e corrigir todos os problemas críticos de responsividade mobile em uma entrega coesa.

**Architecture:** Migration aditiva no `BrandingConfig` adiciona 3 tokens de cor e torna `secondaryColor` nullable. O `buildCssVariables` passa a emitir `--border`, `--foreground` e `--muted-foreground` explicitamente. O `AppShell` recebe `logoUrl` e `businessName` via props do layout RSC e é completamente redesenhado com sidebar colapsável (desktop) e drawer Sheet (mobile).

**Tech Stack:** Next.js 15 App Router, Prisma, Shadcn UI (Sheet, Tooltip, Select), Tailwind CSS v4, Zustand/localStorage para estado da sidebar, TanStack Query.

---

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` | Modificar — BrandingConfig: 3 novos campos, secondaryColor nullable, novos defaults |
| `src/lib/branding/build-css-variables.ts` | Modificar — BrandingInput + emitir --border/--foreground/--muted-foreground |
| `src/domains/iam/branding.schemas.ts` | Modificar — UpdateBrandingSchema: adicionar borderColor, foregroundColor, mutedColor, accentColor; remover secondaryColor |
| `src/domains/iam/branding.service.ts` | Modificar — BRANDING_DEFAULTS com warm defaults + novos campos |
| `src/domains/iam/branding.repository.ts` | Sem mudanças — upsert dinâmico já funciona |
| `src/app/api/iam/branding/route.ts` | Modificar — remover derivação automática de secondary/accent |
| `src/domains/iam/iam.service.ts` | Modificar — getCurrentUser inclui tenant.name |
| `src/hooks/use-current-user.ts` | Modificar — tipo CurrentUser adiciona businessName |
| `src/app/(app)/layout.tsx` | Modificar — passa logoUrl e businessName para AppShell |
| `src/app/globals.css` | Modificar — defaults warm em :root |
| `src/components/app/app-shell.tsx` | Modificar — redesign completo |
| `src/components/domain/settings/branding-form.tsx` | Modificar — 6 pickers + botão restaurar warm |
| `src/app/(app)/configuracoes/page.tsx` | Modificar — tipo BrandingConfig + tabs overflow scroll |
| `src/components/domain/reports/reports-sidebar.tsx` | Modificar — Select no mobile, links no desktop |
| `src/app/(app)/relatorios/layout.tsx` | Modificar — layout responsivo flex-col/row |
| `src/app/(app)/relatorios/agendamentos/page.tsx` | Modificar — SelectTrigger widths |
| `src/app/(app)/relatorios/profissionais/page.tsx` | Modificar — SelectTrigger widths |
| `src/app/(app)/relatorios/financeiro/page.tsx` | Modificar — SelectTrigger widths |
| `src/app/(app)/relatorios/clientes/page.tsx` | Modificar — SelectTrigger widths |
| `src/components/domain/dashboard/dashboard-metrics.tsx` | Modificar — grid classes |
| `src/app/(auth)/login/login-client.tsx` | Modificar — tokens Tailwind + breakpoint do painel |
| `src/components/domain/reports/report-table.tsx` | Modificar — wrapper com mask-image |
| `src/components/domain/billing/billing-plans-content.tsx` | Modificar — wrapper com mask-image |
| `src/components/domain/settings/commissions-grid.tsx` | Modificar — wrapper com mask-image |
| `src/lib/branding/build-css-variables.test.ts` | Modificar — adaptar para nova assinatura |
| `src/domains/iam/branding.service.test.ts` | Modificar — defaults warm |
| `src/domains/iam/branding.repository.test.ts` | Modificar — fixtures sem secondaryColor obrigatório |

---

## Task 1: Database — Migration BrandingConfig

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Atualizar schema.prisma**

Localizar o model `BrandingConfig` e substituir pelo novo:

```prisma
model BrandingConfig {
  id              String   @id @default(cuid())
  tenantId        String   @unique
  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  logoUrl         String?
  primaryColor    String   @default("#c8916a")
  secondaryColor  String?
  accentColor     String   @default("#fdf0e8")
  backgroundColor String   @default("#faf7f4")
  borderColor     String   @default("#e8ddd3")
  foregroundColor String   @default("#3d2b1f")
  mutedColor      String   @default("#8a7060")
  fontFamily      String   @default("inter")
  borderRadius    String   @default("medium")
  colorScheme     String   @default("light")

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId])
}
```

- [ ] **Step 2: Gerar e aplicar migration**

```bash
npx prisma migrate dev --name add-branding-tokens-warm
```

Saída esperada: `✔ Generated Prisma Client`

- [ ] **Step 3: Verificar Prisma Client gerado**

```bash
npx tsc --noEmit
```

Esperado: sem erros de tipo (o Prisma Client novo já estará nos tipos gerados).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(database): adiciona tokens warm ao BrandingConfig e torna secondaryColor nullable"
```

---

## Task 2: Backend — buildCssVariables.ts

**Files:**
- Modify: `src/lib/branding/build-css-variables.ts`
- Modify: `src/lib/branding/build-css-variables.test.ts`

- [ ] **Step 1: Atualizar tipo BrandingInput e função buildCssVariables**

Substituir o conteúdo de `src/lib/branding/build-css-variables.ts` a partir da linha 1, atualizando o tipo e a função principal:

```typescript
export type BrandingInput = {
  primaryColor: string
  accentColor: string
  backgroundColor: string
  borderColor: string
  foregroundColor: string
  mutedColor: string
  fontFamily: 'inter' | 'manrope' | 'geist' | 'dm-sans' | 'plus-jakarta-sans' | 'lato'
  borderRadius: 'none' | 'medium' | 'full'
  colorScheme: 'light' | 'dark'
  logoUrl: string | null
  secondaryColor?: string
}
```

Em seguida, atualizar a função `buildCssVariables` para emitir os novos tokens e remover `--secondary`:

```typescript
export function buildCssVariables(config: BrandingInput): CssVariablesResult {
  const isDark = config.colorScheme === 'dark'
  const radius = BORDER_RADIUS_MAP[config.borderRadius] ?? BORDER_RADIUS_MAP['medium']
  const fontVar = FONT_VARIABLE_MAP[config.fontFamily] ?? FONT_VARIABLE_MAP['inter']

  const primary = oklchStr(config.primaryColor)
  const primaryFg = calcForeground(config.primaryColor)
  const accent = toOklch(config.accentColor)
  const accentFg = calcForeground(config.accentColor)
  const bg = oklchStr(config.backgroundColor)
  const border = oklchStr(config.borderColor)
  const fg = oklchStr(config.foregroundColor)
  const muted = oklchStr(config.mutedColor)

  const styleTag = [
    `--primary: ${primary};`,
    `--primary-foreground: ${primaryFg};`,
    `--accent: ${accent};`,
    `--accent-foreground: ${accentFg};`,
    `--background: ${bg};`,
    `--foreground: ${fg};`,
    `--border: ${border};`,
    `--muted-foreground: ${muted};`,
    `--sidebar: ${bg};`,
    `--sidebar-foreground: ${fg};`,
    `--sidebar-primary: ${primary};`,
    `--sidebar-primary-foreground: ${primaryFg};`,
    `--sidebar-accent: ${accent};`,
    `--sidebar-accent-foreground: ${primary};`,
    `--ring: ${primary};`,
    `--radius: ${radius};`,
    `--font-sans: ${fontVar};`,
  ].join('\n    ')

  return { styleTag, isDark }
}
```

- [ ] **Step 2: Atualizar testes de buildCssVariables**

Em `src/lib/branding/build-css-variables.test.ts`, substituir todos os chamadas de `buildCssVariables` com a nova assinatura (sem `secondaryColor` obrigatório, com `borderColor`, `foregroundColor`, `mutedColor`):

```typescript
const warmInput = {
  primaryColor: '#c8916a',
  accentColor: '#fdf0e8',
  backgroundColor: '#faf7f4',
  borderColor: '#e8ddd3',
  foregroundColor: '#3d2b1f',
  mutedColor: '#8a7060',
  fontFamily: 'inter' as const,
  borderRadius: 'medium' as const,
  colorScheme: 'light' as const,
  logoUrl: null,
}
```

Substituir o describe `buildCssVariables`:

```typescript
describe('buildCssVariables', () => {
  it('gera string CSS com variáveis oklch válidas', () => {
    const result = buildCssVariables(warmInput)
    expect(result.styleTag).toContain('--primary:')
    expect(result.styleTag).toContain('--background:')
    expect(result.styleTag).toContain('--border:')
    expect(result.styleTag).toContain('--foreground:')
    expect(result.styleTag).toContain('--muted-foreground:')
    expect(result.styleTag).toContain('--radius:')
    expect(result.styleTag).toContain('--font-sans:')
    expect(result.styleTag).toContain('oklch(')
  })

  it('isDark é true quando colorScheme é dark', () => {
    const result = buildCssVariables({ ...warmInput, colorScheme: 'dark' })
    expect(result.isDark).toBe(true)
  })

  it('isDark é false quando colorScheme é light', () => {
    const result = buildCssVariables(warmInput)
    expect(result.isDark).toBe(false)
  })
})
```

Remover ou atualizar os describes `deriveSecondary`, `deriveAccent` (manter as funções exportadas mas remover testes dependentes do `secondaryColor` obrigatório no `buildCssVariables`). Substituir o describe `buildCssVariables com secondary derivado`:

```typescript
describe('buildCssVariables — sidebar-accent e ring emitidos', () => {
  it('styleTag contém --sidebar-accent e --ring', () => {
    const result = buildCssVariables(warmInput)
    expect(result.styleTag).toContain('--sidebar-accent:')
    expect(result.styleTag).toContain('--ring:')
  })
})
```

- [ ] **Step 3: Rodar testes de branding para verificar**

```bash
npx vitest run src/lib/branding/build-css-variables.test.ts
```

Esperado: todos passando.

- [ ] **Step 4: Commit**

```bash
git add src/lib/branding/
git commit -m "feat(branding): buildCssVariables emite --border/--foreground/--muted-foreground explicitamente"
```

---

## Task 3: Backend — Schemas, Service, API Route

**Files:**
- Modify: `src/domains/iam/branding.schemas.ts`
- Modify: `src/domains/iam/branding.service.ts`
- Modify: `src/app/api/iam/branding/route.ts`

- [ ] **Step 1: Atualizar branding.schemas.ts**

Substituir o conteúdo completo do arquivo:

```typescript
import { z } from 'zod'

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Cor deve ser um hex válido (#rrggbb)')

export const UpdateBrandingSchema = z.object({
  logoUrl: z.string().url().nullable().optional(),
  primaryColor: hexColor.optional(),
  accentColor: hexColor.optional(),
  backgroundColor: hexColor.optional(),
  borderColor: hexColor.optional(),
  foregroundColor: hexColor.optional(),
  mutedColor: hexColor.optional(),
  fontFamily: z
    .enum(['inter', 'manrope', 'geist', 'dm-sans', 'plus-jakarta-sans', 'lato'])
    .optional(),
  borderRadius: z.enum(['none', 'medium', 'full']).optional(),
  colorScheme: z.enum(['light', 'dark']).optional(),
})

export type UpdateBrandingInput = z.infer<typeof UpdateBrandingSchema>

export type BrandingUpdateData = UpdateBrandingInput

export const OnboardingBrandingSchema = z.object({
  logoUrl: z.string().url().nullable().optional(),
  primaryColor: hexColor.optional(),
  backgroundColor: hexColor.optional(),
})

export type OnboardingBrandingInput = z.infer<typeof OnboardingBrandingSchema>
```

- [ ] **Step 2: Atualizar BRANDING_DEFAULTS no branding.service.ts**

Localizar `const BRANDING_DEFAULTS` e substituir:

```typescript
const BRANDING_DEFAULTS = {
  logoUrl: null,
  primaryColor: '#c8916a',
  accentColor: '#fdf0e8',
  backgroundColor: '#faf7f4',
  borderColor: '#e8ddd3',
  foregroundColor: '#3d2b1f',
  mutedColor: '#8a7060',
  fontFamily: 'inter',
  borderRadius: 'medium',
  colorScheme: 'light',
}
```

Também remover o import de `BrandingUpdateData` se ele vier diretamente (o tipo agora é o mesmo que `UpdateBrandingInput`). Verificar que `branding.service.ts` ainda compila.

- [ ] **Step 3: Atualizar API route — remover derivação automática**

Em `src/app/api/iam/branding/route.ts`, remover o import de `deriveSecondary` e `deriveAccent` e simplificar o PUT:

```typescript
import { revalidateTag } from 'next/cache'
import { brandingService } from '@/domains/iam/branding.service'
import { UpdateBrandingSchema } from '@/domains/iam/branding.schemas'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'

export async function GET(req: Request) {
  try {
    const session = await getSessionContext(req)
    const config = await brandingService.get(session.tenantId)
    return Response.json(config)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getSessionContext(req)
    const input = await validateInput(req, UpdateBrandingSchema)
    const updated = await brandingService.update(session.tenantId, input)
    revalidateTag(`branding-${session.tenantId}`)
    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 4: Atualizar testes do service**

Em `src/domains/iam/branding.service.test.ts`, atualizar `defaultBranding` (remover `secondaryColor` obrigatório) e o teste de defaults:

```typescript
const defaultBranding = {
  id: 'branding-1',
  tenantId: TENANT_ID,
  logoUrl: null,
  primaryColor: '#c8916a',
  secondaryColor: null,
  accentColor: '#fdf0e8',
  backgroundColor: '#faf7f4',
  borderColor: '#e8ddd3',
  foregroundColor: '#3d2b1f',
  mutedColor: '#8a7060',
  fontFamily: 'inter',
  borderRadius: 'medium',
  colorScheme: 'light',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}
```

Atualizar o teste de defaults:

```typescript
it('retorna defaults quando não encontrado — primaryColor é #c8916a', async () => {
  vi.mocked(repo.findByTenant).mockResolvedValue(null)
  const result = await service.get(TENANT_ID)
  expect(result.primaryColor).toBe('#c8916a')
  expect(result.tenantId).toBe(TENANT_ID)
})
```

Em `src/domains/iam/branding.repository.test.ts`, atualizar `defaultBranding`:

```typescript
const defaultBranding = {
  id: 'branding-1',
  tenantId: TENANT_ID,
  logoUrl: null,
  primaryColor: '#c8916a',
  secondaryColor: null,
  accentColor: '#fdf0e8',
  backgroundColor: '#faf7f4',
  borderColor: '#e8ddd3',
  foregroundColor: '#3d2b1f',
  mutedColor: '#8a7060',
  fontFamily: 'inter',
  borderRadius: 'medium',
  colorScheme: 'light',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}
```

- [ ] **Step 5: Rodar testes de branding**

```bash
npx vitest run src/domains/iam/branding.service.test.ts src/domains/iam/branding.repository.test.ts
```

Esperado: todos passando.

- [ ] **Step 6: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 7: Commit**

```bash
git add src/domains/iam/branding.schemas.ts src/domains/iam/branding.service.ts src/domains/iam/branding.service.test.ts src/domains/iam/branding.repository.test.ts src/app/api/iam/branding/route.ts
git commit -m "feat(branding): adiciona tokens warm ao schema e remove derivação automática de secondary"
```

---

## Task 4: Backend — IAM service getCurrentUser + CurrentUser type

**Files:**
- Modify: `src/domains/iam/iam.service.ts`
- Modify: `src/hooks/use-current-user.ts`

- [ ] **Step 1: Atualizar getCurrentUser em iam.service.ts**

Localizar o método `getCurrentUser` e substituir o select:

```typescript
async getCurrentUser(session: SessionContext) {
  const user = await prisma.user.findFirst({
    where: {
      id: session.userId,
      tenantId: session.tenantId,
    },
    select: {
      id: true,
      tenantId: true,
      email: true,
      name: true,
      role: true,
      permissions: true,
      tenant: { select: { name: true } },
    },
  })

  if (!user) {
    throw new NotFoundError('Usuario')
  }

  return {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    name: user.name,
    role: user.role,
    permissions: user.permissions,
    businessName: user.tenant.name,
  }
}
```

- [ ] **Step 2: Atualizar tipo CurrentUser em use-current-user.ts**

Substituir o conteúdo completo:

```typescript
import { useQuery } from '@tanstack/react-query'
import type { UserRole } from '@prisma/client'

export type CurrentUser = {
  id: string
  tenantId: string
  email: string
  name: string
  role: UserRole
  permissions: string[]
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

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 4: Commit**

```bash
git add src/domains/iam/iam.service.ts src/hooks/use-current-user.ts
git commit -m "feat(iam): getCurrentUser inclui businessName do tenant"
```

---

## Task 5: Backend — App Layout (passa props para AppShell)

**Files:**
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Atualizar AppLayout para buscar businessName e passar props**

Substituir o conteúdo completo de `src/app/(app)/layout.tsx`:

```typescript
import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { unstable_cache } from 'next/cache'
import { AppShell } from '@/components/app/app-shell'
import { brandingRepository } from '@/domains/iam/branding.repository'
import { buildCssVariables } from '@/lib/branding/build-css-variables'
import { iamRepository } from '@/domains/iam/iam.repository'
import { env } from '@/shared/config/env'

async function getTenantIdFromSession(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    })
    const { data: { user } } = await supabase.auth.getUser()
    return user?.app_metadata?.tenantId ?? null
  } catch {
    return null
  }
}

async function getBrandingCached(tenantId: string) {
  const cached = unstable_cache(
    () => brandingRepository.findByTenant(tenantId),
    [`branding-${tenantId}`],
    { tags: [`branding-${tenantId}`], revalidate: 3600 },
  )
  return cached()
}

async function getTenantCached(tenantId: string) {
  const cached = unstable_cache(
    () => iamRepository.findTenant(tenantId),
    [`tenant-${tenantId}`],
    { tags: [`tenant-${tenantId}`], revalidate: 3600 },
  )
  return cached()
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const tenantId = await getTenantIdFromSession()

  let brandingCss = ''
  let logoUrl: string | null = null
  let businessName = ''

  if (tenantId) {
    const [config, tenant] = await Promise.all([
      getBrandingCached(tenantId),
      getTenantCached(tenantId),
    ])

    logoUrl = config?.logoUrl ?? null
    businessName = tenant?.name ?? ''

    if (config) {
      const { styleTag } = buildCssVariables({
        primaryColor: config.primaryColor,
        accentColor: config.accentColor,
        backgroundColor: config.backgroundColor,
        borderColor: config.borderColor ?? '#e8ddd3',
        foregroundColor: config.foregroundColor ?? '#3d2b1f',
        mutedColor: config.mutedColor ?? '#8a7060',
        fontFamily: config.fontFamily as 'inter' | 'manrope' | 'geist' | 'dm-sans' | 'plus-jakarta-sans' | 'lato',
        borderRadius: config.borderRadius as 'none' | 'medium' | 'full',
        colorScheme: config.colorScheme as 'light' | 'dark',
        logoUrl: config.logoUrl,
      })
      brandingCss = styleTag
    }
  }

  return (
    <>
      {brandingCss && (
        <style dangerouslySetInnerHTML={{ __html: `:root { ${brandingCss} }` }} />
      )}
      <AppShell logoUrl={logoUrl} businessName={businessName}>
        {children}
      </AppShell>
    </>
  )
}
```

> **Nota:** `iamRepository.findTenant` já existe em `src/domains/iam/iam.repository.ts` — verificar o nome exato do método antes de usar. Se for `findTenant(tenantId)`, usar diretamente. Se tiver outro nome, adaptar.

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: pode haver erro no AppShell pois ainda não foi atualizado. Ignorar erro de props do AppShell neste passo (será resolvido na Task 7). Outros erros devem ser zero.

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/layout.tsx
git commit -m "feat(layout): passa logoUrl e businessName para AppShell"
```

---

## Task 6: Frontend — globals.css warm defaults

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Atualizar valores do :root para paleta warm**

Localizar o bloco `:root { ... }` e substituir as variáveis de cor pelos novos defaults warm (mantendo as variáveis que não mudam):

```css
:root {
  --background: #faf7f4;
  --foreground: #3d2b1f;
  --card: #faf7f4;
  --card-foreground: #3d2b1f;
  --popover: #faf7f4;
  --popover-foreground: #3d2b1f;
  --primary: #c8916a;
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: #3d2b1f;
  --muted: oklch(0.97 0 0);
  --muted-foreground: #8a7060;
  --accent: #fdf0e8;
  --accent-foreground: #3d2b1f;
  --destructive: oklch(0.577 0.245 27.325);
  --border: #e8ddd3;
  --input: #e8ddd3;
  --ring: #c8916a;
  --chart-1: #c8916a;
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --radius: 0.625rem;
  --sidebar: #faf7f4;
  --sidebar-foreground: #3d2b1f;
  --sidebar-primary: #c8916a;
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: #fdf0e8;
  --sidebar-accent-foreground: #c8916a;
  --sidebar-border: #e8ddd3;
  --sidebar-ring: #c8916a;
}
```

Manter o bloco `.dark { ... }` sem alterações (dark mode preservado).

- [ ] **Step 2: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(ui): defaults warm para paleta de cores do produto"
```

---

## Task 7: Frontend — AppShell Redesign Completo

**Files:**
- Modify: `src/components/app/app-shell.tsx`

Este é o maior task. O AppShell recebe `logoUrl` e `businessName` via props RSC, tem sidebar colapsável no desktop e drawer Sheet no mobile.

- [ ] **Step 1: Verificar disponibilidade do Sheet e Tooltip do Shadcn**

```bash
ls src/components/ui/sheet.tsx src/components/ui/tooltip.tsx
```

Se algum não existir, instalar via shadcn:
```bash
npx shadcn@latest add sheet
npx shadcn@latest add tooltip
```

- [ ] **Step 2: Substituir conteúdo completo de app-shell.tsx**

```typescript
'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import {
  BarChart2,
  CalendarDays,
  CreditCard,
  LogOut,
  Menu,
  Settings,
  Users,
  UserCog,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { usePermissions } from '@/hooks/use-permissions'
import { createSupabaseBrowserClient } from '@/integrations/supabase/client'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  {
    label: 'Agenda',
    description: 'Atendimentos e encaixes',
    icon: CalendarDays,
    href: '/agenda',
    permission: 'appointments:view',
  },
  {
    label: 'Clientes',
    description: 'CRM e recorrência',
    icon: Users,
    href: '/clientes',
    permission: 'customers:view',
  },
  {
    label: 'Financeiro',
    description: 'Receitas e caixa',
    icon: CreditCard,
    href: '/financeiro',
    permission: 'financial:view',
  },
  {
    label: 'Relatórios',
    description: 'Análises e exportações',
    icon: BarChart2,
    href: '/relatorios',
    permission: 'financial:view',
  },
  {
    label: 'Equipe',
    description: 'Usuários e permissões',
    icon: UserCog,
    href: '/equipe',
    permission: 'users:view',
  },
  {
    label: 'Config.',
    description: 'Configurações',
    icon: Settings,
    href: '/configuracoes',
    permission: null,
  },
] as const

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('')
}

interface AppShellProps {
  children: ReactNode
  logoUrl: string | null
  businessName: string
}

export function AppShell({ children, logoUrl, businessName }: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { can, user, isLoading } = usePermissions()
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('sidebar-collapsed') === 'true'
  })
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar-collapsed', String(next))
  }

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const visibleItems = NAV_ITEMS.filter(
    (item) => item.permission === null || can(item.permission),
  )

  const mainItems = visibleItems.slice(0, -1)
  const configItem = visibleItems.at(-1)

  function LogoBrand({ size = 'normal' }: { size?: 'normal' | 'small' }) {
    const isSmall = size === 'small'
    return (
      <Link href="/dashboard" title="Ir para Dashboard" className="flex items-center gap-3 min-w-0">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={businessName}
            className={cn('shrink-0 object-contain rounded-xl', isSmall ? 'size-9' : 'size-10')}
          />
        ) : (
          <div
            className={cn(
              'shrink-0 inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold',
              isSmall ? 'size-9 text-sm' : 'size-10 text-base',
            )}
          >
            {getInitials(businessName || 'E')}
          </div>
        )}
        {!isSmall && (
          <span className="truncate text-sm font-semibold text-foreground">
            {businessName || 'Meu negócio'}
          </span>
        )}
      </Link>
    )
  }

  function NavLink({ item, showLabel }: { item: typeof NAV_ITEMS[number]; showLabel: boolean }) {
    const Icon = item.icon
    const isActive = pathname.startsWith(item.href)
    return (
      <Link
        href={item.href}
        className={cn(
          'flex items-center rounded-xl transition',
          showLabel ? 'gap-3 px-3 py-2.5' : 'size-10 justify-center',
          isActive
            ? 'bg-accent text-primary'
            : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
        )}
      >
        <span
          className={cn(
            'inline-flex shrink-0 items-center justify-center rounded-lg',
            showLabel ? 'size-8' : 'size-6',
            isActive ? 'bg-primary/15 text-primary' : 'text-muted-foreground',
          )}
        >
          <Icon className="size-4" />
        </span>
        {showLabel && (
          <span className="min-w-0">
            <span className="block text-sm font-medium">{item.label}</span>
            <span className="block text-xs text-muted-foreground">{item.description}</span>
          </span>
        )}
      </Link>
    )
  }

  function SidebarContent({ showLabel }: { showLabel: boolean }) {
    return (
      <TooltipProvider delayDuration={300}>
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className={cn('flex items-center border-b border-border/50 py-4', showLabel ? 'px-4 justify-between' : 'px-3 justify-center')}>
            {showLabel ? (
              <>
                <LogoBrand />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 text-muted-foreground"
                  onClick={toggleCollapsed}
                  aria-label="Recolher sidebar"
                >
                  <Menu className="size-4" />
                </Button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <LogoBrand size="small" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground"
                  onClick={toggleCollapsed}
                  aria-label="Expandir sidebar"
                >
                  <Menu className="size-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Nav */}
          <nav className={cn('flex-1 space-y-1 py-4', showLabel ? 'px-3' : 'px-2')}>
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className={cn('rounded-xl', showLabel ? 'h-12 w-full' : 'size-10')} />
                ))
              : mainItems.map((item) =>
                  showLabel ? (
                    <NavLink key={item.href} item={item} showLabel />
                  ) : (
                    <Tooltip key={item.href}>
                      <TooltipTrigger asChild>
                        <div><NavLink item={item} showLabel={false} /></div>
                      </TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  ),
                )}
          </nav>

          {/* Rodapé — config + usuário */}
          <div className={cn('border-t border-border/50 py-3', showLabel ? 'px-3 space-y-1' : 'px-2 space-y-2 flex flex-col items-center')}>
            {configItem && (
              showLabel ? (
                <NavLink item={configItem} showLabel />
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div><NavLink item={configItem} showLabel={false} /></div>
                  </TooltipTrigger>
                  <TooltipContent side="right">{configItem.label}</TooltipContent>
                </Tooltip>
              )
            )}

            {showLabel && (
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-border/50 bg-accent/30 px-3 py-2">
                <div className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-xs font-bold text-primary">
                  {getInitials(user?.name ?? 'U')}
                </div>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-foreground">
                    {isLoading ? '...' : (user?.name ?? '—')}
                  </span>
                </span>
                <button
                  onClick={handleLogout}
                  className="shrink-0 text-muted-foreground transition hover:text-foreground"
                  aria-label="Sair da conta"
                >
                  <LogOut className="size-4" />
                </button>
              </div>
            )}

            {!showLabel && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleLogout}
                    className="inline-flex size-10 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-accent/60 hover:text-foreground"
                    aria-label="Sair da conta"
                  >
                    <LogOut className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Sair da conta</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </TooltipProvider>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        {/* Sidebar desktop (xl+) */}
        <aside
          className={cn(
            'hidden xl:flex flex-col border-r border-border/50 bg-background/80 backdrop-blur transition-all duration-200',
            collapsed ? 'w-[64px]' : 'w-[220px]',
          )}
        >
          <SidebarContent showLabel={!collapsed} />
        </aside>

        {/* Área principal */}
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          {/* Header mobile (< xl) */}
          <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/50 bg-background/80 px-4 py-3 backdrop-blur xl:hidden">
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0" aria-label="Abrir menu">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[240px] p-0 bg-background">
                <SidebarContent showLabel />
              </SheetContent>
            </Sheet>

            <div className="flex flex-1 items-center justify-center">
              <LogoBrand />
            </div>

            <div className="shrink-0">
              <div className="inline-flex size-9 items-center justify-center rounded-xl bg-primary/15 text-xs font-bold text-primary">
                {isLoading ? '…' : getInitials(user?.name ?? 'U')}
              </div>
            </div>
          </header>

          <div className="flex-1 px-4 py-6 sm:px-6 xl:px-8 xl:py-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 4: Commit**

```bash
git add src/components/app/app-shell.tsx
git commit -m "feat(ui): AppShell redesign — sidebar colapsável desktop + drawer mobile"
```

---

## Task 8: Frontend — BrandingForm com 6 color pickers

**Files:**
- Modify: `src/components/domain/settings/branding-form.tsx`
- Modify: `src/app/(app)/configuracoes/page.tsx`

- [ ] **Step 1: Atualizar tipo BrandingConfig e Props em branding-form.tsx**

Localizar o tipo `BrandingConfig` no topo do arquivo e substituir:

```typescript
type BrandingConfig = {
  logoUrl: string | null
  primaryColor: string
  accentColor: string
  backgroundColor: string
  borderColor: string
  foregroundColor: string
  mutedColor: string
  fontFamily: string
  borderRadius: string
  colorScheme: string
}

type Props = {
  initial: {
    logoUrl: string | null
    primaryColor: string
    accentColor: string
    backgroundColor: string
    borderColor: string
    foregroundColor: string
    mutedColor: string
    fontFamily: string
    borderRadius: string
    colorScheme: string
    [key: string]: unknown
  }
}
```

- [ ] **Step 2: Atualizar o estado inicial em BrandingForm**

Localizar o `useState<BrandingConfig>` e substituir:

```typescript
const [config, setConfig] = useState<BrandingConfig>({
  logoUrl: initial.logoUrl,
  primaryColor: initial.primaryColor,
  accentColor: initial.accentColor,
  backgroundColor: initial.backgroundColor,
  borderColor: initial.borderColor,
  foregroundColor: initial.foregroundColor,
  mutedColor: initial.mutedColor,
  fontFamily: initial.fontFamily,
  borderRadius: initial.borderRadius,
  colorScheme: initial.colorScheme,
})
```

- [ ] **Step 3: Adicionar constante WARM_DEFAULTS e botão de restaurar**

Após as constantes `RADIUS_OPTIONS` existentes, adicionar:

```typescript
const WARM_DEFAULTS = {
  primaryColor: '#c8916a',
  accentColor: '#fdf0e8',
  backgroundColor: '#faf7f4',
  borderColor: '#e8ddd3',
  foregroundColor: '#3d2b1f',
  mutedColor: '#8a7060',
}
```

- [ ] **Step 4: Substituir a seção de cores na JSX por 6 pickers**

Localizar o bloco `{/* Cores + Prévia lado a lado */}` e substituir o lado esquerdo (seção de cores) pelo novo painel:

```tsx
<section className="space-y-4">
  <div className="flex items-center justify-between">
    <h3 className="text-sm font-semibold text-slate-900">Cores</h3>
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        Object.entries(WARM_DEFAULTS).forEach(([field, value]) => {
          update(field as keyof BrandingConfig, value)
        })
      }}
    >
      Restaurar padrão warm
    </Button>
  </div>

  {[
    { field: 'primaryColor' as const, label: 'Cor da marca', desc: 'Botões, ícones ativos, links' },
    { field: 'backgroundColor' as const, label: 'Fundo da tela', desc: 'Background geral das páginas' },
    { field: 'accentColor' as const, label: 'Fundo de seleção', desc: 'Item ativo na sidebar, hover states' },
    { field: 'borderColor' as const, label: 'Bordas e separadores', desc: 'Cards, dividers, inputs' },
    { field: 'foregroundColor' as const, label: 'Texto principal', desc: 'Títulos e texto de destaque' },
    { field: 'mutedColor' as const, label: 'Texto secundário', desc: 'Descrições, hints, labels' },
  ].map(({ field, label, desc }) => (
    <div key={field} className="flex items-start gap-3">
      <input
        type="color"
        value={config[field]}
        onChange={(e) => update(field, e.target.value)}
        className="mt-1 h-8 w-8 cursor-pointer rounded border border-slate-200"
      />
      <div className="flex-1 space-y-0.5">
        <Label className="text-sm font-medium text-slate-900">{label}</Label>
        <p className="text-xs text-slate-500">{desc}</p>
        <input
          type="text"
          value={config[field]}
          onChange={(e) => {
            if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) {
              if (/^#[0-9a-fA-F]{6}$/.test(e.target.value))
                update(field, e.target.value)
              else setConfig((prev) => ({ ...prev, [field]: e.target.value }))
            }
          }}
          className="w-28 rounded-md border border-slate-200 px-2 py-1 font-mono text-sm"
        />
      </div>
    </div>
  ))}
</section>
```

- [ ] **Step 5: Atualizar handleSave para incluir os novos campos**

Localizar o `body: JSON.stringify({ ...config, logoUrl })` — já está com spread, então os novos campos serão incluídos automaticamente. Confirmar que o fetch envia todos os campos.

- [ ] **Step 6: Atualizar BrandingConfig type em configuracoes/page.tsx**

Localizar o tipo `BrandingConfig` no arquivo e substituir:

```typescript
type BrandingConfig = {
  logoUrl: string | null
  primaryColor: string
  accentColor: string
  backgroundColor: string
  borderColor: string
  foregroundColor: string
  mutedColor: string
  fontFamily: string
  borderRadius: string
  colorScheme: string
}
```

- [ ] **Step 7: Adicionar overflow scroll nas tabs de configuracoes/page.tsx**

Localizar o `<Tabs defaultValue="negocio" ...>` e envolver o `<TabsList>` com scroll:

```tsx
<Tabs defaultValue="negocio" onValueChange={handleTabChange}>
  <div className="overflow-x-auto scrollbar-hide">
    <TabsList className="grid w-full grid-cols-7 min-w-[560px]">
      {/* tabs existentes */}
    </TabsList>
  </div>
  {/* TabsContent existentes sem mudança */}
```

- [ ] **Step 8: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 9: Commit**

```bash
git add src/components/domain/settings/branding-form.tsx src/app/(app)/configuracoes/page.tsx
git commit -m "feat(ui): BrandingForm com 6 color pickers + botão restaurar warm"
```

---

## Task 9: Responsividade — Relatórios Layout + Páginas + Sidebar

**Files:**
- Modify: `src/components/domain/reports/reports-sidebar.tsx`
- Modify: `src/app/(app)/relatorios/layout.tsx`
- Modify: `src/app/(app)/relatorios/agendamentos/page.tsx`
- Modify: `src/app/(app)/relatorios/profissionais/page.tsx`
- Modify: `src/app/(app)/relatorios/financeiro/page.tsx`
- Modify: `src/app/(app)/relatorios/clientes/page.tsx`

- [ ] **Step 1: Atualizar ReportsSidebar para modo mobile e desktop**

Substituir o conteúdo completo de `src/components/domain/reports/reports-sidebar.tsx`:

```typescript
'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BarChart2, Calendar, Users, Scissors } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const REPORT_ITEMS = [
  { label: 'Financeiro', href: '/relatorios/financeiro', icon: BarChart2 },
  { label: 'Agendamentos', href: '/relatorios/agendamentos', icon: Calendar },
  { label: 'Clientes', href: '/relatorios/clientes', icon: Users },
  { label: 'Profissionais', href: '/relatorios/profissionais', icon: Scissors },
] as const

export function ReportsSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const activeHref =
    REPORT_ITEMS.find((i) => pathname === i.href || pathname.startsWith(i.href + '/'))?.href ??
    REPORT_ITEMS[0].href

  return (
    <>
      {/* Mobile: Select */}
      <div className="md:hidden">
        <Select value={activeHref} onValueChange={(v) => router.push(v)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Tipo de relatório" />
          </SelectTrigger>
          <SelectContent>
            {REPORT_ITEMS.map(({ label, href }) => (
              <SelectItem key={href} value={href}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: lista de links */}
      <nav className="hidden md:flex flex-col gap-1">
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Tipo de relatório
        </p>
        {REPORT_ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                isActive
                  ? 'bg-accent text-primary'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
              )}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
```

- [ ] **Step 2: Atualizar relatorios/layout.tsx**

Substituir o conteúdo completo:

```typescript
import type { ReactNode } from 'react'
import { ReportsSidebar } from '@/components/domain/reports/reports-sidebar'

export default function RelatoriosLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Relatórios</h1>
        <p className="mt-1 text-sm text-slate-500">Análises detalhadas do seu negócio</p>
      </div>
      <div className="flex flex-col gap-6 md:flex-row md:gap-8">
        <aside className="w-full md:w-52 md:shrink-0">
          <ReportsSidebar />
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Corrigir SelectTrigger em relatorios/agendamentos/page.tsx**

Localizar `className="w-52"` nos SelectTriggers e substituir por `className="w-full sm:w-52"`.
Localizar `className="w-48"` e substituir por `className="w-full sm:w-48"`.

Resultado esperado para os dois selects da página:
```tsx
<SelectTrigger className="w-full sm:w-52">
<SelectTrigger className="w-full sm:w-48">
```

- [ ] **Step 4: Corrigir SelectTrigger em relatorios/profissionais/page.tsx**

Mesmo padrão: `w-52` → `w-full sm:w-52`, `w-48` → `w-full sm:w-48`.

- [ ] **Step 5: Corrigir SelectTrigger em relatorios/financeiro/page.tsx**

Mesmo padrão.

- [ ] **Step 6: Corrigir SelectTrigger em relatorios/clientes/page.tsx**

Mesmo padrão.

- [ ] **Step 7: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add src/components/domain/reports/ src/app/(app)/relatorios/
git commit -m "fix(ui): relatórios responsivos — sidebar Select mobile + SelectTrigger widths"
```

---

## Task 10: Responsividade — Dashboard, Login, Configurações

**Files:**
- Modify: `src/components/domain/dashboard/dashboard-metrics.tsx`
- Modify: `src/app/(auth)/login/login-client.tsx`

> **Nota:** As tabs de `configuracoes/page.tsx` já foram atualizadas na Task 8 (overflow-x-auto).

- [ ] **Step 1: Corrigir grid em dashboard-metrics.tsx**

> **Atenção:** O grid está em `dashboard-metrics.tsx`, não em `dashboard/page.tsx` (o spec cita o arquivo errado — a classe `sm:grid-cols-2 xl:grid-cols-4` está na linha ~59 do componente de métricas).

Localizar `className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"` e substituir:

```tsx
<div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
```

- [ ] **Step 2: Atualizar login-client.tsx — tokens Tailwind e breakpoint do painel**

**2a.** Localizar `className="hidden lg:flex lg:w-[45%] flex-col border-r border-[#e5e5e5] bg-[#f7f6f3] p-12"` e substituir:

```tsx
<div className="hidden md:flex md:w-[45%] flex-col border-r border-border bg-background p-12">
```

**2b.** Localizar o logo fallback na `LeftPanel` (div com `bg-[#191919]`) e substituir:
```tsx
<div className="flex size-8 items-center justify-center rounded-lg bg-primary">
  <Sparkles className="size-4 text-primary-foreground" />
</div>
```

**2c.** Substituir `text-[#191919]` do displayName na LeftPanel por `text-foreground`.

**2d.** Substituir `text-[#191919]` do h1 por `text-foreground`.

**2e.** Substituir `text-[#787774]` do parágrafo por `text-muted-foreground`.

**2f.** No benefício item: substituir `border-[#e5e5e5]` por `border-border`.

**2g.** Substituir `bg-[#e3e2df]` por `bg-border`.

**2h.** Substituir `text-[#37352f]` por `text-foreground`.

**2i.** Na `RightPanel`, localizar a div de logo mobile (`.lg:hidden`) e substituir:
```tsx
<div className="md:hidden flex items-center gap-2">
  <div className="flex size-7 items-center justify-center rounded-lg bg-primary">
    <Sparkles className="size-3.5 text-primary-foreground" />
  </div>
  <span className="text-sm font-semibold text-foreground">
    SaaS Estetica
  </span>
</div>
```

**2j.** No `TabsList` do login, substituir `bg-[#f7f6f3]` por `bg-background`.

**2k.** Nos `TabsTrigger` do login, substituir `data-[state=active]:bg-[#191919] data-[state=active]:text-white` por `data-[state=active]:bg-primary data-[state=active]:text-primary-foreground`.

**2l.** Nos campos Input com `bg-[#f7f6f3]`, substituir por `bg-background`.

**2m.** Nos campos Input com `border-[#e5e5e5]`, substituir por `border-border`.

**2n.** Nos campos Input com `focus-visible:ring-[#191919]`, substituir por `focus-visible:ring-primary`.

**2o.** No botão Submit com `bg-[#191919]` e `hover:bg-[#2d2d2d]`, substituir por `bg-primary hover:bg-primary/90`.

**2p.** No Separator com `bg-[#e5e5e5]`, substituir por `bg-border`.

**2q.** No texto "ou", substituir `text-[#b7b6b2]` por `text-muted-foreground`.

**2r.** Nos Labels com `text-[#37352f]`, substituir por `text-foreground`.

**2s.** No botão de toggle de senha com `text-[#787774] hover:text-[#191919]`, substituir por `text-muted-foreground hover:text-foreground`.

**2t.** No link "Esqueceu sua senha?" com `text-[#787774] hover:text-[#191919]`, substituir por `text-muted-foreground hover:text-foreground`.

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/domain/dashboard/dashboard-metrics.tsx src/app/(auth)/login/login-client.tsx
git commit -m "fix(ui): responsividade — grid métricas + tokens Tailwind na tela de login"
```

---

## Task 11: Responsividade — Tabelas com scroll e fade gradient

**Files:**
- Modify: `src/components/domain/reports/report-table.tsx`
- Modify: `src/components/domain/billing/billing-plans-content.tsx`
- Modify: `src/components/domain/settings/commissions-grid.tsx`

O padrão é envolver o `overflow-x-auto` existente com um wrapper que aplica `mask-image` para fade nas bordas.

- [ ] **Step 1: Adicionar wrapper com fade em report-table.tsx**

Localizar `<div className="overflow-x-auto rounded-2xl border border-slate-100">` e substituir:

```tsx
<div
  className="overflow-x-auto rounded-2xl border border-border"
  style={{
    maskImage: 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)',
    WebkitMaskImage: 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)',
  }}
>
  <table className="w-full text-sm">
    {/* conteúdo existente sem alteração */}
```

> Nota: o fechamento da div permanece onde estava.

- [ ] **Step 2: Verificar billing-plans-content.tsx**

Ler o arquivo para localizar o `overflow-x-auto` existente e aplicar o mesmo padrão de wrapper com `maskImage`. O padrão é idêntico ao Step 1.

```bash
# Localizar o overflow-x-auto
grep -n "overflow-x-auto" src/components/domain/billing/billing-plans-content.tsx
```

Adicionar o mesmo `style={{ maskImage: ... }}` ao elemento que contém o `overflow-x-auto`.

- [ ] **Step 3: Aplicar o mesmo padrão em commissions-grid.tsx**

Localizar `overflow-x-auto` em `src/components/domain/settings/commissions-grid.tsx` e aplicar o mesmo `style={{ maskImage: ... }}`.

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 5: Commit**

```bash
git add src/components/domain/reports/report-table.tsx src/components/domain/billing/billing-plans-content.tsx src/components/domain/settings/commissions-grid.tsx
git commit -m "fix(ui): tabelas com scroll recebem fade gradient nas bordas"
```

---

## Task 12: Verificação Final e Testes

- [ ] **Step 1: Rodar todos os testes de branding**

```bash
npx vitest run src/lib/branding/ src/domains/iam/branding.service.test.ts src/domains/iam/branding.repository.test.ts
```

Esperado: todos passando.

- [ ] **Step 2: Rodar suite completa de testes**

```bash
npx vitest run
```

Esperado: todos passando. Se algum falhar por referência a `secondaryColor` em tipo de mock, atualizar o fixture removendo `secondaryColor` do objeto ou tornando-o `null`.

- [ ] **Step 3: Verificação TypeScript final**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 4: Commit de fechamento se houver ajustes**

```bash
git add -A
git commit -m "fix(tests): atualiza fixtures de branding para novos tokens warm"
```

---

## Checklist de entrega

- [ ] Migration aplicada e Prisma Client regenerado
- [ ] `buildCssVariables` emite os 6 tokens sem `--secondary`
- [ ] `UpdateBrandingSchema` aceita todos os 6 campos de cor
- [ ] `getCurrentUser` retorna `businessName`
- [ ] AppLayout passa `logoUrl` e `businessName` para `AppShell`
- [ ] `globals.css` com defaults warm no `:root`
- [ ] AppShell redesenhado: sidebar colapsável desktop + drawer mobile
- [ ] BrandingForm com 6 pickers + botão restaurar
- [ ] `configuracoes/page.tsx` tipo atualizado + tabs com scroll
- [ ] ReportsSidebar responsivo (Select mobile + links desktop)
- [ ] Relatorios layout responsivo (flex-col mobile)
- [ ] SelectTrigger widths corrigidos em 4 páginas de relatório
- [ ] Grid do dashboard corrigido em `dashboard-metrics.tsx`
- [ ] Login com tokens Tailwind + breakpoint `md` no painel
- [ ] 3 tabelas com fade gradient via mask-image
- [ ] Todos os testes passando
- [ ] `npx tsc --noEmit` — zero erros
