# UI/UX Audit — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir 38 problemas reais de UI/UX identificados em auditoria sistemática de todas as telas do sistema Agendê.

**Architecture:** Fixes cirúrgicos por domínio — cada tarefa altera apenas os arquivos necessários sem refatoração além do escopo. Branch única `fix/ui-ux-audit-junho-2026` aberta a partir de `main`. PR única ao final.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5 strict, Shadcn UI (Nova preset), TailwindCSS 4, TanStack Query 5, Sonner (toasts), Lucide React, Zod 4.

## Global Constraints

- TypeScript strict: sem `any`, sem `as unknown as`
- Nenhuma refatoração além do fix descrito em cada tarefa
- Toasts: `toast.success()` em sucesso, `toast.error()` em falha — sempre via `sonner`
- Touch targets mínimo 44px em mobile (classes `h-11` ou `min-h-[44px]`)
- Imports de `toast` de `'sonner'`; imports de `Tooltip*` de `'@/components/ui/tooltip'`
- `AlertDialog*` de `'@/components/ui/alert-dialog'`
- `Skeleton` de `'@/components/ui/skeleton'`
- Commit após cada tarefa usando Conventional Commits em PT-BR

---

## Mapa de Arquivos

| Arquivo | Tarefa(s) |
|---|---|
| `src/components/domain/scheduling/appointment-drawer.tsx` | T1, T2 |
| `src/components/domain/scheduling/agenda-day-view.tsx` | T3 |
| `src/components/domain/scheduling/appointment-card.tsx` | T4 |
| `src/components/domain/scheduling/confirm-appointment-modal.tsx` | T5 |
| `src/components/domain/financial/transaction-card.tsx` | T6 |
| `src/components/domain/financial/register-payment-modal.tsx` | T6 |
| `src/components/domain/crm/filter-bar.tsx` | T7 |
| `src/components/domain/crm/customer-list.tsx` | T7 |
| `src/components/domain/services/service-form-modal.tsx` | T8 |
| `src/components/domain/services/catalog-grid.tsx` | T8 |
| `src/components/domain/inventory/StockSaleModal.tsx` | T8 |
| `src/components/domain/inventory/StockPurchaseModal.tsx` | T8 |
| `src/components/domain/iam/team-member-card.tsx` | T9 |
| `src/components/domain/iam/edit-member-modal.tsx` | T9 |
| `src/app/(app)/configuracoes/page.tsx` | T10 |
| `src/components/domain/settings/whatsapp-settings-form.tsx` | T10 |
| `src/components/domain/settings/business-info-form.tsx` | T10 |
| `src/components/domain/settings/branding-form.tsx` | T10 |
| `src/components/domain/settings/team-visibility-list.tsx` | T10 |
| `src/components/domain/settings/public-page-form.tsx` | T10 |
| `src/components/domain/billing/billing-plans-content.tsx` | T11 |
| `src/app/(auth)/login/login-client.tsx` | T12 |
| `src/app/(auth)/onboarding/page.tsx` | T12 |
| `src/components/domain/vitrine/client-history-modal.tsx` | T13 |
| `src/components/domain/vitrine/vitrine-hero.tsx` | T13 |
| `src/app/(public)/[slug]/cliente/page.tsx` | T13 |
| `src/components/domain/dashboard/dashboard-metrics.tsx` | T14 |
| `src/app/api/admin/plans/[planName]/route.ts` | T14 |
| `src/app/api/admin/plans/[planName]/limits/route.ts` | T14 |
| `src/app/api/admin/plans/[planName]/features/route.ts` | T14 |
| `src/app/(app)/relatorios/loading.tsx` (criar) | T14 |

---

## Task 1 — NO_SHOW com AlertDialog (appointment-drawer)

**Files:**
- Modify: `src/components/domain/scheduling/appointment-drawer.tsx`

**Interfaces:**
- Produz: botão "Não compareceu" que abre AlertDialog antes de chamar `handleStatus('NO_SHOW')`

- [ ] **Step 1: Criar branch**

```bash
git checkout main && git pull origin main
git checkout -b fix/ui-ux-audit-junho-2026
```

- [ ] **Step 2: Adicionar estado e AlertDialog ao appointment-drawer**

No topo do arquivo (após os imports existentes), adicionar o import de AlertDialog:

```tsx
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
```

Dentro do componente, após `const [confirmModalOpen, setConfirmModalOpen] = useState(false)` (linha ~60), adicionar:

```tsx
const [noShowModalOpen, setNoShowModalOpen] = useState(false)
```

Substituir o botão "Não compareceu" (linha ~206-213):

```tsx
// ANTES:
<Button
  variant="outline"
  className="flex-1 border-orange-200 text-orange-700 hover:bg-orange-50"
  onClick={() => handleStatus('NO_SHOW')}
  disabled={updateStatus.isPending}
>
  Não compareceu
</Button>

// DEPOIS:
<Button
  variant="outline"
  className="flex-1 border-orange-200 text-orange-700 hover:bg-orange-50"
  onClick={() => setNoShowModalOpen(true)}
  disabled={updateStatus.isPending}
>
  Não compareceu
</Button>
```

Antes do `<CancelAppointmentModal` (linha ~229), adicionar:

```tsx
<AlertDialog open={noShowModalOpen} onOpenChange={setNoShowModalOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Registrar não comparecimento?</AlertDialogTitle>
      <AlertDialogDescription>
        O agendamento será marcado como não compareceu. Esta ação não pode ser desfeita.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancelar</AlertDialogCancel>
      <AlertDialogAction
        onClick={() => handleStatus('NO_SHOW')}
        className="bg-orange-600 hover:bg-orange-700"
      >
        Confirmar
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

- [ ] **Step 3: Verificar tipos**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Esperado: zero erros na área modificada.

- [ ] **Step 4: Commit**

```bash
git add src/components/domain/scheduling/appointment-drawer.tsx
git commit -m "fix(scheduling): adicionar AlertDialog de confirmação para ação NO_SHOW"
```

---

## Task 2 — Cores hardcoded → Shadcn (appointment-drawer)

**Files:**
- Modify: `src/components/domain/scheduling/appointment-drawer.tsx`

**Interfaces:**
- Produz: botões de ação usando variantes e classes semânticas do design system

- [ ] **Step 1: Substituir cores hardcoded nos botões de ação**

Substituir o bloco inteiro de botões de ação (linhas ~187-224):

```tsx
// ANTES:
{appointment.status === 'SCHEDULED' && (
  <Button
    className="w-full bg-blue-600 text-white hover:bg-blue-700"
    onClick={() => setConfirmModalOpen(true)}
  >
    Confirmar presença
  </Button>
)}
{['SCHEDULED', 'CONFIRMED'].includes(appointment.status) && (
  <Button
    className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
    onClick={() => handleStatus('COMPLETED')}
    disabled={updateStatus.isPending}
  >
    Concluir atendimento
  </Button>
)}
<div className="flex gap-2">
  <Button
    variant="outline"
    className="flex-1 border-orange-200 text-orange-700 hover:bg-orange-50"
    onClick={() => setNoShowModalOpen(true)}
    disabled={updateStatus.isPending}
  >
    Não compareceu
  </Button>
  <Button
    variant="outline"
    className="flex-1 border-red-200 text-red-700 hover:bg-red-50"
    onClick={() => setCancelModalOpen(true)}
    disabled={updateStatus.isPending}
  >
    Cancelar
  </Button>
</div>

// DEPOIS:
{appointment.status === 'SCHEDULED' && (
  <Button
    className="w-full"
    onClick={() => setConfirmModalOpen(true)}
  >
    Confirmar presença
  </Button>
)}
{['SCHEDULED', 'CONFIRMED'].includes(appointment.status) && (
  <Button
    className="w-full bg-green-600 text-white hover:bg-green-700"
    onClick={() => handleStatus('COMPLETED')}
    disabled={updateStatus.isPending}
  >
    Concluir atendimento
  </Button>
)}
<div className="flex gap-2">
  <Button
    variant="outline"
    className="flex-1 border-amber-200 text-amber-700 hover:bg-amber-50"
    onClick={() => setNoShowModalOpen(true)}
    disabled={updateStatus.isPending}
  >
    Não compareceu
  </Button>
  <Button
    variant="destructive"
    className="flex-1"
    onClick={() => setCancelModalOpen(true)}
    disabled={updateStatus.isPending}
  >
    Cancelar
  </Button>
</div>
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/scheduling/appointment-drawer.tsx
git commit -m "fix(scheduling): substituir cores hardcoded por variantes do design system"
```

---

## Task 3 — Layout mobile multi-profissional (agenda-day-view)

**Files:**
- Modify: `src/components/domain/scheduling/agenda-day-view.tsx`

**Interfaces:**
- Produz: abaixo de `md:` renderiza lista vertical por profissional; acima de `md:` mantém colunas

- [ ] **Step 1: Substituir o bloco multi-profissional**

Localizar o bloco que começa em `viewMode === 'day' && canViewAll && selectedProfessionalIds.length > 1` (linha ~323) e substituir:

```tsx
// ANTES:
) : viewMode === 'day' && canViewAll && selectedProfessionalIds.length > 1 ? (
  <div className="overflow-x-auto">
    <div className="inline-flex min-w-full flex-col">
      {/* cabeçalho com nome dos profissionais */}
      <div className="mb-3 flex">
        <div className="w-14 shrink-0" />
        {byProfessional.map(({ professional }) => (
          <div key={professional.id} className="min-w-60 flex-1 px-2">
            <div className="flex items-center gap-2">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                {professional.name.charAt(0).toUpperCase()}
              </div>
              <span className="truncate text-sm font-medium text-slate-700">
                {professional.name}
              </span>
            </div>
          </div>
        ))}
      </div>
      {/* linhas por horário */}
      {allColumnHours.map((hour) => (
        <div key={hour} className="flex items-start">
          <div className="sticky left-0 z-10 w-14 shrink-0 bg-background pt-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {hour}
            </span>
          </div>
          {byProfessional.map(({ professional, appointments: profAppts }) => {
            const appts = profAppts.filter((a) => toHour(a) === hour)
            return (
              <div
                key={professional.id}
                className="min-w-60 flex-1 space-y-2 px-1 pb-2"
              >
                {appts.map((appt) => (
                  <AppointmentCard
                    key={appt.id}
                    appointment={appt}
                    onClick={handleCardClick}
                    onReschedule={handleReschedule}
                    onConfirm={handleConfirmInline}
                    onPay={handlePayInline}
                  />
                ))}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  </div>

// DEPOIS:
) : viewMode === 'day' && canViewAll && selectedProfessionalIds.length > 1 ? (
  <>
    {/* Mobile: lista vertical por profissional */}
    <div className="flex flex-col gap-6 md:hidden">
      {byProfessional.map(({ professional, appointments: profAppts }) => (
        <div key={professional.id}>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
              {professional.name.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-semibold text-slate-700">
              {professional.name}
            </span>
            <span className="text-xs text-muted-foreground">
              ({profAppts.length} agendamento{profAppts.length !== 1 ? 's' : ''})
            </span>
          </div>
          {profAppts.length === 0 ? (
            <p className="text-xs text-muted-foreground pl-10">Sem agendamentos</p>
          ) : (
            <div className="space-y-2">
              {profAppts.map((appt) => (
                <AppointmentCard
                  key={appt.id}
                  appointment={appt}
                  onClick={handleCardClick}
                  onReschedule={handleReschedule}
                  onConfirm={handleConfirmInline}
                  onPay={handlePayInline}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
    {/* Desktop: colunas side-by-side (layout original) */}
    <div className="hidden overflow-x-auto md:block">
      <div className="inline-flex min-w-full flex-col">
        <div className="mb-3 flex">
          <div className="w-14 shrink-0" />
          {byProfessional.map(({ professional }) => (
            <div key={professional.id} className="min-w-60 flex-1 px-2">
              <div className="flex items-center gap-2">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                  {professional.name.charAt(0).toUpperCase()}
                </div>
                <span className="truncate text-sm font-medium text-slate-700">
                  {professional.name}
                </span>
              </div>
            </div>
          ))}
        </div>
        {allColumnHours.map((hour) => (
          <div key={hour} className="flex items-start">
            <div className="sticky left-0 z-10 w-14 shrink-0 bg-background pt-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {hour}
              </span>
            </div>
            {byProfessional.map(({ professional, appointments: profAppts }) => {
              const appts = profAppts.filter((a) => toHour(a) === hour)
              return (
                <div
                  key={professional.id}
                  className="min-w-60 flex-1 space-y-2 px-1 pb-2"
                >
                  {appts.map((appt) => (
                    <AppointmentCard
                      key={appt.id}
                      appointment={appt}
                      onClick={handleCardClick}
                      onReschedule={handleReschedule}
                      onConfirm={handleConfirmInline}
                      onPay={handlePayInline}
                    />
                  ))}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  </>
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/scheduling/agenda-day-view.tsx
git commit -m "fix(scheduling): adicionar layout mobile para visualização multi-profissional"
```

---

## Task 4 — Tooltip e arredondamento no appointment-card

**Files:**
- Modify: `src/components/domain/scheduling/appointment-card.tsx`

**Interfaces:**
- Produz: ícone de remarcar com `<Tooltip>` do design system; botões mobile com `rounded-xl`

- [ ] **Step 1: Adicionar import de Tooltip**

No topo do arquivo, adicionar ao bloco de imports:

```tsx
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
```

- [ ] **Step 2: Substituir `title` nativo pelo Tooltip**

Localizar o botão com `title="Remarcar"` (linha ~89) e substituir:

```tsx
// ANTES:
<button title="Remarcar" onClick={...} className="...">
  <Pencil className="h-4 w-4" />
</button>

// DEPOIS:
<Tooltip>
  <TooltipTrigger asChild>
    <button onClick={...} className="...">
      <Pencil className="h-4 w-4" />
    </button>
  </TooltipTrigger>
  <TooltipContent>Remarcar</TooltipContent>
</Tooltip>
```

- [ ] **Step 3: Corrigir rounded nos botões mobile**

Localizar todos os botões de quick action mobile com `rounded-lg` (linha ~106) e substituir por `rounded-xl`.

- [ ] **Step 4: Verificar tipos**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 5: Commit**

```bash
git add src/components/domain/scheduling/appointment-card.tsx
git commit -m "fix(scheduling): substituir title nativo por Tooltip e padronizar rounded-xl"
```

---

## Task 5 — Loading state em ConfirmAppointmentModal

**Files:**
- Modify: `src/components/domain/scheduling/confirm-appointment-modal.tsx`

**Interfaces:**
- Produz: skeleton visível enquanto query de anamnese carrega

- [ ] **Step 1: Adicionar import de Skeleton**

```tsx
import { Skeleton } from '@/components/ui/skeleton'
```

- [ ] **Step 2: Desestruturar isLoading da query e exibir skeleton**

Localizar a query que busca anamnese (linha ~56) e adicionar `isLoading`:

```tsx
// ANTES:
const { data: anamnese } = useQuery(...)

// DEPOIS:
const { data: anamnese, isLoading: anamneseLoading } = useQuery(...)
```

Na seção onde a anamnese é renderizada, adicionar guard:

```tsx
{anamneseLoading ? (
  <Skeleton className="h-20 w-full rounded-lg" />
) : anamnese ? (
  // render existente da anamnese
) : null}
```

- [ ] **Step 3: Verificar tipos**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add src/components/domain/scheduling/confirm-appointment-modal.tsx
git commit -m "fix(scheduling): adicionar skeleton de loading para query de anamnese"
```

---

## Task 6 — Financial: gray→slate, botão Cortesia

**Files:**
- Modify: `src/components/domain/financial/transaction-card.tsx`
- Modify: `src/components/domain/financial/register-payment-modal.tsx`

- [ ] **Step 1: Substituir gray por slate em transaction-card**

Localizar (linha ~12):

```tsx
// ANTES:
'Compra de Estoque': { label: 'Compra', className: 'bg-gray-100 text-gray-600' },

// DEPOIS:
'Compra de Estoque': { label: 'Compra', className: 'bg-slate-100 text-slate-600' },
```

- [ ] **Step 2: Corrigir size do botão Cortesia em register-payment-modal**

Localizar o botão "Cortesia" com `size="sm"` (linha ~224):

```tsx
// ANTES:
<Button size="sm" variant="outline" onClick={...}>Cortesia</Button>

// DEPOIS:
<Button variant="outline" onClick={...}>Cortesia</Button>
```

- [ ] **Step 3: Verificar tipos**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add src/components/domain/financial/transaction-card.tsx src/components/domain/financial/register-payment-modal.tsx
git commit -m "fix(financial): padronizar cores slate e tamanho de botão no modal de pagamento"
```

---

## Task 7 — CRM: touch targets, scroll popover, contador

**Files:**
- Modify: `src/components/domain/crm/filter-bar.tsx`
- Modify: `src/components/domain/crm/customer-list.tsx`

- [ ] **Step 1: Corrigir touch target nos inputs de filtro**

Em `filter-bar.tsx`, localizar todos os inputs com `className="h-8 text-sm"` e `className="h-8 px-3"` (linhas ~90, 94, 129, 133) e substituir por `h-10 sm:h-8`:

```tsx
// ANTES:
<Input className="h-8 text-sm" ... />
<Input className="h-8 px-3" ... />

// DEPOIS:
<Input className="h-10 sm:h-8 text-sm" ... />
<Input className="h-10 sm:h-8 px-3" ... />
```

- [ ] **Step 2: Adicionar scroll ao PopoverContent**

Localizar o `<PopoverContent>` do filtro avançado e adicionar classes:

```tsx
// ANTES:
<PopoverContent className="w-80 p-4">

// DEPOIS:
<PopoverContent className="w-80 p-4 max-h-[80vh] overflow-y-auto">
```

- [ ] **Step 3: Adicionar contador em CustomerList**

Em `customer-list.tsx`, localizar onde a lista é renderizada (logo após verificação de loading/error) e adicionar o contador acima da lista quando `data.length > 0`:

```tsx
{data.length > 0 && (
  <p className="text-xs text-muted-foreground mb-2">
    {data.length} cliente{data.length !== 1 ? 's' : ''} encontrado{data.length !== 1 ? 's' : ''}
  </p>
)}
```

- [ ] **Step 4: Verificar tipos**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 5: Commit**

```bash
git add src/components/domain/crm/filter-bar.tsx src/components/domain/crm/customer-list.tsx
git commit -m "fix(crm): corrigir touch targets em filtros, scroll em popover e contador de resultados"
```

---

## Task 8 — Serviços / Estoque: toasts e skeletons

**Files:**
- Modify: `src/components/domain/services/service-form-modal.tsx`
- Modify: `src/components/domain/services/catalog-grid.tsx`
- Modify: `src/components/domain/inventory/StockSaleModal.tsx`
- Modify: `src/components/domain/inventory/StockPurchaseModal.tsx`

- [ ] **Step 1: Adicionar toast.success nos onSuccess do service-form-modal**

Localizar os dois blocos `onSuccess` (linhas ~131 e ~146):

```tsx
// ANTES — update:
onSuccess: async () => {
  try { await saveTemplate(service.id) } catch { /* ignore */ }
  setSavingTemplate(false)
  onClose()
},

// DEPOIS — update:
onSuccess: async () => {
  try { await saveTemplate(service.id) } catch { /* ignore */ }
  setSavingTemplate(false)
  toast.success('Serviço atualizado com sucesso')
  onClose()
},

// ANTES — create:
onSuccess: async (created) => {
  try { await saveTemplate(created.id) } catch { /* ignore */ }
  setSavingTemplate(false)
  onClose()
},

// DEPOIS — create:
onSuccess: async (created) => {
  try { await saveTemplate(created.id) } catch { /* ignore */ }
  setSavingTemplate(false)
  toast.success('Serviço criado com sucesso')
  onClose()
},
```

- [ ] **Step 2: Input responsivo em catalog-grid**

Localizar o input de busca com `max-w-sm` (linha ~300):

```tsx
// ANTES:
<Input className="max-w-sm" ... />

// DEPOIS:
<Input className="w-full sm:max-w-sm" ... />
```

- [ ] **Step 3: Skeleton de loading em StockSaleModal**

Em `StockSaleModal.tsx`, adicionar import:

```tsx
import { Skeleton } from '@/components/ui/skeleton'
```

Modificar a linha onde `useProducts` é chamado para desestruturar `isLoading`:

```tsx
// ANTES:
const { data: productsResponse } = useProducts({ pageSize: 100 })

// DEPOIS:
const { data: productsResponse, isLoading: productsLoading } = useProducts({ pageSize: 100 })
```

Na seção do combobox de produtos (linha ~115), adicionar guard:

```tsx
{productsLoading ? (
  <Skeleton className="h-10 w-full rounded-lg" />
) : (
  // combobox existente
)}
```

- [ ] **Step 4: Mesmo fix em StockPurchaseModal**

Repetir exatamente o Step 3 em `StockPurchaseModal.tsx`.

- [ ] **Step 5: Verificar tipos**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 6: Commit**

```bash
git add src/components/domain/services/service-form-modal.tsx src/components/domain/services/catalog-grid.tsx src/components/domain/inventory/StockSaleModal.tsx src/components/domain/inventory/StockPurchaseModal.tsx
git commit -m "fix(services): adicionar toast de sucesso em serviço e skeleton de loading no estoque"
```

---

## Task 9 — IAM: Tooltip e label "(opcional)"

**Files:**
- Modify: `src/components/domain/iam/team-member-card.tsx`
- Modify: `src/components/domain/iam/edit-member-modal.tsx`

- [ ] **Step 1: Adicionar Tooltip no botão de editar membro**

Em `team-member-card.tsx`, adicionar import:

```tsx
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
```

Localizar o botão com ícone Pencil (linha ~78) e envolver:

```tsx
// ANTES:
<Button size="icon" variant="ghost" aria-label="Editar membro" onClick={...}>
  <Pencil className="h-4 w-4" />
</Button>

// DEPOIS:
<Tooltip>
  <TooltipTrigger asChild>
    <Button size="icon" variant="ghost" aria-label="Editar membro" onClick={...}>
      <Pencil className="h-4 w-4" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>Editar membro</TooltipContent>
</Tooltip>
```

- [ ] **Step 2: Padronizar texto "(opcional)" em edit-member-modal**

Em `edit-member-modal.tsx`, localizar labels com texto "opcional" inline (linha ~164) e substituir por padrão visual consistente:

```tsx
// ANTES:
<FormLabel>Campo (opcional)</FormLabel>

// DEPOIS:
<FormLabel>
  Campo{' '}
  <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
</FormLabel>
```

Aplicar o mesmo padrão em todos os labels opcionais do modal.

- [ ] **Step 3: Verificar tipos**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add src/components/domain/iam/team-member-card.tsx src/components/domain/iam/edit-member-modal.tsx
git commit -m "fix(iam): adicionar Tooltip no botão editar e padronizar label opcional"
```

---

## Task 10 — Configurações: erros silenciosos e memory leak

**Files:**
- Modify: `src/app/(app)/configuracoes/page.tsx`
- Modify: `src/components/domain/settings/whatsapp-settings-form.tsx`
- Modify: `src/components/domain/settings/business-info-form.tsx`
- Modify: `src/components/domain/settings/branding-form.tsx`
- Modify: `src/components/domain/settings/team-visibility-list.tsx`
- Modify: `src/components/domain/settings/public-page-form.tsx`

- [ ] **Step 1: Corrigir catches silenciosos em configuracoes/page.tsx**

Localizar os três blocos `.catch(() => {})` (linhas ~64, ~105, ~112):

```tsx
// ANTES:
fetch('/api/iam/branding')
  .then((r) => r.json())
  .then((data) => setConfig(data as BrandingConfig))
  .catch(() => {})
  .finally(() => setLoading(false))

// DEPOIS:
fetch('/api/iam/branding')
  .then((r) => r.json())
  .then((data) => setConfig(data as BrandingConfig))
  .catch(() => {
    toast.error('Erro ao carregar configurações de identidade visual')
  })
  .finally(() => setLoading(false))
```

Adicionar import de `toast` no topo se não existir:
```tsx
import { toast } from 'sonner'
```

Aplicar o mesmo padrão nos outros dois fetches (business-info e tenant), ajustando a mensagem:
- business-info: `'Erro ao carregar informações do negócio'`
- tenant: `'Erro ao carregar configurações da página pública'`

- [ ] **Step 2: Adicionar feedback no botão de WhatsApp (whatsapp-settings-form)**

Em `whatsapp-settings-form.tsx`, o `mutate` é chamado diretamente nos handlers de UI sem callbacks. O hook retorna `const { mutate, isPending } = useUpdateNotificationSettings()`. As chamadas de `mutate` ficam em `onClick` de botões e `onValueChange` de Selects.

Adicionar import de `toast` no topo se não existir:
```tsx
import { toast } from 'sonner'
```

Localizar o botão de Ativar/Desativar WhatsApp (linha ~107) e adicionar callbacks:

```tsx
// ANTES:
onClick={() => mutate({ whatsappEnabled: !isEnabled })}

// DEPOIS:
onClick={() => mutate(
  { whatsappEnabled: !isEnabled },
  {
    onSuccess: () => toast.success(isEnabled ? 'WhatsApp desativado' : 'WhatsApp ativado'),
    onError: () => toast.error('Erro ao atualizar configuração'),
  }
)}
```

Para as demais chamadas de `mutate` no mesmo arquivo (timezone, reminderLeadHours, reminderWindowStart, reminderWindowEnd), adicionar apenas o callback de erro pois são alterações inline:

```tsx
// ANTES:
onValueChange={(v) => mutate({ reminderLeadHours: parseInt(v) })}

// DEPOIS:
onValueChange={(v) => mutate(
  { reminderLeadHours: parseInt(v) },
  { onError: () => toast.error('Erro ao salvar configuração') }
)}
```

Aplicar o mesmo padrão nos outros `onValueChange` de Select com `mutate`.

- [ ] **Step 3: Adicionar toast em business-info-form**

Localizar o `onSuccess` (linha ~31):

```tsx
// ANTES:
{ onSuccess: () => router.refresh() }

// DEPOIS:
{
  onSuccess: () => {
    toast.success('Informações salvas com sucesso')
    router.refresh()
  },
  onError: () => toast.error('Erro ao salvar informações'),
}
```

- [ ] **Step 4: Corrigir memory leak em branding-form**

Em `branding-form.tsx`, localizar onde `URL.createObjectURL` é chamado (linha ~193):

```tsx
// ANTES:
setLogoPreview(URL.createObjectURL(file))

// DEPOIS:
const objectUrl = URL.createObjectURL(file)
setLogoPreview(prev => {
  if (prev) URL.revokeObjectURL(prev)
  return objectUrl
})
```

Adicionar cleanup no useEffect ou no unmount:

```tsx
useEffect(() => {
  return () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview)
  }
}, [logoPreview])
```

- [ ] **Step 5: Corrigir catch silencioso em team-visibility-list**

Localizar `.catch(() => {})` (linha ~25):

```tsx
// ANTES:
.catch(() => {})

// DEPOIS:
.catch(() => {
  // reverter estado otimista
  setMembers(prev => prev.map(m =>
    m.id === memberId ? { ...m, showOnPublicPage: !newValue } : m
  ))
  toast.error('Erro ao atualizar visibilidade do membro')
})
```

- [ ] **Step 6: Melhorar feedback em public-page-form**

Localizar o catch de upload (linhas ~41-42):

```tsx
// ANTES:
} catch {
  toast.error('Falha no upload da foto de capa')
}

// DEPOIS:
} catch {
  toast.error('Falha no upload. Tente novamente.')
  // resetar o input para permitir nova tentativa
  if (fileInputRef.current) fileInputRef.current.value = ''
}
```

Se `fileInputRef` não existir, adicionar:
```tsx
const fileInputRef = useRef<HTMLInputElement>(null)
```
e passar `ref={fileInputRef}` para o `<Input type="file" />`.

- [ ] **Step 7: Verificar tipos**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 8: Commit**

```bash
git add src/app/(app)/configuracoes/page.tsx src/components/domain/settings/whatsapp-settings-form.tsx src/components/domain/settings/business-info-form.tsx src/components/domain/settings/branding-form.tsx src/components/domain/settings/team-visibility-list.tsx src/components/domain/settings/public-page-form.tsx
git commit -m "fix(settings): corrigir erros silenciosos, memory leak e feedback de mutations"
```

---

## Task 11 — Billing: acessibilidade do skeleton

**Files:**
- Modify: `src/components/domain/billing/billing-plans-content.tsx`

- [ ] **Step 1: Adicionar aria-busy e corrigir altura do skeleton**

Localizar o skeleton de loading (linha ~110):

```tsx
// ANTES:
<div className="h-64 animate-pulse ...">

// DEPOIS:
<div
  className="min-h-48 animate-pulse ..."
  aria-busy="true"
  aria-label="Carregando planos de assinatura..."
>
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/billing/billing-plans-content.tsx
git commit -m "fix(billing): adicionar aria-busy no skeleton de planos e corrigir altura"
```

---

## Task 12 — Auth/Onboarding: erros, touch targets, links mortos

**Files:**
- Modify: `src/app/(auth)/login/login-client.tsx`
- Modify: `src/app/(auth)/onboarding/page.tsx`

- [ ] **Step 1: Corrigir links mortos de Termos e Privacidade**

Em `login-client.tsx`, localizar (linhas ~626-628):

```tsx
// ANTES:
<a href="#" className="underline hover:text-foreground">Termos de Uso</a>{" "}
...
<a href="#" className="underline hover:text-foreground">Política de Privacidade</a>

// DEPOIS:
<span className="underline cursor-default text-muted-foreground">Termos de Uso</span>{" "}
...
<span className="underline cursor-default text-muted-foreground">Política de Privacidade</span>
```

> Nota: usar `<span>` enquanto as páginas `/termos` e `/privacidade` não existem. Quando as páginas forem criadas, substituir por `<a href="/termos" target="_blank" rel="noopener noreferrer">`.

- [ ] **Step 2: Verificar se error handling do cadastro já cobre casos específicos**

Ler o bloco de error handling (linhas ~436-444):

```tsx
if (!res.ok) {
  const body = await res.json();
  const msg = body.error ?? "";
  if (msg === "email_taken") {
    toast.error("Este email já possui uma conta. Faça login.");
  } else {
    toast.error(msg || "Erro ao criar conta.");
  }
  return;
}
```

O código JÁ trata `email_taken`. Adicionar outros casos comuns do Supabase:

```tsx
if (!res.ok) {
  const body = await res.json();
  const msg = (body.error ?? "") as string;
  if (msg === "email_taken") {
    toast.error("Este email já possui uma conta. Faça login.");
  } else if (msg.includes("password") || msg.includes("senha")) {
    toast.error("Senha inválida. Use pelo menos 6 caracteres.");
  } else if (msg.includes("email") || msg.includes("invalid")) {
    toast.error("Email inválido. Verifique o endereço digitado.");
  } else {
    toast.error(msg || "Erro ao criar conta. Tente novamente.");
  }
  return;
}
```

- [ ] **Step 3: Corrigir touch target do color picker no onboarding**

Em `onboarding/page.tsx`, localizar o color picker (linha ~176):

```tsx
// ANTES:
<input type="color" className="h-8 w-8 ..." />

// DEPOIS:
<input type="color" className="h-11 w-11 sm:h-8 sm:w-8 cursor-pointer rounded-lg border-0 bg-transparent p-0" />
```

- [ ] **Step 4: Adicionar try/catch ao Promise.all do onboarding**

Localizar `Promise.all` (linha ~103) e envolver:

```tsx
// ANTES:
await Promise.all([...])

// DEPOIS:
try {
  await Promise.all([...])
} catch {
  toast.error('Erro ao salvar configurações. Tente novamente.')
  setIsSubmitting(false)
  return
}
```

- [ ] **Step 5: Verificar tipos**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 6: Commit**

```bash
git add src/app/\(auth\)/login/login-client.tsx src/app/\(auth\)/onboarding/page.tsx
git commit -m "fix(auth): corrigir links mortos, touch targets e error handling no onboarding"
```

---

## Task 13 — Vitrine/Portal: loading, gradiente, CPF

**Files:**
- Modify: `src/components/domain/vitrine/client-history-modal.tsx`
- Modify: `src/components/domain/vitrine/vitrine-hero.tsx`
- Modify: `src/app/(public)/[slug]/cliente/page.tsx`

- [ ] **Step 1: Adicionar loading state em client-history-modal**

Em `client-history-modal.tsx`, adicionar import:

```tsx
import { Skeleton } from '@/components/ui/skeleton'
```

Localizar onde os dados são renderizados (linhas ~123-151) e adicionar guard de loading:

```tsx
// Adicionar antes do render principal:
if (isLoading) {
  return (
    <div className="p-6 space-y-3">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  )
}
```

- [ ] **Step 2: Corrigir masking de CPF no portal do cliente**

Em `src/app/(public)/[slug]/cliente/page.tsx`, adicionar função de masking antes do componente:

```tsx
function maskCpf(cpf: string): string {
  return cpf.replace(/^(\d{3})\.(\d{3})\.(\d{3})-(\d{2})$/, '***.***.***-$4')
}
```

Localizar onde o CPF é exibido e aplicar a função:

```tsx
// ANTES:
<span>{customer.cpf}</span>

// DEPOIS:
<span>{customer.cpf ? maskCpf(customer.cpf) : '—'}</span>
```

- [ ] **Step 4: Verificar tipos**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 5: Commit**

```bash
git add src/components/domain/vitrine/client-history-modal.tsx src/components/domain/vitrine/vitrine-hero.tsx "src/app/(public)/[slug]/cliente/page.tsx"
git commit -m "fix(vitrine): loading state no modal, corrigir gradiente e masking de CPF"
```

---

## Task 14 — Global: espaçamentos, type guards, loading de relatórios

**Files:**
- Modify: `src/components/domain/dashboard/dashboard-metrics.tsx`
- Modify: `src/app/api/admin/plans/[planName]/route.ts`
- Modify: `src/app/api/admin/plans/[planName]/limits/route.ts`
- Modify: `src/app/api/admin/plans/[planName]/features/route.ts`
- Create: `src/app/(app)/relatorios/loading.tsx`

- [ ] **Step 1: Padronizar espaçamentos em dashboard-metrics**

Em `dashboard-metrics.tsx`, substituir `gap-1.5` por `gap-2` em todo o arquivo:

```bash
# Verificar ocorrências primeiro:
grep -n "gap-1\.5" src/components/domain/dashboard/dashboard-metrics.tsx
```

Substituir todas as ocorrências de `gap-1.5` por `gap-2`.

- [ ] **Step 2: Criar type guard para PlanName**

Criar função helper que será usada nas 3 rotas admin. Em cada arquivo de rota, substituir `as any` por validação com type guard:

Em `src/app/api/admin/plans/[planName]/route.ts`:

```tsx
import { PlanName } from '@prisma/client'

const VALID_PLANS = Object.values(PlanName)

function isPlanName(value: string): value is PlanName {
  return VALID_PLANS.includes(value as PlanName)
}

export async function GET(
  req: Request,
  { params }: { params: { planName: string } }
) {
  const { planName } = await params
  if (!isPlanName(planName)) {
    return Response.json({ error: 'Plano inválido' }, { status: 400 })
  }
  // usar planName (agora tipado como PlanName) sem cast
  ...
}
```

Aplicar o mesmo padrão em `limits/route.ts` e `features/route.ts`, removendo todos os `as any`.

- [ ] **Step 3: Criar loading.tsx para relatórios**

```tsx
// src/app/(app)/relatorios/loading.tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function RelatoriosLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )
}
```

- [ ] **Step 4: Verificar tipos — gate final**

```bash
npx tsc --noEmit
```

Esperado: zero erros no projeto inteiro.

- [ ] **Step 5: Rodar testes**

```bash
npx vitest run
```

Esperado: todos os testes passando.

- [ ] **Step 6: Commit**

```bash
git add src/components/domain/dashboard/dashboard-metrics.tsx src/app/api/admin/plans/ src/app/\(app\)/relatorios/loading.tsx
git commit -m "fix(global): padronizar espaçamentos, type guards em admin e loading de relatórios"
```

---

## Task 15 — PR e revisão final

- [ ] **Step 1: Gate final completo**

```bash
npx tsc --noEmit
npx vitest run
```

Ambos devem passar com zero erros.

- [ ] **Step 2: Abrir Pull Request**

```bash
gh pr create \
  --title "fix(ui-ux): audit completo — 38 correções em 10 domínios" \
  --body "$(cat <<'EOF'
## Resumo

Implementação do audit UI/UX sistemático de todas as telas do sistema.

## O que foi corrigido

- **Scheduling:** AlertDialog para NO_SHOW, layout mobile multi-profissional, cores hardcoded → design system, Tooltip em ícone, loading em modal de confirmação
- **Financial:** gray→slate em badges, tamanho de botão no modal de pagamento
- **CRM:** touch targets 44px em filtros, scroll em popover, contador de resultados
- **Serviços/Estoque:** toasts de sucesso em criação/edição, skeleton de loading nos combos
- **IAM:** Tooltip em ícone de editar, padrão visual de labels opcionais
- **Configurações:** erros silenciosos → feedback via toast, memory leak de URL.createObjectURL, retry em upload
- **Billing:** acessibilidade aria-busy no skeleton
- **Auth/Onboarding:** links mortos Termos/Privacidade, touch targets color picker, error handling específico, Promise.all com catch
- **Vitrine/Portal:** loading state em modal, `bg-linear` → `bg-gradient`, masking correto de CPF
- **Global:** espaçamentos consistentes, type guards em rotas admin, loading.tsx para relatórios

## Spec

`docs/superpowers/specs/2026-06-20-ui-ux-audit-design.md`

## Test plan
- [ ] Verificar `npx tsc --noEmit` — zero erros
- [ ] Verificar `npx vitest run` — todos passando
- [ ] Testar NO_SHOW na agenda — deve abrir AlertDialog
- [ ] Testar agenda em 375px com múltiplos profissionais — deve mostrar lista vertical
- [ ] Testar filtros de CRM em mobile — inputs acessíveis
- [ ] Testar criar serviço — deve mostrar toast de sucesso
- [ ] Testar configurações do WhatsApp — deve mostrar feedback ao salvar

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" \
  --base main \
  --repo AdemilsonB/estetica-saas
```

---

## Checklist de aceite final

- [ ] Zero ações destrutivas sem AlertDialog
- [ ] Zero mutations sem toast de feedback (success + error)
- [ ] Zero catches silenciosos em fetches críticos
- [ ] Zero `as any` nos arquivos modificados
- [ ] Todos os ícones standalone com Tooltip
- [ ] Touch targets ≥ 44px em mobile para todos os interativos modificados
- [ ] `npx tsc --noEmit` — zero erros
- [ ] `npx vitest run` — todos passando
- [ ] PR aberta e mergeada na `main`
