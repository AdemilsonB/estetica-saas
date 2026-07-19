# Brief — Alinhamento da oferta (Onda 0, item 1)

> **Status:** ✅ IMPLEMENTADO (2026-07-19, branch `feat/alinhamento-oferta`) — decisão "Híbrido".
> `tsc` limpo, testes de billing/permissions verdes (85), suíte completa 760 passed
> (só as 4 falhas pré-existentes). Falta: revisar/mergear PR + UPDATE cirúrgico em produção.
> **Origem:** `docs/estrategia-produto-2026-07.md` §11 (Onda 0). Este é o 1º dos 3
> itens da Onda 0. Os outros dois (Termos/Privacidade; consertar `/planos`) são
> briefs separados, ainda não escritos.
>
> **Como retomar em outro chat:** abrir este arquivo + o doc de estratégia e
> pedir "executar o brief de alinhamento da oferta pelo Orchestrator". A memória
> (`estrategia-produto-roadmap`) já aponta para cá.

---

## Decisão de produto travada (usuário, 2026-07-19)

**Híbrido:**
- `whatsapp_premium` e `campaigns` → viram **"Em breve"** (`status: 'soon'`) —
  continuam visíveis como roadmap, não vendidos como ativos. Alinham com a Onda 3
  (IA/reengajamento), que vai entregá-los de verdade.
- **Multi-unidade** → **removida de vez** de planos e landing (sem caminho de
  curto prazo, não há model `Unit`).

## Feature
Alinhamento da oferta — honestidade de planos.

## Motivação
Parar de vender como *ativo* o que não existe (exposição a estorno, reclamação,
LGPD/publicidade enganosa); alinhar planos e landing ao que o produto entrega.

## Usuário principal
Dono do tenant (comprador do plano) + admin/backoffice.

## O que será feito
1. **WhatsApp premium + Campanhas → "Em breve":** `status: 'ga'` → `'soon'` em
   `src/shared/permissions/capability-registry.ts:43-44`.
2. **Renderização "Em breve":** cards de plano/landing exibem itens `soon` com
   badge (roadmap), não como benefício incluído. Reconciliar com o guard de
   sanidade do #254 (`src/domains/billing/plan-config-sanity.service.ts`) para o
   banner não acusar "soon vendável" indevidamente — semântica de `soon` no card
   = "roadmap visível", não "incluído/vendido".
3. **Multi-unidade → remoção completa:**
   - remover a row `multi_unit` do seed (`scripts/seed-admin-data.ts:42`);
   - remover "Até 3 unidades" da descrição do PRO (`scripts/seed-admin-data.ts:28`);
   - remover a chave `MULTI_UNIT` do `FEATURES` (`src/domains/billing/feature-guard.ts:14`)
     **se** nenhum fluxo runtime a consome (verificar antes; ajustar testes);
   - remover qualquer menção a unidades da landing/plan cards.
4. Ajustar a descrição do PRO no seed para não citar "chatbot, aniversário" como
   ativo (vira "em breve").
5. Atualizar testes afetados: `capability-registry.test`, `feature-guard.test`,
   `plan-config-sanity`, `plan-benefits`.

## O que NÃO está no escopo
- Construir chatbot/campanhas/multi-unidade de verdade (Ondas 3+).
- Termos de Uso + Política de Privacidade (Onda 0, item 2 — brief separado).
- Navegação de `/planos` e links mortos (Onda 0, item 3 — brief separado).
- Reprecificar ou redesenhar a ancoragem de valor do PRO (aqui só se remove o
  falso, sem mexer no pricing).

## Domínios afetados
billing (capability-registry, feature-guard, plan-config-sanity, seed) +
frontend (plan cards / landing).

## Restrição de plano
n/a — é sobre a própria config de planos.

## Skills que o Orchestrator vai acionar
backend (registry/config) → frontend + agent-mobile (cards/landing) → testing →
security → review → documentation. **Sem database** (não há migration — é config
e cópia).

## Complexidade estimada
Médio (1-3h) — várias superfícies, zero schema.

## Dependências
Nenhuma. É o item que destrava o resto da Onda 0.

## Guardrails "não quebrar"
- Confirmar todos os consumidores runtime de `MULTI_UNIT` / `whatsapp_premium` /
  `campaigns` antes de mexer (são placeholders, mas verificar).
- Sem migration (só config/seed). Rodar o seed atualizado em produção é passo
  manual controlado — **e cuidado: `seed-admin-data.ts` sobrescreve preços e
  feature flags** (ver project-state / #255). Preferir aplicação cirúrgica, não o
  seed inteiro às cegas.
- `npx tsc --noEmit` = 0 e `npx vitest run` verde antes do PR.
- Manter coerência com o ADR do #254 (guard de sanidade).
- Branch dedicada (`feat/alinhamento-oferta` ou similar), PR para `main`.

## Entrega (o que melhora)
Oferta honesta e defensável: planos e landing param de prometer o que não existe.
Reduz vetor de estorno/reclamação e exposição de LGPD; limpa placeholder morto
(`multi_unit`) do código; deixa `whatsapp_premium`/`campaigns` prontos para
"acender" na Onda 3. É o pré-requisito de confiança das ondas seguintes — não
adiciona funcionalidade nova ao usuário final.
