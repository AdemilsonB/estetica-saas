# Ativação Guiada Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guiar o dono do salão recém-cadastrado a completar os cadastros essenciais (categorias → serviços → clientes → equipe/cargos → configurações) através de bolinhas de pendência âmbar, um card de progresso na Agenda, cadastro inline de categoria/cliente, descoberta de cargos e confirmações de exclusão padronizadas.

**Architecture:** Um módulo read-only `src/domains/activation/` calcula o status de ativação on-the-fly (contagens + campos do Tenant/BrandingConfig, sem novo campo no banco) e o expõe em `GET /api/activation/status`, consumido pelo hook `useActivationStatus`. Esse status alimenta tanto as bolinhas de menu/cards de Configurações quanto o card de progresso da Agenda. Os cadastros inline e a descoberta de cargos reusam componentes/endpoints já existentes; as confirmações de exclusão migram de `window.confirm()` para `AlertDialog`.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Prisma, TailwindCSS, Zod, vitest

## Global Constraints

Copiadas de `CLAUDE.md` (raiz) — não-negociáveis em todas as tasks:

- **Idioma:** todo output em Português do Brasil — código, comentários, mensagens de commit, logs, nomes de branch, respostas.
- **Multi-tenancy:** todo model Prisma de negócio tem `tenantId: String`; todo repository filtra por `tenantId` em TODAS as queries; `tenantId` é sempre extraído do token de sessão (`getSessionContext`) — NUNCA do body ou URL; índice `@@index([tenantId])` em toda tabela de negócio.
- **Arquitetura em camadas:** API Route (controller fino, valida input com Zod) → Service (regras de negócio) → Repository (acesso a dados, filtra tenantId) → Prisma Client.
- **Eventos entre domínios:** domínios NÃO se importam diretamente; comunicação via `eventBus.publish()` de `src/shared/events/` quando cruzar domínio.
- **Erros:** sempre usar erros de domínio tipados de `src/shared/errors/`; NUNCA `throw new Error('string genérica')`; NUNCA retornar `{ error: 'string' }` sem código tipado.
- **TypeScript:** strict mode — sem `any`, sem `as unknown as` (exceto o padrão de mock de prisma nos testes, já usado no projeto).
- **Zod:** validação de input em toda API Route; schemas em `domains/[dominio]/schemas.ts` (ou `types.ts` quando o domínio já concentra os schemas lá) — nunca duplicados no frontend.
- **Sem `console.log`** em produção (usar logger estruturado se necessário).
- **NUNCA** colocar lógica de negócio em componentes React; NUNCA fazer queries diretas ao banco em API Routes (sempre via repository); NUNCA acoplar domínios diretamente; NUNCA hardcodar IDs/roles/strings mágicas sem constante.
- **Todo componente de UI** precisa de loading state, error state e empty state, e deve passar pelo checklist mobile-first (`.claude/skills/agent-mobile.md`).

### Checklist mobile-first (de `.claude/skills/agent-mobile.md`) — aplicar a todo componente novo/alterado

- Layout funciona em 375px e 390px de largura, sem overflow horizontal em nenhum breakpoint.
- Touch targets mínimo 44×44px; espaçamento mínimo 8px entre elementos clicáveis.
- Campos de formulário com `type` correto (`tel`, `email`, `number`, `date`, `time`); `font-size` mínimo 16px em inputs (evita zoom no iOS).
- Sem interações hover-only (mobile não tem hover) — bolinha/estado precisa aparecer sem hover.
- Classes Tailwind sempre mobile-first: base → `md:` → `lg:` (nunca desktop-first).
- Loading states em todas as ações assíncronas.

### Gate de verificação (rodar antes de cada commit)

```bash
npx tsc --noEmit          # zero erros
npx vitest run            # todos os testes passando
```

### Convenção de commits (de `.claude/BRANCHING.md`)

Conventional Commits: `<tipo>(<escopo>): <descrição>` — tipos: `feat`, `fix`, `refactor`, `chore`, `test`, `docs`. Rodapé de co-autoria conforme padrão do projeto.

---

### Task 1: Branch, tipos e função pura `computeActivationStatus`

**Files:**
- Create: `src/domains/activation/types.ts`
- Create: `src/domains/activation/activation.compute.ts`
- Test: `src/domains/activation/activation.compute.test.ts`

**Interfaces:**
- Consumes: nada (primeira task)
- Produces: tipos `ActivationConfigStatus`, `ActivationStatus`, `ActivationCounts`; função `computeActivationStatus(counts: ActivationCounts): ActivationStatus`

- [ ] **Step 0: Criar a branch a partir de `main` atualizada**

```bash
git checkout main
git pull origin main
git checkout -b feat/ativacao-guiada
```

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/domains/activation/activation.compute.test.ts
import { describe, it, expect } from 'vitest'
import { computeActivationStatus } from './activation.compute'
import type { ActivationCounts } from './types'

function baseCounts(overrides: Partial<ActivationCounts> = {}): ActivationCounts {
  return {
    activeCategoryCount: 0,
    activeServiceCount: 0,
    activeCustomerCount: 0,
    customRoleCount: 0,
    tenant: {
      phone: null,
      address: null,
      businessHours: null,
      evolutionConnected: false,
    },
    logoUrl: null,
    ...overrides,
  }
}

describe('computeActivationStatus', () => {
  it('marca tudo como pendente (false) quando o tenant está vazio', () => {
    const status = computeActivationStatus(baseCounts())
    expect(status.categorias).toBe(false)
    expect(status.servicos).toBe(false)
    expect(status.clientes).toBe(false)
    expect(status.equipe).toBe(false)
    expect(status.configuracoes.done).toBe(false)
    expect(status.configuracoes.dadosNegocio).toBe(false)
    expect(status.configuracoes.horarios).toBe(false)
    expect(status.configuracoes.branding).toBe(false)
    expect(status.configuracoes.whatsapp).toBe(false)
  })

  it('marca categorias/servicos/clientes/equipe como concluídos quando há contagem > 0', () => {
    const status = computeActivationStatus(
      baseCounts({
        activeCategoryCount: 2,
        activeServiceCount: 5,
        activeCustomerCount: 1,
        customRoleCount: 1,
      }),
    )
    expect(status.categorias).toBe(true)
    expect(status.servicos).toBe(true)
    expect(status.clientes).toBe(true)
    expect(status.equipe).toBe(true)
  })

  it('só marca configuracoes.done quando dados, horários, branding e whatsapp estão completos', () => {
    const status = computeActivationStatus(
      baseCounts({
        tenant: {
          phone: '41999999999',
          address: 'Rua X, 100',
          businessHours: { seg: { open: '09:00', close: '18:00' } },
          evolutionConnected: true,
        },
        logoUrl: 'https://cdn/logo.png',
      }),
    )
    expect(status.configuracoes.dadosNegocio).toBe(true)
    expect(status.configuracoes.horarios).toBe(true)
    expect(status.configuracoes.branding).toBe(true)
    expect(status.configuracoes.whatsapp).toBe(true)
    expect(status.configuracoes.done).toBe(true)
  })

  it('mantém configuracoes.done=false se apenas o whatsapp estiver desconectado', () => {
    const status = computeActivationStatus(
      baseCounts({
        tenant: {
          phone: '41999999999',
          address: 'Rua X, 100',
          businessHours: { seg: {} },
          evolutionConnected: false,
        },
        logoUrl: 'https://cdn/logo.png',
      }),
    )
    expect(status.configuracoes.dadosNegocio).toBe(true)
    expect(status.configuracoes.whatsapp).toBe(false)
    expect(status.configuracoes.done).toBe(false)
  })

  it('trata strings em branco como ausentes (phone/address/logo)', () => {
    const status = computeActivationStatus(
      baseCounts({
        tenant: { phone: '   ', address: '', businessHours: { seg: {} }, evolutionConnected: true },
        logoUrl: '   ',
      }),
    )
    expect(status.configuracoes.dadosNegocio).toBe(false)
    expect(status.configuracoes.branding).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/domains/activation/activation.compute.test.ts`
Expected: FAIL — módulos `./activation.compute` e `./types` ainda não existem (erro de import/resolução).

- [ ] **Step 3: Implementação mínima**

```ts
// src/domains/activation/types.ts

/** Detalhe do status da seção Configurações (usado nas bolinhas por card). */
export interface ActivationConfigStatus {
  /** phone + address preenchidos */
  dadosNegocio: boolean
  /** businessHours preenchido */
  horarios: boolean
  /** logoUrl (BrandingConfig) preenchido */
  branding: boolean
  /** WhatsApp (Evolution) conectado */
  whatsapp: boolean
  /** true quando todos os 4 acima estão concluídos */
  done: boolean
}

/** Status de ativação por módulo. `true` = concluído; `false` = pendente. */
export interface ActivationStatus {
  categorias: boolean
  servicos: boolean
  clientes: boolean
  equipe: boolean
  configuracoes: ActivationConfigStatus
}

/** Dados brutos lidos do banco para calcular o status (sem regra de negócio). */
export interface ActivationCounts {
  activeCategoryCount: number
  activeServiceCount: number
  activeCustomerCount: number
  customRoleCount: number
  tenant: {
    phone: string | null
    address: string | null
    businessHours: unknown | null
    evolutionConnected: boolean
  }
  logoUrl: string | null
}
```

```ts
// src/domains/activation/activation.compute.ts
import type { ActivationCounts, ActivationStatus } from './types'

function filled(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Calcula o status de ativação a partir das contagens/dados brutos.
 * Função pura — sem acesso a banco, sem efeitos colaterais.
 */
export function computeActivationStatus(counts: ActivationCounts): ActivationStatus {
  const dadosNegocio = filled(counts.tenant.phone) && filled(counts.tenant.address)
  const horarios = counts.tenant.businessHours != null
  const branding = filled(counts.logoUrl)
  const whatsapp = counts.tenant.evolutionConnected === true

  return {
    categorias: counts.activeCategoryCount > 0,
    servicos: counts.activeServiceCount > 0,
    clientes: counts.activeCustomerCount > 0,
    equipe: counts.customRoleCount > 0,
    configuracoes: {
      dadosNegocio,
      horarios,
      branding,
      whatsapp,
      done: dadosNegocio && horarios && branding && whatsapp,
    },
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/domains/activation/activation.compute.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domains/activation/types.ts src/domains/activation/activation.compute.ts src/domains/activation/activation.compute.test.ts
git commit -m "feat(activation): tipos e cálculo puro do status de ativação guiada"
```

---

### Task 2: Repository de contagens `activationRepository.getActivationCounts`

**Files:**
- Create: `src/domains/activation/activation.repository.ts`
- Test: `src/domains/activation/activation.repository.test.ts`

**Interfaces:**
- Consumes: `ActivationCounts` de `src/domains/activation/types.ts`
- Produces: `activationRepository` com `getActivationCounts(tenantId: string): Promise<ActivationCounts>`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/domains/activation/activation.repository.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/shared/database/prisma'
import { activationRepository } from './activation.repository'

// O setup global mocka '@/shared/database/prisma' como {}. Injetamos os métodos aqui.
const prismaMock = prisma as unknown as {
  serviceCategory: { count: ReturnType<typeof vi.fn> }
  service: { count: ReturnType<typeof vi.fn> }
  customer: { count: ReturnType<typeof vi.fn> }
  role: { count: ReturnType<typeof vi.fn> }
  tenant: { findUnique: ReturnType<typeof vi.fn> }
  brandingConfig: { findUnique: ReturnType<typeof vi.fn> }
}

beforeEach(() => {
  prismaMock.serviceCategory = { count: vi.fn().mockResolvedValue(2) }
  prismaMock.service = { count: vi.fn().mockResolvedValue(3) }
  prismaMock.customer = { count: vi.fn().mockResolvedValue(0) }
  prismaMock.role = { count: vi.fn().mockResolvedValue(1) }
  prismaMock.tenant = {
    findUnique: vi.fn().mockResolvedValue({
      phone: '41999999999',
      address: 'Rua X',
      businessHours: { seg: {} },
      evolutionConnected: true,
    }),
  }
  prismaMock.brandingConfig = {
    findUnique: vi.fn().mockResolvedValue({ logoUrl: 'https://cdn/logo.png' }),
  }
})

describe('activationRepository.getActivationCounts', () => {
  it('filtra todas as contagens por tenantId com os critérios corretos', async () => {
    await activationRepository.getActivationCounts('t1')

    expect(prismaMock.serviceCategory.count).toHaveBeenCalledWith({ where: { tenantId: 't1', active: true } })
    expect(prismaMock.service.count).toHaveBeenCalledWith({ where: { tenantId: 't1', active: true } })
    expect(prismaMock.customer.count).toHaveBeenCalledWith({ where: { tenantId: 't1', deletedAt: null } })
    expect(prismaMock.role.count).toHaveBeenCalledWith({ where: { tenantId: 't1', isDefault: false } })
    expect(prismaMock.tenant.findUnique).toHaveBeenCalledWith({
      where: { id: 't1' },
      select: { phone: true, address: true, businessHours: true, evolutionConnected: true },
    })
    expect(prismaMock.brandingConfig.findUnique).toHaveBeenCalledWith({
      where: { tenantId: 't1' },
      select: { logoUrl: true },
    })
  })

  it('mapeia o resultado para ActivationCounts', async () => {
    const counts = await activationRepository.getActivationCounts('t1')
    expect(counts).toEqual({
      activeCategoryCount: 2,
      activeServiceCount: 3,
      activeCustomerCount: 0,
      customRoleCount: 1,
      tenant: {
        phone: '41999999999',
        address: 'Rua X',
        businessHours: { seg: {} },
        evolutionConnected: true,
      },
      logoUrl: 'https://cdn/logo.png',
    })
  })

  it('usa defaults seguros quando tenant/branding não existem', async () => {
    prismaMock.tenant.findUnique = vi.fn().mockResolvedValue(null)
    prismaMock.brandingConfig.findUnique = vi.fn().mockResolvedValue(null)

    const counts = await activationRepository.getActivationCounts('t1')
    expect(counts.tenant).toEqual({
      phone: null,
      address: null,
      businessHours: null,
      evolutionConnected: false,
    })
    expect(counts.logoUrl).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/domains/activation/activation.repository.test.ts`
Expected: FAIL — `./activation.repository` ainda não existe.

- [ ] **Step 3: Implementação mínima**

```ts
// src/domains/activation/activation.repository.ts
import { prisma } from '@/shared/database/prisma'
import type { ActivationCounts } from './types'

export class ActivationRepository {
  async getActivationCounts(tenantId: string): Promise<ActivationCounts> {
    const [
      activeCategoryCount,
      activeServiceCount,
      activeCustomerCount,
      customRoleCount,
      tenant,
      branding,
    ] = await Promise.all([
      prisma.serviceCategory.count({ where: { tenantId, active: true } }),
      prisma.service.count({ where: { tenantId, active: true } }),
      prisma.customer.count({ where: { tenantId, deletedAt: null } }),
      prisma.role.count({ where: { tenantId, isDefault: false } }),
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { phone: true, address: true, businessHours: true, evolutionConnected: true },
      }),
      prisma.brandingConfig.findUnique({
        where: { tenantId },
        select: { logoUrl: true },
      }),
    ])

    return {
      activeCategoryCount,
      activeServiceCount,
      activeCustomerCount,
      customRoleCount,
      tenant: {
        phone: tenant?.phone ?? null,
        address: tenant?.address ?? null,
        businessHours: tenant?.businessHours ?? null,
        evolutionConnected: tenant?.evolutionConnected ?? false,
      },
      logoUrl: branding?.logoUrl ?? null,
    }
  }
}

export const activationRepository = new ActivationRepository()
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/domains/activation/activation.repository.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domains/activation/activation.repository.ts src/domains/activation/activation.repository.test.ts
git commit -m "feat(activation): repository de contagens filtrado por tenant"
```

---

### Task 3: Service + API Route `GET /api/activation/status`

**Files:**
- Create: `src/domains/activation/activation.service.ts`
- Create: `src/app/api/activation/status/route.ts`
- Test: `src/app/api/activation/status/route.test.ts`

**Interfaces:**
- Consumes: `activationRepository.getActivationCounts`, `computeActivationStatus`, `ActivationStatus`
- Produces: `activationService.getStatus(tenantId: string): Promise<ActivationStatus>`; endpoint `GET /api/activation/status` retornando `ActivationStatus` em JSON

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/app/api/activation/status/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getSessionContext = vi.fn()
vi.mock('@/shared/auth/session', () => ({ getSessionContext: (...a: unknown[]) => getSessionContext(...a) }))
vi.mock('@/app/api/_lib/runtime', () => ({ initializeDomainRuntime: () => {} }))

const getStatus = vi.fn()
vi.mock('@/domains/activation/activation.service', () => ({
  activationService: { getStatus: (...a: unknown[]) => getStatus(...a) },
}))

import { GET } from './route'

describe('GET /api/activation/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna 200 com o status do tenant da sessão', async () => {
    getSessionContext.mockResolvedValue({ tenantId: 't1', userId: 'u1', isOwner: true, permissions: {} })
    getStatus.mockResolvedValue({
      categorias: false,
      servicos: false,
      clientes: false,
      equipe: false,
      configuracoes: { dadosNegocio: false, horarios: false, branding: false, whatsapp: false, done: false },
    })

    const res = await GET(new Request('http://x/api/activation/status'))

    expect(res.status).toBe(200)
    expect(getStatus).toHaveBeenCalledWith('t1')
    const body = await res.json()
    expect(body.configuracoes.done).toBe(false)
  })

  it('retorna 401 quando a sessão é inválida', async () => {
    const { UnauthorizedError } = await import('@/shared/errors')
    getSessionContext.mockRejectedValue(new UnauthorizedError('sem sessão'))

    const res = await GET(new Request('http://x/api/activation/status'))

    expect(res.status).toBe(401)
    expect(getStatus).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/app/api/activation/status/route.test.ts`
Expected: FAIL — `./route` e `activation.service` ainda não existem.

- [ ] **Step 3: Implementação mínima**

```ts
// src/domains/activation/activation.service.ts
import { activationRepository } from './activation.repository'
import { computeActivationStatus } from './activation.compute'
import type { ActivationStatus } from './types'

export class ActivationService {
  async getStatus(tenantId: string): Promise<ActivationStatus> {
    const counts = await activationRepository.getActivationCounts(tenantId)
    return computeActivationStatus(counts)
  }
}

export const activationService = new ActivationService()
```

```ts
// src/app/api/activation/status/route.ts
import { activationService } from '@/domains/activation/activation.service'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    const status = await activationService.getStatus(session.tenantId)
    return Response.json(status)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/app/api/activation/status/route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domains/activation/activation.service.ts src/app/api/activation/status/route.ts src/app/api/activation/status/route.test.ts
git commit -m "feat(activation): service e endpoint GET /api/activation/status"
```

---

### Task 4: Hook `useActivationStatus`

**Files:**
- Create: `src/hooks/activation/use-activation-status.ts`
- Test: `src/hooks/activation/use-activation-status.test.tsx`

**Interfaces:**
- Consumes: `ActivationStatus` de `src/domains/activation/types.ts`
- Produces: `useActivationStatus()` — retorna `UseQueryResult<ActivationStatus>` (chave de cache `['activation-status']`)

- [ ] **Step 1: Escrever o teste que falha**

```tsx
// @vitest-environment jsdom
// src/hooks/activation/use-activation-status.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useActivationStatus } from './use-activation-status'

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useActivationStatus', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          categorias: true,
          servicos: false,
          clientes: false,
          equipe: false,
          configuracoes: { dadosNegocio: false, horarios: false, branding: false, whatsapp: false, done: false },
        }),
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('busca /api/activation/status e devolve os dados', async () => {
    const { result } = renderHook(() => useActivationStatus(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(global.fetch).toHaveBeenCalledWith('/api/activation/status')
    expect(result.current.data?.categorias).toBe(true)
    expect(result.current.data?.servicos).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/hooks/activation/use-activation-status.test.tsx`
Expected: FAIL — `./use-activation-status` ainda não existe.

- [ ] **Step 3: Implementação mínima**

```ts
// src/hooks/activation/use-activation-status.ts
import { useQuery } from '@tanstack/react-query'
import type { ActivationStatus } from '@/domains/activation/types'

async function fetchActivationStatus(): Promise<ActivationStatus> {
  const res = await fetch('/api/activation/status')
  if (!res.ok) throw new Error('Falha ao carregar status de ativação')
  return res.json()
}

export function useActivationStatus() {
  return useQuery({
    queryKey: ['activation-status'],
    queryFn: fetchActivationStatus,
    staleTime: 60 * 1000,
  })
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/hooks/activation/use-activation-status.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/activation/use-activation-status.ts src/hooks/activation/use-activation-status.test.tsx
git commit -m "feat(activation): hook useActivationStatus"
```

---

### Task 5: Helper `isSectionPending` + bolinha âmbar nos itens de menu

**Files:**
- Create: `src/components/app/activation-badges.ts`
- Test: `src/components/app/activation-badges.test.ts`
- Modify: `src/components/app/app-shell.tsx` (linhas 24, 56-57, 188-198, 284-295, 300-311)

**Interfaces:**
- Consumes: `ActivationStatus` de `src/domains/activation/types.ts`; `useActivationStatus` de `src/hooks/activation/use-activation-status`
- Produces: `isSectionPending(status: ActivationStatus | undefined, key: string): boolean`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/components/app/activation-badges.test.ts
import { describe, it, expect } from 'vitest'
import { isSectionPending } from './activation-badges'
import type { ActivationStatus } from '@/domains/activation/types'

function status(overrides: Partial<ActivationStatus> = {}): ActivationStatus {
  return {
    categorias: true,
    servicos: true,
    clientes: true,
    equipe: true,
    configuracoes: { dadosNegocio: true, horarios: true, branding: true, whatsapp: true, done: true },
    ...overrides,
  }
}

describe('isSectionPending', () => {
  it('retorna false quando o status ainda não carregou', () => {
    expect(isSectionPending(undefined, 'servicos')).toBe(false)
  })

  it('Serviços fica pendente se categorias OU serviços estiverem pendentes', () => {
    expect(isSectionPending(status({ categorias: false }), 'servicos')).toBe(true)
    expect(isSectionPending(status({ servicos: false }), 'servicos')).toBe(true)
    expect(isSectionPending(status(), 'servicos')).toBe(false)
  })

  it('Clientes/Equipe refletem seus próprios critérios', () => {
    expect(isSectionPending(status({ clientes: false }), 'clientes')).toBe(true)
    expect(isSectionPending(status({ equipe: false }), 'equipe')).toBe(true)
    expect(isSectionPending(status(), 'clientes')).toBe(false)
  })

  it('Configurações usa configuracoes.done', () => {
    const s = status()
    s.configuracoes.whatsapp = false
    s.configuracoes.done = false
    expect(isSectionPending(s, 'configuracoes')).toBe(true)
  })

  it('seções sem critério de ativação nunca ficam pendentes', () => {
    expect(isSectionPending(status({ servicos: false }), 'agenda')).toBe(false)
    expect(isSectionPending(status({ servicos: false }), 'financeiro')).toBe(false)
    expect(isSectionPending(status({ servicos: false }), 'produtos')).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/components/app/activation-badges.test.ts`
Expected: FAIL — `./activation-badges` ainda não existe.

- [ ] **Step 3: Implementação mínima**

```ts
// src/components/app/activation-badges.ts
import type { ActivationStatus } from '@/domains/activation/types'

/**
 * Diz se o item de menu identificado por `key` deve exibir a bolinha âmbar de pendência.
 * Categorias vive dentro da página de Serviços — por isso "servicos" agrega os dois critérios.
 */
export function isSectionPending(status: ActivationStatus | undefined, key: string): boolean {
  if (!status) return false
  switch (key) {
    case 'servicos':
      return !status.categorias || !status.servicos
    case 'clientes':
      return !status.clientes
    case 'equipe':
      return !status.equipe
    case 'configuracoes':
      return !status.configuracoes.done
    default:
      return false
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/components/app/activation-badges.test.ts`
Expected: PASS

- [ ] **Step 5: Wire no `app-shell.tsx` (bolinha âmbar dirigida por ativação)**

Editar `src/components/app/app-shell.tsx`:

1. Substituir o import de `useEvolutionStatus` (linha 24) por dois imports:

```tsx
// REMOVER:
import { useEvolutionStatus } from '@/hooks/settings/use-evolution-status'
// ADICIONAR:
import { useActivationStatus } from '@/hooks/activation/use-activation-status'
import { isSectionPending } from '@/components/app/activation-badges'
```

2. Substituir as linhas 56-57 (status Evolution + `whatsappPending`) por:

```tsx
  const { data: activationStatus } = useActivationStatus()
```

3. Na função `NavLink` (linhas 188-198), trocar as duas ocorrências de `bg-green-500` por `bg-amber-500` (bolinha expandida com "!" e bolinha compacta). Ajustar também o `aria-label` da bolinha expandida:

```tsx
        {showLabel && hasBadge && !locked && (
          <span
            aria-label="Cadastro pendente"
            className="ml-auto inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold leading-none text-white"
          >
            !
          </span>
        )}
        {!showLabel && hasBadge && !locked && (
          <span aria-hidden="true" className="absolute right-0.5 top-0.5 size-2 rounded-full bg-amber-500" />
        )}
```

4. Passar `hasBadge` para os itens principais dentro de `SidebarContent` (linhas 284-295), tanto no ramo expandido quanto no colapsado:

```tsx
              : mainItems.map((item) =>
                  showLabel ? (
                    <NavLink
                      key={item.href}
                      item={item}
                      showLabel
                      hasBadge={isSectionPending(activationStatus, item.key)}
                      onClick={onNavigate}
                    />
                  ) : (
                    <Tooltip key={item.href}>
                      <TooltipTrigger asChild>
                        <div>
                          <NavLink
                            item={item}
                            showLabel={false}
                            hasBadge={isSectionPending(activationStatus, item.key)}
                            onClick={onNavigate}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  ),
                )}
```

5. Trocar o `hasBadge={whatsappPending}` do item de Configurações (linhas 302 e 306) por `hasBadge={isSectionPending(activationStatus, 'configuracoes')}` (nos dois ramos — expandido e colapsado).

- [ ] **Step 6: Rodar o gate e confirmar tsc limpo**

Run: `npx tsc --noEmit`
Expected: zero erros (confirma que `whatsappPending`/`useEvolutionStatus` foram totalmente removidos e não há referência órfã).

Run: `npx vitest run src/components/app/activation-badges.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/app/activation-badges.ts src/components/app/activation-badges.test.ts src/components/app/app-shell.tsx
git commit -m "feat(activation): bolinha ambar de pendencia nos itens de menu"
```

---

### Task 6: Componente reutilizável `PendingDot`

**Files:**
- Create: `src/components/domain/shared/pending-dot.tsx`
- Test: `src/components/domain/shared/pending-dot.test.tsx`

**Interfaces:**
- Consumes: `cn` de `@/lib/utils`
- Produces: `<PendingDot label?: string className?: string />` — bolinha âmbar acessível, reusada nos cards de Configurações e no card de progresso

- [ ] **Step 1: Escrever o teste que falha**

```tsx
// @vitest-environment jsdom
// src/components/domain/shared/pending-dot.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { PendingDot } from './pending-dot'

describe('PendingDot', () => {
  it('renderiza uma bolinha âmbar acessível com label padrão', () => {
    render(<PendingDot />)
    const dot = screen.getByLabelText('Pendente')
    expect(dot).toBeInTheDocument()
    expect(dot.className).toContain('bg-amber-500')
  })

  it('aceita um label customizado', () => {
    render(<PendingDot label="Dados do negócio pendentes" />)
    expect(screen.getByLabelText('Dados do negócio pendentes')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/components/domain/shared/pending-dot.test.tsx`
Expected: FAIL — `./pending-dot` ainda não existe.

- [ ] **Step 3: Implementação mínima**

```tsx
// src/components/domain/shared/pending-dot.tsx
import { cn } from '@/lib/utils'

interface PendingDotProps {
  label?: string
  className?: string
}

/** Bolinha âmbar de pendência de ativação. Não é dispensável — reflete estado real. */
export function PendingDot({ label = 'Pendente', className }: PendingDotProps) {
  return (
    <span
      role="status"
      aria-label={label}
      title={label}
      className={cn('inline-block size-2 shrink-0 rounded-full bg-amber-500', className)}
    />
  )
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/components/domain/shared/pending-dot.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/domain/shared/pending-dot.tsx src/components/domain/shared/pending-dot.test.tsx
git commit -m "feat(activation): componente PendingDot reutilizavel"
```

---

### Task 7: Bolinha nos cards de Configurações (`SettingsCard` + página)

**Files:**
- Modify: `src/components/domain/settings/settings-card.tsx` (props e cabeçalho, linhas 12-19 e 54-65)
- Modify: `src/app/(app)/configuracoes/page.tsx` (linhas 92, 140-244)
- Test: `src/components/domain/settings/settings-card.test.tsx`

**Interfaces:**
- Consumes: `<PendingDot>`; `useActivationStatus`; `ActivationConfigStatus`
- Produces: `SettingsCard` com prop opcional `pending?: boolean`

- [ ] **Step 1: Escrever o teste que falha**

```tsx
// @vitest-environment jsdom
// src/components/domain/settings/settings-card.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { Building2 } from 'lucide-react'
import { SettingsCard } from './settings-card'

describe('SettingsCard', () => {
  it('mostra a bolinha de pendência quando pending=true', () => {
    render(
      <SettingsCard icon={Building2} title="Dados do negócio" subtitle="sub" pending>
        <p>conteúdo</p>
      </SettingsCard>,
    )
    expect(screen.getByLabelText('Dados do negócio pendente')).toBeInTheDocument()
  })

  it('não mostra a bolinha quando pending é falso/ausente', () => {
    render(
      <SettingsCard icon={Building2} title="Dados do negócio" subtitle="sub">
        <p>conteúdo</p>
      </SettingsCard>,
    )
    expect(screen.queryByLabelText('Dados do negócio pendente')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/components/domain/settings/settings-card.test.tsx`
Expected: FAIL — `SettingsCard` ainda não aceita `pending`, então a bolinha não é renderizada.

- [ ] **Step 3: Implementação mínima**

Editar `src/components/domain/settings/settings-card.tsx`:

1. Adicionar import no topo:

```tsx
import { PendingDot } from '@/components/domain/shared/pending-dot'
```

2. Estender a interface de props (após `statusBadge?`):

```tsx
interface SettingsCardProps {
  icon: ElementType
  title: string
  subtitle: string
  statusBadge?: StatusBadge
  pending?: boolean
  children?: ReactNode
  defaultExpanded?: boolean
}
```

3. Desestruturar `pending` na assinatura da função (junto de `statusBadge`) e renderizar a bolinha ao lado do título (bloco de título nas linhas 54-65):

```tsx
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{title}</span>
            {pending && <PendingDot label={`${title} pendente`} />}
            {statusBadge && (
              <span className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium',
                BADGE_STYLES[statusBadge.variant],
              )}>
                {statusBadge.label}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        </div>
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/components/domain/settings/settings-card.test.tsx`
Expected: PASS

- [ ] **Step 5: Wire na página de Configurações**

Editar `src/app/(app)/configuracoes/page.tsx`:

1. Adicionar import:

```tsx
import { useActivationStatus } from '@/hooks/activation/use-activation-status'
```

2. Dentro de `ConfiguracoesPage`, após `const { data: evolutionStatus } = useEvolutionStatus()` (linha 92), adicionar:

```tsx
  const { data: activation } = useActivationStatus()
```

3. Passar `pending` aos 4 cards afetados (usar `activation ? !activation.configuracoes.<sub> : false`):

- Card "Dados do negócio" (linha 141): `pending={activation ? !activation.configuracoes.dadosNegocio : false}`
- Card "Horários de funcionamento" (linha 156): `pending={activation ? !activation.configuracoes.horarios : false}`
- Card "Identidade visual" (linha 167): `pending={activation ? !activation.configuracoes.branding : false}`
- Card "WhatsApp e notificações" (linha 228): `pending={activation ? !activation.configuracoes.whatsapp : false}`

- [ ] **Step 6: Rodar o gate**

Run: `npx tsc --noEmit`
Expected: zero erros.

Run: `npx vitest run src/components/domain/settings/settings-card.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/domain/settings/settings-card.tsx src/components/domain/settings/settings-card.test.tsx "src/app/(app)/configuracoes/page.tsx"
git commit -m "feat(activation): bolinha de pendencia nos cards de Configuracoes"
```

---

### Task 8: Helpers do card de progresso (`activation-progress`)

**Files:**
- Create: `src/components/domain/activation/activation-progress.ts`
- Test: `src/components/domain/activation/activation-progress.test.ts`

**Interfaces:**
- Consumes: `ActivationStatus` de `src/domains/activation/types.ts`
- Produces: `ActivationStep`; `buildActivationSteps(status): ActivationStep[]`; `activationProgressPercent(status): number`; `shouldShowActivationCard({ status, dismissed }): boolean`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/components/domain/activation/activation-progress.test.ts
import { describe, it, expect } from 'vitest'
import {
  buildActivationSteps,
  activationProgressPercent,
  shouldShowActivationCard,
} from './activation-progress'
import type { ActivationStatus } from '@/domains/activation/types'

function status(overrides: Partial<ActivationStatus> = {}): ActivationStatus {
  return {
    categorias: false,
    servicos: false,
    clientes: false,
    equipe: false,
    configuracoes: { dadosNegocio: false, horarios: false, branding: false, whatsapp: false, done: false },
    ...overrides,
  }
}

describe('buildActivationSteps', () => {
  it('devolve 5 passos na ordem Categorias → Serviços → Clientes → Equipe → Configurações', () => {
    const steps = buildActivationSteps(status())
    expect(steps.map((s) => s.key)).toEqual(['categorias', 'servicos', 'clientes', 'equipe', 'configuracoes'])
    expect(steps.every((s) => s.done === false)).toBe(true)
  })

  it('reflete configuracoes.done no passo de Configurações', () => {
    const steps = buildActivationSteps(
      status({ configuracoes: { dadosNegocio: true, horarios: true, branding: true, whatsapp: true, done: true } }),
    )
    expect(steps.find((s) => s.key === 'configuracoes')?.done).toBe(true)
  })
})

describe('activationProgressPercent', () => {
  it('retorna 0 quando nada foi feito', () => {
    expect(activationProgressPercent(status())).toBe(0)
  })

  it('retorna 40 com 2 de 5 passos concluídos', () => {
    expect(activationProgressPercent(status({ categorias: true, servicos: true }))).toBe(40)
  })

  it('retorna 100 quando todos os passos estão concluídos', () => {
    expect(
      activationProgressPercent(
        status({
          categorias: true,
          servicos: true,
          clientes: true,
          equipe: true,
          configuracoes: { dadosNegocio: true, horarios: true, branding: true, whatsapp: true, done: true },
        }),
      ),
    ).toBe(100)
  })
})

describe('shouldShowActivationCard', () => {
  it('esconde quando não há nenhuma pendência', () => {
    const full = status({
      categorias: true,
      servicos: true,
      clientes: true,
      equipe: true,
      configuracoes: { dadosNegocio: true, horarios: true, branding: true, whatsapp: true, done: true },
    })
    expect(shouldShowActivationCard({ status: full, dismissed: false })).toBe(false)
    expect(shouldShowActivationCard({ status: full, dismissed: true })).toBe(false)
  })

  it('mostra quando há pendência e não foi dispensado', () => {
    expect(shouldShowActivationCard({ status: status({ clientes: false }), dismissed: false })).toBe(true)
  })

  it('reaparece mesmo dispensado enquanto Clientes OU Serviços estiverem pendentes', () => {
    expect(shouldShowActivationCard({ status: status({ servicos: false }), dismissed: true })).toBe(true)
    expect(shouldShowActivationCard({ status: status({ clientes: false }), dismissed: true })).toBe(true)
  })

  it('permanece escondido quando dispensado e só os 3 não-críticos estão pendentes', () => {
    const onlyNonCritical = status({
      categorias: false,
      servicos: true,
      clientes: true,
      equipe: false,
      configuracoes: { dadosNegocio: false, horarios: false, branding: false, whatsapp: false, done: false },
    })
    expect(shouldShowActivationCard({ status: onlyNonCritical, dismissed: true })).toBe(false)
    expect(shouldShowActivationCard({ status: onlyNonCritical, dismissed: false })).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/components/domain/activation/activation-progress.test.ts`
Expected: FAIL — `./activation-progress` ainda não existe.

- [ ] **Step 3: Implementação mínima**

```ts
// src/components/domain/activation/activation-progress.ts
import type { ActivationStatus } from '@/domains/activation/types'

export type ActivationStepKey = 'categorias' | 'servicos' | 'clientes' | 'equipe' | 'configuracoes'

export interface ActivationStep {
  key: ActivationStepKey
  label: string
  href: string
  done: boolean
}

/** Monta os 5 passos do checklist na ordem canônica da spec. */
export function buildActivationSteps(status: ActivationStatus): ActivationStep[] {
  return [
    { key: 'categorias', label: 'Crie categorias de serviço', href: '/servicos', done: status.categorias },
    { key: 'servicos', label: 'Cadastre seus serviços', href: '/servicos', done: status.servicos },
    { key: 'clientes', label: 'Adicione seus clientes', href: '/clientes', done: status.clientes },
    { key: 'equipe', label: 'Configure cargos da equipe', href: '/equipe', done: status.equipe },
    { key: 'configuracoes', label: 'Complete os dados do negócio', href: '/configuracoes', done: status.configuracoes.done },
  ]
}

/** Percentual (0-100) de passos concluídos, arredondado. */
export function activationProgressPercent(status: ActivationStatus): number {
  const steps = buildActivationSteps(status)
  const done = steps.filter((s) => s.done).length
  return Math.round((done / steps.length) * 100)
}

/**
 * Regra de exibição do card de progresso:
 * - esconde se não há pendência;
 * - mostra se há pendência e não foi dispensado;
 * - se dispensado, só reaparece enquanto Clientes OU Serviços continuarem pendentes.
 */
export function shouldShowActivationCard(input: { status: ActivationStatus; dismissed: boolean }): boolean {
  const { status, dismissed } = input
  const hasPending = buildActivationSteps(status).some((s) => !s.done)
  if (!hasPending) return false
  const criticalPending = !status.clientes || !status.servicos
  return !dismissed || criticalPending
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/components/domain/activation/activation-progress.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/domain/activation/activation-progress.ts src/components/domain/activation/activation-progress.test.ts
git commit -m "feat(activation): helpers de progresso e regra de reexibicao"
```

---

### Task 9: Card de progresso na Agenda (`ActivationProgressCard`)

**Files:**
- Create: `src/components/domain/activation/activation-progress-card.tsx`
- Test: `src/components/domain/activation/activation-progress-card.test.tsx`
- Modify: `src/app/(app)/agenda/page.tsx` (linhas 1-18)

**Interfaces:**
- Consumes: `useActivationStatus`; `buildActivationSteps`, `activationProgressPercent`, `shouldShowActivationCard` de `./activation-progress`
- Produces: `<ActivationProgressCard />`

- [ ] **Step 1: Escrever o teste que falha**

```tsx
// @vitest-environment jsdom
// src/components/domain/activation/activation-progress-card.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import type { ActivationStatus } from '@/domains/activation/types'

const useActivationStatus = vi.fn()
vi.mock('@/hooks/activation/use-activation-status', () => ({
  useActivationStatus: () => useActivationStatus(),
}))

import { ActivationProgressCard } from './activation-progress-card'

function status(overrides: Partial<ActivationStatus> = {}): ActivationStatus {
  return {
    categorias: true,
    servicos: false,
    clientes: false,
    equipe: false,
    configuracoes: { dadosNegocio: false, horarios: false, branding: false, whatsapp: false, done: false },
    ...overrides,
  }
}

describe('ActivationProgressCard', () => {
  beforeEach(() => {
    localStorage.clear()
    useActivationStatus.mockReset()
  })

  it('não renderiza nada enquanto o status não carregou', () => {
    useActivationStatus.mockReturnValue({ data: undefined })
    const { container } = render(<ActivationProgressCard />)
    expect(container).toBeEmptyDOMElement()
  })

  it('mostra o percentual e os 5 passos quando há pendência', () => {
    useActivationStatus.mockReturnValue({ data: status() })
    render(<ActivationProgressCard />)
    expect(screen.getByText(/20%/)).toBeInTheDocument()
    expect(screen.getByText('Cadastre seus serviços')).toBeInTheDocument()
    expect(screen.getByText('Complete os dados do negócio')).toBeInTheDocument()
  })

  it('esconde ao dispensar e persiste o dismissal', () => {
    useActivationStatus.mockReturnValue({ data: status() })
    render(<ActivationProgressCard />)
    fireEvent.click(screen.getByLabelText('Dispensar'))
    expect(screen.queryByText('Cadastre seus serviços')).not.toBeInTheDocument()
    expect(localStorage.getItem('agende:activation-card-dismissed')).toBe('1')
  })

  it('não renderiza quando dispensado e só os passos não-críticos estão pendentes', () => {
    localStorage.setItem('agende:activation-card-dismissed', '1')
    useActivationStatus.mockReturnValue({
      data: status({ servicos: true, clientes: true, categorias: false }),
    })
    const { container } = render(<ActivationProgressCard />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/components/domain/activation/activation-progress-card.test.tsx`
Expected: FAIL — `./activation-progress-card` ainda não existe.

- [ ] **Step 3: Implementação mínima**

```tsx
// src/components/domain/activation/activation-progress-card.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, ChevronRight, Rocket, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useActivationStatus } from '@/hooks/activation/use-activation-status'
import {
  buildActivationSteps,
  activationProgressPercent,
  shouldShowActivationCard,
} from './activation-progress'

const DISMISSED_KEY = 'agende:activation-card-dismissed'

export function ActivationProgressCard() {
  const { data: status } = useActivationStatus()
  // Lê o dismissal persistido apenas na montagem (não muda durante a sessão).
  const [dismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(DISMISSED_KEY) === '1'
  })
  // Esconde imediatamente ao clicar no X, sem depender da regra de reexibição.
  const [hidden, setHidden] = useState(false)

  if (!status) return null
  if (hidden) return null
  if (!shouldShowActivationCard({ status, dismissed })) return null

  const steps = buildActivationSteps(status)
  const percent = activationProgressPercent(status)

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setHidden(true)
  }

  return (
    <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-pink-50 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white">
          <Rocket className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-800">Configure seu negócio</p>
            <button
              type="button"
              aria-label="Dispensar"
              onClick={dismiss}
              className="text-slate-400 transition hover:text-slate-600"
            >
              <X className="size-4" />
            </button>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Complete os passos para começar a receber agendamentos.
          </p>

          {/* Barra de progresso */}
          <div className="mt-3 flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/70">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-600 to-pink-600 transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="shrink-0 text-xs font-semibold text-violet-700">{percent}%</span>
          </div>

          {/* Checklist */}
          <ul className="mt-3 space-y-1.5">
            {steps.map((step) => (
              <li key={step.key}>
                <Link
                  href={step.href}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-2 py-2 text-sm transition',
                    step.done ? 'text-slate-400' : 'text-slate-700 hover:bg-white/60',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex size-5 shrink-0 items-center justify-center rounded-full border',
                      step.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white',
                    )}
                  >
                    {step.done && <Check className="size-3" />}
                  </span>
                  <span className={cn('flex-1', step.done && 'line-through')}>{step.label}</span>
                  {!step.done && <ChevronRight className="size-4 shrink-0 text-slate-300" />}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/components/domain/activation/activation-progress-card.test.tsx`
Expected: PASS

- [ ] **Step 5: Montar na página da Agenda**

Editar `src/app/(app)/agenda/page.tsx`:

```tsx
'use client'

import { AgendaDayView } from '@/components/domain/scheduling/agenda-day-view'
import { InstallAppBanner } from '@/components/domain/pwa/install-app-banner'
import { ActivationProgressCard } from '@/components/domain/activation/activation-progress-card'

export default function AgendaPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <ActivationProgressCard />
      <InstallAppBanner />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          Agenda
        </h1>
      </div>
      <AgendaDayView />
    </div>
  )
}
```

- [ ] **Step 6: Rodar o gate**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 7: Commit**

```bash
git add src/components/domain/activation/activation-progress-card.tsx src/components/domain/activation/activation-progress-card.test.tsx "src/app/(app)/agenda/page.tsx"
git commit -m "feat(activation): card de progresso na Agenda com checklist de 5 passos"
```

---

### Task 10: Cadastro inline de Categoria no modal "Novo Serviço"

**Files:**
- Modify: `src/components/domain/services/service-form-modal.tsx` (import linha 18; estados após linha 48; bloco Categoria linhas 215-228)
- Test: `src/components/domain/services/service-form-modal.inline-category.test.tsx`

**Interfaces:**
- Consumes: `useCreateCategory` de `@/hooks/scheduling/use-service-categories` (assinatura existente: `mutate({ name: string }, { onSuccess: (created: ServiceCategory) => void, onError })`)
- Produces: comportamento inline (mini-formulário) dentro de `ServiceFormModal` — sem novo componente exportado

- [ ] **Step 1: Escrever o teste que falha**

```tsx
// @vitest-environment jsdom
// src/components/domain/services/service-form-modal.inline-category.test.tsx
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

const createCategoryMutate = vi.fn()

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/hooks/scheduling/use-services', () => ({
  useCreateService: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateService: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('@/hooks/scheduling/use-service-categories', () => ({
  useServiceCategories: () => ({ data: [{ id: 'c1', name: 'Cabelo', order: 0, active: true }] }),
  useCreateCategory: () => ({ mutate: createCategoryMutate, isPending: false }),
}))
vi.mock('@/hooks/inventory/use-products', () => ({
  useProducts: () => ({ data: { data: [] } }),
}))

import { ServiceFormModal } from './service-form-modal'

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

describe('ServiceFormModal — cadastro inline de categoria', () => {
  beforeEach(() => {
    createCategoryMutate.mockReset()
  })

  it('abre o mini-formulário e chama useCreateCategory ao confirmar', () => {
    render(<ServiceFormModal open onClose={() => {}} />)

    fireEvent.click(screen.getByLabelText('Nova categoria'))
    const input = screen.getByPlaceholderText('Nome da nova categoria')
    fireEvent.change(input, { target: { value: 'Barba' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar categoria' }))

    expect(createCategoryMutate).toHaveBeenCalledTimes(1)
    expect(createCategoryMutate.mock.calls[0][0]).toEqual({ name: 'Barba' })
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/components/domain/services/service-form-modal.inline-category.test.tsx`
Expected: FAIL — o botão "Nova categoria" e o mini-formulário ainda não existem.

- [ ] **Step 3: Implementação mínima**

Editar `src/components/domain/services/service-form-modal.tsx`:

1. Atualizar o import de categorias (linha 18):

```tsx
import { useServiceCategories, useCreateCategory } from '@/hooks/scheduling/use-service-categories'
```

2. Adicionar hook e estados dentro do componente (após `const { data: categories = [] } = useServiceCategories()`, linha 34):

```tsx
  const { mutate: createCategory, isPending: creatingCategory } = useCreateCategory()
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
```

3. Adicionar a função de submit do mini-formulário (junto às demais funções do componente):

```tsx
  function handleCreateCategoryInline() {
    const trimmed = newCategoryName.trim()
    if (!trimmed) return
    createCategory(
      { name: trimmed },
      {
        onSuccess: (created) => {
          setCategoryId(created.id)
          setNewCategoryName('')
          setAddingCategory(false)
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro ao criar categoria'),
      },
    )
  }
```

4. Substituir o bloco "Categoria" (linhas 215-228) por:

```tsx
          {/* Categoria */}
          <div className="space-y-2">
            <Label htmlFor="service-category">Categoria</Label>
            {addingCategory ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  autoFocus
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Nome da nova categoria"
                  maxLength={60}
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleCreateCategoryInline()
                    }
                  }}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateCategoryInline}
                    disabled={!newCategoryName.trim() || creatingCategory}
                    aria-label="Adicionar categoria"
                    className="flex-1 sm:flex-none"
                  >
                    {creatingCategory ? 'Salvando...' : 'Adicionar'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => { setAddingCategory(false); setNewCategoryName('') }}
                    disabled={creatingCategory}
                    className="flex-1 sm:flex-none"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <ComboboxField
                    options={[
                      { value: '__none__', label: 'Sem categoria' },
                      ...categories.map((cat) => ({ value: cat.id, label: cat.name })),
                    ]}
                    value={categoryId ?? '__none__'}
                    onChange={(v) => setCategoryId(v === '__none__' || !v ? null : v)}
                    placeholder="Selecionar categoria..."
                    searchPlaceholder="Buscar categoria..."
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setAddingCategory(true)}
                  aria-label="Nova categoria"
                  className="size-9 shrink-0"
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            )}
          </div>
```

(`Plus` já está importado de `lucide-react` na linha 4; `Input`, `Button`, `ComboboxField`, `Label` também já estão importados.)

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/components/domain/services/service-form-modal.inline-category.test.tsx`
Expected: PASS

- [ ] **Step 5: Rodar o gate**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 6: Commit**

```bash
git add src/components/domain/services/service-form-modal.tsx src/components/domain/services/service-form-modal.inline-category.test.tsx
git commit -m "feat(activation): cadastro inline de categoria no modal de servico"
```

---

### Task 11: Cadastro inline de Cliente no modal "Criar Agendamento"

**Files:**
- Modify: `src/components/domain/crm/create-customer-modal.tsx` (props linhas 17-21; onSuccess linhas 50-53)
- Modify: `src/components/domain/scheduling/create-appointment-modal.tsx` (imports; estado; bloco Cliente linhas 434-479; render do modal empilhado)
- Test: `src/components/domain/scheduling/create-appointment-modal.inline-customer.test.tsx`

**Interfaces:**
- Consumes: `CreateCustomerModal` (`open`, `onClose`, `onCreated`)
- Produces: `CreateCustomerModal` com `onCreated?: (customer: { id: string; name: string }) => void`; botão "+" no modal de agendamento que abre o cadastro empilhado

- [ ] **Step 1: Escrever o teste que falha**

```tsx
// @vitest-environment jsdom
// src/components/domain/scheduling/create-appointment-modal.inline-customer.test.tsx
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// Stub do modal de cliente: expõe um botão que dispara onCreated para simular criação.
vi.mock('@/components/domain/crm/create-customer-modal', () => ({
  CreateCustomerModal: ({
    open,
    onCreated,
  }: {
    open: boolean
    onClose: () => void
    onCreated?: (c: { id: string; name: string }) => void
  }) =>
    open ? (
      <button type="button" onClick={() => onCreated?.({ id: 'cli-9', name: 'Maria Nova' })}>
        stub-criar-cliente
      </button>
    ) : null,
}))

// Hooks usados pelo CreateAppointmentModal — stubs mínimos.
vi.mock('@/hooks/use-current-user', () => ({ useCurrentUser: () => ({ data: { id: 'u1' } }) }))
vi.mock('@/hooks/use-permissions', () => ({ usePermissions: () => ({ can: () => true }) }))
vi.mock('@/hooks/scheduling/use-services', () => ({ useServices: () => ({ data: [] }) }))
vi.mock('@/hooks/scheduling/use-service-categories', () => ({ useServiceCategories: () => ({ data: [] }) }))
vi.mock('@/hooks/scheduling/use-packages', () => ({ usePackages: () => ({ data: [] }) }))
vi.mock('@/hooks/scheduling/use-promotions', () => ({ usePromotions: () => ({ data: [] }) }))
vi.mock('@/hooks/iam/use-team', () => ({
  useTeamMembers: () => ({ data: [] }),
  useProfessionalsByService: () => ({ data: null }),
}))
vi.mock('@/hooks/settings/use-evolution-status', () => ({ useEvolutionStatus: () => ({ data: { connected: true } }) }))
vi.mock('@/hooks/crm/use-customers-search', () => ({ useCustomersSearch: () => ({ data: [], isLoading: false }) }))
vi.mock('@/hooks/scheduling/use-availability', () => ({ useAvailableSlots: () => ({ data: [], isLoading: false }) }))
vi.mock('@/hooks/scheduling/use-appointments', () => ({ useCreateAppointment: () => ({ mutate: vi.fn(), isPending: false }) }))

import { CreateAppointmentModal } from './create-appointment-modal'

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

describe('CreateAppointmentModal — cadastro inline de cliente', () => {
  it('abre o cadastro empilhado e seleciona o cliente recém-criado', () => {
    render(<CreateAppointmentModal open onClose={() => {}} />)

    fireEvent.click(screen.getByLabelText('Novo cliente'))
    fireEvent.click(screen.getByText('stub-criar-cliente'))

    // O nome do cliente criado passa a preencher o campo de busca.
    expect(screen.getByDisplayValue('Maria Nova')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/components/domain/scheduling/create-appointment-modal.inline-customer.test.tsx`
Expected: FAIL — o botão "Novo cliente" e o modal empilhado ainda não existem.

- [ ] **Step 3: Implementação mínima**

3a. Editar `src/components/domain/crm/create-customer-modal.tsx` — ampliar `onCreated` para passar `{ id, name }`:

```tsx
type Props = {
  open: boolean
  onClose: () => void
  onCreated?: (customer: { id: string; name: string }) => void
}
```

E no `onSuccess` (linhas 50-53), trocar `onCreated?.(customer.id)` por:

```tsx
        onSuccess: (customer) => {
          toast.success(`${customer.name} cadastrado com sucesso`)
          onCreated?.({ id: customer.id, name: customer.name })
          handleClose()
        },
```

(O único outro uso de `CreateCustomerModal` — `src/components/domain/crm/customer-list.tsx:158` — não passa `onCreated`, então não quebra.)

3b. Editar `src/components/domain/scheduling/create-appointment-modal.tsx`:

Adicionar import (junto aos demais imports de componentes, ~linha 32):

```tsx
import { CreateCustomerModal } from '@/components/domain/crm/create-customer-modal'
import { Plus } from 'lucide-react'
```

Adicionar estados (junto aos outros `useState`, após `customerId`, linha 104):

```tsx
  const [newCustomerOpen, setNewCustomerOpen] = useState(false)
  const [createdCustomerName, setCreatedCustomerName] = useState('')
```

No `handleClose` (linha 189-204), resetar os novos estados antes de `onClose()`:

```tsx
    setNewCustomerOpen(false)
    setCreatedCustomerName('')
```

Ajustar a exibição do valor do input de cliente para considerar o cliente recém-criado. Substituir o bloco Cliente (linhas 434-479) por:

```tsx
          {/* 5. Cliente */}
          <div className="space-y-2">
            <Label>Cliente</Label>
            {defaultCustomerId ? (
              <div className="flex h-9 w-full items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
                {defaultCustomerName ?? 'Cliente selecionado'}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Buscar por nome ou telefone..."
                    value={selectedCustomer ? selectedCustomer.name : (createdCustomerName || customerSearch)}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value)
                      setCustomerId('')
                      setCreatedCustomerName('')
                    }}
                    className="min-w-0 flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setNewCustomerOpen(true)}
                    aria-label="Novo cliente"
                    className="size-9 shrink-0"
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
                {customerSearch.length >= 2 && !customerId && (
                  <div className="rounded-xl border bg-white shadow-sm max-h-40 overflow-y-auto">
                    {searchingCustomers ? (
                      <p className="p-3 text-sm text-slate-500">Buscando...</p>
                    ) : customers.length === 0 ? (
                      <p className="p-3 text-sm text-slate-500">Nenhum cliente encontrado</p>
                    ) : (
                      customers.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setCustomerId(c.id)
                            setCustomerSearch(c.name)
                            setCreatedCustomerName('')
                          }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-primary/5"
                        >
                          <span className="font-medium">{c.name}</span>
                          {c.phone && (
                            <span className="ml-2 text-slate-400">{c.phone}</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
```

Adicionar o modal empilhado logo antes do fechamento do `</DialogContent>` (após o bloco de botões, linha 517):

```tsx
          <CreateCustomerModal
            open={newCustomerOpen}
            onClose={() => setNewCustomerOpen(false)}
            onCreated={(customer) => {
              setCustomerId(customer.id)
              setCreatedCustomerName(customer.name)
              setCustomerSearch('')
              setNewCustomerOpen(false)
            }}
          />
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/components/domain/scheduling/create-appointment-modal.inline-customer.test.tsx`
Expected: PASS

- [ ] **Step 5: Rodar o gate**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 6: Commit**

```bash
git add src/components/domain/crm/create-customer-modal.tsx src/components/domain/scheduling/create-appointment-modal.tsx src/components/domain/scheduling/create-appointment-modal.inline-customer.test.tsx
git commit -m "feat(activation): cadastro inline de cliente no modal de agendamento"
```

---

### Task 12: Helper `describeRolePermissions` (resumo textual de cargo)

**Files:**
- Create: `src/shared/permissions/describe-role-permissions.ts`
- Test: `src/shared/permissions/describe-role-permissions.test.ts`

**Interfaces:**
- Consumes: nada (função pura)
- Produces: `describeRolePermissions(permissions: Record<string, string[]>, sections: { key: string; label: string }[]): string`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/shared/permissions/describe-role-permissions.test.ts
import { describe, it, expect } from 'vitest'
import { describeRolePermissions } from './describe-role-permissions'

const sections = [
  { key: 'agenda', label: 'Agenda' },
  { key: 'servicos', label: 'Serviços' },
  { key: 'clientes', label: 'Clientes' },
]

describe('describeRolePermissions', () => {
  it('informa quando o cargo não vê nenhuma tela', () => {
    expect(describeRolePermissions({}, sections)).toBe('Sem acesso a nenhuma tela')
  })

  it('lista o que pode ver e diz que não edita quando só tem view', () => {
    const perms = { agenda: ['view'], servicos: ['view'] }
    expect(describeRolePermissions(perms, sections)).toBe(
      'Pode ver Agenda, Serviços — não pode editar nem excluir',
    )
  })

  it('separa telas visíveis das editáveis', () => {
    const perms = { agenda: ['view', 'create', 'edit'], servicos: ['view'] }
    expect(describeRolePermissions(perms, sections)).toBe(
      'Pode ver Agenda, Serviços; pode editar Agenda',
    )
  })

  it('ignora chaves de seção que não estão na lista de sections', () => {
    const perms = { desconhecida: ['view', 'edit'], clientes: ['view'] }
    expect(describeRolePermissions(perms, sections)).toBe(
      'Pode ver Clientes — não pode editar nem excluir',
    )
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/shared/permissions/describe-role-permissions.test.ts`
Expected: FAIL — `./describe-role-permissions` ainda não existe.

- [ ] **Step 3: Implementação mínima**

```ts
// src/shared/permissions/describe-role-permissions.ts

/**
 * Gera um resumo textual curto do que um cargo pode fazer, a partir das permissões
 * reais (`Record<sectionKey, action[]>`) e da lista de seções (com labels).
 * Função pura — usada no card de membro da equipe.
 */
export function describeRolePermissions(
  permissions: Record<string, string[]>,
  sections: { key: string; label: string }[],
): string {
  const viewable = sections.filter((s) => (permissions[s.key] ?? []).includes('view'))
  if (viewable.length === 0) return 'Sem acesso a nenhuma tela'

  const editable = sections.filter((s) => {
    const actions = permissions[s.key] ?? []
    return actions.includes('create') || actions.includes('edit') || actions.includes('delete')
  })

  const viewLabels = viewable.map((s) => s.label).join(', ')
  if (editable.length === 0) {
    return `Pode ver ${viewLabels} — não pode editar nem excluir`
  }

  const editLabels = editable.map((s) => s.label).join(', ')
  return `Pode ver ${viewLabels}; pode editar ${editLabels}`
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/shared/permissions/describe-role-permissions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/permissions/describe-role-permissions.ts src/shared/permissions/describe-role-permissions.test.ts
git commit -m "feat(iam): helper de resumo textual de permissoes de cargo"
```

---

### Task 13: Descoberta de Cargos — hint na Equipe + deep-link em `RolesManager`

**Files:**
- Modify: `src/components/domain/iam/roles-manager.tsx` (props e inicialização de estado, linhas 16-23)
- Modify: `src/app/(app)/equipe/page.tsx` (estado `roleFocusId`; botão Cargos; hint; wiring de `RolesManager` e `TeamMemberCard`)
- Test: `src/components/domain/iam/roles-manager.test.tsx`

**Interfaces:**
- Consumes: `RolesManager` existente; `useRoles`, `useNavSections`
- Produces: `RolesManager` com prop opcional `initialRoleId?: string`; `EquipePage` passando `onViewRolePermissions` ao `TeamMemberCard` (consumido na Task 14)

- [ ] **Step 1: Escrever o teste que falha**

```tsx
// @vitest-environment jsdom
// src/components/domain/iam/roles-manager.test.tsx
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/hooks/iam/use-roles', () => ({
  useRoles: () => ({
    data: [
      { id: 'r1', name: 'Recepção', permissions: { agenda: ['view'] }, _count: { users: 1 } },
      { id: 'r2', name: 'Esteticista', permissions: { agenda: ['view', 'edit'] }, _count: { users: 0 } },
    ],
    isLoading: false,
  }),
  useCreateRole: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('@/hooks/iam/use-nav-sections', () => ({
  useNavSections: () => ({ data: [{ key: 'agenda', label: 'Agenda', actions: ['view', 'edit'] }], isLoading: false }),
}))
// RoleEditor tem muitas dependências — stub para focar no comportamento do initialRoleId.
vi.mock('./role-editor', () => ({
  RoleEditor: ({ role }: { role: { name: string } }) => <div>editor:{role.name}</div>,
}))
vi.mock('./role-delete-button', () => ({ RoleDeleteButton: () => <button>del</button> }))

import { RolesManager } from './roles-manager'

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

describe('RolesManager — initialRoleId', () => {
  it('abre já editando o cargo indicado por initialRoleId', () => {
    render(<RolesManager initialRoleId="r2" />)
    expect(screen.getByText('editor:Esteticista')).toBeInTheDocument()
  })

  it('sem initialRoleId, não abre nenhum editor de cargo', () => {
    render(<RolesManager />)
    expect(screen.queryByText(/^editor:/)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/components/domain/iam/roles-manager.test.tsx`
Expected: FAIL — `RolesManager` ainda não aceita `initialRoleId`.

- [ ] **Step 3: Implementação mínima**

Editar `src/components/domain/iam/roles-manager.tsx`:

1. Adicionar props e inicializar os estados a partir de `initialRoleId` (linhas 16-23):

```tsx
type Props = {
  initialRoleId?: string
}

export function RolesManager({ initialRoleId }: Props = {}) {
  const { data: roles, isLoading: loadingRoles } = useRoles()
  const { data: sections = [], isLoading: loadingSections } = useNavSections()
  const createRole = useCreateRole()
  const [editingId, setEditingId] = useState<string | null>(initialRoleId ?? null)
  const [creatingNew, setCreatingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [mobileView, setMobileView] = useState<'list' | 'editor'>(initialRoleId ? 'editor' : 'list')
```

(O restante do componente permanece igual — `editingRole` já deriva de `editingId`.)

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/components/domain/iam/roles-manager.test.tsx`
Expected: PASS

- [ ] **Step 5: Wire na página da Equipe (hint + deep-link)**

Editar `src/app/(app)/equipe/page.tsx`:

1. Adicionar estado do foco de cargo (junto aos outros `useState`, linha 44):

```tsx
  const [roleFocusId, setRoleFocusId] = useState<string | null>(null)
```

2. No botão "Cargos" (linhas 104-112), garantir que abre sem foco específico:

```tsx
            <Button
              variant="outline"
              onClick={() => { setRoleFocusId(null); setRolesOpen(true) }}
              className="flex-1 rounded-full sm:flex-none"
            >
              <Settings2 className="size-4" />
              Cargos
            </Button>
```

3. Adicionar o texto de apoio (sempre visível, discreto) logo abaixo do parágrafo do cabeçalho (após linha 100), visível a todos:

```tsx
          <p className="mt-1 text-xs text-slate-400">
            Cargos controlam o que cada pessoa vê e pode fazer em cada tela (visualizar, criar, editar, excluir).
          </p>
```

4. Passar `onViewRolePermissions` ao `TeamMemberCard` (linhas 161-167) apenas para o dono (a tela de Cargos é exclusiva do owner):

```tsx
            {members.map((member) => (
              <TeamMemberCard
                key={member.id}
                member={member}
                canManage={canManage}
                onViewRolePermissions={
                  user?.isOwner
                    ? (roleId) => { setRoleFocusId(roleId); setRolesOpen(true) }
                    : undefined
                }
              />
            ))}
```

5. Passar `initialRoleId` (com `key` para forçar remontagem ao trocar de foco) ao `RolesManager` dentro do Dialog (linha 255):

```tsx
          <RolesManager key={roleFocusId ?? 'all'} initialRoleId={roleFocusId ?? undefined} />
```

- [ ] **Step 6: Rodar o gate**

Run: `npx tsc --noEmit`
Expected: **erro esperado e temporário** — `TeamMemberCard` ainda não aceita `onViewRolePermissions` (será adicionado na Task 14). Se preferir manter o gate verde a cada task, aplicar a Task 14 na sequência antes de rodar `tsc` novamente. O commit desta task pode ser feito junto ao da Task 14, mas mantemos commits separados por clareza; portanto rodar apenas o teste isolado aqui.

Run: `npx vitest run src/components/domain/iam/roles-manager.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/domain/iam/roles-manager.tsx src/components/domain/iam/roles-manager.test.tsx "src/app/(app)/equipe/page.tsx"
git commit -m "feat(iam): hint de cargos na Equipe e deep-link para permissoes do cargo"
```

---

### Task 14: Resumo de permissões + link no card de membro (`TeamMemberCard`)

**Files:**
- Modify: `src/components/domain/iam/team-member-card.tsx` (props; imports; corpo do card)
- Test: `src/components/domain/iam/team-member-card.test.tsx`

**Interfaces:**
- Consumes: `describeRolePermissions`; `useRoles`; `useNavSections`; prop `onViewRolePermissions?: (roleId: string) => void` (fornecida pela Task 13)
- Produces: `TeamMemberCard` exibindo resumo textual do cargo + link "Ver permissões"

- [ ] **Step 1: Escrever o teste que falha**

```tsx
// @vitest-environment jsdom
// src/components/domain/iam/team-member-card.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import type { TeamMember } from '@/hooks/iam/use-team'

vi.mock('@/hooks/use-current-user', () => ({ useCurrentUser: () => ({ data: { id: 'other' } }) }))
vi.mock('@/hooks/iam/use-roles', () => ({
  useRoles: () => ({
    data: [{ id: 'r1', name: 'Recepção', permissions: { agenda: ['view'], clientes: ['view', 'edit'] }, _count: { users: 1 } }],
  }),
}))
vi.mock('@/hooks/iam/use-nav-sections', () => ({
  useNavSections: () => ({
    data: [
      { key: 'agenda', label: 'Agenda', actions: ['view'] },
      { key: 'clientes', label: 'Clientes', actions: ['view', 'edit'] },
    ],
  }),
}))
vi.mock('./edit-member-modal', () => ({ EditMemberModal: () => null }))

import { TeamMemberCard } from './team-member-card'

const member: TeamMember = {
  id: 'm1',
  name: 'Ana Silva',
  email: 'ana@x.com',
  role: 'RECEPTIONIST',
  isOwner: false,
  roleId: 'r1',
  roleName: 'Recepção',
  avatarUrl: null,
  avatarCropX: null,
  avatarCropY: null,
  avatarCropZoom: null,
  bio: null,
  services: [],
  createdAt: '2026-01-01',
}

describe('TeamMemberCard — resumo de permissões', () => {
  it('mostra o resumo textual calculado do cargo', () => {
    render(<TeamMemberCard member={member} canManage />)
    expect(screen.getByText('Pode ver Agenda, Clientes; pode editar Clientes')).toBeInTheDocument()
  })

  it('chama onViewRolePermissions com o roleId ao clicar em "Ver permissões"', () => {
    const onView = vi.fn()
    render(<TeamMemberCard member={member} canManage onViewRolePermissions={onView} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver permissões' }))
    expect(onView).toHaveBeenCalledWith('r1')
  })

  it('para o dono, mostra "Acesso total" e não exibe link', () => {
    const owner: TeamMember = { ...member, isOwner: true, roleId: null, roleName: 'Dono' }
    const onView = vi.fn()
    render(<TeamMemberCard member={owner} canManage onViewRolePermissions={onView} />)
    expect(screen.getByText('Acesso total a todas as telas')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver permissões' })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/components/domain/iam/team-member-card.test.tsx`
Expected: FAIL — resumo e link ainda não existem no card.

- [ ] **Step 3: Implementação mínima**

Editar `src/components/domain/iam/team-member-card.tsx`:

1. Ampliar imports (topo do arquivo):

```tsx
import { useRoles } from '@/hooks/iam/use-roles'
import { useNavSections } from '@/hooks/iam/use-nav-sections'
import { describeRolePermissions } from '@/shared/permissions/describe-role-permissions'
```

2. Ampliar as props (linhas 13-16):

```tsx
type Props = {
  member: TeamMember
  canManage: boolean
  onViewRolePermissions?: (roleId: string) => void
}

export function TeamMemberCard({ member, canManage, onViewRolePermissions }: Props) {
```

3. Dentro do componente (após os hooks existentes), calcular o resumo:

```tsx
  const { data: roles = [] } = useRoles()
  const { data: sections = [] } = useNavSections()
  const memberRole = roles.find((r) => r.id === member.roleId)
  const permissionSummary = member.isOwner
    ? 'Acesso total a todas as telas'
    : memberRole
      ? describeRolePermissions(memberRole.permissions, sections)
      : null
```

4. Adicionar o resumo + link dentro do bloco de dados do membro, logo após o `<p>` do e-mail (linha 56), antes do bloco de serviços:

```tsx
          {permissionSummary && (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-xs text-slate-500">{permissionSummary}</span>
              {!member.isOwner && member.roleId && onViewRolePermissions && (
                <button
                  type="button"
                  onClick={() => onViewRolePermissions(member.roleId as string)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Ver permissões
                </button>
              )}
            </div>
          )}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/components/domain/iam/team-member-card.test.tsx`
Expected: PASS

- [ ] **Step 5: Rodar o gate completo (Tasks 13+14 já integradas)**

Run: `npx tsc --noEmit`
Expected: zero erros.

Run: `npx vitest run src/components/domain/iam`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/domain/iam/team-member-card.tsx src/components/domain/iam/team-member-card.test.tsx
git commit -m "feat(iam): resumo de permissoes e link no card de membro da equipe"
```

---

### Task 15: `AlertDialog` na exclusão de Categoria (`category-catalog.tsx`)

**Files:**
- Modify: `src/components/domain/services/category-catalog.tsx` (remover `confirm()`; adicionar `AlertDialog`)
- Test: `src/components/domain/services/category-catalog.test.tsx`

**Interfaces:**
- Consumes: `AlertDialog*` de `@/components/ui/alert-dialog` (mesmo import usado em `role-delete-button.tsx`); `useDeleteCategory`
- Produces: exclusão de categoria com confirmação via `AlertDialog`

- [ ] **Step 1: Escrever o teste que falha**

```tsx
// @vitest-environment jsdom
// src/components/domain/services/category-catalog.test.tsx
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const deleteMutate = vi.fn()
vi.mock('@/hooks/scheduling/use-service-categories', () => ({
  useServiceCategories: () => ({
    data: [{ id: 'c1', name: 'Cabelo', order: 0, active: true }],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useDeleteCategory: () => ({ mutate: deleteMutate }),
  useUpdateCategory: () => ({ mutate: vi.fn() }),
}))
vi.mock('./category-form-modal', () => ({ CategoryFormModal: () => null }))

import { CategoryCatalog } from './category-catalog'

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

describe('CategoryCatalog — exclusão com AlertDialog', () => {
  it('abre o AlertDialog ao clicar em excluir e só chama a mutation ao confirmar', () => {
    render(<CategoryCatalog />)

    fireEvent.click(screen.getByLabelText('Excluir categoria Cabelo'))
    // Diálogo de confirmação visível com texto explicativo
    expect(screen.getByText(/Excluir a categoria/i)).toBeInTheDocument()
    expect(deleteMutate).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(deleteMutate).toHaveBeenCalledTimes(1)
    expect(deleteMutate.mock.calls[0][0]).toBe('c1')
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/components/domain/services/category-catalog.test.tsx`
Expected: FAIL — hoje o botão usa `confirm()` nativo e não tem `aria-label`, então o `AlertDialog` não aparece.

- [ ] **Step 3: Implementação mínima**

Editar `src/components/domain/services/category-catalog.tsx`:

1. Adicionar import do `AlertDialog` (junto aos demais imports):

```tsx
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
```

2. Remover a função `handleDelete` (linhas 18-23) e a chamada `confirm()`. Substituir o botão de lixeira (linhas 77-79) por um `AlertDialog` com gatilho no próprio botão:

```tsx
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    aria-label={`Excluir categoria ${cat.name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir a categoria &quot;{cat.name}&quot;?</AlertDialogTitle>
                    <AlertDialogDescription>
                      A categoria deixa de aparecer para novos serviços. Só é possível excluir
                      categorias sem serviços vinculados — caso contrário, remova o vínculo antes.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-white hover:bg-destructive/90"
                      onClick={() =>
                        deleteCategory(cat.id, {
                          onError: (err) =>
                            toast.error(err instanceof Error ? err.message : 'Erro ao remover categoria.'),
                        })
                      }
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/components/domain/services/category-catalog.test.tsx`
Expected: PASS

- [ ] **Step 5: Rodar o gate**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 6: Commit**

```bash
git add src/components/domain/services/category-catalog.tsx src/components/domain/services/category-catalog.test.tsx
git commit -m "feat(services): confirmacao de exclusao de categoria via AlertDialog"
```

---

### Task 16: `AlertDialog` em ativar/desativar Serviço + abertura do PR

**Files:**
- Modify: `src/components/domain/services/service-catalog.tsx` (remover `confirm()`; adicionar `AlertDialog` em desativar e reativar)
- Test: `src/components/domain/services/service-catalog.test.tsx`

**Interfaces:**
- Consumes: `AlertDialog*` de `@/components/ui/alert-dialog`; `useDeactivateService`, `useActivateService`
- Produces: desativação/reativação de serviço com confirmação e texto explicando que é reversível

- [ ] **Step 1: Escrever o teste que falha**

```tsx
// @vitest-environment jsdom
// src/components/domain/services/service-catalog.test.tsx
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

const deactivateMutate = vi.fn()
const activateMutate = vi.fn()

vi.mock('@/hooks/scheduling/use-services', () => ({
  useServices: () => ({
    data: [
      { id: 's1', name: 'Corte', duration: 30, price: '50', priceType: 'FIXED', categoryId: null, category: null, active: true, imageUrl: null, imageCropX: null, imageCropY: null, imageCropZoom: null },
      { id: 's2', name: 'Barba', duration: 20, price: '30', priceType: 'FIXED', categoryId: null, category: null, active: false, imageUrl: null, imageCropX: null, imageCropY: null, imageCropZoom: null },
    ],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useDeactivateService: () => ({ mutate: deactivateMutate }),
  useActivateService: () => ({ mutate: activateMutate }),
}))
vi.mock('@/hooks/scheduling/use-service-categories', () => ({ useServiceCategories: () => ({ data: [] }) }))
vi.mock('./service-form-modal', () => ({ ServiceFormModal: () => null }))

import { ServiceCatalog } from './service-catalog'

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

describe('ServiceCatalog — confirmação de desativar/reativar', () => {
  it('confirma antes de desativar e explica que é reversível', () => {
    render(<ServiceCatalog />)
    fireEvent.click(screen.getByLabelText('Desativar Corte'))
    expect(screen.getByText(/deixa de aparecer/i)).toBeInTheDocument()
    expect(deactivateMutate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Desativar' }))
    expect(deactivateMutate).toHaveBeenCalledWith('s1')
  })

  it('confirma antes de reativar', () => {
    render(<ServiceCatalog />)
    fireEvent.click(screen.getByLabelText('Reativar Barba'))
    fireEvent.click(screen.getByRole('button', { name: 'Reativar' }))
    expect(activateMutate).toHaveBeenCalledWith('s2')
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/components/domain/services/service-catalog.test.tsx`
Expected: FAIL — hoje usa `confirm()` nativo e os botões não têm `aria-label` descritivo.

- [ ] **Step 3: Implementação mínima**

Editar `src/components/domain/services/service-catalog.tsx`:

1. Adicionar import do `AlertDialog`:

```tsx
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
```

2. Remover `handleDeactivate` e `handleActivate` (linhas 46-54) com seus `confirm()`.

3. Substituir o bloco de botões de ativar/desativar (linhas 172-192) por gatilhos de `AlertDialog`:

```tsx
                    {service.active ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            aria-label={`Desativar ${service.name}`}
                          >
                            <Power className="size-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Desativar &quot;{service.name}&quot;?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Este serviço deixa de aparecer na vitrine e na criação de agendamentos,
                              mas o histórico de atendimentos é preservado. Você pode reativar quando quiser.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-white hover:bg-destructive/90"
                              onClick={() => deactivate(service.id)}
                            >
                              Desativar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-green-600"
                            aria-label={`Reativar ${service.name}`}
                          >
                            <Power className="size-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Reativar &quot;{service.name}&quot;?</AlertDialogTitle>
                            <AlertDialogDescription>
                              O serviço volta a aparecer na vitrine e na criação de agendamentos.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => activate(service.id)}>
                              Reativar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/components/domain/services/service-catalog.test.tsx`
Expected: PASS

- [ ] **Step 5: Rodar o gate completo do projeto**

Run: `npx tsc --noEmit`
Expected: zero erros.

Run: `npx vitest run`
Expected: todos os testes passando.

- [ ] **Step 6: Commit**

```bash
git add src/components/domain/services/service-catalog.tsx src/components/domain/services/service-catalog.test.tsx
git commit -m "feat(services): confirmacao de ativar/desativar servico via AlertDialog"
```

- [ ] **Step 7: Push e abertura do PR** (padrão de `.claude/BRANCHING.md`)

```bash
git push -u origin feat/ativacao-guiada

gh pr create \
  --title "feat: Ativação Guiada (pendência, progresso, cadastro inline, descoberta de cargos)" \
  --body "$(cat <<'EOF'
## O que essa PR faz
- Adiciona o módulo read-only `activation` (status on-the-fly, sem novo campo no banco) + endpoint `GET /api/activation/status` e hook `useActivationStatus`
- Bolinha âmbar de pendência nos itens de menu e nos cards de Configurações (WhatsApp absorvido no critério de Configurações)
- Card de progresso de 5 passos na Agenda (dispensável; reaparece enquanto Clientes ou Serviços seguirem pendentes)
- Cadastro inline de Categoria no modal de Serviço e de Cliente no modal de Agendamento (reusam endpoints/forms existentes)
- Descoberta de Cargos: hint fixo na Equipe + resumo textual de permissões e deep-link no card de cada membro
- Padroniza confirmações de exclusão (Categoria/Serviço) trocando `window.confirm()` por `AlertDialog`

## Como testar
- [ ] Crie um tenant vazio: bolinhas âmbar em Serviços, Clientes, Equipe, Configurações e card de progresso em /agenda
- [ ] Complete cada passo e veja as bolinhas/percentual sumirem on-the-fly
- [ ] No modal Novo Serviço, use o "+" ao lado de Categoria para criar uma categoria inline
- [ ] No modal Criar Agendamento, use o "+" ao lado de Cliente para cadastrar um cliente empilhado
- [ ] Na Equipe, confira o hint de Cargos, o resumo no card de membro e o link "Ver permissões"
- [ ] Exclua categoria e desative/reative serviço — confirmação via AlertDialog

## Checklist
- [ ] tenantId filtrado em todas as queries (activation.repository)
- [ ] tenantId extraído do token (getSessionContext)
- [ ] Sem `any` no TypeScript
- [ ] Loading/empty states preservados nos componentes tocados
- [ ] `npx tsc --noEmit` limpo e `npx vitest run` verde
- [ ] Checklist mobile-first aplicado aos componentes novos
EOF
)"
```

- [ ] **Step 8: Merge após aprovação**

```bash
gh pr merge --squash
git checkout main && git pull origin main && git log origin/main --oneline -3
```

---

## Self-review

### (1) Cobertura de cada item do escopo → task

| Item do escopo (spec/handoff) | Task(s) |
|---|---|
| Cálculo de pendência on-the-fly, sem campo novo no banco | Task 1 (compute) + Task 2 (repository) + Task 3 (service/endpoint) |
| Critério por módulo (categorias/serviços/clientes = count; equipe = Role.isDefault=false; config = phone+address+businessHours+logo+whatsapp) | Task 1 (compute) + Task 2 (queries) |
| Hook compartilhado `useActivationStatus` | Task 4 |
| Bolinha âmbar (`amber-500`) nos itens de menu, WhatsApp absorvido em Configurações | Task 5 (helper + app-shell, troca `green-500`→`amber-500`, remove `whatsappPending`) |
| Bolinha reusada nos cards de Configurações (Dados, Horário, Branding, WhatsApp) | Task 6 (`PendingDot`) + Task 7 (SettingsCard + página) |
| Card de progresso na Agenda (5 passos, %, dispensável, reaparece se Clientes/Serviços pendentes, localStorage) | Task 8 (helpers) + Task 9 (componente + montagem na agenda) |
| Cadastro inline de Categoria no modal Novo Serviço (mesmo endpoint) | Task 10 |
| Cadastro inline de Cliente no modal Criar Agendamento (form existente empilhado) | Task 11 |
| Descoberta de Cargos: hint fixo + resumo textual + link direto para permissões do cargo | Task 12 (helper) + Task 13 (hint + deep-link) + Task 14 (resumo + link no card) |
| Confirmação padronizada `AlertDialog` em excluir categoria e ativar/desativar serviço | Task 15 (categoria) + Task 16 (serviço) |
| Branch `feat/ativacao-guiada` a partir de `main` | Task 1, Step 0 |
| Abertura de PR seguindo `.claude/BRANCHING.md` | Task 16, Step 7 |
| Mobile-first em todos os componentes novos | Global Constraints + classes `sm:`/`flex-col` nos Steps de UI (Tasks 9, 10, 11, 14) |

Itens **fora de escopo** confirmados sem task: lógica do onboarding obrigatório de catálogo; novo campo no Tenant para dismissal; generalização do padrão inline; alteração de presets/exclusão de Role; mudança de schema Customer/Role; `RoleFilterPermissions`. Customer (edição/soft delete/AlertDialog) e a lógica de exclusão de Role permanecem intocados.

### (2) Scan de placeholders

Nenhum `TBD`, `implementar depois`, `similar à Task N`, `adicionar validação apropriada` ou `...` como código omitido. Todo bloco de código nos Steps 1/3 é completo e real. As referências a "linhas X-Y" apontam para o código-alvo a editar (não são placeholders de implementação). O único ponto de atenção sinalizado explicitamente é a dependência temporária entre Task 13 e Task 14 no gate `tsc` (documentada no Step 6 da Task 13), resolvida ao concluir a Task 14.

### (3) Consistência de tipos entre tasks

- `ActivationStatus` / `ActivationConfigStatus` / `ActivationCounts` — definidos na Task 1, consumidos sem alteração de forma nas Tasks 2, 3, 4, 5, 8.
- `computeActivationStatus(counts: ActivationCounts): ActivationStatus` — assinatura idêntica na Task 1 (def), Task 3 (uso no service).
- `activationRepository.getActivationCounts(tenantId: string): Promise<ActivationCounts>` — idêntica na Task 2 (def) e Task 3 (uso).
- `activationService.getStatus(tenantId: string): Promise<ActivationStatus>` — idêntica na Task 3 (def) e route.
- `useActivationStatus()` → `UseQueryResult<ActivationStatus>` (chave `['activation-status']`) — Task 4 (def), consumido nas Tasks 5, 7, 9 sempre via `data`.
- `isSectionPending(status: ActivationStatus | undefined, key: string): boolean` — Task 5 (def), usado no app-shell com as mesmas chaves de `NavSection.key`.
- `ActivationStep` + `buildActivationSteps`/`activationProgressPercent`/`shouldShowActivationCard` — Task 8 (def), consumidos na Task 9 com a mesma assinatura (`shouldShowActivationCard({ status, dismissed })`).
- `describeRolePermissions(permissions, sections)` — Task 12 (def), consumido na Task 14 com `memberRole.permissions` (tipo `Record<string,string[]>` de `Role`) e `sections` de `useNavSections` (compatível com `{ key; label }`).
- `CreateCustomerModal` `onCreated?: (customer: { id: string; name: string }) => void` — ampliado na Task 11 e consumido no mesmo formato pelo `CreateAppointmentModal`; único outro caller (`customer-list.tsx`) não usa `onCreated`.
- `RolesManager` `initialRoleId?: string` — Task 13 (def), consumido pela `EquipePage` na mesma task; `TeamMemberCard` `onViewRolePermissions?: (roleId: string) => void` fornecido na Task 13 e declarado/consumido na Task 14 com a mesma assinatura.
