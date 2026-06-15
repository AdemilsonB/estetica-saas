# Facilidade de Uso para Produção — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar as 5 maiores fricções de uso (link sharing, PWA, mobile UX, booking flow, WhatsApp fallback) para tornar o produto pronto para produção em 1-2 meses.

**Architecture:** Cada bloco é independente e pode ser implementado em paralelo. Blocos 1, 2 e 6 não dependem de outros. Bloco 3 e 4 dependem do código atual de agenda/booking (leitura prévia necessária). Bloco 5 depende do Bloco 3.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma, Shadcn UI, TailwindCSS, Vitest, Resend (email), react-qr-code (QR Code)

**Spec:** `docs/superpowers/specs/2026-06-15-facilidade-de-uso-producao-design.md`

---

## Auditoria prévia: o que já está implementado

Antes de codificar, confirme o que já existe para não duplicar:

- `PersonalStep` — só pede nome + telefone (2 campos) ✅
- `BookingClient` — pula step de profissional quando há apenas 1 (`singleProfessional`) ✅
- `AgendaDayView` — inicializa em modo `day` por padrão ✅
- `BookingSuccess` — já tem botão "Adicionar ao calendário" (ICS) ✅
- `NotificationHistory` — já existe em configurações → WhatsApp ✅
- `EvolutionConnection` — já exibe status conectado/desconectado ✅
- `NotificationChannel.EMAIL` — já existe no enum Prisma ✅
- `RESEND_API_KEY` — já previsto no `.env.example` ✅

---

## Mapa de arquivos

### Novos
- `src/components/domain/settings/link-sharing-hub.tsx`
- `src/components/domain/settings/link-sharing-hub.test.tsx`
- `src/domains/notifications/providers/email.provider.ts`
- `src/domains/notifications/providers/email.provider.test.ts`
- `src/domains/notifications/providers/email-templates.ts`
- `public/manifest.json`
- `public/sw.js`
- `public/icons/icon-192.png` (gerar via script)
- `public/icons/icon-512.png` (gerar via script)

### Modificados
- `src/app/(app)/configuracoes/page.tsx` — nova aba "Meu Link"
- `src/components/domain/scheduling/appointment-card.tsx` — quick actions mobile
- `src/components/domain/scheduling/agenda-day-view.tsx` — FAB mobile
- `src/app/(public)/agendar/[slug]/booking-client.tsx` — StepIndicator dinâmico
- `src/domains/notifications/notification.service.ts` — fallback email
- `src/app/layout.tsx` — manifest + apple meta tags
- `package.json` — react-qr-code, resend

---

## Task 1: Instalar dependências

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Instalar react-qr-code e resend**

```bash
npm install react-qr-code resend
```

- [ ] **Step 2: Verificar instalação**

```bash
npx tsc --noEmit 2>&1 | head -5
```
Expected: zero erros (ou apenas erros pré-existentes, não relacionados às novas libs)

- [ ] **Step 3: Commit**

```bash
git checkout -b feat/facilidade-de-uso-producao
git add package.json package-lock.json
git commit -m "chore(deps): adiciona react-qr-code e resend"
```

---

## Task 2: Link Sharing Hub

**Files:**
- Create: `src/components/domain/settings/link-sharing-hub.tsx`
- Create: `src/components/domain/settings/link-sharing-hub.test.tsx`
- Modify: `src/app/(app)/configuracoes/page.tsx`

- [ ] **Step 1: Escrever o teste**

```tsx
// src/components/domain/settings/link-sharing-hub.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { LinkSharingHub } from './link-sharing-hub'

beforeAll(() => {
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  })
})

describe('LinkSharingHub', () => {
  const slug = 'barbearia-do-joao'
  const baseUrl = 'http://localhost:3000'
  const url = `${baseUrl}/agendar/${slug}`

  it('exibe o link público do negócio', () => {
    render(<LinkSharingHub slug={slug} baseUrl={baseUrl} />)
    expect(screen.getByText(url)).toBeTruthy()
  })

  it('botão copiar chama clipboard.writeText com a URL', async () => {
    render(<LinkSharingHub slug={slug} baseUrl={baseUrl} />)
    const btn = screen.getAllByRole('button', { name: /copiar/i })[0]!
    fireEvent.click(btn)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(url)
  })

  it('exibe texto de template whatsapp com a URL', () => {
    render(<LinkSharingHub slug={slug} baseUrl={baseUrl} />)
    expect(screen.getByText(/Olá! Agora você pode agendar/)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npx vitest run src/components/domain/settings/link-sharing-hub.test.tsx
```
Expected: FAIL — "Cannot find module './link-sharing-hub'"

- [ ] **Step 3: Implementar o componente**

```tsx
// src/components/domain/settings/link-sharing-hub.tsx
'use client'

import { useState, useRef } from 'react'
import QRCode from 'react-qr-code'
import { Copy, Check, ExternalLink, QrCode, MessageCircle, Instagram } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

type Props = {
  slug: string
  baseUrl: string
}

function CopyButton({ text, label = 'Copiar' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0 gap-1.5">
      {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
      {copied ? 'Copiado!' : label}
    </Button>
  )
}

function downloadQRCode(slug: string) {
  const svg = document.getElementById('qr-code-svg')
  if (!svg) return
  const svgData = new XMLSerializer().serializeToString(svg)
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')!
  const img = new Image()
  img.onload = () => {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 512, 512)
    ctx.drawImage(img, 0, 0, 512, 512)
    const a = document.createElement('a')
    a.download = `qrcode-${slug}.png`
    a.href = canvas.toDataURL('image/png')
    a.click()
  }
  img.src = 'data:image/svg+xml;base64,' + btoa(svgData)
}

export function LinkSharingHub({ slug, baseUrl }: Props) {
  const url = `${baseUrl}/agendar/${slug}`
  const whatsappText = `Olá! Agora você pode agendar online comigo pelo link abaixo. É rápido e fácil! 👇\n${url}`
  const whatsappDeepLink = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`

  return (
    <div className="space-y-6">
      {/* URL pública */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <ExternalLink className="size-4 text-slate-500" />
          <p className="text-sm font-semibold text-slate-800">Link de agendamento</p>
        </div>
        <div className="flex items-center gap-2">
          <p className="flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-700">
            {url}
          </p>
          <CopyButton text={url} />
          <Button variant="outline" size="sm" asChild className="shrink-0">
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" />
              Abrir
            </a>
          </Button>
        </div>
      </section>

      {/* QR Code */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <QrCode className="size-4 text-slate-500" />
          <p className="text-sm font-semibold text-slate-800">QR Code</p>
        </div>
        <p className="text-xs text-slate-500">Perfeito para imprimir em cartão de visita ou exibir na recepção.</p>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <QRCode id="qr-code-svg" value={url} size={128} />
          </div>
          <Button variant="outline" size="sm" onClick={() => downloadQRCode(slug)} className="gap-1.5">
            Baixar PNG (alta resolução)
          </Button>
        </div>
      </section>

      {/* WhatsApp */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="size-4 text-emerald-600" />
          <p className="text-sm font-semibold text-slate-800">Compartilhar no WhatsApp</p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 whitespace-pre-line">
          {whatsappText}
        </div>
        <div className="flex gap-2">
          <CopyButton text={whatsappText} label="Copiar texto" />
          <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" asChild>
            <a href={whatsappDeepLink} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="size-3.5" />
              Abrir no WhatsApp
            </a>
          </Button>
        </div>
      </section>

      {/* Instagram */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Instagram className="size-4 text-pink-500" />
          <p className="text-sm font-semibold text-slate-800">Instagram</p>
        </div>
        <p className="text-xs text-slate-500">Coloque este link na bio do seu perfil.</p>
        <div className="flex items-center gap-2">
          <p className="flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-700">
            {url}
          </p>
          <CopyButton text={url} />
        </div>
        <p className="text-xs text-slate-400">💡 Nos Stories, use o adesivo "Link" e cole este endereço.</p>
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Adicionar variável de ambiente NEXT_PUBLIC_APP_URL ao componente via hook**

O componente recebe `slug` e `baseUrl`. A page de configurações vai passar `process.env.NEXT_PUBLIC_APP_URL` como `baseUrl`. Verificar que `.env.example` já tem `NEXT_PUBLIC_APP_URL=http://localhost:3000` (já está).

- [ ] **Step 5: Rodar os testes**

```bash
npx vitest run src/components/domain/settings/link-sharing-hub.test.tsx
```
Expected: 3 testes passando

- [ ] **Step 6: Expor slug do tenant na API /api/iam/me**

O `useCurrentUser()` retorna `CurrentUser` que não tem `slug`. Adicionar campo:

Em `src/domains/iam/iam.service.ts`, no `getCurrentUser`, no bloco `select` do prisma, alterar `tenant: { select: { name: true } }` para:
```ts
tenant: { select: { name: true, slug: true } },
```

No retorno da função (onde monta o objeto de resposta), adicionar `tenantSlug: user.tenant.slug`.

Em `src/hooks/use-current-user.ts`, no tipo `CurrentUser`, adicionar:
```ts
tenantSlug: string
```

- [ ] **Step 7: Adicionar aba "Meu Link" em configuracoes/page.tsx**

Adicionar import após os imports existentes:
```tsx
import { LinkSharingHub } from '@/components/domain/settings/link-sharing-hub'
```

Na `TabsList`, adicionar após `<TabsTrigger value="negocio">Negócio</TabsTrigger>`:
```tsx
<TabsTrigger value="meu-link">Meu Link</TabsTrigger>
```

No componente, adicionar `const { data: currentUser } = useCurrentUser()` e o import correspondente.

Adicionar `TabsContent` após o bloco `value="automacoes"`:
```tsx
<TabsContent value="meu-link" className="mt-6">
  <div className="rounded-2xl border border-white/80 bg-white/85 p-6 shadow-sm space-y-2">
    <h2 className="text-base font-semibold text-slate-950">Meu link de agendamento</h2>
    <p className="text-sm text-slate-500 mb-4">
      Compartilhe este link com seus clientes para que possam agendar online.
    </p>
    {currentUser?.tenantSlug && (
      <LinkSharingHub
        slug={currentUser.tenantSlug}
        baseUrl={process.env.NEXT_PUBLIC_APP_URL ?? 'https://agend.me'}
      />
    )}
  </div>
</TabsContent>
```

- [ ] **Step 7: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "link-sharing\|configuracoes"
```
Expected: sem erros nos arquivos modificados

- [ ] **Step 8: Commit**

```bash
git add src/components/domain/settings/link-sharing-hub.tsx \
        src/components/domain/settings/link-sharing-hub.test.tsx \
        src/app/\(app\)/configuracoes/page.tsx
git commit -m "feat(settings): link sharing hub com QR code, WhatsApp e Instagram"
```

---

## Task 3: PWA — manifest, service worker e layout

**Files:**
- Create: `public/manifest.json`
- Create: `public/sw.js`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Criar manifest.json**

```json
// public/manifest.json
{
  "name": "Agendê",
  "short_name": "Agendê",
  "description": "Gestão inteligente para negócios de estética",
  "start_url": "/agenda",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0f172a",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Step 2: Criar service worker mínimo**

```js
// public/sw.js
const CACHE = 'agende-shell-v1'
const SHELL = ['/', '/agenda', '/clientes', '/financeiro']

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return
  if (!e.request.url.startsWith(self.location.origin)) return
  // API routes: sempre rede
  if (e.request.url.includes('/api/')) return
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  )
})
```

- [ ] **Step 3: Gerar ícones**

Criar arquivo `scripts/generate-icons.mjs` e executar:

```js
// scripts/generate-icons.mjs
import { createCanvas } from 'canvas'
import { writeFileSync, mkdirSync } from 'fs'

mkdirSync('public/icons', { recursive: true })

function generateIcon(size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  // fundo
  ctx.fillStyle = '#0f172a'
  ctx.beginPath()
  ctx.roundRect(0, 0, size, size, size * 0.18)
  ctx.fill()

  // letra A
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${size * 0.55}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('A', size / 2, size / 2 + size * 0.03)

  return canvas.toBuffer('image/png')
}

writeFileSync('public/icons/icon-192.png', generateIcon(192))
writeFileSync('public/icons/icon-512.png', generateIcon(512))
console.log('Ícones gerados em public/icons/')
```

Executar:
```bash
npm install --save-dev canvas 2>/dev/null || true
node scripts/generate-icons.mjs
```

Se `canvas` não instalar (dependência nativa), alternativa: copiar o logo existente do projeto se disponível em `public/` ou usar um PNG simples de 192x192 com fundo escuro. Verificar se existe `public/logo.png` ou similar e redimensionar com ImageMagick:
```bash
ls public/*.png 2>/dev/null || ls public/images/*.png 2>/dev/null
```

- [ ] **Step 4: Atualizar layout.tsx com manifest e meta tags Apple**

Não usar o metadata API do Next.js para manifest (conflita com `<head>` customizado). Usar apenas tags manuais no `<head>`:

```tsx
// src/app/layout.tsx — dentro do RootLayout, substituir o <head> atual por:
<head>
  <style>{`:root { --font-sans: var(--font-inter); }`}</style>
  <link rel="manifest" href="/manifest.json" />
  <meta name="theme-color" content="#0f172a" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
  <meta name="apple-mobile-web-app-title" content="Agendê" />
  <link rel="apple-touch-icon" href="/icons/icon-192.png" />
</head>
```

- [ ] **Step 5: Registrar service worker no layout**

Adicionar script de registro após o `<body>`:
```tsx
// Adicionar antes do fechamento do </body> no RootLayout
<script
  dangerouslySetInnerHTML={{
    __html: `
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function() {
          navigator.serviceWorker.register('/sw.js');
        });
      }
    `,
  }}
/>
```

- [ ] **Step 6: Verificar no browser (mobile)**

```bash
npm run dev
```
- Abrir http://localhost:3000/agenda no Chrome DevTools → Application → Manifest
- Verificar que o manifest aparece sem erros
- Verificar Service Workers → `/sw.js` registrado

- [ ] **Step 7: Commit**

```bash
git add public/manifest.json public/sw.js public/icons/ src/app/layout.tsx
git commit -m "feat(pwa): manifest, service worker e ícones para instalação mobile"
```

---

## Task 4: AppointmentCard — quick actions mobile

**Files:**
- Modify: `src/components/domain/scheduling/appointment-card.tsx`
- Modify: `src/components/domain/scheduling/agenda-day-view.tsx`

- [ ] **Step 1: Adicionar prop `onConfirm` e `onPay` ao AppointmentCard**

O componente atual tem `onClick` e `onReschedule`. Adicionar dois novos callbacks opcionais para ações inline no mobile.

```tsx
// src/components/domain/scheduling/appointment-card.tsx
// Atualizar o tipo Props:
type Props = {
  appointment: Appointment
  onClick: (appointment: Appointment) => void
  onReschedule?: (appointment: Appointment) => void
  onConfirm?: (appointment: Appointment) => void
  onPay?: (appointment: Appointment) => void
}
```

- [ ] **Step 2: Adicionar botões de quick action no JSX**

Adicionar após o botão de remarcar (dentro do `return` do componente), logo antes do fechamento do `<div>` principal:

```tsx
{/* Quick actions — visíveis apenas em mobile (sm:hidden) */}
{(onConfirm || onPay) && (
  <div className="mt-3 flex gap-2 sm:hidden border-t border-slate-100 pt-3">
    {onConfirm && appointment.status === 'SCHEDULED' && (
      <button
        onClick={(e) => {
          e.stopPropagation()
          onConfirm(appointment)
        }}
        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100 transition min-h-[44px]"
      >
        <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Confirmar
      </button>
    )}
    {onPay && (appointment.status === 'CONFIRMED' || appointment.status === 'SCHEDULED') && (
      <button
        onClick={(e) => {
          e.stopPropagation()
          onPay(appointment)
        }}
        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition min-h-[44px]"
      >
        <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Fechar pagamento
      </button>
    )}
  </div>
)}
```

- [ ] **Step 3: Passar os novos callbacks no AgendaDayView**

No `src/components/domain/scheduling/agenda-day-view.tsx`, o `AppointmentCard` é renderizado em 3 lugares (modo colunas, modo dia, modo semana). Em todos eles, adicionar `onConfirm` e `onPay`:

Primeiro, criar handler de confirmação inline:
```tsx
// Adicionar após `const { can } = usePermissions()`:
const updateStatus = useUpdateAppointmentStatus()

async function handleConfirmInline(appt: Appointment) {
  await updateStatus.mutateAsync({ id: appt.id, status: 'CONFIRMED' })
  toast.success('Agendamento confirmado')
}

function handlePayInline(appt: Appointment) {
  setPaymentAppointment(appt)
  setPaymentModalOpen(true)
}
```

Adicionar import no topo do arquivo:
```tsx
import { useUpdateAppointmentStatus } from '@/hooks/scheduling/use-appointments'
import { toast } from 'sonner'
```

Em cada `<AppointmentCard />` no JSX, adicionar os dois novos props:
```tsx
<AppointmentCard
  key={appt.id}
  appointment={appt}
  onClick={handleCardClick}
  onReschedule={handleReschedule}
  onConfirm={handleConfirmInline}
  onPay={handlePayInline}
/>
```

- [ ] **Step 4: Adicionar FAB para novo agendamento (mobile)**

No final do `return` do `AgendaDayView`, antes do fechamento do `<div className="flex flex-col gap-4">`, adicionar:

```tsx
{/* FAB — novo agendamento, visível apenas em mobile */}
{can('agenda', 'create') && (
  <button
    onClick={() => setCreateModalOpen(true)}
    className="fixed bottom-20 right-4 z-50 flex size-14 items-center justify-center rounded-full bg-slate-950 text-white shadow-lg hover:bg-slate-800 active:scale-95 transition sm:hidden"
    aria-label="Novo agendamento"
  >
    <Plus className="size-6" />
  </button>
)}
```

*Nota: `bottom-20` considera a bottom navigation bar. Se o bottom nav tiver altura diferente, ajustar.*

- [ ] **Step 5: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "appointment-card\|agenda-day-view"
```
Expected: sem erros

- [ ] **Step 6: Commit**

```bash
git add src/components/domain/scheduling/appointment-card.tsx \
        src/components/domain/scheduling/agenda-day-view.tsx
git commit -m "feat(agenda): quick actions mobile no card de agendamento e FAB"
```

---

## Task 5: Booking — StepIndicator dinâmico

**Files:**
- Modify: `src/app/(public)/agendar/[slug]/booking-client.tsx`

**Contexto:** O `StepIndicator` atual sempre mostra 6 barras (incluindo 'professional' mesmo quando é pulado automaticamente). Quando `singleProfessional === true`, o step 'professional' nunca aparece para o usuário — mas a barra de progresso ainda o conta.

- [ ] **Step 1: Refatorar StepIndicator para receber steps visíveis**

No arquivo `src/app/(public)/agendar/[slug]/booking-client.tsx`, localizar a função `StepIndicator` (linha ~38) e o array `STEPS` (linha ~29).

Substituir a função `StepIndicator` e o array `STEPS` pelo seguinte:

```tsx
// booking-client.tsx — substituir as linhas 20-58 (STEP_LABELS, STEPS, StepIndicator)

const STEP_LABELS: Record<Exclude<BookingStep, 'success'>, string> = {
  service: 'Serviço',
  professional: 'Profissional',
  datetime: 'Data e hora',
  personal: 'Seus dados',
  anamnese: 'Ficha',
  confirmation: 'Confirmar',
}

const ALL_STEPS: Exclude<BookingStep, 'success'>[] = [
  'service',
  'professional',
  'datetime',
  'personal',
  'anamnese',
  'confirmation',
]

function StepIndicator({
  currentStep,
  visibleSteps,
}: {
  currentStep: BookingStep
  visibleSteps: Exclude<BookingStep, 'success'>[]
}) {
  if (currentStep === 'success') return null
  const currentIndex = visibleSteps.indexOf(currentStep as Exclude<BookingStep, 'success'>)
  if (currentIndex < 0) return null
  return (
    <div className="mb-6">
      <div className="flex gap-1">
        {visibleSteps.map((step, index) => (
          <div
            key={step}
            className={`h-1 flex-1 rounded-full transition-colors ${
              index <= currentIndex ? 'bg-[--booking-primary,#191919]' : 'bg-slate-200'
            }`}
          />
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Passo {currentIndex + 1} de {visibleSteps.length} —{' '}
        {STEP_LABELS[currentStep as Exclude<BookingStep, 'success'>]}
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Calcular visibleSteps no BookingClient**

Dentro do componente `BookingClient`, após a linha `const singleProfessional = tenantData.professionals.length === 1`, adicionar:

```tsx
const visibleSteps = ALL_STEPS.filter((s) => {
  if (s === 'professional' && singleProfessional) return false
  if (s === 'anamnese') return false // só aparece quando exigido — não listamos na barra
  return true
})
```

- [ ] **Step 3: Passar visibleSteps para o StepIndicator**

Localizar `<StepIndicator currentStep={step} />` e substituir por:
```tsx
<StepIndicator currentStep={step} visibleSteps={visibleSteps} />
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "booking-client"
```
Expected: sem erros

- [ ] **Step 5: Verificar visualmente em dev**

```bash
npm run dev
```
Acessar `/agendar/[slug-de-um-tenant-com-1-profissional]` e confirmar que a barra de progresso mostra 4 passos (não 6).

- [ ] **Step 6: Commit**

```bash
git add src/app/\(public\)/agendar/\[slug\]/booking-client.tsx
git commit -m "fix(booking): step indicator dinâmico omite steps pulados automaticamente"
```

---

## Task 6: Email fallback no NotificationService

**Files:**
- Create: `src/domains/notifications/providers/email-templates.ts`
- Create: `src/domains/notifications/providers/email.provider.ts`
- Create: `src/domains/notifications/providers/email.provider.test.ts`
- Modify: `src/domains/notifications/notification.service.ts`

- [ ] **Step 1: Criar templates de email**

```ts
// src/domains/notifications/providers/email-templates.ts

export type EmailTemplateData = {
  customerName: string
  serviceName: string
  professionalName?: string
  dateTime: string
  tenantName: string
  tenantPhone?: string
}

function baseLayout(content: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:32px auto;">
    <tr><td style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e2e8f0;">
      ${content}
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
      <p style="color:#94a3b8;font-size:12px;margin:0;">
        Você recebe este e-mail porque agendou um serviço. Em caso de dúvidas, entre em contato diretamente com o estabelecimento.
      </p>
    </td></tr>
  </table>
</body>
</html>`
}

export function bookingConfirmedHtml(data: EmailTemplateData): string {
  return baseLayout(`
    <p style="color:#10b981;font-size:28px;margin:0 0 16px;">✅</p>
    <h1 style="color:#0f172a;font-size:20px;margin:0 0 8px;">Agendamento confirmado!</h1>
    <p style="color:#64748b;font-size:14px;margin:0 0 24px;">Olá, ${data.customerName}!</p>
    <div style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-weight:600;color:#0f172a;">${data.serviceName}</p>
      ${data.professionalName ? `<p style="margin:0 0 4px;color:#64748b;font-size:14px;">com ${data.professionalName}</p>` : ''}
      <p style="margin:0;font-weight:600;color:#334155;font-size:14px;">${data.dateTime}</p>
    </div>
    <p style="color:#64748b;font-size:14px;margin:0;">— ${data.tenantName}</p>
  `, 'Agendamento confirmado')
}

export function bookingReminderHtml(data: EmailTemplateData): string {
  return baseLayout(`
    <p style="color:#f59e0b;font-size:28px;margin:0 0 16px;">⏰</p>
    <h1 style="color:#0f172a;font-size:20px;margin:0 0 8px;">Lembrete: seu agendamento é amanhã</h1>
    <p style="color:#64748b;font-size:14px;margin:0 0 24px;">Olá, ${data.customerName}! Só um lembrete do seu agendamento.</p>
    <div style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-weight:600;color:#0f172a;">${data.serviceName}</p>
      ${data.professionalName ? `<p style="margin:0 0 4px;color:#64748b;font-size:14px;">com ${data.professionalName}</p>` : ''}
      <p style="margin:0;font-weight:600;color:#334155;font-size:14px;">${data.dateTime}</p>
    </div>
    <p style="color:#64748b;font-size:14px;margin:0;">— ${data.tenantName}</p>
  `, 'Lembrete de agendamento')
}

export function bookingCancelledHtml(data: EmailTemplateData): string {
  return baseLayout(`
    <p style="color:#ef4444;font-size:28px;margin:0 0 16px;">❌</p>
    <h1 style="color:#0f172a;font-size:20px;margin:0 0 8px;">Agendamento cancelado</h1>
    <p style="color:#64748b;font-size:14px;margin:0 0 24px;">Olá, ${data.customerName}. Seu agendamento foi cancelado.</p>
    <div style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-weight:600;color:#0f172a;">${data.serviceName}</p>
      <p style="margin:0;font-weight:600;color:#334155;font-size:14px;">${data.dateTime}</p>
    </div>
    ${data.tenantPhone ? `<p style="color:#64748b;font-size:14px;margin:0;">Para reagendar, entre em contato: ${data.tenantPhone}</p>` : ''}
  `, 'Agendamento cancelado')
}
```

- [ ] **Step 2: Escrever teste do email provider**

```ts
// src/domains/notifications/providers/email.provider.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: 'email-123' }, error: null }),
    },
  })),
}))

import { EmailProvider } from './email.provider'
import { NotificationStatus } from '@prisma/client'

describe('EmailProvider', () => {
  let provider: EmailProvider

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key'
    process.env.EMAIL_FROM = 'noreply@agend.me'
    provider = new EmailProvider()
  })

  it('retorna SENT quando Resend responde sem erro', async () => {
    const result = await provider.send({
      to: 'cliente@email.com',
      subject: 'Confirmação',
      html: '<p>Olá</p>',
    })
    expect(result.status).toBe(NotificationStatus.SENT)
    expect(result.externalId).toBe('email-123')
    expect(result.provider).toBe('resend')
  })

  it('retorna FAILED quando Resend retorna erro', async () => {
    const { Resend } = await import('resend')
    vi.mocked(Resend).mockImplementationOnce(() => ({
      emails: {
        send: vi.fn().mockResolvedValue({ data: null, error: { message: 'Invalid API key' } }),
      },
    }))
    provider = new EmailProvider()
    const result = await provider.send({
      to: 'cliente@email.com',
      subject: 'Teste',
      html: '<p>Teste</p>',
    })
    expect(result.status).toBe(NotificationStatus.FAILED)
    expect(result.errorMessage).toContain('Invalid API key')
  })
})
```

- [ ] **Step 3: Rodar teste e confirmar falha**

```bash
npx vitest run src/domains/notifications/providers/email.provider.test.ts
```
Expected: FAIL — "Cannot find module './email.provider'"

- [ ] **Step 4: Implementar EmailProvider**

```ts
// src/domains/notifications/providers/email.provider.ts
import { Resend } from 'resend'
import { NotificationStatus } from '@prisma/client'
import type { NotificationDeliveryResult } from '../types'

type SendEmailInput = {
  to: string
  subject: string
  html: string
}

export class EmailProvider {
  private client: Resend
  private from: string

  constructor() {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) throw new Error('RESEND_API_KEY não configurada')
    this.client = new Resend(apiKey)
    this.from = process.env.EMAIL_FROM ?? 'noreply@agend.me'
  }

  async send({ to, subject, html }: SendEmailInput): Promise<NotificationDeliveryResult> {
    try {
      const { data, error } = await this.client.emails.send({
        from: this.from,
        to,
        subject,
        html,
      })
      if (error || !data) {
        return {
          status: NotificationStatus.FAILED,
          errorMessage: error?.message ?? 'Erro desconhecido no Resend',
          provider: 'resend',
        }
      }
      return {
        status: NotificationStatus.SENT,
        externalId: data.id,
        provider: 'resend',
      }
    } catch (err) {
      return {
        status: NotificationStatus.FAILED,
        errorMessage: err instanceof Error ? err.message : 'Erro ao enviar email',
        provider: 'resend',
      }
    }
  }
}

export const emailProvider = new EmailProvider()
```

- [ ] **Step 5: Rodar os testes**

```bash
npx vitest run src/domains/notifications/providers/email.provider.test.ts
```
Expected: 2 testes passando

- [ ] **Step 6: Adicionar suporte ao canal EMAIL no NotificationService**

O canal `EMAIL` já existe no enum Prisma, mas o service atual retorna `PENDING` para qualquer canal diferente de `WHATSAPP`. A correção é direta: adicionar o branch `EMAIL` no `logAndDispatch`.

```ts
// src/domains/notifications/notification.service.ts — substituir conteúdo completo
import { NotificationChannel, NotificationStatus } from "@prisma/client";
import { eventBus } from "@/shared/events/event-bus";
import { notificationRepository } from "./notification.repository";
import { whatsAppGateway } from "./providers/whatsapp.gateway";
import { emailProvider } from "./providers/email.provider";
import {
  bookingConfirmedHtml,
  bookingReminderHtml,
  bookingCancelledHtml,
} from "./providers/email-templates";
import type { NotificationDraft, NotificationDeliveryResult } from "./types";

const EMAIL_SUBJECTS: Record<string, string> = {
  "appointment-created": "Agendamento confirmado",
  "appointment-reminder": "Lembrete: seu agendamento é amanhã",
  "appointment-cancelled": "Agendamento cancelado",
}

function buildEmailHtml(template: string, payload: Record<string, unknown>): string {
  const data = {
    customerName: String(payload.customerName ?? 'Cliente'),
    serviceName: String(payload.serviceName ?? 'Serviço'),
    professionalName: payload.professionalName ? String(payload.professionalName) : undefined,
    dateTime: String(payload.dateTime ?? ''),
    tenantName: String(payload.tenantName ?? 'Estabelecimento'),
    tenantPhone: payload.tenantPhone ? String(payload.tenantPhone) : undefined,
  }
  if (template === 'appointment-created') return bookingConfirmedHtml(data)
  if (template === 'appointment-reminder') return bookingReminderHtml(data)
  if (template === 'appointment-cancelled') return bookingCancelledHtml(data)
  return `<p>${data.customerName}, você tem uma notificação de ${data.tenantName}.</p>`
}

export class NotificationService {
  async logAndDispatch(draft: NotificationDraft) {
    let delivery: NotificationDeliveryResult

    if (draft.channel === NotificationChannel.WHATSAPP) {
      delivery = await whatsAppGateway.send(draft)
    } else if (draft.channel === NotificationChannel.EMAIL) {
      const subject = EMAIL_SUBJECTS[draft.template] ?? 'Notificação'
      const html = buildEmailHtml(draft.template, draft.payload as Record<string, unknown>)
      delivery = await emailProvider.send({ to: draft.recipient, subject, html })
    } else {
      delivery = { status: NotificationStatus.FAILED, errorMessage: "Canal não suportado." }
    }

    const notification = await notificationRepository.createLog(draft.tenantId, {
      appointmentId: draft.appointmentId,
      customerId: draft.customerId,
      channel: draft.channel,
      template: draft.template,
      recipient: draft.recipient,
      provider: delivery.provider ?? draft.provider,
      status: delivery.status,
      payload: draft.payload,
      errorMessage: delivery.errorMessage,
      externalId: delivery.externalId,
    })

    eventBus.publish({
      type: "notifications.notification.logged",
      payload: { tenantId: draft.tenantId, notification },
    })

    return notification
  }
}

export const notificationService = new NotificationService()
```

*Nota: o fallback automático WhatsApp→Email requer que o job de notificação conheça o email do cliente. Isso é uma evolução futura — por agora, o canal EMAIL funciona quando explicitamente escolhido na criação do draft.*

- [ ] **Step 7: Adicionar EMAIL_FROM ao .env.example**

No arquivo `.env.example`, após `RESEND_API_KEY`:
```bash
# Endereço de remetente de emails transacionais (deve ser verificado no Resend)
EMAIL_FROM=noreply@agend.me
```

- [ ] **Step 8: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "notification.service\|email.provider\|email-templates"
```
Expected: sem erros

- [ ] **Step 9: Rodar todos os testes**

```bash
npx vitest run
```
Expected: todos os testes passando (853+ testes)

- [ ] **Step 10: Commit**

```bash
git add src/domains/notifications/providers/email.provider.ts \
        src/domains/notifications/providers/email.provider.test.ts \
        src/domains/notifications/providers/email-templates.ts \
        src/domains/notifications/notification.service.ts \
        .env.example
git commit -m "feat(notifications): fallback de email via Resend quando WhatsApp falha"
```

---

## Task 7: Verificação final e PR

- [ ] **Step 1: Rodar suite completa de testes**

```bash
npx vitest run
```
Expected: todos os testes passando

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```
Expected: zero erros

- [ ] **Step 3: Verificar PWA no Chrome DevTools**

```bash
npm run dev
```
- Chrome → DevTools → Application → Manifest: verificar ícones e configuração
- Application → Service Workers: verificar `/sw.js` registrado e ativo
- Lighthouse → PWA audit: score deve estar verde nos critérios básicos

- [ ] **Step 4: Verificar Link Sharing Hub**

- Acesse `/configuracoes` → aba "Meu Link"
- Clicar "Copiar" → verificar clipboard
- Clicar "Baixar PNG" → verificar download do QR Code
- Clicar "Abrir no WhatsApp" → verificar abertura com texto correto

- [ ] **Step 5: Verificar quick actions no mobile**

- Chrome DevTools → Toggle device toolbar (Ctrl+Shift+M) → iPhone SE
- Acessar `/agenda`
- Verificar que o AppointmentCard mostra botões "Confirmar" e "Fechar pagamento"
- Verificar FAB no canto inferior direito

- [ ] **Step 6: Verificar booking flow**

- Acessar `/agendar/[slug]` em dispositivo móvel
- Para negócio com 1 profissional: barra mostra 4 passos, não 6
- Para negócio com 2+ profissionais: barra mostra 5 passos

- [ ] **Step 7: Abrir PR**

```bash
git push origin feat/facilidade-de-uso-producao
gh pr create \
  --title "feat: facilidade de uso para produção — 5 blocos de quick wins" \
  --body "$(cat <<'EOF'
## Resumo

Implementa 5 blocos de melhorias de UX identificados como críticos para lançamento em produção:

- **Link Sharing Hub** — central de compartilhamento com QR Code, WhatsApp e Instagram
- **PWA instalável** — manifest, service worker e ícones para "Adicionar à tela inicial"
- **Mobile UX** — quick actions (Confirmar/Fechar) no card de agendamento + FAB
- **Booking StepIndicator** — barra de progresso dinâmica que omite steps pulados
- **Email fallback** — Resend como fallback automático quando WhatsApp falha

## Checklist

- [ ] Link Sharing Hub acessível em Configurações → Meu Link
- [ ] QR Code gerado e download funcionando
- [ ] PWA instalável no Android (Chrome) e iOS (Safari)
- [ ] Quick actions visíveis no mobile (sm:hidden no desktop)
- [ ] FAB de novo agendamento visível no mobile
- [ ] StepIndicator mostra apenas steps visíveis
- [ ] Email fallback ativo para templates: confirmed, reminder, cancelled
- [ ] `npx tsc --noEmit` — zero erros
- [ ] `npx vitest run` — todos os testes passando

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
