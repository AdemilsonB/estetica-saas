# Agenda UX — Melhorias de Layout e Fluxo de Confirmação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir layout da agenda (painel, cards, filtro) e adicionar fluxo de confirmação com valor editável e mensagem WhatsApp.

**Architecture:** Campo `confirmedPrice` adicionado ao modelo `Appointment` via migration. O fluxo de confirmação usa um novo modal que salva esse valor via PATCH `status`. O `RegisterPaymentModal` lê `confirmedPrice` do objeto de agendamento. Correções visuais são independentes e não tocam no backend.

**Tech Stack:** Next.js 15, Prisma, Zod, TanStack Query, React, Shadcn UI, Vitest, Testing Library

---

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` | Modificar — adicionar `confirmedPrice` ao model Appointment |
| `src/domains/scheduling/types.ts` | Modificar — `updateAppointmentStatusSchema` aceita `confirmedPrice` |
| `src/domains/scheduling/appointment.repository.ts` | Modificar — `updateStatus` persiste `confirmedPrice` |
| `src/domains/scheduling/scheduling.service.ts` | Modificar — passa `confirmedPrice`; envia `notificationMessage` no CONFIRMED |
| `src/hooks/scheduling/use-appointments.ts` | Modificar — tipo `Appointment` + hook `useUpdateAppointmentStatus` |
| `src/components/domain/scheduling/appointment-card.tsx` | Modificar — ícone `Pencil`, botão move para bottom |
| `src/components/domain/scheduling/appointment-drawer.tsx` | Modificar — largura `sm:max-w-lg`; integra `ConfirmAppointmentModal` |
| `src/components/domain/scheduling/ProfessionalFilter.tsx` | Modificar — Select All, sem restrição de desmarcar |
| `src/components/domain/scheduling/__tests__/ProfessionalFilter.test.tsx` | Modificar — atualizar testes para novo comportamento |
| `src/components/domain/scheduling/agenda-day-view.tsx` | Modificar — init do filtro; `queryProfessionalId` quando vazio |
| `src/components/domain/scheduling/confirm-appointment-modal.tsx` | Criar — modal de confirmação com valor e mensagem |
| `src/components/domain/financial/register-payment-modal.tsx` | Modificar — usa `confirmedPrice` como base |

---

### Task 1: Migration — campo `confirmedPrice`

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Adicionar campo no schema**

No model `Appointment` (em torno da linha 408, após `price`), adicionar:

```prisma
price           Decimal           @db.Decimal(10, 2)
confirmedPrice  Decimal?          @db.Decimal(10, 2)
```

- [ ] **Step 2: Rodar migration**

```bash
npx prisma migrate dev --name add_confirmed_price_to_appointment
```

Esperado: mensagem `The following migration(s) have been created and applied from new schema changes` e arquivo de migration criado em `prisma/migrations/`.

- [ ] **Step 3: Regenerar client Prisma**

```bash
npx prisma generate
```

Esperado: `Generated Prisma Client`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(scheduling): adicionar campo confirmedPrice ao Appointment"
```

---

### Task 2: Backend — schema de status aceita `confirmedPrice`

**Files:**
- Modify: `src/domains/scheduling/types.ts`

- [ ] **Step 1: Atualizar schema Zod**

Localizar `updateAppointmentStatusSchema` (~linha 52). Trocar:

```typescript
export const updateAppointmentStatusSchema = z.object({
  status: z.nativeEnum(AppointmentStatus),
  notificationMessage: z.string().trim().optional(),
});
```

Por:

```typescript
export const updateAppointmentStatusSchema = z.object({
  status: z.nativeEnum(AppointmentStatus),
  notificationMessage: z.string().trim().optional(),
  confirmedPrice: z.number().positive().optional(),
});
```

- [ ] **Step 2: Verificar que o tipo derivado atualiza**

`UpdateAppointmentStatusInput` é `z.infer<typeof updateAppointmentStatusSchema>` — já inclui `confirmedPrice?: number` automaticamente. Nenhuma alteração adicional necessária.

- [ ] **Step 3: Checar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 4: Commit**

```bash
git add src/domains/scheduling/types.ts
git commit -m "feat(scheduling): confirmedPrice no schema de atualização de status"
```

---

### Task 3: Repository — `updateStatus` persiste `confirmedPrice`

**Files:**
- Modify: `src/domains/scheduling/appointment.repository.ts`

- [ ] **Step 1: Atualizar assinatura e implementação de `updateStatus`**

Substituir o método completo (linhas 96–109):

```typescript
async updateStatus(
  tenantId: string,
  appointmentId: string,
  status: AppointmentStatus,
  confirmedPrice?: number,
) {
  await prisma.appointment.updateMany({
    where: { id: appointmentId, tenantId },
    data: {
      status,
      ...(confirmedPrice !== undefined ? { confirmedPrice } : {}),
    },
  });

  return prisma.appointment.findFirstOrThrow({
    where: { id: appointmentId, tenantId },
  });
}
```

- [ ] **Step 2: Checar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/domains/scheduling/appointment.repository.ts
git commit -m "feat(scheduling): repository updateStatus persiste confirmedPrice"
```

---

### Task 4: Service — passa `confirmedPrice` e envia mensagem no CONFIRMED

**Files:**
- Modify: `src/domains/scheduling/scheduling.service.ts`

- [ ] **Step 1: Escrever teste para o novo comportamento**

Em `src/domains/scheduling/scheduling.service.update.test.ts`, adicionar novo `describe` após os existentes:

```typescript
describe("SchedulingService.updateAppointmentStatus com confirmedPrice", () => {
  let service: SchedulingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SchedulingService();
    vi.mocked(appointmentRepository.findById)
      .mockResolvedValueOnce(mockAppointment as any) // current
      .mockResolvedValueOnce({ ...mockAppointment, status: AppointmentStatus.CONFIRMED, confirmedPrice: 95 } as any); // after update
    vi.mocked(appointmentRepository.updateStatus).mockResolvedValue({
      ...mockAppointment,
      status: AppointmentStatus.CONFIRMED,
    } as any);
  });

  it("chama updateStatus com confirmedPrice quando fornecido", async () => {
    await service.updateAppointmentStatus("tenant-1", "appt-1", {
      status: AppointmentStatus.CONFIRMED,
      confirmedPrice: 95,
    });

    expect(appointmentRepository.updateStatus).toHaveBeenCalledWith(
      "tenant-1",
      "appt-1",
      AppointmentStatus.CONFIRMED,
      95,
    );
  });

  it("publica evento com notificationMessage ao confirmar", async () => {
    await service.updateAppointmentStatus("tenant-1", "appt-1", {
      status: AppointmentStatus.CONFIRMED,
      notificationMessage: "Olá! Confirmado.",
    });

    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ notificationMessage: "Olá! Confirmado." }),
      }),
    );
  });
});
```

- [ ] **Step 2: Rodar testes e confirmar falha**

```bash
npx vitest run src/domains/scheduling/scheduling.service.update.test.ts
```

Esperado: os dois novos testes falham.

- [ ] **Step 3: Atualizar o método `updateAppointmentStatus` no service**

Localizar a chamada ao `appointmentRepository.updateStatus` (~linha 167) e trocar:

```typescript
await appointmentRepository.updateStatus(
  tenantId,
  appointmentId,
  input.status,
);
```

Por:

```typescript
await appointmentRepository.updateStatus(
  tenantId,
  appointmentId,
  input.status,
  input.confirmedPrice,
);
```

E localizar o bloco de publicação do evento (~linha 183) e trocar:

```typescript
...(input.status === AppointmentStatus.CANCELLED
  ? { notificationMessage: input.notificationMessage }
  : {}),
```

Por:

```typescript
...([AppointmentStatus.CANCELLED, AppointmentStatus.CONFIRMED].includes(input.status)
  ? { notificationMessage: input.notificationMessage }
  : {}),
```

- [ ] **Step 4: Rodar testes e confirmar passagem**

```bash
npx vitest run src/domains/scheduling/scheduling.service.update.test.ts
```

Esperado: todos os testes passam.

- [ ] **Step 5: Checar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 6: Commit**

```bash
git add src/domains/scheduling/scheduling.service.ts src/domains/scheduling/scheduling.service.update.test.ts
git commit -m "feat(scheduling): service passa confirmedPrice e notifica cliente ao confirmar"
```

---

### Task 5: Hook — tipo `Appointment` e `useUpdateAppointmentStatus` com `confirmedPrice`

**Files:**
- Modify: `src/hooks/scheduling/use-appointments.ts`

- [ ] **Step 1: Adicionar `confirmedPrice` ao tipo `Appointment`**

Localizar o tipo `Appointment` (~linha 13). Adicionar campo após `price`:

```typescript
export type Appointment = {
  id: string
  customerId: string
  professionalId: string
  serviceId: string
  startsAt: string
  endsAt: string
  status: AppointmentStatus
  paymentStatus: AppointmentPaymentStatus
  notes: string | null
  price: string
  confirmedPrice: string | null
  customer: { id: string; name: string; phone: string | null; notes: string | null }
  professional: { id: string; name: string }
  service: { id: string; name: string; duration: number }
}
```

- [ ] **Step 2: Atualizar função `updateAppointmentStatus` e o hook**

Substituir a função e o hook:

```typescript
async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus,
  notificationMessage?: string,
  confirmedPrice?: number,
): Promise<Appointment> {
  const res = await fetch(`/api/scheduling/appointments/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, notificationMessage, confirmedPrice }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message ?? 'Falha ao atualizar status')
  }
  return res.json()
}

export function useUpdateAppointmentStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      status,
      notificationMessage,
      confirmedPrice,
    }: {
      id: string
      status: AppointmentStatus
      notificationMessage?: string
      confirmedPrice?: number
    }) => updateAppointmentStatus(id, status, notificationMessage, confirmedPrice),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
    },
  })
}
```

- [ ] **Step 3: Checar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/scheduling/use-appointments.ts
git commit -m "feat(scheduling): tipo Appointment com confirmedPrice; hook aceita confirmedPrice"
```

---

### Task 6: AppointmentCard — ícone `Pencil` e reposicionamento

**Files:**
- Modify: `src/components/domain/scheduling/appointment-card.tsx`

- [ ] **Step 1: Trocar import e ícone**

Trocar `CalendarDays` por `Pencil` no import e no JSX:

```typescript
// Linha 2: trocar
import { CalendarDays } from 'lucide-react'
// por
import { Pencil } from 'lucide-react'
```

No JSX, o botão de reagendar está na linha ~81. Trocar:

```tsx
<button
  onClick={(e) => {
    e.stopPropagation()
    onReschedule(appointment)
  }}
  title="Remarcar"
  className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
>
  <CalendarDays className="size-4" />
</button>
```

Por:

```tsx
<button
  onClick={(e) => {
    e.stopPropagation()
    onReschedule(appointment)
  }}
  title="Remarcar"
  className="absolute right-3 bottom-3 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
>
  <Pencil className="size-4" />
</button>
```

- [ ] **Step 2: Checar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/scheduling/appointment-card.tsx
git commit -m "fix(agenda): ícone de remarcar trocado para Pencil e reposicionado"
```

---

### Task 7: AppointmentDrawer — largura `sm:max-w-lg`

**Files:**
- Modify: `src/components/domain/scheduling/appointment-drawer.tsx`

- [ ] **Step 1: Atualizar largura do SheetContent**

Localizar na linha ~89:

```tsx
<SheetContent className="w-full sm:max-w-md flex flex-col">
```

Trocar por:

```tsx
<SheetContent className="w-full sm:max-w-lg flex flex-col">
```

- [ ] **Step 2: Checar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/scheduling/appointment-drawer.tsx
git commit -m "fix(agenda): aumentar largura do painel de detalhes para sm:max-w-lg"
```

---

### Task 8: ProfessionalFilter — Select All e desmarcar todos

**Files:**
- Modify: `src/components/domain/scheduling/ProfessionalFilter.tsx`
- Modify: `src/components/domain/scheduling/__tests__/ProfessionalFilter.test.tsx`

- [ ] **Step 1: Atualizar testes primeiro**

Substituir o conteúdo completo de `ProfessionalFilter.test.tsx`:

```typescript
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ProfessionalFilter } from '../ProfessionalFilter'

vi.mock('@/hooks/iam/use-team', () => ({
  useTeamMembers: () => ({
    data: [
      { id: 'u1', name: 'Ana Silva',      role: 'PROFESSIONAL', email: 'a@t.com', isOwner: false, roleId: 'r1', roleName: 'Profissional', createdAt: '' },
      { id: 'u2', name: 'João Santos',    role: 'PROFESSIONAL', email: 'j@t.com', isOwner: false, roleId: 'r1', roleName: 'Profissional', createdAt: '' },
      { id: 'u3', name: 'Maria Oliveira', role: 'PROFESSIONAL', email: 'm@t.com', isOwner: false, roleId: 'r1', roleName: 'Profissional', createdAt: '' },
    ],
  }),
}))

describe('ProfessionalFilter', () => {
  afterEach(() => cleanup())

  it('exibe "Todos os profissionais" quando nenhum está selecionado', () => {
    render(
      <ProfessionalFilter selectedIds={[]} onChange={() => {}} currentUserId="u1" />,
    )
    expect(screen.getByRole('combobox')).toHaveTextContent('Todos os profissionais')
  })

  it('exibe os nomes quando ≤ 2 profissionais estão selecionados', () => {
    render(
      <ProfessionalFilter selectedIds={['u1', 'u2']} onChange={() => {}} currentUserId="u1" />,
    )
    expect(screen.getByRole('combobox')).toHaveTextContent('Ana Silva, João Santos')
  })

  it('exibe "X profissionais" quando mais de 2 estão selecionados', () => {
    render(
      <ProfessionalFilter selectedIds={['u1', 'u2', 'u3']} onChange={() => {}} currentUserId="u1" />,
    )
    expect(screen.getByRole('combobox')).toHaveTextContent('3 profissionais')
  })

  it('chama onChange ao selecionar um profissional não selecionado', () => {
    const onChange = vi.fn()
    render(
      <ProfessionalFilter selectedIds={['u1']} onChange={onChange} currentUserId="u1" />,
    )
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByText('João Santos'))
    expect(onChange).toHaveBeenCalledWith(['u1', 'u2'])
  })

  it('chama onChange ao desmarcar um profissional já selecionado', () => {
    const onChange = vi.fn()
    render(
      <ProfessionalFilter selectedIds={['u1', 'u2']} onChange={onChange} currentUserId="u1" />,
    )
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByText('João Santos'))
    expect(onChange).toHaveBeenCalledWith(['u1'])
  })

  it('permite desmarcar o próprio usuário logado', () => {
    const onChange = vi.fn()
    render(
      <ProfessionalFilter selectedIds={['u1', 'u2']} onChange={onChange} currentUserId="u1" />,
    )
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByText('Ana Silva'))
    expect(onChange).toHaveBeenCalledWith(['u2'])
  })

  it('clicar em "Todos" quando não estão todos seleciona todos', () => {
    const onChange = vi.fn()
    render(
      <ProfessionalFilter selectedIds={['u1']} onChange={onChange} currentUserId="u1" />,
    )
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByText('Todos'))
    expect(onChange).toHaveBeenCalledWith(['u1', 'u2', 'u3'])
  })

  it('clicar em "Todos" quando todos estão selecionados deseleciona todos', () => {
    const onChange = vi.fn()
    render(
      <ProfessionalFilter selectedIds={['u1', 'u2', 'u3']} onChange={onChange} currentUserId="u1" />,
    )
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByText('Todos'))
    expect(onChange).toHaveBeenCalledWith([])
  })
})
```

- [ ] **Step 2: Rodar testes e confirmar falhas**

```bash
npx vitest run src/components/domain/scheduling/__tests__/ProfessionalFilter.test.tsx
```

Esperado: testes novos falham (comportamento antigo ainda em vigor).

- [ ] **Step 3: Reescrever o componente `ProfessionalFilter`**

Substituir o conteúdo completo de `ProfessionalFilter.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { Check, ChevronsUpDown, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { useTeamMembers } from '@/hooks/iam/use-team'

interface ProfessionalFilterProps {
  selectedIds: string[]
  onChange: (ids: string[]) => void
  currentUserId: string
}

export function ProfessionalFilter({
  selectedIds,
  onChange,
  currentUserId,
}: ProfessionalFilterProps) {
  const [open, setOpen] = useState(false)
  const { data: members = [] } = useTeamMembers()

  const allIds = members.map((m) => m.id)
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.includes(id))

  function toggleAll() {
    onChange(allSelected ? [] : allIds)
  }

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((s) => s !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  const label =
    selectedIds.length === 0
      ? 'Todos os profissionais'
      : selectedIds.length <= 2
        ? selectedIds
            .map((id) => members.find((m) => m.id === id)?.name ?? id)
            .join(', ')
        : `${selectedIds.length} profissionais`

  const sorted = [...members].sort((a, b) => {
    if (a.id === currentUserId) return -1
    if (b.id === currentUserId) return 1
    return a.name.localeCompare(b.name)
  })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="max-w-[220px] justify-between"
        >
          <Users className="mr-2 size-4 shrink-0" />
          <span className="truncate">{open ? '' : label}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar profissional..." />
          <CommandEmpty>Nenhum profissional encontrado.</CommandEmpty>
          <CommandGroup>
            <CommandItem value="__all__" onSelect={toggleAll}>
              <Check
                className={cn('mr-2 size-4', allSelected ? 'opacity-100' : 'opacity-0')}
              />
              <span className="font-medium">Todos</span>
            </CommandItem>
            {sorted.map((member) => {
              const isSelected = selectedIds.includes(member.id)
              return (
                <CommandItem
                  key={member.id}
                  value={member.name}
                  onSelect={() => toggle(member.id)}
                >
                  <Check
                    className={cn('mr-2 size-4', isSelected ? 'opacity-100' : 'opacity-0')}
                  />
                  <span className="truncate">{member.name}</span>
                </CommandItem>
              )
            })}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 4: Rodar testes e confirmar passagem**

```bash
npx vitest run src/components/domain/scheduling/__tests__/ProfessionalFilter.test.tsx
```

Esperado: todos os testes passam.

- [ ] **Step 5: Commit**

```bash
git add src/components/domain/scheduling/ProfessionalFilter.tsx src/components/domain/scheduling/__tests__/ProfessionalFilter.test.tsx
git commit -m "feat(agenda): ProfessionalFilter com Select All e sem restrição de desmarcar"
```

---

### Task 9: AgendaDayView — inicialização do filtro

**Files:**
- Modify: `src/components/domain/scheduling/agenda-day-view.tsx`

- [ ] **Step 1: Atualizar o `useEffect` de inicialização do filtro**

Localizar o `useEffect` (~linha 113). Substituir:

```typescript
useEffect(() => {
  if (!canViewAll || teamMembers.length === 0 || selectedProfessionalIds.length > 0) return
  if (currentUser?.role === 'PROFESSIONAL') {
    setSelectedProfessionalIds([currentUser.id])
  } else {
    setSelectedProfessionalIds(teamMembers.map((m) => m.id))
  }
}, [teamMembers, currentUser, canViewAll])
```

Por:

```typescript
useEffect(() => {
  if (!canViewAll || teamMembers.length === 0 || selectedProfessionalIds.length > 0) return
  setSelectedProfessionalIds(teamMembers.map((m) => m.id))
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [canViewAll, teamMembers])
```

- [ ] **Step 2: Remover `currentUser` das dependências de inicialização**

`currentUser` é usado para filtro de API quando `canViewAll` é false — isso está correto e não muda. Apenas removido da lógica de inicialização acima.

- [ ] **Step 3: Checar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 4: Commit**

```bash
git add src/components/domain/scheduling/agenda-day-view.tsx
git commit -m "fix(agenda): filtro inicializa com todos os profissionais independente do role"
```

---

### Task 10: ConfirmAppointmentModal — novo componente

**Files:**
- Create: `src/components/domain/scheduling/confirm-appointment-modal.tsx`

- [ ] **Step 1: Criar o componente**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useUpdateAppointmentStatus } from '@/hooks/scheduling/use-appointments'
import type { Appointment } from '@/hooks/scheduling/use-appointments'
import type { SugestaoPreco } from '@/domains/crm/price-suggestion'
import type { CapilarBlock } from '@/domains/crm/anamnese-blocks.types'

type AnamneseData = {
  anamnese: {
    id: string
    blocks: { capilar?: CapilarBlock }
    blockTypes: string[]
    updatedAt: string
  }
  sugestaoPreco: SugestaoPreco | null
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function buildDefaultMessage(appointment: Appointment, valorFinal: number): string {
  const data = new Date(appointment.startsAt)
  const dia = data.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  })
  const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `Olá ${appointment.customer.name}! Seu agendamento de ${appointment.service.name} com ${appointment.professional.name} em ${dia} às ${hora} foi confirmado. Valor: ${formatCurrency(valorFinal)}. Aguardamos você!`
}

type Props = {
  appointment: Appointment
  open: boolean
  onClose: () => void
}

export function ConfirmAppointmentModal({ appointment, open, onClose }: Props) {
  const updateStatus = useUpdateAppointmentStatus()

  const { data: anamneseData } = useQuery<AnamneseData | null>({
    queryKey: ['appointment-anamnese', appointment.id],
    queryFn: async () => {
      const res = await fetch(`/api/scheduling/appointments/${appointment.id}/anamnese`)
      if (!res.ok) return null
      return res.json()
    },
    staleTime: 2 * 60 * 1000,
  })

  const [valorFinal, setValorFinal] = useState<number>(Number(appointment.price))
  const [mensagem, setMensagem] = useState<string>('')

  useEffect(() => {
    if (!open) return
    const price = anamneseData?.sugestaoPreco?.valorSugerido ?? Number(appointment.price)
    setValorFinal(price)
    setMensagem(buildDefaultMessage(appointment, price))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const suggestedPrice = anamneseData?.sugestaoPreco?.valorSugerido ?? null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    updateStatus.mutate(
      {
        id: appointment.id,
        status: 'CONFIRMED',
        notificationMessage: mensagem,
        confirmedPrice: valorFinal,
      },
      {
        onSuccess: () => {
          toast.success('Agendamento confirmado')
          onClose()
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Erro ao confirmar')
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar agendamento</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm space-y-1">
            <p className="font-medium text-slate-900">{appointment.customer.name}</p>
            <p className="text-slate-500">
              {appointment.service.name} · {appointment.professional.name}
            </p>
            {suggestedPrice !== null && suggestedPrice !== Number(appointment.price) && (
              <p className="text-xs text-amber-700">
                Sugestão da ficha: {formatCurrency(suggestedPrice)}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="valor-final">Valor a cobrar (R$)</Label>
            <Input
              id="valor-final"
              type="number"
              min={0}
              step={0.01}
              value={valorFinal}
              onChange={(e) => setValorFinal(Number(e.target.value))}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mensagem-cliente">Mensagem para o cliente</Label>
            <Textarea
              id="mensagem-cliente"
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={4}
              className="resize-none text-sm"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              onClick={onClose}
              disabled={updateStatus.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
              disabled={updateStatus.isPending}
            >
              {updateStatus.isPending ? 'Confirmando...' : 'Confirmar e enviar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Checar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/scheduling/confirm-appointment-modal.tsx
git commit -m "feat(agenda): modal de confirmação com valor editável e mensagem WhatsApp"
```

---

### Task 11: AppointmentDrawer — integrar `ConfirmAppointmentModal`

**Files:**
- Modify: `src/components/domain/scheduling/appointment-drawer.tsx`

- [ ] **Step 1: Adicionar import e estado**

No topo do arquivo, adicionar import após os existentes:

```typescript
import { ConfirmAppointmentModal } from './confirm-appointment-modal'
```

Dentro do componente `AppointmentDrawer`, após `const [cancelModalOpen, setState]...`, adicionar:

```typescript
const [confirmModalOpen, setConfirmModalOpen] = useState(false)
```

- [ ] **Step 2: Substituir o botão "Confirmar presença"**

Localizar o bloco (~linha 173):

```tsx
{appointment.status === 'SCHEDULED' && (
  <Button
    className="w-full bg-blue-600 text-white hover:bg-blue-700"
    onClick={() => handleStatus('CONFIRMED')}
    disabled={updateStatus.isPending}
  >
    Confirmar presença
  </Button>
)}
```

Substituir por:

```tsx
{appointment.status === 'SCHEDULED' && (
  <Button
    className="w-full bg-blue-600 text-white hover:bg-blue-700"
    onClick={() => setConfirmModalOpen(true)}
  >
    Confirmar presença
  </Button>
)}
```

- [ ] **Step 3: Adicionar o modal ao JSX**

Dentro do fragment `<>...</>` retornado, após o `<CancelAppointmentModal .../>`, adicionar:

```tsx
<ConfirmAppointmentModal
  appointment={appointment}
  open={confirmModalOpen}
  onClose={() => {
    setConfirmModalOpen(false)
    onClose()
  }}
/>
```

- [ ] **Step 4: Checar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 5: Commit**

```bash
git add src/components/domain/scheduling/appointment-drawer.tsx
git commit -m "feat(agenda): drawer integra modal de confirmação com valor e mensagem"
```

---

### Task 12: RegisterPaymentModal — usa `confirmedPrice` como base

**Files:**
- Modify: `src/components/domain/financial/register-payment-modal.tsx`

- [ ] **Step 1: Atualizar o cálculo do valor base**

Localizar a linha (~linha 56):

```typescript
const gross = appointment ? Number(appointment.price) : 0;
```

Substituir por:

```typescript
const gross = appointment
  ? appointment.confirmedPrice
    ? Number(appointment.confirmedPrice)
    : Number(appointment.price)
  : 0;
```

- [ ] **Step 2: Atualizar o label no resumo**

Localizar o label "Valor original" (~linha 119):

```tsx
<div className="flex justify-between">
  <span className="text-slate-500">Valor original</span>
  <span className="font-medium">{fmt(gross)}</span>
</div>
```

Substituir por:

```tsx
<div className="flex justify-between">
  <span className="text-slate-500">
    {appointment.confirmedPrice &&
    Number(appointment.confirmedPrice) !== Number(appointment.price)
      ? 'Valor confirmado'
      : 'Valor original'}
  </span>
  <span className="font-medium">{fmt(gross)}</span>
</div>
```

- [ ] **Step 3: Checar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 4: Rodar todos os testes**

```bash
npx vitest run
```

Esperado: todos passam.

- [ ] **Step 5: Commit**

```bash
git add src/components/domain/financial/register-payment-modal.tsx
git commit -m "feat(agenda): checkout usa confirmedPrice quando disponível"
```

---

## Verificação final

- [ ] `npx tsc --noEmit` — zero erros
- [ ] `npx vitest run` — todos os testes passam
- [ ] Abrir a tela de Agenda no browser e verificar:
  - Painel de detalhes mais largo no desktop
  - Botão de reagendar com ícone de lápis no canto inferior direito do card
  - Filtro com "Todos os profissionais" por padrão e opção "Todos" no dropdown
  - Clicar "Confirmar presença" abre o modal com valor pré-preenchido e mensagem editável
  - Concluir atendimento e verificar que o `RegisterPaymentModal` exibe "Valor confirmado" com o valor definido na confirmação
