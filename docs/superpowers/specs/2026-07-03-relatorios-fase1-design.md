# Spec — Relatórios Fase 1: visão de performance do negócio

**Data:** 2026-07-03
**Origem:** documento `especificacao-relatorios-agendei.md` (briefing de produto), refinado em sessão de brainstorming.
**Fase 2 (fora desta entrega):** LTV, taxa de recompra, cross-sell, tempo médio entre agendamentos, exportação PDF/Excel.

---

## 1. Objetivo

Evoluir a área `/relatorios` de tabelas simples para uma visão de performance do negócio:
gráficos, comparação com período anterior, novos recortes (evolução no tempo, participação
por serviço, sazonalidade, clientes inativos), filtros ampliados (ano, categoria) e paginação.

## 2. Estado atual (baseline)

- 4 relatórios: Financeiro, Agendamentos, Clientes, Profissionais (`src/app/(app)/relatorios/`).
- Backend em `src/domains/reports/reports.service.ts` (280 linhas): `findMany` + agregação em memória.
- KPIs em cards sem variação %; nenhum gráfico (sem lib de charts instalada).
- Filtro de período: hoje / semana / mês / mês passado / personalizado (`period-filter.tsx`).
- Filtros por profissional e serviço; sem categoria. Export CSV. Sem paginação.
- Gating: só Profissionais exige `reports_advanced` (via `featureGuard.assertAccess`).

## 3. Escopo funcional da Fase 1

| # | Item | Onde vive | Gating |
|---|------|-----------|--------|
| 1 | **Visão Geral** — KPIs com variação %, evolução no tempo (linha), participação por serviço (donut) | Nova landing `/relatorios` | `reports_advanced` |
| 2 | **Sazonalidade** — heatmap dia da semana × hora (volume de agendamentos) | Seção nova na página Agendamentos | `reports_advanced` |
| 3 | **Melhores clientes** — ranking ordenável (faturamento / frequência / ticket médio), coluna de ticket médio, data do último atendimento, paginação | Aba "Ranking" na página Clientes (enriquece o relatório atual) | plano base |
| 4 | **Clientes inativos** — sem agendamento há X dias (30/60/90/180, padrão 90), ordenado por valor histórico desc, ação "chamar no WhatsApp" (`wa.me`), paginação | Aba "Inativos" na página Clientes | `reports_advanced` |
| 5 | **Período ampliado** — presets: Hoje / 7 dias / Este mês / Mês passado / Este ano / Personalizado | Todos os relatórios | — |
| 6 | **Filtro por categoria de serviço** (`ServiceCategory`) | Visão Geral, Financeiro, Agendamentos | — |
| 7 | **Variação % vs. período anterior** nos KPIs (▲ verde / ▼ vermelho) | Visão Geral, Financeiro, Agendamentos, Clientes | — |

Decisões de gating: relatórios existentes continuam no plano base; **tudo que é novo entra em
`reports_advanced`** (reforça o upgrade sem tirar nada de ninguém).

Navegação: menu de relatórios vai de 4 → 5 itens (**Visão Geral**, Financeiro, Agendamentos,
Clientes, Profissionais). Mantém o padrão atual: sidebar no desktop, `Select` no mobile.

## 4. Backend — agregação no banco

Decisão: **agregar no PostgreSQL**, não em memória (série anual carregaria milhares de linhas
por request e inviabiliza paginação).

- Novo arquivo `src/domains/reports/analytics.service.ts` (não inflar `reports.service.ts`):
  - `getOverviewReport(tenantId, input)` — KPIs do período + KPIs do período anterior +
    série temporal + mix por serviço.
  - `getSeasonalityReport(tenantId, input)` — matriz dia da semana × hora com contagem.
  - `getInactiveCustomersReport(tenantId, input)` — clientes inativos paginados.
- **Série temporal:** `$queryRaw` tipado com `date_trunc` aplicado **no timezone do tenant**
  (`AT TIME ZONE`), seguindo o precedente de `reports.service.timezone.test.ts`.
  Granularidade automática pela janela: dia (≤ 31 dias), semana (≤ 120 dias), mês (acima).
- **Comparação:** período anterior = mesma duração imediatamente antes (`[from - duração, from)`).
  Uma query agregada extra por relatório. Variação em % (e p.p. para métricas que já são %).
- **Receita:** sempre `Transaction.netAmount` com fallback `amount`, somente `INCOME`,
  descontando estornos conforme o padrão existente (`isReversal`).
- **Ranking de clientes:** reescrito com `groupBy`/agregação no banco + paginação server-side
  (`skip`/`take`, 20 por página) + parâmetro `sortBy` (`receita` | `atendimentos` | `ticketMedio`).
- **Inativos:** último agendamento não-cancelado < hoje − X dias; valor histórico = soma de
  `netAmount` INCOME de todos os tempos; retorna nome, telefone, último atendimento,
  dias inativo, valor histórico. Paginado.
- **Rotas novas:** `GET /api/reports/overview`, `GET /api/reports/seasonality`,
  `GET /api/reports/customers/inactive`. Rota de clientes existente ganha `page`/`sortBy`.
  Controller fino: `getSessionContext()` + validação Zod (schemas em `domains/reports/types.ts`),
  `tenantId` sempre do token. Erros tipados de `src/shared/errors/`.
- **Filtro de categoria:** `categoryId` opcional nos schemas de overview, financeiro e
  agendamentos; join via `appointment.service.categoryId`.

## 5. Gráficos

- Instalar **Recharts** com os componentes de chart do Shadcn UI (tema via CSS vars da marca).
- Regras de cor (do briefing):
  - Paleta neutra com destaque para o top 1–3 dos rankings.
  - **Cor estável por serviço**: hash do `serviceId` → índice da paleta; mesma cor para o
    mesmo serviço em todos os gráficos.
  - Donut limitado a **5 fatias + "Outros"**; legenda com nome + percentual.
  - Verde/vermelho **reservados exclusivamente** para indicadores de variação.
- Tooltips com valor exato (mouse e toque); valor numérico visível nas barras.
- Componentes em `src/components/domain/reports/charts/`:
  `revenue-line-chart.tsx`, `service-mix-donut.tsx`, `seasonality-heatmap.tsx`
  (heatmap em CSS grid, sem lib), e extensão do `report-kpis.tsx` para o delta.

## 6. Layout mobile-first

```
MOBILE (base)                      DESKTOP (lg:)
┌────────────────────────┐   ┌─────────┬──────────────────────────────┐
│ [Hoje][7d][Mês][Ano][…]│   │ sidebar │ [presets período] [categoria▾]│
│ [Categoria ▾]          │   │ Visão   │ ┌─────┐┌─────┐┌─────┐┌─────┐ │
│ ┌──────────┐┌─────────┐│   │ Geral   │ │Fatur││Agend││Ticket││Novos│ │
│ │Faturament││Agendam. ││   │ Financ. │ │12.4k││ 148 ││ R$84 ││ 23% │ │
│ │R$ 12.4k  ││  148    ││   │ Agend.  │ │▲14% ││▲8%  ││▼3%  ││▲2pp │ │
│ │▲14%      ││▲8%      ││   │ Client. │ └─────┴┴─────┴┴─────┴┴─────┘ │
│ └──────────┘└─────────┘│   │ Profis. │ ┌──────────────────┬────────┐│
│ ── Evolução ──────────│   │         │ │ Evolução (linha) │ Donut  ││
│ [Faturamento|Agendam.] │   │         │ │ ╱╲╱──╱╲─╱──      │  ◔     ││
│ ╱╲╱──╱╲─╱── (full w)  │   │         │ └──────────────────┴────────┘│
│ ── Participação ──────│   └─────────┴──────────────────────────────┘
│      ◔ donut + legenda │
└────────────────────────┘
```

- KPIs: grid 2 colunas (mobile) → 4 (desktop); cards com valor + seta/percentual de variação.
- Visão Geral mobile: blocos empilhados; gráfico de linha com toggle Faturamento | Agendamentos.
  Desktop: linha (2/3) + donut (1/3) lado a lado.
- Sazonalidade: heatmap 7 colunas × faixas de hora com dados; scroll horizontal no mobile.
- Clientes: `Tabs` Shadcn (Ranking | Inativos) full-width no mobile; paginação com
  Anterior/Próxima + contador ("21–40 de 132").
- Estados obrigatórios em todo bloco novo: skeleton (padrão existente), vazio
  ("Nenhum agendamento neste período"), erro.
- **Processo:** antes de codar os componentes React, apresentar mockup HTML estático para
  aprovação visual (preferência registrada do usuário).

## 7. Gating na UI

- Padrão da página Profissionais: service chama `featureGuard.assertAccess`; frontend trata o
  erro de feature exibindo o upsell/`FeatureGuard` existente.
- Na página Clientes (aba Inativos) e na seção Sazonalidade, o bloco gated mostra o upsell
  sem quebrar o restante da página (que é plano base).

## 8. Testes

- Service: 3 métodos novos com `prisma-mock` (mock de `$queryRaw` e `groupBy`), incluindo
  caso de timezone da série temporal e caso de comparação de período (janela anterior correta).
- Ranking de clientes: teste de paginação (skip/take) e de cada `sortBy`.
- API routes: validação Zod, tenant do token, gating `reports_advanced` (403 tipado).
- Metas do projeto: service 80%, repository 60%, API route 70%; `tsc --noEmit` e
  `vitest run` zerados.

## 9. Critérios de aceite

1. `/relatorios` abre a Visão Geral com KPIs (com variação %), linha de evolução e donut de
   participação — dados reais do tenant, período padrão "Este mês".
2. Presets de período incluem "Este ano"; personalizado funciona em todos os relatórios.
3. Filtro por categoria altera os números de Visão Geral, Financeiro e Agendamentos.
4. Heatmap de sazonalidade visível em Agendamentos para tenants com `reports_advanced`;
   upsell para os demais.
5. Aba Ranking ordena por faturamento (padrão), frequência e ticket médio, paginada.
6. Aba Inativos lista clientes sem agendamento há ≥ X dias com ação de WhatsApp, paginada.
7. Tudo funcional e legível em 360px de largura (mobile) e em desktop.
8. Nenhuma query sem `tenantId`; nenhum `any`; erros tipados; CSV mantido onde já existe e
   adicionado na aba Inativos.
