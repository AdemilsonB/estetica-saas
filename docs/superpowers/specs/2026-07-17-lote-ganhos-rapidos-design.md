# Lote de ganhos rápidos — Design

> Data: 2026-07-17
> Origem: triagem das issues do GitHub (sessão 14). Lote de 4 itens de baixo risco e
> superfície isolada, escolhido pelo usuário como primeira frente de desenvolvimento
> pós-triagem.
> Issues cobertas: **#188** (parte 1), **#169**, **#252**, **#254**.

## Contexto e princípio comum

Quatro features independentes, agrupadas por serem todas de **baixo risco** e não
tocarem no que já está em produção. Cada uma tem seção própria abaixo e pode ser
implementada/commitada isoladamente. Nenhuma exige migration de schema.

Decisões de calibração já travadas com o usuário (via `AskUserQuestion`, 2026-07-17):
- **#169 rigor:** regra conservadora — só aparece com sinal real.
- **#169 escopo:** Serviços e Pacotes (não Promoções).
- **#188 alcance:** Financeiro, Agendamentos, Clientes (Visão Geral fica de fora).

---

## Seção 1 — #188: Filtro por profissional nos relatórios (só UI)

### Estado atual (verificado no código)
O backend já aceita `professionalId` ponta a ponta nos relatórios que interessam:
- `financialReportSchema`, `appointmentsReportSchema`, `customersReportSchema` têm
  `professionalId: z.string().cuid().optional()` (`src/domains/reports/types.ts`).
- Os repositories/services já propagam o filtro para as queries
  (`reports.service.ts`, `analytics.service.ts`).
- `overviewReportSchema` **não** tem `professionalId` → Visão Geral fica fora do escopo.

Hoje as telas só têm um `Select` de **"Agrupar por profissional"** (groupBy), que é
outra coisa — não permite isolar um profissional.

### O que fazer
- **Componente novo:** `ReportProfessionalFilter` em `src/components/domain/reports/`.
  - `Select` Shadcn de **seleção única** (não o `ProfessionalFilter` multi-select da
    Agenda — o backend aceita um `professionalId` só; estender pra array seria escopo
    de backend, fora deste lote).
  - Opção default "Todos os profissionais" (valor sentinela `'all'` → envia `undefined`).
  - Carrega a lista via o hook existente `useTeamMembers`.
  - Props: `value: string`, `onChange: (id: string) => void`. Autossuficiente na busca
    dos membros.
- **Ligação nos 3 clients** (`financeiro-client.tsx`, `agendamentos-client.tsx`,
  `clientes-client.tsx`):
  - Adicionar estado `const [professionalId, setProfessionalId] = useState('all')`.
  - Inserir `<ReportProfessionalFilter>` na linha de filtros existente (ao lado de
    período/tipo/categoria), seguindo o layout `flex flex-wrap gap-3`.
  - Passar `professionalId: professionalId === 'all' ? undefined : professionalId` para
    o respectivo hook (`useFinancialReport`, `useAppointmentsReport`,
    `useCustomersReport`).
- **Verificar** que cada hook repassa `professionalId` para a query string da API. Se
  algum hook não tiver o campo no tipo de input, adicionar (é só passar adiante).

### Fora de escopo
- Visão Geral (backend não agrega por profissional).
- Multi-seleção de profissionais.
- Exportação agendada (é a #188 parte 2, projeto separado — não entra aqui).

### Testes
- Component test do `ReportProfessionalFilter`: renderiza "Todos" + membros, dispara
  `onChange` com o id certo, mostra estado default.

---

## Seção 2 — #169: Selo "Mais procurado" na vitrine

### Regra de negócio (conservadora)
- Janela: **últimos 90 dias**.
- Status contabilizado: `CONFIRMED` e `COMPLETED`.
- Mínimo: **5 agendamentos** no período para o item ser elegível.
- **No máximo 1 selo na vitrine inteira**: o item de maior volume entre **Serviços e
  Pacotes** que cruze o mínimo. Empate → determinístico (maior volume; desempate por
  `id` para ser estável entre revalidações). Nenhum item cruza o mínimo → nenhum selo.
- `tenantId` sempre filtrado na agregação.
- Nunca valor fixo/mockado — só dado real de `Appointment`.

### Backend
- Método novo no repository de booking público
  (`src/domains/scheduling/public-booking.repository.ts`):
  `findMostBookedItem(tenantId): Promise<{ type: 'service' | 'package'; id: string } | null>`.
  - Uma agregação `groupBy` sobre `Appointment` filtrando janela + status + tenant,
    contando por `serviceId` e por `packageId`, aplicando o mínimo, retornando o topo.
- Expor no payload SSR da vitrine. A página já é `revalidate: 300`, então recalcula a
  cada revalidação — **sem cron dedicado**. Formato sugerido no payload público:
  `mostBooked: { type: 'service' | 'package'; id: string } | null`.

### Frontend
- Badge "Mais procurado" nos cards de Serviço (`vitrine-services-list.tsx`) e Pacote
  (`vitrine-packages-section.tsx`), reusando o padrão de badge posicionado que os cards
  já usam (`absolute left-2 top-2 ... rounded-full ... text-white`).
- Renderiza só no card cujo `id`+`type` batem com `mostBooked`.
- **Colisão com "Economize R$":** se o item campeão for um Pacote que já exibe o badge
  "Economize", os dois badges **empilham verticalmente** (gap), não sobrepõem. Resolver
  no layout do card do pacote (ex.: container flex-col dos badges no canto).

### Testes
- Repository test do `findMostBookedItem`: respeita janela/status/mínimo/tenant;
  retorna `null` sem volume suficiente; escolhe o topo entre serviço e pacote.

---

## Seção 3 — #252: Painel de sinais de crescimento no admin

### Onde
Nova seção na home do admin (`src/app/(admin)/admin/page.tsx`), que já é um dashboard
de cards (MRR/ARR/assinaturas/trial). Dois widgets abaixo do que existe.

### Widgets
1. **Recursos bloqueados mais clicados** — agrega `CapabilityInterestLog` por
   `capabilityKey` (últimos 90 dias), ordena desc, top 10. Mostra o label da capability
   (via `CAPABILITY_REGISTRY`) + contagem de cliques. Dado já coletado desde a Fase B
   (PR #250) e nunca lido até agora.
2. **Tenants perto do limite** — itera tenants com assinatura `ACTIVE`/`TRIALING`, roda
   `getTenantUsage(tenantId)` (já existe em `usage.service.ts`), lista os que têm
   algum limite com `status !== 'ok'` (≥80%). Mostra nome do tenant + qual limite +
   percentual.

### Backend
- Serviço `getGrowthSignals()` em `src/domains/billing/` retornando
  `{ topBlockedCapabilities: Array<{ key; label; count }>, tenantsNearLimit: Array<{ tenantId; tenantName; items: UsageItem[] }> }`.
- Rota `GET /api/admin/growth-signals` protegida por `getAdminContext` (com o rate
  limiting que as rotas `/api/admin/**` já aplicam). Leitura pura — sem audit log de
  mutação (não muda nada).
- Hook `useGrowthSignals` (TanStack Query).

### Nota de custo (registrada, não bloqueante)
O scan de "perto do limite" é O(tenants × limites relevantes). Na escala atual
(dezenas de tenants) é irrelevante. Filtrar só assinaturas ativas/trial já limita o
conjunto. **Revisitar** (paginação/pré-cálculo via `UsageSnapshot`) se a base crescer
para centenas de tenants — deixar comentário no serviço apontando isso.

### Testes
- Service test do `getGrowthSignals`: ranking ordenado desc e cortado no top 10;
  near-limit inclui só `status !== 'ok'` e só tenants ativos/trial.

---

## Seção 4 — #254: Guard de sanidade da config de planos

Dois níveis, conforme a issue (avisar, não bloquear — exceto o essencial):

### 4a. Avisos não-bloqueantes (superfície read-only nova)
- Função `getPlanConfigWarnings()` em `src/domains/billing/` que lê **todos** os planos
  + seus limites + features de uma vez e detecta:
  - **Monotonicidade:** plano de ordem maior com limite **menor** que um plano de ordem
    menor (ex.: Pro com `max_users` menor que Starter). Usa `getPlanOrder()` +
    `LIMIT_REGISTRY`. Ignora o valor "ilimitado" (`unlimitedThreshold`) — ilimitado é
    sempre ≥ qualquer finito.
  - **Capability `status: 'soon'` ligada como benefício vendável:** capability com
    `status === 'soon'` em `CAPABILITY_REGISTRY` marcada `enabled: true` em algum plano
    não deveria contar como benefício. Gera aviso.
  - Retorna `Array<{ severity: 'warning'; plan: string; message: string }>`.
- Fica **read-only** porque monotonicidade exige comparar planos entre si, e o editor
  hoje carrega um plano por vez.
- Rota `GET /api/admin/plans/sanity` (protegida por `getAdminContext`). Hook
  `usePlanConfigWarnings`.
- **UI:** banner de avisos no topo do editor de plano
  (`src/app/(admin)/admin/planos/[planName]/page.tsx`), listando os avisos (pode mostrar
  os do plano atual em destaque + os demais como resumo). Não impede salvar.

### 4b. Essencial travado (reforço no save — hard enforcement)
- Hoje o toggle `essential` é `disabled` na UI (o usuário não desliga pela tela), mas
  uma chamada direta à API `PATCH`/`PUT` de features poderia mandar `enabled: false`.
- O handler server-side de `updateFeatures` passa a **forçar** `enabled: true` para toda
  capability com `essential: true` em `CAPABILITY_REGISTRY`, independente do que veio no
  body. Fecha o buraco. É um reforço de robustez, não muda o comportamento da UI.

### Testes
- `getPlanConfigWarnings`: detecta monotonicidade quebrada, ignora ilimitado, detecta
  `soon` habilitada; retorna vazio quando tudo consistente.
- `updateFeatures`: força `essential: true` mesmo recebendo `false` no input.

---

## Transversal (vale para os 4 itens)

- Testes conforme o checklist do projeto: service/repository onde há lógica de negócio,
  component test onde há UI com estado.
- Checklist mobile-first do `agent-mobile` nas partes de UI: filtro dos relatórios
  (#188) e badge da vitrine (#169). Admin (#252/#254) é desktop-first, mas não deve
  quebrar em telas menores.
- `tsc --noEmit` limpo. Sem `any`. Erros tipados de `src/shared/errors/` onde aplicável.
- Cada item em commit próprio; ordem sugerida de implementação: #188 → #169 → #252 →
  #254 (do mais isolado ao que mexe em mais superfície do admin).

## Fora de escopo deste lote (registrado)
- #188 parte 2 (exportação agendada) — projeto separado, exige job pg-boss + canal +
  periodicidade + decisões de negócio.
- #169 configurável pelo tenant — descartado no brainstorming (sai de "ganho rápido").
- #169 em Promoções — descartado (badges concorrentes com "Economize").
