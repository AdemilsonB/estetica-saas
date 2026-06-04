# Spec: Painel de Administração do Sistema

**Data:** 2026-06-04
**Status:** Aprovado
**Domínio:** IAM + Billing

---

## Contexto

O sistema possui limites por plano (máx. usuários, máx. cargos, máx. agendamentos, cota de WhatsApp) hardcoded em múltiplos arquivos — com duplicatas e valores inconsistentes entre `billing/types.ts` e `billing/feature-guard.ts`. Não existe forma de ajustar esses limites sem deploy, nem interface para o operador do sistema gerenciar planos, preços ou configurações de forma operacional.

Este feature cria o Painel Admin: uma área restrita a usuários com flag `isSystemAdmin: true` no Supabase, acessível via rota `/admin/*` dentro do mesmo Next.js app. Resolve também a proliferação de hardcodes movendo todos os limites e feature flags de plano para o banco de dados.

---

## Objetivo

1. Painel web em `/admin/*` acessível exclusivamente por usuários com `isSystemAdmin: true`
2. Gerenciar os 4 planos (FREE, STARTER, PRO, ENTERPRISE): nome de exibição, preço, descrição, ativo
3. Configurar quais seções de navegação e capacidades de billing cada plano inclui (`PlanFeatureConfig`)
4. Configurar limites numéricos de cada plano (`PlanLimitConfig`) — sem hardcode no código
5. Listar tenants cadastrados com plano atual e contagem de usuários
6. Remover todos os hardcodes de limite do código-fonte, substituindo por `PlanLimitsService`

---

## Identidade do Administrador

O ADMIN é um usuário Supabase com:
- Tenant próprio (funciona normalmente como dono de negócio)
- Flag `isSystemAdmin: true` no `app_metadata` do Supabase (setado via script de bootstrap ou Supabase Dashboard)

O admin acessa tanto `/agenda` (dashboard do seu tenant) quanto `/admin/` (painel do sistema). O AdminShell exibe um banner "Modo Admin" e link "Voltar ao meu negócio".

---

## Arquitetura

### Route group e layout

```
src/app/
├── (app)/                    ← dashboard de tenant (existente)
└── (admin)/                  ← painel admin (novo)
    ├── layout.tsx             ← AdminShell: sidebar + banner de modo admin
    ├── page.tsx               ← /admin/  overview
    ├── planos/
    │   ├── page.tsx           ← /admin/planos  lista dos 4 planos
    │   └── [planName]/
    │       └── page.tsx       ← /admin/planos/FREE  editor de plano
    └── tenants/
        └── page.tsx           ← /admin/tenants  lista de tenants
```

### Proteção por middleware

`src/middleware.ts` é estendido: rotas `/admin/*` verificam `isSystemAdmin: true` no `app_metadata` do Supabase. Se falso ou ausente, redireciona para `/agenda`.

API routes sob `/api/admin/*` chamam `getAdminContext(request)` — variante de `getSessionContext` que adiciona verificação de `isSystemAdmin` no token do Supabase.

```ts
// src/shared/auth/admin-context.ts
export async function getAdminContext(request: Request): Promise<SessionContext> {
  const session = await getSessionContext(request)
  const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(session.userId)
  if (!user?.app_metadata?.isSystemAdmin) {
    throw new ForbiddenError('Acesso restrito a administradores do sistema.')
  }
  return session
}
```

### API Routes admin

```
GET  /api/admin/plans                          lista os 4 planos com metadados
PUT  /api/admin/plans/[planName]               atualiza displayName, price, description, isActive
GET  /api/admin/plans/[planName]/features      feature flags do plano (nav + billing)
PUT  /api/admin/plans/[planName]/features      atualiza feature flags
GET  /api/admin/plans/[planName]/limits        limites numéricos do plano
PUT  /api/admin/plans/[planName]/limits        atualiza limites
GET  /api/admin/tenants                        lista tenants (paginada) com plano + contagem de usuários
```

---

## Modelo de Dados

### Nova tabela `Plan`

```prisma
model Plan {
  id           String   @id @default(cuid())
  name         PlanName @unique
  displayName  String
  price        Decimal  @default(0) @db.Decimal(10, 2)
  description  String?
  isActive     Boolean  @default(true)
  displayOrder Int      @default(0)
  updatedAt    DateTime @updatedAt
}
```

Seeded com os 4 planos na migration. O enum `PlanName` já existe no Prisma — não muda.

### Nova tabela `PlanLimitConfig`

```prisma
model PlanLimitConfig {
  id        String   @id @default(cuid())
  plan      PlanName
  limitKey  String
  value     Int
  updatedAt DateTime @updatedAt

  @@unique([plan, limitKey])
  @@index([plan])
}
```

### `PlanFeatureConfig` — estendida (tabela já existe)

A tabela existente usa `sectionKey` para mapear seções de navegação (`agenda`, `clientes`…). Passa a também receber entradas de capacidades de billing:

```
sectionKey existentes (nav):    'agenda', 'clientes', 'financeiro', 'servicos', 'relatorios', 'equipe', 'configuracoes'
sectionKey novos (billing):     'whatsapp_basic', 'whatsapp_premium', 'reports_basic', 'reports_advanced', 'campaigns', 'multi_unit'
```

Na UI do admin, as duas categorias são exibidas em grupos distintos ("Navegação" e "Capacidades") mas persistidas na mesma tabela.

**Defaults de billing features por plano** (espelham o `PLAN_FEATURES` atual do feature-guard.ts):

| featureKey | FREE | STARTER | PRO | ENTERPRISE |
|---|---|---|---|---|
| reports_basic | ✅ | ✅ | ✅ | ✅ |
| whatsapp_basic | ❌ | ✅ | ✅ | ✅ |
| campaigns | ❌ | ✅ | ✅ | ✅ |
| reports_advanced | ❌ | ❌ | ✅ | ✅ |
| whatsapp_premium | ❌ | ❌ | ✅ | ✅ |
| multi_unit | ❌ | ❌ | ✅ | ✅ |

**Derivação de `FEATURE_MIN_PLAN` após remoção do hardcode:** O `feature-guard.ts` usa `FEATURE_MIN_PLAN` para exibir ao usuário qual plano ativar a feature. Com a migração, essa informação é derivada em runtime: "menor plano (por `Plan.displayOrder`) onde `PlanFeatureConfig.enabled = true` para este `sectionKey`". O `FeatureGuard.assertAccess` passa a fazer essa query no lugar de ler a constante.

---

## Catálogo de Limites — `LIMIT_REGISTRY`

Fonte única de verdade para todos os limites do sistema. Localizado em `src/shared/permissions/limit-registry.ts`. Os valores em `defaults` são o fallback caso `PlanLimitConfig` não tenha a entrada — garante funcionamento com banco recém-provisionado.

```ts
export const LIMIT_REGISTRY = {
  max_roles:               { label: 'Máximo de cargos',       unit: 'cargos',   defaults: { FREE: 3,    STARTER: 3,    PRO: 5,    ENTERPRISE: 999 } },
  max_users:               { label: 'Máximo de usuários',      unit: 'usuários', defaults: { FREE: 2,    STARTER: 5,    PRO: 20,   ENTERPRISE: 999 } },
  max_units:               { label: 'Máximo de unidades',      unit: 'unidades', defaults: { FREE: 1,    STARTER: 1,    PRO: 3,    ENTERPRISE: 999 } },
  max_appointments_month:  { label: 'Agendamentos/mês',        unit: 'agend.',   defaults: { FREE: 50,   STARTER: 300,  PRO: 2000, ENTERPRISE: 999999 } },
  max_whatsapp_month:      { label: 'WhatsApp/mês',            unit: 'msgs',     defaults: { FREE: 0,    STARTER: 500,  PRO: 2000, ENTERPRISE: 5000 } },
  max_email_month:         { label: 'E-mails/mês',             unit: 'e-mails',  defaults: { FREE: 100,  STARTER: 500,  PRO: 5000, ENTERPRISE: 999999 } },
} as const

export type LimitKey = keyof typeof LIMIT_REGISTRY
```

---

## `PlanLimitsService`

Centraliza toda leitura de limites. Substitui `ROLE_LIMITS`, `PLAN_LIMITS` (billing/types.ts) e `PLAN_LIMITS` (feature-guard.ts).

```ts
// src/domains/billing/plan-limits.service.ts
export class PlanLimitsService {
  async get(tenantId: string, limitKey: LimitKey): Promise<number> {
    const tenant = await prisma.tenant.findFirst({ where: { id: tenantId }, select: { plan: true } })
    const config = await prisma.planLimitConfig.findFirst({
      where: { plan: tenant!.plan, limitKey }
    })
    return config?.value ?? LIMIT_REGISTRY[limitKey].defaults[tenant!.plan]
  }

  async assertWithinLimit(tenantId: string, limitKey: LimitKey, currentCount: number): Promise<void> {
    const limit = await this.get(tenantId, limitKey)
    if (limit !== 999999 && currentCount >= limit) {
      throw new PlanLimitError(limitKey, limit, currentCount)
    }
  }
}

export const planLimitsService = new PlanLimitsService()
```

---

## Remoção de Hardcodes — Mapa de Substituições

| Arquivo | Hardcode removido | Substituído por |
|---|---|---|
| `src/domains/billing/types.ts` | `PLAN_LIMITS` (maxUsers, maxAppointmentsPerMonth, maxWhatsAppPerMonth, maxUnits) | `planLimitsService.get()` |
| `src/domains/billing/feature-guard.ts` | `PLAN_LIMITS` (users, appointments_month) — duplicata | `planLimitsService.assertWithinLimit()` |
| `src/domains/billing/feature-guard.ts` | `PLAN_FEATURES` (Set de features por plano) | `PlanFeatureConfig` no banco |
| `src/domains/billing/feature-guard.ts` | `FEATURE_MIN_PLAN` | Derivado de query em `PlanFeatureConfig` |
| `src/domains/iam/role.service.ts` | `ROLE_LIMITS` (max cargos por plano) | `planLimitsService.assertWithinLimit(tenantId, 'max_roles', count)` |

---

## Frontend do Painel Admin

### AdminShell

Layout próprio com sidebar de navegação (Visão Geral, Planos, Tenants). Banner vermelho/laranja no topo: "Modo Administrador — você está gerenciando o sistema". Link "Voltar ao meu negócio" navega para `/agenda`.

### `/admin/` — Visão Geral

Cards de resumo: total de tenants, distribuição por plano (FREE / STARTER / PRO / ENTERPRISE), tenants criados nos últimos 30 dias.

### `/admin/planos/` — Lista de Planos

4 cards lado a lado com nome, preço e status (ativo/inativo). Clique navega para o editor.

### `/admin/planos/[planName]/` — Editor de Plano

3 abas em um único formulário com botão "Salvar" global:

**Aba Metadados:**
- Nome de exibição (input texto)
- Preço mensal (input numérico, R$)
- Descrição (textarea)
- Ativo (toggle)

**Aba Funcionalidades:**
Grid de toggles agrupados em duas seções:
- `NAVEGAÇÃO` — seções do menu (`agenda`, `clientes`, `financeiro`…)
- `CAPACIDADES` — features de billing (`whatsapp_basic`, `reports_advanced`, `campaigns`…)

**Aba Limites:**
Tabela de inputs numéricos, um por `LimitKey` do `LIMIT_REGISTRY`. Cada linha: label, input, unidade. Valor vazio usa o default do registry.

### `/admin/tenants/` — Lista de Tenants

Tabela paginada com busca por nome. Colunas: Nome do negócio, Plano (badge colorido), Usuários, Data de cadastro.

### Hooks

```
src/hooks/admin/
  use-plans.ts           ← usePlans(), useUpdatePlan()
  use-plan-features.ts   ← usePlanFeatures(), useUpdatePlanFeatures()
  use-plan-limits.ts     ← usePlanLimits(), useUpdatePlanLimits()
  use-admin-tenants.ts   ← useAdminTenants()
```

---

## Segurança

| Risco | Guardrail |
|---|---|
| Acesso não autorizado ao painel | Middleware verifica `isSystemAdmin` no `app_metadata` do Supabase |
| API routes admin acessadas diretamente | `getAdminContext()` verifica flag no token em todo endpoint `/api/admin/*` |
| Limite configurado como 0 acidentalmente | UI exibe aviso quando valor é menor que o default do registry |
| Admin edita plano de tenant com assinatura ativa | Mudança em `PlanLimitConfig` afeta todos os tenants do plano imediatamente — sem transação retroativa neste MVP |

---

## Seed de Dados Iniciais

Migration inclui seed de:
1. Tabela `Plan` com os 4 planos e valores iniciais de preço/descrição
2. `PlanLimitConfig` com todos os valores do `LIMIT_REGISTRY.defaults` por plano
3. `PlanFeatureConfig` com entradas de billing features (complementa as entradas de nav sections já existentes)

---

## Fora do Escopo deste Feature (Camadas 2 e 3)

### Camada 2 — Comandos Operacionais (próxima iteração)
- `/admin/tenants/[tenantId]` — detalhe do tenant
- Impersonação: `POST /api/admin/tenants/[id]/impersonate` — token temporário para acessar o tenant como dono
- Comandos manuais: reprocessar fila pg-boss, forçar re-envio de notificação, forçar upgrade/downgrade de plano

### Camada 3 — Métricas de Consumo (iteração posterior)
- Tabela `UsageSnapshot`: `{ tenantId, limitKey, count, period (YYYY-MM) }` — populada por job pg-boss mensal
- Tela de tenants mostra barra de progresso `consumido / limite` por linha
- Badge de alerta para tenants acima de 80% do limite (candidatos a upgrade)
- Dashboard de consumo agregado por plano e por limitKey

---

## Checklist de Entrega

- [ ] Tabelas `Plan` e `PlanLimitConfig` no schema com seed
- [ ] `LIMIT_REGISTRY` em `src/shared/permissions/limit-registry.ts`
- [ ] `PlanLimitsService` substituindo todos os hardcodes mapeados
- [ ] `PlanFeatureConfig` com entradas de billing features no seed
- [ ] `getAdminContext` e middleware protegendo `/admin/*`
- [ ] API routes `/api/admin/*` com validação Zod
- [ ] AdminShell com navegação e banner de modo admin
- [ ] Páginas: visão geral, lista de planos, editor de plano (3 abas), lista de tenants
- [ ] `npx tsc --noEmit` — zero erros
- [ ] `npx vitest run` — todos os testes passando
- [ ] PR aberta para `main`
