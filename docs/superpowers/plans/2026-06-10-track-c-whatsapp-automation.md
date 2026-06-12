# Track C — WhatsApp Automation Suite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar a suíte completa de automações WhatsApp — UI de configuração, chatbot inbound com detecção de intenção, correção do job de aniversário, status diário e avisos de vencimento de assinatura.

**Architecture:** C1 (lembrete de agendamento via pg-boss) já está implementado. C2 adiciona API Route + hook + componente de UI para configurar os campos de automação que já existem no schema do Tenant. C3 adiciona webhook inbound de mensagens com classificação de intenção por keyword e resposta automática via Evolution API. C4 corrige o job de aniversário para respeitar `birthdayEnabled` e usar a mensagem customizada do tenant. C5 cria job de status diário e C6 job de avisos de vencimento de trial/assinatura.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Prisma, pg-boss, TanStack Query, Shadcn UI, Zod, Evolution API (Evolution Provider já configurado)

---

## Estado atual — o que já existe

| Item | Status | Observação |
|---|---|---|
| Schema Tenant: campos de automação | ✅ | `autoReplyEnabled/Message`, `offHoursEnabled/Message`, `dailyStatusEnabled/Hour`, `birthdayEnabled/Message/GiftServiceId`, `reminderLeadHours` |
| C1 — Lembrete de agendamento | ✅ | `src/shared/queue/jobs/appointment-reminder.ts` + `scheduleAppointmentReminder()` |
| C4 — Birthday job (shell) | ⚠️ | Existe mas não verifica `birthdayEnabled`, usa query em `whatsappEnabled` em vez de `evolutionConnected` |
| Evolution Provider | ✅ | `evolutionProvider.send()` + `configureWebhook()` |
| Webhook de conexão | ✅ | `src/app/api/webhooks/evolution/connection/route.ts` |
| API de automações | ❌ | Não existe |
| UI de automações | ❌ | Não existe (sem aba "Automações" em Configurações) |
| Chatbot inbound | ❌ | Sem webhook de mensagens, sem intent classifier |
| Daily status job | ❌ | Não existe |
| Subscription warning job | ❌ | Não existe |

---

## Mapa de arquivos

| Arquivo | Ação | Task |
|---|---|---|
| `src/app/api/settings/automations/route.ts` | Criar | 1 |
| `src/hooks/settings/use-automations.ts` | Criar | 2 |
| `src/components/domain/settings/whatsapp-automations-form.tsx` | Criar | 3 |
| `src/app/(app)/configuracoes/page.tsx` | Modificar | 4 |
| `prisma/schema.prisma` | Modificar | 5 |
| `prisma/migrations/.../migration.sql` | Criar (via prisma migrate) | 5 |
| `src/shared/config/env.ts` | Modificar | 5 |
| `src/domains/notifications/chatbot/intent-classifier.ts` | Criar | 6 |
| `src/domains/notifications/chatbot/intent-classifier.test.ts` | Criar | 6 |
| `src/app/api/webhooks/evolution/messages/route.ts` | Criar | 7 |
| `src/domains/notifications/providers/evolution.provider.ts` | Modificar | 8 |
| `src/app/api/whatsapp/evolution/connect/route.ts` | Modificar | 8 |
| `src/shared/queue/jobs/birthday-reminder.ts` | Modificar | 9 |
| `src/shared/queue/jobs/daily-status.ts` | Criar | 10 |
| `src/shared/queue/jobs/subscription-expiry-warnings.ts` | Criar | 11 |
| `src/app/api/_lib/runtime.ts` | Modificar | 12 |

---

## Task 1: API de Automações — GET/PUT `/api/settings/automations`

**Files:**
- Create: `src/app/api/settings/automations/route.ts`

- [ ] **Step 1: Criar a API Route**

Criar `src/app/api/settings/automations/route.ts`:

```typescript
import { z } from 'zod'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { ensurePermission, PERMISSIONS } from '@/shared/auth/permissions'
import { validateInput } from '@/shared/http/validate-input'
import { handleApiError } from '@/shared/http/handle-api-error'
import { prisma } from '@/shared/database/prisma'

const AUTOMATIONS_SELECT = {
  reminderLeadHours:      true,
  autoReplyEnabled:       true,
  autoReplyIntervalHours: true,
  autoReplyMessage:       true,
  offHoursEnabled:        true,
  offHoursMessage:        true,
  dailyStatusEnabled:     true,
  dailyStatusHour:        true,
  birthdayEnabled:        true,
  birthdayMessage:        true,
  birthdayGiftServiceId:  true,
} as const

const AutomationsSchema = z.object({
  reminderLeadHours:      z.number().int().min(0).max(72).optional(),
  autoReplyEnabled:       z.boolean().optional(),
  autoReplyIntervalHours: z.number().int().min(1).max(24).optional(),
  autoReplyMessage:       z.string().max(500).nullable().optional(),
  offHoursEnabled:        z.boolean().optional(),
  offHoursMessage:        z.string().max(500).nullable().optional(),
  dailyStatusEnabled:     z.boolean().optional(),
  dailyStatusHour:        z.number().int().min(0).max(23).optional(),
  birthdayEnabled:        z.boolean().optional(),
  birthdayMessage:        z.string().max(300).nullable().optional(),
  birthdayGiftServiceId:  z.string().nullable().optional(),
})

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.settings.view)

    const tenant = await prisma.tenant.findFirst({
      where: { id: session.tenantId },
      select: AUTOMATIONS_SELECT,
    })

    if (!tenant) return Response.json({ error: 'Tenant não encontrado' }, { status: 404 })
    return Response.json(tenant)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.settings.manage)

    const input = await validateInput(request, AutomationsSchema)

    const tenant = await prisma.tenant.update({
      where: { id: session.tenantId },
      data: input,
      select: AUTOMATIONS_SELECT,
    })

    return Response.json(tenant)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/settings/automations/route.ts
git commit -m "feat(settings): adiciona endpoint GET/PUT /api/settings/automations"
```

---

## Task 2: Hook `useAutomations`

**Files:**
- Create: `src/hooks/settings/use-automations.ts`

- [ ] **Step 1: Criar o hook**

Criar `src/hooks/settings/use-automations.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export type AutomationsConfig = {
  reminderLeadHours:      number
  autoReplyEnabled:       boolean
  autoReplyIntervalHours: number
  autoReplyMessage:       string | null
  offHoursEnabled:        boolean
  offHoursMessage:        string | null
  dailyStatusEnabled:     boolean
  dailyStatusHour:        number
  birthdayEnabled:        boolean
  birthdayMessage:        string | null
  birthdayGiftServiceId:  string | null
}

async function fetchAutomations(): Promise<AutomationsConfig> {
  const res = await fetch('/api/settings/automations')
  if (!res.ok) throw new Error('Falha ao carregar automações')
  return res.json()
}

async function updateAutomations(input: Partial<AutomationsConfig>): Promise<AutomationsConfig> {
  const res = await fetch('/api/settings/automations', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Falha ao salvar automações')
  return res.json()
}

export function useAutomations() {
  return useQuery({
    queryKey: ['automations'],
    queryFn: fetchAutomations,
    staleTime: 60_000,
  })
}

export function useUpdateAutomations() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateAutomations,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automations'] }),
  })
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/settings/use-automations.ts
git commit -m "feat(settings): adiciona hook useAutomations"
```

---

## Task 3: Componente `WhatsAppAutomationsForm`

**Files:**
- Create: `src/components/domain/settings/whatsapp-automations-form.tsx`

- [ ] **Step 1: Criar o componente**

Criar `src/components/domain/settings/whatsapp-automations-form.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  useAutomations,
  useUpdateAutomations,
  type AutomationsConfig,
} from '@/hooks/settings/use-automations'
import { useServices } from '@/hooks/scheduling/use-services'

const REMINDER_OPTIONS = [
  { value: 1,  label: '1 hora antes' },
  { value: 2,  label: '2 horas antes' },
  { value: 3,  label: '3 horas antes' },
  { value: 6,  label: '6 horas antes' },
  { value: 12, label: '12 horas antes' },
  { value: 24, label: '24 horas antes (padrão)' },
  { value: 48, label: '48 horas antes' },
]

const INTERVAL_OPTIONS = [
  { value: 1,  label: '1 hora' },
  { value: 2,  label: '2 horas' },
  { value: 3,  label: '3 horas' },
  { value: 6,  label: '6 horas' },
  { value: 12, label: '12 horas' },
  { value: 24, label: '24 horas' },
]

const HOUR_OPTIONS = Array.from({ length: 17 }, (_, i) => i + 7).map(h => ({
  value: h,
  label: `${String(h).padStart(2, '0')}:00`,
}))

export function WhatsAppAutomationsForm() {
  const { data, isLoading } = useAutomations()
  const { data: services = [] } = useServices()
  const { mutate, isPending } = useUpdateAutomations()
  const { toast } = useToast()

  const [form, setForm] = useState<Partial<AutomationsConfig>>({})
  const isDirty = Object.keys(form).length > 0

  useEffect(() => {
    if (data) setForm({})
  }, [data])

  function set<K extends keyof AutomationsConfig>(key: K, value: AutomationsConfig[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function get<K extends keyof AutomationsConfig>(key: K): AutomationsConfig[K] | undefined {
    if (key in form) return (form as AutomationsConfig)[key]
    return data?.[key]
  }

  function handleSave() {
    mutate(form, {
      onSuccess: () => {
        setForm({})
        toast({ title: 'Automações salvas com sucesso.' })
      },
      onError: () =>
        toast({ title: 'Erro ao salvar automações.', variant: 'destructive' }),
    })
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando configurações...</div>
  }

  const activeServices = services.filter(s => s.active)

  return (
    <div className="space-y-8">

      {/* Lembrete de agendamento */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Lembrete de agendamento</h3>
        <p className="text-xs text-muted-foreground">
          Mensagem enviada automaticamente antes do horário marcado do cliente.
        </p>
        <div className="flex items-center gap-3">
          <Label className="text-xs text-muted-foreground">Antecedência do lembrete</Label>
          <Select
            value={String(get('reminderLeadHours') ?? 24)}
            onValueChange={v => set('reminderLeadHours', Number(v))}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REMINDER_OPTIONS.map(o => (
                <SelectItem key={o.value} value={String(o.value)}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      <div className="border-t border-border" />

      {/* Resposta automática */}
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Resposta automática</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Responde automaticamente quando alguém envia mensagem.
              Use <code className="rounded bg-muted px-1">{'{booking_link}'}</code> para incluir o link de agendamento.
            </p>
          </div>
          <Switch
            checked={get('autoReplyEnabled') ?? false}
            onCheckedChange={v => set('autoReplyEnabled', v)}
          />
        </div>
        {(get('autoReplyEnabled') ?? false) && (
          <div className="space-y-3 pl-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Mensagem</Label>
              <Textarea
                value={get('autoReplyMessage') ?? ''}
                onChange={e => set('autoReplyMessage', e.target.value || null)}
                placeholder="Olá! Para agendar, acesse: {booking_link}"
                rows={3}
                maxLength={500}
              />
              <p className="text-[11px] text-muted-foreground text-right">
                {(get('autoReplyMessage') ?? '').length}/500
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">
                Intervalo mínimo entre respostas
              </Label>
              <Select
                value={String(get('autoReplyIntervalHours') ?? 6)}
                onValueChange={v => set('autoReplyIntervalHours', Number(v))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVAL_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </section>

      <div className="border-t border-border" />

      {/* Fora do expediente */}
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Mensagem fora do expediente</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Enviada quando alguém escreve fora do horário de funcionamento configurado.
            </p>
          </div>
          <Switch
            checked={get('offHoursEnabled') ?? false}
            onCheckedChange={v => set('offHoursEnabled', v)}
          />
        </div>
        {(get('offHoursEnabled') ?? false) && (
          <div className="space-y-1.5 pl-1">
            <Label className="text-xs">Mensagem</Label>
            <Textarea
              value={get('offHoursMessage') ?? ''}
              onChange={e => set('offHoursMessage', e.target.value || null)}
              placeholder="Olá! No momento estamos fora do expediente. Retornaremos em breve!"
              rows={3}
              maxLength={500}
            />
          </div>
        )}
      </section>

      <div className="border-t border-border" />

      {/* Parabéns de aniversário */}
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Parabéns de aniversário</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Mensagem enviada no dia do aniversário dos clientes (requer data de nascimento no cadastro e
              consentimento).
            </p>
          </div>
          <Switch
            checked={get('birthdayEnabled') ?? false}
            onCheckedChange={v => set('birthdayEnabled', v)}
          />
        </div>
        {(get('birthdayEnabled') ?? false) && (
          <div className="space-y-3 pl-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Mensagem</Label>
              <Textarea
                value={get('birthdayMessage') ?? ''}
                onChange={e => set('birthdayMessage', e.target.value || null)}
                placeholder="Feliz aniversário! Temos um presente especial para você 🎂"
                rows={3}
                maxLength={300}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Serviço de brinde (opcional)</Label>
              <Select
                value={get('birthdayGiftServiceId') ?? '__none__'}
                onValueChange={v =>
                  set('birthdayGiftServiceId', v === '__none__' ? null : v)
                }
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Sem brinde" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem brinde</SelectItem>
                  {activeServices.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Quando configurado, o nome do serviço de brinde é mencionado na mensagem.
              </p>
            </div>
          </div>
        )}
      </section>

      <div className="border-t border-border" />

      {/* Resumo diário */}
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Resumo diário no WhatsApp</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Receba um resumo dos agendamentos do dia no WhatsApp do negócio.
              Requer <strong>Telefone do negócio</strong> preenchido nas configurações.
            </p>
          </div>
          <Switch
            checked={get('dailyStatusEnabled') ?? false}
            onCheckedChange={v => set('dailyStatusEnabled', v)}
          />
        </div>
        {(get('dailyStatusEnabled') ?? false) && (
          <div className="flex items-center gap-3 pl-1">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">
              Horário de envio
            </Label>
            <Select
              value={String(get('dailyStatusHour') ?? 9)}
              onValueChange={v => set('dailyStatusHour', Number(v))}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOUR_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={String(o.value)}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </section>

      <Button
        onClick={handleSave}
        disabled={!isDirty || isPending}
        className="w-full sm:w-auto"
      >
        {isPending ? 'Salvando...' : 'Salvar automações'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/settings/whatsapp-automations-form.tsx
git commit -m "feat(settings): adiciona componente WhatsAppAutomationsForm"
```

---

## Task 4: Aba "Automações" em Configurações

**Files:**
- Modify: `src/app/(app)/configuracoes/page.tsx`

- [ ] **Step 1: Abrir o arquivo e contar o número atual de colunas do TabsList**

Abrir `src/app/(app)/configuracoes/page.tsx` e localizar a linha com `grid-cols-N` no `TabsList`. Contar os `TabsTrigger` existentes para saber quantas colunas há hoje.

- [ ] **Step 2: Adicionar import do componente**

Adicionar no topo do arquivo, com os outros imports de componentes de settings:

```typescript
import { WhatsAppAutomationsForm } from '@/components/domain/settings/whatsapp-automations-form'
```

- [ ] **Step 3: Adicionar TabsTrigger**

Localizar o bloco `<TabsList>` e adicionar `<TabsTrigger value="automacoes">Automações</TabsTrigger>` após o trigger de "whatsapp". Incrementar o `grid-cols-N` em 1 (ex: `grid-cols-6` → `grid-cols-7`).

- [ ] **Step 4: Adicionar TabsContent**

Após o último `</TabsContent>` existente, adicionar:

```typescript
<TabsContent value="automacoes" className="mt-6">
  <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
    <h2 className="mb-1 text-base font-semibold text-foreground">Automações WhatsApp</h2>
    <p className="mb-6 text-sm text-muted-foreground">
      Configure mensagens automáticas enviadas pelo WhatsApp do seu negócio.
      Requer WhatsApp conectado em Configurações → WhatsApp.
    </p>
    <WhatsAppAutomationsForm />
  </div>
</TabsContent>
```

- [ ] **Step 5: Verificar tipos e contagem de colunas**

```bash
npx tsc --noEmit
```

Confirmar visualmente que o número de `TabsTrigger` bate com o `grid-cols-N`.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/configuracoes/page.tsx
git commit -m "feat(configuracoes): adiciona aba Automações com WhatsAppAutomationsForm"
```

---

## Task 5: Schema — `WhatsAppAutoReplyLog` + env `EVOLUTION_WEBHOOK_SECRET`

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/shared/config/env.ts`

- [ ] **Step 1: Adicionar model ao schema**

Abrir `prisma/schema.prisma`. Adicionar após o model `NotificationLog`:

```prisma
model WhatsAppAutoReplyLog {
  id        String   @id @default(cuid())
  tenantId  String
  phone     String
  intent    String
  repliedAt DateTime @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, phone, repliedAt])
}
```

Adicionar a relação no model `Tenant` (dentro do bloco de relações existente):

```prisma
  autoReplyLogs        WhatsAppAutoReplyLog[]
```

- [ ] **Step 2: Criar migration**

```bash
npx prisma migrate dev --name add_whatsapp_autoreply_log
```

Esperado: arquivo de migration criado em `prisma/migrations/` e Prisma Client regenerado.

- [ ] **Step 3: Adicionar variável de ambiente ao env.ts**

Abrir `src/shared/config/env.ts`. No `envSchema`, adicionar após `EVOLUTION_API_KEY`:

```typescript
EVOLUTION_WEBHOOK_SECRET: z.string().min(1).optional(),
```

- [ ] **Step 4: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ src/shared/config/env.ts
git commit -m "feat(whatsapp): schema WhatsAppAutoReplyLog + EVOLUTION_WEBHOOK_SECRET no env"
```

---

## Task 6: Intent Classifier (TDD)

**Files:**
- Create: `src/domains/notifications/chatbot/intent-classifier.test.ts`
- Create: `src/domains/notifications/chatbot/intent-classifier.ts`

- [ ] **Step 1: Criar o arquivo de testes**

Criar `src/domains/notifications/chatbot/intent-classifier.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { classifyIntent } from './intent-classifier'

describe('classifyIntent', () => {
  it('detecta BOOK para "quero agendar"', () => {
    expect(classifyIntent('quero agendar um horário')).toBe('BOOK')
  })
  it('detecta BOOK para "marcar horário" case-insensitive', () => {
    expect(classifyIntent('Quero Marcar um Horário')).toBe('BOOK')
  })
  it('detecta BOOK para "reservar"', () => {
    expect(classifyIntent('gostaria de reservar')).toBe('BOOK')
  })
  it('detecta CANCEL para "cancelar"', () => {
    expect(classifyIntent('preciso cancelar meu horário')).toBe('CANCEL')
  })
  it('detecta CANCEL para "não vou" normalizado', () => {
    expect(classifyIntent('não vou conseguir ir')).toBe('CANCEL')
  })
  it('detecta CANCEL para "nao vou" sem acento', () => {
    expect(classifyIntent('nao vou conseguir ir')).toBe('CANCEL')
  })
  it('detecta PRICE para "quanto custa"', () => {
    expect(classifyIntent('quanto custa um corte?')).toBe('PRICE')
  })
  it('detecta PRICE para "tabela"', () => {
    expect(classifyIntent('me manda a tabela')).toBe('PRICE')
  })
  it('detecta HOURS para "que horas abre"', () => {
    expect(classifyIntent('que horas abre hoje?')).toBe('HOURS')
  })
  it('detecta HOURS para "horário de funcionamento"', () => {
    expect(classifyIntent('qual o horário de funcionamento?')).toBe('HOURS')
  })
  it('retorna FALLBACK para mensagem sem intenção reconhecida', () => {
    expect(classifyIntent('oi tudo bem?')).toBe('FALLBACK')
  })
  it('retorna FALLBACK para texto vazio', () => {
    expect(classifyIntent('')).toBe('FALLBACK')
  })
})
```

- [ ] **Step 2: Rodar o teste — deve falhar**

```bash
npx vitest run src/domains/notifications/chatbot/intent-classifier.test.ts
```

Esperado: FAIL — "Cannot find module './intent-classifier'"

- [ ] **Step 3: Criar a implementação**

Criar `src/domains/notifications/chatbot/intent-classifier.ts`:

```typescript
export type Intent = 'BOOK' | 'CANCEL' | 'PRICE' | 'HOURS' | 'FALLBACK'

const PATTERNS: Record<Exclude<Intent, 'FALLBACK'>, RegExp> = {
  BOOK:   /\b(agendar|marcar|horario|quero agendar|quero marcar|reservar)\b/i,
  CANCEL: /\b(cancelar|desmarcar|cancela|cancelo|nao vou|nao consigo)\b/i,
  PRICE:  /\b(preco|valor|quanto custa|tabela|valores|cobranca|cobram)\b/i,
  HOURS:  /\b(horario de funcionamento|que horas|abre|fecha|funcionamento)\b/i,
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export function classifyIntent(text: string): Intent {
  const normalized = normalize(text)
  for (const [intent, regex] of Object.entries(PATTERNS) as [Exclude<Intent, 'FALLBACK'>, RegExp][]) {
    if (regex.test(normalized)) return intent
  }
  return 'FALLBACK'
}
```

- [ ] **Step 4: Rodar os testes — devem passar**

```bash
npx vitest run src/domains/notifications/chatbot/intent-classifier.test.ts
```

Esperado: todos os 12 testes passando.

- [ ] **Step 5: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 6: Commit**

```bash
git add src/domains/notifications/chatbot/
git commit -m "feat(chatbot): intent-classifier com TDD (BOOK/CANCEL/PRICE/HOURS/FALLBACK)"
```

---

## Task 7: Webhook Handler de Mensagens Inbound

**Files:**
- Create: `src/app/api/webhooks/evolution/messages/route.ts`

- [ ] **Step 1: Criar o handler**

Criar `src/app/api/webhooks/evolution/messages/route.ts`:

```typescript
import { createHmac } from 'crypto'
import { prisma } from '@/shared/database/prisma'
import { env } from '@/shared/config/env'
import { classifyIntent } from '@/domains/notifications/chatbot/intent-classifier'
import { evolutionProvider } from '@/domains/notifications/providers/evolution.provider'

type EvolutionMessageEvent = {
  event: string
  instance: string
  data: {
    key: {
      remoteJid: string
      fromMe: boolean
      id: string
    }
    message?: {
      conversation?: string
      extendedTextMessage?: { text: string }
    }
    messageType?: string
  }
}

type BusinessHoursEntry = { open: string; close: string; enabled: boolean }
type BusinessHours = Record<string, BusinessHoursEntry>

function extractText(event: EvolutionMessageEvent): string | null {
  const msg = event.data.message
  if (!msg) return null
  return msg.conversation ?? msg.extendedTextMessage?.text ?? null
}

function isWithinBusinessHours(businessHours: BusinessHours | null, timezone: string): boolean {
  if (!businessHours) return true

  const now = new Date()
  const dayKey = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: timezone })
    .format(now)
    .toLowerCase()

  const todayHours = businessHours[dayKey]
  if (!todayHours?.enabled) return false

  const timeStr = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(now)

  return timeStr >= todayHours.open && timeStr < todayHours.close
}

async function parseBody(request: Request): Promise<EvolutionMessageEvent | null> {
  if (env.EVOLUTION_WEBHOOK_SECRET) {
    const signature = request.headers.get('x-evolution-signature') ?? ''
    const body = await request.text()
    const expected = createHmac('sha256', env.EVOLUTION_WEBHOOK_SECRET).update(body).digest('hex')
    if (signature !== expected) return null
    try {
      return JSON.parse(body) as EvolutionMessageEvent
    } catch {
      return null
    }
  }
  try {
    return (await request.json()) as EvolutionMessageEvent
  } catch {
    return null
  }
}

export async function POST(request: Request): Promise<Response> {
  const event = await parseBody(request)
  if (!event) return new Response(null, { status: 401 })

  if (event.event !== 'messages.upsert') return new Response(null, { status: 200 })
  if (event.data.key.fromMe) return new Response(null, { status: 200 })

  const text = extractText(event)
  if (!text) return new Response(null, { status: 200 })

  const tenant = await prisma.tenant.findFirst({
    where: { evolutionInstanceId: event.instance, evolutionConnected: true },
    select: {
      id: true,
      slug: true,
      timezone: true,
      businessHours: true,
      autoReplyEnabled: true,
      autoReplyIntervalHours: true,
      autoReplyMessage: true,
      offHoursEnabled: true,
      offHoursMessage: true,
      evolutionInstanceId: true,
    },
  })

  if (!tenant || !tenant.autoReplyEnabled) return new Response(null, { status: 200 })

  const phone = event.data.key.remoteJid.replace('@s.whatsapp.net', '')
  const instanceName = tenant.evolutionInstanceId!

  const businessHours = tenant.businessHours as BusinessHours | null
  const withinHours = isWithinBusinessHours(businessHours, tenant.timezone)

  if (!withinHours) {
    if (tenant.offHoursEnabled && tenant.offHoursMessage) {
      await evolutionProvider.sendRawText(instanceName, phone, tenant.offHoursMessage).catch(() => {})
    }
    return new Response(null, { status: 200 })
  }

  const cutoff = new Date(Date.now() - tenant.autoReplyIntervalHours * 3_600_000)
  const recentLog = await prisma.whatsAppAutoReplyLog.findFirst({
    where: { tenantId: tenant.id, phone, repliedAt: { gte: cutoff } },
  })
  if (recentLog) return new Response(null, { status: 200 })

  const intent = classifyIntent(text)
  const bookingLink = `${env.NEXT_PUBLIC_APP_URL ?? ''}/agendar/${tenant.slug}`

  let response: string | null = null

  if (intent === 'BOOK' || intent === 'FALLBACK') {
    const msg = tenant.autoReplyMessage ?? 'Olá! Para agendar seu horário, acesse: {booking_link}'
    response = msg.replace('{booking_link}', bookingLink)
  }

  if (intent === 'CANCEL') {
    response = `Para cancelar seu agendamento acesse: ${bookingLink} ou ligue para o salão.`
  }

  if (intent === 'PRICE') {
    const svcs = await prisma.service.findMany({
      where: { tenantId: tenant.id, active: true },
      select: { name: true, price: true, priceType: true },
      orderBy: { name: 'asc' },
      take: 10,
    })
    const lines = svcs.map(s =>
      s.priceType === 'ON_CONSULTATION'
        ? `• ${s.name}: Sob consulta`
        : `• ${s.name}: R$ ${Number(s.price).toFixed(2).replace('.', ',')}`
    )
    response = lines.length > 0
      ? `Nossos serviços:\n${lines.join('\n')}`
      : 'Entre em contato para conhecer nossos serviços.'
  }

  if (intent === 'HOURS') {
    if (!businessHours) {
      response = 'Entre em contato para saber nosso horário de funcionamento.'
    } else {
      const dayNames: Record<string, string> = {
        sun: 'Dom', mon: 'Seg', tue: 'Ter', wed: 'Qua',
        thu: 'Qui', fri: 'Sex', sat: 'Sáb',
      }
      const lines = Object.entries(businessHours)
        .filter(([, v]) => v.enabled)
        .map(([k, v]) => `${dayNames[k] ?? k}: ${v.open}–${v.close}`)
      response = lines.length > 0
        ? `Nosso horário de funcionamento:\n${lines.join('\n')}`
        : 'Entre em contato para saber nosso horário.'
    }
  }

  if (!response) return new Response(null, { status: 200 })

  await evolutionProvider.sendRawText(instanceName, phone, response).catch(() => {})

  await prisma.whatsAppAutoReplyLog.create({
    data: { tenantId: tenant.id, phone, intent },
  })

  return new Response(null, { status: 200 })
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Se aparecer erro sobre `sendRawText` não existir, execute a Task 8 primeiro e retorne aqui.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/webhooks/evolution/messages/route.ts
git commit -m "feat(chatbot): webhook handler de mensagens inbound com intent routing"
```

---

## Task 8: `sendRawText` + `configureMessagesWebhook` no Evolution Provider

**Files:**
- Modify: `src/domains/notifications/providers/evolution.provider.ts`
- Modify: `src/app/api/whatsapp/evolution/connect/route.ts`

- [ ] **Step 1: Abrir evolution.provider.ts e localizar a classe `EvolutionProvider`**

Localizar o método `configureWebhook` existente. Adicionar logo após ele dois novos métodos:

```typescript
async configureMessagesWebhook(instanceName: string, webhookUrl: string): Promise<void> {
  await fetch(`${this.baseUrl}/webhook/set/${instanceName}`, {
    method: 'POST',
    headers: this.headers(),
    body: JSON.stringify({
      url: webhookUrl,
      webhook_by_events: false,
      webhook_base64: false,
      events: ['MESSAGES_UPSERT'],
    }),
  })
}

async sendRawText(instanceName: string, phone: string, text: string): Promise<void> {
  let number: string
  try {
    number = toE164Number(phone)
  } catch {
    return
  }
  await fetch(`${this.baseUrl}/message/sendText/${instanceName}`, {
    method: 'POST',
    headers: this.headers(),
    body: JSON.stringify({ number, text }),
  }).catch(() => {})
}
```

> **Nota:** `toE164Number` já existe neste arquivo — não reimportar nem redefinir.

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 3: Atualizar connect/route.ts para registrar webhook de mensagens**

Abrir `src/app/api/whatsapp/evolution/connect/route.ts`. Após a linha que configura o webhook de conexão (buscar por "configureWebhook"), adicionar:

```typescript
// Configura webhook para mensagens inbound (chatbot)
const messagesWebhookUrl = `${process.env.APP_URL}/api/webhooks/evolution/messages`
await evolutionProvider.configureMessagesWebhook(instanceName, messagesWebhookUrl).catch((err: unknown) => {
  console.warn('[Evolution] Falha ao configurar webhook de mensagens:', err instanceof Error ? err.message : 'erro desconhecido')
})
```

- [ ] **Step 4: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 5: Commit**

```bash
git add src/domains/notifications/providers/evolution.provider.ts
git add src/app/api/whatsapp/evolution/connect/route.ts
git commit -m "feat(evolution): sendRawText + configureMessagesWebhook + registro no connect"
```

---

## Task 9: Fix Birthday Job (C4)

**Files:**
- Modify: `src/shared/queue/jobs/birthday-reminder.ts`

- [ ] **Step 1: Substituir o conteúdo completo do arquivo**

Abrir `src/shared/queue/jobs/birthday-reminder.ts` e substituir todo o conteúdo:

```typescript
import type { PgBoss, Job } from 'pg-boss'
import { prisma } from '@/shared/database/prisma'
import { NotificationChannel } from '@prisma/client'

export const BIRTHDAY_REMINDER_JOB = 'birthday-reminder'

export async function handleBirthdayReminder(_jobs: Job<Record<string, never>>[]): Promise<void> {
  const now = new Date()
  const month = now.getMonth() + 1
  const day = now.getDate()

  const customers = await prisma.$queryRaw<
    { id: string; tenantId: string; name: string; phone: string; birthdayMessage: string | null }[]
  >`
    SELECT c.id, c."tenantId", c.name, c.phone, t."birthdayMessage"
    FROM "Customer" c
    INNER JOIN "Tenant" t ON t.id = c."tenantId"
    WHERE c."birthDate" IS NOT NULL
      AND EXTRACT(MONTH FROM c."birthDate") = ${month}
      AND EXTRACT(DAY FROM c."birthDate") = ${day}
      AND c."consentGiven" = true
      AND c.phone IS NOT NULL
      AND t."birthdayEnabled" = true
      AND t."evolutionConnected" = true
  `

  if (customers.length === 0) return

  const { notificationService } = await import('@/domains/notifications/notification.service')

  for (const customer of customers) {
    await notificationService.logAndDispatch({
      tenantId: customer.tenantId,
      customerId: customer.id,
      channel: NotificationChannel.WHATSAPP,
      template: 'birthday',
      recipient: customer.phone,
      provider: 'evolution',
      payload: {
        customerName: customer.name,
        ...(customer.birthdayMessage ? { customMessage: customer.birthdayMessage } : {}),
      },
    })
  }
}

export async function registerBirthdayReminder(boss: PgBoss): Promise<void> {
  await boss.schedule(BIRTHDAY_REMINDER_JOB, '0 12 * * *', {})
  boss.work(BIRTHDAY_REMINDER_JOB, handleBirthdayReminder)
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/shared/queue/jobs/birthday-reminder.ts
git commit -m "fix(birthday): respeita birthdayEnabled e usa birthdayMessage do tenant"
```

---

## Task 10: Daily Status Job (C5)

**Files:**
- Create: `src/shared/queue/jobs/daily-status.ts`

- [ ] **Step 1: Criar o job**

Criar `src/shared/queue/jobs/daily-status.ts`:

```typescript
import type { PgBoss, Job } from 'pg-boss'
import { prisma } from '@/shared/database/prisma'

export const DAILY_STATUS_JOB = 'daily-status'

export async function handleDailyStatus(_jobs: Job<Record<string, never>>[]): Promise<void> {
  const now = new Date()

  const tenants = await prisma.tenant.findMany({
    where: {
      dailyStatusEnabled: true,
      evolutionConnected: true,
      phone: { not: null },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      dailyStatusHour: true,
      timezone: true,
      evolutionInstanceId: true,
    },
  })

  for (const tenant of tenants) {
    if (!tenant.evolutionInstanceId || !tenant.phone) continue

    // Verificar se a hora local do tenant bate com dailyStatusHour
    const localHour = parseInt(
      new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone: tenant.timezone,
      }).format(now),
      10,
    )
    if (localHour !== tenant.dailyStatusHour) continue

    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(now)
    todayEnd.setHours(23, 59, 59, 999)

    const [total, confirmed, scheduled] = await Promise.all([
      prisma.appointment.count({
        where: { tenantId: tenant.id, startsAt: { gte: todayStart, lte: todayEnd } },
      }),
      prisma.appointment.count({
        where: {
          tenantId: tenant.id,
          startsAt: { gte: todayStart, lte: todayEnd },
          status: 'CONFIRMED',
        },
      }),
      prisma.appointment.count({
        where: {
          tenantId: tenant.id,
          startsAt: { gte: todayStart, lte: todayEnd },
          status: 'SCHEDULED',
        },
      }),
    ])

    const dateStr = new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      timeZone: tenant.timezone,
    }).format(now)

    const message = [
      `📅 *Resumo do dia — ${dateStr}*`,
      '',
      `Total de agendamentos: *${total}*`,
      `✅ Confirmados: ${confirmed}`,
      `⏳ Aguardando confirmação: ${scheduled}`,
    ].join('\n')

    const { evolutionProvider } = await import(
      '@/domains/notifications/providers/evolution.provider'
    )
    await evolutionProvider
      .sendRawText(tenant.evolutionInstanceId, tenant.phone, message)
      .catch(() => {})
  }
}

export async function registerDailyStatusJob(boss: PgBoss): Promise<void> {
  // Roda a cada hora — filtra internamente pelo dailyStatusHour do tenant
  await boss.schedule(DAILY_STATUS_JOB, '0 * * * *', {})
  boss.work(DAILY_STATUS_JOB, handleDailyStatus)
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/shared/queue/jobs/daily-status.ts
git commit -m "feat(jobs): adiciona daily-status job (C5)"
```

---

## Task 11: Subscription Expiry Warning Job (C6)

**Files:**
- Create: `src/shared/queue/jobs/subscription-expiry-warnings.ts`

- [ ] **Step 1: Criar o job**

Criar `src/shared/queue/jobs/subscription-expiry-warnings.ts`:

```typescript
import type { PgBoss, Job } from 'pg-boss'
import { prisma } from '@/shared/database/prisma'
import { NotificationChannel } from '@prisma/client'

export const SUBSCRIPTION_EXPIRY_WARNINGS_JOB = 'subscription:expiry-warnings'

export async function handleSubscriptionExpiryWarnings(
  _jobs: Job<Record<string, never>>[],
): Promise<void> {
  const now = new Date()

  // Buscar subscriptions em trial
  const trialSubs = await prisma.subscription.findMany({
    where: {
      status: 'TRIALING',
      trialEndsAt: { not: null },
    },
    select: {
      tenantId: true,
      trialEndsAt: true,
      tenant: {
        select: {
          name: true,
          evolutionConnected: true,
          evolutionInstanceId: true,
          users: {
            where: { role: 'OWNER' },
            select: { id: true },
            take: 1,
          },
          customers: {
            where: { role: { equals: undefined } },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  })

  // Buscar owner e seu telefone via Customer (owners podem ser cadastrados como clientes do próprio negócio)
  // ou via Tenant.phone
  const pastDueSubs = await prisma.subscription.findMany({
    where: { status: 'PAST_DUE' },
    select: {
      tenantId: true,
      tenant: {
        select: {
          phone: true,
          evolutionConnected: true,
          evolutionInstanceId: true,
        },
      },
    },
  })

  const { notificationService } = await import('@/domains/notifications/notification.service')

  // Processar trials
  for (const sub of trialSubs) {
    if (!sub.trialEndsAt || !sub.tenant.evolutionConnected || !sub.tenant.evolutionInstanceId) continue

    const daysLeft = Math.ceil(
      (sub.trialEndsAt.getTime() - now.getTime()) / 86_400_000,
    )

    // Avisa em: 3 dias, 1 dia e no dia do vencimento (0 dias)
    if (daysLeft !== 3 && daysLeft !== 1 && daysLeft !== 0) continue

    // Buscar Owner para obter phone via Customer lookup
    const ownerUser = sub.tenant.users[0]
    if (!ownerUser) continue

    const ownerCustomer = await prisma.customer.findFirst({
      where: {
        tenantId: sub.tenantId,
        // Encontrar o cliente com mesmo email do owner
        email: {
          in: await prisma.user
            .findMany({ where: { id: ownerUser.id }, select: { email: true } })
            .then(users => users.map(u => u.email)),
        },
      },
      select: { id: true, phone: true, name: true },
    })

    if (!ownerCustomer?.phone) continue

    const templateMessage = daysLeft === 0
      ? 'Seu trial encerrou hoje. Ative seu plano para continuar usando todos os recursos.'
      : daysLeft === 1
        ? 'Seu trial encerra amanhã! Ative seu plano para não perder o acesso.'
        : `Seu trial encerra em ${daysLeft} dias. Ative seu plano para continuar.'`

    await notificationService.logAndDispatch({
      tenantId: sub.tenantId,
      customerId: ownerCustomer.id,
      channel: NotificationChannel.WHATSAPP,
      template: 'subscription-warning',
      recipient: ownerCustomer.phone,
      provider: 'evolution',
      payload: {
        customerName: ownerCustomer.name,
        message: `${sub.tenant.name} — ${templateMessage}`,
        daysLeft,
      },
    })
  }

  // Processar PAST_DUE
  for (const sub of pastDueSubs) {
    if (!sub.tenant.evolutionConnected || !sub.tenant.phone) continue

    const { evolutionProvider } = await import(
      '@/domains/notifications/providers/evolution.provider'
    )
    await evolutionProvider
      .sendRawText(
        sub.tenant.evolutionInstanceId ?? '',
        sub.tenant.phone,
        `${sub.tenantId} — Pagamento pendente. Atualize seu cartão para evitar a suspensão do serviço.`,
      )
      .catch(() => {})
  }
}

export async function registerSubscriptionExpiryWarnings(boss: PgBoss): Promise<void> {
  // Roda todo dia às 9h UTC (12h Brasil)
  await boss.schedule(SUBSCRIPTION_EXPIRY_WARNINGS_JOB, '0 12 * * *', {})
  boss.work(SUBSCRIPTION_EXPIRY_WARNINGS_JOB, handleSubscriptionExpiryWarnings)
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: zero erros. Se houver erros de tipo no `Subscription.status`, verificar os valores do enum `SubscriptionStatus` no schema.

- [ ] **Step 3: Commit**

```bash
git add src/shared/queue/jobs/subscription-expiry-warnings.ts
git commit -m "feat(jobs): adiciona subscription-expiry-warnings job (C6)"
```

---

## Task 12: Registrar novos jobs no runtime

**Files:**
- Modify: `src/app/api/_lib/runtime.ts`

- [ ] **Step 1: Adicionar imports**

Abrir `src/app/api/_lib/runtime.ts` e adicionar os imports após os existentes:

```typescript
import { registerDailyStatusJob } from '@/shared/queue/jobs/daily-status'
import { registerSubscriptionExpiryWarnings } from '@/shared/queue/jobs/subscription-expiry-warnings'
```

- [ ] **Step 2: Registrar os jobs no bloco `startPgBoss().then`**

Localizar o bloco `.then(async (boss) => { ... })` e adicionar as chamadas de registro após as existentes:

```typescript
await registerDailyStatusJob(boss)
await registerSubscriptionExpiryWarnings(boss)
```

- [ ] **Step 3: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 4: Rodar todos os testes**

```bash
npx vitest run
```

Esperado: todos os testes passando (incluindo os novos do intent-classifier).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/_lib/runtime.ts
git commit -m "feat(runtime): registra daily-status e subscription-expiry-warnings jobs"
```

---

## Verificação Final

- [ ] **Type check completo**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Testes**

```bash
npx vitest run
```

Esperado: todos os testes passando.

- [ ] **Checklist de aceite manual**

1. Aba "Automações" aparece em Configurações
2. Cada seção salva individualmente sem sobrescrever outros campos
3. Aba "Antecedência do lembrete" reflete o valor salvo após refresh
4. Toggle Resposta Automática habilita/desabilita o campo de mensagem
5. `{booking_link}` é mostrado como instrução no placeholder
6. Toggle Aniversário exibe o select de serviço de brinde com serviços ativos
7. Webhook `/api/webhooks/evolution/messages` retorna 200 para payload válido
8. Intenção `BOOK` resulta em mensagem com o link de agendamento
9. Anti-spam: segunda mensagem dentro do intervalo configurado não gera resposta

- [ ] **Abrir PR**

```bash
git checkout -b feat/track-c-whatsapp-automation
git push origin feat/track-c-whatsapp-automation
gh pr create \
  --title "feat(whatsapp): Track C — suíte de automações WhatsApp" \
  --body "$(cat <<'EOF'
## Resumo

- **C2 — UI de Automações:** nova aba em Configurações com 5 seções: lembrete, resposta automática, fora do expediente, aniversário e status diário
- **C3 — Chatbot Inbound:** webhook `/api/webhooks/evolution/messages` com intent classifier (BOOK/CANCEL/PRICE/HOURS/FALLBACK), anti-spam por interval e respostas dinâmicas
- **C4 — Fix Birthday:** job agora respeita `birthdayEnabled` e usa `birthdayMessage` do tenant
- **C5 — Daily Status:** job cron por hora que filtra por `dailyStatusHour` do tenant e envia resumo de agendamentos
- **C6 — Subscription Warnings:** avisos de trial (3d, 1d, 0d) e PAST_DUE via WhatsApp

## Checklist

- [ ] Aba Automações funcional com save/load
- [ ] Webhook inbound testado com payload Evolution
- [ ] Intent classifier com 12 testes passando
- [ ] Birthday job corrigido
- [ ] Daily status job registrado
- [ ] Subscription warnings job registrado
- [ ] `npx tsc --noEmit` zero erros
- [ ] `npx vitest run` todos passando
EOF
)"
```
