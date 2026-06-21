# Agenda Mobile — Refatoração e Melhorias

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir layout quebrado em mobile, refatorar edição de agendamento para o drawer existente, corrigir samba pós-swipe globalmente, e adicionar calendário toggle + botão Agendar no CRM.

**Architecture:** Seis mudanças independentes em camadas diferentes (shell, componentes de scheduling, CRM page). As tarefas 1–3 são pré-requisito para a tarefa 3 (remove `reschedule-modal.tsx` que é substituído pelo modo edição do drawer). As demais são independentes.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, shadcn/ui (radix-nova), TailwindCSS, TanStack Query, framer-motion, react-day-picker (a instalar na Tarefa 5).

## Global Constraints

- TypeScript strict — sem `any`, sem `as unknown as`
- Todos os textos em Português do Brasil
- Mobile-first: testar viewport 390px (iPhone 12 Pro)
- Sem `console.log` em produção
- Commits frequentes ao final de cada tarefa
- Branch de trabalho: `fix/mobile-swipe-agenda-columns`

---

## Mapa de arquivos

| Arquivo | Tarefa | Ação |
|---------|--------|------|
| `src/components/app/app-shell.tsx` | 1 | Modificar — `overflow-x-hidden` |
| `src/components/domain/scheduling/appointment-card.tsx` | 2 | Modificar — remover lápis, fix botões |
| `src/components/domain/scheduling/agenda-day-view.tsx` | 2 + 3 | Modificar — min-w, confirm modal, remove reschedule |
| `src/components/domain/scheduling/appointment-drawer.tsx` | 3 | Modificar — adicionar modo edição |
| `src/components/domain/scheduling/reschedule-modal.tsx` | 3 | **Deletar** |
| `src/components/domain/scheduling/create-appointment-modal.tsx` | 4 | Modificar — defaultCustomerId/Name |
| `src/app/(app)/clientes/[id]/page.tsx` | 4 | Modificar — botão Agendar |
| `src/components/domain/scheduling/agenda-week-strip.tsx` | 5 | Modificar — calendário toggle |
| `src/components/ui/calendar.tsx` | 5 | **Criar** via `npx shadcn add calendar` |

---

## Tarefa 1: Fix samba global pós-swipe

**Arquivos:**
- Modificar: `src/components/app/app-shell.tsx`

**Contexto:** O `SwipeNavWrapper` usa `framer-motion` para transladar a página horizontalmente durante swipe. Sem `overflow-x: hidden` no container pai, o `motion.div` cria espaço de scroll ao ser deslocado, causando scroll horizontal em todas as rotas do ciclo de swipe.

- [ ] **Passo 1: Localizar o div raiz em `app-shell.tsx`**

Abrir `src/components/app/app-shell.tsx`. Na função `AppShell`, localizar o `return` e o primeiro `<div>`:

```tsx
return (
  <TooltipProvider delayDuration={300}>
  <div className="min-h-screen bg-background text-foreground">
```

- [ ] **Passo 2: Adicionar `overflow-x-hidden`**

Alterar apenas essa linha:

```tsx
<div className="min-h-screen bg-background text-foreground overflow-x-hidden">
```

- [ ] **Passo 3: Verificar TypeScript**

```bash
cd c:/dev/estetica-saas && npx tsc --noEmit 2>&1 | head -20
```

Esperado: sem erros.

- [ ] **Passo 4: Commit**

```bash
git add src/components/app/app-shell.tsx
git commit -m "fix(shell): overflow-x-hidden elimina scroll horizontal pós-swipe"
```

---

## Tarefa 2: Fix layout dos cards + confirmar abre modal

**Arquivos:**
- Modificar: `src/components/domain/scheduling/appointment-card.tsx`
- Modificar: `src/components/domain/scheduling/agenda-day-view.tsx`

**Contexto:** Os botões de ação no card usam `flex-1` lado a lado em colunas de 150px — espaço insuficiente no iPhone 12 Pro. Além disso, `handleConfirmInline` confirma diretamente sem abrir o modal de valor cobrado.

- [ ] **Passo 1: Corrigir botões de ação em `appointment-card.tsx`**

Localizar o bloco de quick actions (a partir de `{(() => {`). Substituir o bloco inteiro:

```tsx
{/* Quick actions — visíveis apenas em mobile (sm:hidden) */}
{(() => {
  const showConfirm = !!onConfirm && appointment.status === 'SCHEDULED'
  const showPay = !!onPay && (appointment.status === 'CONFIRMED' || appointment.status === 'SCHEDULED')
  if (!showConfirm && !showPay) return null
  return (
    <div className="mt-3 flex flex-col gap-2 sm:hidden border-t border-slate-100 pt-3">
      {showConfirm && (
        <button
          onClick={(e) => { e.stopPropagation(); onConfirm?.(appointment) }}
          className="flex w-full items-center justify-center rounded-xl bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100 transition min-h-11"
        >
          Confirmar
        </button>
      )}
      {showPay && (
        <button
          onClick={(e) => { e.stopPropagation(); onPay?.(appointment) }}
          className="flex w-full items-center justify-center rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition min-h-11"
        >
          Fechar pagamento
        </button>
      )}
    </div>
  )
})()}
```

Mudanças: `flex gap-2` → `flex flex-col gap-2`, removidos os SVGs, `flex-1` → `w-full`.

- [ ] **Passo 2: Remover prop `onReschedule` e botão de lápis de `appointment-card.tsx`**

Remover o import `Pencil` de lucide-react. Remover `onReschedule?` do tipo `Props`. Remover `const canReschedule = ...`. Remover o bloco inteiro do `Tooltip` com o botão de lápis (`{canReschedule && onReschedule && (...)})`).

Novo tipo Props:
```tsx
type Props = {
  appointment: Appointment
  onClick: (appointment: Appointment) => void
  onConfirm?: (appointment: Appointment) => void
  onPay?: (appointment: Appointment) => void
}
```

Nova assinatura do componente:
```tsx
export function AppointmentCard({ appointment, onClick, onConfirm, onPay }: Props) {
```

Remover completamente:
```tsx
import { Pencil } from 'lucide-react'
// (manter apenas o cn e Badge e Tooltip se ainda usado — verificar)
```

Como o Tooltip era usado apenas para o lápis, remover também os imports de `Tooltip`, `TooltipContent`, `TooltipTrigger` se não houver outro uso.

- [ ] **Passo 3: Aumentar `min-w` das colunas em `agenda-day-view.tsx`**

Localizar as duas ocorrências de `min-w-37.5` (linhas ~331 e ~357) e substituir por `min-w-44`:

```tsx
// linha do cabeçalho de profissionais:
className="min-w-44 sm:min-w-60 flex-1 px-1 sm:px-2"

// linha das células de agendamento:
className="min-w-44 sm:min-w-60 flex-1 space-y-1.5 px-1 pb-2"
```

- [ ] **Passo 4: Substituir `handleConfirmInline` em `agenda-day-view.tsx`**

Localizar e substituir:

```tsx
// REMOVER — já não será usado:
const updateStatus = useUpdateAppointmentStatus()

// REMOVER import de useUpdateAppointmentStatus se não houver outro uso na view
```

Adicionar estado para o modal de confirmação logo após os outros estados:
```tsx
const [confirmModalAppointment, setConfirmModalAppointment] = useState<Appointment | null>(null)
```

Substituir a função `handleConfirmInline`:
```tsx
function handleConfirmInline(appt: Appointment) {
  setConfirmModalAppointment(appt)
}
```

- [ ] **Passo 5: Adicionar `ConfirmAppointmentModal` ao render de `agenda-day-view.tsx`**

Adicionar import no topo do arquivo:
```tsx
import { ConfirmAppointmentModal } from './confirm-appointment-modal'
```

No `return`, após o bloco `<RescheduleModal>` (que será removido na Tarefa 3 — por ora apenas adicionar), adicionar:
```tsx
{confirmModalAppointment && (
  <ConfirmAppointmentModal
    appointment={confirmModalAppointment}
    open={!!confirmModalAppointment}
    onClose={() => setConfirmModalAppointment(null)}
  />
)}
```

- [ ] **Passo 6: Remover `onReschedule` dos `<AppointmentCard>` em `agenda-day-view.tsx`**

Há três ocorrências de `<AppointmentCard>` no arquivo. Remover `onReschedule={handleReschedule}` de todas elas (a prop já não existe mais no componente).

- [ ] **Passo 7: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Esperado: zero erros.

- [ ] **Passo 8: Commit**

```bash
git add src/components/domain/scheduling/appointment-card.tsx src/components/domain/scheduling/agenda-day-view.tsx
git commit -m "fix(agenda): botões de ação empilhados mobile, confirmar abre modal com valor"
```

---

## Tarefa 3: Modo edição inline no drawer + remoção do RescheduleModal

**Arquivos:**
- Modificar: `src/components/domain/scheduling/appointment-drawer.tsx`
- Modificar: `src/components/domain/scheduling/agenda-day-view.tsx`
- Deletar: `src/components/domain/scheduling/reschedule-modal.tsx`

**Contexto:** O drawer de detalhes ganha um modo edição (isEditing) ativo apenas quando `status === 'SCHEDULED'`. Os hooks e template de mensagem que estavam no `reschedule-modal.tsx` migram para o drawer.

- [ ] **Passo 1: Adicionar imports em `appointment-drawer.tsx`**

Adicionar ao bloco de imports existente:
```tsx
import { useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useRescheduleAppointment } from '@/hooks/scheduling/use-appointments'
import { useAvailableSlots } from '@/hooks/scheduling/use-availability'
import { useTeamMembers } from '@/hooks/iam/use-team'
```

- [ ] **Passo 2: Adicionar constantes e helpers no topo de `appointment-drawer.tsx`** (antes do componente)

```tsx
const RESCHEDULE_TEMPLATE =
  'Olá, {nome}! Seu agendamento de {serviço} foi remarcado para {data} às {hora} com {profissional}. Qualquer dúvida, estamos à disposição. Te esperamos! 🤍'

function toDateInput(iso: string) {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function toTimeInput(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
```

- [ ] **Passo 3: Adicionar estado e hooks de edição em `AppointmentDrawer`**

Logo após os `useState` existentes (`cancelModalOpen`, `confirmModalOpen`, `noShowModalOpen`), adicionar:

```tsx
const [isEditing, setIsEditing] = useState(false)
const [editProfessionalId, setEditProfessionalId] = useState('')
const [editDate, setEditDate] = useState('')
const [editTime, setEditTime] = useState('')
const [editMessage, setEditMessage] = useState('')

const { data: teamMembers = [] } = useTeamMembers()
const reschedule = useRescheduleAppointment()

const { data: slots = [], isLoading: loadingSlots } = useAvailableSlots(
  isEditing ? editProfessionalId || null : null,
  isEditing ? editDate || null : null,
  isEditing ? (appointment?.serviceId ?? null) : null,
)
```

- [ ] **Passo 4: Adicionar `useEffect` para preencher mensagem automaticamente**

Após os hooks, adicionar:

```tsx
useEffect(() => {
  if (!appointment || !editTime || !editDate) return
  const professionalName =
    teamMembers.find((m) => m.id === editProfessionalId)?.name ??
    appointment.professional.name
  const dateLabel = new Date(editDate + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
  setEditMessage(
    RESCHEDULE_TEMPLATE
      .replace('{nome}', appointment.customer.name.split(' ')[0])
      .replace('{serviço}', appointment.service.name)
      .replace('{data}', dateLabel)
      .replace('{hora}', editTime.replace(':', 'h'))
      .replace('{profissional}', professionalName.split(' ')[0]),
  )
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [editTime, editDate, editProfessionalId])
```

- [ ] **Passo 5: Adicionar funções `startEditing`, `handleSaveEdit` e `handleClose`**

```tsx
function startEditing() {
  if (!appointment) return
  setEditProfessionalId(appointment.professionalId)
  setEditDate(toDateInput(appointment.startsAt))
  setEditTime(toTimeInput(appointment.startsAt))
  setEditMessage('')
  setIsEditing(true)
}

function handleSaveEdit() {
  if (!appointment || !editTime) return
  const newStartsAt = new Date(`${editDate}T${editTime}:00`).toISOString()
  const newEndsAt = new Date(
    new Date(newStartsAt).getTime() + appointment.service.duration * 60 * 1000,
  ).toISOString()
  reschedule.mutate(
    {
      id: appointment.id,
      startsAt: newStartsAt,
      endsAt: newEndsAt,
      professionalId: editProfessionalId,
      notificationMessage: editMessage,
    },
    {
      onSuccess: () => {
        toast.success('Agendamento atualizado')
        setIsEditing(false)
        onClose()
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Erro ao atualizar')
      },
    },
  )
}

function handleClose() {
  setIsEditing(false)
  onClose()
}
```

- [ ] **Passo 6: Adicionar `hasChanged` computed**

Logo antes do `if (!appointment) return null`:

```tsx
const originalProfessionalId = appointment?.professionalId ?? ''
const originalDate = appointment ? toDateInput(appointment.startsAt) : ''
const originalTime = appointment ? toTimeInput(appointment.startsAt) : ''
const hasChanged =
  editProfessionalId !== originalProfessionalId ||
  editDate !== originalDate ||
  (editTime !== '' && editTime !== originalTime)
```

- [ ] **Passo 7: Atualizar o `onOpenChange` do Sheet para usar `handleClose`**

Localizar:
```tsx
<Sheet open={open} onOpenChange={(o) => !o && onClose()}>
```

Substituir por:
```tsx
<Sheet open={open} onOpenChange={(o) => !o && handleClose()}>
```

- [ ] **Passo 8: Adicionar botão "Editar agendamento" no bloco de ações da view**

No JSX do drawer, dentro do bloco `{isActive && (...)`, localizar:
```tsx
{appointment.status === 'SCHEDULED' && (
  <Button
    className="w-full"
    onClick={() => setConfirmModalOpen(true)}
  >
    Confirmar presença
  </Button>
)}
```

Adicionar **acima** desse botão (ainda dentro de `{isActive && ...}`):
```tsx
{appointment.status === 'SCHEDULED' && !isEditing && (
  <Button
    variant="outline"
    className="w-full"
    onClick={startEditing}
  >
    Editar agendamento
  </Button>
)}
```

- [ ] **Passo 9: Adicionar o formulário de edição (quando `isEditing`)**

Localizar o início do conteúdo scrollável do drawer:
```tsx
<div className="mt-6 space-y-6 overflow-y-auto flex-1 pb-6 pr-1">
  <div className="flex items-center gap-3">
    <Badge ...>
```

Envolver o conteúdo existente em um condicional. O JSX deve ficar:
```tsx
<div className="mt-6 space-y-6 overflow-y-auto flex-1 pb-6 pr-1">
  {isEditing ? (
    <div className="space-y-5">
      {/* Profissional */}
      <div className="space-y-1.5">
        <Label>Profissional</Label>
        <Select value={editProfessionalId} onValueChange={setEditProfessionalId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione um profissional" />
          </SelectTrigger>
          <SelectContent>
            {teamMembers.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Data */}
      <div className="space-y-1.5">
        <Label>Nova data</Label>
        <input
          type="date"
          value={editDate}
          onChange={(e) => {
            setEditDate(e.target.value)
            setEditTime('')
          }}
          min={toDateInput(new Date().toISOString())}
          className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
        />
      </div>

      {/* Horários */}
      <div className="space-y-1.5">
        <Label>Horário</Label>
        {loadingSlots ? (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-16 rounded-full" />
            ))}
          </div>
        ) : slots.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum horário disponível nesta data.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {slots.map((slot) => (
              <button
                key={slot.time}
                type="button"
                disabled={!slot.available}
                onClick={() => setEditTime(slot.time)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition',
                  slot.available
                    ? editTime === slot.time
                      ? 'border-slate-950 bg-slate-950 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                    : 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300',
                )}
              >
                {slot.time.replace(':', 'h')}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mensagem WhatsApp */}
      <div className="space-y-1.5">
        <Label>Mensagem enviada ao cliente via WhatsApp</Label>
        <Textarea
          value={editMessage}
          onChange={(e) => setEditMessage(e.target.value)}
          placeholder="Selecione um horário para pré-preencher a mensagem..."
          className="min-h-[100px] resize-none text-sm"
        />
        {!appointment.customer.phone && (
          <p className="text-xs text-slate-400">
            Este cliente não tem telefone cadastrado. A mensagem não será enviada.
          </p>
        )}
      </div>

      {/* Botões */}
      <div className="flex gap-2 pt-1">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => setIsEditing(false)}
          disabled={reschedule.isPending}
        >
          Cancelar edição
        </Button>
        <Button
          className="flex-1 bg-slate-950 text-white hover:bg-slate-800"
          onClick={handleSaveEdit}
          disabled={!hasChanged || !editTime || reschedule.isPending}
        >
          {reschedule.isPending ? 'Salvando...' : 'Salvar alterações'}
        </Button>
      </div>
    </div>
  ) : (
    <>
      {/* === CONTEÚDO ORIGINAL DA VIEW — MANTER INTACTO === */}
      <div className="flex items-center gap-3">
        {/* ... badge de status ... */}
      </div>
      {/* ... bloco de informações, anamnese, produtos, ações ... */}
    </>
  )}
</div>
```

**Atenção:** substituir o comentário `{/* === CONTEÚDO ORIGINAL DA VIEW === */}` pelo JSX existente do drawer (tudo que está dentro do `div.mt-6` atualmente).

- [ ] **Passo 10: Limpar estado de reschedule em `agenda-day-view.tsx`**

Remover de `agenda-day-view.tsx`:
- Estado: `reschedulingAppointment` e `rescheduleModalOpen`
- Função: `handleReschedule`
- Import: `RescheduleModal`
- JSX: `<RescheduleModal ... />`

- [ ] **Passo 11: Deletar `reschedule-modal.tsx`**

```bash
rm src/components/domain/scheduling/reschedule-modal.tsx
```

- [ ] **Passo 12: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Esperado: zero erros.

- [ ] **Passo 13: Rodar testes**

```bash
npx vitest run 2>&1 | tail -20
```

Esperado: todos passando.

- [ ] **Passo 14: Commit**

```bash
git add src/components/domain/scheduling/appointment-drawer.tsx \
        src/components/domain/scheduling/agenda-day-view.tsx
git rm src/components/domain/scheduling/reschedule-modal.tsx
git commit -m "feat(agenda): edição de agendamento inline no drawer, remove modal separado"
```

---

## Tarefa 4: Botão "Agendar Horário" no perfil do cliente

**Arquivos:**
- Modificar: `src/components/domain/scheduling/create-appointment-modal.tsx`
- Modificar: `src/app/(app)/clientes/[id]/page.tsx`

**Contexto:** O `CreateAppointmentModal` ganha props opcionais para pré-selecionar um cliente. A página de perfil do cliente exibe um botão "Agendar Horário" que abre o modal com o cliente pré-selecionado.

- [ ] **Passo 1: Atualizar tipo `Props` em `create-appointment-modal.tsx`**

```tsx
type Props = {
  open: boolean
  onClose: () => void
  defaultDate?: string
  defaultCustomerId?: string
  defaultCustomerName?: string
}
```

Atualizar assinatura do componente:
```tsx
export function CreateAppointmentModal({ open, onClose, defaultDate, defaultCustomerId, defaultCustomerName }: Props) {
```

- [ ] **Passo 2: Adicionar `useEffect` para pré-selecionar cliente**

Logo após os `useEffect` existentes (do `currentUser` e `defaultDate`), adicionar:

```tsx
useEffect(() => {
  if (defaultCustomerId) {
    setCustomerId(defaultCustomerId)
  }
}, [defaultCustomerId])
```

- [ ] **Passo 3: Atualizar `handleClose` para preservar cliente pré-selecionado**

Substituir a função `handleClose` existente:

```tsx
function handleClose() {
  setProfessionalId(canManage ? '' : (currentUser?.id ?? ''))
  setServiceId('')
  setDate(defaultDate ?? toDateInput(new Date()))
  setSelectedTime('')
  setCustomTime('')
  setCustomerSearch('')
  setCustomerId(defaultCustomerId ?? '')
  setAllowOverlap(false)
  setNotificationMessage('')
  onClose()
}
```

- [ ] **Passo 4: Atualizar o `useEffect` de template de mensagem**

Localizar o `useEffect` que seta `notificationMessage` e substituir:

```tsx
useEffect(() => {
  if (!customerId || !serviceId || !date || !selectedTime || !professionalId) return

  const customerName = defaultCustomerName
    ? defaultCustomerName.split(' ')[0]
    : customers.find((c) => c.id === customerId)?.name.split(' ')[0]
  const service = services.find((s) => s.id === serviceId)
  const professional = teamMembers.find((m) => m.id === professionalId)
  if (!customerName || !service || !professional) return

  setNotificationMessage(
    renderConfirmTemplate({
      nome: customerName,
      serviço: service.name,
      data: formatDateLabel(date),
      hora: formatHour(selectedTime),
      profissional: professional.name.split(' ')[0],
    }),
  )
}, [customerId, serviceId, date, selectedTime, professionalId, customers, services, teamMembers, defaultCustomerName])
```

- [ ] **Passo 5: Atualizar `selectedCustomer` e o campo de busca de cliente**

Localizar:
```tsx
const selectedCustomer = customers.find((c) => c.id === customerId)
```

Substituir por:
```tsx
const selectedCustomer = defaultCustomerId ? null : customers.find((c) => c.id === customerId)
```

Localizar a seção `{/* 5. Cliente */}` no JSX e substituir por:

```tsx
{/* 5. Cliente */}
<div className="space-y-2">
  <Label>Cliente</Label>
  {defaultCustomerId ? (
    <div className="flex h-9 w-full items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
      {defaultCustomerName ?? 'Cliente selecionado'}
    </div>
  ) : (
    <>
      <Input
        placeholder="Buscar por nome ou telefone..."
        value={selectedCustomer ? selectedCustomer.name : customerSearch}
        onChange={(e) => {
          setCustomerSearch(e.target.value)
          setCustomerId('')
        }}
      />
      {customerSearch.length >= 2 && !customerId && (
        <div className="rounded-xl border bg-white shadow-sm max-h-40 overflow-y-auto">
          {searchingCustomers ? (
            <p className="p-3 text-sm text-slate-500">Buscando...</p>
          ) : customers.length === 0 ? (
            <p className="p-3 text-sm text-slate-500">Nenhum cliente encontrado</p>
          ) : (
            customers.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setCustomerId(c.id)
                  setCustomerSearch(c.name)
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-rose-50"
              >
                <span className="font-medium">{c.name}</span>
                {c.phone && (
                  <span className="ml-2 text-slate-400">{c.phone}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </>
  )}
</div>
```

- [ ] **Passo 6: Adicionar botão e modal em `/clientes/[id]/page.tsx`**

Adicionar import:
```tsx
import { CalendarPlus } from 'lucide-react'
import { CreateAppointmentModal } from '@/components/domain/scheduling/create-appointment-modal'
```

Adicionar estado (junto com os outros `useState`):
```tsx
const [scheduleOpen, setScheduleOpen] = useState(false)
```

Localizar o bloco de botões no topo da página:
```tsx
<div className="flex items-center justify-between">
  <Button variant="ghost" size="sm" onClick={() => router.back()} ...>
    <ArrowLeft className="size-4" />
    Voltar
  </Button>
  <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
    Editar dados
  </Button>
</div>
```

Substituir por:
```tsx
<div className="flex items-center justify-between">
  <Button
    variant="ghost"
    size="sm"
    onClick={() => router.back()}
    className="-ml-2 text-slate-500"
  >
    <ArrowLeft className="size-4" />
    Voltar
  </Button>
  <div className="flex items-center gap-2">
    <Button
      variant="outline"
      size="sm"
      onClick={() => setScheduleOpen(true)}
    >
      <CalendarPlus className="mr-1.5 size-4" />
      Agendar Horário
    </Button>
    <Button
      variant="outline"
      size="sm"
      onClick={() => setEditOpen(true)}
    >
      Editar dados
    </Button>
  </div>
</div>
```

Adicionar o modal antes do fechamento do `return` (junto com os outros modais existentes):
```tsx
<CreateAppointmentModal
  open={scheduleOpen}
  onClose={() => setScheduleOpen(false)}
  defaultCustomerId={id}
  defaultCustomerName={customer.name}
/>
```

- [ ] **Passo 7: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Esperado: zero erros.

- [ ] **Passo 8: Commit**

```bash
git add src/components/domain/scheduling/create-appointment-modal.tsx \
        src/app/(app)/clientes/[id]/page.tsx
git commit -m "feat(crm): botão Agendar Horário no perfil do cliente com pré-seleção"
```

---

## Tarefa 5: Calendário minimalista toggle no week strip

**Arquivos:**
- Criar: `src/components/ui/calendar.tsx` (via shadcn)
- Modificar: `src/components/domain/scheduling/agenda-week-strip.tsx`

**Contexto:** O week strip ganha um botão de calendário que abre um Popover com um calendário mensal para navegação rápida entre datas distantes. O componente `Calendar` do shadcn usa `react-day-picker` que precisa ser instalado.

- [ ] **Passo 1: Instalar o componente Calendar do shadcn**

```bash
cd c:/dev/estetica-saas && npx shadcn@latest add calendar
```

Esse comando instala `react-day-picker` automaticamente e cria `src/components/ui/calendar.tsx`. Confirmar que o arquivo foi criado:

```bash
ls src/components/ui/calendar.tsx
```

- [ ] **Passo 2: Verificar o import de locale em `react-day-picker`**

```bash
node -e "const rdp = require('react-day-picker'); console.log(typeof rdp)"
```

O locale PT-BR em react-day-picker v9 é importado de `react-day-picker/locale`:
```bash
node -e "const { ptBR } = require('react-day-picker/locale'); console.log(typeof ptBR)"
```

Esperado: `object` (se v9 estiver instalado). Se der erro, verificar a versão instalada:
```bash
node -e "console.log(require('./node_modules/react-day-picker/package.json').version)"
```

Se a versão for ≥ 9: locale vem de `react-day-picker/locale`. Se for < 9: locale vem de `date-fns/locale/pt-BR`.

- [ ] **Passo 3: Adicionar imports em `agenda-week-strip.tsx`**

```tsx
import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { ptBR } from 'react-day-picker/locale'
// Se react-day-picker < 9, usar em vez: import { ptBR } from 'date-fns/locale/pt-BR'
```

- [ ] **Passo 4: Adicionar estado em `AgendaWeekStrip`**

Logo após a abertura da função, antes dos cálculos de `monday`:
```tsx
const [calendarOpen, setCalendarOpen] = useState(false)
```

- [ ] **Passo 5: Substituir o JSX de retorno**

Localizar o `return (` existente. Substituir por:

```tsx
return (
  <div className="flex items-center gap-2">
    {/* Botão de calendário toggle */}
    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={cn('rounded-full shrink-0', calendarOpen && 'bg-slate-100')}
          aria-label="Abrir calendário"
        >
          <CalendarDays className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(d) => {
            if (d) {
              onSelectDate(d)
              setCalendarOpen(false)
            }
          }}
          locale={ptBR}
          autoFocus
        />
      </PopoverContent>
    </Popover>

    <Button variant="outline" size="icon" onClick={prevWeek} className="rounded-full shrink-0">
      <ChevronLeft className="size-4" />
    </Button>

    <div className="grid flex-1 grid-cols-7 gap-1">
      {days.map((d, i) => {
        const isSelected = d.toDateString() === selectedDate.toDateString()
        const isToday = d.toDateString() === new Date().toDateString()
        return (
          <button
            key={d.toISOString()}
            aria-label={d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            aria-pressed={isSelected}
            onClick={() => onSelectDate(d)}
            className={cn(
              'flex flex-col items-center rounded-xl py-2 text-center transition',
              isSelected
                ? 'bg-slate-950 text-white'
                : isToday
                  ? 'bg-rose-50 text-rose-700'
                  : 'hover:bg-slate-100 text-slate-700',
            )}
          >
            <span className="text-[10px] font-medium uppercase">
              {d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
            </span>
            <span className="text-base font-semibold">{d.getDate()}</span>
            {isLoading ? (
              <Skeleton className="mt-1 h-1.5 w-4 rounded-full" />
            ) : countByDay[i] > 0 ? (
              <span
                className={cn(
                  'mt-1 text-[10px] font-semibold',
                  isSelected ? 'text-rose-300' : 'text-rose-500',
                )}
              >
                {countByDay[i]}
              </span>
            ) : (
              <span className="mt-1 h-3" />
            )}
          </button>
        )
      })}
    </div>

    <Button variant="outline" size="icon" onClick={nextWeek} className="rounded-full shrink-0">
      <ChevronRight className="size-4" />
    </Button>
  </div>
)
```

- [ ] **Passo 6: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Esperado: zero erros. Se houver erro de tipo no `locale={ptBR}`, verificar a versão do react-day-picker e ajustar o import conforme o Passo 2.

- [ ] **Passo 7: Rodar todos os testes**

```bash
npx vitest run 2>&1 | tail -20
```

Esperado: todos passando.

- [ ] **Passo 8: Commit**

```bash
git add src/components/ui/calendar.tsx \
        src/components/domain/scheduling/agenda-week-strip.tsx \
        package.json package-lock.json
git commit -m "feat(agenda): calendário toggle no week strip para navegação rápida"
```

---

## Checklist final de entrega

- [ ] `npx tsc --noEmit` zero erros
- [ ] `npx vitest run` todos passando
- [ ] Testado no Chrome DevTools — viewport 390px (iPhone 12 Pro)
- [ ] Botões do card aparecem empilhados verticalmente sem overflow
- [ ] Swipe entre todas as rotas do ciclo — zero scroll horizontal residual
- [ ] Scroll vertical em configurações e clientes funciona normalmente após swipe
- [ ] Sheet e Dialog abertos após swipe sem comportamento estranho
- [ ] Botão "Confirmar" na listagem abre `ConfirmAppointmentModal` com campo de valor
- [ ] Drawer mostra "Editar agendamento" apenas para status SCHEDULED
- [ ] No modo edição, selecionar nova data limpa o horário e exibe grade de slots
- [ ] Salvar sem alteração é impossível (botão desabilitado)
- [ ] `reschedule-modal.tsx` não existe mais no projeto
- [ ] Botão "Agendar Horário" no `/clientes/[id]` abre modal com cliente pré-selecionado (campo somente leitura)
- [ ] Calendário toggle abre/fecha ao clicar no ícone `CalendarDays`
- [ ] Seleção de data no calendário navega o week strip para a semana correta
- [ ] PR aberta para `main`
