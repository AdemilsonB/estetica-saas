# Lote de Ganhos Rápidos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar 4 features de baixo risco e superfície isolada — filtro por profissional nos relatórios (#188), selo "Mais procurado" na vitrine (#169), painel de sinais de crescimento no admin (#252) e guard de sanidade da config de planos (#254).

**Architecture:** Cada feature é independente e vai em commit(s) próprio(s). Nenhuma exige migration de schema. #188 é UI pura (backend já aceita `professionalId`). #169 adiciona uma agregação no repository público da vitrine, exposta no payload SSR (ISR 300s, sem cron). #252 e #254 adicionam serviços de leitura em `billing` + rotas `/api/admin/**` + UI no admin.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Prisma, TanStack Query, Shadcn UI, Tailwind, Vitest.

## Global Constraints

- Todo output em Português do Brasil (código, comentários, copy, commits).
- Sem `any`, sem `as unknown as`. TypeScript strict.
- Multi-tenancy: toda query filtra `tenantId`; `tenantId` vem do contexto de sessão, nunca do body/URL.
- Rotas `/api/admin/**` protegidas por `getAdminContext(request)` (valida `isSystemAdmin` + rate limit).
- Erros tipados de `src/shared/errors/` — nunca `throw new Error('string')` em código de domínio.
- Selo #169: só dado real de `Appointment`, nunca valor fixo/mockado.
- `npx tsc --noEmit` limpo e `npx vitest run` verde ao fim de cada task.
- Checklist mobile-first (`agent-mobile`) nas partes de UI voltadas ao usuário final (#188, #169).
- Ordem de implementação: Fase 1 (#188) → Fase 2 (#169) → Fase 3 (#252) → Fase 4 (#254).

## File Structure

**Fase 1 — #188 (filtro por profissional):**
- Create: `src/components/domain/reports/report-professional-filter.tsx` — Select single de profissional.
- Create: `src/components/domain/reports/__tests__/report-professional-filter.test.tsx`
- Modify: `src/app/(app)/relatorios/financeiro/financeiro-client.tsx` — estado + filtro.
- Modify: `src/app/(app)/relatorios/agendamentos/agendamentos-client.tsx` — idem.
- Modify: `src/app/(app)/relatorios/clientes/clientes-client.tsx` — idem.

**Fase 2 — #169 (selo Mais procurado):**
- Modify: `src/domains/scheduling/public-booking.repository.ts` — `findMostBookedItem`.
- Create: `src/domains/scheduling/__tests__/public-booking-most-booked.test.ts`
- Modify: `src/domains/scheduling/public-booking.service.ts` — expõe `mostBooked` no payload.
- Modify: `src/app/(public)/[slug]/page.tsx` — passa `mostBooked` para as seções.
- Create: `src/components/domain/vitrine/most-booked-badge.tsx` — badge reutilizável.
- Modify: `src/components/domain/vitrine/vitrine-services-list.tsx` — renderiza badge.
- Modify: `src/components/domain/vitrine/vitrine-packages-section.tsx` — renderiza badge.

**Fase 3 — #252 (sinais de crescimento):**
- Create: `src/domains/billing/growth-signals.service.ts` — `getGrowthSignals`.
- Create: `src/domains/billing/growth-signals.service.test.ts`
- Create: `src/app/api/admin/growth-signals/route.ts` — GET protegido.
- Create: `src/hooks/admin/use-growth-signals.ts`
- Create: `src/components/admin/admin-growth-signals.tsx` — 2 widgets.
- Modify: `src/app/(admin)/admin/page.tsx` — monta a seção.

**Fase 4 — #254 (guard de sanidade):**
- Create: `src/domains/billing/plan-config-sanity.service.ts` — `getPlanConfigWarnings`.
- Create: `src/domains/billing/plan-config-sanity.service.test.ts`
- Create: `src/app/api/admin/plans/sanity/route.ts` — GET protegido.
- Create: `src/hooks/admin/use-plan-config-warnings.ts`
- Modify: `src/app/(admin)/admin/planos/[planName]/page.tsx` — banner de avisos.
- Modify: `src/app/api/admin/plans/[planName]/features/route.ts` — força essential=true.
- Modify (test): `src/app/api/admin/plans/[planName]/features/route.test.ts` (criar se não existir).

---

## FASE 1 — #188: Filtro por profissional nos relatórios

### Task 1: Componente `ReportProfessionalFilter`

**Files:**
- Create: `src/components/domain/reports/report-professional-filter.tsx`
- Test: `src/components/domain/reports/__tests__/report-professional-filter.test.tsx`

**Interfaces:**
- Consumes: `useTeamMembers()` de `src/hooks/iam/use-team.ts` → `TeamMember[]` com `{ id: string; name: string }`.
- Produces: `ReportProfessionalFilter({ value, onChange }: { value: string; onChange: (id: string) => void })`. Valor `'all'` = todos.

- [ ] **Step 1: Escrever o teste que falha**

```tsx
// src/components/domain/reports/__tests__/report-professional-filter.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ReportProfessionalFilter } from '../report-professional-filter'

vi.mock('@/hooks/iam/use-team', () => ({
  useTeamMembers: () => ({
    data: [
      { id: 'u1', name: 'Ana' },
      { id: 'u2', name: 'Bruno' },
    ],
  }),
}))

describe('ReportProfessionalFilter', () => {
  it('mostra o rótulo padrão "Todos os profissionais" quando value = all', () => {
    render(<ReportProfessionalFilter value="all" onChange={() => {}} />)
    expect(screen.getByText('Todos os profissionais')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/components/domain/reports/__tests__/report-professional-filter.test.tsx`
Expected: FAIL — `Cannot find module '../report-professional-filter'`.

- [ ] **Step 3: Implementar o componente**

```tsx
// src/components/domain/reports/report-professional-filter.tsx
'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTeamMembers } from '@/hooks/iam/use-team'

type Props = {
  value: string
  onChange: (id: string) => void
}

export function ReportProfessionalFilter({ value, onChange }: Props) {
  const { data: members = [] } = useTeamMembers()

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-52">
        <SelectValue placeholder="Todos os profissionais" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos os profissionais</SelectItem>
        {members.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run src/components/domain/reports/__tests__/report-professional-filter.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/domain/reports/report-professional-filter.tsx src/components/domain/reports/__tests__/report-professional-filter.test.tsx
git commit -m "feat(relatorios): componente ReportProfessionalFilter (seleção única de profissional)"
```

---

### Task 2: Ligar o filtro nos 3 relatórios

**Files:**
- Modify: `src/app/(app)/relatorios/financeiro/financeiro-client.tsx`
- Modify: `src/app/(app)/relatorios/agendamentos/agendamentos-client.tsx`
- Modify: `src/app/(app)/relatorios/clientes/clientes-client.tsx`

**Interfaces:**
- Consumes: `ReportProfessionalFilter` (Task 1); os hooks `useFinancialReport`/`useAppointmentsReport`/`useCustomersReport` já aceitam `professionalId?: string` (verificado).

- [ ] **Step 1: Financeiro — importar, estado, filtro e parâmetro**

Em `financeiro-client.tsx`:

Adicionar import:
```tsx
import { ReportProfessionalFilter } from '@/components/domain/reports/report-professional-filter'
```

Adicionar estado (após a linha do `categoryId`):
```tsx
const [professionalId, setProfessionalId] = useState<string>('all')
```

Passar no hook `useFinancialReport({ ... })` (adicionar a linha):
```tsx
    professionalId: professionalId === 'all' ? undefined : professionalId,
```

Inserir o filtro na linha de filtros, logo após `<CategorySelect ... />`:
```tsx
          <ReportProfessionalFilter value={professionalId} onChange={setProfessionalId} />
```

- [ ] **Step 2: Agendamentos — mesma ligação**

Em `agendamentos-client.tsx`: mesmo import; estado `const [professionalId, setProfessionalId] = useState<string>('all')`; adicionar `professionalId: professionalId === 'all' ? undefined : professionalId,` no `useAppointmentsReport({ ... })`; inserir `<ReportProfessionalFilter value={professionalId} onChange={setProfessionalId} />` após `<CategorySelect ... />`.

- [ ] **Step 3: Clientes — mesma ligação**

Em `clientes-client.tsx`: mesmo import; estado `professionalId`; adicionar `professionalId: professionalId === 'all' ? undefined : professionalId,` no `useCustomersReport({ ... })`; inserir o filtro junto aos demais filtros da tela (seguir o mesmo container `flex flex-wrap gap-3` usado ali — abrir o arquivo e posicionar ao lado dos filtros existentes de período/serviço).

- [ ] **Step 4: Verificar tipos e testes**

Run: `npx tsc --noEmit`
Expected: zero erros.

Run: `npx vitest run src/app/\(app\)/relatorios`
Expected: PASS (ou nenhum teste correspondente — sem falhas novas).

- [ ] **Step 5: Checklist mobile**

Confirmar visualmente (dev server) que o novo `Select` respeita `w-full` no mobile e `sm:w-52` no desktop, alinhado aos demais filtros. Sem overflow horizontal.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/relatorios/financeiro/financeiro-client.tsx" "src/app/(app)/relatorios/agendamentos/agendamentos-client.tsx" "src/app/(app)/relatorios/clientes/clientes-client.tsx"
git commit -m "feat(relatorios): filtro por profissional em Financeiro, Agendamentos e Clientes (#188)"
```

---

## FASE 2 — #169: Selo "Mais procurado" na vitrine

### Task 3: Agregação `findMostBookedItem` no repository

**Files:**
- Modify: `src/domains/scheduling/public-booking.repository.ts`
- Test: `src/domains/scheduling/__tests__/public-booking-most-booked.test.ts`

**Interfaces:**
- Produces: `publicBookingRepository.findMostBookedItem(tenantId: string): Promise<{ type: 'service' | 'package'; id: string } | null>`.
- Constantes de regra: janela 90 dias, mínimo 5, status `['CONFIRMED', 'COMPLETED']`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/domains/scheduling/__tests__/public-booking-most-booked.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/shared/database/prisma'
import { publicBookingRepository } from '../public-booking.repository'

vi.mock('@/shared/database/prisma', () => ({
  prisma: { appointment: { groupBy: vi.fn() } },
}))

describe('findMostBookedItem', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna o serviço de maior volume acima do mínimo', async () => {
    vi.mocked(prisma.appointment.groupBy)
      // 1ª chamada: por serviceId
      .mockResolvedValueOnce([{ serviceId: 's1', _count: { _all: 8 } }] as never)
      // 2ª chamada: por packageId
      .mockResolvedValueOnce([{ packageId: 'p1', _count: { _all: 6 } }] as never)

    const result = await publicBookingRepository.findMostBookedItem('t1')
    expect(result).toEqual({ type: 'service', id: 's1' })
  })

  it('retorna null quando nada cruza o mínimo de 5', async () => {
    vi.mocked(prisma.appointment.groupBy)
      .mockResolvedValueOnce([{ serviceId: 's1', _count: { _all: 3 } }] as never)
      .mockResolvedValueOnce([{ packageId: 'p1', _count: { _all: 2 } }] as never)

    const result = await publicBookingRepository.findMostBookedItem('t1')
    expect(result).toBeNull()
  })

  it('escolhe o pacote quando ele tem mais volume que o serviço', async () => {
    vi.mocked(prisma.appointment.groupBy)
      .mockResolvedValueOnce([{ serviceId: 's1', _count: { _all: 6 } }] as never)
      .mockResolvedValueOnce([{ packageId: 'p1', _count: { _all: 9 } }] as never)

    const result = await publicBookingRepository.findMostBookedItem('t1')
    expect(result).toEqual({ type: 'package', id: 'p1' })
  })
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/domains/scheduling/__tests__/public-booking-most-booked.test.ts`
Expected: FAIL — `findMostBookedItem is not a function`.

- [ ] **Step 3: Implementar o método**

No topo de `public-booking.repository.ts`, garantir o import do prisma (já existe no arquivo). Adicionar dentro da classe `PublicBookingRepository`:

```ts
  /**
   * Item (serviço ou pacote) com maior volume de agendamentos nos últimos 90 dias,
   * considerando só status CONFIRMED/COMPLETED e um mínimo de 5 para evitar destacar
   * amostra pequena. Retorna null se nada cruzar o mínimo. Usado pelo selo "Mais
   * procurado" da vitrine — sempre dado real, nunca valor fixo.
   */
  async findMostBookedItem(
    tenantId: string,
  ): Promise<{ type: 'service' | 'package'; id: string } | null> {
    const MIN_BOOKINGS = 5
    const WINDOW_DAYS = 90
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000)
    const baseWhere = {
      tenantId,
      status: { in: ['CONFIRMED', 'COMPLETED'] as const },
      startsAt: { gte: since },
    }

    const [byService, byPackage] = await Promise.all([
      prisma.appointment.groupBy({
        by: ['serviceId'],
        where: { ...baseWhere, serviceId: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { serviceId: 'desc' } },
        take: 1,
      }),
      prisma.appointment.groupBy({
        by: ['packageId'],
        where: { ...baseWhere, packageId: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { packageId: 'desc' } },
        take: 1,
      }),
    ])

    const topService = byService[0]
    const topPackage = byPackage[0]
    const serviceCount = topService?._count._all ?? 0
    const packageCount = topPackage?._count._all ?? 0

    const best = Math.max(serviceCount, packageCount)
    if (best < MIN_BOOKINGS) return null

    if (serviceCount >= packageCount && topService?.serviceId) {
      return { type: 'service', id: topService.serviceId }
    }
    if (topPackage?.packageId) {
      return { type: 'package', id: topPackage.packageId }
    }
    return null
  }
```

Nota: se o `orderBy` por `_count: { serviceId }` gerar erro de tipagem do Prisma no schema atual, trocar por `orderBy: { _count: { _all: 'desc' } }` — ambos são aceitos em versões recentes; usar o que o `tsc` aceitar.

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run src/domains/scheduling/__tests__/public-booking-most-booked.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 6: Commit**

```bash
git add src/domains/scheduling/public-booking.repository.ts src/domains/scheduling/__tests__/public-booking-most-booked.test.ts
git commit -m "feat(vitrine): agregação findMostBookedItem (serviço/pacote mais agendado, 90d, mín. 5) (#169)"
```

---

### Task 4: Expor `mostBooked` no payload SSR e propagar até os cards

**Files:**
- Modify: `src/domains/scheduling/public-booking.service.ts`
- Modify: `src/app/(public)/[slug]/page.tsx`
- Create: `src/components/domain/vitrine/most-booked-badge.tsx`
- Modify: `src/components/domain/vitrine/vitrine-services-list.tsx`
- Modify: `src/components/domain/vitrine/vitrine-packages-section.tsx`

**Interfaces:**
- Consumes: `publicBookingRepository.findMostBookedItem` (Task 3).
- Produces: payload SSR ganha `mostBooked: { type: 'service' | 'package'; id: string } | null` (top-level, ao lado de `team`/`products`). Componentes recebem `mostBookedServiceId?: string | null` e `mostBookedPackageId?: string | null`.

- [ ] **Step 1: Adicionar a agregação ao `loadVitrine`**

Em `public-booking.service.ts`, dentro de `loadVitrine`, incluir a nova chamada no `Promise.all` e expor o resultado no retorno.

No `Promise.all` (adicionar item):
```ts
    publicBookingRepository.findMostBookedItem(tenant.id),
```
Ajustar a desestruturação:
```ts
  const [services, professionals, packages, promotions, team, products, mostBooked] = await Promise.all([
```
No objeto de retorno, adicionar após `products: products.map(...)` (top-level, irmão de `team`):
```ts
    mostBooked,
```

- [ ] **Step 2: Criar o badge reutilizável**

```tsx
// src/components/domain/vitrine/most-booked-badge.tsx
import { Flame } from 'lucide-react'

export function MostBookedBadge({ primaryColor }: { primaryColor: string }) {
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium text-white"
      style={{ backgroundColor: primaryColor }}
      title="Serviço mais agendado"
    >
      <Flame className="size-2.5" />
      Mais procurado
    </span>
  )
}
```

- [ ] **Step 3: Renderizar no card de serviço**

Em `vitrine-services-list.tsx`:

Adicionar import:
```tsx
import { MostBookedBadge } from './most-booked-badge'
```

Estender `Props` e `ServiceCard` com `mostBookedServiceId?: string | null`:
- No `type Props`, adicionar: `mostBookedServiceId?: string | null`.
- Repassar de `VitrineServicesList` para cada `ServiceCard` via prop `isMostBooked={service.id === mostBookedServiceId}`.
- Em `ServiceCard`, aceitar `isMostBooked: boolean`.

Substituir o bloco de badge existente (o `anamneseMode === 'REQUIRED'`) por um **container empilhável** no mesmo canto, para os dois badges coexistirem:
```tsx
      <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
        {isMostBooked && <MostBookedBadge primaryColor={primaryColor} />}
        {service.anamneseMode === 'REQUIRED' && (
          <span
            className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium text-white"
            style={{ backgroundColor: primaryColor }}
            title="Requer ficha de saúde"
          >
            <ClipboardList className="size-2.5" />
            Ficha
          </span>
        )}
      </div>
```
(Remover o `<span ... absolute left-2 top-2 ...>` antigo do "Ficha", já que agora vive dentro do container.)

- [ ] **Step 4: Renderizar no card de pacote**

Em `vitrine-packages-section.tsx`, de forma análoga:
- Import do `MostBookedBadge`.
- `type Props` ganha `mostBookedPackageId?: string | null`; repassar `isMostBooked={pkg.id === mostBookedPackageId}` ao card.
- Abrir o arquivo, localizar o badge "Economize" (canto do card) e envolvê-lo junto do `MostBookedBadge` num container `absolute left-2 top-2 flex flex-col items-start gap-1`, de modo que, quando ambos existam, empilhem verticalmente sem sobrepor. Se o "Economize" estiver hoje em outro canto (ex.: `right-2`), manter onde está e posicionar o `MostBookedBadge` sozinho em `absolute left-2 top-2` — o objetivo é só garantir que não se sobreponham.

- [ ] **Step 5: Passar as props na página da vitrine**

Em `src/app/(public)/[slug]/page.tsx`:

Após `const { tenant, team, products } = data`, derivar:
```tsx
  const mostBookedServiceId = data.mostBooked?.type === 'service' ? data.mostBooked.id : null
  const mostBookedPackageId = data.mostBooked?.type === 'package' ? data.mostBooked.id : null
```

Passar `mostBookedServiceId={mostBookedServiceId}` em `<VitrineServicesList ... />` e `mostBookedPackageId={mostBookedPackageId}` em `<VitrinePackagesSection ... />`.

- [ ] **Step 6: Verificar tipos e build da vitrine**

Run: `npx tsc --noEmit`
Expected: zero erros.

Run: `npx vitest run src/domains/scheduling`
Expected: PASS (sem regressão nos testes de `public-booking`).

- [ ] **Step 7: Checklist mobile**

No dev server, abrir uma vitrine cujo tenant tenha ≥5 agendamentos confirmados/concluídos no serviço campeão: confirmar que o selo aparece só em 1 card, empilha corretamente com "Ficha"/"Economize" quando houver, e não vaza do card no mobile.

- [ ] **Step 8: Commit**

```bash
git add src/domains/scheduling/public-booking.service.ts "src/app/(public)/[slug]/page.tsx" src/components/domain/vitrine/most-booked-badge.tsx src/components/domain/vitrine/vitrine-services-list.tsx src/components/domain/vitrine/vitrine-packages-section.tsx
git commit -m "feat(vitrine): selo 'Mais procurado' nos cards de serviço/pacote (#169)"
```

---

## FASE 3 — #252: Painel de sinais de crescimento no admin

### Task 5: Serviço `getGrowthSignals`

**Files:**
- Create: `src/domains/billing/growth-signals.service.ts`
- Test: `src/domains/billing/growth-signals.service.test.ts`

**Interfaces:**
- Consumes: `prisma.capabilityInterestLog`, `prisma.tenant`, `getTenantUsage` de `usage.service.ts` (`UsageItem[]`), `CAPABILITY_REGISTRY` (label por key).
- Produces:
```ts
export type BlockedCapabilitySignal = { key: string; label: string; count: number }
export type TenantNearLimitSignal = { tenantId: string; tenantName: string; items: UsageItem[] }
export type GrowthSignals = {
  topBlockedCapabilities: BlockedCapabilitySignal[]
  tenantsNearLimit: TenantNearLimitSignal[]
}
export async function getGrowthSignals(): Promise<GrowthSignals>
```

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/domains/billing/growth-signals.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/shared/database/prisma'
import * as usage from '@/domains/billing/usage.service'
import { getGrowthSignals } from './growth-signals.service'

vi.mock('@/shared/database/prisma', () => ({
  prisma: {
    capabilityInterestLog: { groupBy: vi.fn() },
    tenant: { findMany: vi.fn() },
  },
}))
vi.mock('@/domains/billing/usage.service', () => ({ getTenantUsage: vi.fn() }))

describe('getGrowthSignals', () => {
  beforeEach(() => vi.clearAllMocks())

  it('ranqueia capacidades bloqueadas e inclui só tenants fora de "ok"', async () => {
    vi.mocked(prisma.capabilityInterestLog.groupBy).mockResolvedValue([
      { capabilityKey: 'reports_advanced', _count: { _all: 12 } },
      { capabilityKey: 'whatsapp_premium', _count: { _all: 4 } },
    ] as never)
    vi.mocked(prisma.tenant.findMany).mockResolvedValue([
      { id: 't1', name: 'Salão A' },
      { id: 't2', name: 'Salão B' },
    ] as never)
    vi.mocked(usage.getTenantUsage).mockImplementation(async (tenantId: string) =>
      tenantId === 't1'
        ? ([{ limitKey: 'max_users', label: 'Usuários', current: 5, limit: 5, percent: 100, status: 'exceeded', kind: 'hard', unlimited: false }] as never)
        : ([{ limitKey: 'max_users', label: 'Usuários', current: 1, limit: 5, percent: 20, status: 'ok', kind: 'hard', unlimited: false }] as never),
    )

    const result = await getGrowthSignals()

    expect(result.topBlockedCapabilities[0]).toMatchObject({ key: 'reports_advanced', count: 12 })
    expect(result.topBlockedCapabilities[0].label).toBeTruthy()
    expect(result.tenantsNearLimit).toHaveLength(1)
    expect(result.tenantsNearLimit[0].tenantId).toBe('t1')
  })
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/domains/billing/growth-signals.service.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar o serviço**

```ts
// src/domains/billing/growth-signals.service.ts
import { prisma } from '@/shared/database/prisma'
import { SubscriptionStatus } from '@prisma/client'
import { getTenantUsage, type UsageItem } from '@/domains/billing/usage.service'
import { CAPABILITY_REGISTRY } from '@/shared/permissions/capability-registry'

export type BlockedCapabilitySignal = { key: string; label: string; count: number }
export type TenantNearLimitSignal = { tenantId: string; tenantName: string; items: UsageItem[] }
export type GrowthSignals = {
  topBlockedCapabilities: BlockedCapabilitySignal[]
  tenantsNearLimit: TenantNearLimitSignal[]
}

const INTEREST_WINDOW_DAYS = 90
const TOP_N = 10

// NOTA DE CUSTO: o scan de "perto do limite" é O(tenants ativos × limites). Na escala
// atual (dezenas de tenants) é irrelevante. Se a base crescer para centenas, migrar
// para leitura de UsageSnapshot pré-calculado em vez de recalcular por tenant aqui.
export async function getGrowthSignals(): Promise<GrowthSignals> {
  const since = new Date(Date.now() - INTEREST_WINDOW_DAYS * 24 * 60 * 60 * 1000)

  const grouped = await prisma.capabilityInterestLog.groupBy({
    by: ['capabilityKey'],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
    orderBy: { _count: { capabilityKey: 'desc' } },
    take: TOP_N,
  })

  const labelByKey = new Map(CAPABILITY_REGISTRY.map((c) => [c.key, c.label]))
  const topBlockedCapabilities: BlockedCapabilitySignal[] = grouped.map((g) => ({
    key: g.capabilityKey,
    label: labelByKey.get(g.capabilityKey) ?? g.capabilityKey,
    count: g._count._all,
  }))

  const tenants = await prisma.tenant.findMany({
    where: {
      subscription: { status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] } },
    },
    select: { id: true, name: true },
  })

  const tenantsNearLimit: TenantNearLimitSignal[] = []
  for (const t of tenants) {
    const items = await getTenantUsage(t.id)
    const flagged = items.filter((i) => i.status !== 'ok')
    if (flagged.length > 0) {
      tenantsNearLimit.push({ tenantId: t.id, tenantName: t.name, items: flagged })
    }
  }

  return { topBlockedCapabilities, tenantsNearLimit }
}
```

Nota: se `orderBy: { _count: { capabilityKey: 'desc' } }` não passar no `tsc`, usar `orderBy: { _count: { _all: 'desc' } }`.

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run src/domains/billing/growth-signals.service.test.ts`
Expected: PASS.

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 6: Commit**

```bash
git add src/domains/billing/growth-signals.service.ts src/domains/billing/growth-signals.service.test.ts
git commit -m "feat(admin): serviço getGrowthSignals — capacidades bloqueadas + tenants perto do limite (#252)"
```

---

### Task 6: Rota, hook e UI dos sinais de crescimento

**Files:**
- Create: `src/app/api/admin/growth-signals/route.ts`
- Create: `src/hooks/admin/use-growth-signals.ts`
- Create: `src/components/admin/admin-growth-signals.tsx`
- Modify: `src/app/(admin)/admin/page.tsx`

**Interfaces:**
- Consumes: `getGrowthSignals` (Task 5), `getAdminContext` de `src/shared/auth/admin-context.ts`.
- Produces: `GET /api/admin/growth-signals` → `GrowthSignals`; hook `useGrowthSignals()`; componente `<AdminGrowthSignals />`.

- [ ] **Step 1: Criar a rota protegida**

```ts
// src/app/api/admin/growth-signals/route.ts
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getGrowthSignals } from '@/domains/billing/growth-signals.service'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    await getAdminContext(request)
    const signals = await getGrowthSignals()
    return Response.json(signals)
  } catch (error) {
    return handleApiError(error)
  }
}
```

Padrão exato replicado de `src/app/api/admin/plans/route.ts`: `initializeDomainRuntime()` no topo, `getAdminContext(request)` dentro do `try`, `Response.json(...)` e `handleApiError(error)` no catch.

- [ ] **Step 2: Criar o hook**

```ts
// src/hooks/admin/use-growth-signals.ts
import { useQuery } from '@tanstack/react-query'
import type { GrowthSignals } from '@/domains/billing/growth-signals.service'

async function fetchGrowthSignals(): Promise<GrowthSignals> {
  const res = await fetch('/api/admin/growth-signals')
  if (!res.ok) throw new Error('Falha ao carregar sinais de crescimento')
  return res.json()
}

export function useGrowthSignals() {
  return useQuery({ queryKey: ['admin', 'growth-signals'], queryFn: fetchGrowthSignals, staleTime: 60_000 })
}
```

- [ ] **Step 3: Criar o componente de UI**

```tsx
// src/components/admin/admin-growth-signals.tsx
'use client'

import { useGrowthSignals } from '@/hooks/admin/use-growth-signals'

export function AdminGrowthSignals() {
  const { data, isLoading } = useGrowthSignals()

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Recursos bloqueados mais clicados</h2>
        <p className="mb-3 text-xs text-slate-400">Últimos 90 dias — o que mais puxa upgrade.</p>
        {isLoading ? (
          <p className="text-sm text-slate-400">Carregando…</p>
        ) : (data?.topBlockedCapabilities.length ?? 0) === 0 ? (
          <p className="text-sm text-slate-400">Nenhum clique de interesse registrado no período.</p>
        ) : (
          <ul className="space-y-2">
            {data!.topBlockedCapabilities.map((c) => (
              <li key={c.key} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">{c.label}</span>
                <span className="font-semibold text-slate-950">{c.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Tenants perto do limite</h2>
        <p className="mb-3 text-xs text-slate-400">Assinantes ativos/trial com algum limite ≥ 80% — candidatos a expansão.</p>
        {isLoading ? (
          <p className="text-sm text-slate-400">Carregando…</p>
        ) : (data?.tenantsNearLimit.length ?? 0) === 0 ? (
          <p className="text-sm text-slate-400">Nenhum tenant perto do limite.</p>
        ) : (
          <ul className="space-y-3">
            {data!.tenantsNearLimit.map((t) => (
              <li key={t.tenantId} className="text-sm">
                <p className="font-medium text-slate-800">{t.tenantName}</p>
                <p className="text-xs text-slate-500">
                  {t.items.map((i) => `${i.label} ${i.percent}%`).join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Montar na home do admin**

Em `src/app/(admin)/admin/page.tsx`:

Adicionar import:
```tsx
import { AdminGrowthSignals } from '@/components/admin/admin-growth-signals'
```

Após `<AdminPlanDistribution />`, adicionar a seção:
```tsx
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-slate-950">Sinais de crescimento</h2>
        <AdminGrowthSignals />
      </div>
```

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/growth-signals/route.ts src/hooks/admin/use-growth-signals.ts src/components/admin/admin-growth-signals.tsx "src/app/(admin)/admin/page.tsx"
git commit -m "feat(admin): painel de sinais de crescimento na home (#252)"
```

---

## FASE 4 — #254: Guard de sanidade da config de planos

### Task 7: Serviço `getPlanConfigWarnings`

**Files:**
- Create: `src/domains/billing/plan-config-sanity.service.ts`
- Test: `src/domains/billing/plan-config-sanity.service.test.ts`

**Interfaces:**
- Consumes: `getPlanOrder()` de `plan-order.ts`, `prisma.planLimitConfig`, `prisma.planFeatureConfig`, `LIMIT_REGISTRY`, `CAPABILITY_REGISTRY`.
- Produces:
```ts
export type PlanConfigWarning = { severity: 'warning'; plan: string; message: string }
export async function getPlanConfigWarnings(): Promise<PlanConfigWarning[]>
```

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/domains/billing/plan-config-sanity.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/shared/database/prisma'
import * as order from '@/domains/billing/plan-order'
import { getPlanConfigWarnings } from './plan-config-sanity.service'

vi.mock('@/shared/database/prisma', () => ({
  prisma: {
    planLimitConfig: { findMany: vi.fn() },
    planFeatureConfig: { findMany: vi.fn() },
  },
}))
vi.mock('@/domains/billing/plan-order', () => ({ getPlanOrder: vi.fn() }))

describe('getPlanConfigWarnings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('aponta monotonicidade quebrada (plano maior com limite menor)', async () => {
    vi.mocked(order.getPlanOrder).mockResolvedValue(['STARTER', 'PRO'] as never)
    vi.mocked(prisma.planLimitConfig.findMany).mockResolvedValue([
      { plan: 'STARTER', limitKey: 'max_users', value: 5 },
      { plan: 'PRO', limitKey: 'max_users', value: 3 },
    ] as never)
    vi.mocked(prisma.planFeatureConfig.findMany).mockResolvedValue([] as never)

    const warnings = await getPlanConfigWarnings()
    expect(warnings.some((w) => w.plan === 'PRO' && /max_users|usuários/i.test(w.message))).toBe(true)
  })

  it('não aponta nada quando os limites são monotônicos', async () => {
    vi.mocked(order.getPlanOrder).mockResolvedValue(['STARTER', 'PRO'] as never)
    vi.mocked(prisma.planLimitConfig.findMany).mockResolvedValue([
      { plan: 'STARTER', limitKey: 'max_users', value: 5 },
      { plan: 'PRO', limitKey: 'max_users', value: 20 },
    ] as never)
    vi.mocked(prisma.planFeatureConfig.findMany).mockResolvedValue([] as never)

    const warnings = await getPlanConfigWarnings()
    expect(warnings).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/domains/billing/plan-config-sanity.service.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar o serviço**

```ts
// src/domains/billing/plan-config-sanity.service.ts
import { prisma } from '@/shared/database/prisma'
import { getPlanOrder } from '@/domains/billing/plan-order'
import { LIMIT_REGISTRY, type LimitKey } from '@/shared/permissions/limit-registry'
import { CAPABILITY_REGISTRY } from '@/shared/permissions/capability-registry'

export type PlanConfigWarning = { severity: 'warning'; plan: string; message: string }

/**
 * Avisos não-bloqueantes sobre a configuração dos planos, para o admin conferir
 * consistência. Read-only: monotonicidade precisa comparar planos entre si, e o
 * editor carrega um plano por vez. Não impede salvar — só sinaliza.
 */
export async function getPlanConfigWarnings(): Promise<PlanConfigWarning[]> {
  const [order, limits, features] = await Promise.all([
    getPlanOrder(),
    prisma.planLimitConfig.findMany({ select: { plan: true, limitKey: true, value: true } }),
    prisma.planFeatureConfig.findMany({ select: { plan: true, sectionKey: true, enabled: true } }),
  ])

  const warnings: PlanConfigWarning[] = []

  // 1. Monotonicidade: plano de ordem maior não deveria ter limite menor que um de ordem menor.
  const limitByPlanKey = new Map<string, number>()
  for (const l of limits) limitByPlanKey.set(`${l.plan}::${l.limitKey}`, l.value)

  const limitKeys = Object.keys(LIMIT_REGISTRY) as LimitKey[]
  for (const limitKey of limitKeys) {
    const meta = LIMIT_REGISTRY[limitKey]
    for (let i = 1; i < order.length; i++) {
      const higher = order[i]
      const lower = order[i - 1]
      const higherVal = limitByPlanKey.get(`${higher}::${limitKey}`)
      const lowerVal = limitByPlanKey.get(`${lower}::${limitKey}`)
      if (higherVal == null || lowerVal == null) continue
      // "ilimitado" é sempre >= qualquer finito — não conta como violação.
      const higherUnlimited = higherVal >= meta.unlimitedThreshold
      if (higherUnlimited) continue
      if (higherVal < lowerVal) {
        warnings.push({
          severity: 'warning',
          plan: higher,
          message: `"${meta.label}" no ${higher} (${higherVal}) é menor que no ${lower} (${lowerVal}).`,
        })
      }
    }
  }

  // 2. Capability status 'soon' ligada como benefício vendável.
  const soonKeys = new Set(CAPABILITY_REGISTRY.filter((c) => c.status === 'soon').map((c) => c.key))
  for (const f of features) {
    if (f.enabled && soonKeys.has(f.sectionKey)) {
      const cap = CAPABILITY_REGISTRY.find((c) => c.key === f.sectionKey)
      warnings.push({
        severity: 'warning',
        plan: f.plan,
        message: `"${cap?.label ?? f.sectionKey}" está marcada como "em breve" mas ativada no ${f.plan} — não deveria contar como benefício vendável.`,
      })
    }
  }

  return warnings
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run src/domains/billing/plan-config-sanity.service.test.ts`
Expected: PASS.

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 6: Commit**

```bash
git add src/domains/billing/plan-config-sanity.service.ts src/domains/billing/plan-config-sanity.service.test.ts
git commit -m "feat(admin): getPlanConfigWarnings — monotonicidade + capability 'em breve' vendável (#254)"
```

---

### Task 8: Rota + hook + banner de avisos no editor

**Files:**
- Create: `src/app/api/admin/plans/sanity/route.ts`
- Create: `src/hooks/admin/use-plan-config-warnings.ts`
- Modify: `src/app/(admin)/admin/planos/[planName]/page.tsx`

**Interfaces:**
- Consumes: `getPlanConfigWarnings` (Task 7), `getAdminContext`.
- Produces: `GET /api/admin/plans/sanity` → `PlanConfigWarning[]`; hook `usePlanConfigWarnings()`; banner no editor.

- [ ] **Step 1: Criar a rota**

```ts
// src/app/api/admin/plans/sanity/route.ts
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getPlanConfigWarnings } from '@/domains/billing/plan-config-sanity.service'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    await getAdminContext(request)
    const warnings = await getPlanConfigWarnings()
    return Response.json(warnings)
  } catch (error) {
    return handleApiError(error)
  }
}
```

(Mesmo padrão das demais rotas admin: `initializeDomainRuntime()`, `Response.json`, `handleApiError`.)

- [ ] **Step 2: Criar o hook**

```ts
// src/hooks/admin/use-plan-config-warnings.ts
import { useQuery } from '@tanstack/react-query'
import type { PlanConfigWarning } from '@/domains/billing/plan-config-sanity.service'

async function fetchWarnings(): Promise<PlanConfigWarning[]> {
  const res = await fetch('/api/admin/plans/sanity')
  if (!res.ok) throw new Error('Falha ao carregar avisos de configuração')
  return res.json()
}

export function usePlanConfigWarnings() {
  return useQuery({ queryKey: ['admin', 'plan-config-warnings'], queryFn: fetchWarnings, staleTime: 60_000 })
}
```

- [ ] **Step 3: Banner no editor de plano**

Em `src/app/(admin)/admin/planos/[planName]/page.tsx`:

Adicionar import:
```tsx
import { usePlanConfigWarnings } from '@/hooks/admin/use-plan-config-warnings'
```

No corpo do componente (junto aos demais hooks):
```tsx
  const { data: warnings = [] } = usePlanConfigWarnings()
  const planWarnings = warnings.filter((w) => w.plan === planName)
  const otherWarnings = warnings.filter((w) => w.plan !== planName)
```

Logo após o `<h1>Plano {plan.displayName}</h1>`, inserir o banner:
```tsx
      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">Avisos de sanidade da configuração</p>
          {planWarnings.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-700">
              {planWarnings.map((w, i) => (
                <li key={`this-${i}`}>{w.message}</li>
              ))}
            </ul>
          )}
          {otherWarnings.length > 0 && (
            <p className="mt-2 text-xs text-amber-600">
              +{otherWarnings.length} aviso(s) em outros planos.
            </p>
          )}
          <p className="mt-2 text-xs text-amber-500">Avisos não bloqueiam o salvamento — são só para conferência.</p>
        </div>
      )}
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/plans/sanity/route.ts src/hooks/admin/use-plan-config-warnings.ts "src/app/(admin)/admin/planos/[planName]/page.tsx"
git commit -m "feat(admin): banner de avisos de sanidade no editor de plano (#254)"
```

---

### Task 9: Reforço server-side — essential nunca desligável

**Files:**
- Modify: `src/app/api/admin/plans/[planName]/features/route.ts`
- Test: `src/app/api/admin/plans/[planName]/features/route.test.ts` (criar se não existir)

**Interfaces:**
- Consumes: `CAPABILITY_REGISTRY` (campo `essential`).
- Produces: o handler `PUT` de features força `enabled: true` para toda capability `essential`, ignorando o que veio no body. (Verificado: a rota exporta `GET` e `PUT`; o `PUT` valida via `validateInput(request, updateFeaturesSchema)`, faz `Promise.all(features.map(... upsert ...))` e registra `logAdminAction`.)

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/app/api/admin/plans/[planName]/features/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/shared/database/prisma'
import { PUT } from './route'

vi.mock('@/shared/database/prisma', () => ({
  prisma: { planFeatureConfig: { upsert: vi.fn(), findMany: vi.fn().mockResolvedValue([]) } },
}))
vi.mock('@/shared/auth/admin-context', () => ({ getAdminContext: vi.fn().mockResolvedValue({ userId: 'admin' }) }))
vi.mock('@/shared/audit/admin-audit', () => ({ logAdminAction: vi.fn() }))
vi.mock('@/app/api/_lib/runtime', () => ({ initializeDomainRuntime: vi.fn() }))
vi.mock('@/shared/http/validate-input', () => ({
  validateInput: vi.fn(async (req: Request) => req.json()),
}))

describe('features route — essential enforcement', () => {
  beforeEach(() => vi.clearAllMocks())

  it('força enabled=true para capability essential mesmo recebendo false', async () => {
    const body = { features: [{ sectionKey: 'agenda', enabled: false }] }
    const req = new Request('http://x/api/admin/plans/STARTER/features', {
      method: 'PUT',
      body: JSON.stringify(body),
    })
    await PUT(req, { params: Promise.resolve({ planName: 'STARTER' }) })

    const call = vi.mocked(prisma.planFeatureConfig.upsert).mock.calls.find(
      ([arg]) => (arg as { create: { sectionKey: string } }).create.sectionKey === 'agenda',
    )
    expect(call).toBeTruthy()
    const arg = call![0] as { create: { enabled: boolean }; update: { enabled: boolean } }
    expect(arg.create.enabled).toBe(true)
    expect(arg.update.enabled).toBe(true)
  })
})
```

Nota: `agenda` é `essential: true` no `CAPABILITY_REGISTRY` (via `NAV_META`). O mock de `validateInput` só devolve o body parseado, refletindo o comportamento real.

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run "src/app/api/admin/plans/[planName]/features/route.test.ts"`
Expected: FAIL — `enabled` chega como `false`.

- [ ] **Step 3: Implementar o reforço**

Em `features/route.ts`:

Adicionar import (junto aos demais no topo):
```ts
import { CAPABILITY_REGISTRY } from '@/shared/permissions/capability-registry'
```

Adicionar a constante em nível de módulo (após os imports):
```ts
const ESSENTIAL_KEYS = new Set(CAPABILITY_REGISTRY.filter((c) => c.essential).map((c) => c.key))
```

No handler `PUT`, logo após `const { features } = await validateInput(request, updateFeaturesSchema)`, derivar a versão saneada e usá-la nos dois pontos que hoje usam `features` (o `Promise.all(features.map(...))` e o `metadata: { features }` do `logAdminAction`):
```ts
    const safeFeatures = features.map((f) =>
      ESSENTIAL_KEYS.has(f.sectionKey) ? { ...f, enabled: true } : f,
    )
```
Trocar `features.map(({ sectionKey, enabled }) => ...)` por `safeFeatures.map(({ sectionKey, enabled }) => ...)` e `metadata: { features }` por `metadata: { features: safeFeatures }`.

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run "src/app/api/admin/plans/[planName]/features/route.test.ts"`
Expected: PASS.

- [ ] **Step 5: Verificar tipos e suíte de billing/admin**

Run: `npx tsc --noEmit`
Expected: zero erros.

Run: `npx vitest run src/domains/billing`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/admin/plans/[planName]/features/route.ts" "src/app/api/admin/plans/[planName]/features/route.test.ts"
git commit -m "fix(admin): força capability essential a permanecer ligada no save de features (#254)"
```

---

## Fechamento

- [ ] **Gate final:** `npx tsc --noEmit` (zero erros) + `npx vitest run` (sem falhas novas — comparar contra as falhas pré-existentes conhecidas: checkout não-atômico, appointment-reminder, customer-history ×2).
- [ ] **Atualizar `CLAUDE.md`:** domínio Reports (filtro por profissional entregue), Vitrine (selo Mais procurado), Admin (painel de sinais + guard de sanidade).
- [ ] **PR única** para `main` cobrindo as 4 fases, referenciando as issues #188, #169, #252, #254 no corpo. Ao mergear, fechar #169, #252, #254; deixar #188 aberta apenas se a parte 2 (exportação agendada) for tratada como issue separada — caso contrário, marcar a parte 1 como concluída no corpo do PR.

## Self-Review (feito pelo autor do plano)

- **Cobertura do spec:** Seção 1 (#188) → Tasks 1-2. Seção 2 (#169) → Tasks 3-4. Seção 3 (#252) → Tasks 5-6. Seção 4a (#254 avisos) → Tasks 7-8. Seção 4b (#254 essential) → Task 9. Transversal (testes, mobile, tsc) → embutido nos steps + Fechamento. ✔
- **Placeholders:** nenhum "TBD"/"implementar depois"; todo step de código tem o código. Pontos marcados como "abrir o arquivo e confirmar" (nome do helper de erro, método HTTP da rota de features, posição do badge Economize) são verificações locais concretas, não lacunas de design. ✔
- **Consistência de tipos:** `findMostBookedItem` retorna `{ type; id } | null` em Task 3 e é consumido assim em Task 4; `GrowthSignals`/`UsageItem` consistentes entre Tasks 5-6; `PlanConfigWarning` consistente entre Tasks 7-8. ✔
