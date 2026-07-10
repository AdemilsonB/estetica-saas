# Refatoração: Comissões e Descontos saem da aba Serviços

> Spec de design — aprovado em conversa, 2026-07-09.

---

## Contexto e motivação

Hoje `Comissões` e `Descontos` vivem dentro da página `/servicos`, num segundo
bloco de abas rotulado "Precificação" (`src/app/(app)/servicos/page.tsx:69-98`),
visualmente parecido com o grupo "Catálogo" mas conceitualmente diferente:
poluiu a aba de Serviços e é pouco descoberto (fica abaixo do catálogo, exige
scroll + segundo clique em aba).

Além do problema de poluição/descoberta, a investigação de arquitetura revelou
um problema de segurança de dados: as rotas de Comissões e Descontos usam a
permissão legada `PERMISSIONS.settings.view/manage` (seção `configuracoes`),
que por padrão já concede `view+edit` ao cargo `PROFESSIONAL`
(`nav-registry.ts:118-121`). Na prática, qualquer profissional com o cargo
padrão hoje consegue ver e editar quanto cada colega ganha por serviço — dado
sensível que deveria ser controlável pelo dono.

Esta refatoração resolve os dois problemas: reposiciona as duas features nos
lugares onde fazem mais sentido no fluxo de uso, e cria permissões próprias e
granulares para cada uma.

## Decisões de escopo

- **Comissões** ("Tipos de desconto" ficam, "Comissões" sai de Serviços) passa
  a viver dentro da página **Equipe** (`/equipe`), não mais em `/servicos`.
  Motivo: comissão é uma regra sobre "quanto cada profissional ganha" — o dono
  pensa nisso junto de "gerenciar meu time", não junto de "cadastrar meus
  serviços".
- **Descontos** (`DiscountType` — tipos de desconto manual aplicados no
  atendimento, ex: "Aniversário 15%") continua fisicamente em `/servicos`, mas
  sai do bloco escondido "Precificação" e ganha um ponto de entrada sempre
  visível.
- **Promoções** (`Promotion` — preço promocional com vigência, já existe como
  aba própria do catálogo) não muda. É um conceito diferente de `DiscountType`
  e fora do escopo desta refatoração.
- Fora de escopo: mudar o modelo de dados de comissão (continua matriz
  Serviço × Profissional, sem "comissão padrão automática" persistida por
  cargo — ver Alternativas descartadas). Fora de escopo também reorganizar a
  localização de arquivos hoje inconsistente (`components/domain/settings/*`
  vs `components/domain/services/*`) — é um problema preexistente, não
  introduzido por esta mudança, e não afeta o usuário final.

---

## Comissões → Equipe

### UI

- Novo botão **"Comissões"** no cabeçalho de `/equipe`
  (`src/app/(app)/equipe/page.tsx`), ao lado do botão "Cargos" já existente
  (linha ~99-107), visível apenas para quem tem permissão `comissoes:view`.
- Abre em `Dialog` (mesmo padrão do modal de Cargos), renderizando o
  `CommissionsGrid` (`src/components/domain/settings/commissions-grid.tsx`)
  praticamente sem mudanças — matriz Serviço × Profissional, edição inline.
- `CommissionsGrid` ganha modo somente-leitura: usuários com `comissoes:view`
  mas sem `comissoes:edit` veem a grade sem poder editar células (inputs
  desabilitados) — análogo ao `canManage` já usado em `TeamMemberCard`.
- **Novo controle: "Aplicar a todos do cargo"** — um seletor de cargo + campo
  de taxa (%) acima da grade. Ao confirmar, aplica a taxa informada a todos os
  profissionais daquele cargo, mas **apenas nos serviços que cada um já tem
  vinculado** (não inventa vínculo novo). Escreve registros reais de
  `ServiceCommission`, sem introduzir conceito de "padrão do cargo" no schema.
  Ação disponível só para quem tem `comissoes:edit`.

### Backend

- `src/domains/financial/commission.repository.ts` ganha um método de
  aplicação em lote (ex.: `applyRateToRole(tenantId, roleId, rate)`), que
  resolve profissionais do cargo + seus serviços vinculados e faz upsert em
  lote reaproveitando o `upsert` existente.
- Rotas `src/app/api/settings/commissions/*` trocam a checagem de permissão de
  `PERMISSIONS.settings.view/manage` para as novas `comissoes:view/manage`
  (ver seção Permissões). Caminho da rota pode continuar `api/settings/...`
  por ora — mudar o path é opcional/cosmético, decidir na fase de
  implementação sem bloquear a entrega.
- Cálculo de comissão no checkout (`scheduling.service.ts:438-446`) não muda:
  continua lendo `ServiceCommission` por `(serviceId, professionalId)`.

---

## Descontos → ponto de entrada visível em Serviços

### UI

- Bloco "Grupo 2: Precificação" (`servicos/page.tsx:69-98`) é removido da
  página. O `Tabs` de catálogo (Categorias/Serviços/Pacotes/Promoções) volta a
  ser o único bloco de abas da página.
- Novo **botão de ícone "Descontos"** no cabeçalho da página `/servicos`
  (ao lado do título "Serviços"), visível para quem tem `descontos:view`.
  Sempre visível, independente de qual aba de catálogo está selecionada —
  não compete por espaço com as abas.
- Abre em `Sheet` (painel lateral) ou `Dialog` com o `DiscountTypesManager`
  atual, sem mudanças no componente além de suportar modo somente-leitura
  para `descontos:view` sem `descontos:edit`.

### Backend

- Rotas `src/app/api/settings/discount-types/*` trocam de
  `PERMISSIONS.settings.view/manage` para `descontos:view/manage`.
- Nenhuma mudança de schema ou de lógica de cálculo de desconto no checkout.

---

## Permissões (RBAC)

Duas chaves novas e independentes, cada uma com ações `view`/`edit`:
`comissoes` e `descontos`. Não entram no `NAV_REGISTRY` (não viram item de
menu/sidebar próprio, já que moram dentro de Equipe e Serviços
respectivamente) — entram num registro paralelo, por exemplo
`EXTRA_PERMISSION_REGISTRY` em `src/shared/permissions/`, com a mesma forma de
`defaultPermissions` por preset usada hoje.

**Padrões de fábrica:**

| Chave       | MANAGER      | PROFESSIONAL | RECEPTIONIST |
|-------------|--------------|--------------|--------------|
| `comissoes` | view + edit  | *(nenhuma)*  | *(nenhuma)*  |
| `descontos` | view + edit  | view + edit  | view         |

`comissoes` fica restrita a MANAGER+OWNER por padrão — corrige a exposição de
dado sensível descrita no Contexto. `descontos` mantém o padrão mais aberto de
hoje (dado operacional, não sensível), espelhando o comportamento atual da
seção `servicos`.

**Mudanças necessárias:**

- `src/domains/iam/role.schemas.ts` (`permissionsSchema`): validar contra
  `NAV_REGISTRY ∪ EXTRA_PERMISSION_REGISTRY`, não só `NAV_REGISTRY`.
- `src/domains/iam/role.service.ts` (`validatePermissions`): mesma checagem de
  "seção desabilitada no plano atual" (`PlanFeatureConfig`) já feita para
  seções de nav, estendida para as chaves extras.
- `src/components/domain/iam/role-permission-matrix.tsx`: novo bloco visual
  "Permissões extras" abaixo da matriz de seções de navegação, com uma linha
  por chave extra (Comissões, Descontos) e toggles Ver/Editar — mesmo visual
  da matriz principal, dados diferentes.
- `src/shared/auth/permissions.ts`: `ensurePermission` passa a aceitar as
  chaves extras do mesmo jeito que aceita chaves do `NAV_REGISTRY` hoje.

Dono continua podendo ajustar cada cargo livremente depois do padrão de
fábrica (ex.: dar `descontos:edit` para Recepcionista, se quiser).

---

## Gate por plano (billing)

- Duas novas capabilities, `comissoes` e `descontos`, registradas em
  `src/shared/permissions/capability-registry.ts` (mesmo grupo de
  `CAPABILITY_ENTRIES` onde já estão `whatsapp_basic`, `reports_advanced`
  etc.).
- **Nenhuma linha correspondente é criada em `PlanFeatureConfig`** nesta
  entrega — seguindo o comportamento "opt-out" já existente no sistema
  (seção sem config = liberada em todos os planos), a feature continua
  disponível pra todo mundo exatamente como está hoje. Zero risco de tirar
  acesso de tenant que já usa.
- Os dois pontos de entrada (botão Comissões em Equipe, botão Descontos em
  Serviços) já nascem envolvidos pelo mesmo mecanismo de capability usado em
  `FeatureLock`/`useCapabilities`/`featureGuard.assertAccess`, então travar
  por plano no futuro vira uma decisão comercial pura — criar a config em
  `/admin/planos` — sem precisar de novo deploy de código.

---

## Alternativas descartadas

- **Comissão padrão persistida por cargo** (com resolução
  override → padrão do cargo → zero): mais robusto porque profissional novo
  no cargo já nasceria com a taxa certa, mas exige migration em `Role` e
  mudança na lógica de cálculo do checkout (`scheduling.service.ts`) — risco
  desnecessário frente ao ganho, já que a ação "aplicar em massa" cobre o caso
  de uso real (definir comissão de um cargo inteiro de uma vez) sem tocar em
  código que já roda em produção. Pode ser revisitado como evolução futura se
  o "aplicar em massa" se mostrar insuficiente na prática (ex. sentirem falta
  do comportamento automático para contratações novas).
- **Comissão embutida no card de cada profissional** (em vez de grade
  central): mais integrado ao fluxo de "editar membro", mas perde a visão
  comparativa de todos os profissionais/serviços ao mesmo tempo, que é útil
  pro dono notar inconsistência de taxa entre a equipe.
- **Descontos como 5ª aba do catálogo**: mais simples, mas não resolve bem o
  problema de descoberta e aperta a barra de abas no mobile.

---

## Testes

Seguindo o padrão do projeto (service 80%, repository 60%, API route 70%):

- `commission.repository`: teste do novo `applyRateToRole` — aplica só nos
  serviços vinculados de cada profissional do cargo, não cria vínculo novo,
  respeita `tenantId`.
- API routes de comissões/descontos: 403 quando falta `comissoes:*` ou
  `descontos:*`; 200 com dado correto quando presente.
- `role.service.validatePermissions`: aceita as chaves extras; rejeita chave
  desconhecida; respeita `PlanFeatureConfig` se um dia for configurado.
- Frontend: `CommissionsGrid` e `DiscountTypesManager` em modo somente-leitura
  não disparam mutations quando falta permissão de edição.

## Mobile

Ambos os pontos de entrada (botão "Comissões" em Equipe, botão "Descontos" em
Serviços) precisam do checklist `agent-mobile` — botões de ícone com alvo de
toque adequado no header, `Dialog`/`Sheet` full-height utilizável em telas
pequenas, grade de comissões com scroll horizontal quando muitos
serviços/profissionais.
