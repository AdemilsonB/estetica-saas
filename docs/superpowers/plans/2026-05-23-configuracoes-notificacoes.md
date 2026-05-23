# Configurações + Notificações WhatsApp — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar página `/configuracoes` com 3 abas (Negócio, Serviços, WhatsApp) e integrar envio real de notificação de confirmação via Z-API.

**Architecture:** Migration aditiva no Tenant; novos endpoints REST seguindo o padrão já existente (controller thin → service → repository → Prisma); frontend com hooks TanStack Query + componentes Shadcn UI; WhatsApp provider substituído por implementação Z-API real.

**Tech Stack:** Next.js 15 App Router, Prisma, Supabase Auth, TanStack Query v5, Shadcn UI / Tailwind, Zod, Z-API

**Branch:** Criar `feat/configuracoes-notificacoes` a partir de `main` antes de iniciar qualquer task.

```bash
git checkout main && git pull origin main
git checkout -b feat/configuracoes-notificacoes
```

---

## Mapa de arquivos

| Arquivo | Ação |
|---------|------|
| `prisma/schema.prisma` | Modificar — adicionar campos ao Tenant |
| `src/shared/auth/permissions.ts` | Modificar — adicionar settings:view/manage |
| `src/domains/iam/iam.repository.ts` | Modificar — findTenant, updateTenant |
| `src/domains/iam/iam.service.ts` | Modificar — getTenant, updateTenant |
| `src/app/api/iam/tenant/route.ts` | Criar — GET + PATCH |
| `src/domains/scheduling/service.repository.ts` | Modificar — update, deactivate |
| `src/domains/scheduling/scheduling.service.ts` | Modificar — updateService, deactivateService |
| `src/domains/scheduling/types.ts` | Modificar — updateServiceSchema |
| `src/app/api/scheduling/services/[id]/route.ts` | Criar — PATCH + DELETE |
| `src/domains/notifications/providers/whatsapp.provider.ts` | Modificar — implementar Z-API real |
| `src/domains/notifications/notification.service.ts` | Modificar — buscar credenciais do tenant |
| `src/app/api/notifications/settings/route.ts` | Criar — GET + PATCH |
| `src/hooks/settings/use-tenant-settings.ts` | Criar |
| `src/hooks/scheduling/use-services.ts` | Modificar — add useCreateService, useUpdateService, useDeactivateService |
| `src/hooks/settings/use-notification-settings.ts` | Criar |
| `src/components/domain/settings/business-info-form.tsx` | Criar |
| `src/components/domain/settings/service-catalog.tsx` | Criar |
| `src/components/domain/settings/service-form-modal.tsx` | Criar |
| `src/components/domain/settings/whatsapp-settings-form.tsx` | Criar |
| `src/app/(app)/configuracoes/page.tsx` | Criar |

---

### Task 1: Migration — campos novos no Tenant

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Adicionar campos ao model Tenant no schema**

Em `prisma/schema.prisma`, dentro do `model Tenant { ... }`, adicionar após `brandingConfig Json?`:

```prisma
  phone             String?
  address           String?
  zApiInstanceId    String?
  zApiToken         String?
  whatsappEnabled   Boolean           @default(false)
```

- [ ] **Step 2: Rodar a migration**

```bash
npx prisma migrate dev --name add_tenant_settings
```

Esperado: mensagem `The following migration(s) have been applied` sem erros.

- [ ] **Step 3: Verificar que o Prisma client foi regenerado**

```bash
npx prisma generate
```

- [ ] **Step 4: Verificar TypeScript limpo**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "chore(db): adiciona campos de configuracao e zapi ao model Tenant"
```

---

### Task 2: Permissões — settings:view e settings:manage

**Files:**
- Modify: `src/shared/auth/permissions.ts`

- [ ] **Step 1: Adicionar grupo settings ao PERMISSIONS**

Em `src/shared/auth/permissions.ts`, adicionar após o grupo `services`:

```typescript
  settings: {
    view: "settings:view",
    manage: "settings:manage",
  },
```

- [ ] **Step 2: Adicionar settings ao ROLE_PERMISSIONS**

No array de OWNER, o spread já pega tudo automaticamente (usa `Object.values(PERMISSIONS).flatMap`), então nada muda para OWNER.

Para MANAGER, adicionar ao array:

```typescript
    PERMISSIONS.settings.view,
    PERMISSIONS.settings.manage,
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/shared/auth/permissions.ts
git commit -m "feat(iam): adiciona permissoes settings:view e settings:manage"
```

---

### Task 3: IAM backend — GET e PATCH /api/iam/tenant

**Files:**
- Modify: `src/domains/iam/iam.repository.ts`
- Modify: `src/domains/iam/iam.service.ts`
- Create: `src/app/api/iam/tenant/route.ts`

- [ ] **Step 1: Adicionar findTenant e updateTenant ao repository**

Em `src/domains/iam/iam.repository.ts`, adicionar os métodos:

```typescript
  async findTenant(tenantId: string) {
    return prisma.tenant.findFirst({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        phone: true,
        address: true,
      },
    });
  }

  async updateTenant(
    tenantId: string,
    data: { name?: string; phone?: string | null; address?: string | null },
  ) {
    return prisma.tenant.update({
      where: { id: tenantId },
      data,
      select: {
        id: true,
        name: true,
        slug: true,
        phone: true,
        address: true,
      },
    });
  }
```

- [ ] **Step 2: Adicionar getTenant e updateTenant ao service**

Em `src/domains/iam/iam.service.ts`, importar o schema Zod necessário (será definido na API route) e adicionar:

```typescript
  async getTenant(tenantId: string) {
    const tenant = await this.repo.findTenant(tenantId);
    if (!tenant) throw new NotFoundError("Tenant nao encontrado.");
    return tenant;
  }

  async updateTenant(
    tenantId: string,
    data: { name?: string; phone?: string | null; address?: string | null },
  ) {
    return this.repo.updateTenant(tenantId, data);
  }
```

Certifique-se de que `NotFoundError` está importado de `@/shared/errors`.

- [ ] **Step 3: Criar a API route**

Criar `src/app/api/iam/tenant/route.ts`:

```typescript
import { z } from "zod";

import { iamService } from "@/domains/iam/iam.service";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";

const updateTenantSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  address: z.string().trim().max(200).nullable().optional(),
});

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.view);
    const tenant = await iamService.getTenant(session.tenantId);
    return Response.json(tenant);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.manage);
    const input = await validateInput(request, updateTenantSchema);
    const tenant = await iamService.updateTenant(session.tenantId, input);
    return Response.json(tenant);
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/domains/iam/iam.repository.ts src/domains/iam/iam.service.ts src/app/api/iam/tenant/route.ts
git commit -m "feat(iam): adiciona GET e PATCH /api/iam/tenant para configuracoes do negocio"
```

---

### Task 4: Scheduling backend — PATCH e DELETE /api/scheduling/services/[id]

**Files:**
- Modify: `src/domains/scheduling/service.repository.ts`
- Modify: `src/domains/scheduling/scheduling.service.ts`
- Modify: `src/domains/scheduling/types.ts`
- Create: `src/app/api/scheduling/services/[id]/route.ts`

- [ ] **Step 1: Adicionar update e deactivate ao repository**

Em `src/domains/scheduling/service.repository.ts`, adicionar:

```typescript
  async update(
    tenantId: string,
    serviceId: string,
    data: { name?: string; duration?: number; price?: number },
  ) {
    return prisma.service.update({
      where: { id: serviceId, tenantId },
      data,
    });
  }

  async deactivate(tenantId: string, serviceId: string) {
    return prisma.service.update({
      where: { id: serviceId, tenantId },
      data: { active: false },
    });
  }
```

- [ ] **Step 2: Adicionar schema e métodos ao service**

Em `src/domains/scheduling/types.ts`, adicionar:

```typescript
export const updateServiceSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  duration: z.number().int().min(5).max(480).optional(),
  price: z.number().positive().optional(),
});

export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
```

Em `src/domains/scheduling/scheduling.service.ts`, adicionar:

```typescript
  async updateService(tenantId: string, serviceId: string, input: UpdateServiceInput) {
    const existing = await catalogServiceRepository.findById(tenantId, serviceId);
    if (!existing) throw new NotFoundError("Servico nao encontrado.");
    return catalogServiceRepository.update(tenantId, serviceId, input);
  }

  async deactivateService(tenantId: string, serviceId: string) {
    const existing = await catalogServiceRepository.findById(tenantId, serviceId);
    if (!existing) throw new NotFoundError("Servico nao encontrado.");
    return catalogServiceRepository.deactivate(tenantId, serviceId);
  }
```

Certifique-se de que `NotFoundError` e `UpdateServiceInput` estão importados.

- [ ] **Step 3: Criar a API route**

Criar `src/app/api/scheduling/services/[id]/route.ts`:

```typescript
import { updateServiceSchema } from "@/domains/scheduling/types";
import { schedulingService } from "@/domains/scheduling/scheduling.service";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.services.manage);
    const { id } = await params;
    const input = await validateInput(request, updateServiceSchema);
    const service = await schedulingService.updateService(session.tenantId, id, input);
    return Response.json(service);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.services.manage);
    const { id } = await params;
    await schedulingService.deactivateService(session.tenantId, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/domains/scheduling/ src/app/api/scheduling/services/
git commit -m "feat(scheduling): adiciona update e deactivate de servicos com PATCH/DELETE"
```

---

### Task 5: Notifications backend — Z-API provider + settings API

**Files:**
- Modify: `src/domains/notifications/providers/whatsapp.provider.ts`
- Create: `src/app/api/notifications/settings/route.ts`

- [ ] **Step 1: Implementar o WhatsApp provider com Z-API**

Substituir o conteúdo de `src/domains/notifications/providers/whatsapp.provider.ts`:

```typescript
import { NotificationStatus } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";

import type { NotificationDeliveryResult, NotificationDraft } from "../types";

const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN ?? "";

function formatPhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

function buildMessage(template: string, payload: Record<string, unknown>): string {
  if (template === "appointment-created") {
    const date = new Date(payload.startsAt as string);
    const formatted = date.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    return (
      `Olá, ${payload.customerName}! 👋\n` +
      `Seu agendamento foi confirmado:\n` +
      `📅 ${formatted}\n` +
      `✂️ ${payload.serviceName}\n` +
      `Até lá!`
    );
  }
  return `Olá, ${payload.customerName}! Sua notificação foi enviada.`;
}

export class WhatsAppProvider {
  async send(draft: NotificationDraft): Promise<NotificationDeliveryResult> {
    if (!draft.recipient) {
      return { status: NotificationStatus.FAILED, errorMessage: "Destinatario sem telefone." };
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id: draft.tenantId },
      select: { zApiInstanceId: true, zApiToken: true, whatsappEnabled: true },
    });

    if (!tenant?.whatsappEnabled || !tenant.zApiInstanceId || !tenant.zApiToken) {
      return { status: NotificationStatus.PENDING, errorMessage: "WhatsApp nao configurado para este tenant." };
    }

    const phone = formatPhone(draft.recipient);
    const message = buildMessage(draft.template, draft.payload as Record<string, unknown>);

    try {
      const res = await fetch(
        `https://api.z-api.io/instances/${tenant.zApiInstanceId}/token/${tenant.zApiToken}/send-text`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Client-Token": ZAPI_CLIENT_TOKEN,
          },
          body: JSON.stringify({ phone, message }),
        },
      );

      if (!res.ok) {
        const body = await res.text();
        return { status: NotificationStatus.FAILED, errorMessage: `Z-API erro ${res.status}: ${body}` };
      }

      return { status: NotificationStatus.SENT };
    } catch (err) {
      return {
        status: NotificationStatus.FAILED,
        errorMessage: err instanceof Error ? err.message : "Erro desconhecido ao enviar WhatsApp.",
      };
    }
  }
}

export const whatsAppProvider = new WhatsAppProvider();
```

- [ ] **Step 2: Criar a API route de settings de notificação**

Criar `src/app/api/notifications/settings/route.ts`:

```typescript
import { z } from "zod";

import { prisma } from "@/shared/database/prisma";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";

const updateNotificationSettingsSchema = z.object({
  zApiInstanceId: z.string().trim().nullable().optional(),
  zApiToken: z.string().trim().nullable().optional(),
  whatsappEnabled: z.boolean().optional(),
});

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.view);
    const tenant = await prisma.tenant.findFirst({
      where: { id: session.tenantId },
      select: { zApiInstanceId: true, zApiToken: true, whatsappEnabled: true },
    });
    return Response.json(tenant ?? { zApiInstanceId: null, zApiToken: null, whatsappEnabled: false });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.manage);
    const input = await validateInput(request, updateNotificationSettingsSchema);
    const tenant = await prisma.tenant.update({
      where: { id: session.tenantId },
      data: input,
      select: { zApiInstanceId: true, zApiToken: true, whatsappEnabled: true },
    });
    return Response.json(tenant);
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/domains/notifications/ src/app/api/notifications/
git commit -m "feat(notifications): implementa provider Z-API real e API de configuracoes de notificacao"
```

---

### Task 6: Hook use-tenant-settings

**Files:**
- Create: `src/hooks/settings/use-tenant-settings.ts`

- [ ] **Step 1: Criar o hook**

Criar `src/hooks/settings/use-tenant-settings.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export type TenantSettings = {
  id: string
  name: string
  slug: string
  phone: string | null
  address: string | null
}

export type UpdateTenantInput = {
  name?: string
  phone?: string | null
  address?: string | null
}

async function fetchTenantSettings(): Promise<TenantSettings> {
  const res = await fetch('/api/iam/tenant')
  if (!res.ok) throw new Error('Falha ao carregar configuracoes do negocio')
  return res.json()
}

async function updateTenantSettings(input: UpdateTenantInput): Promise<TenantSettings> {
  const res = await fetch('/api/iam/tenant', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Falha ao salvar configuracoes')
  return res.json()
}

export function useTenantSettings() {
  return useQuery({
    queryKey: ['tenant-settings'],
    queryFn: fetchTenantSettings,
    staleTime: 60 * 1000,
  })
}

export function useUpdateTenantSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateTenantSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] })
    },
  })
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/settings/use-tenant-settings.ts
git commit -m "feat(settings): hook useTenantSettings e useUpdateTenantSettings"
```

---

### Task 7: Estender use-services com criar, atualizar e desativar

**Files:**
- Modify: `src/hooks/scheduling/use-services.ts`

- [ ] **Step 1: Adicionar tipos e funções ao hook**

Substituir o conteúdo de `src/hooks/scheduling/use-services.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export type Service = {
  id: string
  name: string
  duration: number
  price: string
  active: boolean
}

export type CreateServiceInput = {
  name: string
  duration: number
  price: number
  active?: boolean
}

export type UpdateServiceInput = {
  name?: string
  duration?: number
  price?: number
}

async function listServices(): Promise<Service[]> {
  const res = await fetch('/api/scheduling/services')
  if (!res.ok) throw new Error('Falha ao carregar servicos')
  return res.json()
}

async function createService(input: CreateServiceInput): Promise<Service> {
  const res = await fetch('/api/scheduling/services', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Falha ao criar servico')
  return res.json()
}

async function updateService({ id, ...input }: UpdateServiceInput & { id: string }): Promise<Service> {
  const res = await fetch(`/api/scheduling/services/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Falha ao atualizar servico')
  return res.json()
}

async function deactivateService(id: string): Promise<void> {
  const res = await fetch(`/api/scheduling/services/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Falha ao desativar servico')
}

export function useServices() {
  return useQuery({
    queryKey: ['services'],
    queryFn: listServices,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateService() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createService,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['services'] }),
  })
}

export function useUpdateService() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateService,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['services'] }),
  })
}

export function useDeactivateService() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deactivateService,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['services'] }),
  })
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/scheduling/use-services.ts
git commit -m "feat(scheduling): hooks useCreateService, useUpdateService e useDeactivateService"
```

---

### Task 8: Hook use-notification-settings

**Files:**
- Create: `src/hooks/settings/use-notification-settings.ts`

- [ ] **Step 1: Criar o hook**

Criar `src/hooks/settings/use-notification-settings.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export type NotificationSettings = {
  zApiInstanceId: string | null
  zApiToken: string | null
  whatsappEnabled: boolean
}

export type UpdateNotificationSettingsInput = {
  zApiInstanceId?: string | null
  zApiToken?: string | null
  whatsappEnabled?: boolean
}

async function fetchSettings(): Promise<NotificationSettings> {
  const res = await fetch('/api/notifications/settings')
  if (!res.ok) throw new Error('Falha ao carregar configuracoes de notificacao')
  return res.json()
}

async function updateSettings(input: UpdateNotificationSettingsInput): Promise<NotificationSettings> {
  const res = await fetch('/api/notifications/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Falha ao salvar configuracoes de notificacao')
  return res.json()
}

export function useNotificationSettings() {
  return useQuery({
    queryKey: ['notification-settings'],
    queryFn: fetchSettings,
    staleTime: 60 * 1000,
  })
}

export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateSettings,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notification-settings'] }),
  })
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/settings/use-notification-settings.ts
git commit -m "feat(notifications): hook useNotificationSettings e useUpdateNotificationSettings"
```

---

### Task 9: Component BusinessInfoForm

**Files:**
- Create: `src/components/domain/settings/business-info-form.tsx`

- [ ] **Step 1: Criar o componente**

Criar `src/components/domain/settings/business-info-form.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTenantSettings, useUpdateTenantSettings } from '@/hooks/settings/use-tenant-settings'

export function BusinessInfoForm() {
  const { data, isLoading } = useTenantSettings()
  const { mutate, isPending } = useUpdateTenantSettings()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')

  useEffect(() => {
    if (data) {
      setName(data.name)
      setPhone(data.phone ?? '')
      setAddress(data.address ?? '')
    }
  }, [data])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    mutate({
      name: name.trim() || undefined,
      phone: phone.trim() || null,
      address: address.trim() || null,
    })
  }

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="business-name">Nome do negócio</Label>
        <Input
          id="business-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Studio Bella"
          required
          minLength={2}
          maxLength={100}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="business-phone">Telefone de contato</Label>
        <Input
          id="business-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(11) 9 9999-9999"
          maxLength={30}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="business-address">Endereço</Label>
        <Input
          id="business-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Rua das Flores, 123 — São Paulo, SP"
          maxLength={200}
        />
      </div>

      <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
        {isPending ? 'Salvando...' : 'Salvar alterações'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/settings/business-info-form.tsx
git commit -m "feat(settings): componente BusinessInfoForm com campos nome, telefone e endereco"
```

---

### Task 10: Components ServiceCatalog + ServiceFormModal

**Files:**
- Create: `src/components/domain/settings/service-form-modal.tsx`
- Create: `src/components/domain/settings/service-catalog.tsx`

- [ ] **Step 1: Criar ServiceFormModal**

Criar `src/components/domain/settings/service-form-modal.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreateService, useUpdateService, type Service } from '@/hooks/scheduling/use-services'

type Props = {
  open: boolean
  onClose: () => void
  service?: Service
}

export function ServiceFormModal({ open, onClose, service }: Props) {
  const isEditing = !!service
  const { mutate: create, isPending: creating } = useCreateService()
  const { mutate: update, isPending: updating } = useUpdateService()

  const [name, setName] = useState('')
  const [duration, setDuration] = useState('60')
  const [price, setPrice] = useState('')

  useEffect(() => {
    if (open && service) {
      setName(service.name)
      setDuration(String(service.duration))
      setPrice(String(Number(service.price)))
    } else if (!open) {
      setName('')
      setDuration('60')
      setPrice('')
    }
  }, [open, service])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const durationNum = parseInt(duration, 10)
    const priceNum = parseFloat(price)
    if (isNaN(durationNum) || isNaN(priceNum)) return

    if (isEditing) {
      update(
        { id: service.id, name: name.trim(), duration: durationNum, price: priceNum },
        { onSuccess: onClose },
      )
    } else {
      create(
        { name: name.trim(), duration: durationNum, price: priceNum },
        { onSuccess: onClose },
      )
    }
  }

  const isPending = creating || updating

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar serviço' : 'Novo serviço'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="service-name">Nome do serviço</Label>
            <Input
              id="service-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Corte masculino"
              required
              minLength={2}
              maxLength={100}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="service-duration">Duração (min)</Label>
              <Input
                id="service-duration"
                type="number"
                min={5}
                max={480}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-price">Preço (R$)</Label>
              <Input
                id="service-price"
                type="number"
                min={0.01}
                step={0.01}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0,00"
                required
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending} className="flex-1">
              {isPending ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar serviço'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Criar ServiceCatalog**

Criar `src/components/domain/settings/service-catalog.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Edit2, Plus, Power } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useDeactivateService, useServices, type Service } from '@/hooks/scheduling/use-services'
import { ServiceFormModal } from './service-form-modal'

export function ServiceCatalog() {
  const { data: services, isLoading, isError } = useServices()
  const { mutate: deactivate } = useDeactivateService()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingService, setEditingService] = useState<Service | undefined>()

  function handleEdit(service: Service) {
    setEditingService(service)
    setModalOpen(true)
  }

  function handleCreate() {
    setEditingService(undefined)
    setModalOpen(true)
  }

  function handleDeactivate(service: Service) {
    if (!confirm(`Desativar "${service.name}"?`)) return
    deactivate(service.id)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {services?.length ?? 0} serviço(s) cadastrado(s)
        </p>
        <Button onClick={handleCreate} size="sm" className="gap-2">
          <Plus className="size-4" />
          Novo serviço
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-sm text-rose-500">Erro ao carregar serviços.</p>
      )}

      {!isLoading && !isError && services?.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-10 text-center">
          <p className="text-sm text-slate-500">Nenhum serviço cadastrado ainda.</p>
          <Button onClick={handleCreate} variant="outline" size="sm" className="mt-3">
            Criar primeiro serviço
          </Button>
        </div>
      )}

      {!isLoading && services && services.length > 0 && (
        <div className="space-y-2">
          {services.map((service) => (
            <div
              key={service.id}
              className="flex items-center gap-4 rounded-2xl border border-white/80 bg-white/85 px-4 py-3 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-950">{service.name}</span>
                  {!service.active && (
                    <Badge variant="secondary" className="text-xs">Inativo</Badge>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  {service.duration} min ·{' '}
                  R${Number(service.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEdit(service)}
                  className="size-8"
                  title="Editar"
                >
                  <Edit2 className="size-3.5" />
                </Button>
                {service.active && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeactivate(service)}
                    className="size-8 text-slate-400 hover:text-rose-600"
                    title="Desativar"
                  >
                    <Power className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ServiceFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        service={editingService}
      />
    </div>
  )
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/domain/settings/
git commit -m "feat(settings): ServiceCatalog e ServiceFormModal com criar, editar e desativar"
```

---

### Task 11: Component WhatsAppSettingsForm

**Files:**
- Create: `src/components/domain/settings/whatsapp-settings-form.tsx`

- [ ] **Step 1: Criar o componente**

Criar `src/components/domain/settings/whatsapp-settings-form.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  useNotificationSettings,
  useUpdateNotificationSettings,
} from '@/hooks/settings/use-notification-settings'

export function WhatsAppSettingsForm() {
  const { data, isLoading } = useNotificationSettings()
  const { mutate, isPending } = useUpdateNotificationSettings()

  const [instanceId, setInstanceId] = useState('')
  const [token, setToken] = useState('')
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    if (data) {
      setInstanceId(data.zApiInstanceId ?? '')
      setToken(data.zApiToken ?? '')
      setEnabled(data.whatsappEnabled)
    }
  }, [data])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    mutate({
      zApiInstanceId: instanceId.trim() || null,
      zApiToken: token.trim() || null,
      whatsappEnabled: enabled,
    })
  }

  function handleToggle() {
    const next = !enabled
    setEnabled(next)
    mutate({ whatsappEnabled: next })
  }

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />
  }

  const isConfigured = !!(data?.zApiInstanceId && data?.zApiToken)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-2xl border border-white/80 bg-white/85 px-5 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="inline-flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <MessageCircle className="size-5" />
          </div>
          <div>
            <p className="font-medium text-slate-950">Notificações WhatsApp</p>
            <p className="text-xs text-slate-500">
              Confirmações automáticas via Z-API
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isConfigured ? (
            <Badge className={enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
              {enabled ? 'Ativo' : 'Pausado'}
            </Badge>
          ) : (
            <Badge variant="secondary">Não configurado</Badge>
          )}
          <Button
            variant={enabled ? 'destructive' : 'default'}
            size="sm"
            onClick={handleToggle}
            disabled={!isConfigured || isPending}
          >
            {enabled ? 'Desativar' : 'Ativar'}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm font-medium text-slate-700">Credenciais Z-API</p>

        <div className="space-y-2">
          <Label htmlFor="zapi-instance">Instance ID</Label>
          <Input
            id="zapi-instance"
            value={instanceId}
            onChange={(e) => setInstanceId(e.target.value)}
            placeholder="Ex: 3B1E9CE0F90A8D4C7F2"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="zapi-token">Token da instância</Label>
          <Input
            id="zapi-token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Token de segurança da instância"
          />
        </div>

        <p className="text-xs text-slate-400">
          Obtenha o Instance ID e Token no painel da{' '}
          <span className="font-medium">Z-API</span>. A variável de ambiente{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5">ZAPI_CLIENT_TOKEN</code>{' '}
          deve estar configurada no servidor.
        </p>

        <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
          {isPending ? 'Salvando...' : 'Salvar credenciais'}
        </Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/settings/whatsapp-settings-form.tsx
git commit -m "feat(settings): componente WhatsAppSettingsForm com configuracao Z-API e toggle"
```

---

### Task 12: Página /configuracoes com tabs

**Files:**
- Create: `src/app/(app)/configuracoes/page.tsx`

- [ ] **Step 1: Criar a página**

Criar `src/app/(app)/configuracoes/page.tsx`:

```tsx
'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BusinessInfoForm } from '@/components/domain/settings/business-info-form'
import { ServiceCatalog } from '@/components/domain/settings/service-catalog'
import { WhatsAppSettingsForm } from '@/components/domain/settings/whatsapp-settings-form'
import { usePermissions } from '@/hooks/use-permissions'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function ConfiguracoesPage() {
  const { can, isLoading } = usePermissions()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !can('settings:view')) {
      router.replace('/agenda')
    }
  }, [isLoading, can, router])

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-rose-200 border-t-rose-600" />
      </div>
    )
  }

  if (!can('settings:view')) return null

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          Configurações
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Gerencie os dados do seu negócio, serviços e integrações
        </p>
      </div>

      <Tabs defaultValue="negocio">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="negocio">Negócio</TabsTrigger>
          <TabsTrigger value="servicos">Serviços</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
        </TabsList>

        <TabsContent value="negocio" className="mt-6">
          <div className="rounded-2xl border border-white/80 bg-white/85 p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-slate-950">
              Dados do negócio
            </h2>
            <BusinessInfoForm />
          </div>
        </TabsContent>

        <TabsContent value="servicos" className="mt-6">
          <div className="rounded-2xl border border-white/80 bg-white/85 p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-slate-950">
              Catálogo de serviços
            </h2>
            <ServiceCatalog />
          </div>
        </TabsContent>

        <TabsContent value="whatsapp" className="mt-6">
          <div className="rounded-2xl border border-white/80 bg-white/85 p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-slate-950">
              Notificações WhatsApp
            </h2>
            <WhatsAppSettingsForm />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript final completo**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/configuracoes/page.tsx
git commit -m "feat(settings): pagina /configuracoes com tabs negocio, servicos e whatsapp"
```

---

### Task 13: Branch, PR e merge

**Files:** (nenhum arquivo novo)

- [ ] **Step 1: Verificar que todos os commits estão na branch feature**

A branch deve ser `feat/configuracoes-notificacoes`. Se o trabalho foi feito direto na main, criar branch retroativamente:

```bash
git checkout -b feat/configuracoes-notificacoes
```

Se já estiver na branch correta, apenas confirmar:

```bash
git log --oneline -15
```

- [ ] **Step 2: Abrir PR**

```bash
gh pr create \
  --title "feat: pagina de configuracoes e notificacoes whatsapp via z-api" \
  --body "## O que essa PR faz

- Página \`/configuracoes\` com 3 abas: Negócio, Serviços e WhatsApp
- Aba Negócio: formulário com nome do salão, telefone e endereço
- Aba Serviços: catálogo com criar, editar e desativar serviços
- Aba WhatsApp: configuração de credenciais Z-API com toggle ativo/pausado
- Provider WhatsApp implementado com Z-API (era stub)
- Notificação de confirmação enviada automaticamente ao criar agendamento
- Migration aditiva com 5 campos novos no Tenant
- Permissões \`settings:view\` e \`settings:manage\` (OWNER + MANAGER)

## Como testar

1. Fazer login como OWNER
2. Acessar /configuracoes — deve carregar as 3 abas
3. Aba Negócio: alterar nome e salvar
4. Aba Serviços: criar um serviço novo, editar, desativar
5. Aba WhatsApp: inserir Instance ID e Token Z-API, salvar, ativar
6. Criar um agendamento na /agenda — deve disparar notificação WhatsApp" \
  --base main
```

- [ ] **Step 3: Merge da PR**

Após revisão, fazer merge da PR no GitHub ou via CLI:

```bash
gh pr merge --squash --delete-branch
```
