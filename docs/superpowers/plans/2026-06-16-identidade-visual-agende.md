# Identidade Visual Agendê — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a paleta bege/marrom (#c8916a) pela nova identidade visual Agendê (roxo/rosa #7C3AED → #DB2777), trocar fonte padrão para Manrope e atualizar logo e banner em todas as superfícies.

**Architecture:** Mudança de tokens CSS em `globals.css` propaga automaticamente para todos os componentes Shadcn UI. As 6 superfícies com código específico (sidebar desktop, bottom nav, landing, agendamento público, admin, PWA icons) recebem mudanças cirúrgicas. Lógica de branding por tenant é preservada.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS v4, Shadcn UI (tokens via CSS custom properties), `next/font/google` (Manrope já carregado)

**Spec:** `docs/superpowers/specs/2026-06-16-identidade-visual-agende-design.md`

---

## Mapa de arquivos

| Arquivo | Ação | O que muda |
|---|---|---|
| `src/app/globals.css` | Modificar | Bloco `:root` completo — bege → roxo; `.dark` primário atualizado |
| `src/app/layout.tsx` | Modificar | Font default → Manrope; title → "Agendê"; theme-color → #7C3AED |
| `src/app/(app)/layout.tsx` | Modificar | Fallback de `borderColor`/`foregroundColor`/`mutedColor` |
| `src/components/app/app-shell.tsx` | Modificar | NavLink ativo: adicionar barra esquerda gradiente 3px |
| `src/components/app/bottom-nav.tsx` | Modificar | Link ativo: indicador de linha inferior + drop-shadow nos ícones |
| `src/components/domain/landing/landing-nav.tsx` | Modificar | Logo textual → `<img>` com `logo-horizontal.png` |
| `src/components/domain/landing/landing-hero.tsx` | Modificar | Gradiente do fundo hero: violet-50/pink-50 → lavanda aprovada |
| `src/app/(public)/agendar/[slug]/page.tsx` | Modificar | Header sticky + banner separados → hero compacto unificado (~64px) |
| `src/app/(public)/agendar/[slug]/booking-client.tsx` | Modificar | Fallback `primaryColor` `#191919` → `#7C3AED` |
| `src/app/(admin)/layout.tsx` | Modificar | Fundo dark `#1a1030`, remover banner vermelho, logo + badge ADMIN |
| `public/icons/icon-192.svg` | Modificar | Rect preto → gradiente roxo/rosa |
| `public/icons/icon-512.svg` | Modificar | Rect preto → gradiente roxo/rosa |

---

## Task 1: Tokens de cor e fonte — globals.css + layout.tsx + (app)/layout.tsx

**Files:**
- Modify: `src/app/globals.css:51-118`
- Modify: `src/app/layout.tsx:16,34,36`
- Modify: `src/app/(app)/layout.tsx:73-75`

- [ ] **Step 1.1: Atualizar bloco `:root` em globals.css**

Substituir as linhas 51–84 (bloco `:root` inteiro) por:

```css
:root {
  --background: #FAFAFA;
  --foreground: #111827;
  --card: #ffffff;
  --card-foreground: #111827;
  --popover: #ffffff;
  --popover-foreground: #111827;
  --primary: #7C3AED;
  --primary-foreground: oklch(0.985 0 0);
  --secondary: #F5F3FF;
  --secondary-foreground: #7C3AED;
  --muted: #F5F3FF;
  --muted-foreground: #6B7280;
  --accent: #F5F3FF;
  --accent-foreground: #7C3AED;
  --destructive: oklch(0.577 0.245 27.325);
  --border: #EDE9FE;
  --input: #EDE9FE;
  --ring: #7C3AED;
  --chart-1: #7C3AED;
  --chart-2: #DB2777;
  --chart-3: #A855F7;
  --chart-4: #EC4899;
  --chart-5: #6D28D9;
  --radius: 0.625rem;
  --sidebar: #ffffff;
  --sidebar-foreground: #111827;
  --sidebar-primary: #7C3AED;
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: #F5F3FF;
  --sidebar-accent-foreground: #7C3AED;
  --sidebar-border: #EDE9FE;
  --sidebar-ring: #7C3AED;
}
```

- [ ] **Step 1.2: Atualizar primário do modo dark em globals.css**

No bloco `.dark` (linhas 86–118), atualizar apenas as linhas de primário:

```css
  /* linha 93 */
  --primary: oklch(0.75 0.2 293);
  /* linha 94 */
  --primary-foreground: oklch(0.985 0 0);
  /* linha 104 */
  --ring: oklch(0.75 0.2 293);
  /* linha 112 */
  --sidebar-primary: oklch(0.75 0.2 293);
```

- [ ] **Step 1.3: Atualizar layout.tsx — fonte, title e theme-color**

Em `src/app/layout.tsx`:

```tsx
// linha 16-18: atualizar title
export const metadata: Metadata = {
  title: 'Agendê',
  description: 'Plataforma operacional inteligente para negocios de estetica e servicos.',
}

// linha 34: trocar inter → manrope
<style>{`:root { --font-sans: var(--font-manrope); }`}</style>

// linha 36: atualizar theme-color
<meta name="theme-color" content="#7C3AED" />
```

- [ ] **Step 1.4: Atualizar fallbacks de branding em (app)/layout.tsx**

Em `src/app/(app)/layout.tsx`, dentro da chamada `buildCssVariables()`, atualizar as linhas 73–75:

```tsx
borderColor: config.borderColor ?? '#EDE9FE',     // era '#e8ddd3'
foregroundColor: config.foregroundColor ?? '#111827', // era '#3d2b1f'
mutedColor: config.mutedColor ?? '#6B7280',       // era '#8a7060'
```

- [ ] **Step 1.5: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros. Se houver erro de tipo nas mudanças acima, corrigir antes de prosseguir.

- [ ] **Step 1.6: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx src/app/(app)/layout.tsx
git commit -m "feat(ui): aplicar nova paleta Agendê roxo/rosa e fonte Manrope"
```

---

## Task 2: Sidebar desktop — barra ativa esquerda (app-shell.tsx)

**Files:**
- Modify: `src/components/app/app-shell.tsx:160-200` (função `NavLink`)

O objetivo é adicionar uma barra vertical gradiente de 3px no lado esquerdo do item ativo da sidebar, além de `font-semibold` no texto ativo.

- [ ] **Step 2.1: Modificar NavLink para adicionar indicador ativo**

Localizar a função `NavLink` (linha ~160) e substituir o `<Link>`:

**Antes:**
```tsx
return (
  <Link
    href={item.href}
    onClick={onClick}
    className={cn(
      'flex items-center rounded-xl transition',
      hasBadge && 'relative',
      showLabel ? 'gap-3 px-3 py-2.5' : 'size-10 justify-center',
      isActive
        ? 'bg-accent text-primary'
        : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
    )}
  >
```

**Depois:**
```tsx
return (
  <Link
    href={item.href}
    onClick={onClick}
    className={cn(
      'relative flex items-center rounded-xl transition',
      showLabel ? 'gap-3 px-3 py-2.5' : 'size-10 justify-center',
      isActive
        ? 'bg-accent text-primary font-semibold'
        : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
    )}
  >
    {isActive && showLabel && (
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-[20%] h-[60%] w-[3px] rounded-r"
        style={{ background: 'linear-gradient(to bottom, #7C3AED, #DB2777)' }}
      />
    )}
```

Nota: O `hasBadge && 'relative'` é removido porque agora o Link é sempre `relative`. O badge de notificação (que usava `relative`) continua funcionando porque está dentro do Link que agora é sempre relativo.

- [ ] **Step 2.2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 2.3: Commit**

```bash
git add src/components/app/app-shell.tsx
git commit -m "feat(ui): adicionar barra ativa gradiente na sidebar desktop"
```

---

## Task 3: Bottom nav mobile — indicador e sombra (bottom-nav.tsx)

**Files:**
- Modify: `src/components/app/bottom-nav.tsx:68-80` (Link de cada nav item)

Adicionar: `relative` no Link, span de linha inferior no item ativo, `drop-shadow` nos ícones (ativo mais forte, inativo fraquinho).

- [ ] **Step 3.1: Atualizar os Links de navegação no bottom nav**

Localizar o mapa de `NAV_ITEMS` (linhas 53–81) e substituir o bloco do `<Link>`:

**Antes:**
```tsx
const Icon = item.icon
const isActive = pathname.startsWith(item.href)
return (
  <Link
    key={item.href}
    href={item.href}
    className={cn(
      'flex flex-col items-center gap-1 px-3 py-2 text-[10px] font-medium',
      isActive ? 'text-primary' : 'text-muted-foreground',
    )}
  >
    <Icon className={cn('size-5', isActive && 'fill-primary/15')} />
    <span>{item.label}</span>
  </Link>
)
```

**Depois:**
```tsx
const Icon = item.icon
const isActive = pathname.startsWith(item.href)
return (
  <Link
    key={item.href}
    href={item.href}
    className={cn(
      'relative flex flex-col items-center gap-1 px-3 py-2 text-[10px] font-medium',
      isActive ? 'text-primary' : 'text-muted-foreground',
    )}
  >
    <Icon
      className={cn('size-5', isActive && 'fill-primary/15')}
      style={
        isActive
          ? { filter: 'drop-shadow(0 0 5px rgba(124,58,237,0.35))' }
          : { filter: 'drop-shadow(0 0 3px rgba(124,58,237,0.15))' }
      }
    />
    <span>{item.label}</span>
    {isActive && (
      <span
        aria-hidden="true"
        className="absolute bottom-0 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full"
        style={{ background: 'linear-gradient(to right, #7C3AED, #DB2777)' }}
      />
    )}
  </Link>
)
```

- [ ] **Step 3.2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 3.3: Commit**

```bash
git add src/components/app/bottom-nav.tsx
git commit -m "feat(ui): linha ativa e sombra roxa no bottom nav mobile"
```

---

## Task 4: Landing page — logo e hero (landing-nav.tsx + landing-hero.tsx)

**Files:**
- Modify: `src/components/domain/landing/landing-nav.tsx:8`
- Modify: `src/components/domain/landing/landing-hero.tsx:6`

- [ ] **Step 4.1: Trocar logo textual por imagem em landing-nav.tsx**

**Antes (linha 8):**
```tsx
<Link href="/" className="text-xl font-extrabold bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent">
  Agendê
</Link>
```

**Depois:**
```tsx
<Link href="/" aria-label="Agendê — página inicial">
  {/* eslint-disable-next-line @next/next/no-img-element */}
  <img
    src="/brand/logo-horizontal.png"
    alt="Agendê"
    className="h-8 w-auto object-contain"
  />
</Link>
```

- [ ] **Step 4.2: Atualizar gradiente do hero em landing-hero.tsx**

**Antes (linha 6):**
```tsx
<section className="relative overflow-hidden bg-gradient-to-br from-violet-50 to-pink-50 px-4 sm:px-6 pb-10 sm:pb-16 pt-14 sm:pt-20 text-center">
```

**Depois:**
```tsx
<section className="relative overflow-hidden bg-gradient-to-br from-[#FAF8FF] via-[#F0EBFF] to-[#FCE8F3] px-4 sm:px-6 pb-10 sm:pb-16 pt-14 sm:pt-20 text-center">
```

- [ ] **Step 4.3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 4.4: Commit**

```bash
git add src/components/domain/landing/landing-nav.tsx src/components/domain/landing/landing-hero.tsx
git commit -m "feat(ui): logo Agendê na nav e gradiente hero landing page"
```

---

## Task 5: Página de agendamento público — hero compacto (page.tsx + booking-client.tsx)

**Files:**
- Modify: `src/app/(public)/agendar/[slug]/page.tsx:101-159`
- Modify: `src/app/(public)/agendar/[slug]/booking-client.tsx:55,83`

Substituir o padrão header fixo + banner separado por um hero compacto de 64px onde o banner do salão (ou gradiente padrão) é o fundo e as informações flutuam sobre ele com overlay escuro.

- [ ] **Step 5.1: Substituir estrutura do page.tsx — hero compacto**

Localizar o `return` da função `BookingPage` (linha 101) e substituir todo o JSX:

**Antes (linhas 101–159):**
```tsx
return (
  <div className="min-h-screen bg-[--booking-bg,#fafafa]">
    {brandingVars && <style>{`:root { ${brandingVars} }`}</style>}

    {/* Header fixo — branding do salão */}
    <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3">
      <div className="max-w-lg mx-auto flex items-center gap-3">
        {branding?.logoUrl ? (
          <img
            src={branding.logoUrl}
            alt={data.name}
            className="h-9 w-9 rounded-lg object-contain border border-slate-100"
          />
        ) : (
          <div
            className="h-9 w-9 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
            style={{ backgroundColor: branding?.primaryColor ?? '#191919' }}
          >
            {data.name[0]?.toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="font-semibold text-slate-900 text-sm leading-tight truncate">
            {data.name}
          </h1>
          {data.address && (
            <p className="text-xs text-slate-500 truncate">{data.address}</p>
          )}
        </div>
        <div className="ml-auto shrink-0">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
              isOpen ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${isOpen ? 'bg-green-500' : 'bg-slate-400'}`}
            />
            {isOpen ? 'Aberto' : 'Fechado'}
          </span>
        </div>
      </div>
    </header>

    {branding?.bannerUrl && (
      <div className="w-full max-w-lg mx-auto">
        <img
          src={branding.bannerUrl}
          alt={`Banner ${data.name}`}
          className="w-full h-36 object-cover"
        />
      </div>
    )}

    <main className="max-w-lg mx-auto px-4 py-6 pb-24">
      <BookingClient tenantData={data} />
    </main>
  </div>
)
```

**Depois:**
```tsx
return (
  <div className="min-h-screen bg-[--booking-bg,#FAFAFA]">
    {brandingVars && <style>{`:root { ${brandingVars} }`}</style>}

    {/* Hero compacto: banner do salão como fundo, info flutuando */}
    <div className="relative h-16 overflow-hidden">
      {/* Camada 1: fundo — banner do tenant ou gradiente padrão */}
      {branding?.bannerUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={branding.bannerUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, #7C3AED, #DB2777)' }}
        />
      )}

      {/* Camada 2: overlay escuro para garantir leitura */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.15), rgba(0,0,0,0.45))' }}
      />

      {/* Camada 3: conteúdo flutuando */}
      <div className="absolute inset-0 mx-auto flex max-w-lg items-center gap-3 px-4">
        {/* Logo do salão */}
        {branding?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.logoUrl}
            alt={data.name}
            className="size-[34px] shrink-0 rounded-[9px] border-2 border-white/75 object-contain shadow-md"
          />
        ) : (
          <div
            className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] border-2 border-white/75 text-sm font-bold text-white shadow-md"
            style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
          >
            {data.name[0]?.toUpperCase()}
          </div>
        )}

        {/* Nome e endereço */}
        <div className="min-w-0 flex-1">
          <h1
            className="truncate text-xs font-extrabold text-white"
            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}
          >
            {data.name}
          </h1>
          {data.address && (
            <p
              className="truncate text-[11px] text-white/80"
              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
            >
              {data.address}
            </p>
          )}
        </div>

        {/* Badge aberto/fechado */}
        <div className="ml-auto shrink-0">
          <span className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-white/20 px-2 py-0.5 text-xs font-medium text-white">
            <span
              className={`size-1.5 rounded-full ${isOpen ? 'bg-green-400' : 'bg-white/50'}`}
            />
            {isOpen ? 'Aberto' : 'Fechado'}
          </span>
        </div>
      </div>
    </div>

    <main className="mx-auto max-w-lg px-4 py-6 pb-24">
      <BookingClient tenantData={data} />
    </main>
  </div>
)
```

- [ ] **Step 5.2: Atualizar defaults de cor em booking-client.tsx**

Em `src/app/(public)/agendar/[slug]/booking-client.tsx`:

**Linha 55** — atualizar fallback CSS do progress bar:
```tsx
// antes:
index <= currentIndex ? 'bg-[--booking-primary,#191919]' : 'bg-slate-200'
// depois:
index <= currentIndex ? 'bg-[--booking-primary,#7C3AED]' : 'bg-slate-200'
```

**Linha 83** — atualizar fallback de primaryColor:
```tsx
// antes:
const primaryColor = tenantData.branding?.primaryColor ?? '#191919'
// depois:
const primaryColor = tenantData.branding?.primaryColor ?? '#7C3AED'
```

- [ ] **Step 5.3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 5.4: Commit**

```bash
git add "src/app/(public)/agendar/[slug]/page.tsx" "src/app/(public)/agendar/[slug]/booking-client.tsx"
git commit -m "feat(ui): hero compacto na página de agendamento público"
```

---

## Task 6: Admin sidebar — identidade escura (admin/layout.tsx)

**Files:**
- Modify: `src/app/(admin)/layout.tsx`

Substituir o visual atual (sidebar branca + banner vermelho) por sidebar escura `#1a1030` com logo mark Agendê e badge ADMIN rosa.

- [ ] **Step 6.1: Reescrever o layout do admin**

Substituir todo o conteúdo de `src/app/(admin)/layout.tsx`:

**Antes:**
```tsx
import Link from 'next/link'
import { LayoutDashboard, CreditCard, Building2, Settings, ArrowLeft, BookOpen } from 'lucide-react'

const NAV = [
  { href: '/admin',                  label: 'Visão Geral',   icon: LayoutDashboard },
  { href: '/admin/planos',           label: 'Planos',        icon: CreditCard },
  { href: '/admin/tenants',          label: 'Tenants',       icon: Building2 },
  { href: '/admin/catalogo',         label: 'Catálogo',      icon: BookOpen },
  { href: '/admin/configuracoes',    label: 'Configurações', icon: Settings },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-red-600 px-4 py-1.5 text-center text-xs font-medium text-white">
        Modo Administrador — você está gerenciando o sistema
      </div>
      <div className="flex">
        <aside className="sticky top-0 h-screen w-52 shrink-0 border-r border-slate-200 bg-white p-4">
          <p className="mb-6 text-xs font-semibold uppercase tracking-wider text-slate-400">Admin</p>
          <nav className="space-y-1">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900"
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="pt-6">
            <Link
              href="/agenda"
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-700"
            >
              <ArrowLeft className="size-3.5" />
              Voltar ao meu negócio
            </Link>
          </div>
        </aside>
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  )
}
```

**Depois:**
```tsx
import Link from 'next/link'
import { LayoutDashboard, CreditCard, Building2, Settings, ArrowLeft, BookOpen } from 'lucide-react'

const NAV = [
  { href: '/admin',               label: 'Visão Geral',   icon: LayoutDashboard },
  { href: '/admin/planos',        label: 'Planos',        icon: CreditCard },
  { href: '/admin/tenants',       label: 'Tenants',       icon: Building2 },
  { href: '/admin/catalogo',      label: 'Catálogo',      icon: BookOpen },
  { href: '/admin/configuracoes', label: 'Configurações', icon: Settings },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen" style={{ backgroundColor: '#0f0d1a' }}>
      <aside
        className="sticky top-0 flex h-screen w-52 shrink-0 flex-col p-4"
        style={{ backgroundColor: '#1a1030' }}
      >
        {/* Logo + badge ADMIN */}
        <div className="mb-6 flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo-mark.png"
            alt="Agendê"
            className="size-8 rounded-lg object-contain"
          />
          <span
            className="rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wide"
            style={{ color: '#DB2777', backgroundColor: 'rgba(219,39,119,0.15)' }}
          >
            Admin
          </span>
        </div>

        <nav className="flex-1 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition"
              style={{ color: 'rgba(255,255,255,0.5)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(124,58,237,0.4)'
                e.currentTarget.style.color = 'white'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = 'rgba(255,255,255,0.5)'
              }}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="pt-4">
          <Link
            href="/agenda"
            className="flex items-center gap-2 text-xs transition"
            style={{ color: 'rgba(255,255,255,0.35)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)' }}
          >
            <ArrowLeft className="size-3.5" />
            Voltar ao meu negócio
          </Link>
        </div>
      </aside>

      <main className="flex-1 p-8 text-white">{children}</main>
    </div>
  )
}
```

- [ ] **Step 6.2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 6.3: Commit**

```bash
git add "src/app/(admin)/layout.tsx"
git commit -m "feat(ui): sidebar escura no admin com logo Agendê e badge rosa"
```

---

## Task 7: PWA icons — gradiente roxo/rosa (icon-192.svg + icon-512.svg)

**Files:**
- Modify: `public/icons/icon-192.svg`
- Modify: `public/icons/icon-512.svg`

Substituir o retângulo preto (`#0f172a`) por um gradiente roxo→rosa e atualizar a letra "A" para lettering mais moderno com a letra minúscula "a" em estilo da marca.

- [ ] **Step 7.1: Atualizar icon-192.svg**

Substituir o conteúdo completo de `public/icons/icon-192.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7C3AED"/>
      <stop offset="100%" stop-color="#DB2777"/>
    </linearGradient>
  </defs>
  <rect width="192" height="192" rx="42" fill="url(#g)"/>
  <text x="96" y="136" font-family="system-ui,sans-serif" font-size="120" font-weight="800" fill="white" text-anchor="middle">a</text>
</svg>
```

- [ ] **Step 7.2: Atualizar icon-512.svg**

Substituir o conteúdo completo de `public/icons/icon-512.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7C3AED"/>
      <stop offset="100%" stop-color="#DB2777"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#g)"/>
  <text x="256" y="362" font-family="system-ui,sans-serif" font-size="320" font-weight="800" fill="white" text-anchor="middle">a</text>
</svg>
```

- [ ] **Step 7.3: Verificar TypeScript (confirmação final + testes)**

```bash
npx tsc --noEmit
npx vitest run
```

Esperado: zero erros de TypeScript, todos os testes passando.

- [ ] **Step 7.4: Commit final**

```bash
git add public/icons/icon-192.svg public/icons/icon-512.svg
git commit -m "feat(ui): PWA icons com gradiente roxo/rosa da identidade Agendê"
```

---

## Self-review checklist

- [x] **Cobertura da spec:** Todos os 14 itens da spec cobertos — tokens (seção 3), fonte (seção 4), sombras via tokens (seção 5), logo (seção 6), sidebar desktop (seção 7), bottom nav (seção 8), landing (seção 9), página do cliente (seção 10), admin (seção 11), build-css-variables fallbacks (seção 12), superfícies (seção 13)
- [x] **Sem placeholders:** Todos os steps têm código completo
- [x] **Consistência de tipos:** Nenhum tipo novo introduzido — apenas valores de string substituídos
- [x] **Escopo preservado:** Lógica de branding por tenant intocada; bottom nav estrutura intocada; FAB central intocado; responsividade intocada
- [x] **Nota hover no admin:** O `onMouseEnter`/`onMouseLeave` inline é necessário porque o layout admin é um Server Component sem acesso ao pathname (não pode usar `usePathname`). Para active state server-rendered seria necessário uma Client Component wrapper — fora do escopo desta task; hover state é suficiente para o admin.

---

## Branch e PR

Este trabalho deve ser executado em branch dedicada:

```bash
git checkout -b feat/identidade-visual-agende
```

Após todas as tasks, abrir PR para `main` com checklist do CLAUDE.md.
