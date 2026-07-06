# Planos — Fases C + D (Relatórios granulares + Limites completos + widget) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans. Steps usam checkbox (`- [ ]`).

**Goal:** Entregar juntas as Fases C (gating granular de relatórios — cada relatório é uma capacidade de visibilidade por plano, com `reports_advanced` seguindo como profundidade) e D (limites completos com enforcement de serviços/produtos/clientes/e-mail, soft-limit com folga fixa de 10%, e widget de consumo no dashboard).

**Architecture:** O `capability-registry` ganha 4 capacidades `report_*` (category `'report'`). A `reports-sidebar` e as páginas de relatório passam a ser dirigidas pelo registry + `useCapabilities`; cada método-base de relatório troca o gate de seção `'relatorios'` (Fase B) pelo gate do seu `report_*` específico (server-side, casando com o lock visual). `reports_advanced` continua gateando as consultas avançadas. O `limit-registry` ganha `max_services/max_products/max_customers` (hard). `PlanLimitsService.checkUsage` implementa o soft-limit (warning ≥80%, exceeded ≥100%, folga de cortesia de 10% para `kind:'soft'` antes de `assertWithinLimit` lançar). Novos enforcements chamam `assertWithinLimit` em service/product/customer/e-mail. Um endpoint `GET /api/billing/usage` consolida contagens ao vivo + limites + snapshots, consumido por um widget de consumo no dashboard (barras/% + tendência via `UsageSnapshot` + upsell ≥80%). O job `usage-snapshot` passa a capturar services/products/email.

**Tech Stack:** Next.js 15 App Router + TypeScript (strict), Prisma, Vitest (+ prismaMock), Shadcn UI, TanStack Query, Recharts.

## Global Constraints

- Todo output em **Português do Brasil**.
- TypeScript strict — sem `any`, sem `as unknown as`, sem `as FeatureName` (o parâmetro de `resolveGate`/`assertAccess` já é `string` desde a Fase B).
- Erros de domínio tipados; multi-tenancy (`tenantId` do token; contagens sempre filtram `tenantId`).
- **Nenhuma migration nesta entrega** — novos limites/reports são linhas em `PlanLimitConfig`/`PlanFeatureConfig` (chaves string) + entradas no registry + defaults em seed. (A única migration do programa, `CapabilityInterestLog`, foi na Fase B.)
- **Lição da Fase B (obrigatória):** trava de UI (`FeatureLock`) NÃO é controle de acesso — todo endpoint de dados novo/afetado mantém gate server-side próprio.
- Soft-limit: folga de cortesia **fixa de 10%** para `kind:'soft'`; `kind:'hard'` bloqueia em 100%.
- Relatórios: `report_*` = visibilidade por plano; `reports_advanced` = profundidade (mantido).
- Essenciais nunca bloqueiam.
- Commits frequentes, um por task. Não commitar em `main`.

---

## File Structure

**Fase C:**
- **Modify** `src/shared/permissions/capability-registry.ts` — 4 capacidades `report_*` (category `'report'`).
- **Modify** `src/shared/permissions/capability-registry.test.ts` — cobertura das reports.
- **Create** `src/shared/permissions/report-capabilities.ts` — mapa report_* → { label, href, rota-base } (fonte única p/ sidebar e páginas).
- **Modify** `src/components/domain/reports/reports-sidebar.tsx` — deriva itens do registry + `useCapabilities`; itens bloqueados com selo.
- **Modify** report pages (`src/app/(app)/relatorios/page.tsx` + `financeiro/`, `agendamentos/`, `clientes/`) — envolver conteúdo com `<FeatureLock capability="report_x">`.
- **Modify** `src/domains/reports/analytics.service.ts` + `src/domains/reports/reports.service.ts` — trocar o gate de `'relatorios'` (Fase B) pelo `report_*` específico de cada método-base.
- **Modify** `src/app/(admin)/admin/planos/[planName]/page.tsx` — renderizar toggles das capacidades `report_*`.
- **Modify** seed(s) de features — defaults de `report_*` por plano.

**Fase D:**
- **Modify** `src/shared/permissions/limit-registry.ts` — `max_services`, `max_products`, `max_customers`.
- **Modify** `src/shared/permissions/limit-registry.test.ts`.
- **Modify** `src/domains/billing/plan-limits.service.ts` — `checkUsage` + folga soft.
- **Modify** `src/domains/billing/plan-limits.service.test.ts`.
- **Modify** `src/domains/billing/feature-guard.ts` — `LIMIT_TYPE_MAP` ganha services/products/customers/email.
- **Modify** enforcement: `src/domains/catalog|scheduling` service de serviços, inventory service, `src/domains/crm` service, e o ponto de envio de e-mail.
- **Create** `src/app/api/billing/usage/route.ts` — consolida consumo.
- **Create** `src/domains/billing/usage.service.ts` + teste.
- **Create** `src/hooks/billing/use-usage.ts`.
- **Create** `src/components/domain/billing/usage-widget.tsx` — widget no dashboard.
- **Modify** `src/app/(app)/dashboard/page.tsx` — montar o widget.
- **Modify** `src/shared/queue/jobs/usage-snapshot.ts` — capturar services/products/email.
- **Modify** seed(s) de limites — defaults dos novos limites.

Pré-requisito de branch (primeiro passo):

```bash
git checkout main && git pull --ff-only
git checkout -b feat/planos-faseCD-relatorios-limites
```

> **Ambiente:** ignorar erros de `tsc` sob `.next/**`. `vitest run` completo tem ~7 falhas PRÉ-EXISTENTES (scheduling checkout atomicity, appointment-reminder, customer-history ×2, service-picker ×3) — não são regressão.

---

# PARTE C — Relatórios granulares

## Task C1: Capacidades report_* no registry

**Files:**
- Modify: `src/shared/permissions/capability-registry.ts`
- Modify: `src/shared/permissions/capability-registry.test.ts`

**Interfaces:** adiciona 4 entradas `Capability` com `category: 'report'`.

- [ ] **Step 1: Adicionar as capacidades ao registry**

No `capability-registry.ts`, adicionar um array `REPORT_ENTRIES` e incluí-lo no `CAPABILITY_REGISTRY`:

```ts
const REPORT_ENTRIES: Capability[] = [
  { key: 'report_visao_geral',  label: 'Relatório: Visão Geral',  category: 'report', essential: false, benefitLabel: 'Relatório de visão geral',   status: 'ga', group: CAPABILITY_GROUPS.RELATORIOS },
  { key: 'report_financeiro',   label: 'Relatório: Financeiro',   category: 'report', essential: false, benefitLabel: 'Relatório financeiro',        status: 'ga', group: CAPABILITY_GROUPS.RELATORIOS },
  { key: 'report_agendamentos', label: 'Relatório: Agendamentos', category: 'report', essential: false, benefitLabel: 'Relatório de agendamentos',   status: 'ga', group: CAPABILITY_GROUPS.RELATORIOS },
  { key: 'report_clientes',     label: 'Relatório: Clientes',     category: 'report', essential: false, benefitLabel: 'Relatório de clientes',        status: 'ga', group: CAPABILITY_GROUPS.RELATORIOS },
]

export const CAPABILITY_REGISTRY: Capability[] = [...NAV_ENTRIES, ...CAPABILITY_ENTRIES, ...REPORT_ENTRIES]
```

(São `essential:false` + `status:'ga'`, então entram em `getGateableCapabilities()` e aparecem em `/api/billing/capabilities` automaticamente.)

- [ ] **Step 2: Testes**

Adicionar ao `capability-registry.test.ts`:

```ts
it('inclui as 4 capacidades de relatório com category report e gateáveis', () => {
  for (const key of ['report_visao_geral', 'report_financeiro', 'report_agendamentos', 'report_clientes']) {
    const cap = getCapability(key)
    expect(cap?.category).toBe('report')
    expect(cap?.essential).toBe(false)
  }
  const gateableKeys = getGateableCapabilities().map((c) => c.key)
  expect(gateableKeys).toContain('report_financeiro')
})
```

- [ ] **Step 3: Rodar + commit**

Run: `npx vitest run src/shared/permissions/capability-registry.test.ts`
```bash
git add src/shared/permissions/capability-registry.ts src/shared/permissions/capability-registry.test.ts
git commit -m "feat(planos): capacidades report_* no registry (visibilidade granular de relatórios)"
```

---

## Task C2: Mapa de relatórios + sidebar dirigida pelo registry

**Files:**
- Create: `src/shared/permissions/report-capabilities.ts`
- Modify: `src/components/domain/reports/reports-sidebar.tsx`

**Interfaces:**
- Produces: `REPORT_CAPABILITIES: Array<{ capability: string; label: string; href: string }>` (fonte única, na ordem do menu).

- [ ] **Step 1: Criar o mapa único**

```ts
// src/shared/permissions/report-capabilities.ts
export type ReportCapability = { capability: string; label: string; href: string }

export const REPORT_CAPABILITIES: ReportCapability[] = [
  { capability: 'report_visao_geral',  label: 'Visão Geral',   href: '/relatorios' },
  { capability: 'report_financeiro',   label: 'Financeiro',    href: '/relatorios/financeiro' },
  { capability: 'report_agendamentos', label: 'Agendamentos',  href: '/relatorios/agendamentos' },
  { capability: 'report_clientes',     label: 'Clientes',      href: '/relatorios/clientes' },
]
```

- [ ] **Step 2: Sidebar deriva do mapa + useCapabilities**

Reescrever `reports-sidebar.tsx`: manter os ícones (mapear por href), iterar `REPORT_CAPABILITIES`, consultar `useCapabilities()`. Item cujo `caps[capability]?.allowed === false` renderiza BLOQUEADO — no desktop, um `<button>` (não-`<Link>`) com selo de cadeado que ao clicar chama `useUpgradeModal().openUpgrade({ capabilityKey, requiredPlan, requiredPlanLabel })` (mesmo padrão do menu lateral da Fase B); no mobile (Select), o item bloqueado fica `disabled` OU dispara o modal. Itens permitidos seguem navegando. Enquanto `useCapabilities` carrega (`data` undefined), tratar como permitido (não piscar cadeado). Preserve o layout mobile (Select) + desktop (lista) e o estado ativo. Os ícones (LineChart/BarChart2/Calendar/Users) passam a ser um mapa `href → ícone` local.

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc --noEmit` (ignorar `.next/`)
```bash
git add src/shared/permissions/report-capabilities.ts src/components/domain/reports/reports-sidebar.tsx
git commit -m "feat(planos): sidebar de relatórios dirigida pelo registry (locks por relatório)"
```

---

## Task C3: Gate server-side por relatório (páginas + serviços)

**Files:**
- Modify: `src/app/(app)/relatorios/page.tsx`, `financeiro/page.tsx`, `agendamentos/page.tsx`, `clientes/page.tsx`
- Modify: `src/domains/reports/analytics.service.ts`, `src/domains/reports/reports.service.ts`
- Modify: `src/domains/reports/analytics.service.test.ts`, `reports.service.test.ts`

**Interfaces:** cada método-base de relatório passa a exigir seu `report_*` (server-side); cada página envolve o conteúdo restrito com `<FeatureLock capability="report_x">`.

- [ ] **Step 1: Trocar o gate de seção pelo gate por relatório nos serviços**

Nos serviços de relatório, os métodos-base hoje fazem `await featureGuard.assertAccess(tenantId, 'relatorios')` (adicionado na Fase B). TROCAR cada um pelo `report_*` correspondente (LER os arquivos para achar cada método e mapear):
- `getOverviewReport` → `assertAccess(tenantId, 'report_visao_geral')`
- `getSeasonalityReport` → `assertAccess(tenantId, 'report_agendamentos')` (sazonalidade é vista de agendamentos)
- `getInactiveCustomersReport` → `assertAccess(tenantId, 'report_clientes')`
- `getFinancialReport` → `assertAccess(tenantId, 'report_financeiro')`
- `getAppointmentsReport` → `assertAccess(tenantId, 'report_agendamentos')`
- `getCustomersReport` → `assertAccess(tenantId, 'report_clientes')`

(O gate `reports_advanced` das consultas AVANÇADAS permanece inalterado — visibilidade e profundidade são independentes.) Confirme os nomes reais dos métodos ao editar.

- [ ] **Step 2: Ajustar os testes dos serviços**

Nos testes que hoje verificam "exige relatorios/reports_advanced antes de consultar", ajustar as asserções para o `report_*` correto por método (mock `assertAccess` rejeitando → método lança). Não enfraquecer.

- [ ] **Step 3: Envolver cada página com FeatureLock**

Em cada página de relatório, envolver o CONTEÚDO restrito com `<FeatureLock capability="report_x">` (client). Se a página é server component que já busca dados, o gate server (Step 1) já protege; o FeatureLock cobre a vitrine visual. Como as chamadas de dados são client (via hooks) OU server, garantir que o usuário sem acesso veja a vitrine bloqueada com upsell (não um erro cru). LER cada página e integrar de forma mínima.

- [ ] **Step 4: Rodar testes de reports + tsc + commit**

Run: `npx vitest run src/domains/reports && npx tsc --noEmit` (ignorar `.next/`)
```bash
git add src/app/"(app)"/relatorios src/domains/reports
git commit -m "feat(planos): gate server-side + FeatureLock por relatório (visibilidade granular)"
```

---

## Task C4: Admin — toggles das capacidades report_*

**Files:**
- Modify: `src/app/(admin)/admin/planos/[planName]/page.tsx`

- [ ] **Step 1: Renderizar as report caps na aba Funcionalidades**

O editor (Fase 0) hoje deriva `navCaps` (category `nav`) e `otherCaps` (category `capability`). Adicionar `reportCaps = CAPABILITY_REGISTRY.filter((c) => c.category === 'report')` e renderizar um bloco "Relatórios" com os toggles das `reportCaps` (mesmo padrão dos `otherCaps` — `Switch` ligado/desligado por `featureState[cap.key]`, salvo por `handleSaveFeatures` sem mudança de API). Preservar o resto do editor.

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` (ignorar `.next/`)
```bash
git add "src/app/(admin)/admin/planos/[planName]/page.tsx"
git commit -m "feat(planos): admin — toggles por relatório (report_*) no editor de planos"
```

---

## Task C5: Seeds — defaults de report_* por plano

**Files:**
- Modify: seed de features (LER `scripts/` para achar o seed que popula `PlanFeatureConfig`, ex.: `seed-plan-features.ts` / `seed-admin-data.ts`)

- [ ] **Step 1: Popular defaults**

Adicionar defaults coerentes de `report_*` por plano (ex.: FREE = só `report_visao_geral`; STARTER = visão geral + clientes; PRO/ENTERPRISE = todos). LER o seed atual para seguir o formato exato (chave `sectionKey`/`enabled` por plano). Documentar no relatório os defaults escolhidos.

- [ ] **Step 2: Commit**

```bash
git add scripts
git commit -m "feat(planos): seeds com defaults de report_* por plano"
```

---

# PARTE D — Limites completos + widget de consumo

## Task D1: Novos limites no registry

**Files:**
- Modify: `src/shared/permissions/limit-registry.ts`
- Modify: `src/shared/permissions/limit-registry.test.ts`

- [ ] **Step 1: Adicionar max_services / max_products / max_customers**

Adicionar ao `LIMIT_REGISTRY` (todos `kind:'hard'`):

```ts
  max_services: {
    label: 'Máximo de serviços', unit: 'serviços',
    benefitLabel: (v) => (v >= UNLIMITED ? 'Serviços ilimitados' : `${fmt(v)} serviços`),
    unlimitedThreshold: UNLIMITED, kind: 'hard', group: CAPABILITY_GROUPS.OPERACAO,
    defaults: { FREE: 10, STARTER: 50, PRO: 200, ENTERPRISE: UNLIMITED },
  },
  max_products: {
    label: 'Máximo de produtos', unit: 'produtos',
    benefitLabel: (v) => (v >= UNLIMITED ? 'Produtos ilimitados' : `${fmt(v)} produtos`),
    unlimitedThreshold: UNLIMITED, kind: 'hard', group: CAPABILITY_GROUPS.CATALOGO,
    defaults: { FREE: 10, STARTER: 100, PRO: 500, ENTERPRISE: UNLIMITED },
  },
  max_customers: {
    label: 'Máximo de clientes', unit: 'clientes',
    benefitLabel: (v) => (v >= UNLIMITED ? 'Clientes ilimitados' : `${fmt(v)} clientes`),
    unlimitedThreshold: UNLIMITED, kind: 'hard', group: CAPABILITY_GROUPS.CLIENTES,
    defaults: { FREE: 200, STARTER: 2000, PRO: 20000, ENTERPRISE: UNLIMITED },
  },
```

- [ ] **Step 2: Teste**

```ts
it('inclui max_services/products/customers como hard nos grupos certos', () => {
  expect(LIMIT_REGISTRY.max_services.kind).toBe('hard')
  expect(LIMIT_REGISTRY.max_products.group).toBe('Catálogo & Estoque')
  expect(LIMIT_REGISTRY.max_customers.benefitLabel(2000)).toBe('2.000 clientes')
})
```

- [ ] **Step 3: Rodar + commit**

Run: `npx vitest run src/shared/permissions/limit-registry.test.ts`
```bash
git add src/shared/permissions/limit-registry.ts src/shared/permissions/limit-registry.test.ts
git commit -m "feat(planos): limites max_services/products/customers no registry"
```

---

## Task D2: checkUsage + folga soft no PlanLimitsService

**Files:**
- Modify: `src/domains/billing/plan-limits.service.ts`
- Modify: `src/domains/billing/plan-limits.service.test.ts`

**Interfaces:**
- Produces: `checkUsage(tenantId, limitKey, current): Promise<{ status: 'ok'|'warning'|'exceeded'; percent: number; limit: number; current: number }>`; `assertWithinLimit` passa a respeitar a folga de 10% para `kind:'soft'`.

- [ ] **Step 1: Teste (faixas 80/100/folga)**

```ts
describe('checkUsage', () => {
  it('warning a partir de 80%, exceeded em 100%', async () => {
    // mock get() retornando limit 100
    expect((await service.checkUsage(TENANT_ID, 'max_users', 80)).status).toBe('warning')
    expect((await service.checkUsage(TENANT_ID, 'max_users', 100)).status).toBe('exceeded')
    expect((await service.checkUsage(TENANT_ID, 'max_users', 50)).status).toBe('ok')
  })
})
describe('assertWithinLimit soft', () => {
  it('soft: permite até +10% de folga, bloqueia acima', async () => {
    // max_appointments_month é soft; limit 300 → folga até 330
    await expect(service.assertWithinLimit(TENANT_ID, 'max_appointments_month', 320)).resolves.not.toThrow()
    await expect(service.assertWithinLimit(TENANT_ID, 'max_appointments_month', 331)).rejects.toThrow()
  })
})
```
(Mockar `service.get` para devolver o limite; ver o padrão do teste atual.)

- [ ] **Step 2: Implementar**

Importar `LIMIT_REGISTRY`. `checkUsage`: `limit = await this.get(...)`; se `limit >= unlimitedThreshold` → status `ok`, percent 0; senão `percent = current/limit*100`; `>=100 → exceeded`, `>=80 → warning`, senão `ok`. `assertWithinLimit`: obter `kind` de `LIMIT_REGISTRY[limitKey]`; `hard` = comportamento atual (bloqueia em `>= limit`); `soft` = bloqueia só em `current >= Math.floor(limit * 1.1)` (folga 10%). Manter o `PlanLimitError` (402) lançado.

- [ ] **Step 3: Rodar + commit**

Run: `npx vitest run src/domains/billing/plan-limits.service.test.ts`
```bash
git add src/domains/billing/plan-limits.service.ts src/domains/billing/plan-limits.service.test.ts
git commit -m "feat(planos): checkUsage (faixas 80/100) + folga de cortesia 10% para soft-limits"
```

---

## Task D3: Enforcement — serviços, produtos, clientes, e-mail

**Files:**
- Modify: `src/domains/billing/feature-guard.ts` (LIMIT_TYPE_MAP)
- Modify: service de criação de serviço; inventory/product service; crm service (criação de cliente); ponto de envio de e-mail.

- [ ] **Step 1: Estender o LIMIT_TYPE_MAP**

Em `feature-guard.ts`, o `LIMIT_TYPE_MAP` (e o tipo de `assertWithinLimit`) ganham `services→max_services`, `products→max_products`, `customers→max_customers`, `email_month→max_email_month`. (Alargar o union de `limitType` aceito.)

- [ ] **Step 2: Enforcement na criação (seguir o padrão de iam.service:195)**

Para CADA domínio, ANTES de criar, contar os existentes do tenant e chamar `assertWithinLimit`. LER cada service e integrar como `iam.service` faz para users:
- Serviço (criação de Service): `const count = await repo.count({ tenantId }); await featureGuard.assertWithinLimit(tenantId, 'services', count)`.
- Produto (inventory): idem com `'products'`.
- Cliente (crm create): idem com `'customers'`.
- E-mail: no ponto de envio (Resend), antes de enviar, contar e-mails do mês (ou usar um contador/qu& UsageSnapshot) e `assertWithinLimit(tenantId, 'email_month', count)`. Se não houver contador de e-mails/mês hoje, LER como o WhatsApp/mês é contado (`whatsapp-quota`) e seguir o mesmo padrão; se for custoso, documentar a abordagem no relatório e implementar a contagem mínima viável.

> Cada enforcement lança `PlanLimitError` (402) → capturado pelo interceptor global (Fase B). Adicionar/ajustar teste por service (mock `assertWithinLimit`). NÃO travar fluxos que não devem ter limite.

- [ ] **Step 3: Rodar testes dos domínios afetados + tsc + commit**

```bash
git add src/domains
git commit -m "feat(planos): enforcement de limite em serviços, produtos, clientes e e-mail"
```

---

## Task D4: usage.service + endpoint GET /api/billing/usage

**Files:**
- Create: `src/domains/billing/usage.service.ts`
- Create: `src/domains/billing/usage.service.test.ts`
- Create: `src/app/api/billing/usage/route.ts`
- Create: `src/hooks/billing/use-usage.ts`

**Interfaces:**
- Produces: `getTenantUsage(tenantId): Promise<UsageItem[]>` onde `UsageItem = { limitKey, label, current, limit, percent, status, kind, unlimited: boolean }` para os limites relevantes (users, appointments_month, services, products, customers, whatsapp_month, email_month); endpoint GET; hook `useUsage()`.

- [ ] **Step 1: Teste do serviço**

Mockar as contagens (prisma counts) + `planLimitsService.get`/`checkUsage`; asseverar que retorna itens com percent/status corretos e marca `unlimited` quando `limit >= unlimitedThreshold`.

- [ ] **Step 2: Implementar serviço + endpoint + hook**

`getTenantUsage`: para cada limitKey relevante, obter `current` (contagem ao vivo: users/appointments/services/products/customers via prisma count com `tenantId`; whatsapp/email via o mesmo contador do enforcement) e `checkUsage` → montar `UsageItem`. Endpoint GET com `getSessionContext` (tenantId do token) + `handleApiError`. Hook `useUsage()` (TanStack Query, staleTime 60s).

- [ ] **Step 3: Rodar + tsc + commit**

```bash
git add src/domains/billing/usage.service.ts src/domains/billing/usage.service.test.ts src/app/api/billing/usage/route.ts src/hooks/billing/use-usage.ts
git commit -m "feat(planos): usage.service + GET /api/billing/usage + hook useUsage"
```

---

## Task D5: Widget de consumo no dashboard

**Files:**
- Create: `src/components/domain/billing/usage-widget.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Widget**

`<UsageWidget />` (client): consome `useUsage()`. Renderiza um cartão por limite relevante: `current / limit` (ou "Ilimitado"), **barra de progresso** com % e cor por faixa (verde <80%, âmbar 80–99%, vermelho ≥100%). Estados loading/empty. **Upsell proativo:** para item com `status !== 'ok'` (≥80%), um cartão de destaque acionável (ex.: "Você usou 92% de agendamentos") que ao clicar chama `useUpgradeModal().openUpgrade({ limitType })` (modo limite do modal, Fase B). Mobile-first (grid 1 col → sm:2 → lg:3). Reaproveitar Recharts (já no projeto) para uma mini-tendência por limite mensal usando os snapshots, se o endpoint os expuser; se não, começar só com as barras (a tendência pode ser incremento posterior — documentar).

- [ ] **Step 2: Montar no dashboard**

LER `dashboard/page.tsx` e montar `<UsageWidget />` numa seção coerente (ex.: abaixo dos KPIs). Não regredir o layout existente.

- [ ] **Step 3: tsc + commit**

```bash
git add src/components/domain/billing/usage-widget.tsx "src/app/(app)/dashboard/page.tsx"
git commit -m "feat(planos): widget de consumo no dashboard (barras/% + upsell ≥80%)"
```

---

## Task D6: Estender o job de snapshot

**Files:**
- Modify: `src/shared/queue/jobs/usage-snapshot.ts`

- [ ] **Step 1: Capturar services/products/email**

LER `usage-snapshot.ts` (hoje captura appointments/whatsapp/customers/users). Adicionar a captura de `services` (count Service por tenant), `products` (count Product) e `email_month` (mesmo contador do enforcement), gravando com chaves alinhadas ao registry. Seguir o formato de gravação existente do `UsageSnapshot`.

- [ ] **Step 2: Rodar teste do job (se houver) + tsc + commit**

```bash
git add src/shared/queue/jobs/usage-snapshot.ts
git commit -m "feat(planos): job de snapshot captura services/products/email"
```

---

## Task D7: Seeds — defaults dos novos limites

**Files:**
- Modify: seed de limites (`scripts/…` que popula `PlanLimitConfig`)

- [ ] **Step 1: Popular defaults**

Adicionar `max_services/max_products/max_customers` por plano no seed (mesmos defaults do registry ou ajustados). LER o seed atual para o formato. Commit:

```bash
git add scripts
git commit -m "feat(planos): seeds com defaults dos novos limites"
```

---

## Verificação final da entrega

- [ ] `npx tsc --noEmit` — zero erros em `src/` (ignorar `.next/`)
- [ ] `npx vitest run` — sem falha NOVA (as ~7 pré-existentes permanecem)
- [ ] `npm run build` — compila/typecheck ok (page data pode falhar por env do sandbox)
- [ ] Abrir PR para `main` com título `feat(planos): Fases C+D — relatórios granulares + limites completos + widget`

---

## Self-Review (cobertura do spec §7 + §6)

- §7 cada relatório vira capability `category:'report'` → C1 ✅; sidebar derivada do registry com locks → C2 ✅; página envolta em FeatureLock + gate server-side por relatório → C3 ✅; admin toggles por relatório → C4 ✅; reconciliação `reports_advanced` (profundidade) × `report_*` (visibilidade) → C3 (mantém o gate advanced) ✅; seeds → C5 ✅.
- §6.1 novos limites hard (services/products/customers) + email enforcement → D1 + D3 ✅; §6.2 soft-limit com folga 10% + checkUsage faixas 80/100 → D2 ✅; §6.3 enforcement unificado via assertWithinLimit/PlanLimitError → D3 ✅; §6.4 widget de consumo (barras/%/cor/upsell ≥80%) + endpoint usage → D4 + D5 ✅; §6.5 extensão do job de snapshot → D6 ✅.

> Fora desta entrega (enriquecimentos §8, se o usuário quiser depois): trava de downgrade segura (§8.1), guard de sanidade da config no admin (§8.2), painel de sinais de crescimento no admin (§8.3 — lê o `CapabilityInterestLog` já gravado na Fase B). Tendência (gráfico Recharts) do widget pode entrar como incremento se os snapshots ainda não cobrirem o histórico. Nenhuma migration nesta entrega.
