# Spec — Relatórios Fase 1: visão de performance do negócio

**Data:** 2026-07-03 (revisada após decisão de unificação — 4 páginas com papéis únicos)
**Origem:** documento `especificacao-relatorios-agendei.md` (briefing de produto), refinado em sessão de brainstorming.
**Fase 2 (fora desta entrega):** LTV, taxa de recompra, cross-sell, tempo médio entre agendamentos, exportação PDF/Excel.

---

## 1. Objetivo

Evoluir a área `/relatorios` de tabelas simples para uma visão de performance do negócio:
gráficos, comparação com período anterior, novos recortes (evolução no tempo, participação
por serviço, sazonalidade, clientes inativos), filtros ampliados (ano, categoria) e paginação —
**sem poluição nem duplicidade**: cada informação vive em exatamente um lugar.

## 2. Estado atual (baseline)

- 4 relatórios: Financeiro, Agendamentos, Clientes, Profissionais (`src/app/(app)/relatorios/`).
- Backend em `src/domains/reports/reports.service.ts` (280 linhas): `findMany` + agregação em memória.
- KPIs em cards sem variação %; nenhum gráfico (sem lib de charts instalada).
- Filtro de período: hoje / semana / mês / mês passado / personalizado (`period-filter.tsx`).
- Filtros por profissional e serviço; sem categoria. Export CSV. Sem paginação.
- Gating: só Profissionais exige `reports_advanced`.
- **Duplicidade existente:** Financeiro agrupado por profissional ≈ relatório Profissionais
  (mesmos números; Profissionais só adiciona ticket médio).

## 3. Estrutura unificada — 4 páginas, papéis únicos

Menu permanece com 4 itens. Cada página responde **uma pergunta única**; nenhum número
aparece em duas páginas.

| Página | Papel | Conteúdo |
|--------|-------|----------|
| **Visão Geral** (nova landing `/relatorios`) | TENDÊNCIA — "o negócio está crescendo?" | KPIs do período com variação % (faturamento, agendamentos, ticket médio, novos vs. recorrentes) + gráfico de linha de evolução no tempo (toggle Faturamento \| Agendamentos) |
| **Financeiro** | COMPOSIÇÃO — "de onde vem e para onde vai o dinheiro?" | Donut de participação por serviço + tabela por serviço/profissional (ganha coluna **ticket médio**) + despesas/estornos/saldo |
| **Agendamentos** | OPERAÇÃO — "como está a execução?" | Status, taxa de conclusão, no-show (existentes) + **heatmap de sazonalidade** (dia da semana × hora) |
| **Clientes** | PESSOAS — "quem sustenta o negócio e quem estou perdendo?" | Abas **Ranking** (melhores clientes, ordenável, paginado) e **Inativos** (sem agendar há X dias, ação WhatsApp, paginado) |

**A página Profissionais é removida** (rota, página, item do menu, hook, rota de API e método
do service): seu conteúdo já existe como agrupamento "por profissional" no Financeiro (que
ganha a coluna de ticket médio que faltava) e em Agendamentos. O filtro por profissional
continua disponível em todas as páginas.

### Transversal a todas as páginas

- **Período ampliado:** presets Hoje / 7 dias / Este mês / Mês passado / **Este ano** / Personalizado.
- **Filtro por categoria de serviço** (`ServiceCategory`): Visão Geral, Financeiro, Agendamentos.
- **Variação % vs. período anterior** nos KPIs (▲ verde / ▼ vermelho).
- **KPIs por página são exclusivos do papel dela** (dinheiro consolidado só na Visão Geral;
  composição só no Financeiro; operação só em Agendamentos; pessoas só em Clientes).

## 4. Gating por plano

Regra: blocos com **insight novo** exigem `reports_advanced`; o que apenas re-renderiza dado
já disponível no plano base continua livre.

| Bloco | Gating |
|-------|--------|
| Gráfico de evolução no tempo (Visão Geral) | `reports_advanced` |
| Heatmap de sazonalidade (Agendamentos) | `reports_advanced` |
| Aba Clientes Inativos | `reports_advanced` |
| KPIs com variação % (todas as páginas) | plano base |
| Donut de participação (mesmos dados da tabela livre do Financeiro) | plano base |
| Ranking de clientes, coluna ticket médio, paginação, filtros novos | plano base |

Bloco gated mostra o upsell/`FeatureGuard` existente **sem quebrar o restante da página**.
Nota: a página Profissionais (hoje o único conteúdo gated) sai; os três blocos novos acima
passam a ser o driver de upgrade do `reports_advanced`.

## 5. Backend — agregação no banco

Decisão: **agregar no PostgreSQL**, não em memória (série anual carregaria milhares de linhas
por request e inviabiliza paginação).

- Novo arquivo `src/domains/reports/analytics.service.ts` (não inflar `reports.service.ts`):
  - `getOverviewReport(tenantId, input)` — KPIs do período + KPIs do período anterior +
    série temporal.
  - `getSeasonalityReport(tenantId, input)` — matriz dia da semana × hora com contagem.
  - `getInactiveCustomersReport(tenantId, input)` — clientes inativos paginados.
- **Série temporal:** `$queryRaw` tipado com `date_trunc` aplicado **no timezone do tenant**
  (`AT TIME ZONE`), seguindo o precedente de `reports.service.timezone.test.ts`.
  Granularidade automática pela janela: dia (≤ 31 dias), semana (≤ 120 dias), mês (acima).
- **Comparação:** período anterior = mesma duração imediatamente antes (`[from - duração, from)`).
  Uma query agregada extra por relatório. Variação em % (e p.p. para métricas que já são %).
- **Receita:** sempre `Transaction.netAmount` com fallback `amount`, somente `INCOME`,
  descontando estornos conforme o padrão existente (`isReversal`).
- **Financeiro:** rows ganham `ticketMedio` (receita ÷ transações INCOME do grupo); o donut
  de participação usa as mesmas rows (percentual = receita do grupo ÷ receita total) —
  **nenhuma query nova**, zero duplicidade de dados.
- **Ranking de clientes:** reescrito com agregação no banco + paginação server-side
  (`skip`/`take`, 20 por página) + `sortBy` (`receita` | `atendimentos` | `ticketMedio`),
  padrão `receita`.
- **Inativos:** último agendamento não-cancelado < hoje − X dias (30/60/90/180, padrão 90);
  valor histórico = soma de `netAmount` INCOME de todos os tempos; retorna nome, telefone,
  último atendimento, dias inativo, valor histórico. Paginado.
- **Remoção:** `getProfessionalsReport`, rota `/api/reports/professionals`, hook e página —
  removidos com seus testes.
- **Rotas novas:** `GET /api/reports/overview`, `GET /api/reports/seasonality`,
  `GET /api/reports/customers/inactive`. Rota de clientes existente ganha `page`/`sortBy`.
  Controller fino: `getSessionContext()` + validação Zod (schemas em `domains/reports/types.ts`),
  `tenantId` sempre do token. Erros tipados de `src/shared/errors/`.
- **Filtro de categoria:** `categoryId` opcional nos schemas de overview, financeiro e
  agendamentos; join via `appointment.service.categoryId`.

## 6. Gráficos

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

## 7. Layout mobile-first

```
VISÃO GERAL — MOBILE               VISÃO GERAL — DESKTOP (lg:)
┌────────────────────────┐   ┌─────────┬──────────────────────────────┐
│ [Hoje][7d][Mês][Ano][…]│   │ sidebar │ [presets período] [categoria▾]│
│ [Categoria ▾]          │   │ ▸ Visão │ ┌─────┐┌─────┐┌─────┐┌─────┐ │
│ ┌──────────┐┌─────────┐│   │   Geral │ │Fatur││Agend││Ticket││Novos│ │
│ │Faturament││Agendam. ││   │ Financ. │ │12.4k││ 148 ││ R$84 ││ 23% │ │
│ │R$ 12.4k  ││  148    ││   │ Agend.  │ │▲14% ││▲8%  ││▼3%  ││▲2pp │ │
│ │▲14%      ││▲8%      ││   │ Client. │ └─────┴┴─────┴┴─────┴┴─────┘ │
│ └──────────┘└─────────┘│   │         │ ┌──────────────────────────┐ │
│ (2 col; +2 KPIs abaixo)│   │         │ │ Evolução no tempo (linha)│ │
│ ── Evolução ──────────│   │         │ │ ╱╲╱──╱╲─╱── (full width) │ │
│ [Faturamento|Agendam.] │   │         │ └──────────────────────────┘ │
│ ╱╲╱──╱╲─╱── (full w)  │   └─────────┴──────────────────────────────┘
└────────────────────────┘

FINANCEIRO: donut + legenda (mobile: empilhado; desktop: donut 1/3 + tabela 2/3)
AGENDAMENTOS: KPIs → heatmap 7 col × horas (scroll horizontal no mobile) → tabela
CLIENTES: Tabs [Ranking | Inativos] full-width no mobile; paginação Anterior/Próxima + "21–40 de 132"
```

- KPIs: grid 2 colunas (mobile) → 4 (desktop); cards com valor + seta/percentual de variação.
- Estados obrigatórios em todo bloco novo: skeleton (padrão existente), vazio
  ("Nenhum agendamento neste período"), erro.
- **Processo:** antes de codar os componentes React, apresentar mockup HTML estático para
  aprovação visual (preferência registrada do usuário).

## 8. Testes

- Service: 3 métodos novos com `prisma-mock` (mock de `$queryRaw` e agregações), incluindo
  caso de timezone da série temporal e caso de comparação de período (janela anterior correta).
- Ranking de clientes: teste de paginação (skip/take) e de cada `sortBy`.
- API routes: validação Zod, tenant do token, gating `reports_advanced` (403 tipado).
- Remoção de Profissionais: testes correspondentes removidos; suíte segue verde.
- Metas do projeto: service 80%, repository 60%, API route 70%; `tsc --noEmit` e
  `vitest run` zerados.

## 9. Critérios de aceite

1. `/relatorios` abre a Visão Geral: KPIs com variação % (plano base) e linha de evolução
   (gated) — dados reais do tenant, período padrão "Este mês".
2. Menu de relatórios tem 4 itens (Visão Geral, Financeiro, Agendamentos, Clientes);
   a página Profissionais não existe mais e `/relatorios/profissionais` não é linkada.
3. Nenhum número aparece em duas páginas: tendência só na Visão Geral, composição só no
   Financeiro, operação só em Agendamentos, pessoas só em Clientes.
4. Presets de período incluem "Este ano"; personalizado funciona em todos os relatórios.
5. Filtro por categoria altera os números de Visão Geral, Financeiro e Agendamentos.
6. Heatmap de sazonalidade em Agendamentos para tenants com `reports_advanced`; upsell
   para os demais, sem quebrar o resto da página.
7. Aba Ranking ordena por faturamento (padrão), frequência e ticket médio, paginada.
8. Aba Inativos lista clientes sem agendamento há ≥ X dias com ação de WhatsApp, paginada.
9. Tudo funcional e legível em 360px de largura (mobile) e em desktop.
10. Nenhuma query sem `tenantId`; nenhum `any`; erros tipados; CSV mantido onde já existe e
    adicionado na aba Inativos.
