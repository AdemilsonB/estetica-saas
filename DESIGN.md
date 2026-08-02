---
name: Agendê — Core (superfícies sem branding de tenant)
description: "Cartão de Agendamento" — papelaria pessoal, terracota sobre papel cru, selo de cera no lugar do sparkle
colors:
  card: "#FBF4EA"
  card-edge: "#EDE1D1"
  ink: "#B9673C"
  ink-deep: "#7A4227"
  ribbon: "#C98B7A"
  charcoal: "#2E2A26"
  sage: "#8A9A7E"
  muted: "#6b5c4f"
  muted-light: "#8a7a6a"
typography:
  display:
    fontFamily: "-apple-system, 'Segoe UI', system-ui, sans-serif"
    fontWeight: 800
    letterSpacing: "-0.01em"
  body:
    fontFamily: "-apple-system, 'Segoe UI', system-ui, sans-serif"
    fontWeight: 400
  data:
    fontFamily: "-apple-system, 'Segoe UI', system-ui, sans-serif"
    fontWeight: 700
    fontVariantNumeric: "tabular-nums"
rounded:
  none: "0px"
  sm: "2px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card}"
    rounded: "{rounded.sm}"
    padding: "13px 26px"
  button-primary-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card}"
  button-link:
    textColor: "{colors.ink-deep}"
    typography: "{typography.body}"
  appointment-card:
    backgroundColor: "#ffffff"
    textColor: "{colors.charcoal}"
    rounded: "{rounded.none}"
  mini-card:
    backgroundColor: "#ffffff"
    textColor: "{colors.charcoal}"
    rounded: "{rounded.none}"
---

## Overview

Identidade visual do **core** do Agendê — as superfícies que nenhum tenant sobrescreve
(`/`, `/login`, `/planos`, `/termos`, `/privacidade`, backoffice `(admin)`), decidida em
2026-08-01 pelo processo de direção do impeccable (sorteio entre 7 candidatos do mundo real
de um salão de beleza, pesado contra desafiantes de catálogo em duas rodadas).

**Mundo:** o cartão de agendamento que o salão entrega na mão da cliente — papel cru, tinta
terracota, selo de cera, fita. É a leitura literal do nome "Agendê", escolhida pelo sorteio
depois que duas direções anteriores (placa de rua/luminoso, mais gritante) foram rejeitadas
pelo usuário por tom e cor.

**Substitui:** o logo antigo (quadrado gradiente roxo→magenta com sparkle de 4 pontas —
exatamente o clichê visual mais reconhecível de produto de IA de 2023-2025) e o roxo
`#7C3AED` cru que servia de base a essas telas. Ver `docs/decisions.md` e o histórico desta
sessão para o raciocínio completo.

**Escopo — importante:** este arquivo governa só o **core**. O painel interno `(app)/*`, a
vitrine pública e o portal do cliente `[slug]/*` continuam regidos pelo `BrandingConfig` de
cada tenant (`src/lib/branding/build-css-variables.ts`) — cor, fonte (enum de 6) e radius
escolhidos pelo próprio dono do salão, sobrepostos via CSS custom properties. Este DESIGN.md
não se aplica a essas telas.

**Status de implementação (2026-08-01):** construído — `landing-hero.tsx`, CTA do
`landing-nav.tsx`, `public/brand/logo-mark.svg` e `logo-horizontal.svg` (referenciados em
6 pontos: nav, footer, login ×2, planos, legal-shell). **Pendente** — resto das seções da
landing (features, depoimentos, footer, FAQ, pricing), `/login` (ainda tem gradiente
roxo/rosa em 2 pontos, `login-client.tsx:171,254`), `/planos` (header solto "Estética SaaS",
bug pré-existente documentado em `docs/landing-page-auditoria-2026-07.md`), `(admin)`.

## Colors

| Token | Valor | Uso |
|---|---|---|
| `card` | `#FBF4EA` | Fundo — papel cru, nunca branco puro |
| `card-edge` | `#EDE1D1` | Bordas sutis, sombra de canto de cartão |
| `ink` | `#B9673C` | Cor de marca — terracota, tinta impressa. Botão primário, selo, regra do kicker |
| `ink-deep` | `#7A4227` | Profundidade do selo/gradiente, texto de destaque sobre fundo claro |
| `ribbon` | `#C98B7A` | Único acento secundário — fita/detalhe, usar com moderação |
| `charcoal` | `#2E2A26` | Texto principal — nunca preto puro |
| `sage` | `#8A9A7E` | Acento de categoria em mini-cards (junto de `ink`, `ribbon`, dourado pontual) |
| `muted` / `muted-light` | `#6b5c4f` / `#8a7a6a` | Texto secundário, legendas |

**Nunca:** gradiente em texto ou botão, roxo/rosa (`violet-*`, `pink-*`, `#7C3AED`), ícone de
sparkle/estrela de 4 pontas.

## Typography

Pilha de sistema (`-apple-system, "Segoe UI", system-ui, sans-serif`) em peso 800 para
títulos/wordmark, 400 para corpo. Números (data, horário, preço) sempre com
`font-variant-numeric: tabular-nums` e peso 700 — o cartão de agendamento é lido como um
formulário, não como prosa.

## Layout

Mobile-first, mesma ordem de breakpoints do resto do projeto (base → `sm:` → `lg:`). Hero em
duas colunas (`lg:grid-cols-[1.05fr_.95fr]`), empilhada em mobile. Grid de recursos 4 colunas
em desktop, 2 em mobile (`grid-cols-2 md:grid-cols-4`, ver `landing-features.tsx` quando
migrado). O dispositivo visual central do hero é uma pilha de cartões levemente rotacionados
(-7°/6°/-1.5°), nunca mockup de dashboard falso.

## Shapes

Canto **reto** (`rounded-none`) em qualquer elemento que representa papel/cartão/ticket —
decisão deliberada, papelaria real não tem canto de app arredondado. Botões usam
`rounded-sm` (2px), nunca pílula. Regra descoberta durante a implementação: nunca combinar
borda colorida grossa (`border-top`) com canto arredondado no mesmo elemento — ou o canto
some visualmente, ou a borda parece colada por cima (accent-bar-on-rounded-card é um tique
reconhecível de UI gerada por IA).

## Components

- **button-primary** — fundo `ink`, texto `card`, `rounded-sm`, sem gradiente, sem sombra
  colorida.
- **button-link** — texto `ink-deep`, sublinhado, sem fundo.
- **appointment-card** — o componente assinatura da identidade: fundo branco, borda superior
  de 3px em `ink`, canto reto, selo circular (gradiente radial `ink`→`ink-deep`) com a letra
  "a", fita (`ribbon`) num canto, campos label/valor com linha pontilhada e números
  tabulares.
- **mini-card** — mesma base (branco, canto reto), variando a cor da borda superior entre
  `sage`, `ink`, `ribbon` e um dourado pontual para diferenciar categorias de recurso.

## Do's and Don'ts

**Do:**
- Usar o selo de cera (`logo-mark.svg`) como símbolo em qualquer contexto que precise de um
  ícone de marca — substitui o "a" no quadrado roxo em todo lugar.
- Manter números (data/hora/preço) tabulares e em negrito — é o padrão de leitura do cartão.
- Tratar o `ink` terracota como a única cor de acento saturada da tela; o resto é neutro.

**Don't:**
- Não usar gradiente em nenhum elemento (texto, botão, fundo) — nem o antigo roxo/rosa nem
  um substituto na mesma lógica visual.
- Não arredondar cantos de cartão/ticket — a materialidade de papel é o ponto.
- Não introduzir uma segunda cor saturada competindo com `ink` numa mesma tela; `sage` e
  `ribbon` são acentos de apoio, não substitutos.
- Não aplicar nada deste arquivo ao painel interno `(app)/*` ou a telas de tenant — aquilo é
  `BrandingConfig`, um sistema à parte.
