# Cancelar Convite Pendente — Aba Equipe

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o dono do tenant (OWNER) cancele convites pendentes na aba Equipe, removendo o registro do banco e invalidando o link enviado por email.

**Architecture:** Nova rota `DELETE /api/iam/invites/[id]` com verificação `session.isOwner`, novo método `cancelInvite` no service e `deleteInvite` no repository (hard delete com filtro `status: PENDING`). Na UI, um botão X por convite abre um `AlertDialog` de confirmação antes de executar a mutation.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma, TanStack Query, Shadcn UI (AlertDialog), Vitest

---

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| `src/domains/iam/iam.repository.ts` | Modificar — adicionar `deleteInvite()` |
| `src/domains/iam/iam.repository.test.ts` | Criar — testes de `deleteInvite` |
| `src/domains/iam/iam.service.ts` | Modificar — adicionar `cancelInvite()` |
| `src/domains/iam/iam.service.test.ts` | Criar — testes de `cancelInvite` |
| `src/app/api/iam/invites/[id]/route.ts` | Criar — endpoint DELETE |
| `src/hooks/iam/use-team.ts` | Modificar — adicionar `useCancelInvite()` |
| `src/app/(app)/equipe/page.tsx` | Modificar — botão X + AlertDialog |

---

## Task 1: Repository — `deleteInvite`

**Files:**
- Modify: `src/domains/iam/iam.repository.ts`
- Create: `src/domains/iam/iam.repository.test.ts`

- [ ] **Step 1: Criar arquivo de teste com caso de sucesso**

Criar `src/domains/iam/iam.repository.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { prismaMock } from '@/shared/test/prisma-mock'
import { IamRepository } from './iam.repository'

const TENANT_ID = 'tenant-abc'
const INVITE_ID = 'invite-xyz'

describe('IamRepository.deleteInvite', () => {
  let repo: IamRepository

  beforeEach(() => {
    repo = new IamRepository()
  })

  it('deleta convite PENDING filtrando tenantId e id', async () => {
    prismaMock.tenantInvite.deleteMany.mockResolvedValue({ count: 1 })

    const result = await repo.deleteInvite(TENANT_ID, INVITE_ID)

    expect(prismaMock.tenantInvite.deleteMany).toHaveBeenCalledWith({
      where: { id: INVITE_ID, tenantId: TENANT_ID, status: 'PENDING' },
    })
    expect(result.count).toBe(1)
  })

  it('retorna count 0 quando convite não existe ou já foi aceito', async () => {
    prismaMock.tenantInvite.deleteMany.mockResolvedValue({ count: 0 })

    const result = await repo.deleteInvite(TENANT_ID, 'inexistente')

    expect(result.count).toBe(0)
  })
})
```

- [ ] **Step 2: Executar o teste e confirmar que falha**

```bash
npx vitest run src/domains/iam/iam.repository.test.ts
```

Esperado: FAIL — `repo.deleteInvite is not a function`

- [ ] **Step 3: Adicionar `deleteInvite` ao repository**

Em `src/domains/iam/iam.repository.ts`, adicionar após o método `acceptInvite` (linha 166):

```typescript
  async deleteInvite(tenantId: string, inviteId: string) {
    return prisma.tenantInvite.deleteMany({
      where: { id: inviteId, tenantId, status: 'PENDING' },
    })
  }
```

- [ ] **Step 4: Executar o teste e confirmar que passa**

```bash
npx vitest run src/domains/iam/iam.repository.test.ts
```

Esperado: PASS — 2 testes passando

- [ ] **Step 5: Commit**

```bash
git add src/domains/iam/iam.repository.ts src/domains/iam/iam.repository.test.ts
git commit -m "feat(iam): adiciona deleteInvite ao repository"
```

---

## Task 2: Service — `cancelInvite`

**Files:**
- Modify: `src/domains/iam/iam.service.ts`
- Create: `src/domains/iam/iam.service.test.ts`

- [ ] **Step 1: Criar arquivo de teste**

Criar `src/domains/iam/iam.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundError } from '@/shared/errors'

vi.mock('./iam.repository', () => ({
  iamRepository: {
    deleteInvite: vi.fn(),
  },
}))

vi.mock('@/integrations/supabase/admin', () => ({
  supabaseAdmin: { auth: { admin: {} } },
}))

vi.mock('@/domains/billing/billing.service', () => ({
  billingService: {},
}))

vi.mock('@/domains/billing/feature-guard', () => ({
  featureGuard: {},
}))

vi.mock('@/shared/database/prisma', () => ({
  prisma: {},
}))

import { iamRepository } from './iam.repository'
import { IamService } from './iam.service'

const TENANT_ID = 'tenant-abc'
const INVITE_ID = 'invite-xyz'

describe('IamService.cancelInvite', () => {
  let service: IamService

  beforeEach(() => {
    service = new IamService()
    vi.clearAllMocks()
  })

  it('cancela convite quando encontrado', async () => {
    vi.mocked(iamRepository.deleteInvite).mockResolvedValue({ count: 1 })

    await expect(service.cancelInvite(TENANT_ID, INVITE_ID)).resolves.toBeUndefined()
    expect(iamRepository.deleteInvite).toHaveBeenCalledWith(TENANT_ID, INVITE_ID)
  })

  it('lança NotFoundError quando convite não existe ou já foi aceito', async () => {
    vi.mocked(iamRepository.deleteInvite).mockResolvedValue({ count: 0 })

    await expect(service.cancelInvite(TENANT_ID, INVITE_ID)).rejects.toThrow(NotFoundError)
  })
})
```

- [ ] **Step 2: Executar o teste e confirmar que falha**

```bash
npx vitest run src/domains/iam/iam.service.test.ts
```

Esperado: FAIL — `service.cancelInvite is not a function`

- [ ] **Step 3: Adicionar `cancelInvite` ao service**

Em `src/domains/iam/iam.service.ts`, adicionar após o método `listInvites` (linha 137):

```typescript
  async cancelInvite(tenantId: string, inviteId: string): Promise<void> {
    const { count } = await iamRepository.deleteInvite(tenantId, inviteId)
    if (count === 0) throw new NotFoundError('Convite')
  }
```

- [ ] **Step 4: Executar o teste e confirmar que passa**

```bash
npx vitest run src/domains/iam/iam.service.test.ts
```

Esperado: PASS — 2 testes passando

- [ ] **Step 5: Commit**

```bash
git add src/domains/iam/iam.service.ts src/domains/iam/iam.service.test.ts
git commit -m "feat(iam): adiciona cancelInvite ao service"
```

---

## Task 3: API Route — `DELETE /api/iam/invites/[id]`

**Files:**
- Create: `src/app/api/iam/invites/[id]/route.ts`

- [ ] **Step 1: Criar o arquivo da rota**

Criar `src/app/api/iam/invites/[id]/route.ts`:

```typescript
import { iamService } from '@/domains/iam/iam.service'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { ForbiddenError } from '@/shared/errors'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    if (!session.isOwner) throw new ForbiddenError('Apenas o dono pode cancelar convites.')
    const { id } = await params
    await iamService.cancelInvite(session.tenantId, id)
    return new Response(null, { status: 204 })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: zero erros

- [ ] **Step 3: Commit**

```bash
git add src/app/api/iam/invites/[id]/route.ts
git commit -m "feat(iam): endpoint DELETE /api/iam/invites/[id]"
```

---

## Task 4: Hook — `useCancelInvite`

**Files:**
- Modify: `src/hooks/iam/use-team.ts`

- [ ] **Step 1: Adicionar função fetcher e hook ao arquivo**

Em `src/hooks/iam/use-team.ts`, adicionar após a função `updateMemberRole` (linha 62) e antes de `useTeamMembers`:

```typescript
async function cancelInvite(inviteId: string): Promise<void> {
  const res = await fetch(`/api/iam/invites/${inviteId}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? 'Falha ao cancelar convite')
  }
}
```

Adicionar o hook após `useInviteMember` (linha 88):

```typescript
export function useCancelInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: cancelInvite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-invites'] })
    },
  })
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: zero erros

- [ ] **Step 3: Commit**

```bash
git add src/hooks/iam/use-team.ts
git commit -m "feat(iam): hook useCancelInvite"
```

---

## Task 5: UI — Botão X e AlertDialog na página de Equipe

**Files:**
- Modify: `src/app/(app)/equipe/page.tsx`

- [ ] **Step 1: Atualizar imports**

Substituir o bloco de imports atual no topo de `src/app/(app)/equipe/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { UserPlus, Users, Mail, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { TeamMemberCard } from '@/components/domain/iam/team-member-card'
import { InviteMemberModal } from '@/components/domain/iam/invite-member-modal'
import { useTeamMembers, useTeamInvites, useCancelInvite, type UserRole } from '@/hooks/iam/use-team'
import { usePermissions } from '@/hooks/use-permissions'
```

- [ ] **Step 2: Adicionar estado do AlertDialog e mutation na função do componente**

Logo após `const canInvite = can('equipe', 'create')` (linha 33), adicionar:

```typescript
  const [cancelingInviteId, setCancelingInviteId] = useState<string | null>(null)
  const cancelMutation = useCancelInvite()

  function handleConfirmCancel() {
    if (!cancelingInviteId) return
    cancelMutation.mutate(cancelingInviteId, {
      onSuccess: () => {
        toast.success('Convite cancelado')
        setCancelingInviteId(null)
      },
      onError: (err) => {
        toast.error(err.message)
        setCancelingInviteId(null)
      },
    })
  }

  const cancelingInvite = invites?.find((i) => i.id === cancelingInviteId)
```

- [ ] **Step 3: Substituir a seção de convites pendentes**

Localizar o bloco `{/* Convites pendentes */}` (linha 106) e substituir pelo seguinte — que inclui o botão X em cada convite e o AlertDialog de confirmação:

```tsx
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
                {user?.isOwner && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 size-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                    disabled={cancelMutation.isPending && cancelingInviteId === invite.id}
                    onClick={() => setCancelingInviteId(invite.id)}
                    aria-label="Cancelar convite"
                  >
                    {cancelMutation.isPending && cancelingInviteId === invite.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <X className="size-4" />
                    )}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AlertDialog de confirmação */}
      <AlertDialog
        open={cancelingInviteId !== null && !cancelMutation.isPending}
        onOpenChange={(open) => { if (!open) setCancelingInviteId(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar convite</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja cancelar o convite enviado para{' '}
              <span className="font-medium text-slate-900">{cancelingInvite?.email}</span>?
              {' '}O link do email deixará de funcionar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter convite</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleConfirmCancel}
            >
              Cancelar convite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
```

- [ ] **Step 4: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: zero erros

- [ ] **Step 5: Executar todos os testes**

```bash
npx vitest run src/domains/iam/iam.repository.test.ts src/domains/iam/iam.service.test.ts
```

Esperado: PASS — 4 testes passando

- [ ] **Step 6: Commit final**

```bash
git add src/app/(app)/equipe/page.tsx
git commit -m "feat(iam): cancela convite pendente na aba equipe (apenas OWNER)"
```
