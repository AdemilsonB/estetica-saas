# Página do cliente — confiança (WhatsApp, Instagram, Google) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aumentar a confiança do cliente final na página pública desacoplando o contato WhatsApp da automação paga, destacando o Instagram com a cor da marca e trazendo localização/prova social do Google.

**Architecture:** Três campos aditivos no `Tenant` (`whatsappContactEnabled`, `googleBusinessUrl`, `googlePlaceId`). Backend passa a aceitá-los; a vitrine e o portal `/cliente` consomem via `findTenantBySlug`. Google é keyless por padrão (mapa embed + rota + "Ver no Google"); o selo de nota é gated por `GOOGLE_PLACES_API_KEY` — sem a chave, nada de rede.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Prisma + Supabase, Zod, Vitest + @testing-library/react, Tailwind, Shadcn UI.

## Global Constraints

- Todo output em **Português do Brasil** (código, testes, commits, UI).
- TypeScript strict — sem `any`, sem `as unknown as`.
- `tenantId` sempre do token; multi-tenancy preservado.
- Erros tipados de `src/shared/errors/`; nunca `throw new Error('string')`.
- Migração **aditiva** apenas (sem drop/alteração destrutiva).
- Validação de input com Zod em toda API Route.
- `npx tsc --noEmit` zero erros e `npx vitest run` verdes antes de cada commit relevante.
- Commits em PT-BR, terminados com `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Branch de trabalho: `feat/pagina-cliente-confianca` (já criada).

---

### Task 1: Modelo de dados + backend do tenant

**Files:**
- Modify: `prisma/schema.prisma` (model `Tenant`, após `coverImageUrl` na linha ~151)
- Create: `prisma/migrations/<timestamp>_add_public_trust_fields/migration.sql` (gerada)
- Modify: `src/domains/iam/iam.repository.ts:341-374` (`updateTenant` — assinatura + `select`)
- Modify: `src/domains/iam/iam.service.ts:362-374` (`updateTenant` — assinatura)
- Modify: `src/app/api/iam/tenant/route.ts:11-18` (`updateTenantSchema`)
- Test: `src/domains/iam/iam.service.test.ts`

**Interfaces:**
- Produces: `Tenant.whatsappContactEnabled: boolean`, `Tenant.googleBusinessUrl: string | null`,
  `Tenant.googlePlaceId: string | null`.
- Produces: `iamService.updateTenant(tenantId, data)` onde `data` aceita
  `whatsappContactEnabled?: boolean`, `googleBusinessUrl?: string | null`,
  `googlePlaceId?: string | null` (além dos campos já existentes).

- [ ] **Step 1: Adicionar os campos ao schema Prisma**

Em `prisma/schema.prisma`, no model `Tenant`, logo após `coverImageUrl String?`:

```prisma
  whatsappContactEnabled Boolean                @default(true)
  googleBusinessUrl      String?
  googlePlaceId          String?
```

- [ ] **Step 2: Gerar a migração aditiva**

Run: `npx prisma migrate dev --name add_public_trust_fields`
Expected: cria `migration.sql` com três `ALTER TABLE "Tenant" ADD COLUMN`, aplica sem erro, e roda `prisma generate`.

- [ ] **Step 3: Escrever o teste que falha (service persiste novos campos)**

Em `src/domains/iam/iam.service.test.ts`, garanta que o mock de `./iam.repository` inclua `updateTenant: vi.fn()` e adicione:

```ts
describe('updateTenant', () => {
  it('repassa os novos campos de confiança ao repositório', async () => {
    const repo = (await import('./iam.repository')).iamRepository as unknown as {
      updateTenant: ReturnType<typeof vi.fn>
    }
    repo.updateTenant.mockResolvedValue({ id: 't1' })

    await iamService.updateTenant('t1', {
      whatsappContactEnabled: false,
      googleBusinessUrl: 'https://www.google.com/maps/place/Salao',
    })

    expect(repo.updateTenant).toHaveBeenCalledWith('t1', {
      whatsappContactEnabled: false,
      googleBusinessUrl: 'https://www.google.com/maps/place/Salao',
    })
  })
})
```

- [ ] **Step 4: Rodar o teste e confirmar a falha**

Run: `npx vitest run src/domains/iam/iam.service.test.ts -t "campos de confiança"`
Expected: FAIL (tipo não aceita os campos / mock não chamado como esperado).

- [ ] **Step 5: Ampliar a assinatura no service**

Em `src/domains/iam/iam.service.ts`, no objeto `data` de `updateTenant` (linhas 364-371), adicionar:

```ts
      whatsappContactEnabled?: boolean
      googleBusinessUrl?: string | null
      googlePlaceId?: string | null
```

- [ ] **Step 6: Ampliar a assinatura e o select no repository**

Em `src/domains/iam/iam.repository.ts`, no objeto `data` de `updateTenant` (linhas 343-350), adicionar as mesmas três linhas do Step 5. No bloco `select` (a partir da linha 355) acrescentar:

```ts
        whatsappContactEnabled: true,
        googleBusinessUrl: true,
        googlePlaceId: true,
```

- [ ] **Step 7: Validar os campos na API Route**

Em `src/app/api/iam/tenant/route.ts`, dentro de `updateTenantSchema` (após `coverImageUrl`):

```ts
  whatsappContactEnabled: z.boolean().optional(),
  googleBusinessUrl: z
    .string()
    .trim()
    .url()
    .max(500)
    .refine((u) => /(google\.[^/]+\/maps|g\.co\/|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(u), {
      message: 'Informe um link válido do Google Maps.',
    })
    .nullable()
    .optional(),
```

(`googlePlaceId` NÃO entra no schema da API — é resolvido pelo backend na Task 3, nunca vem do cliente.)

- [ ] **Step 8: Rodar testes e tsc**

Run: `npx vitest run src/domains/iam/iam.service.test.ts && npx tsc --noEmit`
Expected: PASS e zero erros.

- [ ] **Step 9: Commit**

```bash
git add prisma/ src/domains/iam/ src/app/api/iam/tenant/route.ts
git commit -m "feat(iam): campos de confiança do tenant (whatsappContact, google) + validação

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Helper Google Places (gated por env)

**Files:**
- Modify: `src/shared/config/env.ts:3-19` (adicionar `GOOGLE_PLACES_API_KEY`)
- Create: `src/lib/google-places.ts`
- Test: `src/lib/google-places.test.ts`

**Interfaces:**
- Produces:
  - `isGooglePlacesEnabled(): boolean`
  - `resolveGooglePlaceId(url: string): Promise<string | null>`
  - `fetchGoogleRating(placeId: string): Promise<{ rating: number; userRatingCount: number } | null>`

- [ ] **Step 1: Adicionar a env var opcional**

Em `src/shared/config/env.ts`, dentro de `envSchema` (após `WHATSAPP_PROVIDER`):

```ts
  GOOGLE_PLACES_API_KEY: z.string().min(1).optional(),
```

- [ ] **Step 2: Escrever os testes que falham**

Create `src/lib/google-places.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const ORIGINAL = process.env.GOOGLE_PLACES_API_KEY

afterEach(() => {
  process.env.GOOGLE_PLACES_API_KEY = ORIGINAL
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('google-places', () => {
  it('isGooglePlacesEnabled reflete a presença da chave', async () => {
    process.env.GOOGLE_PLACES_API_KEY = ''
    let mod = await import('./google-places')
    expect(mod.isGooglePlacesEnabled()).toBe(false)
    vi.resetModules()
    process.env.GOOGLE_PLACES_API_KEY = 'chave-x'
    mod = await import('./google-places')
    expect(mod.isGooglePlacesEnabled()).toBe(true)
  })

  it('fetchGoogleRating retorna null sem chave e não chama a rede', async () => {
    process.env.GOOGLE_PLACES_API_KEY = ''
    const fetchSpy = vi.spyOn(global, 'fetch')
    const { fetchGoogleRating } = await import('./google-places')
    expect(await fetchGoogleRating('place-1')).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('fetchGoogleRating mapeia rating e contagem com chave', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'chave-x'
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ rating: 4.8, userRatingCount: 214 }), { status: 200 }),
    )
    const { fetchGoogleRating } = await import('./google-places')
    expect(await fetchGoogleRating('place-1')).toEqual({ rating: 4.8, userRatingCount: 214 })
  })

  it('resolveGooglePlaceId extrai o nome da URL e usa Text Search', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'chave-x'
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ places: [{ id: 'ChIJabc' }] }), { status: 200 }),
    )
    const { resolveGooglePlaceId } = await import('./google-places')
    expect(await resolveGooglePlaceId('https://www.google.com/maps/place/Beleza+Atual/@-25,-49,17z')).toBe('ChIJabc')
  })
})
```

- [ ] **Step 3: Rodar e confirmar a falha**

Run: `npx vitest run src/lib/google-places.test.ts`
Expected: FAIL ("Cannot find module './google-places'").

- [ ] **Step 4: Implementar o helper**

Create `src/lib/google-places.ts`:

```ts
import { env } from '@/shared/config/env'

const DETAILS_URL = 'https://places.googleapis.com/v1/places'
const SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText'

export function isGooglePlacesEnabled(): boolean {
  return Boolean(env.GOOGLE_PLACES_API_KEY)
}

/** Extrai o nome do estabelecimento de uma URL de perfil do Google Maps. */
function extractPlaceName(url: string): string | null {
  const match = url.match(/\/maps\/place\/([^/@]+)/)
  if (!match) return null
  return decodeURIComponent(match[1].replace(/\+/g, ' ')).trim() || null
}

/** Resolve o Place ID a partir do link colado. Retorna null se não for possível. */
export async function resolveGooglePlaceId(url: string): Promise<string | null> {
  if (!isGooglePlacesEnabled()) return null
  const name = extractPlaceName(url)
  if (!name) return null
  try {
    const res = await fetch(SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY as string,
        'X-Goog-FieldMask': 'places.id',
      },
      body: JSON.stringify({ textQuery: name }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { places?: { id: string }[] }
    return data.places?.[0]?.id ?? null
  } catch {
    return null
  }
}

/** Busca nota + contagem de avaliações (cacheado 5min). Null sem chave ou em erro. */
export async function fetchGoogleRating(
  placeId: string,
): Promise<{ rating: number; userRatingCount: number } | null> {
  if (!isGooglePlacesEnabled()) return null
  try {
    const res = await fetch(`${DETAILS_URL}/${encodeURIComponent(placeId)}`, {
      headers: {
        'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY as string,
        'X-Goog-FieldMask': 'rating,userRatingCount',
      },
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { rating?: number; userRatingCount?: number }
    if (typeof data.rating !== 'number' || typeof data.userRatingCount !== 'number') return null
    return { rating: data.rating, userRatingCount: data.userRatingCount }
  } catch {
    return null
  }
}
```

- [ ] **Step 5: Rodar testes e tsc**

Run: `npx vitest run src/lib/google-places.test.ts && npx tsc --noEmit`
Expected: PASS e zero erros.

- [ ] **Step 6: Commit**

```bash
git add src/shared/config/env.ts src/lib/google-places.ts src/lib/google-places.test.ts
git commit -m "feat(google): helper Places gated por env (resolve placeId + nota, keyless por padrão)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Resolver placeId ao salvar o link do Google

**Files:**
- Modify: `src/domains/iam/iam.service.ts` (`updateTenant`)
- Test: `src/domains/iam/iam.service.test.ts`

**Interfaces:**
- Consumes: `resolveGooglePlaceId` (Task 2), `iamRepository.updateTenant` (Task 1).
- Produces: comportamento — quando `googleBusinessUrl` é fornecido e a chave existe, o service
  resolve e grava `googlePlaceId`; sem chave ou em falha, grava `googlePlaceId: null` (link limpo → null também).

- [ ] **Step 1: Escrever o teste que falha**

Adicionar em `src/domains/iam/iam.service.test.ts` (com mock de `@/lib/google-places`):

```ts
vi.mock('@/lib/google-places', () => ({
  resolveGooglePlaceId: vi.fn(),
}))

it('resolve o googlePlaceId ao salvar o link do Google', async () => {
  const repo = (await import('./iam.repository')).iamRepository as unknown as {
    updateTenant: ReturnType<typeof vi.fn>
  }
  const places = (await import('@/lib/google-places')) as unknown as {
    resolveGooglePlaceId: ReturnType<typeof vi.fn>
  }
  places.resolveGooglePlaceId.mockResolvedValue('ChIJabc')
  repo.updateTenant.mockResolvedValue({ id: 't1' })

  await iamService.updateTenant('t1', { googleBusinessUrl: 'https://www.google.com/maps/place/X' })

  expect(repo.updateTenant).toHaveBeenCalledWith('t1', {
    googleBusinessUrl: 'https://www.google.com/maps/place/X',
    googlePlaceId: 'ChIJabc',
  })
})

it('grava googlePlaceId null ao remover o link', async () => {
  const repo = (await import('./iam.repository')).iamRepository as unknown as {
    updateTenant: ReturnType<typeof vi.fn>
  }
  repo.updateTenant.mockResolvedValue({ id: 't1' })
  await iamService.updateTenant('t1', { googleBusinessUrl: null })
  expect(repo.updateTenant).toHaveBeenCalledWith('t1', {
    googleBusinessUrl: null,
    googlePlaceId: null,
  })
})
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npx vitest run src/domains/iam/iam.service.test.ts -t "googlePlaceId"`
Expected: FAIL (service ainda não resolve/injeta o placeId).

- [ ] **Step 3: Implementar a resolução no service**

Em `src/domains/iam/iam.service.ts`, substituir o corpo de `updateTenant` por:

```ts
  async updateTenant(
    tenantId: string,
    data: {
      name?: string
      phone?: string | null
      address?: string | null
      bio?: string | null
      instagramUrl?: string | null
      coverImageUrl?: string | null
      whatsappContactEnabled?: boolean
      googleBusinessUrl?: string | null
      googlePlaceId?: string | null
    },
  ) {
    const payload = { ...data }
    if ('googleBusinessUrl' in data) {
      payload.googlePlaceId = data.googleBusinessUrl
        ? await resolveGooglePlaceId(data.googleBusinessUrl)
        : null
    }
    return iamRepository.updateTenant(tenantId, payload)
  }
```

Adicionar o import no topo do arquivo:

```ts
import { resolveGooglePlaceId } from '@/lib/google-places'
```

- [ ] **Step 4: Rodar testes e tsc**

Run: `npx vitest run src/domains/iam/iam.service.test.ts && npx tsc --noEmit`
Expected: PASS e zero erros.

- [ ] **Step 5: Commit**

```bash
git add src/domains/iam/iam.service.ts src/domains/iam/iam.service.test.ts
git commit -m "feat(iam): resolve googlePlaceId ao salvar o link do Google (gated)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Expor os campos na vitrine pública (repo + API + page)

**Files:**
- Modify: `src/domains/scheduling/public-booking.repository.ts:8-36` (select de `findTenantBySlug`)
- Modify: `src/app/api/public/[slug]/route.ts:18-38` (payload JSON)
- Test: existente (`npx tsc --noEmit` cobre o encadeamento de tipos)

**Interfaces:**
- Produces: `findTenantBySlug` retorna `whatsappContactEnabled`, `googleBusinessUrl`, `googlePlaceId`.
- Produces: API `/api/public/[slug]` inclui os três campos.

- [ ] **Step 1: Adicionar os campos ao select do repositório**

Em `src/domains/scheduling/public-booking.repository.ts`, no `select` de `findTenantBySlug` (após `whatsappEnabled: true`):

```ts
        whatsappContactEnabled: true,
        googleBusinessUrl: true,
        googlePlaceId: true,
```

- [ ] **Step 2: Expor no payload da API pública**

Em `src/app/api/public/[slug]/route.ts`, no objeto de `Response.json` (após `whatsappEnabled: tenant.whatsappEnabled,`):

```ts
      whatsappContactEnabled: tenant.whatsappContactEnabled,
      googleBusinessUrl: tenant.googleBusinessUrl,
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 4: Commit**

```bash
git add src/domains/scheduling/public-booking.repository.ts src/app/api/public/[slug]/route.ts
git commit -m "feat(vitrine): expõe campos de confiança na consulta pública

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Ícones de marca (Instagram gradiente + WhatsApp verde) e uso de whatsappContactEnabled

**Files:**
- Modify: `src/components/domain/vitrine/vitrine-icons.tsx:3-9` (`InstagramIcon`)
- Modify: `src/components/domain/vitrine/vitrine-hero.tsx` (props + render dos ícones + flag)
- Modify: `src/components/domain/vitrine/public-menu-drawer.tsx:34-35,196-197` (flag)
- Modify: `src/app/(public)/[slug]/page.tsx:47,70,146` (props + CTA fixo mobile)

**Interfaces:**
- Consumes: `whatsappContactEnabled` (Task 4).
- Produces: `<InstagramIcon variant="brand" />` renderiza o gradiente oficial; `VitrineHero` e
  `PublicMenuDrawer` passam a receber `whatsappContactEnabled?: boolean` em vez de `whatsappEnabled`.

- [ ] **Step 1: Mockup literal antes de codar (regra de UI)**

Apresentar no chat 2 variações em ASCII do destaque do Instagram/WhatsApp (glyph com gradiente circular vs. leve realce de fundo) e aguardar a escolha do usuário. Só então seguir para o Step 2. Implementar a variação escolhida.

- [ ] **Step 2: Instagram com gradiente**

Em `src/components/domain/vitrine/vitrine-icons.tsx`, substituir `InstagramIcon` por:

```tsx
export function InstagramIcon({ className, variant = 'mono' }: IconProps & { variant?: 'mono' | 'brand' }) {
  const gradId = 'ig-grad'
  return (
    <svg viewBox="0 0 24 24" className={className} fill={variant === 'brand' ? `url(#${gradId})` : 'currentColor'} aria-hidden="true">
      {variant === 'brand' && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#F58529" />
            <stop offset="35%" stopColor="#DD2A7B" />
            <stop offset="70%" stopColor="#8134AF" />
            <stop offset="100%" stopColor="#515BD4" />
          </linearGradient>
        </defs>
      )}
      <path d="M12 0C8.74 0 8.333.014 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.014 8.333 0 8.74 0 12s.014 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.986 8.74 24 12 24s3.667-.014 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.058-1.28.072-1.687.072-4.947s-.014-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.014 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.645-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z" />
    </svg>
  )
}
```

Atualizar o tipo `IconProps` no topo se necessário (já é `{ className?: string }`; o `variant` é adicionado inline).

- [ ] **Step 3: Aplicar marca e flag no VitrineHero**

Em `src/components/domain/vitrine/vitrine-hero.tsx`:
- No tipo `Props`, trocar `whatsappEnabled?: boolean` por `whatsappContactEnabled?: boolean`.
- Na desestruturação e no cálculo de `whatsappUrl` (linhas 81-82), usar `whatsappContactEnabled`.
- Nos 4 usos de `<InstagramIcon .../>`, passar `variant="brand"` e remover a classe de cor cinza
  (trocar `text-muted-foreground`/`text-white` por `text-current`, deixando o gradiente aparecer).
- Nos `<WhatsAppIcon .../>` de contato, usar a classe `text-[#25D366]` (no header sobre banner manter contraste com `text-white`).

- [ ] **Step 4: Aplicar flag no PublicMenuDrawer**

Em `src/components/domain/vitrine/public-menu-drawer.tsx`: renomear a prop `whatsappEnabled` para `whatsappContactEnabled` (tipo, desestruturação e uso na linha ~196).

- [ ] **Step 5: Encadear props em page.tsx**

Em `src/app/(public)/[slug]/page.tsx`:
- Linha 47 (`PublicMenuDrawer`) e 70 (`VitrineHero`): trocar `whatsappEnabled={tenant.whatsappEnabled}` por `whatsappContactEnabled={tenant.whatsappContactEnabled}`.
- CTA fixo mobile (linha 146): trocar a condição para `tenant.whatsappContactEnabled && tenant.phone`.

- [ ] **Step 6: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 7: Commit**

```bash
git add src/components/domain/vitrine/ "src/app/(public)/[slug]/page.tsx"
git commit -m "feat(vitrine): Instagram com gradiente de marca e contato WhatsApp desacoplado

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Centralizar contato e redes no form da Página pública

**Files:**
- Modify: `src/components/domain/settings/public-page-form.tsx`
- Modify: `src/app/(app)/configuracoes/page.tsx:50` (montagem do `initial`)
- Test: `src/components/domain/settings/public-page-form.test.tsx` (novo)

**Interfaces:**
- Consumes: API `PATCH /api/iam/tenant` (aceita `whatsappContactEnabled`, `googleBusinessUrl` — Task 1).
- Produces: form com toggle "Mostrar WhatsApp na página" e campo "Google Maps", enviados no `handleSave`.

- [ ] **Step 1: Escrever o teste que falha (render dos novos controles)**

Create `src/components/domain/settings/public-page-form.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PublicPageForm } from './public-page-form'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

it('mostra o toggle de WhatsApp e o campo do Google', () => {
  render(
    <PublicPageForm
      initial={{
        bio: null,
        instagramUrl: null,
        coverImageUrl: null,
        phone: '41999999999',
        whatsappContactEnabled: true,
        googleBusinessUrl: null,
      }}
    />,
  )
  expect(screen.getByText(/WhatsApp na página/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/Google Maps/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npx vitest run src/components/domain/settings/public-page-form.test.tsx`
Expected: FAIL (props e controles ainda não existem).

- [ ] **Step 3: Atualizar o `Props` e o estado do form**

Em `src/components/domain/settings/public-page-form.tsx`, no tipo `Props.initial`, trocar
`whatsappEnabled: boolean` (se houver) e adicionar:

```ts
    whatsappContactEnabled: boolean
    googleBusinessUrl: string | null
```

E no componente:

```ts
  const [whatsappOn, setWhatsappOn] = useState(initial.whatsappContactEnabled)
  const [googleUrl, setGoogleUrl] = useState(initial.googleBusinessUrl ?? '')
```

- [ ] **Step 4: Enviar os novos campos no handleSave**

No `body` do `fetch` PATCH em `handleSave`, adicionar:

```ts
          whatsappContactEnabled: whatsappOn,
          googleBusinessUrl: googleUrl || null,
```

- [ ] **Step 5: Substituir o preview readonly do WhatsApp por um toggle**

Trocar o bloco "WhatsApp — preview readonly" por um toggle dentro de uma subseção "Contato e redes"
(agrupando Instagram + WhatsApp + Google). O toggle usa o `Switch` do Shadcn
(`@/components/ui/switch`), com o preview `wa.me/55<phone>` como descrição:

```tsx
      {initial.phone && (
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <Label htmlFor="wa-toggle">Mostrar WhatsApp na página</Label>
            <p className="text-xs text-muted-foreground">
              Botão de contato via {`wa.me/55${initial.phone.replace(/\D/g, '')}`}
            </p>
          </div>
          <Switch id="wa-toggle" checked={whatsappOn} onCheckedChange={setWhatsappOn} />
        </div>
      )}
```

- [ ] **Step 6: Adicionar o campo do Google**

Após o campo do Instagram:

```tsx
      <div className="space-y-1.5">
        <Label htmlFor="pub-google" className="flex items-center gap-1.5">
          <MapPin className="size-3.5" />
          Google Maps
        </Label>
        <Input
          id="pub-google"
          type="url"
          placeholder="https://www.google.com/maps/place/seu-negocio"
          value={googleUrl}
          onChange={(e) => setGoogleUrl(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Cole o link do seu perfil no Google Maps para exibir o botão &quot;Ver no Google&quot;.
        </p>
      </div>
```

Adicionar aos imports: `MapPin` de `lucide-react` e `Switch` de `@/components/ui/switch`.

- [ ] **Step 7: Passar os novos campos em configuracoes/page.tsx**

Em `src/app/(app)/configuracoes/page.tsx`, onde `tenantPublicInfo`/`initial` é montado (perto da linha 50),
incluir `whatsappContactEnabled` e `googleBusinessUrl` a partir do tenant carregado.

- [ ] **Step 8: Rodar testes e tsc**

Run: `npx vitest run src/components/domain/settings/public-page-form.test.tsx && npx tsc --noEmit`
Expected: PASS e zero erros.

- [ ] **Step 9: Commit**

```bash
git add src/components/domain/settings/public-page-form.tsx src/components/domain/settings/public-page-form.test.tsx "src/app/(app)/configuracoes/page.tsx"
git commit -m "feat(settings): centraliza contato e redes (WhatsApp toggle + Google) na Página pública

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Card de Localização (mapa + rota + Ver no Google + selo) na vitrine

**Files:**
- Modify: `src/components/domain/vitrine/vitrine-location-block.tsx`
- Modify: `src/app/(public)/[slug]/page.tsx:88` (buscar rating + passar props)
- Test: `src/components/domain/vitrine/vitrine-location-block.test.tsx` (novo)

**Interfaces:**
- Consumes: `fetchGoogleRating` (Task 2), `tenant.googleBusinessUrl`, `tenant.googlePlaceId`, `openRoute`.
- Produces: `<VitrineLocationBlock address googleBusinessUrl googleRating primaryColor />` onde
  `googleRating?: { rating: number; userRatingCount: number } | null`.

- [ ] **Step 1: Escrever o teste que falha**

Create `src/components/domain/vitrine/vitrine-location-block.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VitrineLocationBlock } from './vitrine-location-block'

vi.mock('@/lib/maps-route', () => ({ openRoute: vi.fn() }))

it('mostra mapa, rota e "Ver no Google" quando há link; selo com rating', () => {
  render(
    <VitrineLocationBlock
      address="Rua Guarapuava, 20, Colombo, PR"
      googleBusinessUrl="https://www.google.com/maps/place/X"
      googleRating={{ rating: 4.8, userRatingCount: 214 }}
      primaryColor="#a855f7"
    />,
  )
  expect(screen.getByTitle(/mapa/i)).toBeInTheDocument()
  expect(screen.getByText(/Rota/i)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Ver no Google/i })).toBeInTheDocument()
  expect(screen.getByText(/4,8/)).toBeInTheDocument()
  expect(screen.getByText(/214/)).toBeInTheDocument()
})

it('sem link do Google não renderiza "Ver no Google" nem selo', () => {
  render(<VitrineLocationBlock address="Rua X, 1" googleBusinessUrl={null} googleRating={null} primaryColor="#000" />)
  expect(screen.queryByRole('link', { name: /Ver no Google/i })).toBeNull()
})
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npx vitest run src/components/domain/vitrine/vitrine-location-block.test.tsx`
Expected: FAIL (props e elementos ainda não existem).

- [ ] **Step 3: Reescrever o componente**

Substituir `src/components/domain/vitrine/vitrine-location-block.tsx` por:

```tsx
'use client'

import { MapPin, Star } from 'lucide-react'
import { openRoute } from '@/lib/maps-route'

type Props = {
  address: string
  primaryColor: string
  googleBusinessUrl?: string | null
  googleRating?: { rating: number; userRatingCount: number } | null
}

export function VitrineLocationBlock({ address, primaryColor, googleBusinessUrl, googleRating }: Props) {
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`

  return (
    <div className="mx-auto mt-4 w-full max-w-3xl px-4">
      <div className="overflow-hidden rounded-2xl border">
        <iframe
          title={`Mapa de ${address}`}
          src={mapSrc}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="h-40 w-full border-0"
        />
        <div className="flex items-center gap-3 px-4 py-3">
          <MapPin className="size-4 shrink-0" style={{ color: primaryColor }} />
          <span className="min-w-0 flex-1 truncate text-sm">{address}</span>
          <button
            onClick={() => openRoute(address)}
            className="shrink-0 text-xs font-bold"
            style={{ color: primaryColor }}
          >
            Rota ›
          </button>
        </div>
        {(googleBusinessUrl || googleRating) && (
          <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
            {googleRating ? (
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Star className="size-4 fill-amber-400 text-amber-400" />
                {googleRating.rating.toFixed(1).replace('.', ',')}
                <span className="text-muted-foreground">
                  · {googleRating.userRatingCount} avaliações
                </span>
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Avaliações no Google</span>
            )}
            {googleBusinessUrl && (
              <a
                href={googleBusinessUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-xs font-bold"
                style={{ color: primaryColor }}
              >
                Ver no Google ↗
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Buscar rating e passar props em page.tsx**

Em `src/app/(public)/[slug]/page.tsx`:
- Perto do topo do componente (após obter `tenant`), adicionar:

```ts
  const googleRating = tenant.googlePlaceId ? await fetchGoogleRating(tenant.googlePlaceId) : null
```

- Import: `import { fetchGoogleRating } from '@/lib/google-places'`.
- Na linha 88, substituir por:

```tsx
      {tenant.address && (
        <VitrineLocationBlock
          address={tenant.address}
          primaryColor={primary}
          googleBusinessUrl={tenant.googleBusinessUrl}
          googleRating={googleRating}
        />
      )}
```

- [ ] **Step 5: Rodar testes e tsc**

Run: `npx vitest run src/components/domain/vitrine/vitrine-location-block.test.tsx && npx tsc --noEmit`
Expected: PASS e zero erros.

- [ ] **Step 6: Commit**

```bash
git add src/components/domain/vitrine/vitrine-location-block.tsx src/components/domain/vitrine/vitrine-location-block.test.tsx "src/app/(public)/[slug]/page.tsx"
git commit -m "feat(vitrine): card de localização com mapa, rota, Ver no Google e selo de nota (gated)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Portal /cliente — WhatsApp desacoplado + card de localização

**Files:**
- Modify: `src/app/(public)/[slug]/cliente/page.tsx:78-79,88+` (whatsappUrl via flag + rating + props)
- Modify: `src/app/(public)/[slug]/cliente/customer-history-client.tsx` (renderizar `<VitrineLocationBlock>`)
- Test: `src/app/(public)/[slug]/cliente/customer-history-client.test.tsx` (ajuste)

**Interfaces:**
- Consumes: `VitrineLocationBlock` (Task 7), `fetchGoogleRating` (Task 2), `whatsappContactEnabled`,
  `googleBusinessUrl`, `googlePlaceId`.
- Produces: portal do cliente com o mesmo card de localização e contato WhatsApp coerente com a vitrine.

- [ ] **Step 1: Derivar whatsappUrl e rating do novo modelo em page.tsx**

Em `src/app/(public)/[slug]/cliente/page.tsx`:
- Linha 78-79: trocar `tenant.whatsappEnabled` por `tenant.whatsappContactEnabled` no cálculo de `whatsappUrl`.
- Adicionar:

```ts
  const googleRating = tenant.googlePlaceId ? await fetchGoogleRating(tenant.googlePlaceId) : null
```

com `import { fetchGoogleRating } from '@/lib/google-places'`.
- Passar ao componente cliente as novas props `googleBusinessUrl={tenant.googleBusinessUrl}` e `googleRating={googleRating}` (além das já existentes `business`/`primaryColor`).

- [ ] **Step 2: Renderizar o card no customer-history-client**

Em `src/app/(public)/[slug]/cliente/customer-history-client.tsx`:
- Estender `Props` com `googleBusinessUrl: string | null` e `googleRating: { rating: number; userRatingCount: number } | null`.
- Dentro da seção "Informações do negócio", quando houver `business.address`, renderizar
  `<VitrineLocationBlock address={business.address} primaryColor={primaryColor} googleBusinessUrl={googleBusinessUrl} googleRating={googleRating} />`
  no lugar (ou acima) do botão de rota atual, mantendo o bloco de horários.
- Import: `import { VitrineLocationBlock } from '@/components/domain/vitrine/vitrine-location-block'`.

- [ ] **Step 3: Ajustar o teste existente do portal**

Em `src/app/(public)/[slug]/cliente/customer-history-client.test.tsx`, adicionar as novas props
obrigatórias (`googleBusinessUrl: null`, `googleRating: null`) nos renders existentes para manter o verde,
e um caso: com `googleBusinessUrl` preenchido, aparece o link "Ver no Google".

- [ ] **Step 4: Rodar testes e tsc**

Run: `npx vitest run src/app/\(public\)/\[slug\]/cliente/customer-history-client.test.tsx && npx tsc --noEmit`
Expected: PASS e zero erros.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(public)/[slug]/cliente/"
git commit -m "feat(portal): localização com mapa/Google e WhatsApp desacoplado no portal do cliente

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: Fechamento — suíte completa, tsc, docs, PR

**Files:**
- Modify: `.env.example` (documentar `GOOGLE_PLACES_API_KEY`)
- Modify: `CLAUDE.md` (linha do domínio Vitrine/Portal — refletir contato desacoplado + Google)

- [ ] **Step 1: Documentar a env var**

Em `.env.example`, adicionar (seção de integrações):

```
# Google Places (opcional) — habilita selo de nota e resolução do link do Maps.
# Sem esta chave, a página do cliente mostra apenas mapa/rota/Ver no Google.
GOOGLE_PLACES_API_KEY=
```

- [ ] **Step 2: Atualizar o status na CLAUDE.md**

Na tabela de domínios, atualizar as linhas de **Vitrine pública** e **Portal do cliente** citando:
contato WhatsApp desacoplado da automação (`whatsappContactEnabled`), Instagram com cor de marca,
card de localização com mapa embutido + "Ver no Google" e selo de nota gated por `GOOGLE_PLACES_API_KEY`.

- [ ] **Step 3: Rodar a suíte completa e o typecheck**

Run: `npx tsc --noEmit && npx vitest run`
Expected: zero erros de tipo e todos os testes verdes.

- [ ] **Step 4: Commit da documentação**

```bash
git add .env.example CLAUDE.md
git commit -m "docs: documenta GOOGLE_PLACES_API_KEY e atualiza status da vitrine/portal

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 5: Abrir o PR para main**

```bash
git push -u origin feat/pagina-cliente-confianca
gh pr create --base main --title "feat: confiança na página do cliente (WhatsApp, Instagram, Google)" --body "Ver spec em docs/superpowers/specs/2026-07-01-pagina-cliente-confianca-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Notas de execução

- **Segurança:** rodar o Security Agent antes do PR — nenhum item 🔴 crítico. Pontos de atenção:
  a env `GOOGLE_PLACES_API_KEY` só é usada server-side (nunca exposta ao cliente); `googleBusinessUrl`
  é validado por Zod contra domínios do Google; `googlePlaceId` nunca vem do body.
- **Mobile-first:** o card de localização e os controles do form devem passar pelo checklist do
  `agent-mobile` (iframe responsivo `w-full`, toggle acessível, alvos de toque ≥ 40px).
- **Display policy do Google:** o selo mostra apenas nota + contagem, com o botão "Ver no Google"
  levando à fonte; sem armazenar textos de avaliações.
