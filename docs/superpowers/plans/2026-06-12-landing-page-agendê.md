# Landing Page Agendê — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a landing page pública em `/` do Agendê — plataforma para salões de beleza — com 9 seções, dados 100% do banco e visual gradiente roxo-rosa.

**Architecture:** Server Component em `src/app/(public)/page.tsx` fazendo 3 queries paralelas ao Prisma (plano, métricas, depoimentos). Cada seção é um componente isolado em `src/components/domain/landing/`. Sem estado global, sem client-side fetching — página estática com dados dinâmicos via RSC.

**Tech Stack:** Next.js 15 App Router · TypeScript strict · Prisma (PostgreSQL) · TailwindCSS · Shadcn UI · Lucide Icons

---

## Mapa de Arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `prisma/schema.prisma` | Modificar | Adicionar `LandingMetric` e `LandingTestimonial` |
| `prisma/migrations/...` | Criar (auto) | Migration gerada pelo Prisma |
| `src/app/(public)/page.tsx` | Criar | Server Component — queries + composição das seções |
| `src/app/globals.css` | Modificar | Adicionar `scroll-behavior: smooth` |
| `src/components/domain/landing/landing-nav.tsx` | Criar | Navbar sticky com logo, links, botões auth |
| `src/components/domain/landing/landing-hero.tsx` | Criar | Hero com headline, CTAs e screenshot mockup |
| `src/components/domain/landing/landing-proof-bar.tsx` | Criar | Faixa de métricas (condicional) |
| `src/components/domain/landing/landing-features.tsx` | Criar | 5 blocos alternados de ganhos |
| `src/components/domain/landing/landing-how-it-works.tsx` | Criar | 3 passos |
| `src/components/domain/landing/landing-testimonials.tsx` | Criar | Grid de depoimentos (condicional) |
| `src/components/domain/landing/landing-pricing-cta.tsx` | Criar | Banner CTA para /planos |
| `src/components/domain/landing/landing-footer.tsx` | Criar | Footer com links |
| `src/components/domain/landing/whatsapp-float-button.tsx` | Criar | Botão flutuante WhatsApp |
| `src/app/(public)/landing.test.ts` | Criar | Testes da lógica de dados da page |

---

## Task 1: Branch git

- [ ] **Criar branch de feature**

```bash
git checkout -b feat/landing-page-agendê
```

---

## Task 2: Modelos Prisma + Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Adicionar os dois modelos ao final do schema**

Abra `prisma/schema.prisma` e adicione antes do último `}` (ou ao final do arquivo, após o último model existente):

```prisma
model LandingMetric {
  id        String   @id @default(cuid())
  value     String
  label     String
  order     Int      @default(0)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model LandingTestimonial {
  id         String   @id @default(cuid())
  authorName String
  authorRole String
  quote      String
  rating     Int      @default(5)
  avatarUrl  String?
  order      Int      @default(0)
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

- [ ] **Gerar e aplicar a migration**

```bash
npx prisma migrate dev --name add_landing_models
```

Saída esperada:
```
✔ Generated Prisma Client
The following migration(s) have been applied:
  migrations/20260612_add_landing_models/migration.sql
```

- [ ] **Verificar que o Prisma Client foi regenerado**

```bash
npx prisma generate
```

- [ ] **Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(landing): adiciona models LandingMetric e LandingTestimonial"
```

---

## Task 3: LandingNav

**Files:**
- Create: `src/components/domain/landing/landing-nav.tsx`

- [ ] **Criar o componente**

```tsx
// src/components/domain/landing/landing-nav.tsx
import Link from 'next/link'

export function LandingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/95 backdrop-blur-sm shadow-sm">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-xl font-extrabold bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent">
          Agendê
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <Link href="#funcionalidades" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
            Funcionalidades
          </Link>
          <Link href="#depoimentos" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
            Depoimentos
          </Link>
          <Link href="/planos" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
            Planos
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900 transition-colors"
          >
            Entrar
          </Link>
          <Link
            href="/onboarding"
            className="rounded-lg bg-gradient-to-r from-violet-600 to-pink-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-violet-200 hover:opacity-90 transition-opacity"
          >
            Criar conta grátis →
          </Link>
        </div>
      </nav>
    </header>
  )
}
```

- [ ] **Commit**

```bash
git add src/components/domain/landing/landing-nav.tsx
git commit -m "feat(landing): adiciona LandingNav com links e botões de auth"
```

---

## Task 4: LandingHero

**Files:**
- Create: `src/components/domain/landing/landing-hero.tsx`

- [ ] **Criar o componente**

```tsx
// src/components/domain/landing/landing-hero.tsx
import Link from 'next/link'

export function LandingHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-violet-50 to-pink-50 px-6 pb-16 pt-20 text-center">
      {/* Glow decorativo */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-violet-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 bottom-0 h-64 w-64 rounded-full bg-pink-200/30 blur-3xl" />

      {/* Badge */}
      <div className="mb-6 inline-block rounded-full border border-violet-200 bg-gradient-to-r from-violet-50 to-pink-50 px-4 py-1.5 text-xs font-semibold text-violet-700">
        ✨ Plataforma #1 para salões de beleza
      </div>

      {/* Headline */}
      <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight text-slate-900 md:text-5xl">
        Seu salão no{' '}
        <span className="bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent">
          piloto automático.
        </span>
        <br />
        Você foca nas clientes.
      </h1>

      {/* Subtítulo */}
      <p className="mx-auto mt-5 max-w-xl text-lg text-slate-500">
        Agenda online, WhatsApp automático e controle financeiro — tudo em um só lugar.
        Sem planilha. Sem telefone tocando.
      </p>

      {/* CTAs */}
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/planos"
          className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 px-8 py-4 text-base font-bold text-white shadow-lg shadow-violet-200 transition-opacity hover:opacity-90 sm:w-auto"
        >
          Ver Planos e Preços →
        </Link>
        <Link
          href="#como-funciona"
          className="flex items-center gap-2 text-sm font-semibold text-violet-600 hover:text-violet-800 transition-colors"
        >
          ▶ Ver como funciona
        </Link>
      </div>

      {/* Screenshot mockup — overflow-x-auto para mobile */}
      <div className="relative mx-auto mt-14 max-w-4xl overflow-x-auto">
        <div className="min-w-150 overflow-hidden rounded-2xl border border-slate-200 shadow-2xl shadow-slate-900/20">
          {/* Barra do browser */}
          <div className="flex items-center gap-2 bg-slate-800 px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-red-400" />
            <span className="h-3 w-3 rounded-full bg-yellow-400" />
            <span className="h-3 w-3 rounded-full bg-green-400" />
            <span className="ml-3 rounded bg-slate-700 px-3 py-0.5 text-xs text-slate-400">
              agend.com.br/dashboard
            </span>
          </div>

          {/* Conteúdo do dashboard mockup */}
          <div className="grid grid-cols-[180px_1fr] bg-slate-900">
            {/* Sidebar */}
            <div className="flex flex-col gap-2 p-4">
              <span className="mb-2 bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-sm font-extrabold text-transparent">
                Agendê
              </span>
              {['📅 Agenda', '👥 Clientes', '💬 WhatsApp', '💰 Financeiro', '📊 Relatórios'].map((item, i) => (
                <div
                  key={item}
                  className={`rounded-lg px-3 py-2 text-xs ${i === 0 ? 'bg-gradient-to-r from-violet-600 to-pink-600 text-white font-semibold' : 'text-slate-400'}`}
                >
                  {item}
                </div>
              ))}
            </div>

            {/* Main */}
            <div className="flex flex-col gap-3 bg-slate-50 p-4">
              {/* Métricas */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'agendamentos hoje', value: '47' },
                  { label: 'faturado hoje', value: 'R$2.840' },
                  { label: 'faltas evitadas', value: '3' },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl border border-violet-100 bg-white p-3 text-center">
                    <div className="text-lg font-extrabold text-violet-600">{value}</div>
                    <div className="text-xs text-slate-500">{label}</div>
                  </div>
                ))}
              </div>

              {/* Cards de agendamento */}
              {[
                { nome: 'Ana Silva — 14h00', servico: 'Escova + Hidratação · Mariana', color: 'from-violet-500 to-pink-500' },
                { nome: 'Juliana Costa — 15h30', servico: 'Coloração completa · Paula', color: 'from-pink-500 to-orange-400' },
                { nome: 'Camila Rocha — 17h00', servico: 'Corte + Finalização · Carla', color: 'from-sky-500 to-violet-500' },
              ].map(({ nome, servico, color }) => (
                <div key={nome} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3">
                  <div className={`h-8 w-8 flex-shrink-0 rounded-lg bg-gradient-to-br ${color}`} />
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{nome}</div>
                    <div className="text-xs text-slate-500">{servico}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Commit**

```bash
git add src/components/domain/landing/landing-hero.tsx
git commit -m "feat(landing): adiciona LandingHero com screenshot mockup do dashboard"
```

---

## Task 5: LandingProofBar

**Files:**
- Create: `src/components/domain/landing/landing-proof-bar.tsx`

- [ ] **Criar o componente**

```tsx
// src/components/domain/landing/landing-proof-bar.tsx
import type { LandingMetric } from '@prisma/client'

interface LandingProofBarProps {
  metrics: Pick<LandingMetric, 'id' | 'value' | 'label'>[]
}

export function LandingProofBar({ metrics }: LandingProofBarProps) {
  if (metrics.length === 0) return null

  return (
    <section className="border-y border-violet-100 bg-white px-6 py-8">
      <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 md:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.id} className="text-center">
            <div className="bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-3xl font-extrabold text-transparent">
              {metric.value}
            </div>
            <div className="mt-1 text-xs text-slate-500">{metric.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Commit**

```bash
git add src/components/domain/landing/landing-proof-bar.tsx
git commit -m "feat(landing): adiciona LandingProofBar condicional com métricas do banco"
```

---

## Task 6: LandingFeatures

**Files:**
- Create: `src/components/domain/landing/landing-features.tsx`

- [ ] **Criar o componente**

```tsx
// src/components/domain/landing/landing-features.tsx

const FEATURES = [
  {
    icon: '📅',
    title: 'Agenda online 24 horas',
    description:
      'Sua cliente agenda pelo celular, a qualquer hora — sem precisar ligar. Você acorda com a agenda cheia. O Agendê organiza por profissional, horário e serviço automaticamente.',
    metric: '📈 +30% de agendamentos no primeiro mês',
    screenshot: 'Página pública de agendamento',
  },
  {
    icon: '💬',
    title: 'WhatsApp automático',
    description:
      'Confirmação, lembrete 24h antes e follow-up pós-atendimento — tudo enviado automaticamente. Sem digitar uma mensagem, sem esquecer uma cliente.',
    metric: '📉 -40% de faltas e no-shows',
    screenshot: 'Fluxo de mensagens automáticas',
  },
  {
    icon: '💰',
    title: 'Controle financeiro em tempo real',
    description:
      'Faturamento do dia, comissões por profissional e relatório mensal — tudo no painel. Sabe exatamente quanto entrou, quanto pagou e qual serviço dá mais lucro.',
    metric: '💡 Decisões baseadas em dados, não em chute',
    screenshot: 'Dashboard financeiro com gráficos',
  },
  {
    icon: '❤️',
    title: 'Fidelização automática',
    description:
      'Histórico completo de cada cliente, mensagem de aniversário e alerta quando ela sumiu há mais de 30 dias. Sua cliente se sente especial — e volta mais vezes.',
    metric: '🔁 Clientes retornam 2x mais rápido',
    screenshot: 'Perfil de cliente com histórico e tags',
  },
  {
    icon: '🚫',
    title: 'Zero faltas com lembretes inteligentes',
    description:
      'Lembrete automático 24h antes com confirmação por link. Se ela não confirmar, você recebe um alerta para ligar. Chega de horário vazio.',
    metric: '✅ Até 40% menos faltas garantidas',
    screenshot: 'Painel de confirmações com status',
  },
] as const

export function LandingFeatures() {
  return (
    <section id="funcionalidades" className="bg-white px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-extrabold text-slate-900 md:text-4xl">
            Tudo que seu salão precisa, num só lugar
          </h2>
          <p className="mt-3 text-lg text-slate-500">
            Cada funcionalidade foi pensada para a realidade de quem trabalha com beleza
          </p>
        </div>

        <div className="flex flex-col gap-20">
          {FEATURES.map((feature, index) => {
            const isReverse = index % 2 !== 0
            return (
              <div
                key={feature.title}
                className={`flex flex-col items-center gap-12 md:flex-row ${isReverse ? 'md:flex-row-reverse' : ''}`}
              >
                {/* Texto */}
                <div className="flex-1">
                  <div className="mb-3 text-4xl">{feature.icon}</div>
                  <h3 className="mb-3 text-2xl font-bold text-slate-900">{feature.title}</h3>
                  <p className="mb-5 leading-relaxed text-slate-500">{feature.description}</p>
                  <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-gradient-to-r from-violet-50 to-pink-50 px-4 py-2 text-sm font-semibold text-violet-700">
                    {feature.metric}
                  </div>
                </div>

                {/* Screenshot placeholder — substituir por <Image> quando disponível */}
                <div className="flex h-52 w-full flex-1 items-center justify-center rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-pink-50 text-sm font-semibold text-violet-400 md:h-64">
                  {feature.screenshot}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Commit**

```bash
git add src/components/domain/landing/landing-features.tsx
git commit -m "feat(landing): adiciona LandingFeatures com 5 blocos alternados"
```

---

## Task 7: LandingHowItWorks

**Files:**
- Create: `src/components/domain/landing/landing-how-it-works.tsx`

- [ ] **Criar o componente**

```tsx
// src/components/domain/landing/landing-how-it-works.tsx

const STEPS = [
  {
    number: 1,
    title: 'Cria sua conta',
    description: 'Cadastro em 2 minutos. Adiciona seus profissionais e serviços.',
  },
  {
    number: 2,
    title: 'Compartilha o link',
    description: 'Coloca no Instagram, no WhatsApp e na bio. Suas clientes já podem agendar.',
  },
  {
    number: 3,
    title: 'O Agendê trabalha por você',
    description: 'Lembretes, confirmações e relatórios automáticos. Você foca no atendimento.',
  },
] as const

export function LandingHowItWorks() {
  return (
    <section id="como-funciona" className="bg-gradient-to-br from-violet-50 to-pink-50 px-6 py-20">
      <div className="mx-auto max-w-4xl">
        <div className="mb-14 text-center">
          <h2 className="text-3xl font-extrabold text-slate-900 md:text-4xl">Pronto em 3 passos</h2>
          <p className="mt-3 text-lg text-slate-500">Sem instalação. Sem técnico. Começa hoje.</p>
        </div>

        <div className="grid gap-10 md:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.number} className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-pink-600 text-lg font-extrabold text-white shadow-lg shadow-violet-200">
                {step.number}
              </div>
              <h3 className="mb-2 text-lg font-bold text-slate-900">{step.title}</h3>
              <p className="text-sm leading-relaxed text-slate-500">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Commit**

```bash
git add src/components/domain/landing/landing-how-it-works.tsx
git commit -m "feat(landing): adiciona LandingHowItWorks com 3 passos"
```

---

## Task 8: LandingTestimonials

**Files:**
- Create: `src/components/domain/landing/landing-testimonials.tsx`

- [ ] **Criar o componente**

```tsx
// src/components/domain/landing/landing-testimonials.tsx
import Image from 'next/image'
import type { LandingTestimonial } from '@prisma/client'

interface LandingTestimonialsProps {
  testimonials: Pick<LandingTestimonial, 'id' | 'authorName' | 'authorRole' | 'quote' | 'rating' | 'avatarUrl'>[]
}

export function LandingTestimonials({ testimonials }: LandingTestimonialsProps) {
  if (testimonials.length === 0) return null

  return (
    <section id="depoimentos" className="bg-white px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mb-14 text-center">
          <h2 className="text-3xl font-extrabold text-slate-900 md:text-4xl">
            Quem já usa, não volta atrás
          </h2>
          <p className="mt-3 text-lg text-slate-500">Resultados reais de donas de salão como você</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <div key={t.id} className="rounded-2xl border border-violet-100 bg-violet-50/50 p-6">
              {/* Estrelas */}
              <div className="mb-3 flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className={i < t.rating ? 'text-amber-400' : 'text-slate-200'}>
                    ★
                  </span>
                ))}
              </div>

              {/* Citação */}
              <p className="mb-5 italic leading-relaxed text-slate-600">"{t.quote}"</p>

              {/* Autor */}
              <div className="flex items-center gap-3">
                {t.avatarUrl ? (
                  <Image
                    src={t.avatarUrl}
                    alt={t.authorName}
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-pink-600 text-sm font-bold text-white">
                    {t.authorName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="text-sm font-bold text-slate-900">{t.authorName}</div>
                  <div className="text-xs text-slate-400">{t.authorRole}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Commit**

```bash
git add src/components/domain/landing/landing-testimonials.tsx
git commit -m "feat(landing): adiciona LandingTestimonials condicional com dados do banco"
```

---

## Task 9: LandingPricingCTA

**Files:**
- Create: `src/components/domain/landing/landing-pricing-cta.tsx`

- [ ] **Criar o componente**

```tsx
// src/components/domain/landing/landing-pricing-cta.tsx
import Link from 'next/link'
import type { Decimal } from '@prisma/client/runtime/library'

interface LandingPricingCTAProps {
  starterPrice: Decimal | null
}

export function LandingPricingCTA({ starterPrice }: LandingPricingCTAProps) {
  const formattedPrice = starterPrice
    ? Number(starterPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })
    : null

  return (
    <section className="bg-gradient-to-r from-violet-600 to-pink-600 px-6 py-20 text-center">
      <h2 className="text-3xl font-extrabold text-white md:text-4xl">
        Pronto para deixar o Agendê trabalhar por você?
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">
        {formattedPrice ? `Planos a partir de ${formattedPrice}/mês · ` : ''}
        14 dias grátis · Sem cartão de crédito
      </p>
      <Link
        href="/planos"
        className="mt-8 inline-block rounded-xl bg-white px-8 py-4 text-base font-bold text-violet-700 shadow-xl transition-transform hover:scale-105"
      >
        Escolher meu plano →
      </Link>
    </section>
  )
}
```

- [ ] **Commit**

```bash
git add src/components/domain/landing/landing-pricing-cta.tsx
git commit -m "feat(landing): adiciona LandingPricingCTA com preço dinâmico do banco"
```

---

## Task 10: LandingFooter

**Files:**
- Create: `src/components/domain/landing/landing-footer.tsx`

- [ ] **Criar o componente**

```tsx
// src/components/domain/landing/landing-footer.tsx
import Link from 'next/link'

export function LandingFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="bg-slate-900 px-6 py-10 text-center text-sm text-slate-400">
      <div className="mb-3 text-lg font-extrabold text-white">Agendê</div>
      <div className="mb-4 flex justify-center gap-6">
        <Link href="/termos" className="hover:text-white transition-colors">
          Termos de Uso
        </Link>
        <Link href="/privacidade" className="hover:text-white transition-colors">
          Política de Privacidade
        </Link>
      </div>
      <p>© {year} Agendê · Todos os direitos reservados</p>
    </footer>
  )
}
```

- [ ] **Commit**

```bash
git add src/components/domain/landing/landing-footer.tsx
git commit -m "feat(landing): adiciona LandingFooter"
```

---

## Task 11: WhatsAppFloatButton

**Files:**
- Create: `src/components/domain/landing/whatsapp-float-button.tsx`

- [ ] **Criar o componente**

```tsx
// src/components/domain/landing/whatsapp-float-button.tsx
'use client'

interface WhatsAppFloatButtonProps {
  phoneNumber: string
}

export function WhatsAppFloatButton({ phoneNumber }: WhatsAppFloatButtonProps) {
  const href = `https://wa.me/${phoneNumber}`

  return (
    <div className="fixed bottom-7 right-7 z-50 flex flex-col items-end gap-2">
      {/* Tooltip */}
      <div className="relative rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white shadow-lg">
        Fale conosco pelo WhatsApp
        <span className="absolute -bottom-1.5 right-4 h-3 w-3 rotate-45 bg-slate-800" />
      </div>

      {/* Botão */}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Fale conosco pelo WhatsApp"
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#25d366] shadow-lg shadow-green-400/40 transition-transform hover:scale-110 animate-pulse-slow"
      >
        {/* Ícone WhatsApp SVG */}
        <svg viewBox="0 0 32 32" className="h-7 w-7 fill-white">
          <path d="M16 0C7.163 0 0 7.163 0 16c0 2.822.736 5.47 2.027 7.773L0 32l8.49-2.009A15.938 15.938 0 0016 32c8.837 0 16-7.163 16-16S24.837 0 16 0zm8.086 22.343c-.338.95-1.96 1.82-2.72 1.937-.696.108-1.58.153-2.548-.16-.588-.19-1.343-.444-2.31-.87-4.065-1.754-6.716-5.85-6.916-6.12-.2-.27-1.63-2.165-1.63-4.13 0-1.964 1.03-2.927 1.396-3.325.366-.398.8-.497 1.067-.497.266 0 .533.003.767.014.246.012.576-.093.9.688.338.8 1.15 2.766 1.25 2.967.1.2.167.434.033.7-.133.266-.2.434-.4.667-.2.233-.42.52-.6.7-.2.2-.408.416-.175.816.233.4 1.035 1.708 2.222 2.766 1.526 1.36 2.81 1.78 3.21 1.98.4.2.633.167.867-.1.233-.267 1-1.167 1.267-1.567.266-.4.533-.333.9-.2.367.133 2.333 1.1 2.733 1.3.4.2.667.3.767.466.1.167.1.967-.238 1.968z" />
        </svg>

        {/* Badge decorativo */}
        <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
          1
        </span>
      </a>
    </div>
  )
}
```

- [ ] **Adicionar a animação pulse-slow no globals.css** (passo seguinte — não duplicar)

- [ ] **Commit**

```bash
git add src/components/domain/landing/whatsapp-float-button.tsx
git commit -m "feat(landing): adiciona WhatsAppFloatButton flutuante"
```

---

## Task 12: Page Assembly + globals.css

**Files:**
- Create: `src/app/(public)/page.tsx`
- Modify: `src/app/globals.css`

- [ ] **Adicionar scroll suave e animação ao globals.css**

Abra `src/app/globals.css` e adicione ao final:

```css
html {
  scroll-behavior: smooth;
}

@keyframes pulse-slow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(37, 211, 102, 0.5); }
  50% { box-shadow: 0 0 0 10px rgba(37, 211, 102, 0); }
}

.animate-pulse-slow {
  animation: pulse-slow 2.5s ease-in-out infinite;
}
```

- [ ] **Criar a page principal**

```tsx
// src/app/(public)/page.tsx
import { prisma } from '@/shared/database/prisma'
import { LandingNav } from '@/components/domain/landing/landing-nav'
import { LandingHero } from '@/components/domain/landing/landing-hero'
import { LandingProofBar } from '@/components/domain/landing/landing-proof-bar'
import { LandingFeatures } from '@/components/domain/landing/landing-features'
import { LandingHowItWorks } from '@/components/domain/landing/landing-how-it-works'
import { LandingTestimonials } from '@/components/domain/landing/landing-testimonials'
import { LandingPricingCTA } from '@/components/domain/landing/landing-pricing-cta'
import { LandingFooter } from '@/components/domain/landing/landing-footer'
import { WhatsAppFloatButton } from '@/components/domain/landing/whatsapp-float-button'

export const metadata = {
  title: 'Agendê — Seu salão no piloto automático',
  description:
    'Agenda online, WhatsApp automático e controle financeiro para salões de beleza. Comece grátis por 14 dias.',
}

export async function getLandingData() {
  const [starterPlan, metrics, testimonials] = await Promise.all([
    prisma.plan.findFirst({
      where: { name: 'STARTER', isActive: true },
      select: { price: true },
    }),
    prisma.landingMetric.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    }),
    prisma.landingTestimonial.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    }),
  ])

  return { starterPlan, metrics, testimonials }
}

export default async function LandingPage() {
  const { starterPlan, metrics, testimonials } = await getLandingData()

  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER ?? ''

  return (
    <>
      <LandingNav />
      <main>
        <LandingHero />
        <LandingProofBar metrics={metrics} />
        <LandingFeatures />
        <LandingHowItWorks />
        <LandingTestimonials testimonials={testimonials} />
        <LandingPricingCTA starterPrice={starterPlan?.price ?? null} />
      </main>
      <LandingFooter />
      {whatsappNumber && <WhatsAppFloatButton phoneNumber={whatsappNumber} />}
    </>
  )
}
```

- [ ] **Commit**

```bash
git add src/app/(public)/page.tsx src/app/globals.css
git commit -m "feat(landing): monta página principal com todas as seções e dados do banco"
```

---

## Task 13: Testes da lógica de dados

**Files:**
- Create: `src/app/(public)/landing.test.ts`

- [ ] **Escrever o teste**

```ts
// src/app/(public)/landing.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock do Prisma (padrão do projeto)
const mockPrisma = {
  plan: { findFirst: vi.fn() },
  landingMetric: { findMany: vi.fn() },
  landingTestimonial: { findMany: vi.fn() },
}

vi.mock('@/shared/database/prisma', () => ({ prisma: mockPrisma }))

const { getLandingData } = await import('./page')

describe('getLandingData', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna dados quando banco tem plano, métricas e depoimentos', async () => {
    mockPrisma.plan.findFirst.mockResolvedValue({ price: '49.90' })
    mockPrisma.landingMetric.findMany.mockResolvedValue([
      { id: '1', value: '+1.200', label: 'salões ativos' },
    ])
    mockPrisma.landingTestimonial.findMany.mockResolvedValue([
      { id: '1', authorName: 'Ana', authorRole: 'Salão · SP', quote: 'Ótimo!', rating: 5, avatarUrl: null },
    ])

    const result = await getLandingData()

    expect(result.starterPlan?.price).toBe('49.90')
    expect(result.metrics).toHaveLength(1)
    expect(result.testimonials).toHaveLength(1)
  })

  it('retorna nulls e arrays vazios quando banco não tem dados', async () => {
    mockPrisma.plan.findFirst.mockResolvedValue(null)
    mockPrisma.landingMetric.findMany.mockResolvedValue([])
    mockPrisma.landingTestimonial.findMany.mockResolvedValue([])

    const result = await getLandingData()

    expect(result.starterPlan).toBeNull()
    expect(result.metrics).toHaveLength(0)
    expect(result.testimonials).toHaveLength(0)
  })

  it('consulta apenas planos STARTER ativos', async () => {
    mockPrisma.plan.findFirst.mockResolvedValue(null)
    mockPrisma.landingMetric.findMany.mockResolvedValue([])
    mockPrisma.landingTestimonial.findMany.mockResolvedValue([])

    await getLandingData()

    expect(mockPrisma.plan.findFirst).toHaveBeenCalledWith({
      where: { name: 'STARTER', isActive: true },
      select: { price: true },
    })
  })

  it('consulta apenas métricas ativas ordenadas', async () => {
    mockPrisma.plan.findFirst.mockResolvedValue(null)
    mockPrisma.landingMetric.findMany.mockResolvedValue([])
    mockPrisma.landingTestimonial.findMany.mockResolvedValue([])

    await getLandingData()

    expect(mockPrisma.landingMetric.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    })
  })
})
```

- [ ] **Executar os testes**

```bash
npx vitest run src/app/\(public\)/landing.test.ts
```

Saída esperada:
```
✓ getLandingData > retorna dados quando banco tem plano, métricas e depoimentos
✓ getLandingData > retorna nulls e arrays vazios quando banco não tem dados
✓ getLandingData > consulta apenas planos STARTER ativos
✓ getLandingData > consulta apenas métricas ativas ordenadas

Test Files  1 passed (1)
Tests       4 passed (4)
```

- [ ] **Commit**

```bash
git add src/app/\(public\)/landing.test.ts
git commit -m "test(landing): testes da lógica de dados getLandingData"
```

---

## Task 14: Variável de ambiente + verificação TypeScript

- [ ] **Adicionar a variável de ambiente ao `.env.local`**

Abra `.env.local` (ou `.env`) e adicione:

```env
NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER=5511999999999
```

Substitua pelo número real de suporte (formato internacional sem `+`, ex.: `5511999999999`).

- [ ] **Verificar TypeScript sem erros**

```bash
npx tsc --noEmit
```

Saída esperada: nenhuma saída (zero erros).

- [ ] **Rodar todos os testes do projeto**

```bash
npx vitest run
```

Saída esperada: todos os testes passando, incluindo os novos.

- [ ] **Commit final**

```bash
git add .env.local
git commit -m "chore(landing): adiciona variável NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER"
```

---

## Task 15: Pull Request

- [ ] **Push da branch**

```bash
git push -u origin feat/landing-page-agendê
```

- [ ] **Abrir PR**

```bash
gh pr create \
  --title "feat(landing): landing page Agendê com dados do banco" \
  --body "## O que foi feito

- Landing page completa em \`/\` para salões de beleza
- 9 seções: Navbar, Hero, Prova Social, Funcionalidades, Como Funciona, Depoimentos, CTA Planos, Footer, WhatsApp flutuante
- Dados 100% do banco: planos (\`Plan\`), métricas (\`LandingMetric\`) e depoimentos (\`LandingTestimonial\`)
- Seções de prova social e depoimentos omitidas automaticamente quando não há dados cadastrados
- Botão WhatsApp flutuante configurável via \`NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER\`
- Novos models Prisma: \`LandingMetric\` e \`LandingTestimonial\` (gerenciados pelo admin)
- TypeScript sem erros · 4 testes passando

## Como testar

1. \`npx prisma migrate dev\` (se não fez ainda)
2. Cadastrar métricas e depoimentos via Prisma Studio: \`npx prisma studio\`
3. \`npm run dev\` → acessar \`http://localhost:3000\`
4. Verificar que seções somem quando não há dados no banco

🤖 Generated with [Claude Code](https://claude.ai/claude-code)"
```
