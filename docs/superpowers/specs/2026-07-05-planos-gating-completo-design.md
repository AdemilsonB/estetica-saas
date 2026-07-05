# Programa: Sistema completo de planos, gating e limites

> **Data:** 2026-07-05
> **Tipo:** Spec de programa (arquitetura + fases). Cada fase gera seu próprio plano de implementação via `writing-plans`.
> **Status:** Em revisão

---

## 1. Contexto e problema

O sistema já tem a espinha dorsal de planos: `Plan`, `PlanFeatureConfig`, `PlanLimitConfig`,
`LIMIT_REGISTRY`, `FeatureGuard` e `PlanLimitsService`. Porém o levantamento revelou lacunas que
transformam a configuração do admin em "muitas suposições":

1. **Fonte de verdade dupla.** Os benefícios exibidos na página pública/onboarding vêm de
   `Plan.description` (texto livre digitado à mão), não da config real de features/limites.
   O admin pode vender "5 profissionais" com limite real de 3.
2. **Limites definidos mas não aplicados.** `max_units` não tem model `Unit` (multi-unidade é
   placeholder puro); `max_email_month` nunca é verificado; não há limite de serviços, produtos
   ou clientes. Aplicados de fato: só agendamentos/mês, usuários, cargos e WhatsApp/mês.
3. **Gating binário.** Relatórios é tudo-ou-nada (`relatorios` nav + flag único `reports_advanced`);
   não dá para configurar por relatório.
4. **UX de bloqueio inconsistente e hardcoded.** Relatórios faz `redirect('/agenda')` sem upsell;
   `UpgradeModal` tem bullets fixos, link de WhatsApp placeholder e não recebe qual plano libera o
   recurso; não existe padrão universal de "recurso cinza + flag apontando o próximo plano".
5. **Sem visão de consumo pro tenant.** Dois números soltos em Configurações → Planos; nada no
   dashboard, sem gráficos, sem %, sem alerta de proximidade de limite.
6. **Fluxo de upgrade sem clareza.** Nada explica proration, imediatismo, o que acontece com o
   plano atual, risco de cobrança dupla.
7. **Hardcode residual.** `PLAN_ORDER` cravado em ~4 arquivos; `NAV_SECTIONS`/`BILLING_FEATURES`
   duplicados; `REPORT_ITEMS` fixo.

**Princípio norteador:** MÍNIMO DE REGRAS HARDCODED. Praticamente todo o produto deve ser
configurável pelo admin, com uma única fonte de verdade por conceito.

---

## 2. Decisões tomadas (com o usuário)

| Decisão | Escolha |
|---|---|
| Escopo | **Programa completo** — Fases 0, A, B, C, D + enriquecimentos |
| Multi-unidade | **Removida da config** por ora (sem model `Unit`); mecanismo de "Em breve" fica disponível |
| Comportamento de upgrade | **Portal Stripe com proration imediata**; recurso libera na hora; tela explica sem ambiguidade |
| Benefícios na página de planos | **Auto-gerados da config + 1-3 destaques opcionais** do admin |
| Recursos essenciais | **Toggle travado** (Agenda, Serviços, Clientes, Equipe, Config) — só limites configuráveis |
| Limites no admin | **Categorizados** por grupo |

**Enriquecimentos aprovados:** soft-limit com avisos escalonados; trava de downgrade segura;
interceptor global de 402 → modal de upgrade; upsell proativo no widget ≥80%; guard de sanidade
da config no admin; `status` (`ga`/`soon`) no registry; painel de sinais de crescimento no admin.
**Fora:** ciclo de cobrança anual (fica para depois).

---

## 3. Arquitetura da fundação (Fase 0)

### 3.1 Registry unificado de capacidades

Novo arquivo `src/shared/permissions/capability-registry.ts`. Descreve **tudo** que o admin pode
gatilhar por plano. Substitui os arrays literais `NAV_SECTIONS`/`BILLING_FEATURES` do admin e a
constante `FEATURES` do feature-guard como fonte de verdade.

```ts
export type CapabilityCategory = 'nav' | 'capability' | 'report'
export type CapabilityStatus = 'ga' | 'soon'

export type Capability = {
  key: string                 // ex. 'relatorios', 'whatsapp_basic', 'report_financeiro'
  label: string               // rótulo PT-BR amigável
  category: CapabilityCategory
  essential: boolean          // true = não desligável (toggle travado no admin)
  benefitLabel: string        // linha exibida como benefício na página de planos
  status: CapabilityStatus    // 'ga' padrão; 'soon' = "Em breve", sem enforcement
  group: string               // agrupador de exibição no admin (ver 3.3)
}

export const CAPABILITY_REGISTRY: Capability[] = [ /* ... */ ]
```

Entradas iniciais:

- **nav essenciais** (`essential: true`): `agenda`, `servicos`, `clientes`, `equipe`, `configuracoes`
- **nav gateáveis:** `produtos`, `financeiro`, `relatorios`
- **capabilities:** `whatsapp_basic`, `whatsapp_premium`, `reports_advanced`, `campaigns`
- **reports granulares** (Fase C, `category: 'report'`): `report_visao_geral`, `report_financeiro`,
  `report_agendamentos`, `report_clientes`
- `multi_unit` **removida** dos arrays ativos (não aparece no admin nem na vitrine).

### 3.2 Registry de limites enriquecido

`LIMIT_REGISTRY` (em `limit-registry.ts`) ganha metadados de exibição, categorização e
comportamento hard/soft:

```ts
export type LimitKind = 'hard' | 'soft'

export type LimitMeta = {
  label: string
  unit: string
  benefitLabel: (value: number) => string   // "300 agendamentos/mês" | "Agendamentos ilimitados"
  unlimitedThreshold: number                  // acima disso = "Ilimitado"
  kind: LimitKind                             // hard = bloqueia; soft = avisa + folga
  group: string                               // categoria no admin
  defaults: Record<PlanName, number>
}
```

Limites (após Fase D): `max_roles`, `max_users`, `max_appointments_month` (soft),
`max_whatsapp_month`, `max_email_month`, `max_services`, `max_products`, `max_customers`.
`max_units` **removido**. Classificação hard/soft e grupos definidos em 6.1.

### 3.3 Categorias de exibição no admin (limites e features)

Agrupamento único usado tanto para features quanto limites, via campo `group`:

- **Acesso & Equipe** — nav sections, `max_users`, `max_roles`
- **Operação** — `max_appointments_month`, `max_services`
- **Catálogo & Estoque** — `produtos`, `max_products`
- **Comunicação** — `whatsapp_basic/premium`, `campaigns`, `max_whatsapp_month`, `max_email_month`
- **Clientes** — `clientes`, `max_customers`
- **Relatórios** — `relatorios`, `reports_advanced`, reports granulares

### 3.4 Ordem de planos derivada do banco

Novo helper `getPlanOrder()` em `src/domains/billing/plan-order.ts`: lê `Plan.displayOrder`
(cacheado por requisição). Substitui todo `PLAN_ORDER = [FREE, STARTER, PRO, ENTERPRISE]`
hardcoded (feature-guard, billing-plans-content, etc.).

### 3.5 Resolvedor único de gate

Novo método no `FeatureGuard` (ou serviço `GateResolver`):

```ts
resolveGate(tenantId, key): Promise<{
  allowed: boolean
  currentPlan: PlanName
  requiredPlan: PlanName | null      // menor plano que habilita a capacidade
  requiredPlanLabel: string | null   // displayName do plano exigido
}>
```

`assertAccess`, o layout de relatórios e as APIs passam a consumir `resolveGate`. É a fonte única
da resposta "o tenant pode? se não, qual o próximo plano?".

---

## 4. Fase A — Página de planos = espelho da config

### 4.1 Serviço de catálogo público

Novo `planCatalogService.getPublicPlans()` em `src/domains/billing/`:

```ts
type PublicPlan = {
  name: PlanName
  displayName: string
  price: number
  trialDays: number
  isPopular: boolean
  highlights: string[]   // 1-3 linhas de marketing do admin (opcional)
  benefits: string[]     // AUTO-gerado: capabilities ligadas (benefitLabel) + limites (benefitLabel(value))
}
```

`benefits` é montado a partir de `PlanFeatureConfig` (capacidades `enabled` e `status: 'ga'`) e
`PlanLimitConfig` (limites com `benefitLabel(value)`), na ordem das categorias de 3.3.
`highlights` vem de um novo campo estruturado (ver 4.2). **Nunca** de texto livre solto.

### 4.2 Admin: destaques + preview canônico

No editor de plano (`admin/planos/[planName]`):

- O campo "Benefícios do plano" (textarea livre → `Plan.description`) é **reaproveitado** como
  **"Destaques (opcional)"**: até 3 linhas de copy de marketing. Renomeado na UI; continua em
  `Plan.description` (1 linha por destaque) — sem migração de schema.
- Abaixo, um **preview read-only** da lista canônica de benefícios gerada por
  `getPublicPlans()`, para o admin ver exatamente o que o cliente verá.

### 4.3 Consumidores

`/planos` (público), `/onboarding` e a landing passam a consumir `getPublicPlans()`.
Remove-se o split de texto livre atual em `planos/page.tsx`.

---

## 5. Fase B — Padrão universal de bloqueio + upsell

### 5.1 API de capacidades

Novo `GET /api/billing/capabilities` (ou estende `/api/billing/status`): retorna, para cada
capacidade do registry, `{ key, allowed, requiredPlan, requiredPlanLabel }`. Hook
`useCapabilities()` no front.

### 5.2 Componente `<FeatureLock>`

`src/components/domain/billing/feature-lock.tsx`:

```tsx
<FeatureLock capability="reports_advanced">
  <ConteudoDoRecurso />
</FeatureLock>
```

- **Permitido:** renderiza `children` normalmente.
- **Bloqueado:** renderiza `children` esmaecido/cinza (blur + overlay) + selo clicável
  **"Disponível no plano {requiredPlanLabel}"** (cadeado). Clique → `UpgradeModal` com contexto.
- Variante `mode="badge"` (só o selo, sem overlay) para itens de menu.
- Ao abrir o modal a partir de um lock, registra interesse (ver 8.3, sinais de crescimento).

### 5.3 `UpgradeModal` reescrito

Recebe `{ capabilityKey, requiredPlan, requiredPlanLabel, price }`. Corpo:

- Título: "Desbloqueie {label do recurso}".
- Benefícios reais do plano exigido (via `getPublicPlans`).
- **Explicação do upgrade (sem ambiguidade):**
  > "O upgrade é **imediato** — o recurso libera na hora. Você paga apenas a **diferença
  > proporcional** (proration) do período atual; **não há cobrança dupla**. O plano anterior é
  > substituído automaticamente."
- Botão primário → `useBillingActions`: Portal Stripe (se já tem assinatura) ou Checkout
  (se não tem). Remove link de WhatsApp placeholder e rota errada.

### 5.4 Aplicação do padrão

- **Menu lateral (`app-shell`):** seções gateáveis sem acesso passam a aparecer **bloqueadas**
  (`FeatureLock mode="badge"`) em vez de sumir. Essenciais nunca são afetadas. `useNavSections`
  passa a devolver também as seções bloqueadas com flag `locked`.
- **Relatórios (`relatorios/layout`):** troca `redirect('/agenda')` por render do esqueleto com
  `<FeatureLock capability="relatorios">` — mostra a vitrine bloqueada com upsell.
- **Interceptor global de 402 (enriquecimento):** no client (wrapper do TanStack Query / fetch),
  qualquer resposta `402 PLAN_LIMIT_EXCEEDED` abre o `UpgradeModal` com o contexto de
  `{limitType, limit, current}` mapeado para a capacidade/limite correspondente.

---

## 6. Fase D — Limites completos + widget de consumo

> Fase D vem descrita antes de C por dependência: o widget e o registry de limites consolidam a
> fundação usada por C. A ordem de implementação real segue 0 → A → B → **C → D** ou **D → C**
> conforme o plano; ambas dependem só da Fase 0.

### 6.1 Novos limites e classificação hard/soft

| limitKey | kind | group | enforcement |
|---|---|---|---|
| `max_users` | hard | Acesso & Equipe | iam.service (já existe) |
| `max_roles` | hard | Acesso & Equipe | role.service (já existe) |
| `max_appointments_month` | **soft** | Operação | scheduling.service (muda para soft) |
| `max_services` | hard | Operação | **novo** — service.service |
| `max_products` | hard | Catálogo & Estoque | **novo** — product/inventory service |
| `max_customers` | hard | Clientes | **novo** — crm.service |
| `max_whatsapp_month` | hard | Comunicação | whatsapp-quota (já existe) |
| `max_email_month` | hard | Comunicação | **novo** — email provider/quota |

### 6.2 Comportamento soft-limit (enriquecimento)

`PlanLimitsService` ganha `checkUsage(tenantId, limitKey, current)` →
`{ status: 'ok' | 'warning' | 'exceeded', percent, limit, current }`:

- `warning` a partir de **80%**.
- `exceeded` em 100%. Para `kind: 'soft'`, permite uma **folga de cortesia** configurável
  (ex.: +10%) antes de bloquear de fato — durante a folga, banner persistente + upsell, mas o
  atendimento não trava. `kind: 'hard'` bloqueia em 100% (comportamento atual).
- `assertWithinLimit` continua lançando `PlanLimitError` para hard; para soft, só lança após a
  folga.

### 6.3 Enforcement unificado

Todos os domínios passam a chamar um único ponto (`planLimitsService.assertWithinLimit` /
`checkUsage`), com `PlanLimitError` (402) padronizado — capturado pelo interceptor global (5.4).

### 6.4 Widget de consumo no dashboard

Novo componente no dashboard do tenant (`/dashboard`):

- **Cartões de consumo** por limite relevante: `current / limit`, **barra de progresso** com %
  e cor por faixa (verde <80%, âmbar 80-99%, vermelho ≥100%).
- **Gráfico de tendência** (Recharts, já no projeto) por limite mensal usando `UsageSnapshot`
  (histórico já populado pelo job) + o mês corrente ao vivo.
- **Upsell proativo (enriquecimento):** ao atingir ≥80% em qualquer limite, cartão de destaque
  acionável ("Você usou 92% dos agendamentos — faltam N dias") → `UpgradeModal`.
- Endpoint `GET /api/billing/usage` consolidando contagens ao vivo + snapshots + limites.

### 6.5 Extensão do job de snapshot

`handleUsageSnapshot` passa a capturar também `services`, `products`, `email_month`
(além dos atuais). Chaves alinhadas com o registry.

---

## 7. Fase C — Gating granular de relatórios

- Cada relatório vira uma capability `category: 'report'` no registry: `report_visao_geral`,
  `report_financeiro`, `report_agendamentos`, `report_clientes`.
- Admin ganha, na categoria **Relatórios**, toggles por relatório além de `reports_advanced`.
- `REPORT_ITEMS` (hardcoded na `reports-sidebar`) passa a ser derivado do registry + capacidades
  do tenant. Relatórios sem acesso aparecem no menu de relatórios **bloqueados** (`FeatureLock`),
  não somem.
- Cada página de relatório envolve o conteúdo restrito com `<FeatureLock capability="report_x">`.
- **Reconciliação com `reports_advanced`:** relatórios granulares controlam *visibilidade* por
  plano; `reports_advanced` continua controlando *profundidade* (ex.: quebra por profissional,
  exportação). Definido no plano de implementação da Fase C.

---

## 8. Enriquecimentos transversais

### 8.1 Trava de downgrade segura

Antes de efetivar um downgrade (seleção in-app e retorno do Portal), `billingService` compara o
uso atual com os limites do plano alvo (`getDowngradeBlockers(tenantId, targetPlan)` →
lista de `{ limitKey, current, target }`). Se houver bloqueadores:

- **In-app:** exibe checklist do que resolver antes ("Você tem 5 usuários; o plano Starter
  permite 2 — remova 3 ou mantenha o Pro") e impede o downgrade.
- **Portal Stripe:** como o downgrade é hosted, faz reconciliação no webhook — se o novo plano
  quebra limites, mantém o tenant funcional (não deleta dados) e exibe banner de resolução
  pendente no painel. Detalhes no plano da fase.

### 8.2 Guard de sanidade da config (admin)

Ao salvar features/limites de um plano, valida e **avisa** (não bloqueia salvamento salvo casos
críticos):

- Monotonicidade: plano de ordem maior não deveria ter limite menor que o de ordem menor.
- Essencial desligado: capability `essential: true` nunca pode ficar `enabled: false` (bloqueia).
- Capability `status: 'soon'` não deve contar como benefício vendável.

### 8.3 Painel de sinais de crescimento (admin)

- Novo model aditivo `CapabilityInterestLog { id, tenantId, capabilityKey, createdAt }`, escrito
  quando o `UpgradeModal` abre a partir de um lock ou de um 402.
- Nova seção no `/admin` (Visão Geral ou aba própria): **tenants perto do limite** (candidatos a
  expansão) e **ranking de recursos bloqueados mais clicados** (o que puxa upgrade).

---

## 9. Modelos de dados (mudanças de schema)

Aditivas apenas (nenhum drop destrutivo):

- **Nenhuma** para novos limites/reports: são linhas em `PlanLimitConfig`/`PlanFeatureConfig`
  (chaves string) + entradas no registry.
- **Novo** `CapabilityInterestLog` (8.3) — aditivo, com `@@index([capabilityKey])` e
  `@@index([tenantId])`.
- `max_units`/`multi_unit`: linhas existentes ficam inertes (não exibidas); sem drop.

Seeds (`seed-plan-features.ts`, `seed-admin-data.ts`) atualizados para popular as novas chaves
com defaults coerentes por plano.

---

## 10. Tratamento de erros

- `PlanLimitError` (402, já existe) permanece o canal de limites; ganha, no `data`, a `capability`
  associada para o interceptor mapear ao `UpgradeModal`.
- `PlanFeatureError` (403/402) permanece para features; `requiredPlan` vem do `resolveGate`.
- Nenhuma string genérica; tudo via erros de domínio tipados (regra do projeto).

---

## 11. Estratégia de testes

- **Fase 0:** unit do `resolveGate` (permitido/bloqueado/plano exigido correto), `getPlanOrder`
  (deriva do banco), registry (essenciais nunca desligáveis).
- **Fase A:** `getPublicPlans` gera benefícios corretos a partir de config; destaques opcionais.
- **Fase B:** `FeatureLock` (permitido vs bloqueado), `UpgradeModal` (contexto certo), interceptor
  402.
- **Fase C:** gating por relatório; sidebar derivada do registry.
- **Fase D:** soft vs hard (folga de cortesia), novos enforcements, `checkUsage` faixas 80/100,
  endpoint de usage.
- **Enriquecimentos:** `getDowngradeBlockers`, guard de sanidade, escrita de `CapabilityInterestLog`.
- Cobertura por camada conforme CLAUDE.md (service 80%, repo 60%, API 70%).

---

## 12. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Esconder→bloquear no menu pode confundir usuários atuais | Selo claro "Disponível no plano X"; essenciais intocados |
| Soft-limit com folga pode virar abuso | Folga pequena e configurável; hard para limites sensíveis |
| Downgrade via Portal é hosted (fora do nosso controle) | Reconciliação no webhook sem deletar dados + banner |
| Divergência benefício↔config em planos legados | `getPublicPlans` é a única fonte; preview no admin |
| Escopo grande | Fases independentes; cada uma com plano e PR próprios |

---

## 13. Fora de escopo (explícito)

- Ciclo de cobrança **anual** (Stripe annual prices) — futuro.
- Model `Unit` / multi-unidade real — futuro; mecanismo `status: 'soon'` fica pronto.
- Overage billing (cobrar por excedente) — futuro.

---

## 14. Ordem de execução

```
Fase 0 (Fundação)  ──►  Fase A (Planos = config)
       │                      │
       └──►  Fase B (Lock + upsell + interceptor 402)
                    │
                    ├──►  Fase C (Relatórios granulares)
                    └──►  Fase D (Limites completos + widget + soft-limit)
                                 │
            Enriquecimentos transversais (downgrade, sanidade, sinais) acoplados às fases
```

Cada fase recebe seu próprio plano de implementação (`docs/superpowers/plans/…`) e PR para a `main`.
