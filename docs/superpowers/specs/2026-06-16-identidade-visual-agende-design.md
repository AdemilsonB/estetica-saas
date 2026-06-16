# Spec — Identidade Visual Agendê

**Data:** 2026-06-16  
**Status:** Aprovado  
**Escopo:** Recolor + troca de logo + banner landing + página de agendamento público

---

## 1. Contexto e objetivo

O Agendê tem identidade visual nova (logo gradiente roxo/rosa) mas o sistema ainda usa a paleta antiga (bege/marrom `#c8916a`). O objetivo é aplicar a nova identidade em todas as superfícies sem alterar layout, componentes ou funcionalidades existentes.

**O que muda:** tokens de cor, fonte padrão, logo, banner da landing, hero da página de agendamento público.  
**O que não muda:** estrutura de layout, componentes Shadcn UI, navegação, responsividade, lógica de branding por tenant.

---

## 2. Decisões de design aprovadas

| Decisão | Escolha |
|---|---|
| Direção geral | App claro + brand como acento (roxo/rosa) |
| Fonte | Manrope (400 / 500 / 600 / 700 / 800) |
| Sidebar desktop | Branca, active com barra esquerda gradiente 3px + fundo `#F5F3FF` |
| Mobile nav | Linha roxa 2px sob ativo + drop-shadow roxo nos ícones |
| Componentes | Radius 10px (balanced) + sombra roxa suave nos cards |
| Landing hero | Claro — gradiente lavanda `#F5F3FF → #FCE8F3` |
| Página do cliente | Banner compacto ~62px, logo+info flutuando, sem badge Agendê |
| Admin | Sidebar escura `#1a1030`, badge "ADMIN" rosa |

---

## 3. Tokens de cor — globals.css

### Light mode (substituir valores atuais)

```css
:root {
  /* Primária — substituir #c8916a */
  --primary: oklch(0.491 0.27 293);        /* #7C3AED */
  --primary-foreground: oklch(0.985 0 0);  /* branco */

  /* Accent */
  --accent: oklch(0.961 0.025 293);        /* #F5F3FF lavanda suave */
  --accent-foreground: oklch(0.491 0.27 293);

  /* Background */
  --background: oklch(0.982 0 0);          /* #FAFAFA */
  --foreground: oklch(0.129 0.02 264);     /* #111827 */

  /* Card */
  --card: oklch(1 0 0);                    /* branco */
  --card-foreground: oklch(0.129 0.02 264);

  /* Muted */
  --muted: oklch(0.961 0.025 293);         /* #F5F3FF */
  --muted-foreground: oklch(0.444 0.02 264); /* #6B7280 */

  /* Border e Input */
  --border: oklch(0.925 0.04 293);         /* #EDE9FE lavanda */
  --input: oklch(0.925 0.04 293);
  --ring: oklch(0.491 0.27 293);           /* #7C3AED */

  /* Destructive — mantém */
  --destructive: oklch(0.577 0.245 27.325);

  /* Radius */
  --radius: 0.625rem;                      /* 10px — balanced */

  /* Sidebar */
  --sidebar: oklch(1 0 0);                 /* branca */
  --sidebar-foreground: oklch(0.129 0.02 264);
  --sidebar-primary: oklch(0.491 0.27 293);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.961 0.025 293);
  --sidebar-accent-foreground: oklch(0.491 0.27 293);
  --sidebar-border: oklch(0.925 0.04 293);
  --sidebar-ring: oklch(0.491 0.27 293);

  /* Fonte */
  --font-sans: 'Manrope', sans-serif;
}
```

### Valores HEX de referência

| Token | Valor | Uso |
|---|---|---|
| `--primary` | `#7C3AED` | Cor principal, ícone ativo, botão primário |
| `--primary-gradient` | `135deg #7C3AED → #DB2777` | Botões CTA, FAB, badge ativo, barras de progresso |
| `--accent` / `--muted` | `#F5F3FF` | Fundo sidebar ativo, seções destacadas |
| `--background` | `#FAFAFA` | Fundo geral do app |
| `--card` | `#FFFFFF` | Fundo dos cards |
| `--border` / `--input` | `#EDE9FE` | Bordas — lavanda, não cinza |
| `--foreground` | `#111827` | Texto principal |
| `--muted-foreground` | `#6B7280` | Texto secundário |

### Dark mode
Manter estrutura atual (`.dark`) — apenas ajustar `--primary` e `--sidebar-primary` para versões mais claras/saturadas do roxo quando em dark mode.

---

## 4. Tipografia — Manrope

Substituir `Inter` como fonte padrão por `Manrope`. Os pesos necessários: 400, 500, 600, 700, 800.

### Escala aprovada

| Nível | Tamanho | Peso | Uso |
|---|---|---|---|
| H1 | 28px | 800 | Título de página |
| H2 | 20px | 700 | Seção principal |
| H3 | 15px | 700 | Sub-seção |
| Body | 13px | 500 | Texto padrão |
| Small | 11px | 400 | Metadados, labels |
| Label | 9px | 700 | Uppercase, seções — `color: var(--primary)` |

### Arquivos a atualizar

- `src/app/layout.tsx` — adicionar `Manrope` no `next/font/google`, definir como `--font-sans`
- `src/app/globals.css` — `--font-sans: 'Manrope', sans-serif`
- `src/lib/branding/build-css-variables.ts` — mapeamento `manrope` já existe, torná-lo o default

---

## 5. Sombras e efeitos

```css
/* Cards */
--shadow-card: 0 2px 8px rgba(124, 58, 237, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05);

/* Mobile nav — ícone ativo */
--shadow-icon-active: drop-shadow(0 0 5px rgba(124, 58, 237, 0.35));

/* Mobile nav — ícones inativos */
--shadow-icon: drop-shadow(0 0 3px rgba(124, 58, 237, 0.15));

/* Botão primário (gradient) */
--shadow-btn: 0 3px 10px rgba(124, 58, 237, 0.30);
```

---

## 6. Logo — substituição

### Arquivos novos (já em `public/brand/`)

| Arquivo | Uso |
|---|---|
| `public/brand/logo-mark.png` | Ícone quadrado gradiente — ícone da sidebar, favicon, PWA |
| `public/brand/logo-horizontal.png` | Logo com texto — header desktop, emails, OG image |
| `public/brand/logo-mark-ink.png` | Variante escura — uso sobre fundos claros alternativos |
| `public/brand/banner-hero.png` | Referência visual para landing (versão escura) |
| `public/brand/banner-principal.png` | Referência visual para landing (versão clara — aprovada) |

### Onde substituir o logo atual

- `src/components/app/app-shell.tsx` — logo na sidebar desktop
- `src/components/app/mobile-header.tsx` — logo mark no header mobile
- `public/icons/icon-192.svg` — PWA icon 192px
- `public/icons/icon-512.svg` — PWA icon 512px
- `public/manifest.json` — verificar referências
- Meta tags OG em `src/app/layout.tsx`

---

## 7. Sidebar desktop

### Comportamento aprovado

- Fundo: `white` (`--sidebar`)
- Borda direita: `1px solid var(--border)` (`#EDE9FE`)
- **Item ativo:**
  - Barra esquerda: `3px` gradiente `#7C3AED → #DB2777`, `border-radius: 0 2px 2px 0`
  - Fundo do item: `var(--accent)` (`#F5F3FF`)
  - Texto e ícone: `var(--primary)` (`#7C3AED`)
  - Font-weight: 700
- **Itens inativos:** `var(--muted-foreground)` (`#6B7280`), weight 500
- Logo mark: `public/brand/logo-mark.png` (28×28px, border-radius 7px)

---

## 8. Mobile nav (bottom nav)

### Comportamento aprovado

- Fundo: `white`, `border-top: 1px solid var(--border)`
- **Item ativo:**
  - Cor: `var(--primary)` (`#7C3AED`)
  - Ícone: `filter: drop-shadow(0 0 5px rgba(124,58,237,0.35))`
  - Linha inferior: `width: 20px`, `height: 2px`, gradiente `#7C3AED → #DB2777`, `border-radius: 1px`
- **Itens inativos:**
  - Cor: `#9CA3AF`
  - Ícone: `filter: drop-shadow(0 0 3px rgba(124,58,237,0.15))` — sombra roxa fraquinha
- FAB central (botão `+`): **mantido exatamente como está** — não alterar

---

## 9. Landing page — `/` (pública)

### Hero aprovado: versão clara

```
Background: linear-gradient(135deg, #FAF8FF 0%, #F0EBFF 40%, #FCE8F3 100%)
```

- Título principal: `color: #111827`, com span de destaque em gradiente roxo/rosa via `background-clip: text`
- Subtítulo: `color: #6B7280`
- CTA primário: gradiente `#7C3AED → #DB2777`, border-radius 8px, sombra `--shadow-btn`
- Logo: `public/brand/logo-horizontal.png`
- Referência visual: `public/brand/banner-principal.png`

---

## 10. Página do cliente — `/agendar/[slug]`

### Mobile (novo layout aprovado)

**Hero compacto (~62px de altura):**
- Fundo: banner do tenant (se configurado) ou gradiente padrão `#7C3AED → #DB2777`
- Overlay: `linear-gradient(to bottom, rgba(0,0,0,0.15), rgba(0,0,0,0.45))` — garante leitura
- Logo do salão: 34×34px, `border-radius: 9px`, `border: 2px solid rgba(255,255,255,0.75)`
- Nome do salão: `font-size: 12px`, `font-weight: 800`, `color: white`, `text-shadow`
- Localização/meta: `font-size: 8px`, `color: rgba(255,255,255,0.8)`
- Layout: logo à esquerda + nome/meta ao lado (horizontal, centralizado verticalmente)
- **Sem badge "Agendê"** — removido

**Lógica do banner:**
```
tenant.brandingConfig.bannerUrl existe?
  → sim: usar imagem/cor do tenant como fundo
  → não: usar gradiente padrão Agendê (#7C3AED → #DB2777)
```

**Corpo (abaixo do hero):**
- Fundo: `#FAFAFA`
- Step pill: lavanda `#F5F3FF`, texto `#7C3AED`
- Cards de serviço: `border: 1px solid #EDE9FE`, `border-radius: 9px`, sombra card
- Serviço selecionado: `border-color: #7C3AED` + `box-shadow: 0 0 0 2px rgba(124,58,237,0.12)`
- Preço: `color: #7C3AED`, font-weight 800
- CTA "Agendar": pill gradiente `#7C3AED → #DB2777`, sombra `--shadow-btn`

### Desktop (mantém layout existente, apenas cores atualizadas via tokens)

---

## 11. Admin — `/admin/*`

### Sidebar admin (escura — diferencia do app dos tenants)

- Fundo sidebar: `#1a1030` (quase preto arroxeado)
- Logo mark: `public/brand/logo-mark.png` com badge "ADMIN" (`color: #DB2777`, `background: rgba(219,39,119,0.15)`)
- Item ativo: `background: rgba(124,58,237,0.4)`, `color: white`
- Itens inativos: `color: rgba(255,255,255,0.5)`
- Fundo conteúdo: `#0f0d1a`
- Cards: `background: #1a1030`, `border: 1px solid rgba(124,58,237,0.2)`
- Texto: `color: white`
- Labels de seção: `color: rgba(124,58,237,0.8)`

---

## 12. build-css-variables.ts

Atualizar os valores default (quando tenant não tem branding customizado):

```typescript
const DEFAULTS = {
  primaryColor: '#7C3AED',   // era: #c8916a
  accentColor: '#F5F3FF',    // era: #fdf0e8
  backgroundColor: '#FAFAFA', // era: #faf7f4
  borderColor: '#EDE9FE',    // era: #e8ddd3
  foregroundColor: '#111827', // era: #3d2b1f
  mutedColor: '#6B7280',     // era: #8a7060
  fontFamily: 'manrope',     // era: inter
  borderRadius: 'medium',    // mantém
  colorScheme: 'light',      // mantém
}
```

---

## 13. Superfícies mapeadas

| Superfície | Arquivo principal | Tipo de mudança |
|---|---|---|
| App shell (desktop) | `src/components/app/app-shell.tsx` | Sidebar: logo + cores ativo |
| Mobile header | `src/components/app/mobile-header.tsx` | Logo mark |
| Bottom nav mobile | `src/components/app/bottom-nav.tsx` | Active state + shadow ícones |
| Globals CSS | `src/app/globals.css` | Todos os tokens de cor + fonte |
| Root layout | `src/app/layout.tsx` | Font Manrope + meta OG |
| Build CSS vars | `src/lib/branding/build-css-variables.ts` | Defaults atualizado |
| Landing page | `src/app/(public)/page.tsx` + componentes em `src/components/domain/landing/` | Hero + cores + logo |
| Login / onboarding | `src/app/(auth)/` | Tokens aplicados automaticamente via globals |
| Página do cliente | `src/app/(public)/agendar/[slug]/page.tsx` | Hero compacto novo |
| Admin | `src/app/(admin)/layout.tsx` + `src/components/admin/` | Sidebar escura |
| PWA icons | `public/icons/icon-192.svg`, `public/icons/icon-512.svg` | Novo logo-mark |

---

## 14. O que NÃO muda

- Estrutura de layout de qualquer página
- Componentes Shadcn UI (Button, Dialog, Sheet, Tabs, etc.) — tokens CSS os atualizam automaticamente
- Bottom nav: estrutura, itens, FAB central
- Sistema de branding por tenant (configurações de identidade por salão)
- Responsividade e breakpoints
- Lógica de negócio
