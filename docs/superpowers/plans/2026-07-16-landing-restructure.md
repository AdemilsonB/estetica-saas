# Reestruturação da Landing Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reestruturar a landing pública do Agendê seguindo a narrativa de conversão da referência (Claude Design), mobile-first, preservando os dados reais do banco e o seletor de tema ao vivo.

**Architecture:** `src/app/(public)/page.tsx` (Server Component, `revalidate = 3600`) busca planos + métricas + depoimentos e passa como props para seções. Seções puras são Server Components; seções interativas são `'use client'` usando framer-motion (já no projeto) para scroll-reveal e contadores. O marquee é CSS puro. Nenhuma dependência nova.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Tailwind v4, framer-motion, Prisma, Vitest + Testing Library.

## Global Constraints

- **Idioma:** todo texto, comentário, commit e código em Português do Brasil.
- **Mobile-first:** cada seção nasce no mobile e escala `base → sm/md → lg`; alvos de toque ≥ 44px; títulos com `clamp()`; grids 3-col → 1 col no mobile; passar pelo checklist do `agent-mobile`.
- **Sem dependências novas.** Reusar framer-motion (`useReducedMotion`, `useInView`, `motion`).
- **Prova social só de dados reais:** marquee, contadores e caso real derivam de `landingMetric` / `landingTestimonial`. Nenhum nome ou número fabricado em código. Seções dependentes de dados **retornam `null`** quando não há dado.
- **Toggle Mensal/Anual:** construído, mas só renderiza quando existir preço anual no catálogo (hoje: oculto). Não implementar billing anual aqui.
- **Tokens já existentes** (`src/app/globals.css`): `--primary: #7C3AED`, `--background: #FAFAFA`, `--secondary: #F5F3FF`. Fontes já carregadas: Manrope (corpo) e Plus Jakarta Sans (`--font-plus-jakarta-sans`, para títulos).
- **TypeScript strict:** sem `any`, sem `as unknown as`.
- **Gate final:** `npx tsc --noEmit` limpo e `npx vitest run` verde antes do PR.
- **Branch:** `feat/landing-restructure`. PR para `main`.

## Referência de conteúdo

Cópia e valores exatos: `Agende.dc.html` (na raiz do handoff). Quando um texto/medida estiver em dúvida, esse arquivo é a fonte de verdade.

## File Structure

**Criar:**
- `src/components/domain/landing/landing-reveal.tsx` — wrapper `<Reveal>` de scroll-reveal (client).
- `src/components/domain/landing/use-count-up.ts` — hook `useCountUp` + parser de métrica (client).
- `src/components/domain/landing/use-count-up.test.ts` — testes do parser/format.
- `src/components/domain/landing/landing-marquee.tsx` — faixa de salões (deriva de depoimentos).
- `src/components/domain/landing/landing-marquee.test.tsx` — degradação sem dados.
- `src/components/domain/landing/landing-pain.tsx` — seção "Dor".
- `src/components/domain/landing/landing-mechanism.tsx` — 3 cards de mecanismo.
- `src/components/domain/landing/landing-demo-mobile.tsx` — frame de celular.
- `src/components/domain/landing/landing-whatsapp.tsx` — seção escura + chat (client, reveal).
- `src/components/domain/landing/landing-case-real.tsx` — depoimento em destaque (degrada).
- `src/components/domain/landing/landing-case-real.test.tsx` — degradação sem dados.
- `src/components/domain/landing/landing-guarantee.tsx` — garantia 14 dias.
- `src/components/domain/landing/landing-faq.tsx` — FAQ (extraída de Planos).

**Modificar:**
- `src/app/globals.css` — `@keyframes marquee` + utilitário `.font-display`.
- `src/components/domain/landing/landing-nav.tsx` — menu hambúrguer mobile.
- `src/components/domain/landing/landing-hero.tsx` — layout 2 colunas + badge flutuante.
- `src/components/domain/landing/landing-proof-bar.tsx` — contadores animados.
- `src/components/domain/landing/landing-features.tsx` — grid de 6 cards.
- `src/components/domain/landing/landing-how-it-works.tsx` — polimento (reveal).
- `src/components/domain/landing/landing-plans.tsx` — toggle condicional + remover FAQ.
- `src/components/domain/landing/landing-pricing-cta.tsx` — CTA final enriquecido + P.S.
- `src/components/domain/landing/landing-footer.tsx` — 4 colunas.
- `src/components/domain/billing/pricing-toggle.tsx` — aceitar `showAnnualToggle`/`annualPrice`.
- `src/app/(public)/page.tsx` — montar a nova ordem de seções.
- `src/app/(public)/landing.test.ts` — ajustar se a forma dos dados mudar.

---

### Task 1: Utilitários de animação (globals.css + font-display)

**Files:**
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: classe CSS `animate-marquee` (via `@keyframes marquee`), classe `.font-display` (Plus Jakarta Sans). A pausa no hover e o fade são aplicados pelos componentes com Tailwind.

- [ ] **Step 1: Adicionar keyframes e utilitário ao final de `globals.css`**

```css
/* === Landing: marquee e tipografia de títulos === */
@keyframes marquee {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
.animate-marquee {
  animation: marquee 38s linear infinite;
}
.marquee-wrap:hover .animate-marquee {
  animation-play-state: paused;
}
@media (prefers-reduced-motion: reduce) {
  .animate-marquee { animation: none; }
}
.font-display {
  font-family: var(--font-plus-jakarta-sans), var(--font-sans), system-ui, sans-serif;
  letter-spacing: -0.02em;
}
```

- [ ] **Step 2: Verificar build de CSS**

Run: `npx tsc --noEmit`
Expected: PASS (sem erros — CSS não afeta tsc, mas confirma que nada quebrou nos imports).

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(landing): keyframes do marquee e utilitário font-display"
```

---

### Task 2: Hook `useCountUp` + parser de métrica

**Files:**
- Create: `src/components/domain/landing/use-count-up.ts`
- Test: `src/components/domain/landing/use-count-up.test.ts`

**Interfaces:**
- Produces:
  - `parseMetric(value: string): { prefix: string; number: number; decimals: number; suffix: string } | null` — separa prefixo não-numérico, número (aceita `.`/`,` pt-BR), casas decimais e sufixo. Retorna `null` se não houver número.
  - `formatMetric(number: number, decimals: number): string` — formata em pt-BR (milhar `.`, decimal `,`).
  - `useCountUp(value: string, active: boolean): string` — string animada 0→alvo quando `active` vira `true`; respeita `useReducedMotion` (retorna valor final direto).

- [ ] **Step 1: Escrever o teste do parser/format**

```ts
// src/components/domain/landing/use-count-up.test.ts
import { describe, it, expect } from 'vitest'
import { parseMetric, formatMetric } from './use-count-up'

describe('parseMetric', () => {
  it('separa prefixo, número e sufixo', () => {
    expect(parseMetric('+1.200')).toEqual({ prefix: '+', number: 1200, decimals: 0, suffix: '' })
    expect(parseMetric('98%')).toEqual({ prefix: '', number: 98, decimals: 0, suffix: '%' })
    expect(parseMetric('-40%')).toEqual({ prefix: '-', number: 40, decimals: 0, suffix: '%' })
    expect(parseMetric('24h')).toEqual({ prefix: '', number: 24, decimals: 0, suffix: 'h' })
  })

  it('trata decimal pt-BR', () => {
    expect(parseMetric('4,9')).toEqual({ prefix: '', number: 4.9, decimals: 1, suffix: '' })
  })

  it('retorna null quando não há número', () => {
    expect(parseMetric('sem número')).toBeNull()
  })
})

describe('formatMetric', () => {
  it('formata milhar e decimal em pt-BR', () => {
    expect(formatMetric(1200, 0)).toBe('1.200')
    expect(formatMetric(4.9, 1)).toBe('4,9')
    expect(formatMetric(98, 0)).toBe('98')
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/components/domain/landing/use-count-up.test.ts`
Expected: FAIL ("Failed to resolve import './use-count-up'").

- [ ] **Step 3: Implementar o hook e utilitários**

```ts
// src/components/domain/landing/use-count-up.ts
'use client'

import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

export type ParsedMetric = {
  prefix: string
  number: number
  decimals: number
  suffix: string
}

/** Separa "+1.200", "98%", "-40%", "24h", "4,9" em partes animáveis. */
export function parseMetric(value: string): ParsedMetric | null {
  const match = value.match(/^(\D*?)([\d.,]+)(\D*)$/)
  if (!match) return null
  const [, prefixRaw, numRaw, suffix] = match
  // Normaliza pt-BR: remove separador de milhar '.', troca decimal ',' por '.'
  const normalized = numRaw.replace(/\./g, '').replace(',', '.')
  const number = Number(normalized)
  if (Number.isNaN(number)) return null
  const decimals = numRaw.includes(',') ? (numRaw.split(',')[1]?.length ?? 0) : 0
  return { prefix: prefixRaw, number, decimals, suffix }
}

export function formatMetric(number: number, decimals: number): string {
  return number.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** Anima 0 → alvo quando `active` fica true. Reduced-motion = valor final direto. */
export function useCountUp(value: string, active: boolean): string {
  const reduceMotion = useReducedMotion()
  const parsed = parseMetric(value)
  const [display, setDisplay] = useState<string>(() =>
    parsed ? `${parsed.prefix}${formatMetric(0, parsed.decimals)}${parsed.suffix}` : value,
  )

  useEffect(() => {
    if (!parsed) {
      setDisplay(value)
      return
    }
    if (!active) return
    if (reduceMotion) {
      setDisplay(`${parsed.prefix}${formatMetric(parsed.number, parsed.decimals)}${parsed.suffix}`)
      return
    }
    const duration = 1500
    const start = performance.now()
    let raf = 0
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(`${parsed.prefix}${formatMetric(parsed.number * eased, parsed.decimals)}${parsed.suffix}`)
      if (p < 1) raf = requestAnimationFrame(step)
      else setDisplay(`${parsed.prefix}${formatMetric(parsed.number, parsed.decimals)}${parsed.suffix}`)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, value, reduceMotion])

  return display
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/components/domain/landing/use-count-up.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/domain/landing/use-count-up.ts src/components/domain/landing/use-count-up.test.ts
git commit -m "feat(landing): hook useCountUp com parser de métrica pt-BR"
```

---

### Task 3: Wrapper `<Reveal>` de scroll-reveal

**Files:**
- Create: `src/components/domain/landing/landing-reveal.tsx`

**Interfaces:**
- Produces: `<Reveal delay?: number; as?: 'div' | 'section' | 'li'; className?: string; children>` — envolve conteúdo com fade+slide ao entrar na viewport (framer-motion `whileInView`), `once: true`, desligado em reduced-motion.

- [ ] **Step 1: Implementar o componente**

```tsx
// src/components/domain/landing/landing-reveal.tsx
'use client'

import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

interface RevealProps {
  children: ReactNode
  delay?: number
  className?: string
}

export function Reveal({ children, delay = 0, className }: RevealProps) {
  const reduceMotion = useReducedMotion()

  if (reduceMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: delay / 1000 }}
    >
      {children}
    </motion.div>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/landing/landing-reveal.tsx
git commit -m "feat(landing): wrapper Reveal de scroll-reveal com framer-motion"
```

---

### Task 4: Barra de prova com contadores animados

**Files:**
- Modify: `src/components/domain/landing/landing-proof-bar.tsx`

**Interfaces:**
- Consumes: `useCountUp` (Task 2).
- Produces: `<LandingProofBar metrics={...} />` (mesma prop de hoje). Vira `'use client'`.

- [ ] **Step 1: Reescrever o componente com contador**

```tsx
// src/components/domain/landing/landing-proof-bar.tsx
'use client'

import { useRef } from 'react'
import { useInView } from 'framer-motion'
import type { LandingMetric } from '@prisma/client'
import { useCountUp } from './use-count-up'

interface LandingProofBarProps {
  metrics: Pick<LandingMetric, 'id' | 'value' | 'label'>[]
}

function MetricItem({ value, label, active }: { value: string; label: string; active: boolean }) {
  const display = useCountUp(value, active)
  return (
    <div className="text-center">
      <div className="font-display bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-3xl font-extrabold text-transparent sm:text-4xl">
        {display}
      </div>
      <div className="mt-1 text-xs text-slate-500 sm:text-sm">{label}</div>
    </div>
  )
}

export function LandingProofBar({ metrics }: LandingProofBarProps) {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })

  if (metrics.length === 0) return null

  return (
    <section ref={ref} className="border-y border-violet-100 bg-white px-6 py-8 sm:py-10">
      <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 md:grid-cols-4">
        {metrics.map((metric) => (
          <MetricItem key={metric.id} value={metric.value} label={metric.label} active={inView} />
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/landing/landing-proof-bar.tsx
git commit -m "feat(landing): contadores animados na barra de prova"
```

---

### Task 5: Marquee de salões (deriva de depoimentos)

**Files:**
- Create: `src/components/domain/landing/landing-marquee.tsx`
- Test: `src/components/domain/landing/landing-marquee.test.tsx`

**Interfaces:**
- Consumes: `LandingTestimonial` (campos `id`, `authorName`, `authorRole`).
- Produces: `<LandingMarquee salons={Array<{ id; authorName; authorRole }>} />` — retorna `null` se `salons.length === 0`. Duplica o conjunto para loop contínuo.

- [ ] **Step 1: Escrever o teste de degradação**

```tsx
// src/components/domain/landing/landing-marquee.test.tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { LandingMarquee } from './landing-marquee'

describe('LandingMarquee', () => {
  it('não renderiza nada sem salões', () => {
    const { container } = render(<LandingMarquee salons={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renderiza o nome do salão (duplicado no loop)', () => {
    const { getAllByText } = render(
      <LandingMarquee salons={[{ id: '1', authorName: 'Studio X', authorRole: 'São Paulo · SP' }]} />,
    )
    // set A + set B => aparece 2x
    expect(getAllByText('Studio X')).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/components/domain/landing/landing-marquee.test.tsx`
Expected: FAIL ("Failed to resolve import './landing-marquee'").

- [ ] **Step 3: Implementar o componente**

```tsx
// src/components/domain/landing/landing-marquee.tsx
import type { LandingTestimonial } from '@prisma/client'

type Salon = Pick<LandingTestimonial, 'id' | 'authorName' | 'authorRole'>

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function SalonCard({ salon }: { salon: Salon }) {
  return (
    <div className="flex items-center gap-3 whitespace-nowrap rounded-2xl border border-violet-100 bg-violet-50/40 px-5 py-3.5">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 text-sm font-extrabold text-white">
        {initials(salon.authorName)}
      </span>
      <div>
        <div className="font-display text-sm font-extrabold text-slate-900">{salon.authorName}</div>
        <div className="text-xs text-slate-500">{salon.authorRole}</div>
      </div>
    </div>
  )
}

export function LandingMarquee({ salons }: { salons: Salon[] }) {
  if (salons.length === 0) return null

  return (
    <section className="overflow-hidden border-y border-violet-100 bg-white py-8">
      <p className="mb-6 px-6 text-center text-xs font-extrabold uppercase tracking-wide text-violet-600">
        Salões, barbearias e clínicas que já vivem no automático
      </p>
      <div
        className="marquee-wrap relative"
        style={{
          maskImage: 'linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)',
          WebkitMaskImage: 'linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)',
        }}
      >
        <div className="animate-marquee flex w-max gap-4">
          {[...salons, ...salons].map((salon, i) => (
            <SalonCard key={`${salon.id}-${i}`} salon={salon} />
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/components/domain/landing/landing-marquee.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/domain/landing/landing-marquee.tsx src/components/domain/landing/landing-marquee.test.tsx
git commit -m "feat(landing): marquee de salões derivado dos depoimentos reais"
```

---

### Task 6: Nav com menu hambúrguer mobile

**Files:**
- Modify: `src/components/domain/landing/landing-nav.tsx`

**Interfaces:**
- Produces: `<LandingNav />` (sem props). Abaixo de `md`, os links colapsam num painel; CTA "Grátis" fica sempre visível.

- [ ] **Step 1: Reescrever a nav com estado do menu**

```tsx
// src/components/domain/landing/landing-nav.tsx
'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

const NAV_LINKS = [
  { href: '#funcionalidades', label: 'Funcionalidades' },
  { href: '#como-funciona', label: 'Como funciona' },
  { href: '#planos', label: 'Planos' },
  { href: '#depoimentos', label: 'Depoimentos' },
] as const

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-all duration-300 ${
        scrolled
          ? 'border-slate-200 bg-white/80 shadow-sm backdrop-blur-md'
          : 'border-transparent bg-white/60 backdrop-blur-sm'
      }`}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        <Link href="/" aria-label="Agendê — página inicial" className="shrink-0">
          <Image
            src="/brand/logo-horizontal.png"
            alt="Agendê"
            width={550}
            height={136}
            priority
            className="h-7 w-auto sm:h-8"
          />
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-slate-600 transition-colors hover:text-slate-900"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="hidden rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900 sm:inline-block sm:px-4"
          >
            Entrar
          </Link>
          <Link
            href="/login?tab=signup"
            className="rounded-lg bg-gradient-to-r from-violet-600 to-pink-600 px-3 py-2 text-sm font-bold text-white shadow-md shadow-violet-200 transition-opacity hover:opacity-90 sm:px-4"
          >
            <span className="hidden sm:inline">Começar grátis →</span>
            <span className="sm:hidden">Grátis →</span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={open}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 md:hidden"
          >
            <span className="text-xl">{open ? '✕' : '☰'}</span>
          </button>
        </div>
      </nav>

      {/* Painel mobile */}
      {open && (
        <div className="border-t border-slate-100 bg-white px-4 py-3 md:hidden">
          <div className="flex flex-col">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-3 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-3 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Entrar
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/landing/landing-nav.tsx
git commit -m "feat(landing): menu hambúrguer mobile na nav"
```

---

### Task 7: Hero 2 colunas + badge flutuante

**Files:**
- Modify: `src/components/domain/landing/landing-hero.tsx`

**Interfaces:**
- Produces: `<LandingHero trialDays={number | null} />` (mesma prop).

- [ ] **Step 1: Reescrever o hero em 2 colunas**

Manter o mockup de dashboard atual (linhas 60-122 do arquivo original), envolvendo em layout de grid. Estrutura:

```tsx
// src/components/domain/landing/landing-hero.tsx
import Link from 'next/link'

interface LandingHeroProps {
  trialDays: number | null
}

export function LandingHero({ trialDays }: LandingHeroProps) {
  const trialMicrotrust = trialDays ? `${trialDays} dias grátis` : 'Trial grátis'

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#FAF8FF] via-[#F0EBFF] to-[#FCE8F3] px-4 pb-12 pt-12 sm:px-6 sm:pb-20 sm:pt-20">
      <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-violet-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 bottom-0 h-64 w-64 rounded-full bg-pink-200/30 blur-3xl" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_.95fr] lg:gap-14">
        {/* Coluna de texto */}
        <div className="text-center lg:text-left">
          <div className="mb-5 inline-block rounded-full border border-violet-200 bg-gradient-to-r from-violet-50 to-pink-50 px-4 py-1.5 text-xs font-semibold text-violet-700">
            ✨ Feito para salões, barbearias e clínicas
          </div>
          <h1 className="font-display mx-auto max-w-2xl text-[clamp(1.9rem,6vw,3.25rem)] font-extrabold leading-[1.08] text-slate-900 lg:mx-0">
            Pare de perder cliente no telefone tocando. Sua agenda no{' '}
            <span className="bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent">
              piloto automático.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-sm text-slate-500 sm:text-lg lg:mx-0">
            Agenda online, WhatsApp automático e financeiro em tempo real — tudo num lugar só.
            Sem planilha, sem telefone tocando.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <Link
              href="/login?tab=signup"
              className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 px-8 py-4 text-base font-bold text-white shadow-lg shadow-violet-200 transition-opacity hover:opacity-90 sm:w-auto"
            >
              Começar trial grátis →
            </Link>
            <Link
              href="#planos"
              className="flex items-center gap-2 text-sm font-semibold text-violet-600 transition-colors hover:text-violet-800"
            >
              Ver planos e preços
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-400">
            ✓ sem cartão de crédito · {trialMicrotrust}
          </p>
        </div>

        {/* Coluna do mockup (com badge flutuante) */}
        <div className="relative">
          <div className="overflow-x-auto">
            <div className="min-w-[22rem] overflow-hidden rounded-2xl border border-slate-200 shadow-2xl shadow-slate-900/20">
              {/* ===== COLAR AQUI o conteúdo do mockup do arquivo original (barra do browser + grid do dashboard, linhas 62-121) ===== */}
            </div>
          </div>
          {/* Badge flutuante */}
          <div className="absolute -bottom-4 -left-3 flex items-center gap-2 rounded-2xl border border-violet-100 bg-white px-3 py-2 shadow-xl shadow-violet-200/50 sm:-left-5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#25D366] text-sm text-white">✓</span>
            <div>
              <div className="text-xs font-extrabold text-slate-900">Confirmação automática</div>
              <div className="text-[11px] text-slate-500">enviada há 2 min</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
```

Copiar o bloco do mockup (barra do browser + `grid grid-cols-[180px_1fr]`) das linhas 62-121 da versão original do arquivo para dentro do `min-w-[22rem]`.

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/landing/landing-hero.tsx
git commit -m "feat(landing): hero em 2 colunas com badge flutuante"
```

---

### Task 8: Seção "Dor"

**Files:**
- Create: `src/components/domain/landing/landing-pain.tsx`

**Interfaces:**
- Produces: `<LandingPain />`.

- [ ] **Step 1: Implementar**

```tsx
// src/components/domain/landing/landing-pain.tsx
import { Reveal } from './landing-reveal'

export function LandingPain() {
  return (
    <section className="bg-[#FAFAFA] px-4 py-16 sm:px-6 sm:py-20">
      <Reveal className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-extrabold uppercase tracking-wide text-pink-600">
          A sexta-feira que você conhece bem
        </p>
        <h2 className="font-display mt-4 text-[clamp(1.6rem,4.5vw,2.4rem)] font-extrabold leading-tight text-slate-900">
          São 20h. Três clientes confirmaram de manhã. Duas não apareceram.
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-500 sm:text-lg">
          A cadeira fica vazia, o dinheiro não entra — e você nem tem como cobrar sem parecer
          chata. No dia seguinte é a planilha que não bate, o WhatsApp com 40 mensagens sem
          responder e o caderninho de horários que só você entende.{' '}
          <strong className="text-slate-900">Não é falta de cliente. É falta de sistema.</strong>
        </p>
      </Reveal>
    </section>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/landing/landing-pain.tsx
git commit -m "feat(landing): seção de dor (São 20h)"
```

---

### Task 9: Seção "Mecanismo" (3 cards)

**Files:**
- Create: `src/components/domain/landing/landing-mechanism.tsx`

**Interfaces:**
- Produces: `<LandingMechanism />`.

- [ ] **Step 1: Implementar**

```tsx
// src/components/domain/landing/landing-mechanism.tsx
import { Reveal } from './landing-reveal'

const CARDS = [
  {
    n: '01',
    badge: 'bg-violet-50 text-violet-600',
    title: 'Ele confirma antes de você acordar',
    text: 'Cada agendamento dispara confirmação e lembrete no WhatsApp automaticamente. A cliente responde num toque — e a agenda furada de sexta vira exceção, não regra.',
  },
  {
    n: '02',
    badge: 'bg-pink-50 text-pink-600',
    title: 'Ele preenche os buracos da agenda',
    text: 'Cancelou às 14h? A lista de espera é avisada na hora e o horário volta a vender sozinho. Você recupera faturamento que hoje evapora silenciosamente.',
  },
  {
    n: '03',
    badge: 'bg-emerald-50 text-emerald-600',
    title: 'Ele fecha o caixa no fim do dia',
    text: 'Quanto entrou, quanto cada profissional produziu, o que vender amanhã. Sem planilha, sem calculadora — o número está pronto quando você desliga a luz.',
  },
] as const

export function LandingMechanism() {
  return (
    <section className="bg-[#FAFAFA] px-4 pb-16 sm:px-6 sm:pb-20">
      <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-3">
        {CARDS.map((card, i) => (
          <Reveal key={card.n} delay={i * 100}>
            <div className="h-full rounded-2xl border border-violet-100 bg-white p-6 sm:p-7">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-lg font-extrabold ${card.badge}`}>
                {card.n}
              </div>
              <h3 className="font-display mt-5 text-xl font-extrabold text-slate-900">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{card.text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/landing/landing-mechanism.tsx
git commit -m "feat(landing): seção mecanismo com 3 cards"
```

---

### Task 10: Funcionalidades em grid de 6 cards

**Files:**
- Modify: `src/components/domain/landing/landing-features.tsx`

**Interfaces:**
- Produces: `<LandingFeatures />`. Remove os arrays `FEATURES`/`MORE_FEATURES` alternados e os mockups (que migram para as Tasks 11 e 12). `landing-feature-mockups.tsx` permanece no repo (usado pelas Tasks 11/12).

- [ ] **Step 1: Reescrever como grid de 6 cards**

```tsx
// src/components/domain/landing/landing-features.tsx
import { Reveal } from './landing-reveal'

type Feature = {
  icon: string
  title: string
  description: string
  metric: string
  metricColor: string
}

const FEATURES: Feature[] = [
  {
    icon: '🗓️',
    title: 'Agenda que vende 24h',
    description: 'Sua cliente marca de madrugada, no domingo, sem te mandar mensagem. Você acorda com a agenda cheia.',
    metric: '+30% de agendamentos',
    metricColor: 'text-violet-600',
  },
  {
    icon: '💬',
    title: 'WhatsApp no automático',
    description: 'Confirmação, lembrete e retorno saem sozinhos, com a sua voz. Chega de digitar a mesma mensagem 40 vezes por dia.',
    metric: '−40% de faltas',
    metricColor: 'text-pink-600',
  },
  {
    icon: '📊',
    title: 'Financeiro em tempo real',
    description: 'Faturamento, comissão e ticket médio calculados na hora. Você decide com número, não com achismo.',
    metric: '0 planilhas',
    metricColor: 'text-emerald-600',
  },
  {
    icon: '💜',
    title: 'Fidelização que traz de volta',
    description: 'Aniversário, retorno atrasado, cliente sumida: o Agendê lembra você — e reconquista por você.',
    metric: 'clientes voltam 2x mais',
    metricColor: 'text-violet-600',
  },
  {
    icon: '🛡️',
    title: 'Anti-falta de verdade',
    description: 'Confirmação em duas etapas e lista de espera automática. O horário vago não fica vago.',
    metric: 'agenda mais cheia',
    metricColor: 'text-pink-600',
  },
  {
    icon: '🏷️',
    title: 'Sua marca, sua vitrine',
    description: 'Página pública com suas cores, seus serviços e seus preços. Um link só, do jeitinho do seu salão.',
    metric: '100% personalizável',
    metricColor: 'text-emerald-600',
  },
]

export function LandingFeatures() {
  return (
    <section id="funcionalidades" className="bg-white px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mb-10 text-center sm:mb-14">
          <p className="text-sm font-extrabold uppercase tracking-wide text-violet-600">Tudo num lugar só</p>
          <h2 className="font-display mt-3 text-[clamp(1.6rem,4.5vw,2.4rem)] font-extrabold text-slate-900">
            O que você ganha quando o Agendê assume
          </h2>
        </Reveal>

        <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <Reveal key={feature.title} delay={(i % 3) * 80}>
              <div className="h-full rounded-2xl border border-violet-100 bg-violet-50/40 p-6">
                <div className="text-2xl">{feature.icon}</div>
                <h3 className="font-display mt-3 text-lg font-extrabold text-slate-900">{feature.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{feature.description}</p>
                <span className={`mt-3 inline-block text-sm font-extrabold ${feature.metricColor}`}>
                  {feature.metric}
                </span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/landing/landing-features.tsx
git commit -m "feat(landing): funcionalidades em grid de 6 cards"
```

---

### Task 11: Demo mobile (frame de celular, reusa MockAgenda)

**Files:**
- Create: `src/components/domain/landing/landing-demo-mobile.tsx`

**Interfaces:**
- Consumes: `MockAgenda` de `landing-feature-mockups.tsx`.
- Produces: `<LandingDemoMobile />`.

- [ ] **Step 1: Implementar**

```tsx
// src/components/domain/landing/landing-demo-mobile.tsx
import { Reveal } from './landing-reveal'
import { MockAgenda } from './landing-feature-mockups'

const STEPS = [
  'Escolhe o serviço e o profissional favorito',
  'Vê os horários realmente disponíveis, ao vivo',
  'Confirma e recebe tudo no WhatsApp na hora',
]

export function LandingDemoMobile() {
  return (
    <section id="demo" className="bg-gradient-to-b from-[#F5F3FF] to-[#FAFAFA] px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2 md:gap-14">
        <Reveal>
          <p className="text-sm font-extrabold uppercase tracking-wide text-violet-600">
            7 em cada 10 clientes agendam pelo celular
          </p>
          <h2 className="font-display mt-3 text-[clamp(1.6rem,4.5vw,2.4rem)] font-extrabold text-slate-900">
            Veja como sua cliente agenda em 30 segundos
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-slate-500 sm:text-lg">
            Ela abre seu link, escolhe o serviço, vê os horários livres de verdade e confirma.
            Sem app pra baixar, sem ligação, sem espera.
          </p>
          <ul className="mt-6 flex flex-col gap-3">
            {STEPS.map((step, i) => (
              <li key={step} className="flex items-start gap-3 text-sm text-slate-700 sm:text-base">
                <span className="font-extrabold text-violet-600">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={120} className="w-full">
          <div className="mx-auto w-full max-w-sm">
            <MockAgenda />
          </div>
        </Reveal>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS. (Se `MockAgenda` não for exportado com esse nome, conferir os exports reais em `landing-feature-mockups.tsx` e ajustar.)

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/landing/landing-demo-mobile.tsx
git commit -m "feat(landing): seção demo mobile reaproveitando MockAgenda"
```

---

### Task 12: Seção WhatsApp escura + chat

**Files:**
- Create: `src/components/domain/landing/landing-whatsapp.tsx`

**Interfaces:**
- Produces: `<LandingWhatsApp />` (client — bolhas com reveal escalonado).

- [ ] **Step 1: Implementar**

```tsx
// src/components/domain/landing/landing-whatsapp.tsx
'use client'

import { motion, useReducedMotion } from 'framer-motion'
import Link from 'next/link'

const BUBBLES: { side: 'in' | 'out'; text: string; delay: number }[] = [
  { side: 'in', text: 'Oi Marina! 💜 Confirmando seu horário de amanhã 14h — Escova + Hidratação. Está de pé?', delay: 0.2 },
  { side: 'out', text: 'Tá sim! Obrigada 😊', delay: 0.5 },
  { side: 'in', text: 'Perfeito, te espero! Qualquer coisa é só responder por aqui. ✨', delay: 0.8 },
]

export function LandingWhatsApp() {
  const reduceMotion = useReducedMotion()

  return (
    <section className="bg-[#111827] px-4 py-16 text-white sm:px-6 sm:py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2 md:gap-14">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-wide text-[#25D366]">Enquanto você atende</p>
          <h2 className="font-display mt-3 text-[clamp(1.6rem,4.5vw,2.4rem)] font-extrabold">
            O WhatsApp trabalha sozinho — com a sua voz
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-slate-300 sm:text-lg">
            Você configura uma vez o tom das mensagens. Depois é o Agendê que confirma, lembra
            24h antes, avisa a lista de espera e chama de volta quem sumiu.
          </p>
          <Link
            href="/login?tab=signup"
            className="mt-6 inline-block rounded-xl bg-[#25D366] px-6 py-3.5 text-sm font-extrabold text-[#111827] transition-colors hover:bg-[#1eb857]"
          >
            Quero automatizar meu WhatsApp
          </Link>
        </div>

        <div className="rounded-2xl bg-[#0b141a] p-5 shadow-2xl shadow-black/40">
          <div className="mb-4 flex items-center gap-3 border-b border-white/10 pb-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-sm font-extrabold">
              SB
            </span>
            <div>
              <div className="text-sm font-bold">Studio Bella</div>
              <div className="text-xs text-[#25D366]">online</div>
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            {BUBBLES.map((b, i) => (
              <motion.div
                key={i}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: reduceMotion ? 0 : b.delay, duration: 0.35 }}
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${
                  b.side === 'in'
                    ? 'self-start rounded-bl-sm bg-[#1f2c33]'
                    : 'self-end rounded-br-sm bg-[#005c4b]'
                }`}
              >
                {b.text}
              </motion.div>
            ))}
            <span className="mt-1 self-center rounded-full bg-white/5 px-3 py-1 text-[11px] text-slate-400">
              enviado automaticamente pelo Agendê
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/landing/landing-whatsapp.tsx
git commit -m "feat(landing): seção WhatsApp escura com chat animado"
```

---

### Task 13: Caso real (depoimento em destaque, degrada)

**Files:**
- Create: `src/components/domain/landing/landing-case-real.tsx`
- Test: `src/components/domain/landing/landing-case-real.test.tsx`

**Interfaces:**
- Consumes: `LandingTestimonial` (`authorName`, `authorRole`, `quote`).
- Produces: `<LandingCaseReal testimonial={... | null} />` — retorna `null` se `testimonial` for `null`. **Sem** stat-tiles fabricados.

- [ ] **Step 1: Escrever o teste de degradação**

```tsx
// src/components/domain/landing/landing-case-real.test.tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { LandingCaseReal } from './landing-case-real'

describe('LandingCaseReal', () => {
  it('não renderiza sem depoimento', () => {
    const { container } = render(<LandingCaseReal testimonial={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renderiza a citação em destaque', () => {
    const { getByText } = render(
      <LandingCaseReal
        testimonial={{ authorName: 'Rafael', authorRole: 'Navalha · Curitiba', quote: 'Mudou meu mês.' }}
      />,
    )
    expect(getByText(/Mudou meu mês/)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/components/domain/landing/landing-case-real.test.tsx`
Expected: FAIL ("Failed to resolve import './landing-case-real'").

- [ ] **Step 3: Implementar**

```tsx
// src/components/domain/landing/landing-case-real.tsx
import type { LandingTestimonial } from '@prisma/client'
import { Reveal } from './landing-reveal'

type FeaturedTestimonial = Pick<LandingTestimonial, 'authorName' | 'authorRole' | 'quote'>

export function LandingCaseReal({ testimonial }: { testimonial: FeaturedTestimonial | null }) {
  if (!testimonial) return null

  return (
    <section className="bg-white px-4 py-16 sm:px-6 sm:py-20">
      <Reveal className="mx-auto max-w-3xl">
        <div className="rounded-3xl bg-gradient-to-br from-[#4C1D95] to-[#7C3AED] p-8 text-white shadow-2xl shadow-violet-300/40 sm:p-11">
          <p className="text-xs font-extrabold uppercase tracking-wide text-violet-200">
            Quem já vive no automático
          </p>
          <blockquote className="font-display mt-4 text-[clamp(1.25rem,3.5vw,1.6rem)] font-bold leading-snug">
            “{testimonial.quote}”
          </blockquote>
          <div className="mt-6 border-t border-white/20 pt-5">
            <div className="text-base font-extrabold">{testimonial.authorName}</div>
            <div className="text-sm text-violet-200">{testimonial.authorRole}</div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/components/domain/landing/landing-case-real.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/domain/landing/landing-case-real.tsx src/components/domain/landing/landing-case-real.test.tsx
git commit -m "feat(landing): caso real como depoimento em destaque (degrada sem dados)"
```

---

### Task 14: Garantia 14 dias

**Files:**
- Create: `src/components/domain/landing/landing-guarantee.tsx`

**Interfaces:**
- Produces: `<LandingGuarantee trialDays={number | null} />`.

- [ ] **Step 1: Implementar**

```tsx
// src/components/domain/landing/landing-guarantee.tsx
import { Reveal } from './landing-reveal'

export function LandingGuarantee({ trialDays }: { trialDays: number | null }) {
  const dias = trialDays ?? 14

  return (
    <section className="bg-[#F5F3FF] px-4 py-16 sm:px-6 sm:py-20">
      <Reveal className="mx-auto max-w-2xl text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-violet-200 bg-white text-3xl">
          🛡️
        </div>
        <h2 className="font-display mt-5 text-[clamp(1.4rem,4vw,2rem)] font-extrabold text-slate-900">
          Teste sem risco nenhum por {dias} dias
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-500 sm:text-lg">
          Comece agora sem cartão de crédito. Use tudo, coloque suas clientes pra agendar de
          verdade. Se não sentir a agenda mais cheia e o WhatsApp mais leve, é só não continuar —
          sem multa, sem letra miúda.
        </p>
      </Reveal>
    </section>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/landing/landing-guarantee.tsx
git commit -m "feat(landing): seção de garantia de 14 dias"
```

---

### Task 15: FAQ como seção própria

**Files:**
- Create: `src/components/domain/landing/landing-faq.tsx`
- Modify: `src/components/domain/landing/landing-plans.tsx` (remover o bloco FAQ)

**Interfaces:**
- Produces: `<LandingFAQ trialDays={number | null} />`.

- [ ] **Step 1: Criar a FAQ**

```tsx
// src/components/domain/landing/landing-faq.tsx
import { Reveal } from './landing-reveal'

export function LandingFAQ({ trialDays }: { trialDays: number | null }) {
  const trialLabel = trialDays ? `${trialDays} dias grátis` : 'trial grátis'

  const faq: [string, string][] = [
    ['É difícil de configurar? Não entendo de tecnologia.', 'Se você usa WhatsApp e Instagram, você configura o Agendê. Leva cerca de 10 minutos e a gente te acompanha no primeiro acesso.'],
    ['Minha cliente vai saber usar?', 'Ela não instala nada. Clica no seu link, escolhe o horário e confirma — como pedir comida por app. Em média, leva 30 segundos.'],
    ['Já uso outra agenda / caderninho. Perco meus dados?', 'Não. A migração dos seus clientes e horários é gratuita e a gente faz junto com você, sem parar o atendimento.'],
    ['Preciso cadastrar cartão pra testar?', `Não. O ${trialLabel} é realmente grátis. Só escolhe um plano se decidir continuar.`],
    ['E a segurança dos meus dados e dos meus clientes?', 'Seus dados são criptografados e tratados conforme a LGPD. Você é dono das suas informações e pode exportar ou apagar quando quiser.'],
  ]

  return (
    <section id="faq" className="bg-[#FAFAFA] px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-2xl">
        <Reveal>
          <h2 className="font-display mb-8 text-center text-[clamp(1.5rem,4vw,2.1rem)] font-extrabold text-slate-900">
            Ainda em dúvida? A gente resolve.
          </h2>
        </Reveal>
        <div className="space-y-3">
          {faq.map(([q, a]) => (
            <details key={q} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
              <summary className="cursor-pointer font-display font-bold text-slate-900">{q}</summary>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Remover o bloco FAQ de `landing-plans.tsx`**

No arquivo `landing-plans.tsx`, remover o array `faq` e todo o bloco `{/* FAQ */}` (a `<div className="mx-auto mt-14 max-w-2xl ...">` até o fechamento). Manter o restante (título, `PricingToggle`, link "Ver comparação completa").

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/domain/landing/landing-faq.tsx src/components/domain/landing/landing-plans.tsx
git commit -m "feat(landing): FAQ como seção própria, removida de Planos"
```

---

### Task 16: Toggle Mensal/Anual condicional nos planos

**Files:**
- Modify: `src/components/domain/billing/pricing-toggle.tsx`
- Modify: `src/components/domain/landing/landing-plans.tsx`

**Interfaces:**
- Consumes: `PlanData` (já existente). Nova prop opcional `showAnnualToggle?: boolean` (default `false`).
- Produces: `<PricingToggle plans={...} showAnnualToggle={false} />`. Quando `false`, comportamento idêntico ao de hoje (grid de cards, preço mensal). Quando `true`, exibe o toggle Mensal/Anual acima do grid. **Como não há preço anual real ainda, `landing-plans.tsx` sempre passa `false`.**

- [ ] **Step 1: Adicionar o toggle opcional ao `pricing-toggle.tsx`**

```tsx
// src/components/domain/billing/pricing-toggle.tsx
'use client'

import { useState } from 'react'
import { SharedPlanCard } from './plan-card-shared'

export type PlanData = {
  name: string
  displayName: string
  price: number
  features: string[]
  highlights?: string[]
  trialDays: number
  isPopular?: boolean
}

interface PricingToggleProps {
  plans: PlanData[]
  /** Só exibe o seletor Mensal/Anual quando houver preço anual real no catálogo. */
  showAnnualToggle?: boolean
}

export function PricingToggle({ plans, showAnnualToggle = false }: PricingToggleProps) {
  const [annual, setAnnual] = useState(false)

  return (
    <div>
      {showAnnualToggle && (
        <div className="mb-8 flex justify-center">
          <div className="inline-flex gap-1 rounded-full border border-violet-200 bg-violet-50 p-1">
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={`rounded-full px-5 py-2 text-sm font-extrabold transition-colors ${
                annual ? 'text-violet-700' : 'bg-violet-600 text-white'
              }`}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={`rounded-full px-5 py-2 text-sm font-extrabold transition-colors ${
                annual ? 'bg-violet-600 text-white' : 'text-violet-700'
              }`}
            >
              Anual
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => (
          <SharedPlanCard
            key={plan.name}
            plan={plan}
            action={{ type: 'navigate', href: `/login?plan=${plan.name}` }}
          />
        ))}
      </div>
    </div>
  )
}
```

Nota: o estado `annual` já fica pronto para, no spec de billing, alternar o preço exibido no `SharedPlanCard`. Aqui ele não muda o preço (não há preço anual), por isso o toggle fica oculto por padrão.

- [ ] **Step 2: Passar `showAnnualToggle={false}` em `landing-plans.tsx`**

Na chamada de `<PricingToggle plans={plans} />`, trocar para `<PricingToggle plans={plans} showAnnualToggle={false} />`. Atualizar o subtítulo da seção para refletir a narrativa da referência ("Um plano que se paga com uma falta evitada" — opcional, manter o atual serve).

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/domain/billing/pricing-toggle.tsx src/components/domain/landing/landing-plans.tsx
git commit -m "feat(landing): toggle Mensal/Anual condicional (oculto sem preço anual)"
```

---

### Task 17: CTA final enriquecido + P.S.

**Files:**
- Modify: `src/components/domain/landing/landing-pricing-cta.tsx`

**Interfaces:**
- Produces: `<LandingPricingCTA starterPrice={number | null} trialDays={number | null} />` (mesmas props).

- [ ] **Step 1: Reescrever com P.S. e trust line**

```tsx
// src/components/domain/landing/landing-pricing-cta.tsx
import Link from 'next/link'

interface LandingPricingCTAProps {
  starterPrice: number | null
  trialDays: number | null
}

export function LandingPricingCTA({ starterPrice, trialDays }: LandingPricingCTAProps) {
  const formattedPrice = starterPrice
    ? starterPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })
    : null
  const trialLabel = trialDays ? `${trialDays} dias grátis` : 'Trial grátis'

  return (
    <section className="bg-gradient-to-br from-[#4C1D95] via-[#7C3AED] to-[#DB2777] px-4 py-16 text-center text-white sm:px-6 sm:py-24">
      <h2 className="font-display mx-auto max-w-2xl text-[clamp(1.8rem,5vw,2.75rem)] font-extrabold leading-tight">
        Sua próxima sexta pode ser diferente.
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-base text-white/85 sm:text-lg">
        Deixe o Agendê confirmar, lembrar e cobrar por você. Comece hoje, {trialLabel.toLowerCase()}
        {formattedPrice ? ` — planos a partir de ${formattedPrice}/mês.` : '.'}
      </p>
      <Link
        href="/login?tab=signup"
        className="mt-8 inline-block w-full max-w-xs rounded-xl bg-white px-8 py-4 text-base font-extrabold text-violet-700 shadow-xl transition-transform hover:scale-105 sm:w-auto"
      >
        Começar meus {trialDays ?? 14} dias grátis →
      </Link>
      <p className="mt-4 text-xs text-white/80">✓ Sem cartão · ✓ Configura em 10 min · ✓ Cancela quando quiser</p>
      <p className="mx-auto mt-8 max-w-xl border-t border-white/20 pt-6 text-sm text-white/90">
        <strong className="text-white">P.S.:</strong> cada falta de sexta à noite é dinheiro que
        não volta. O Agendê custa menos que uma única falta evitada por mês — e evita dezenas.
      </p>
    </section>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/landing/landing-pricing-cta.tsx
git commit -m "feat(landing): CTA final enriquecido com P.S. e trust line"
```

---

### Task 18: Footer em 4 colunas

**Files:**
- Modify: `src/components/domain/landing/landing-footer.tsx`

**Interfaces:**
- Produces: `<LandingFooter whatsappNumber={string?} />` (mesma prop).

- [ ] **Step 1: Reescrever o footer**

```tsx
// src/components/domain/landing/landing-footer.tsx
import Image from 'next/image'
import Link from 'next/link'

interface LandingFooterProps {
  whatsappNumber?: string
}

export function LandingFooter({ whatsappNumber }: LandingFooterProps) {
  const year = new Date().getFullYear()
  const waHref = whatsappNumber ? `https://wa.me/${whatsappNumber.replace(/\D/g, '')}` : null

  return (
    <footer className="bg-slate-900 px-4 py-12 text-sm text-slate-400 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Image src="/brand/logo-mark.png" alt="" width={512} height={512} className="h-8 w-8" />
              <span className="font-display text-lg font-extrabold text-white">Agendê</span>
            </div>
            <p className="max-w-xs leading-relaxed">
              O piloto automático de salões, barbearias e clínicas. Menos telefone tocando, mais
              cadeira ocupada.
            </p>
          </div>

          <div>
            <div className="mb-3 font-extrabold text-white">Produto</div>
            <ul className="flex flex-col gap-2">
              <li><Link href="#funcionalidades" className="transition-colors hover:text-white">Funcionalidades</Link></li>
              <li><Link href="#como-funciona" className="transition-colors hover:text-white">Como funciona</Link></li>
              <li><Link href="#planos" className="transition-colors hover:text-white">Planos e preços</Link></li>
              <li><Link href="#demo" className="transition-colors hover:text-white">Demonstração</Link></li>
            </ul>
          </div>

          <div>
            <div className="mb-3 font-extrabold text-white">Empresa</div>
            <ul className="flex flex-col gap-2">
              <li><Link href="#depoimentos" className="transition-colors hover:text-white">Depoimentos</Link></li>
              {waHref && (
                <li>
                  <a href={waHref} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white">
                    Falar no WhatsApp
                  </a>
                </li>
              )}
            </ul>
          </div>

          <div>
            <div className="mb-3 font-extrabold text-white">Legal</div>
            <ul className="flex flex-col gap-2">
              <li><Link href="/termos" className="transition-colors hover:text-white">Termos de Uso</Link></li>
              <li><Link href="/privacidade" className="transition-colors hover:text-white">Privacidade (LGPD)</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col justify-between gap-2 border-t border-white/10 pt-6 sm:flex-row">
          <span>© {year} Agendê · Todos os direitos reservados.</span>
          <span>Feito no Brasil 🇧🇷 para quem vive de atender bem.</span>
        </div>
      </div>
    </footer>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/landing/landing-footer.tsx
git commit -m "feat(landing): footer em 4 colunas"
```

---

### Task 19: Polir "Como funciona" com reveal

**Files:**
- Modify: `src/components/domain/landing/landing-how-it-works.tsx`

**Interfaces:**
- Produces: `<LandingHowItWorks />`. Ajustar a âncora e envolver os passos em `<Reveal>`.

- [ ] **Step 1: Envolver o cabeçalho e cada passo em `<Reveal>`**

No arquivo atual, importar `import { Reveal } from './landing-reveal'` e:
- envolver o bloco do cabeçalho (`<div className="mb-8 ...text-center">`) em `<Reveal>`;
- envolver cada `<div key={step.number} ...>` em `<Reveal delay={index * 100}>` (usar o índice do `map`).

Manter o resto (âncora `id="como-funciona"`, cores, copy) inalterado.

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/landing/landing-how-it-works.tsx
git commit -m "feat(landing): reveal na seção como funciona"
```

---

### Task 20: Montar a nova ordem em `page.tsx` + ajustar teste

**Files:**
- Modify: `src/app/(public)/page.tsx`
- Modify: `src/app/(public)/landing.test.ts` (se necessário)

**Interfaces:**
- Consumes: todos os componentes das Tasks 4-19.
- Produces: página pública final com a ordem do spec.

- [ ] **Step 1: Reescrever a composição da página**

```tsx
// src/app/(public)/page.tsx
import { prisma } from '@/shared/database/prisma'
import { getPublicPlans } from '@/domains/billing/plan-catalog.service'
import { LandingNav } from '@/components/domain/landing/landing-nav'
import { LandingHero } from '@/components/domain/landing/landing-hero'
import { LandingProofBar } from '@/components/domain/landing/landing-proof-bar'
import { LandingMarquee } from '@/components/domain/landing/landing-marquee'
import { LandingPain } from '@/components/domain/landing/landing-pain'
import { LandingMechanism } from '@/components/domain/landing/landing-mechanism'
import { LandingFeatures } from '@/components/domain/landing/landing-features'
import { LandingDemoMobile } from '@/components/domain/landing/landing-demo-mobile'
import { LandingWhatsApp } from '@/components/domain/landing/landing-whatsapp'
import { LandingHowItWorks } from '@/components/domain/landing/landing-how-it-works'
import { LandingCaseReal } from '@/components/domain/landing/landing-case-real'
import { LandingTestimonials } from '@/components/domain/landing/landing-testimonials'
import { LandingBranding } from '@/components/domain/landing/landing-branding'
import { LandingPlans } from '@/components/domain/landing/landing-plans'
import { LandingGuarantee } from '@/components/domain/landing/landing-guarantee'
import { LandingFAQ } from '@/components/domain/landing/landing-faq'
import { LandingPricingCTA } from '@/components/domain/landing/landing-pricing-cta'
import { LandingFooter } from '@/components/domain/landing/landing-footer'
import { WhatsAppFloatButton } from '@/components/domain/landing/whatsapp-float-button'

export const revalidate = 3600

export const metadata = {
  title: 'Agendê — Seu salão no piloto automático',
  description:
    'Agenda online, WhatsApp automático e controle financeiro para salões de beleza. Comece com trial grátis, sem cartão de crédito.',
}

export async function getLandingData() {
  const [plans, metrics, testimonials] = await Promise.all([
    getPublicPlans(),
    prisma.landingMetric.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } }),
    prisma.landingTestimonial.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } }),
  ])
  const starterPlan = plans.find((p) => p.name === 'STARTER') ?? null
  return { plans, starterPlan, metrics, testimonials }
}

export default async function LandingPage() {
  const { plans, starterPlan, metrics, testimonials } = await getLandingData()

  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER ?? ''
  const trialDays = starterPlan?.trialDays ?? null
  const starterPrice = starterPlan?.price ?? null

  const plansForCards = plans.map((p) => ({
    name: p.name,
    displayName: p.displayName,
    price: p.price,
    features: p.benefits,
    highlights: p.highlights,
    trialDays: p.trialDays,
    isPopular: p.isPopular,
  }))

  const salons = testimonials.map((t) => ({ id: t.id, authorName: t.authorName, authorRole: t.authorRole }))
  const featured = testimonials[0] ?? null

  return (
    <>
      <LandingNav />
      <main>
        <LandingHero trialDays={trialDays} />
        <LandingProofBar metrics={metrics} />
        <LandingMarquee salons={salons} />
        <LandingPain />
        <LandingMechanism />
        <LandingFeatures />
        <LandingDemoMobile />
        <LandingWhatsApp />
        <LandingHowItWorks />
        <LandingCaseReal testimonial={featured} />
        <LandingTestimonials testimonials={testimonials} />
        <LandingBranding />
        <LandingPlans plans={plansForCards} trialDays={trialDays} />
        <LandingGuarantee trialDays={trialDays} />
        <LandingFAQ trialDays={trialDays} />
        <LandingPricingCTA starterPrice={starterPrice} trialDays={trialDays} />
      </main>
      <LandingFooter whatsappNumber={whatsappNumber} />
      {whatsappNumber && <WhatsAppFloatButton phoneNumber={whatsappNumber} />}
    </>
  )
}
```

- [ ] **Step 2: Rodar o teste de `getLandingData` (não mudou de forma)**

Run: `npx vitest run src/app/(public)/landing.test.ts`
Expected: PASS (a assinatura de `getLandingData` é idêntica). Se falhar por algum campo, ajustar o teste conforme o retorno.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(public)/page.tsx" "src/app/(public)/landing.test.ts"
git commit -m "feat(landing): compõe a nova ordem de seções na página pública"
```

---

### Task 21: Gate final — tsc, testes e checklist mobile

**Files:** nenhum (verificação).

- [ ] **Step 1: Type-check completo**

Run: `npx tsc --noEmit`
Expected: PASS (zero erros).

- [ ] **Step 2: Suíte de testes completa**

Run: `npx vitest run`
Expected: PASS (todos verdes, incluindo `use-count-up`, `landing-marquee`, `landing-case-real`, `landing-branding`, `landing.test.ts`).

- [ ] **Step 3: Revisão manual mobile-first (checklist `agent-mobile`)**

Conferir em viewport de ~375px: nav com hambúrguer funcional; hero empilhado; barra de prova 2×2; marquee sem overflow horizontal na página; todos os grids 1 col; demo/WhatsApp/personalização empilhados; alvos de toque ≥ 44px; nenhuma seção estoura a largura. Ajustar classes se necessário e recomitar.

- [ ] **Step 4: Abrir o PR**

```bash
git push -u origin feat/landing-restructure
gh pr create --base main --title "feat(landing): reestruturação completa da landing page" --body "Reestrutura a landing pública seguindo a narrativa da referência (Claude Design), mobile-first, com dados reais do banco (métricas/depoimentos), toggle de preço condicional e billing anual decomposto em spec futuro.

Ver spec: docs/superpowers/specs/2026-07-16-landing-restructure-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Self-Review (checklist do autor)

**Cobertura do spec:**
- Nav hambúrguer → Task 6 ✓ · Hero 2 col + badge → Task 7 ✓ · Contadores → Tasks 2/4 ✓ · Marquee → Task 5 ✓ · Dor → Task 8 ✓ · Mecanismo → Task 9 ✓ · Features 6 cards → Task 10 ✓ · Demo mobile → Task 11 ✓ · WhatsApp escuro → Task 12 ✓ · Como funciona → Task 19 ✓ · Caso real → Task 13 ✓ · Depoimentos → mantido (sem task; já existe) ✓ · Personalização → mantido (já existe) ✓ · Planos + toggle condicional → Task 16 ✓ · Garantia → Task 14 ✓ · FAQ própria → Task 15 ✓ · CTA final → Task 17 ✓ · Footer 4 col → Task 18 ✓ · Scroll-reveal → Task 3 + uso nas seções ✓ · Degradação (marquee/caso real) → Tasks 5/13 com teste ✓ · Composição → Task 20 ✓ · Gate → Task 21 ✓.
- Depoimentos e Personalização (branding) permanecem como estão — nenhuma mudança pedida além da ordem, já coberta na Task 20.

**Placeholders:** o único ponto "colar aqui" é o mockup do hero (Task 7 Step 1), com referência exata às linhas 62-121 do arquivo original — conteúdo real existente, não um placeholder de lógica.

**Consistência de tipos:** `useCountUp(value, active)` (Task 2) usado na Task 4; `Reveal` (Task 3) usado nas Tasks 8-19; `LandingMarquee salons=` e `LandingCaseReal testimonial=` (Tasks 5/13) casam com o `page.tsx` da Task 20; `PricingToggle showAnnualToggle` (Task 16) casa com a chamada em `landing-plans.tsx`.

## Ordem de execução recomendada
Tasks 1-3 (fundações) primeiro; depois 4-19 (podem ser paralelizadas por serem arquivos independentes, mas 10 deve preceder 11/12 pelo reuso de mockups); 20 depende de todas; 21 fecha.
