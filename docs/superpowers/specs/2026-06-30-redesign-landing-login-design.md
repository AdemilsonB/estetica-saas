# Redesign completo da Landing Page + Login — Agendê

Data: 2026-06-30 · Branch: `feat/redesign-landing-login`

## Objetivo

Um visitante que não conhece o produto entra, entende recursos/automações reais, se
interessa e inicia o trial. Redesign completo de narrativa, hierarquia e copy, mantendo
a stack (Next.js 15 App Router + TS + Tailwind v4 + Shadcn) e reaproveitando os
componentes que já leem dados reais. Mobile-first (>70% do tráfego), sem esquecer desktop.

## Premissas inegociáveis

1. **Não existe plano gratuito.** Existe TRIAL parametrizado por `Plan.trialDays`
   (schema.prisma:240). Nunca cravar "14 dias" no JSX — ler do banco. Texto genérico usa
   "trial grátis" sem número.
2. **Provas só com dados reais:** `LandingMetric` e `LandingTestimonial` do banco, com
   fallback elegante (esconder a seção quando vazio — já é o comportamento atual).
3. **Remover "Multi-unidades"** das features (não há model no banco — claim falso).
4. Mockup ilustrativo e claims de produto existentes ("+30%", "-40%") podem ficar.
   Nada de novos números inventados como resultado real de cliente.
5. Paleta violeta→rosa warm mantida (identidade estabelecida).

## Decisões tomadas no brainstorming (2026-06-30)

- **trialDays na fonte:** corrigir landing + login + `PricingToggle`/`SharedPlanCard` +
  FAQ/subtítulo de `/planos`. Hoje "14" está cravado em 4 lugares e o banco não é lido
  (getLandingData só busca `price`).
- **Consolidar 12 → 9 seções:** fundir "Automação & tecnologia" dentro do bloco WhatsApp
  em Features; fundir Planos + FAQ numa seção. Mobile mais respirável, mesma mensagem.
- **Mockups de feature em alta fidelidade** (JSX fiel de cada recurso).
- **Demo de cor interativa** (client component) na seção nova de configurabilidade.

## Assets de logo (public/brand/)

- `logo-horizontal.png` — símbolo gradiente + wordmark **escuro**. Usar em fundos claros:
  nav e painel do login. Não serve para footer escuro.
- `logo-mark.png` — tile gradiente com "a" branco. Serve em qualquer fundo. Footer + espaços pequenos.
- `logo-mark-ink.png` — tile escuro (blend em fundo escuro — não usar no footer).
- **Footer (slate-900):** `logo-mark.png` gradiente + wordmark "Agendê" em texto branco.
- **Não usar** `banner-hero.png` (copy "IA" cravada na imagem).

## Arquitetura de seções (9)

```
1. Nav          logo-horizontal · menu Sheet no mobile · sticky c/ blur ao rolar
2. Hero         headline operacional · mockup dashboard evoluído · trial do banco · 2 CTAs
3. Proof bar    métricas reais (fallback: esconde) — estrutura mantida
4. Features     5 blocos alternados c/ mockup JSX alta fidelidade
                └ bloco WhatsApp absorve "Automação & tecnologia" (fluxo automático + tempo real)
                └ grid "mais recursos" SEM multi-unidades
5. Sua marca    NOVA · demo interativa de cor ao vivo (client component)
6. Como funciona 3 passos (evolui o atual)
7. Depoimentos  banco (fallback: esconde) — estrutura mantida
8. Planos + FAQ resumo real dos planos (trial do banco) + FAQ expandido — fundidos
9. CTA final    faixa gradiente · trial do banco
   Footer       logo-mark gradiente + wordmark branco · links · WhatsApp
```

### Hero
- Headline operacional (dor concreta): "Pare de perder cliente no telefone tocando. / Sua
  agenda no **piloto automático.**" (trecho em gradiente).
- Subhead: "Agenda online, WhatsApp automático e financeiro em tempo real — tudo num lugar só."
- CTA1 "Começar trial grátis" → `/login?tab=signup`; CTA2 "Ver planos" → `/planos`.
- Microtrust: "✓ sem cartão de crédito · {N} dias grátis" — {N} = `trialDays` do STARTER.
- Mockup de dashboard evoluído em JSX (base o atual, com `overflow-x-auto` no mobile).
- Recebe `trialDays` como prop (server → client não necessário; Hero pode ser server).

### Features (mockups JSX alta fidelidade)
- 5 blocos alternados (`md:flex-row` / `md:flex-row-reverse`), cada um com mockup fiel:
  - Agenda online → mini-calendário/slots.
  - WhatsApp automático → **timeline de mensagens** (confirmação → lembrete 24h →
    follow-up) + selo "em tempo real"; este bloco carrega o peso "tecnologia/automação".
  - Financeiro em tempo real → mini-dashboard com barras/valores.
  - Fidelização → card de cliente com histórico/tags/aniversário.
  - Anti-falta → painel de confirmações com status.
- Grid "mais recursos": manter Anamnese, Portal do cliente, Catálogo & estoque, Marca
  personalizável, App no celular. **Remover Multi-unidades.**

### Sua marca, do seu jeito (nova, `'use client'`)
- Copy honesta: só o que o domínio Branding entrega (cores, logo, link público/vitrine,
  recursos ativáveis por plano). Sem prometer nada de Fase 2.
- Amostras = os tokens warm reais. Clicar recolore um mockup de **vitrine** ao vivo
  (header + botão "Agendar" + realces) via CSS var inline; transição com framer-motion
  respeitando `prefers-reduced-motion`.
- Controles acessíveis: `role="radiogroup"`, cada amostra `role="radio"` + `aria-checked`
  + `aria-label` da cor, foco visível, navegável por teclado.
- Layout: mobile empilhado (swatches → mockup → bullets); desktop 2 colunas.

### Planos + FAQ (fundidos)
- Resumo dos planos reais lendo a mesma fonte de `/planos` (Prisma `Plan`, features de
  `description`), destacando trial parametrizado e ausência de plano gratuito; CTA → `/planos`.
- FAQ expandido: trial (sem número cravado), sem cartão, cancelamento, fim do trial,
  "posso personalizar a marca?".

## Login (src/app/(auth)/login/)

Apenas visual + copy. **Preservar** toda a lógica de auth, máscaras, validação de CPF,
ViaCEP e fluxos (login/signup/onboarding).

- Painel esquerdo (desktop) e header (mobile): **logo-horizontal real** via next/image no
  lugar do texto gradiente.
- `PLAN_LABEL`: remover a chave `FREE` ("Trial gratuito"). Mantém STARTER/PRO/ENTERPRISE.
- Frase "Agenda, CRM, financeiro **e IA** em uma plataforma só" → remover "IA":
  "Agenda, CRM e financeiro em uma plataforma só."
- Manter split-panel desktop / header gradiente mobile; elevar acabamento e consistência
  com a landing (mesma logo, mesmos tokens).

## Dados / trialDays (correção na fonte)

- `getLandingData()`: incluir `trialDays` na seleção do STARTER; threadar para Hero,
  CTA final e resumo de Planos.
- `PricingToggle`/`SharedPlanCard`: usar `trialDays` real de cada plano (hoje `14` cravado
  em pricing-toggle.tsx:20).
- `/planos`: subtítulo e FAQ leem `trialDays` (STARTER) em vez de "14".

## Regras técnicas

- Mobile-first: base → md: → lg:. Checklist do `agent-mobile` em cada seção.
- Sem `any`. `npx tsc --noEmit` zero erros. `npx vitest run` verde.
- Sem lógica de negócio em componente; dados via fetches server-side existentes
  (page.tsx é server component).
- Acessibilidade: contraste, foco visível, alt nas imagens, aria nos controles interativos,
  `prefers-reduced-motion` nas animações.
- Performance: manter `revalidate` da landing e `force-dynamic` de `/planos`; next/image
  para a logo; animações leves (framer-motion já é dependência — não adicionar libs).

## Testes

- Estender `src/app/(public)/landing.test.ts`: assertar que `getLandingData` busca
  `trialDays` do STARTER.
- Teste unitário do seletor de cor (troca de estado / aria-checked).
- `tsc --noEmit` limpo; `vitest run` verde.

## Fora de escopo

- Domínio Automation (Fase 2 / stub) — não prometer "IA".
- Refatorações não relacionadas ao redesign.
- Reescrita da lógica de auth/onboarding.
