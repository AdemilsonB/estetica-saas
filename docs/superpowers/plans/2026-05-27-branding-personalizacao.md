# Branding — Personalização de Marca: Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que cada tenant personalize a identidade visual do sistema (logo, cores, fonte, border-radius, modo de cor) com passo opcional no onboarding e aba dedicada em Configurações → Layout.

**Architecture:** CSS custom properties oklch injetadas via `<style>` tag no `(app)/layout.tsx` (SSR), garantindo zero flash de cor. Configurações persistidas no model `BrandingConfig` (1:1 com `Tenant`). Prévia ao vivo no formulário via `document.documentElement.style.setProperty()` sem salvar no banco.

**Tech Stack:** Next.js 15 App Router, Prisma, Shadcn UI (Nova preset — oklch), TailwindCSS v4, Zod, Supabase Storage, next/font/google, Vitest.

---

## Mapa de arquivos

### Criar
```
prisma/migrations/XXXX_add_branding_config/migration.sql
src/lib/branding/build-css-variables.ts
src/lib/branding/build-css-variables.test.ts
src/domains/iam/branding.repository.ts
src/domains/iam/branding.repository.test.ts
src/domains/iam/branding.service.ts
src/domains/iam/branding.service.test.ts
src/domains/iam/branding.schemas.ts
src/app/api/iam/branding/route.ts           (GET + PUT)
src/app/api/iam/branding/logo/route.ts      (POST)
src/components/domain/settings/branding-form.tsx
```

### Modificar
```
prisma/schema.prisma                         remove brandingConfig Json?, add BrandingConfig model
src/shared/events/domain-events.ts           add tenant.branding.updated event type
src/shared/test/factories/tenant.factory.ts  remove brandingConfig Json field
src/domains/iam/iam.repository.ts            createTenantWithOwner: remove Json, create BrandingConfig
src/domains/iam/iam.service.ts               register: aceita branding? opcional
src/app/api/iam/register/route.ts            schema: add branding? opcional
src/app/api/iam/tenant-branding/route.ts     read from BrandingConfig relation
src/app/(app)/layout.tsx                     injeção SSR do <style> + fonts
src/app/layout.tsx                           carrega todas as 6 fontes com variáveis
src/app/(auth)/onboarding/page.tsx           seção de branding opcional
src/app/(app)/configuracoes/page.tsx         nova aba Layout
```

---

## Task 1: Prisma schema — modelo BrandingConfig + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/shared/test/factories/tenant.factory.ts`

- [ ] **Step 1: Atualizar prisma/schema.prisma**

Remover `brandingConfig Json?` do model `Tenant` e adicionar o model `BrandingConfig` e a relação:

```prisma
// Em model Tenant — REMOVER esta linha:
//   brandingConfig    Json?
// ADICIONAR relação:
  brandingConfig    BrandingConfig?

// Novo model — adicionar após model Tenant:
model BrandingConfig {
  id              String   @id @default(cuid())
  tenantId        String   @unique
  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  logoUrl         String?
  primaryColor    String   @default("#191919")
  secondaryColor  String   @default("#6366f1")
  accentColor     String   @default("#f59e0b")
  backgroundColor String   @default("#f8f8f7")
  fontFamily      String   @default("inter")
  borderRadius    String   @default("medium")
  colorScheme     String   @default("light")

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId])
}
```

- [ ] **Step 2: Rodar migration**

```bash
npx prisma migrate dev --name add_branding_config
```

Saída esperada: `Your database is now in sync with your schema.`

- [ ] **Step 3: Atualizar tenant factory**

Em `src/shared/test/factories/tenant.factory.ts`, remover o campo `brandingConfig: null` do objeto retornado por `makeTenant`, pois ele não existe mais no tipo `Tenant` do Prisma após a migration:

```typescript
import type { Tenant } from '@prisma/client'
import { PlanName } from '@prisma/client'

export function makeTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: 'tenant-test-id',
    name: 'Salão Teste',
    slug: 'salao-teste',
    plan: PlanName.FREE,
    phone: null,
    address: null,
    zApiInstanceId: null,
    zApiToken: null,
    whatsappEnabled: false,
    businessHours: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}
```

- [ ] **Step 4: Verificar types gerados**

```bash
npx tsc --noEmit
```

Saída esperada: zero erros.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/shared/test/factories/tenant.factory.ts
git commit -m "feat(branding): adiciona model BrandingConfig — migration + schema"
```

---

## Task 2: Utilitário buildCssVariables (hex → oklch) + testes

**Files:**
- Create: `src/lib/branding/build-css-variables.ts`
- Create: `src/lib/branding/build-css-variables.test.ts`

O projeto usa `oklch()` (preset Nova do Shadcn). O utilitário converte hex → oklch e gera a string CSS para injeção SSR.

- [ ] **Step 1: Escrever testes (TDD)**

Criar `src/lib/branding/build-css-variables.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { hexToOklch, buildCssVariables, calcForeground, BORDER_RADIUS_MAP, FONT_VARIABLE_MAP } from './build-css-variables'

describe('hexToOklch', () => {
  it('converte branco para oklch(1 0 0)', () => {
    const { l, c, h } = hexToOklch('#ffffff')
    expect(l).toBeCloseTo(1, 2)
    expect(c).toBeCloseTo(0, 2)
  })

  it('converte preto para oklch(0 0 0)', () => {
    const { l, c, h } = hexToOklch('#000000')
    expect(l).toBeCloseTo(0, 2)
    expect(c).toBeCloseTo(0, 2)
  })

  it('converte #191919 para um L baixo (cor escura)', () => {
    const { l } = hexToOklch('#191919')
    expect(l).toBeLessThan(0.25)
  })

  it('converte #f8f8f7 para um L alto (cor clara)', () => {
    const { l } = hexToOklch('#f8f8f7')
    expect(l).toBeGreaterThan(0.95)
  })
})

describe('calcForeground', () => {
  it('retorna branco para cor primária escura (#191919)', () => {
    expect(calcForeground('#191919')).toBe('oklch(0.985 0 0)')
  })

  it('retorna preto para cor primária clara (#f0f0f0)', () => {
    expect(calcForeground('#f0f0f0')).toBe('oklch(0.145 0 0)')
  })
})

describe('BORDER_RADIUS_MAP', () => {
  it('mapeia none para 0rem', () => {
    expect(BORDER_RADIUS_MAP['none']).toBe('0rem')
  })
  it('mapeia medium para 0.625rem', () => {
    expect(BORDER_RADIUS_MAP['medium']).toBe('0.625rem')
  })
  it('mapeia full para 1.5rem', () => {
    expect(BORDER_RADIUS_MAP['full']).toBe('1.5rem')
  })
})

describe('FONT_VARIABLE_MAP', () => {
  it('mapeia inter para var(--font-inter)', () => {
    expect(FONT_VARIABLE_MAP['inter']).toBe('var(--font-inter)')
  })
})

describe('buildCssVariables', () => {
  it('gera string CSS com variáveis oklch válidas', () => {
    const css = buildCssVariables({
      primaryColor: '#191919',
      secondaryColor: '#6366f1',
      accentColor: '#f59e0b',
      backgroundColor: '#f8f8f7',
      fontFamily: 'inter',
      borderRadius: 'medium',
      colorScheme: 'light',
      logoUrl: null,
    })
    expect(css).toContain('--primary:')
    expect(css).toContain('--background:')
    expect(css).toContain('--radius:')
    expect(css).toContain('--font-sans:')
    expect(css).toContain('oklch(')
  })

  it('define dark class quando colorScheme é dark', () => {
    const result = buildCssVariables({
      primaryColor: '#191919',
      secondaryColor: '#6366f1',
      accentColor: '#f59e0b',
      backgroundColor: '#1a1a1a',
      fontFamily: 'inter',
      borderRadius: 'medium',
      colorScheme: 'dark',
      logoUrl: null,
    })
    expect(result).toContain('dark')
  })

  it('não inclui dark quando colorScheme é light', () => {
    const result = buildCssVariables({
      primaryColor: '#191919',
      secondaryColor: '#6366f1',
      accentColor: '#f59e0b',
      backgroundColor: '#f8f8f7',
      fontFamily: 'inter',
      borderRadius: 'medium',
      colorScheme: 'light',
      logoUrl: null,
    })
    expect(result).not.toContain('dark')
  })
})
```

- [ ] **Step 2: Rodar testes para confirmar que falham**

```bash
npx vitest run src/lib/branding/build-css-variables.test.ts
```

Saída esperada: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar buildCssVariables**

Criar `src/lib/branding/build-css-variables.ts`:

```typescript
export type BrandingInput = {
  primaryColor: string
  secondaryColor: string
  accentColor: string
  backgroundColor: string
  fontFamily: string
  borderRadius: string
  colorScheme: string
  logoUrl: string | null
}

export type CssVariablesResult = {
  styleTag: string
  isDark: boolean
}

export const BORDER_RADIUS_MAP: Record<string, string> = {
  none: '0rem',
  medium: '0.625rem',
  full: '1.5rem',
}

export const FONT_VARIABLE_MAP: Record<string, string> = {
  inter: 'var(--font-inter)',
  manrope: 'var(--font-manrope)',
  geist: 'var(--font-geist-sans)',
  'dm-sans': 'var(--font-dm-sans)',
  'plus-jakarta-sans': 'var(--font-plus-jakarta-sans)',
  lato: 'var(--font-lato)',
}

// Converte canal sRGB [0,1] para linear
function toLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

// Parse hex #rrggbb para sRGB [0,1]
function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  return [r, g, b]
}

// sRGB → oklch (via linear RGB → XYZ D65 → Oklab → oklch)
export function hexToOklch(hex: string): { l: number; c: number; h: number } {
  const [sr, sg, sb] = parseHex(hex)
  const lr = toLinear(sr)
  const lg = toLinear(sg)
  const lb = toLinear(sb)

  // linear RGB → XYZ D65
  const x = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
  const y = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
  const z = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb

  // XYZ → Oklab (cube root + matrix)
  const lCbrt = Math.cbrt(0.8189330101 * x + 0.3618667424 * y - 0.1288597137 * z)
  const mCbrt = Math.cbrt(0.0329845436 * x + 0.9293118715 * y + 0.0361456387 * z)
  const sCbrt = Math.cbrt(0.0482003018 * x + 0.2643662691 * y + 0.6338517070 * z)

  const labL = 0.2104542553 * lCbrt + 0.7936177850 * mCbrt - 0.0040720468 * sCbrt
  const labA = 1.9779984951 * lCbrt - 2.4285922050 * mCbrt + 0.4505937099 * sCbrt
  const labB = 0.0259040371 * lCbrt + 0.7827717662 * mCbrt - 0.8086757660 * sCbrt

  const c = Math.sqrt(labA * labA + labB * labB)
  const h = Math.atan2(labB, labA) * (180 / Math.PI)

  return { l: labL, c, h: h < 0 ? h + 360 : h }
}

function oklchStr(hex: string): string {
  const { l, c, h } = hexToOklch(hex)
  const lRounded = Math.round(l * 1000) / 1000
  const cRounded = Math.round(c * 1000) / 1000
  const hRounded = Math.round(h * 100) / 100
  return `oklch(${lRounded} ${cRounded} ${hRounded})`
}

// Calcula foreground (claro ou escuro) baseado em L da cor primária
export function calcForeground(hex: string): string {
  const { l } = hexToOklch(hex)
  return l > 0.5 ? 'oklch(0.145 0 0)' : 'oklch(0.985 0 0)'
}

export function buildCssVariables(config: BrandingInput): CssVariablesResult {
  const isDark = config.colorScheme === 'dark'
  const radius = BORDER_RADIUS_MAP[config.borderRadius] ?? BORDER_RADIUS_MAP['medium']
  const fontVar = FONT_VARIABLE_MAP[config.fontFamily] ?? FONT_VARIABLE_MAP['inter']

  const primary = oklchStr(config.primaryColor)
  const primaryFg = calcForeground(config.primaryColor)
  const secondary = oklchStr(config.secondaryColor)
  const secondaryFg = calcForeground(config.secondaryColor)
  const accent = oklchStr(config.accentColor)
  const accentFg = calcForeground(config.accentColor)
  const bg = oklchStr(config.backgroundColor)
  const fg = calcForeground(config.backgroundColor)

  const styleTag = `
    --primary: ${primary};
    --primary-foreground: ${primaryFg};
    --secondary: ${secondary};
    --secondary-foreground: ${secondaryFg};
    --accent: ${accent};
    --accent-foreground: ${accentFg};
    --background: ${bg};
    --foreground: ${fg};
    --sidebar: ${bg};
    --sidebar-foreground: ${fg};
    --sidebar-primary: ${primary};
    --sidebar-primary-foreground: ${primaryFg};
    --radius: ${radius};
    --font-sans: ${fontVar};
  `.trim()

  return { styleTag, isDark }
}
```

- [ ] **Step 4: Rodar testes para confirmar que passam**

```bash
npx vitest run src/lib/branding/build-css-variables.test.ts
```

Saída esperada: todos os testes PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/branding/
git commit -m "feat(branding): utilitário buildCssVariables — hex → oklch + testes"
```

---

## Task 3: domain-events.ts — adicionar tipo tenant.branding.updated

**Files:**
- Modify: `src/shared/events/domain-events.ts`

- [ ] **Step 1: Adicionar o tipo ao union DomainEvent**

Em `src/shared/events/domain-events.ts`, adicionar ao union `DomainEvent`:

```typescript
  | {
      type: 'tenant.branding.updated'
      payload: { tenantId: string; changes: Partial<BrandingConfigUpdate> }
    }
```

E adicionar o tipo `BrandingConfigUpdate` no topo do arquivo:

```typescript
type BrandingConfigUpdate = {
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  accentColor: string
  backgroundColor: string
  fontFamily: string
  borderRadius: string
  colorScheme: string
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Saída esperada: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/shared/events/domain-events.ts
git commit -m "feat(branding): adiciona evento tenant.branding.updated ao DomainEvent"
```

---

## Task 4: branding.schemas.ts — Zod schemas de validação

**Files:**
- Create: `src/domains/iam/branding.schemas.ts`

- [ ] **Step 1: Criar schemas Zod**

Criar `src/domains/iam/branding.schemas.ts`:

```typescript
import { z } from 'zod'

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Cor deve ser um hex válido (#rrggbb)')

export const UpdateBrandingSchema = z.object({
  logoUrl: z.string().url().nullable().optional(),
  primaryColor: hexColor.optional(),
  secondaryColor: hexColor.optional(),
  accentColor: hexColor.optional(),
  backgroundColor: hexColor.optional(),
  fontFamily: z
    .enum(['inter', 'manrope', 'geist', 'dm-sans', 'plus-jakarta-sans', 'lato'])
    .optional(),
  borderRadius: z.enum(['none', 'medium', 'full']).optional(),
  colorScheme: z.enum(['light', 'dark']).optional(),
})

export type UpdateBrandingInput = z.infer<typeof UpdateBrandingSchema>

// Schema usado no onboarding (subconjunto)
export const OnboardingBrandingSchema = z.object({
  logoUrl: z.string().url().nullable().optional(),
  primaryColor: hexColor.optional(),
  backgroundColor: hexColor.optional(),
})

export type OnboardingBrandingInput = z.infer<typeof OnboardingBrandingSchema>
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Saída esperada: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/domains/iam/branding.schemas.ts
git commit -m "feat(branding): Zod schemas — UpdateBrandingSchema + OnboardingBrandingSchema"
```

---

## Task 5: BrandingRepository + testes

**Files:**
- Create: `src/domains/iam/branding.repository.ts`
- Create: `src/domains/iam/branding.repository.test.ts`

- [ ] **Step 1: Escrever testes (TDD)**

Criar `src/domains/iam/branding.repository.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import '../../shared/test/prisma-mock'
import { prismaMock } from '../../shared/test/prisma-mock'
import { BrandingRepository } from './branding.repository'

const TENANT_ID = 'tenant-abc'

const defaultBranding = {
  id: 'branding-1',
  tenantId: TENANT_ID,
  logoUrl: null,
  primaryColor: '#191919',
  secondaryColor: '#6366f1',
  accentColor: '#f59e0b',
  backgroundColor: '#f8f8f7',
  fontFamily: 'inter',
  borderRadius: 'medium',
  colorScheme: 'light',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}

describe('BrandingRepository', () => {
  let repo: BrandingRepository

  beforeEach(() => {
    repo = new BrandingRepository()
  })

  describe('findByTenant', () => {
    it('retorna BrandingConfig do tenant', async () => {
      prismaMock.brandingConfig.findUnique.mockResolvedValue(defaultBranding)
      const result = await repo.findByTenant(TENANT_ID)
      expect(result).toEqual(defaultBranding)
      expect(prismaMock.brandingConfig.findUnique).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID },
      })
    })

    it('retorna null se não encontrado', async () => {
      prismaMock.brandingConfig.findUnique.mockResolvedValue(null)
      const result = await repo.findByTenant(TENANT_ID)
      expect(result).toBeNull()
    })
  })

  describe('create', () => {
    it('cria BrandingConfig com tenantId e defaults', async () => {
      prismaMock.brandingConfig.create.mockResolvedValue(defaultBranding)
      await repo.create(TENANT_ID)
      expect(prismaMock.brandingConfig.create).toHaveBeenCalledWith({
        data: { tenantId: TENANT_ID },
      })
    })

    it('cria BrandingConfig com valores customizados', async () => {
      const custom = { ...defaultBranding, primaryColor: '#ff0000' }
      prismaMock.brandingConfig.create.mockResolvedValue(custom)
      await repo.create(TENANT_ID, { primaryColor: '#ff0000' })
      expect(prismaMock.brandingConfig.create).toHaveBeenCalledWith({
        data: { tenantId: TENANT_ID, primaryColor: '#ff0000' },
      })
    })
  })

  describe('update', () => {
    it('atualiza campos parciais do BrandingConfig', async () => {
      const updated = { ...defaultBranding, primaryColor: '#0000ff' }
      prismaMock.brandingConfig.update.mockResolvedValue(updated)
      const result = await repo.update(TENANT_ID, { primaryColor: '#0000ff' })
      expect(result).toEqual(updated)
      expect(prismaMock.brandingConfig.update).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID },
        data: { primaryColor: '#0000ff' },
      })
    })
  })
})
```

- [ ] **Step 2: Rodar testes para confirmar que falham**

```bash
npx vitest run src/domains/iam/branding.repository.test.ts
```

Saída esperada: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar BrandingRepository**

Criar `src/domains/iam/branding.repository.ts`:

```typescript
import { prisma } from '@/shared/database/prisma'
import type { UpdateBrandingInput } from './branding.schemas'

export class BrandingRepository {
  async findByTenant(tenantId: string) {
    return prisma.brandingConfig.findUnique({ where: { tenantId } })
  }

  async create(tenantId: string, data?: Partial<UpdateBrandingInput>) {
    return prisma.brandingConfig.create({
      data: { tenantId, ...data },
    })
  }

  async update(tenantId: string, data: Partial<UpdateBrandingInput>) {
    return prisma.brandingConfig.update({
      where: { tenantId },
      data,
    })
  }
}

export const brandingRepository = new BrandingRepository()
```

- [ ] **Step 4: Rodar testes para confirmar que passam**

```bash
npx vitest run src/domains/iam/branding.repository.test.ts
```

Saída esperada: todos os testes PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domains/iam/branding.repository.ts src/domains/iam/branding.repository.test.ts
git commit -m "feat(branding): BrandingRepository — findByTenant, create, update + testes"
```

---

## Task 6: BrandingService + testes

**Files:**
- Create: `src/domains/iam/branding.service.ts`
- Create: `src/domains/iam/branding.service.test.ts`

- [ ] **Step 1: Escrever testes (TDD)**

Criar `src/domains/iam/branding.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BrandingService } from './branding.service'
import type { BrandingRepository } from './branding.repository'
import { eventBus } from '@/shared/events/event-bus'

vi.mock('@/shared/events/event-bus', () => ({
  eventBus: { publish: vi.fn() },
}))

const TENANT_ID = 'tenant-abc'

const defaultBranding = {
  id: 'branding-1',
  tenantId: TENANT_ID,
  logoUrl: null,
  primaryColor: '#191919',
  secondaryColor: '#6366f1',
  accentColor: '#f59e0b',
  backgroundColor: '#f8f8f7',
  fontFamily: 'inter',
  borderRadius: 'medium',
  colorScheme: 'light',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}

function makeRepoMock(): BrandingRepository {
  return {
    findByTenant: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  } as unknown as BrandingRepository
}

describe('BrandingService', () => {
  let repo: BrandingRepository
  let service: BrandingService

  beforeEach(() => {
    repo = makeRepoMock()
    service = new BrandingService(repo)
    vi.clearAllMocks()
  })

  describe('get', () => {
    it('retorna BrandingConfig do tenant', async () => {
      vi.mocked(repo.findByTenant).mockResolvedValue(defaultBranding)
      const result = await service.get(TENANT_ID)
      expect(result).toEqual(defaultBranding)
    })

    it('lança NotFoundError se não encontrado', async () => {
      vi.mocked(repo.findByTenant).mockResolvedValue(null)
      await expect(service.get(TENANT_ID)).rejects.toThrow('BrandingConfig')
    })
  })

  describe('update', () => {
    it('atualiza e publica evento tenant.branding.updated', async () => {
      const updated = { ...defaultBranding, primaryColor: '#ff0000' }
      vi.mocked(repo.update).mockResolvedValue(updated)
      const result = await service.update(TENANT_ID, { primaryColor: '#ff0000' })
      expect(result).toEqual(updated)
      expect(eventBus.publish).toHaveBeenCalledWith({
        type: 'tenant.branding.updated',
        payload: { tenantId: TENANT_ID, changes: { primaryColor: '#ff0000' } },
      })
    })
  })
})
```

- [ ] **Step 2: Rodar testes para confirmar que falham**

```bash
npx vitest run src/domains/iam/branding.service.test.ts
```

Saída esperada: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar BrandingService**

Criar `src/domains/iam/branding.service.ts`:

```typescript
import { NotFoundError } from '@/shared/errors'
import { eventBus } from '@/shared/events/event-bus'
import type { BrandingRepository } from './branding.repository'
import { brandingRepository } from './branding.repository'
import type { UpdateBrandingInput } from './branding.schemas'

export class BrandingService {
  constructor(private readonly repo: BrandingRepository) {}

  async get(tenantId: string) {
    const config = await this.repo.findByTenant(tenantId)
    if (!config) throw new NotFoundError('BrandingConfig')
    return config
  }

  async update(tenantId: string, input: UpdateBrandingInput) {
    const updated = await this.repo.update(tenantId, input)
    eventBus.publish({
      type: 'tenant.branding.updated',
      payload: { tenantId, changes: input },
    })
    return updated
  }
}

export const brandingService = new BrandingService(brandingRepository)
```

- [ ] **Step 4: Rodar testes para confirmar que passam**

```bash
npx vitest run src/domains/iam/branding.service.test.ts
```

Saída esperada: todos os testes PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domains/iam/branding.service.ts src/domains/iam/branding.service.test.ts
git commit -m "feat(branding): BrandingService — get, update + publicação de evento + testes"
```

---

## Task 7: Atualizar fluxo de register para criar BrandingConfig

**Files:**
- Modify: `src/domains/iam/iam.repository.ts`
- Modify: `src/domains/iam/iam.service.ts`
- Modify: `src/app/api/iam/register/route.ts`
- Modify: `src/app/api/iam/tenant-branding/route.ts`

- [ ] **Step 1: Atualizar iam.repository.ts — createTenantWithOwner**

Em `createTenantWithOwner`, substituir a criação de `brandingConfig: Json` pelo relacionamento com `BrandingConfig`. Localizar a parte que cria o tenant e modificar:

```typescript
// ANTES (remover):
const tenant = await tx.tenant.create({
  data: {
    name: input.businessName,
    slug,
    brandingConfig: {
      primaryColor: "#191919",
      logoUrl: null,
      displayName: input.businessName,
    },
  },
})

// DEPOIS:
const tenant = await tx.tenant.create({
  data: {
    name: input.businessName,
    slug,
  },
})

await tx.brandingConfig.create({
  data: {
    tenantId: tenant.id,
    ...(input.branding ?? {}),
  },
})
```

O tipo `CreateTenantWithOwnerInput` também recebe o campo opcional:

```typescript
type CreateTenantWithOwnerInput = {
  userId: string
  email: string
  businessName: string
  userName: string
  branding?: {
    logoUrl?: string | null
    primaryColor?: string
    backgroundColor?: string
  }
}
```

- [ ] **Step 2: Atualizar iam.service.ts — register**

O tipo `RegisterInput` recebe `branding?`:

```typescript
type RegisterInput = {
  businessName: string
  userName: string
  branding?: {
    logoUrl?: string | null
    primaryColor?: string
    backgroundColor?: string
  }
}
```

Passar `branding` para `createTenantWithOwner`:

```typescript
createResult = await iamRepository.createTenantWithOwner({
  userId,
  email: authUser.user.email!,
  businessName: input.businessName,
  userName: input.userName,
  branding: input.branding,
})
```

- [ ] **Step 3: Atualizar register/route.ts — schema Zod**

Adicionar `branding?` opcional ao `RegisterSchema`:

```typescript
import { OnboardingBrandingSchema } from '@/domains/iam/branding.schemas'

const RegisterSchema = z.object({
  businessName: z.string().min(2, 'Nome do negocio muito curto'),
  userName: z.string().min(2, 'Nome muito curto'),
  branding: OnboardingBrandingSchema.optional(),
})
```

- [ ] **Step 4: Atualizar tenant-branding/route.ts para usar BrandingConfig**

A rota pública `/api/iam/tenant-branding` lê `tenant.brandingConfig Json?` que não existe mais. Atualizar para ler do relacionamento:

```typescript
import { prisma } from '@/shared/database/prisma'

const DEFAULT_BRANDING = {
  primaryColor: '#191919',
  logoUrl: null,
  displayName: 'SaaS Estetica',
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug')

  if (!slug) return Response.json(DEFAULT_BRANDING)

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: {
      name: true,
      brandingConfig: {
        select: { primaryColor: true, logoUrl: true },
      },
    },
  })

  if (!tenant) return Response.json(DEFAULT_BRANDING)

  return Response.json({
    primaryColor: tenant.brandingConfig?.primaryColor ?? DEFAULT_BRANDING.primaryColor,
    logoUrl: tenant.brandingConfig?.logoUrl ?? null,
    displayName: tenant.name,
  })
}
```

- [ ] **Step 5: Verificar tipos e testes**

```bash
npx tsc --noEmit
npx vitest run
```

Saída esperada: zero erros de TypeScript, todos os testes passando.

- [ ] **Step 6: Commit**

```bash
git add src/domains/iam/iam.repository.ts src/domains/iam/iam.service.ts src/app/api/iam/register/route.ts src/app/api/iam/tenant-branding/route.ts
git commit -m "feat(branding): register cria BrandingConfig na transação — aceita branding? opcional"
```

---

## Task 8: API Routes GET + PUT /api/iam/branding

**Files:**
- Create: `src/app/api/iam/branding/route.ts`

- [ ] **Step 1: Criar a rota**

Criar `src/app/api/iam/branding/route.ts`:

```typescript
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { brandingService } from '@/domains/iam/branding.service'
import { UpdateBrandingSchema } from '@/domains/iam/branding.schemas'
import { revalidateTag } from 'next/cache'

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

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Saída esperada: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/iam/branding/route.ts
git commit -m "feat(branding): API routes GET + PUT /api/iam/branding"
```

---

## Task 9: API Route POST /api/iam/branding/logo

**Files:**
- Create: `src/app/api/iam/branding/logo/route.ts`

- [ ] **Step 1: Criar a rota de upload**

Criar `src/app/api/iam/branding/logo/route.ts`:

```typescript
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { supabaseAdmin } from '@/integrations/supabase/admin'
import { ValidationError } from '@/shared/errors'

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml']
const MAX_BYTES = 2 * 1024 * 1024 // 2MB

export async function POST(req: Request) {
  try {
    const session = await getSessionContext(req)

    const formData = await req.formData()
    const file = formData.get('logo')

    if (!(file instanceof File)) {
      throw new ValidationError('Campo logo ausente ou inválido.')
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new ValidationError('Formato não suportado. Use PNG, JPG ou SVG.')
    }

    if (file.size > MAX_BYTES) {
      throw new ValidationError('Arquivo excede 2MB.')
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const ext = file.type === 'image/svg+xml' ? 'svg' : file.type === 'image/png' ? 'png' : 'jpg'
    const path = `${session.tenantId}/logo.${ext}`

    const { error } = await supabaseAdmin.storage
      .from('logos')
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (error) throw new Error(`Upload falhou: ${error.message}`)

    const { data } = supabaseAdmin.storage.from('logos').getPublicUrl(path)

    return Response.json({ logoUrl: data.publicUrl }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Saída esperada: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/iam/branding/logo/route.ts
git commit -m "feat(branding): API route POST /api/iam/branding/logo — upload para Supabase Storage"
```

---

## Task 10: Carregamento de fontes no root layout

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Adicionar as 6 fontes ao root layout**

O arquivo atual carrega apenas `Geist` e `Geist_Mono`. Adicionar as demais fontes com variáveis CSS e corrigir `--font-sans` para referenciar `--font-geist-sans` por padrão:

```typescript
import type { Metadata } from 'next'
import { Geist, Geist_Mono, Inter, Manrope, DM_Sans, Plus_Jakarta_Sans, Lato } from 'next/font/google'
import { Toaster } from 'sonner'
import { Providers } from '@/lib/providers'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })
const inter = Inter({ variable: '--font-inter', subsets: ['latin'] })
const manrope = Manrope({ variable: '--font-manrope', subsets: ['latin'] })
const dmSans = DM_Sans({ variable: '--font-dm-sans', subsets: ['latin'] })
const plusJakarta = Plus_Jakarta_Sans({ variable: '--font-plus-jakarta-sans', subsets: ['latin'] })
const lato = Lato({ variable: '--font-lato', subsets: ['latin'], weight: ['400', '700'] })

export const metadata: Metadata = {
  title: 'Estetica SaaS',
  description: 'Plataforma operacional inteligente para negocios de estetica e servicos.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fontVars = [
    geistSans.variable,
    geistMono.variable,
    inter.variable,
    manrope.variable,
    dmSans.variable,
    plusJakarta.variable,
    lato.variable,
  ].join(' ')

  return (
    <html lang="pt-BR" className={`${fontVars} h-full antialiased`}>
      <head>
        {/* --font-sans padrão aponta para Inter enquanto não há BrandingConfig */}
        <style>{`:root { --font-sans: var(--font-inter); }`}</style>
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>
          {children}
          <Toaster position="top-right" richColors />
        </Providers>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Verificar tipos e build**

```bash
npx tsc --noEmit
```

Saída esperada: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(branding): carrega 6 fontes no root layout com variáveis CSS"
```

---

## Task 11: Injeção SSR de branding no (app)/layout.tsx

**Files:**
- Modify: `src/app/(app)/layout.tsx`

O layout atual é uma linha só. Ele passa a ser um Server Component que lê a sessão, busca o `BrandingConfig` e injeta o `<style>` tag.

- [ ] **Step 1: Atualizar o layout**

Substituir o conteúdo de `src/app/(app)/layout.tsx`:

```typescript
import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { unstable_cache } from 'next/cache'
import { AppShell } from '@/components/app/app-shell'
import { brandingRepository } from '@/domains/iam/branding.repository'
import { buildCssVariables } from '@/lib/branding/build-css-variables'
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

export default async function AppLayout({ children }: { children: ReactNode }) {
  const tenantId = await getTenantIdFromSession()

  let brandingCss = ''
  let isDark = false

  if (tenantId) {
    const config = await getBrandingCached(tenantId)
    if (config) {
      const result = buildCssVariables({
        primaryColor: config.primaryColor,
        secondaryColor: config.secondaryColor,
        accentColor: config.accentColor,
        backgroundColor: config.backgroundColor,
        fontFamily: config.fontFamily,
        borderRadius: config.borderRadius,
        colorScheme: config.colorScheme,
        logoUrl: config.logoUrl,
      })
      brandingCss = result.styleTag
      isDark = result.isDark
    }
  }

  return (
    <>
      {brandingCss && (
        <style dangerouslySetInnerHTML={{ __html: `:root { ${brandingCss} }` }} />
      )}
      {/* darkClass é gerenciado pelo Shadcn via globals.css .dark selector */}
      <AppShell isDark={isDark}>{children}</AppShell>
    </>
  )
}
```

**Nota:** O `AppShell` precisa receber a prop `isDark` para adicionar/remover a classe `dark` no elemento raiz. Se `AppShell` não aceitar essa prop ainda, pular o `isDark` por enquanto e implementar o modo escuro como melhoria futura. Verificar a assinatura de `AppShell` antes de alterar.

- [ ] **Step 2: Verificar se AppShell precisa ser atualizado**

```bash
grep -n "isDark\|dark\|props" src/components/app/app-shell.tsx | head -20
```

Se `AppShell` não aceitar `isDark`, simplificar o layout sem essa prop por ora:

```typescript
export default async function AppLayout({ children }: { children: ReactNode }) {
  const tenantId = await getTenantIdFromSession()
  let brandingCss = ''

  if (tenantId) {
    const config = await getBrandingCached(tenantId)
    if (config) {
      const { styleTag } = buildCssVariables({ ...config })
      brandingCss = styleTag
    }
  }

  return (
    <>
      {brandingCss && (
        <style dangerouslySetInnerHTML={{ __html: `:root { ${brandingCss} }` }} />
      )}
      <AppShell>{children}</AppShell>
    </>
  )
}
```

- [ ] **Step 3: Verificar tipos**

```bash
npx tsc --noEmit
```

Saída esperada: zero erros.

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/layout.tsx
git commit -m "feat(branding): injeção SSR de CSS variables no (app)/layout.tsx"
```

---

## Task 12: BrandingForm component

**Files:**
- Create: `src/components/domain/settings/branding-form.tsx`

- [ ] **Step 1: Criar o componente**

Criar `src/components/domain/settings/branding-form.tsx`:

```typescript
'use client'

import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { Loader2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type BrandingConfig = {
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  accentColor: string
  backgroundColor: string
  fontFamily: string
  borderRadius: string
  colorScheme: string
}

type Props = {
  initial: BrandingConfig
}

const FONTS = [
  { slug: 'inter', label: 'Inter' },
  { slug: 'manrope', label: 'Manrope' },
  { slug: 'geist', label: 'Geist' },
  { slug: 'dm-sans', label: 'DM Sans' },
  { slug: 'plus-jakarta-sans', label: 'Plus Jakarta Sans' },
  { slug: 'lato', label: 'Lato' },
]

const RADIUS_OPTIONS = [
  { value: 'none', label: 'Sem arredondamento' },
  { value: 'medium', label: 'Médio' },
  { value: 'full', label: 'Totalmente arredondado' },
]

const RADIUS_MAP: Record<string, string> = {
  none: '0rem',
  medium: '0.625rem',
  full: '1.5rem',
}

function applyPreview(field: string, value: string) {
  if (field === 'borderRadius') {
    document.documentElement.style.setProperty('--radius', RADIUS_MAP[value] ?? '0.625rem')
    return
  }
  if (field === 'fontFamily') {
    const varMap: Record<string, string> = {
      inter: 'var(--font-inter)',
      manrope: 'var(--font-manrope)',
      geist: 'var(--font-geist-sans)',
      'dm-sans': 'var(--font-dm-sans)',
      'plus-jakarta-sans': 'var(--font-plus-jakarta-sans)',
      lato: 'var(--font-lato)',
    }
    document.documentElement.style.setProperty('--font-sans', varMap[value] ?? 'var(--font-inter)')
    return
  }
  if (field === 'colorScheme') {
    if (value === 'dark') document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
    return
  }
  // Converte hex para oklch via fetch ao utilitário — usa aproximação simples client-side
  // para preview imediato (a conversão precisa acontece no save via SSR)
  document.documentElement.style.setProperty(
    `--${field.replace(/Color$/, '').replace(/([A-Z])/g, '-$1').toLowerCase()}`,
    value
  )
}

export function BrandingForm({ initial }: Props) {
  const [config, setConfig] = useState<BrandingConfig>(initial)
  const [logoPreview, setLogoPreview] = useState<string | null>(initial.logoUrl)
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function update<K extends keyof BrandingConfig>(field: K, value: BrandingConfig[K]) {
    setConfig((prev) => ({ ...prev, [field]: value }))
    applyPreview(field, value as string)
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Arquivo excede 2MB.')
      return
    }
    setPendingLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  function removeLogo() {
    setPendingLogoFile(null)
    setLogoPreview(null)
    setConfig((prev) => ({ ...prev, logoUrl: null }))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      let logoUrl = config.logoUrl

      if (pendingLogoFile) {
        const fd = new FormData()
        fd.append('logo', pendingLogoFile)
        const uploadRes = await fetch('/api/iam/branding/logo', { method: 'POST', body: fd })
        if (!uploadRes.ok) throw new Error('Falha no upload do logo.')
        const { logoUrl: uploaded } = await uploadRes.json() as { logoUrl: string }
        logoUrl = uploaded
      }

      const res = await fetch('/api/iam/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, logoUrl }),
      })

      if (!res.ok) throw new Error('Falha ao salvar configurações.')

      setConfig((prev) => ({ ...prev, logoUrl }))
      setPendingLogoFile(null)
      toast.success('Configurações salvas com sucesso.')
    } catch {
      toast.error('Erro ao salvar. Tente novamente.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Logo */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Identidade visual</h3>
        <div className="flex items-center gap-4">
          {logoPreview ? (
            <img src={logoPreview} alt="Logo" className="h-16 w-16 rounded-lg object-contain border border-slate-200" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-slate-400">
              <Upload className="size-5" />
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              {logoPreview ? 'Trocar' : 'Enviar logo'}
            </Button>
            {logoPreview && (
              <Button variant="ghost" size="sm" onClick={removeLogo}>
                <X className="size-4" />
              </Button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            className="hidden"
            onChange={handleLogoChange}
          />
        </div>
        <p className="text-xs text-slate-500">PNG, JPG ou SVG · máx 2MB</p>
      </section>

      {/* Cores */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">Cores</h3>
        {(
          [
            { field: 'primaryColor', label: 'Cor primária' },
            { field: 'secondaryColor', label: 'Cor secundária' },
            { field: 'accentColor', label: 'Cor accent' },
            { field: 'backgroundColor', label: 'Cor de fundo' },
          ] as const
        ).map(({ field, label }) => (
          <div key={field} className="flex items-center gap-3">
            <input
              type="color"
              value={config[field]}
              onChange={(e) => update(field, e.target.value)}
              className="h-8 w-8 cursor-pointer rounded border border-slate-200"
            />
            <Label className="w-36 text-sm text-slate-700">{label}</Label>
            <input
              type="text"
              value={config[field]}
              onChange={(e) => {
                if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) {
                  if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) update(field, e.target.value)
                  else setConfig((prev) => ({ ...prev, [field]: e.target.value }))
                }
              }}
              className="w-28 rounded-md border border-slate-200 px-2 py-1 font-mono text-sm"
            />
          </div>
        ))}
      </section>

      {/* Tipografia */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Tipografia</h3>
        <Select value={config.fontFamily} onValueChange={(v) => update('fontFamily', v)}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONTS.map((f) => (
              <SelectItem key={f.slug} value={f.slug}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      {/* Border radius */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Forma dos elementos</h3>
        <RadioGroup
          value={config.borderRadius}
          onValueChange={(v) => update('borderRadius', v)}
          className="space-y-2"
        >
          {RADIUS_OPTIONS.map((opt) => (
            <div key={opt.value} className="flex items-center gap-2">
              <RadioGroupItem value={opt.value} id={`radius-${opt.value}`} />
              <Label htmlFor={`radius-${opt.value}`} className="text-sm">{opt.label}</Label>
            </div>
          ))}
        </RadioGroup>
      </section>

      {/* Modo de cor */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Modo de cor</h3>
        <div className="flex gap-2">
          {(['light', 'dark'] as const).map((scheme) => (
            <Button
              key={scheme}
              variant={config.colorScheme === scheme ? 'default' : 'outline'}
              size="sm"
              onClick={() => update('colorScheme', scheme)}
            >
              {scheme === 'light' ? '☀ Claro' : '☾ Escuro'}
            </Button>
          ))}
        </div>
      </section>

      {/* Save */}
      <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
        {isSaving ? <><Loader2 className="mr-2 size-4 animate-spin" />Salvando...</> : 'Salvar alterações'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Saída esperada: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/settings/branding-form.tsx
git commit -m "feat(branding): BrandingForm — prévia ao vivo + upload de logo + save"
```

---

## Task 13: Configurações — aba Layout

**Files:**
- Modify: `src/app/(app)/configuracoes/page.tsx`

- [ ] **Step 1: Adicionar aba Layout à página de configurações**

Ler o arquivo atual e localizar o `TabsList` com `grid-cols-4`. Adicionar o quinto trigger e o conteúdo da aba:

No `TabsList`, alterar `grid-cols-4` para `grid-cols-5` e adicionar:
```typescript
<TabsTrigger value="layout">Layout</TabsTrigger>
```

Adicionar o import do `BrandingForm`:
```typescript
import { BrandingForm } from '@/components/domain/settings/branding-form'
```

Adicionar o `TabsContent` para layout (após o último `TabsContent` existente). O componente precisa buscar a config inicial via fetch:

```typescript
// No topo do componente (client), adicionar estado:
const [brandingConfig, setBrandingConfig] = useState<BrandingConfig | null>(null)
const [brandingLoading, setBrandingLoading] = useState(false)

// Carregar branding quando a aba for selecionada:
function handleTabChange(value: string) {
  if (value === 'layout' && !brandingConfig && !brandingLoading) {
    setBrandingLoading(true)
    fetch('/api/iam/branding')
      .then((r) => r.json())
      .then((data) => setBrandingConfig(data as BrandingConfig))
      .finally(() => setBrandingLoading(false))
  }
}
```

E o `TabsContent`:
```typescript
<TabsContent value="layout" className="mt-6">
  <div className="rounded-2xl border border-white/80 bg-white/85 p-6 shadow-sm">
    <h2 className="mb-4 text-base font-semibold text-slate-950">
      Identidade visual e layout
    </h2>
    {brandingLoading && (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-6 animate-spin text-slate-400" />
      </div>
    )}
    {brandingConfig && !brandingLoading && (
      <BrandingForm initial={brandingConfig} />
    )}
  </div>
</TabsContent>
```

Adicionar `onValueChange={handleTabChange}` ao `<Tabs>`.

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Saída esperada: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/configuracoes/page.tsx
git commit -m "feat(branding): aba Layout em Configurações com BrandingForm"
```

---

## Task 14: Onboarding — seção de branding opcional

**Files:**
- Modify: `src/app/(auth)/onboarding/page.tsx`

- [ ] **Step 1: Adicionar estado de branding e seção visual no modo create**

No componente atual, adicionar estados para os campos de branding:

```typescript
const [primaryColor, setPrimaryColor] = useState('#191919')
const [backgroundColor, setBackgroundColor] = useState('#f8f8f7')
const [logoFile, setLogoFile] = useState<File | null>(null)
const [logoPreview, setLogoPreview] = useState<string | null>(null)
const logoInputRef = useRef<HTMLInputElement>(null)
```

Antes do submit (`handleCreate`), fazer upload do logo se existir e coletar `branding`:

```typescript
async function handleCreate(e: React.FormEvent) {
  e.preventDefault()
  setIsSubmitting(true)
  try {
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { toast.error('Sessão expirada.'); router.push('/login'); return }

    let logoUrl: string | null = null
    if (logoFile) {
      const fd = new FormData()
      fd.append('logo', logoFile)
      const uploadRes = await fetch('/api/iam/branding/logo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: fd,
      })
      if (uploadRes.ok) {
        const data = await uploadRes.json() as { logoUrl: string }
        logoUrl = data.logoUrl
      }
    }

    const res = await fetch('/api/iam/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        businessName,
        userName,
        branding: {
          ...(logoUrl ? { logoUrl } : {}),
          primaryColor,
          backgroundColor,
        },
      }),
    })
    if (!res.ok) {
      const body = await res.json()
      toast.error(body.error?.message ?? 'Erro ao configurar sua conta.')
      return
    }

    await supabase.auth.refreshSession()
    toast.success('Tudo pronto! Bem-vindo ao workspace.')
    router.push('/dashboard')
    router.refresh()
  } finally {
    setIsSubmitting(false)
  }
}
```

Adicionar a seção de branding no JSX do modo `create`, abaixo dos campos existentes e antes do botão:

```typescript
{/* Divisor + seção de branding opcional */}
<div className="space-y-4 border-t border-slate-100 pt-4">
  <p className="text-xs font-medium uppercase tracking-wide text-[#787774]">
    Identidade visual <span className="font-normal normal-case">(opcional)</span>
  </p>

  {/* Logo */}
  <div className="space-y-2">
    <Label className="text-sm">Logo</Label>
    <div className="flex items-center gap-3">
      {logoPreview ? (
        <img src={logoPreview} alt="Logo" className="h-12 w-12 rounded-lg object-contain border border-slate-200" />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 text-slate-300">
          <span className="text-lg">+</span>
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => logoInputRef.current?.click()}
      >
        Enviar imagem
      </Button>
      <input
        ref={logoInputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f && f.size <= 2 * 1024 * 1024) {
            setLogoFile(f)
            setLogoPreview(URL.createObjectURL(f))
          }
        }}
      />
    </div>
  </div>

  {/* Cor principal */}
  <div className="flex items-center gap-3">
    <input
      type="color"
      value={primaryColor}
      onChange={(e) => setPrimaryColor(e.target.value)}
      className="h-8 w-8 cursor-pointer rounded border border-slate-200"
    />
    <Label className="text-sm text-slate-700">Cor principal</Label>
    <span className="font-mono text-xs text-slate-500">{primaryColor}</span>
  </div>

  {/* Cor de fundo */}
  <div className="flex items-center gap-3">
    <input
      type="color"
      value={backgroundColor}
      onChange={(e) => setBackgroundColor(e.target.value)}
      className="h-8 w-8 cursor-pointer rounded border border-slate-200"
    />
    <Label className="text-sm text-slate-700">Cor de fundo</Label>
    <span className="font-mono text-xs text-slate-500">{backgroundColor}</span>
  </div>

  {/* Hint */}
  <p className="text-xs text-[#787774]">
    💡 Mais opções em <span className="font-medium">Configurações → Layout</span>
  </p>
</div>
```

Adicionar `import { useRef } from 'react'` se não existir.

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Saída esperada: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/(auth)/onboarding/page.tsx
git commit -m "feat(branding): seção de branding opcional no onboarding — logo + cores"
```

---

## Task 15: Verificação final

- [ ] **Step 1: Rodar TypeScript completo**

```bash
npx tsc --noEmit
```

Saída esperada: zero erros.

- [ ] **Step 2: Rodar todos os testes**

```bash
npx vitest run
```

Saída esperada: todos os testes passando.

- [ ] **Step 3: Verificar se o bucket logos existe no Supabase**

No painel do Supabase (Storage), confirmar que o bucket `logos` existe e está configurado como público. Se não existir, criar via SQL:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "feat(branding): personalização de marca completa — onboarding + configurações"
```

- [ ] **Step 5: Abrir PR**

```bash
git push origin HEAD
gh pr create --title "feat(branding): personalização de marca — logo, cores, fonte, border-radius, modo escuro" --body "$(cat <<'EOF'
## Resumo

- Novo model `BrandingConfig` (1:1 com `Tenant`) — migration incluída
- CSS custom properties oklch injetadas via SSR no `(app)/layout.tsx` — zero flash de cor
- Onboarding: passo opcional de branding (logo + cores principais)
- Configurações → nova aba Layout com prévia ao vivo e save completo
- Upload de logo para Supabase Storage (bucket: logos, 2MB, PNG/JPG/SVG)

## Checklist de teste

- [ ] Criar conta nova → preencher logo e cores no onboarding → dashboard carrega com as cores corretas sem flash
- [ ] Abrir Configurações → Layout → alterar cor primária → prévia ao vivo atualiza imediatamente
- [ ] Clicar Salvar → recarregar página → cores persistem via SSR
- [ ] Pular branding no onboarding → sistema usa defaults
- [ ] Upload de logo acima de 2MB → erro correto exibido

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review

**Cobertura do spec:**
- ✅ Model `BrandingConfig` (Task 1)
- ✅ `buildCssVariables` hex → oklch (Task 2)
- ✅ `tenant.branding.updated` event (Task 3)
- ✅ Zod schemas (Task 4)
- ✅ Repository (Task 5)
- ✅ Service (Task 6)
- ✅ Register flow com branding opcional (Task 7)
- ✅ API GET + PUT /api/iam/branding (Task 8)
- ✅ API POST /api/iam/branding/logo (Task 9)
- ✅ Fontes carregadas no root layout (Task 10)
- ✅ SSR injection (app)/layout.tsx (Task 11)
- ✅ BrandingForm component com prévia ao vivo (Task 12)
- ✅ Configurações aba Layout (Task 13)
- ✅ Onboarding seção branding (Task 14)

**Consistência de tipos:**
- `BrandingInput` em `buildCssVariables.ts` e `CssVariablesResult` são usados consistentemente nas Tasks 2 e 11
- `UpdateBrandingInput` (Task 4) é usado por `BrandingRepository.update` (Task 5), `BrandingService.update` (Task 6) e a API route (Task 8)
- `OnboardingBrandingSchema` (Task 4) é usado em `register/route.ts` (Task 7)

**Sem placeholders:** todos os steps contêm código completo.
