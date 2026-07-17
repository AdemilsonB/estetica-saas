# Design — Reestruturação completa da landing page do Agendê

> Data: 2026-07-16
> Branch: `feat/landing-restructure`
> Referência de design: `Agende.dc.html` + `README.md` (handoff do Claude Design)

## Contexto

A landing page do Agendê já existe, componentizada em `src/components/domain/landing/`,
renderizada por `src/app/(public)/page.tsx` (Server Component com `revalidate = 3600`).
O projeto **já carrega as fontes** da referência (Manrope + Plus Jakarta Sans, em
`src/app/layout.tsx`) e **já usa a paleta** da referência nos tokens de `globals.css`
(`--primary: #7C3AED`, `--background: #FAFAFA`, `--secondary: #F5F3FF`).

Portanto este trabalho é de **estrutura narrativa, responsividade e microinterações** —
não de repintar o design system.

### Objetivo

Reestruturar a landing seguindo a narrativa de conversão da referência
(dor → mecanismo → prova → demonstração → oferta → garantia → objeções → CTA),
com fidelidade visual à referência, **mobile-first**, preservando as funcionalidades
reais já existentes (dados dinâmicos do banco, seletor de tema ao vivo).

### Não-objetivos (fora do escopo deste spec)

- **Preço anual real no billing** (schema `Plan` + Stripe + checkout + webhook). É um
  segundo projeto, com spec próprio (decisão: "landing primeiro, billing depois"). Este
  spec **constrói** o toggle Mensal/Anual, mas ele só renderiza quando existir preço anual
  cadastrado; enquanto não existir, fica oculto (degradação graciosa). O billing anual
  "acende" o toggle depois.
- Admin UI para gerenciar métricas/depoimentos (hoje são semeados via `prisma/seed-landing.mjs`).
- Qualquer prova social fabricada em código (ver decisão abaixo).

## Decisões travadas com o usuário

1. **Escopo:** reestruturação completa (toda a narrativa da referência).
2. **Prova social:** somente dados reais do banco. Marquee, contadores e caso real
   derivam de `landingMetric` / `landingTestimonial`. Nenhuma seção inventa nome ou número
   em código. Cada seção dependente de dados **some** quando não há dado. Os stat-tiles
   fabricados do "caso real" da referência (−82%, +R$1.9k, 6h) **não** são reproduzidos.
3. **Toggle de preço:** construído, mas renderiza só quando houver preço anual no catálogo.
4. **Decomposição:** landing primeiro, billing anual depois (spec separado).
5. **Funcionalidades (seção 7):** adotar o grid enxuto de 6 cards da referência e
   reaproveitar os mockups detalhados atuais (`landing-feature-mockups.tsx`) nas seções de
   Demo mobile (8) e Automação WhatsApp (9), para não perder o trabalho existente.

## Dados reais disponíveis hoje (via `prisma/seed-landing.mjs`)

- **4 métricas** (`LandingMetric.value` como string): `"+1.200"`, `"98%"`, `"-40%"`, `"24h"`
  — o contador anima a porção numérica e preserva prefixo/sufixo (`+`, `%`, `s`, `h`).
- **3 depoimentos** (`LandingTestimonial`): `authorName` + `authorRole` (salão · cidade/UF)
  + `quote` + `rating` + `avatarUrl?`. Alimentam marquee, caso real e a seção de depoimentos.

Conteúdo do banco é responsabilidade do negócio (admin/seed); os componentes nunca
inventam conteúdo — apenas renderizam as linhas existentes.

## Arquitetura & stack (reuso, sem dependências novas)

- **Data fetching:** `page.tsx` (Server Component) mantém `getLandingData()` — busca
  `getPublicPlans()`, `landingMetric`, `landingTestimonial` em paralelo e passa como props.
- **Seções puras:** Server Components.
- **Seções interativas** (`'use client'`): usam **framer-motion** (já presente, já usado em
  `landing-branding.tsx`) para scroll-reveal e contadores, sempre com `useReducedMotion()`.
- **Marquee:** CSS puro — `@keyframes` em `globals.css`, `animation-play-state: paused` no
  hover, máscara de fade lateral, desligado sob `prefers-reduced-motion`. `overflow: hidden`
  no container para não estourar largura no mobile.
- **Tipografia:** títulos passam a usar Plus Jakarta Sans via utilitário aplicado na landing
  (a fonte já está carregada como `--font-plus-jakarta-sans`); corpo segue Manrope. Sem
  alteração global em `--font-heading` (evita efeito colateral no resto do app).

## Estrutura de seções (ordem final)

| # | Componente | Tipo | Origem de dados | Degradação |
|---|---|---|---|---|
| 1 | `LandingNav` (+ menu hambúrguer mobile) | client | — | — |
| 2 | `LandingHero` (2 colunas + badge flutuante) | server | `trialDays` | — |
| 3 | `LandingProofBar` (contadores animados) | client | `landingMetric` | some se vazio |
| 4 | `LandingMarquee` (loop infinito de salões) | server + css | derivado de `landingTestimonial` | some se 0 |
| 5 | `LandingPain` ("São 20h…") | server | copy estática | — |
| 6 | `LandingMechanism` (3 cards 01/02/03) | server | copy estática | — |
| 7 | `LandingFeatures` (grid 6 cards 3×2) | server | copy estática | — |
| 8 | `LandingDemoMobile` (frame de celular) | server | reusa mockups atuais | — |
| 9 | `LandingWhatsApp` (seção escura + chat) | client (reveal) | reusa `MockWhatsApp` | — |
| 10 | `LandingHowItWorks` (3 passos, polido) | server | copy estática | — |
| 11 | `LandingCaseReal` (card gradiente, depoimento destaque) | server | `landingTestimonial[0]` | some se 0 |
| 12 | `LandingTestimonials` (3 cards) | server | `landingTestimonial` | some se 0 |
| 13 | `LandingBranding` (seletor de tema ao vivo) | client | já existe | — |
| 14 | `LandingPlans` (+ toggle Mensal/Anual condicional) | client | catálogo | toggle oculto sem preço anual |
| 15 | `LandingGuarantee` (garantia 14 dias) | server | copy estática | — |
| 16 | `LandingFAQ` (seção própria) | server | copy estática | — |
| 17 | `LandingPricingCTA` (CTA final enriquecido + P.S.) | server | `starterPrice`/`trialDays` | — |
| 18 | `LandingFooter` (4 colunas Produto/Empresa/Legal) | server | — | — |
| 19 | `WhatsAppFloatButton` | client | já existe | oculto sem número |

### Observações por seção

- **2 — Hero:** vira 2 colunas no desktop (texto `~1.05fr` / mock dashboard `~.95fr`),
  empilhado no mobile (texto acima do mock). Adiciona o badge flutuante "confirmação
  automática · enviada há 2 min". H1 com `clamp()`.
- **3 — Contadores:** hook `useCountUp` + `useInView` (framer-motion) dispara ao entrar na
  viewport; parseia número de `value` (aceita `.`/`,` pt-BR), anima 0→alvo (~1.5s, easing
  `1-(1-p)^3`), reformata em pt-BR, preserva prefixo/sufixo não-numérico. Reduced-motion =
  valor final direto.
- **4 — Marquee:** faixa duplicada (set A + set B) para loop contínuo; cada card = iniciais
  em gradiente + `authorName` + `authorRole`. Com poucos depoimentos ainda loopa (duplicado).
- **7 — Features:** 6 cards (emoji/ícone + título + descrição + métrica destacada colorida),
  grid 3×2 desktop → 1 col mobile. Copy fiel à referência, adaptada ao produto.
- **8 / 9 — Demo & WhatsApp:** reaproveitam `landing-feature-mockups.tsx` (`MockAgenda`,
  `MockWhatsApp`). Seção 9 é fundo escuro (`#111827`) com chat estilo WhatsApp e bolhas que
  entram em sequência via scroll-reveal com delays escalonados.
- **11 — Caso real:** card gradiente com o depoimento em destaque (quote + autor), **sem**
  stat-tiles fabricados. Renderiza só se houver ≥1 depoimento.
- **14 — Planos:** o toggle Mensal/Anual só aparece quando o catálogo expõe preço anual
  (hoje: oculto). Mantém os cards de plano atuais (`SharedPlanCard`). A FAQ que hoje vive
  aqui é **extraída** para a seção 16.
- **16 — FAQ:** seção própria (`<details>` acessíveis), copy da referência + as perguntas
  atuais sobre trial/cartão/cancelamento.

## Responsividade (mobile-first — obrigatório no projeto)

Cada seção nasce no mobile e escala com breakpoints `base → sm/md → lg`:
- Hero empilha (texto → mock); barra de prova 2×2 → 4 col; todos os grids 3-col → 1 col.
- Demo/WhatsApp/Personalização empilham (texto primeiro, mock depois).
- Marquee com `overflow: hidden`; não estoura largura.
- Alvos de toque ≥ 44px; títulos com `clamp()`; menu hambúrguer abaixo de `md`; CTA
  "Começar grátis" sempre visível na nav.
- `prefers-reduced-motion`: desliga reveal, marquee e contadores (mostra estado final).
- Passa pelo checklist do `agent-mobile` antes da entrega.

## Testes

- `src/app/(public)/landing.test.ts`: `getLandingData()` permanece com a mesma assinatura;
  ajustar só se a forma dos dados passados às novas seções mudar.
- Testes de render das seções novas com degradação:
  - marquee e caso real **não** renderizam sem depoimentos;
  - contador parseia e formata `value` corretamente (`"+1.200"`, `"98%"`, `"-40%"`, `"24h"`);
  - toggle de planos oculto quando não há preço anual.
- `npx tsc --noEmit` limpo; `npx vitest run` verde.
- Security Agent sem itens 🔴 (baixo risco — página pública sem input sensível novo).

## Entrega

- Branch `feat/landing-restructure`, PR para `main`.
- Sem migration (schema `Plan`/landing inalterado neste spec).
- Nenhuma variável de ambiente nova.
