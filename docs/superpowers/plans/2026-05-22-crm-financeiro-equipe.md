# CRM + Financeiro + Equipe — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar as telas de Clientes, Financeiro e Equipe com backend complementar (perfil de cliente, APIs de equipe/convites) e integração do fluxo de pagamento ao concluir atendimento.

**Architecture:** Hooks TanStack Query por domínio seguindo o padrão de `use-appointments.ts`; componentes client focados num único propósito; páginas server como wrappers finos. Backend IAM novo: `TenantInvite` no Prisma + rotas `/api/iam/users`, `/api/iam/invites` e `/api/iam/join`. Convites via Supabase Admin `inviteUserByEmail` com `user_metadata.pendingTenantId`; onboarding detecta esse campo e redireciona para o tenant já existente.

**Tech Stack:** Next.js 15 App Router, TypeScript, TanStack Query v5, Shadcn UI (componentes já instalados: Badge, Button, Dialog, Input, Label, Select, Separator, Sheet, Skeleton, Tabs), sonner (toasts), Supabase Admin SDK, Prisma.

> **Nota:** Não há framework de testes configurado. Verificação via `npx tsc --noEmit` + `npm run build` em cada tarefa.

---

## Mapa de arquivos

### Modificar (existentes)
| Arquivo | O que muda |
|---------|-----------|
| `src/domains/crm/customer.repository.ts` | Adicionar `findWithAppointments` |
| `src/domains/crm/customer.service.ts` | Adicionar `getProfile` |
| `src/domains/iam/iam.repository.ts` | Adicionar métodos de listagem e update de usuários + CRUD de convites |
| `src/domains/iam/iam.service.ts` | Adicionar `listUsers`, `updateUserRole`, `createInvite`, `listInvites`, `joinTenant` |
| `prisma/schema.prisma` | Adicionar `InviteStatus` enum + `TenantInvite` model + relação no Tenant |
| `src/components/domain/scheduling/agenda-day-view.tsx` | Adicionar estado de `completedAppointment` + `<RegisterPaymentModal>` |
| `src/app/(auth)/onboarding/page.tsx` | Detectar `user_metadata.pendingTenantId` → fluxo de join |

### Criar
| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/app/api/crm/customers/[customerId]/route.ts` | GET perfil do cliente + histórico de agendamentos |
| `src/app/api/iam/users/route.ts` | GET lista de membros do tenant |
| `src/app/api/iam/users/[userId]/route.ts` | PATCH papel do usuário |
| `src/app/api/iam/invites/route.ts` | GET convites pendentes / POST novo convite |
| `src/app/api/iam/join/route.ts` | POST ingressar no tenant via convite |
| `src/hooks/crm/use-customers.ts` | Lista paginada + create + update de clientes |
| `src/hooks/crm/use-customer.ts` | Perfil único com histórico de agendamentos |
| `src/hooks/financial/use-transactions.ts` | Lista paginada + create de transações |
| `src/hooks/iam/use-team.ts` | Membros, convites e mutações de equipe |
| `src/components/domain/crm/customer-card.tsx` | Card de cliente para listagem |
| `src/components/domain/crm/customer-list.tsx` | Lista paginada com busca e empty state |
| `src/components/domain/crm/create-customer-modal.tsx` | Modal de cadastro rápido |
| `src/components/domain/crm/customer-profile-header.tsx` | Cabeçalho da tela de perfil |
| `src/components/domain/crm/appointment-history.tsx` | Histórico de atendimentos do cliente |
| `src/components/domain/financial/day-summary.tsx` | Cards de resumo diário (financeiro) |
| `src/components/domain/financial/transaction-card.tsx` | Card de transação individual |
| `src/components/domain/financial/transaction-list.tsx` | Lista com empty/loading/error states |
| `src/components/domain/financial/register-payment-modal.tsx` | Modal acionado ao concluir atendimento |
| `src/components/domain/iam/team-member-card.tsx` | Card de membro de equipe |
| `src/components/domain/iam/invite-member-modal.tsx` | Modal de convite por e-mail |
| `src/app/(app)/clientes/page.tsx` | Página de listagem de clientes |
| `src/app/(app)/clientes/[id]/page.tsx` | Página de perfil do cliente |
| `src/app/(app)/financeiro/page.tsx` | Resumo diário + transações de hoje |
| `src/app/(app)/financeiro/transacoes/page.tsx` | Histórico com filtro por data |
| `src/app/(app)/equipe/page.tsx` | Gestão de equipe + convites |

---

## Tarefa 1: API GET /api/crm/customers/[customerId]

**Arquivos:**
- Modificar: `src/domains/crm/customer.repository.ts`
- Modificar: `src/domains/crm/customer.service.ts`
- Criar: `src/app/api/crm/customers/[customerId]/route.ts`

- [ ] **Passo 1: Adicionar `findWithAppointments` ao repository**

Abrir `src/domains/crm/customer.repository.ts` e adicionar o método após `findByPhone`:

```typescript
  async findWithAppointments(tenantId: string, customerId: string) {
    return prisma.customer.findFirst({
      where: { id: customerId, tenantId },
      include: {
        appointments: {
          include: {
            service: { select: { id: true, name: true } },
            professional: { select: { id: true, name: true } },
          },
          orderBy: { startsAt: 'desc' },
          take: 50,
        },
      },
    })
  }
```

- [ ] **Passo 2: Adicionar `getProfile` ao service**

Abrir `src/domains/crm/customer.service.ts` e adicionar após `update`:

```typescript
  async getProfile(tenantId: string, customerId: string) {
    const profile = await customerRepository.findWithAppointments(tenantId, customerId)
    if (!profile) throw new CustomerNotFoundError()
    return profile
  }
```

- [ ] **Passo 3: Criar a route**

Criar `src/app/api/crm/customers/[customerId]/route.ts`:

```typescript
import { customerService } from '@/domains/crm/customer.service'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { ensurePermission, PERMISSIONS } from '@/shared/auth/permissions'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.customers.view)
    const { customerId } = await params
    const profile = await customerService.getProfile(session.tenantId, customerId)
    return Response.json(profile)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Passo 4: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Passo 5: Commit**

```bash
git add src/domains/crm/customer.repository.ts src/domains/crm/customer.service.ts src/app/api/crm/customers/
git commit -m "feat(crm): API GET /customers/[customerId] com historico de agendamentos"
```

---

## Tarefa 2: Hooks CRM

**Arquivos:**
- Criar: `src/hooks/crm/use-customers.ts`
- Criar: `src/hooks/crm/use-customer.ts`

- [ ] **Passo 1: Criar `use-customers.ts`**

```typescript
// src/hooks/crm/use-customers.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export type Customer = {
  id: string
  name: string
  phone: string | null
  email: string | null
  notes: string | null
  tags: string[]
  createdAt: string
  updatedAt: string
}

export type CreateCustomerInput = {
  name: string
  phone?: string
  email?: string
  notes?: string
  tags?: string[]
}

export type CustomersPage = {
  data: Customer[]
  total: number
  page: number
  pageSize: number
}

type ListParams = {
  search?: string
  page?: number
  pageSize?: number
}

async function listCustomers(params: ListParams): Promise<CustomersPage> {
  const url = new URL('/api/crm/customers', window.location.origin)
  if (params.search) url.searchParams.set('search', params.search)
  if (params.page) url.searchParams.set('page', String(params.page))
  if (params.pageSize) url.searchParams.set('pageSize', String(params.pageSize))
  const res = await fetch(url)
  if (!res.ok) throw new Error('Falha ao carregar clientes')
  return res.json()
}

async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  const res = await fetch('/api/crm/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? 'Falha ao cadastrar cliente')
  }
  return res.json()
}

async function updateCustomer(
  id: string,
  input: Partial<CreateCustomerInput>,
): Promise<Customer> {
  const res = await fetch(`/api/crm/customers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? 'Falha ao atualizar cliente')
  }
  return res.json()
}

export function useCustomers(params: ListParams = {}) {
  return useQuery({
    queryKey: ['customers', params],
    queryFn: () => listCustomers(params),
    staleTime: 30 * 1000,
  })
}

export function useCreateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CreateCustomerInput> }) =>
      updateCustomer(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customer'] })
    },
  })
}
```

- [ ] **Passo 2: Criar `use-customer.ts`**

```typescript
// src/hooks/crm/use-customer.ts
import { useQuery } from '@tanstack/react-query'
import type { Customer } from './use-customers'

export type CustomerAppointment = {
  id: string
  startsAt: string
  endsAt: string
  status: string
  price: string
  service: { id: string; name: string }
  professional: { id: string; name: string }
}

export type CustomerProfile = Customer & {
  appointments: CustomerAppointment[]
}

async function fetchCustomerProfile(id: string): Promise<CustomerProfile> {
  const res = await fetch(`/api/crm/customers/${id}`)
  if (!res.ok) throw new Error('Cliente não encontrado')
  return res.json()
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: ['customer', id],
    queryFn: () => fetchCustomerProfile(id),
    staleTime: 30 * 1000,
    enabled: !!id,
  })
}
```

- [ ] **Passo 3: Verificar tipos**

```bash
npx tsc --noEmit
```

- [ ] **Passo 4: Commit**

```bash
git add src/hooks/crm/
git commit -m "feat(crm): hooks useCustomers, useCustomer, useCreateCustomer, useUpdateCustomer"
```

---

## Tarefa 3: CustomerCard + CustomerList

**Arquivos:**
- Criar: `src/components/domain/crm/customer-card.tsx`
- Criar: `src/components/domain/crm/customer-list.tsx`

- [ ] **Passo 1: Criar `customer-card.tsx`**

```tsx
// src/components/domain/crm/customer-card.tsx
'use client'

import Link from 'next/link'
import { Phone, Mail, Tag } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { Customer } from '@/hooks/crm/use-customers'

type Props = {
  customer: Customer
}

export function CustomerCard({ customer }: Props) {
  return (
    <Link
      href={`/clientes/${customer.id}`}
      className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
          {customer.name.slice(0, 2).toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-950">
            {customer.name}
          </p>

          <div className="mt-1 flex flex-col gap-0.5">
            {customer.phone && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Phone className="size-3" />
                {customer.phone}
              </span>
            )}
            {customer.email && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Mail className="size-3" />
                {customer.email}
              </span>
            )}
          </div>

          {customer.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {customer.tags.map((tag) => (
                <Badge
                  key={tag}
                  className="flex items-center gap-0.5 rounded-full bg-slate-100 px-2 py-0 text-[10px] text-slate-600"
                >
                  <Tag className="size-2.5" />
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
```

- [ ] **Passo 2: Criar `customer-list.tsx`**

```tsx
// src/components/domain/crm/customer-list.tsx
'use client'

import { useState, useCallback } from 'react'
import { Plus, Search, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { CustomerCard } from './customer-card'
import { CreateCustomerModal } from './create-customer-modal'
import { useCustomers } from '@/hooks/crm/use-customers'
import { usePermissions } from '@/hooks/use-permissions'

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value)
  const timeout = useCallback(
    (v: string) => {
      const timer = setTimeout(() => setDebounced(v), delay)
      return () => clearTimeout(timer)
    },
    [delay],
  )
  useState(() => timeout(value))
  return debounced
}

export function CustomerList() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const { can } = usePermissions()

  const debouncedSearch = useDebounce(search, 300)
  const { data, isLoading, isError, refetch } = useCustomers({
    search: debouncedSearch || undefined,
    page,
    pageSize: 20,
  })

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1

  return (
    <div className="space-y-4">
      {/* Barra de ações */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
        {can('customers:create') && (
          <Button
            onClick={() => setCreateOpen(true)}
            className="shrink-0 rounded-full bg-slate-950 text-white hover:bg-slate-800"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">Novo cliente</span>
          </Button>
        )}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-600">Erro ao carregar clientes.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : !data || data.data.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 py-16 text-center">
          <Users className="size-10 text-slate-300" />
          <p className="mt-4 text-sm font-medium text-slate-500">
            {debouncedSearch
              ? 'Nenhum cliente encontrado para esta busca'
              : 'Nenhum cliente cadastrado ainda'}
          </p>
          {!debouncedSearch && can('customers:create') && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4 rounded-full"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-4" />
              Cadastrar primeiro cliente
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {data.data.map((customer) => (
              <CustomerCard key={customer.id} customer={customer} />
            ))}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p - 1)}
                disabled={page <= 1}
              >
                Anterior
              </Button>
              <span className="text-xs text-slate-500">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
              >
                Próxima
              </Button>
            </div>
          )}
        </>
      )}

      <CreateCustomerModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}
```

- [ ] **Passo 3: Verificar tipos**

```bash
npx tsc --noEmit
```

- [ ] **Passo 4: Commit**

```bash
git add src/components/domain/crm/customer-card.tsx src/components/domain/crm/customer-list.tsx
git commit -m "feat(crm): CustomerCard e CustomerList com busca, paginacao e empty state"
```

---

## Tarefa 4: CreateCustomerModal

**Arquivos:**
- Criar: `src/components/domain/crm/create-customer-modal.tsx`

- [ ] **Passo 1: Criar o componente**

```tsx
// src/components/domain/crm/create-customer-modal.tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreateCustomer } from '@/hooks/crm/use-customers'

type Props = {
  open: boolean
  onClose: () => void
  onCreated?: (id: string) => void
}

export function CreateCustomerModal({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const createCustomer = useCreateCustomer()

  function handleClose() {
    setName('')
    setPhone('')
    setEmail('')
    onClose()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    createCustomer.mutate(
      {
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
      },
      {
        onSuccess: (customer) => {
          toast.success(`${customer.name} cadastrado com sucesso`)
          onCreated?.(customer.id)
          handleClose()
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Erro ao cadastrar cliente')
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Novo cliente</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input
              placeholder="Nome completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input
              placeholder="(00) 00000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
            />
          </div>

          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input
              placeholder="email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleClose}
              disabled={createCustomer.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-slate-950 text-white hover:bg-slate-800"
              disabled={!name.trim() || createCustomer.isPending}
            >
              {createCustomer.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Passo 2: Verificar tipos**

```bash
npx tsc --noEmit
```

- [ ] **Passo 3: Commit**

```bash
git add src/components/domain/crm/create-customer-modal.tsx
git commit -m "feat(crm): CreateCustomerModal com nome, telefone e email"
```

---

## Tarefa 5: Página /clientes

**Arquivos:**
- Criar: `src/app/(app)/clientes/page.tsx`

- [ ] **Passo 1: Criar página**

```tsx
// src/app/(app)/clientes/page.tsx
import { CustomerList } from '@/components/domain/crm/customer-list'

export const metadata = { title: 'Clientes · Estética SaaS' }

export default function ClientesPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          Clientes
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Gerencie sua base de clientes
        </p>
      </div>
      <CustomerList />
    </div>
  )
}
```

- [ ] **Passo 2: Verificar build**

```bash
npm run build
```

Esperado: rota `/clientes` compilada como estática (○).

- [ ] **Passo 3: Commit**

```bash
git add src/app/(app)/clientes/page.tsx
git commit -m "feat(crm): pagina /clientes com CustomerList"
```

---

## Tarefa 6: CustomerProfileHeader + AppointmentHistory

**Arquivos:**
- Criar: `src/components/domain/crm/customer-profile-header.tsx`
- Criar: `src/components/domain/crm/appointment-history.tsx`

- [ ] **Passo 1: Criar `customer-profile-header.tsx`**

```tsx
// src/components/domain/crm/customer-profile-header.tsx
'use client'

import { Phone, Mail, Tag, Calendar } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { CustomerProfile } from '@/hooks/crm/use-customer'

type Props = {
  customer: CustomerProfile
}

export function CustomerProfileHeader({ customer }: Props) {
  const lastAppointment = customer.appointments[0]

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-start gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl font-bold text-slate-700">
          {customer.name.slice(0, 2).toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold text-slate-950">{customer.name}</h2>

          <div className="mt-2 space-y-1">
            {customer.phone && (
              <div className="flex items-center gap-1.5 text-sm text-slate-600">
                <Phone className="size-4 shrink-0 text-slate-400" />
                {customer.phone}
              </div>
            )}
            {customer.email && (
              <div className="flex items-center gap-1.5 text-sm text-slate-600">
                <Mail className="size-4 shrink-0 text-slate-400" />
                {customer.email}
              </div>
            )}
            {lastAppointment && (
              <div className="flex items-center gap-1.5 text-sm text-slate-500">
                <Calendar className="size-4 shrink-0 text-slate-400" />
                Último atendimento:{' '}
                {new Date(lastAppointment.startsAt).toLocaleDateString('pt-BR')}
              </div>
            )}
          </div>

          {customer.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {customer.tags.map((tag) => (
                <Badge
                  key={tag}
                  className="flex items-center gap-0.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                >
                  <Tag className="size-3" />
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {customer.notes && (
            <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              {customer.notes}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Passo 2: Criar `appointment-history.tsx`**

```tsx
// src/components/domain/crm/appointment-history.tsx
'use client'

import { CalendarDays } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { CustomerAppointment } from '@/hooks/crm/use-customer'

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  SCHEDULED:  { label: 'Agendado',       className: 'bg-slate-100 text-slate-700' },
  CONFIRMED:  { label: 'Confirmado',     className: 'bg-blue-100 text-blue-700' },
  COMPLETED:  { label: 'Concluído',      className: 'bg-emerald-100 text-emerald-700' },
  CANCELLED:  { label: 'Cancelado',      className: 'bg-red-100 text-red-700' },
  NO_SHOW:    { label: 'Não compareceu', className: 'bg-orange-100 text-orange-700' },
}

type Props = {
  appointments: CustomerAppointment[]
}

export function AppointmentHistory({ appointments }: Props) {
  if (appointments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 py-12 text-center">
        <CalendarDays className="size-8 text-slate-300" />
        <p className="mt-3 text-sm text-slate-500">Nenhum atendimento registrado</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {appointments.map((appt) => {
        const config = STATUS_CONFIG[appt.status] ?? STATUS_CONFIG.SCHEDULED
        return (
          <div
            key={appt.id}
            className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-950">
                {appt.service.name}
              </p>
              <p className="text-xs text-slate-500">
                {new Date(appt.startsAt).toLocaleString('pt-BR', {
                  weekday: 'short',
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {' · '}
                {appt.professional.name}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Badge className={cn('text-xs', config.className)}>
                {config.label}
              </Badge>
              <span className="text-xs font-medium text-slate-700">
                R${Number(appt.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Passo 3: Verificar tipos**

```bash
npx tsc --noEmit
```

- [ ] **Passo 4: Commit**

```bash
git add src/components/domain/crm/customer-profile-header.tsx src/components/domain/crm/appointment-history.tsx
git commit -m "feat(crm): CustomerProfileHeader e AppointmentHistory"
```

---

## Tarefa 7: Página /clientes/[id]

**Arquivos:**
- Criar: `src/app/(app)/clientes/[id]/page.tsx`

- [ ] **Passo 1: Criar a página**

```tsx
// src/app/(app)/clientes/[id]/page.tsx
'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CustomerProfileHeader } from '@/components/domain/crm/customer-profile-header'
import { AppointmentHistory } from '@/components/domain/crm/appointment-history'
import { useCustomer } from '@/hooks/crm/use-customer'

export default function CustomerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { data: customer, isLoading, isError, refetch } = useCustomer(id)

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  if (isError || !customer) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm text-red-600">Cliente não encontrado.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.back()}
        className="-ml-2 text-slate-500"
      >
        <ArrowLeft className="size-4" />
        Voltar
      </Button>

      <CustomerProfileHeader customer={customer} />

      <Tabs defaultValue="historico">
        <TabsList className="w-full">
          <TabsTrigger value="historico" className="flex-1">
            Histórico ({customer.appointments.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="historico" className="mt-4">
          <AppointmentHistory appointments={customer.appointments} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Passo 2: Verificar build**

```bash
npm run build
```

Esperado: rota `/clientes/[id]` compilada (ƒ dinâmico).

- [ ] **Passo 3: Commit**

```bash
git add src/app/(app)/clientes/
git commit -m "feat(crm): pagina /clientes/[id] com perfil e historico de atendimentos"
```

---

## Tarefa 8: Hooks Financial

**Arquivos:**
- Criar: `src/hooks/financial/use-transactions.ts`

- [ ] **Passo 1: Criar `use-transactions.ts`**

```typescript
// src/hooks/financial/use-transactions.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export type TransactionType = 'INCOME' | 'EXPENSE'

export type Transaction = {
  id: string
  type: TransactionType
  category: string
  description: string
  amount: string
  paidAt: string | null
  appointmentId: string | null
  createdAt: string
}

export type TransactionsPage = {
  data: Transaction[]
  total: number
  page: number
  pageSize: number
}

export type CreateTransactionInput = {
  appointmentId?: string
  type: TransactionType
  category: string
  description: string
  amount: number
  paidAt?: string
}

type ListParams = {
  from?: string
  to?: string
  type?: TransactionType
  page?: number
  pageSize?: number
}

async function listTransactions(params: ListParams): Promise<TransactionsPage> {
  const url = new URL('/api/financial/transactions', window.location.origin)
  if (params.from) url.searchParams.set('from', params.from)
  if (params.to) url.searchParams.set('to', params.to)
  if (params.type) url.searchParams.set('type', params.type)
  if (params.page) url.searchParams.set('page', String(params.page))
  if (params.pageSize) url.searchParams.set('pageSize', String(params.pageSize))
  const res = await fetch(url)
  if (!res.ok) throw new Error('Falha ao carregar transações')
  return res.json()
}

async function createTransaction(input: CreateTransactionInput): Promise<Transaction> {
  const res = await fetch('/api/financial/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? 'Falha ao registrar transação')
  }
  return res.json()
}

export function useTransactions(params: ListParams = {}) {
  return useQuery({
    queryKey: ['transactions', params],
    queryFn: () => listTransactions(params),
    staleTime: 30 * 1000,
  })
}

export function useCreateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}
```

- [ ] **Passo 2: Verificar tipos**

```bash
npx tsc --noEmit
```

- [ ] **Passo 3: Commit**

```bash
git add src/hooks/financial/
git commit -m "feat(financial): hooks useTransactions e useCreateTransaction"
```

---

## Tarefa 9: RegisterPaymentModal + integração com AgendaDayView

**Arquivos:**
- Criar: `src/components/domain/financial/register-payment-modal.tsx`
- Modificar: `src/components/domain/scheduling/agenda-day-view.tsx`

- [ ] **Passo 1: Criar `register-payment-modal.tsx`**

O modal recebe o agendamento concluído, pré-preenche o valor e pede a forma de pagamento.

```tsx
// src/components/domain/financial/register-payment-modal.tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreateTransaction } from '@/hooks/financial/use-transactions'
import type { Appointment } from '@/hooks/scheduling/use-appointments'

const PAYMENT_METHODS = [
  { value: 'PIX',             label: 'PIX' },
  { value: 'Cartão de débito', label: 'Cartão de débito' },
  { value: 'Cartão de crédito', label: 'Cartão de crédito' },
  { value: 'Dinheiro',        label: 'Dinheiro' },
  { value: 'Outro',           label: 'Outro' },
]

type Props = {
  appointment: Appointment | null
  open: boolean
  onClose: () => void
}

export function RegisterPaymentModal({ appointment, open, onClose }: Props) {
  const [paymentMethod, setPaymentMethod] = useState('')
  const createTransaction = useCreateTransaction()

  function handleClose() {
    setPaymentMethod('')
    onClose()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!appointment || !paymentMethod) return

    createTransaction.mutate(
      {
        appointmentId: appointment.id,
        type: 'INCOME',
        category: 'service',
        description: `${appointment.service.name} - ${appointment.customer.name} (${paymentMethod})`,
        amount: Number(appointment.price),
        paidAt: new Date().toISOString(),
      },
      {
        onSuccess: () => {
          toast.success('Pagamento registrado com sucesso')
          handleClose()
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Erro ao registrar pagamento')
        },
      },
    )
  }

  if (!appointment) return null

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Resumo do atendimento */}
          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            <p className="font-semibold text-slate-950">{appointment.service.name}</p>
            <p className="text-slate-500">{appointment.customer.name}</p>
            <p className="mt-1 text-lg font-bold text-emerald-700">
              R${Number(appointment.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Forma de pagamento *</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleClose}
              disabled={createTransaction.isPending}
            >
              Pular
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={!paymentMethod || createTransaction.isPending}
            >
              {createTransaction.isPending ? 'Salvando...' : 'Confirmar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Passo 2: Adicionar `RegisterPaymentModal` ao `AgendaDayView`**

Abrir `src/components/domain/scheduling/agenda-day-view.tsx`.

No topo, adicionar o import:
```typescript
import { RegisterPaymentModal } from '@/components/domain/financial/register-payment-modal'
```

Na seção de estado (`useState` declarations), adicionar:
```typescript
const [paymentAppointment, setPaymentAppointment] = useState<Appointment | null>(null)
const [paymentModalOpen, setPaymentModalOpen] = useState(false)
```

No JSX, após `</CreateAppointmentModal>`, adicionar:
```tsx
<RegisterPaymentModal
  appointment={paymentAppointment}
  open={paymentModalOpen}
  onClose={() => {
    setPaymentModalOpen(false)
    setPaymentAppointment(null)
  }}
/>
```

No `<AppointmentDrawer>`, adicionar a prop `onCompleted`:
```tsx
<AppointmentDrawer
  appointment={selectedAppointment}
  open={drawerOpen}
  onClose={() => {
    setDrawerOpen(false)
    setSelectedAppointment(null)
  }}
  onCompleted={(appt) => {
    setPaymentAppointment(appt)
    setPaymentModalOpen(true)
  }}
/>
```

- [ ] **Passo 3: Verificar tipos**

```bash
npx tsc --noEmit
```

- [ ] **Passo 4: Commit**

```bash
git add src/components/domain/financial/register-payment-modal.tsx src/components/domain/scheduling/agenda-day-view.tsx
git commit -m "feat(financial): RegisterPaymentModal integrado ao AppointmentDrawer via onCompleted"
```

---

## Tarefa 10: FinancialDaySummary + TransactionCard + TransactionList

**Arquivos:**
- Criar: `src/components/domain/financial/day-summary.tsx`
- Criar: `src/components/domain/financial/transaction-card.tsx`
- Criar: `src/components/domain/financial/transaction-list.tsx`

- [ ] **Passo 1: Criar `day-summary.tsx`**

```tsx
// src/components/domain/financial/day-summary.tsx
'use client'

import { useMemo } from 'react'
import { DollarSign, TrendingUp, CalendarCheck } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useTransactions } from '@/hooks/financial/use-transactions'

function startOfDay(d: Date) {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

function endOfDay(d: Date) {
  const r = new Date(d)
  r.setHours(23, 59, 59, 999)
  return r
}

export function FinancialDaySummary() {
  const { from, to } = useMemo(() => {
    const today = new Date()
    return {
      from: startOfDay(today).toISOString(),
      to: endOfDay(today).toISOString(),
    }
  }, [])

  const { data, isLoading, isError } = useTransactions({
    from,
    to,
    type: 'INCOME',
    pageSize: 100,
  })

  const transactions = data?.data ?? []
  const totalRevenue = transactions.reduce((sum, t) => {
    const n = Number(t.amount)
    return sum + (Number.isFinite(n) ? n : 0)
  }, 0)
  const avgTicket = transactions.length > 0 ? totalRevenue / transactions.length : 0

  const cards = [
    {
      label: 'Receita do dia',
      value: `R$${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: 'text-emerald-600 bg-emerald-50',
    },
    {
      label: 'Transações',
      value: String(transactions.length),
      icon: CalendarCheck,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Ticket médio',
      value: `R$${avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      icon: TrendingUp,
      color: 'text-purple-600 bg-purple-50',
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div
            key={card.label}
            className="rounded-2xl border border-white/80 bg-white/85 p-5 shadow-sm"
          >
            <div className={`inline-flex rounded-xl p-2 ${card.color}`}>
              <Icon className="size-4" />
            </div>
            {isLoading ? (
              <>
                <Skeleton className="mt-4 h-7 w-24" />
                <Skeleton className="mt-1 h-3 w-28" />
              </>
            ) : isError ? (
              <p className="mt-4 text-sm text-slate-400">Erro ao carregar</p>
            ) : (
              <p className="mt-4 text-2xl font-semibold text-slate-950">{card.value}</p>
            )}
            <p className="mt-2 text-xs font-medium text-slate-400">{card.label}</p>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Passo 2: Criar `transaction-card.tsx`**

```tsx
// src/components/domain/financial/transaction-card.tsx
'use client'

import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Transaction } from '@/hooks/financial/use-transactions'

type Props = {
  transaction: Transaction
}

export function TransactionCard({ transaction }: Props) {
  const isIncome = transaction.type === 'INCOME'
  const amount = Number(transaction.amount)

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full',
          isIncome ? 'bg-emerald-50' : 'bg-red-50',
        )}
      >
        {isIncome ? (
          <ArrowUpCircle className="size-5 text-emerald-600" />
        ) : (
          <ArrowDownCircle className="size-5 text-red-600" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-950">
          {transaction.description}
        </p>
        <p className="text-xs text-slate-500">
          {transaction.paidAt
            ? new Date(transaction.paidAt).toLocaleString('pt-BR', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })
            : 'Sem data'}
          {' · '}
          {transaction.category}
        </p>
      </div>

      <span
        className={cn(
          'shrink-0 text-sm font-semibold',
          isIncome ? 'text-emerald-700' : 'text-red-700',
        )}
      >
        {isIncome ? '+' : '-'}R$
        {amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
      </span>
    </div>
  )
}
```

- [ ] **Passo 3: Criar `transaction-list.tsx`**

```tsx
// src/components/domain/financial/transaction-list.tsx
'use client'

import { DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TransactionCard } from './transaction-card'
import { useTransactions } from '@/hooks/financial/use-transactions'
import type { TransactionType } from '@/hooks/financial/use-transactions'

type Props = {
  from?: string
  to?: string
  type?: TransactionType
  page?: number
  pageSize?: number
  onPageChange?: (page: number) => void
}

export function TransactionList({
  from,
  to,
  type,
  page = 1,
  pageSize = 20,
  onPageChange,
}: Props) {
  const { data, isLoading, isError, refetch } = useTransactions({
    from,
    to,
    type,
    page,
    pageSize,
  })

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-600">Erro ao carregar transações.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
          Tentar novamente
        </Button>
      </div>
    )
  }

  if (!data || data.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 py-12 text-center">
        <DollarSign className="size-8 text-slate-300" />
        <p className="mt-3 text-sm text-slate-500">Nenhuma transação encontrada</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {data.data.map((t) => (
        <TransactionCard key={t.id} transaction={t} />
      ))}

      {totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            Anterior
          </Button>
          <span className="text-xs text-slate-500">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Passo 4: Verificar tipos**

```bash
npx tsc --noEmit
```

- [ ] **Passo 5: Commit**

```bash
git add src/components/domain/financial/
git commit -m "feat(financial): FinancialDaySummary, TransactionCard e TransactionList"
```

---

## Tarefa 11: Páginas /financeiro e /financeiro/transacoes

**Arquivos:**
- Criar: `src/app/(app)/financeiro/page.tsx`
- Criar: `src/app/(app)/financeiro/transacoes/page.tsx`

- [ ] **Passo 1: Criar `/financeiro/page.tsx`**

```tsx
// src/app/(app)/financeiro/page.tsx
'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FinancialDaySummary } from '@/components/domain/financial/day-summary'
import { TransactionList } from '@/components/domain/financial/transaction-list'
import { usePermissions } from '@/hooks/use-permissions'

function startOfDay(d: Date) {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

function endOfDay(d: Date) {
  const r = new Date(d)
  r.setHours(23, 59, 59, 999)
  return r
}

export default function FinanceiroPage() {
  const { can } = usePermissions()

  if (!can('financial:view')) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm font-medium text-red-700">
            Você não tem permissão para acessar o financeiro.
          </p>
        </div>
      </div>
    )
  }

  const today = new Date()
  const from = startOfDay(today).toISOString()
  const to = endOfDay(today).toISOString()

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          Financeiro
        </h1>
        <p className="mt-1 text-sm text-slate-500">Resumo do dia de hoje</p>
      </div>

      <FinancialDaySummary />

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-950">Transações de hoje</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/financeiro/transacoes" className="flex items-center gap-1 text-slate-500">
              Ver histórico <ArrowRight className="size-3" />
            </Link>
          </Button>
        </div>
        <TransactionList from={from} to={to} pageSize={10} />
      </div>
    </div>
  )
}
```

- [ ] **Passo 2: Criar `/financeiro/transacoes/page.tsx`**

```tsx
// src/app/(app)/financeiro/transacoes/page.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TransactionList } from '@/components/domain/financial/transaction-list'
import { usePermissions } from '@/hooks/use-permissions'

export default function TransacoesPage() {
  const { can } = usePermissions()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)

  if (!can('financial:view')) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm font-medium text-red-700">
            Você não tem permissão para acessar o financeiro.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/financeiro">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            Histórico de transações
          </h1>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row">
        <div className="flex-1 space-y-1">
          <Label className="text-xs">De</Label>
          <Input
            type="date"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setPage(1) }}
          />
        </div>
        <div className="flex-1 space-y-1">
          <Label className="text-xs">Até</Label>
          <Input
            type="date"
            value={to}
            onChange={(e) => { setTo(e.target.value); setPage(1) }}
          />
        </div>
      </div>

      <TransactionList
        from={from ? new Date(from + 'T00:00:00').toISOString() : undefined}
        to={to ? new Date(to + 'T23:59:59').toISOString() : undefined}
        page={page}
        pageSize={20}
        onPageChange={setPage}
      />
    </div>
  )
}
```

- [ ] **Passo 3: Verificar build**

```bash
npm run build
```

Esperado: rotas `/financeiro` e `/financeiro/transacoes` compiladas.

- [ ] **Passo 4: Commit**

```bash
git add src/app/(app)/financeiro/
git commit -m "feat(financial): paginas /financeiro e /financeiro/transacoes com filtro por data"
```

---

## Tarefa 12: Prisma migration — TenantInvite

**Arquivos:**
- Modificar: `prisma/schema.prisma`

- [ ] **Passo 1: Adicionar enum e model no schema**

Abrir `prisma/schema.prisma`. Após o enum `NotificationStatus`, adicionar:

```prisma
enum InviteStatus {
  PENDING
  ACCEPTED
}
```

Após o model `User`, adicionar:

```prisma
model TenantInvite {
  id        String       @id @default(cuid())
  tenantId  String
  email     String
  role      UserRole
  status    InviteStatus @default(PENDING)
  expiresAt DateTime
  createdAt DateTime     @default(now())
  tenant    Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, email])
  @@index([tenantId])
  @@index([email, status])
}
```

No model `Tenant`, adicionar no final da lista de relações:

```prisma
  invites      TenantInvite[]
```

- [ ] **Passo 2: Gerar e aplicar a migration**

```bash
npx prisma migrate dev --name add-tenant-invite
```

Esperado: migration aplicada com sucesso; Prisma Client regenerado.

- [ ] **Passo 3: Verificar tipos Prisma**

```bash
npx tsc --noEmit
```

- [ ] **Passo 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "chore(db): adiciona TenantInvite e InviteStatus ao schema Prisma"
```

---

## Tarefa 13: Backend IAM — users + invites + join

**Arquivos:**
- Modificar: `src/domains/iam/iam.repository.ts`
- Modificar: `src/domains/iam/iam.service.ts`
- Criar: `src/app/api/iam/users/route.ts`
- Criar: `src/app/api/iam/users/[userId]/route.ts`
- Criar: `src/app/api/iam/invites/route.ts`
- Criar: `src/app/api/iam/join/route.ts`

- [ ] **Passo 1: Adicionar métodos ao `iam.repository.ts`**

Abrir `src/domains/iam/iam.repository.ts`. Após `findTenantBySlug`, adicionar:

```typescript
  async findAllUsers(tenantId: string) {
    return prisma.user.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    })
  }

  async findUserById(tenantId: string, userId: string) {
    return prisma.user.findFirst({
      where: { id: userId, tenantId },
    })
  }

  async updateUserRole(tenantId: string, userId: string, role: UserRole) {
    const { ROLE_PERMISSIONS } = await import('@/shared/auth/permissions')
    await prisma.user.updateMany({
      where: { id: userId, tenantId },
      data: { role, permissions: ROLE_PERMISSIONS[role] },
    })
    return prisma.user.findFirstOrThrow({
      where: { id: userId, tenantId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    })
  }

  async createInvite(tenantId: string, email: string, role: UserRole) {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)
    return prisma.tenantInvite.upsert({
      where: { tenantId_email: { tenantId, email } },
      update: { role, status: 'PENDING', expiresAt },
      create: { tenantId, email, role, expiresAt },
    })
  }

  async findInvites(tenantId: string) {
    return prisma.tenantInvite.findMany({
      where: { tenantId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findInviteByEmailAndTenant(email: string, tenantId: string) {
    return prisma.tenantInvite.findFirst({
      where: { email, tenantId, status: 'PENDING' },
    })
  }

  async acceptInvite(inviteId: string) {
    await prisma.tenantInvite.update({
      where: { id: inviteId },
      data: { status: 'ACCEPTED' },
    })
  }

  async createUserInTenant(input: {
    userId: string
    tenantId: string
    email: string
    name: string
    role: UserRole
  }) {
    const { ROLE_PERMISSIONS } = await import('@/shared/auth/permissions')
    return prisma.user.create({
      data: {
        id: input.userId,
        tenantId: input.tenantId,
        email: input.email,
        name: input.name,
        role: input.role,
        permissions: ROLE_PERMISSIONS[input.role],
      },
    })
  }
```

- [ ] **Passo 2: Adicionar métodos ao `iam.service.ts`**

Abrir `src/domains/iam/iam.service.ts`. O arquivo atual tem `getCurrentUser` e `register`. Adicionar após `register`:

```typescript
  async listUsers(tenantId: string) {
    return iamRepository.findAllUsers(tenantId)
  }

  async updateUserRole(
    tenantId: string,
    requesterId: string,
    targetUserId: string,
    role: UserRole,
  ) {
    if (requesterId === targetUserId) {
      throw new ForbiddenError('Voce nao pode alterar seu proprio papel.')
    }
    const target = await iamRepository.findUserById(tenantId, targetUserId)
    if (!target) throw new UserNotFoundError()
    if (target.role === UserRole.OWNER) {
      throw new ForbiddenError('O papel de OWNER nao pode ser alterado.')
    }
    return iamRepository.updateUserRole(tenantId, targetUserId, role)
  }

  async createInvite(tenantId: string, email: string, role: UserRole) {
    const invite = await iamRepository.createInvite(tenantId, email, role)
    await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { pendingTenantId: tenantId, pendingRole: role },
    })
    return invite
  }

  async listInvites(tenantId: string) {
    return iamRepository.findInvites(tenantId)
  }

  async joinTenant(
    userId: string,
    email: string,
    pendingTenantId: string,
    pendingRole: UserRole,
    userName: string,
  ) {
    const invite = await iamRepository.findInviteByEmailAndTenant(email, pendingTenantId)
    if (!invite) throw new ForbiddenError('Convite nao encontrado ou expirado.')

    const user = await iamRepository.createUserInTenant({
      userId,
      tenantId: pendingTenantId,
      email,
      name: userName,
      role: pendingRole,
    })

    await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: { tenantId: pendingTenantId, role: pendingRole },
    })

    await iamRepository.acceptInvite(invite.id)

    return user
  }
```

No topo de `iam.service.ts`, adicionar os imports que estiverem faltando:

```typescript
import { ForbiddenError, UserNotFoundError } from '@/shared/errors'
import { UserRole } from '@prisma/client'
import { supabaseAdmin } from '@/integrations/supabase/admin'
import { iamRepository } from './iam.repository'
```

- [ ] **Passo 3: Criar `GET/PATCH` para `/api/iam/users/route.ts`**

```typescript
// src/app/api/iam/users/route.ts
import { iamService } from '@/domains/iam/iam.service'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { ensurePermission, PERMISSIONS } from '@/shared/auth/permissions'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.users.view)
    const users = await iamService.listUsers(session.tenantId)
    return Response.json(users)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Passo 4: Criar `PATCH /api/iam/users/[userId]/route.ts`**

```typescript
// src/app/api/iam/users/[userId]/route.ts
import { z } from 'zod'
import { UserRole } from '@prisma/client'
import { iamService } from '@/domains/iam/iam.service'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { ensurePermission, PERMISSIONS } from '@/shared/auth/permissions'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'

const updateRoleSchema = z.object({
  role: z.enum([UserRole.MANAGER, UserRole.PROFESSIONAL, UserRole.RECEPTIONIST]),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.users.manage)
    const { userId } = await params
    const { role } = await validateInput(request, updateRoleSchema)
    const updated = await iamService.updateUserRole(
      session.tenantId,
      session.userId,
      userId,
      role,
    )
    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Passo 5: Criar `GET/POST /api/iam/invites/route.ts`**

```typescript
// src/app/api/iam/invites/route.ts
import { z } from 'zod'
import { UserRole } from '@prisma/client'
import { iamService } from '@/domains/iam/iam.service'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { ensurePermission, PERMISSIONS } from '@/shared/auth/permissions'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { created } from '@/shared/http/responses'

const createInviteSchema = z.object({
  email: z.email(),
  role: z.enum([UserRole.MANAGER, UserRole.PROFESSIONAL, UserRole.RECEPTIONIST]),
})

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.users.view)
    const invites = await iamService.listInvites(session.tenantId)
    return Response.json(invites)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.users.invite)
    const { email, role } = await validateInput(request, createInviteSchema)
    const invite = await iamService.createInvite(session.tenantId, email, role)
    return created(invite)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Passo 6: Criar `POST /api/iam/join/route.ts`**

Este endpoint NÃO usa `getSessionContext` porque o usuário ainda não tem `tenantId` no JWT.

```typescript
// src/app/api/iam/join/route.ts
import { z } from 'zod'
import { UserRole } from '@prisma/client'
import { iamService } from '@/domains/iam/iam.service'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { handleApiError } from '@/shared/http/handle-api-error'
import { UnauthorizedError, ForbiddenError } from '@/shared/errors'
import { createSupabaseServerClient } from '@/integrations/supabase/server'

const joinSchema = z.object({
  userName: z.string().min(2),
})

export async function POST(request: Request) {
  initializeDomainRuntime()
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Token ausente.')
    }
    const token = authHeader.slice(7)
    const supabase = createSupabaseServerClient(token)
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) throw new UnauthorizedError('Sessao invalida.')

    const { id: userId, email, user_metadata } = data.user
    if (!email) throw new UnauthorizedError('Email nao encontrado na sessao.')

    const pendingTenantId = user_metadata?.pendingTenantId as string | undefined
    const pendingRoleRaw = user_metadata?.pendingRole as string | undefined

    if (!pendingTenantId || !pendingRoleRaw) {
      throw new ForbiddenError('Nenhum convite pendente encontrado para este usuario.')
    }

    if (!Object.values(UserRole).includes(pendingRoleRaw as UserRole)) {
      throw new ForbiddenError('Papel do convite invalido.')
    }

    const body = await request.json()
    const parsed = joinSchema.safeParse(body)
    const userName = parsed.success ? parsed.data.userName : email.split('@')[0]

    const user = await iamService.joinTenant(
      userId,
      email,
      pendingTenantId,
      pendingRoleRaw as UserRole,
      userName,
    )

    return Response.json({ tenantId: pendingTenantId, userId: user.id }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Passo 7: Verificar tipos**

```bash
npx tsc --noEmit
```

- [ ] **Passo 8: Commit**

```bash
git add src/domains/iam/ src/app/api/iam/
git commit -m "feat(iam): APIs de equipe (/users, /invites, /join) com sistema de convites via Supabase"
```

---

## Tarefa 14: Onboarding — detectar convite pendente

**Arquivos:**
- Modificar: `src/app/(auth)/onboarding/page.tsx`

- [ ] **Passo 1: Reescrever a página de onboarding**

O arquivo atual tem ~141 linhas. Substituir o conteúdo completo por:

```tsx
// src/app/(auth)/onboarding/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createSupabaseBrowserClient } from '@/integrations/supabase/client'

type Mode = 'loading' | 'create' | 'join'

export default function OnboardingPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('loading')
  const [pendingTenantId, setPendingTenantId] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [userName, setUserName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata
      if (meta?.pendingTenantId) {
        setPendingTenantId(meta.pendingTenantId as string)
        setUserName(meta.full_name ?? meta.name ?? '')
        setMode('join')
      } else {
        setUserName(meta?.full_name ?? meta?.name ?? '')
        setMode('create')
      }
    })
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const supabase = createSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { toast.error('Sessão expirada.'); router.push('/login'); return }

      const res = await fetch('/api/iam/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ businessName, userName }),
      })
      if (!res.ok) {
        const body = await res.json()
        toast.error(body.error?.message ?? 'Erro ao configurar sua conta.')
        return
      }
      toast.success('Tudo pronto! Bem-vindo ao workspace.')
      router.push('/dashboard')
      router.refresh()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const supabase = createSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { toast.error('Sessão expirada.'); router.push('/login'); return }

      const res = await fetch('/api/iam/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userName }),
      })
      if (!res.ok) {
        const body = await res.json()
        toast.error(body.error?.message ?? 'Erro ao ingressar no workspace.')
        return
      }
      toast.success('Bem-vindo à equipe!')
      router.push('/agenda')
      router.refresh()
    } finally {
      setIsSubmitting(false)
    }
  }

  if (mode === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex size-10 items-center justify-center rounded-xl bg-[#191919]">
          <Sparkles className="size-5 text-white" />
        </div>

        {mode === 'create' ? (
          <>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#191919]">Quase lá!</h1>
              <p className="mt-2 text-sm text-[#787774]">
                Como se chama seu negócio? Você pode alterar isso depois.
              </p>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nome do negócio</Label>
                <Input
                  placeholder="Ex: Barbearia do João"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                  minLength={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Seu nome</Label>
                <Input
                  placeholder="Nome completo"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  required
                  minLength={2}
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-[#191919] text-white hover:bg-[#2d2d2d]"
                disabled={isSubmitting}
              >
                {isSubmitting ? <><Loader2 className="mr-2 size-4 animate-spin" />Configurando...</> : 'Começar →'}
              </Button>
            </form>
          </>
        ) : (
          <>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#191919]">Você foi convidado!</h1>
              <p className="mt-2 text-sm text-[#787774]">
                Como você quer ser chamado pela equipe?
              </p>
            </div>
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Seu nome</Label>
                <Input
                  placeholder="Nome completo"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  required
                  minLength={2}
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-[#191919] text-white hover:bg-[#2d2d2d]"
                disabled={isSubmitting}
              >
                {isSubmitting ? <><Loader2 className="mr-2 size-4 animate-spin" />Entrando...</> : 'Entrar na equipe →'}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Passo 2: Verificar tipos**

```bash
npx tsc --noEmit
```

- [ ] **Passo 3: Commit**

```bash
git add src/app/(auth)/onboarding/page.tsx
git commit -m "feat(iam): onboarding detecta pendingTenantId e redireciona para fluxo de join"
```

---

## Tarefa 15: Hooks IAM — use-team.ts

**Arquivos:**
- Criar: `src/hooks/iam/use-team.ts`

- [ ] **Passo 1: Criar o arquivo**

```typescript
// src/hooks/iam/use-team.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export type UserRole = 'OWNER' | 'MANAGER' | 'PROFESSIONAL' | 'RECEPTIONIST'

export type TeamMember = {
  id: string
  name: string
  email: string
  role: UserRole
  createdAt: string
}

export type TeamInvite = {
  id: string
  email: string
  role: UserRole
  status: 'PENDING' | 'ACCEPTED'
  expiresAt: string
  createdAt: string
}

async function fetchTeamMembers(): Promise<TeamMember[]> {
  const res = await fetch('/api/iam/users')
  if (!res.ok) throw new Error('Falha ao carregar equipe')
  return res.json()
}

async function fetchInvites(): Promise<TeamInvite[]> {
  const res = await fetch('/api/iam/invites')
  if (!res.ok) throw new Error('Falha ao carregar convites')
  return res.json()
}

async function createInvite(input: {
  email: string
  role: Exclude<UserRole, 'OWNER'>
}): Promise<TeamInvite> {
  const res = await fetch('/api/iam/invites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? 'Falha ao enviar convite')
  }
  return res.json()
}

async function updateMemberRole(input: {
  userId: string
  role: Exclude<UserRole, 'OWNER'>
}): Promise<TeamMember> {
  const res = await fetch(`/api/iam/users/${input.userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: input.role }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? 'Falha ao atualizar papel')
  }
  return res.json()
}

export function useTeamMembers() {
  return useQuery({
    queryKey: ['team-members'],
    queryFn: fetchTeamMembers,
    staleTime: 60 * 1000,
  })
}

export function useTeamInvites() {
  return useQuery({
    queryKey: ['team-invites'],
    queryFn: fetchInvites,
    staleTime: 60 * 1000,
  })
}

export function useInviteMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createInvite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-invites'] })
    },
  })
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateMemberRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
    },
  })
}
```

- [ ] **Passo 2: Verificar tipos**

```bash
npx tsc --noEmit
```

- [ ] **Passo 3: Commit**

```bash
git add src/hooks/iam/
git commit -m "feat(iam): hooks useTeamMembers, useTeamInvites, useInviteMember, useUpdateMemberRole"
```

---

## Tarefa 16: TeamMemberCard + InviteMemberModal

**Arquivos:**
- Criar: `src/components/domain/iam/team-member-card.tsx`
- Criar: `src/components/domain/iam/invite-member-modal.tsx`

- [ ] **Passo 1: Criar `team-member-card.tsx`**

```tsx
// src/components/domain/iam/team-member-card.tsx
'use client'

import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useUpdateMemberRole, type TeamMember, type UserRole } from '@/hooks/iam/use-team'
import { useCurrentUser } from '@/hooks/use-current-user'
import { cn } from '@/lib/utils'

const ROLE_LABELS: Record<UserRole, string> = {
  OWNER:         'Dono',
  MANAGER:       'Gerente',
  PROFESSIONAL:  'Profissional',
  RECEPTIONIST:  'Recepcionista',
}

const ROLE_COLORS: Record<UserRole, string> = {
  OWNER:         'bg-slate-950 text-white',
  MANAGER:       'bg-blue-100 text-blue-700',
  PROFESSIONAL:  'bg-emerald-100 text-emerald-700',
  RECEPTIONIST:  'bg-purple-100 text-purple-700',
}

type Props = {
  member: TeamMember
  canManage: boolean
}

export function TeamMemberCard({ member, canManage }: Props) {
  const { data: currentUser } = useCurrentUser()
  const updateRole = useUpdateMemberRole()
  const isCurrentUser = currentUser?.id === member.id
  const isOwner = member.role === 'OWNER'
  const canEditRole = canManage && !isCurrentUser && !isOwner

  function handleRoleChange(newRole: string) {
    updateRole.mutate(
      { userId: member.id, role: newRole as Exclude<UserRole, 'OWNER'> },
      {
        onSuccess: () => toast.success('Papel atualizado'),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro ao atualizar'),
      },
    )
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
        {member.name.slice(0, 2).toUpperCase()}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-950">{member.name}</p>
          {isCurrentUser && (
            <span className="text-xs text-slate-400">(você)</span>
          )}
        </div>
        <p className="text-xs text-slate-500">{member.email}</p>
      </div>

      {canEditRole ? (
        <Select
          value={member.role}
          onValueChange={handleRoleChange}
          disabled={updateRole.isPending}
        >
          <SelectTrigger className="w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MANAGER">Gerente</SelectItem>
            <SelectItem value="PROFESSIONAL">Profissional</SelectItem>
            <SelectItem value="RECEPTIONIST">Recepcionista</SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <Badge className={cn('text-xs', ROLE_COLORS[member.role])}>
          {ROLE_LABELS[member.role]}
        </Badge>
      )}
    </div>
  )
}
```

- [ ] **Passo 2: Criar `invite-member-modal.tsx`**

```tsx
// src/components/domain/iam/invite-member-modal.tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useInviteMember, type UserRole } from '@/hooks/iam/use-team'

type Props = {
  open: boolean
  onClose: () => void
}

export function InviteMemberModal({ open, onClose }: Props) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Exclude<UserRole, 'OWNER'> | ''>('')
  const invite = useInviteMember()

  function handleClose() {
    setEmail('')
    setRole('')
    onClose()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !role) return

    invite.mutate(
      { email: email.trim(), role: role as Exclude<UserRole, 'OWNER'> },
      {
        onSuccess: () => {
          toast.success(`Convite enviado para ${email}`)
          handleClose()
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Erro ao enviar convite')
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Convidar membro</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>E-mail *</Label>
            <Input
              type="email"
              placeholder="profissional@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Papel *</Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as Exclude<UserRole, 'OWNER'>)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o papel..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MANAGER">Gerente</SelectItem>
                <SelectItem value="PROFESSIONAL">Profissional</SelectItem>
                <SelectItem value="RECEPTIONIST">Recepcionista</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-slate-500">
            Um e-mail de convite será enviado. O link expira em 7 dias.
          </p>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleClose}
              disabled={invite.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-slate-950 text-white hover:bg-slate-800"
              disabled={!email || !role || invite.isPending}
            >
              {invite.isPending ? 'Enviando...' : 'Enviar convite'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Passo 3: Verificar tipos**

```bash
npx tsc --noEmit
```

- [ ] **Passo 4: Commit**

```bash
git add src/components/domain/iam/
git commit -m "feat(iam): TeamMemberCard com troca de papel inline e InviteMemberModal"
```

---

## Tarefa 17: Página /equipe

**Arquivos:**
- Criar: `src/app/(app)/equipe/page.tsx`

- [ ] **Passo 1: Criar a página**

```tsx
// src/app/(app)/equipe/page.tsx
'use client'

import { useState } from 'react'
import { UserPlus, Users, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { TeamMemberCard } from '@/components/domain/iam/team-member-card'
import { InviteMemberModal } from '@/components/domain/iam/invite-member-modal'
import { useTeamMembers, useTeamInvites, type UserRole } from '@/hooks/iam/use-team'
import { usePermissions } from '@/hooks/use-permissions'

const ROLE_LABELS: Record<UserRole, string> = {
  OWNER: 'Dono', MANAGER: 'Gerente',
  PROFESSIONAL: 'Profissional', RECEPTIONIST: 'Recepcionista',
}

export default function EquipePage() {
  const [inviteOpen, setInviteOpen] = useState(false)
  const { can } = usePermissions()

  if (!can('users:view')) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm font-medium text-red-700">
            Apenas donos e gerentes podem acessar a gestão de equipe.
          </p>
        </div>
      </div>
    )
  }

  const {
    data: members,
    isLoading: loadingMembers,
    isError: errorMembers,
    refetch: refetchMembers,
  } = useTeamMembers()

  const {
    data: invites,
    isLoading: loadingInvites,
  } = useTeamInvites()

  const canManage = can('users:manage')
  const canInvite = can('users:invite')

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            Equipe
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Gerencie os membros e convites do seu negócio
          </p>
        </div>
        {canInvite && (
          <Button
            onClick={() => setInviteOpen(true)}
            className="rounded-full bg-slate-950 text-white hover:bg-slate-800"
          >
            <UserPlus className="size-4" />
            <span className="hidden sm:inline">Convidar</span>
          </Button>
        )}
      </div>

      {/* Membros ativos */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Membros ativos
        </h2>

        {loadingMembers ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        ) : errorMembers ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-sm text-red-600">Erro ao carregar equipe.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetchMembers()}>
              Tentar novamente
            </Button>
          </div>
        ) : !members || members.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 py-12 text-center">
            <Users className="size-8 text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">Nenhum membro ainda</p>
          </div>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <TeamMemberCard
                key={member.id}
                member={member}
                canManage={canManage}
              />
            ))}
          </div>
        )}
      </div>

      {/* Convites pendentes */}
      {!loadingInvites && invites && invites.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Convites pendentes
          </h2>
          <div className="space-y-3">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-4"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-200">
                  <Mail className="size-4 text-slate-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700">
                    {invite.email}
                  </p>
                  <p className="text-xs text-slate-400">
                    Expira em{' '}
                    {new Date(invite.expiresAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <Badge className="shrink-0 bg-amber-100 text-amber-700 text-xs">
                  {ROLE_LABELS[invite.role]}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <InviteMemberModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  )
}
```

- [ ] **Passo 2: Verificar build**

```bash
npm run build
```

Esperado: rota `/equipe` compilada sem erros.

- [ ] **Passo 3: Commit**

```bash
git add src/app/(app)/equipe/page.tsx
git commit -m "feat(iam): pagina /equipe com membros ativos, convites pendentes e troca de papel"
```

---

## Tarefa 18: Build final e PR

- [ ] **Passo 1: Verificar tipos e build completo**

```bash
npx tsc --noEmit && npm run build
```

Esperado: zero erros de TypeScript; todas as rotas compiladas.

- [ ] **Passo 2: Verificar rotas compiladas**

Confirmar que o output do build inclui:
- `○ /clientes`
- `ƒ /clientes/[id]`
- `○ /financeiro`
- `○ /financeiro/transacoes`
- `○ /equipe`

- [ ] **Passo 3: Criar a PR**

```bash
git push -u origin feat/crm-financeiro-equipe
gh pr create \
  --title "feat(crm+financial+iam): telas de clientes, financeiro e equipe" \
  --base main \
  --body "## O que foi implementado

- API GET /api/crm/customers/[customerId] com histórico de agendamentos
- Hooks: useCustomers, useCustomer, useCreateCustomer, useUpdateCustomer
- Telas /clientes (lista) e /clientes/[id] (perfil + histórico)
- Hooks: useTransactions, useCreateTransaction
- RegisterPaymentModal integrado ao drawer ao concluir atendimento
- Telas /financeiro (resumo do dia) e /financeiro/transacoes (histórico com filtro)
- TenantInvite no Prisma: sistema de convites por e-mail via Supabase Admin
- APIs: GET/POST /api/iam/users, PATCH /api/iam/users/[userId], GET/POST /api/iam/invites, POST /api/iam/join
- Onboarding detecta pendingTenantId e exibe fluxo de ingresso na equipe
- Hooks: useTeamMembers, useTeamInvites, useInviteMember, useUpdateMemberRole
- Tela /equipe com membros ativos, convites pendentes e troca de papel inline

## Critérios atendidos

- [x] Busca por nome/telefone com debounce na lista de clientes
- [x] Perfil do cliente com histórico completo de atendimentos
- [x] Pagamento registrado automaticamente ao concluir atendimento
- [x] Resumo financeiro do dia com receita, transações e ticket médio
- [x] Filtro por data no histórico de transações
- [x] Apenas OWNER/MANAGER acessa /financeiro e /equipe
- [x] Convites via e-mail com papel pré-definido
- [x] Troca de papel inline sem modal separado
- [x] Convites pendentes visíveis separados dos membros ativos"
```

---

## Planos subsequentes

- **Plano 3:** `2026-05-22-notificacoes-whatsapp.md` — DB + backend + frontend de configurações de notificações WhatsApp
- **Plano 4:** `2026-05-22-automacoes.md` — DB + backend + frontend de automações
