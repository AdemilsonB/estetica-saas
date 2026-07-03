# Indicadores Visuais de Agendamento no Calendário — Plano de Implementação

> **Para agentes de implementação:** SUB-SKILL OBRIGATÓRIA: Use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para executar este plano tarefa por tarefa. Os passos usam sintaxe de checkbox (`- [ ]`) para rastreamento.

**Goal:** Adicionar ao calendário da Agenda indicadores de densidade de agendamentos por dia (badge numérico + anel de ocupação) e uma visão mensal completa, além de aprimorar a visão semanal para uma grade de horários.

**Architecture:** Extensão da tela `/agenda` adicionando um terceiro modo de visão ("Mês") ao toggle Dia|Semana já existente. O backend ganha um endpoint eficiente de contagens mensais. No frontend, dois novos componentes: `AgendaMonthView` (calendário mensal com badges e anéis SVG) e `AgendaWeekGrid` (grade de horários). O componente `AgendaDayView` é modificado para orquestrar os três modos.

**Tech Stack:** Next.js 15 App Router, TypeScript, TanStack Query, Prisma, Tailwind CSS, Shadcn UI, Lucide React, SVG nativo para os anéis de ocupação.

## Global Constraints

- Mobile-first: todo layout deve funcionar em 375px de largura mínima; touch targets mínimo 44px
- Sem `any` no TypeScript; strict mode ativado
- `tenantId` sempre do session context, nunca do body/URL
- Usar erros tipados de `src/shared/errors/`
- Seguir padrão `useQuery` do TanStack Query (`staleTime: 30 * 1000`)
- Não cancelar agendamentos ou alterar dados — este plano é exclusivamente de leitura/visualização
- Nenhum novo model Prisma; apenas queries de leitura
- Commits em português, mensagens no padrão `feat(scheduling): descrição`
- Status ignorados no cálculo de ocupação: `CANCELLED` e `NO_SHOW` (só contar ativos)
- Branch dedicada: `feat/calendario-indicadores-visuais`

---

## Mapa de Arquivos

| Ação | Arquivo | Responsabilidade |
|------|---------|-----------------|
| Criar | `src/app/api/scheduling/appointments/counts/route.ts` | Endpoint GET que retorna contagens por dia do mês |
| Criar | `src/hooks/scheduling/use-monthly-appointment-counts.ts` | Hook TanStack Query para contagens mensais |
| Criar | `src/components/domain/scheduling/agenda-month-view.tsx` | Calendário mensal com badges e anéis de ocupação |
| Criar | `src/components/domain/scheduling/agenda-week-grid.tsx` | Grade de horários semanal (linhas = horas, colunas = dias) |
| Criar | `src/domains/scheduling/__tests__/appointment-counts.test.ts` | Testes do método de contagem no repository |
| Modificar | `src/domains/scheduling/appointment.repository.ts` | Adicionar `countByDateRange()` |
| Modificar | `src/domains/scheduling/scheduling.service.ts` | Adicionar `getAppointmentCounts()` |
| Modificar | `src/domains/scheduling/types.ts` | Adicionar schema de validação do endpoint de counts |
| Modificar | `src/components/domain/scheduling/agenda-day-view.tsx` | Adicionar modo 'month', integrar novos componentes |

---

### Tarefa 1: Criar branch e método de contagem no repository

**Files:**
- Modify: `src/domains/scheduling/appointment.repository.ts`
- Create: `src/domains/scheduling/__tests__/appointment-counts.test.ts`

**Interfaces:**
- Produz: `appointmentRepository.countByDateRange(tenantId, from, to): Promise<Record<string, number>>`
  - Retorna objeto onde chaves são `"YYYY-MM-DD"` (horário local de Brasília, `America/Sao_Paulo`) e valores são contagens de agendamentos ativos (excluindo `CANCELLED` e `NO_SHOW`)
  - Usa a data local de `startsAt` para agrupar (não UTC)

- [ ] **Passo 1: Criar a branch**

```bash
git checkout main && git pull && git checkout -b feat/calendario-indicadores-visuais
```

- [ ] **Passo 2: Escrever o teste falhando**

Criar `src/domains/scheduling/__tests__/appointment-counts.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { mockDeep, mockReset } from 'vitest-mock-extended'
import { PrismaClient, AppointmentStatus } from '@prisma/client'
import { AppointmentRepository } from '../appointment.repository'

const mockPrisma = mockDeep<PrismaClient>()

vi.mock('@/shared/database/prisma', () => ({ prisma: mockPrisma }))

describe('AppointmentRepository.countByDateRange', () => {
  let repo: AppointmentRepository

  beforeEach(() => {
    mockReset(mockPrisma)
    repo = new AppointmentRepository()
  })

  it('retorna contagem zerada quando não há agendamentos', async () => {
    mockPrisma.appointment.findMany.mockResolvedValue([])
    const result = await repo.countByDateRange('tenant-1', new Date('2026-07-01'), new Date('2026-07-31'))
    expect(result).toEqual({})
  })

  it('agrupa agendamentos por data local e exclui CANCELLED e NO_SHOW', async () => {
    mockPrisma.appointment.findMany.mockResolvedValue([
      { startsAt: new Date('2026-07-05T10:00:00-03:00'), status: AppointmentStatus.SCHEDULED } as any,
      { startsAt: new Date('2026-07-05T14:00:00-03:00'), status: AppointmentStatus.CONFIRMED } as any,
      { startsAt: new Date('2026-07-05T09:00:00-03:00'), status: AppointmentStatus.CANCELLED } as any,
      { startsAt: new Date('2026-07-10T11:00:00-03:00'), status: AppointmentStatus.COMPLETED } as any,
      { startsAt: new Date('2026-07-10T08:00:00-03:00'), status: AppointmentStatus.NO_SHOW } as any,
    ])
    const result = await repo.countByDateRange('tenant-1', new Date('2026-07-01'), new Date('2026-07-31'))
    expect(result['2026-07-05']).toBe(2)
    expect(result['2026-07-10']).toBe(1)
    expect(Object.keys(result)).toHaveLength(2)
  })

  it('filtra pelo tenantId corretamente', async () => {
    mockPrisma.appointment.findMany.mockResolvedValue([])
    await repo.countByDateRange('tenant-abc', new Date('2026-07-01'), new Date('2026-07-31'))
    expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-abc' })
      })
    )
  })
})
```

- [ ] **Passo 3: Verificar que o teste falha**

```bash
npx vitest run src/domains/scheduling/__tests__/appointment-counts.test.ts
```
Expected: FAIL com "countByDateRange is not a function"

- [ ] **Passo 4: Implementar `countByDateRange` no repository**

Em `src/domains/scheduling/appointment.repository.ts`, após o método `countThisMonth`:

```typescript
async countByDateRange(
  tenantId: string,
  from: Date,
  to: Date,
): Promise<Record<string, number>> {
  const appointments = await prisma.appointment.findMany({
    where: {
      tenantId,
      status: {
        notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
      },
      startsAt: { gte: from, lte: to },
    },
    select: { startsAt: true },
  })

  const counts: Record<string, number> = {}
  for (const appt of appointments) {
    const key = appt.startsAt
      .toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}
```

Nota: `'en-CA'` locale com `toLocaleDateString` produz `"YYYY-MM-DD"` nativamente.

- [ ] **Passo 5: Rodar os testes e verificar que passam**

```bash
npx vitest run src/domains/scheduling/__tests__/appointment-counts.test.ts
```
Expected: PASS (3 testes)

- [ ] **Passo 6: Commit**

```bash
git add src/domains/scheduling/appointment.repository.ts src/domains/scheduling/__tests__/appointment-counts.test.ts
git commit -m "feat(scheduling): adiciona countByDateRange no AppointmentRepository"
```

---

### Tarefa 2: Service method + API endpoint de contagens mensais

**Files:**
- Modify: `src/domains/scheduling/scheduling.service.ts`
- Modify: `src/domains/scheduling/types.ts`
- Create: `src/app/api/scheduling/appointments/counts/route.ts`

**Interfaces:**
- Consome: `appointmentRepository.countByDateRange(tenantId, from, to)`
- Produz: `GET /api/scheduling/appointments/counts?from=ISO&to=ISO`
  - Response: `{ counts: Record<string, number>, capacity: number }`
  - `capacity` = `Math.round(540 / slotIntervalMinutes)` (9 horas ÷ intervalo do slot)

- [ ] **Passo 1: Adicionar schema de validação em `types.ts`**

Após os schemas existentes em `src/domains/scheduling/types.ts`:

```typescript
export const appointmentCountsQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
})

export type AppointmentCountsQuery = z.infer<typeof appointmentCountsQuerySchema>
```

- [ ] **Passo 2: Adicionar método no service**

Em `src/domains/scheduling/scheduling.service.ts`, localizar o método `listAppointments` e adicionar após ele:

```typescript
async getAppointmentCounts(
  tenantId: string,
  from: Date,
  to: Date,
): Promise<{ counts: Record<string, number>; capacity: number }> {
  const [counts, policy] = await Promise.all([
    appointmentRepository.countByDateRange(tenantId, from, to),
    schedulingPolicyRepository.findByTenant(tenantId),
  ])
  const slotInterval = policy?.slotIntervalMinutes ?? 30
  const capacity = Math.round(540 / slotInterval)
  return { counts, capacity }
}
```

Nota: `schedulingPolicyRepository` já é importado no service. Verificar que `import { schedulingPolicyRepository } from './scheduling-policy.repository'` existe no topo do arquivo; se não existir, adicionar.

- [ ] **Passo 3: Criar a API route**

Criar `src/app/api/scheduling/appointments/counts/route.ts`:

```typescript
import { schedulingService } from '@/domains/scheduling/scheduling.service'
import { appointmentCountsQuerySchema } from '@/domains/scheduling/types'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { ensurePermission, PERMISSIONS } from '@/shared/auth/permissions'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'

export async function GET(request: Request) {
  initializeDomainRuntime()

  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.appointments.view)

    const { searchParams } = new URL(request.url)
    const query = appointmentCountsQuerySchema.parse({
      from: searchParams.get('from'),
      to: searchParams.get('to'),
    })

    const result = await schedulingService.getAppointmentCounts(
      session.tenantId,
      new Date(query.from),
      new Date(query.to),
    )
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Passo 4: Verificar que o import do schedulingPolicyRepository existe no service**

```bash
grep -n "schedulingPolicyRepository" src/domains/scheduling/scheduling.service.ts
```

Se não houver, adicionar no topo do arquivo:
```typescript
import { schedulingPolicyRepository } from './scheduling-policy.repository'
```

- [ ] **Passo 5: Checar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```
Expected: zero erros relacionados aos arquivos novos

- [ ] **Passo 6: Commit**

```bash
git add src/domains/scheduling/scheduling.service.ts src/domains/scheduling/types.ts src/app/api/scheduling/appointments/counts/route.ts
git commit -m "feat(scheduling): endpoint GET /api/scheduling/appointments/counts para contagens mensais"
```

---

### Tarefa 3: Hook `useMonthlyAppointmentCounts`

**Files:**
- Create: `src/hooks/scheduling/use-monthly-appointment-counts.ts`

**Interfaces:**
- Consome: `GET /api/scheduling/appointments/counts?from=ISO&to=ISO`
- Produz: `useMonthlyAppointmentCounts(year: number, month: number)` → `{ counts: Record<string, number>, capacity: number, isLoading, error }`
  - `month` é 0-based (igual ao `Date.getMonth()`)
  - Invalida automaticamente ao mudar `year`/`month`

- [ ] **Passo 1: Criar o hook**

Criar `src/hooks/scheduling/use-monthly-appointment-counts.ts`:

```typescript
import { useQuery } from '@tanstack/react-query'

type MonthlyCountsResult = {
  counts: Record<string, number>
  capacity: number
}

async function fetchMonthlyAppointmentCounts(
  year: number,
  month: number,
): Promise<MonthlyCountsResult> {
  const from = new Date(year, month, 1)
  const to = new Date(year, month + 1, 0, 23, 59, 59, 999)
  const url = new URL('/api/scheduling/appointments/counts', window.location.origin)
  url.searchParams.set('from', from.toISOString())
  url.searchParams.set('to', to.toISOString())
  const res = await fetch(url)
  if (!res.ok) throw new Error('Falha ao carregar contagens do mês')
  return res.json()
}

export function useMonthlyAppointmentCounts(year: number, month: number) {
  return useQuery({
    queryKey: ['appointment-counts', year, month],
    queryFn: () => fetchMonthlyAppointmentCounts(year, month),
    staleTime: 30 * 1000,
  })
}
```

- [ ] **Passo 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "use-monthly-appointment-counts"
```
Expected: sem saída (zero erros)

- [ ] **Passo 3: Commit**

```bash
git add src/hooks/scheduling/use-monthly-appointment-counts.ts
git commit -m "feat(scheduling): hook useMonthlyAppointmentCounts para dados do calendário mensal"
```

---

### Tarefa 4: Componente `AgendaMonthView` — calendário mensal com badges e anéis

**Files:**
- Create: `src/components/domain/scheduling/agenda-month-view.tsx`

**Interfaces:**
- Consome: `useMonthlyAppointmentCounts(year, month)`
- Props:
  ```typescript
  type Props = {
    selectedDate: Date
    onSelectDate: (d: Date) => void
    onSelectDayView: () => void // chamado ao clicar em um dia → troca para modo 'day'
  }
  ```
- Produz: componente visual com grade mensal, navegação prev/next mês, badges e anéis de ocupação

**Sub-componente: `OccupancyRing`**
- SVG circular progress
- Props: `count: number`, `capacity: number`, `size: number`, `isSelected: boolean`, `isToday: boolean`
- Usa `stroke-dasharray` com circunferência = 100 (raio ≈ 15.9, perímetro ≈ 99.9)
- Cor primária da marca via `text-primary` / `currentColor`

- [ ] **Passo 1: Criar o componente**

Criar `src/components/domain/scheduling/agenda-month-view.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useMonthlyAppointmentCounts } from '@/hooks/scheduling/use-monthly-appointment-counts'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

type OccupancyRingProps = {
  count: number
  capacity: number
  size: number
  isSelected: boolean
  isToday: boolean
}

function OccupancyRing({ count, capacity, size, isSelected, isToday }: OccupancyRingProps) {
  const occupancy = Math.min(count / capacity, 1)
  const filled = Math.round(occupancy * 100)
  const r = 15.9
  const bgColor = isSelected ? 'rgba(255,255,255,0.3)' : '#e2e8f0'
  const fgColor = isSelected ? 'white' : isToday ? 'currentColor' : 'currentColor'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      className={isSelected || isToday ? 'text-primary-foreground' : 'text-primary'}
      aria-hidden
    >
      <circle cx="18" cy="18" r={r} fill="none" stroke={bgColor} strokeWidth="2.5" />
      {filled > 0 && (
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke={fgColor}
          strokeWidth="2.5"
          strokeDasharray={`${filled} 100`}
          strokeLinecap="round"
          transform="rotate(-90 18 18)"
        />
      )}
    </svg>
  )
}

function getDaysInMonth(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const days: Date[] = []
  // Preencher dias anteriores (calendário começa na segunda)
  const startWeekday = (first.getDay() + 6) % 7 // 0 = seg
  for (let i = startWeekday - 1; i >= 0; i--) {
    const d = new Date(year, month, -i)
    days.push(d)
  }
  // Dias do mês
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(new Date(year, month, d))
  }
  // Preencher dias posteriores para completar a última semana
  const remaining = (7 - (days.length % 7)) % 7
  for (let i = 1; i <= remaining; i++) {
    days.push(new Date(year, month + 1, i))
  }
  return days
}

type Props = {
  selectedDate: Date
  onSelectDate: (d: Date) => void
  onSelectDayView: () => void
}

export function AgendaMonthView({ selectedDate, onSelectDate, onSelectDayView }: Props) {
  const [viewYear, setViewYear] = useState(selectedDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth())

  const { data, isLoading } = useMonthlyAppointmentCounts(viewYear, viewMonth)
  const counts = data?.counts ?? {}
  const capacity = data?.capacity ?? 16

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const days = getDaysInMonth(viewYear, viewMonth)

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  function handleDayClick(d: Date) {
    onSelectDate(d)
    onSelectDayView()
  }

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="flex flex-col gap-4">
      {/* Navegação de mês */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={prevMonth} className="rounded-full shrink-0">
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-semibold capitalize text-slate-700">{monthLabel}</span>
        <Button variant="outline" size="icon" onClick={nextMonth} className="rounded-full shrink-0">
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Cabeçalho dos dias da semana */}
      <div className="grid grid-cols-7">
        {WEEKDAYS.map(wd => (
          <div key={wd} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {wd}
          </div>
        ))}
      </div>

      {/* Grade de dias */}
      <div className="grid grid-cols-7 gap-y-1">
        {days.map((d) => {
          const isCurrentMonth = d.getMonth() === viewMonth
          const isToday = d.toDateString() === today.toDateString()
          const isSelected = d.toDateString() === selectedDate.toDateString()
          const dateKey = d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
          const count = counts[dateKey] ?? 0
          const hasAppointments = count > 0

          return (
            <button
              key={d.toISOString()}
              aria-label={`${d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}${count > 0 ? `, ${count} agendamento${count > 1 ? 's' : ''}` : ''}`}
              aria-pressed={isSelected}
              onClick={() => handleDayClick(d)}
              disabled={!isCurrentMonth}
              className={cn(
                'relative flex flex-col items-center justify-center py-1.5 rounded-xl transition-all min-h-[52px]',
                !isCurrentMonth && 'opacity-0 pointer-events-none',
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : isToday
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-slate-100 text-slate-700',
              )}
            >
              {/* Anel de ocupação */}
              {hasAppointments && isCurrentMonth && (
                <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <OccupancyRing
                    count={count}
                    capacity={capacity}
                    size={42}
                    isSelected={isSelected}
                    isToday={isToday && !isSelected}
                  />
                </span>
              )}

              {/* Número do dia */}
              <span className={cn('relative z-10 text-sm font-semibold leading-none', !isCurrentMonth && 'text-slate-300')}>
                {d.getDate()}
              </span>

              {/* Badge numérico de contagem */}
              {isLoading && isCurrentMonth ? (
                <Skeleton className="mt-0.5 h-2 w-4 rounded-full relative z-10" />
              ) : hasAppointments && isCurrentMonth ? (
                <span
                  className={cn(
                    'relative z-10 mt-0.5 text-[10px] font-semibold leading-none',
                    isSelected ? 'text-primary-foreground/80' : 'text-primary',
                  )}
                >
                  {count}
                </span>
              ) : (
                <span className="mt-0.5 h-3 relative z-10" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Passo 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "agenda-month-view"
```
Expected: sem saída

- [ ] **Passo 3: Commit**

```bash
git add src/components/domain/scheduling/agenda-month-view.tsx
git commit -m "feat(scheduling): componente AgendaMonthView com badges e anéis de ocupação"
```

---

### Tarefa 5: Componente `AgendaWeekGrid` — grade de horários semanal

**Files:**
- Create: `src/components/domain/scheduling/agenda-week-grid.tsx`

**Interfaces:**
- Consome: `useAppointments` (hook já existente) com range da semana atual
- Props:
  ```typescript
  type Props = {
    selectedDate: Date
    onSelectDate: (d: Date) => void
    onAppointmentClick: (appt: Appointment) => void
    professionalId?: string
  }
  ```
- Produz: grade de 15 linhas de horário (07:00–21:00) × 7 colunas de dias
- Mobile: scroll horizontal nativo (`overflow-x-auto`), coluna de horário sticky

**Layout da grade:**
```
        Seg  Ter  Qua  Qui  Sex  Sáb  Dom
07:00  |    |    |    |    |    |    |    |
08:00  | 🎯 |    |    |    |    |    |    |
...
21:00  |    |    |    |    |    |    |    |
```

- [ ] **Passo 1: Criar o componente**

Criar `src/components/domain/scheduling/agenda-week-grid.tsx`:

```tsx
'use client'

import { useMemo } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppointments, type Appointment } from '@/hooks/scheduling/use-appointments'
import { cn } from '@/lib/utils'

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7) // 07–21
const HOUR_LABELS = HOURS.map(h => `${String(h).padStart(2, '0')}:00`)

function startOfWeek(d: Date): Date {
  const r = new Date(d)
  const day = r.getDay()
  r.setDate(r.getDate() - day + (day === 0 ? -6 : 1))
  r.setHours(0, 0, 0, 0)
  return r
}

function toDateString(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

function toHourIndex(appt: Appointment): number {
  const h = new Date(appt.startsAt).getHours()
  return h - 7 // offset to HOURS array
}

function toTimeLabel(appt: Appointment): string {
  return new Date(appt.startsAt).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

type Props = {
  selectedDate: Date
  onSelectDate: (d: Date) => void
  onAppointmentClick: (appt: Appointment) => void
  professionalId?: string
}

export function AgendaWeekGrid({ selectedDate, onSelectDate, onAppointmentClick, professionalId }: Props) {
  const monday = useMemo(() => startOfWeek(selectedDate), [selectedDate])
  const sunday = useMemo(() => {
    const d = new Date(monday)
    d.setDate(d.getDate() + 6)
    d.setHours(23, 59, 59, 999)
    return d
  }, [monday])

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return d
    }),
    [monday],
  )

  const { data: appointments = [], isLoading } = useAppointments({
    from: monday.toISOString(),
    to: sunday.toISOString(),
    professionalId,
  })

  const today = new Date()

  // Map: dateString → hourIndex → appointments[]
  const grid = useMemo(() => {
    const m: Record<string, Record<number, Appointment[]>> = {}
    for (const appt of appointments) {
      const key = toDateString(new Date(appt.startsAt))
      const hi = toHourIndex(appt)
      if (hi < 0 || hi >= HOURS.length) continue // fora do range visível
      if (!m[key]) m[key] = {}
      if (!m[key][hi]) m[key][hi] = []
      m[key][hi].push(appt)
    }
    return m
  }, [appointments])

  return (
    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 rounded-xl border border-slate-100">
      <div className="inline-flex min-w-full flex-col">

        {/* Cabeçalho — dias */}
        <div className="flex border-b border-slate-100 bg-white sticky top-0 z-10">
          <div className="w-12 shrink-0" />
          {weekDays.map((d) => {
            const isToday = d.toDateString() === today.toDateString()
            const isSelected = d.toDateString() === selectedDate.toDateString()
            return (
              <button
                key={d.toISOString()}
                onClick={() => onSelectDate(d)}
                aria-label={d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric' })}
                aria-pressed={isSelected}
                className={cn(
                  'flex min-w-[52px] flex-1 flex-col items-center py-2 transition hover:bg-slate-50',
                  isSelected && 'bg-primary/5',
                )}
              >
                <span className="text-[10px] font-medium uppercase text-slate-400">
                  {d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
                </span>
                <span
                  className={cn(
                    'flex size-7 items-center justify-center rounded-full text-sm font-semibold',
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : isToday
                        ? 'bg-primary/10 text-primary'
                        : 'text-slate-700',
                  )}
                >
                  {d.getDate()}
                </span>
              </button>
            )
          })}
        </div>

        {/* Linhas de horário */}
        {isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          HOURS.map((hour, hi) => (
            <div key={hour} className="flex border-t border-slate-50 min-h-[48px]">
              {/* Label de hora */}
              <div className="sticky left-0 z-10 w-12 shrink-0 bg-white pt-1 pr-2">
                <span className="text-[10px] font-semibold text-slate-300">
                  {HOUR_LABELS[hi]}
                </span>
              </div>

              {/* Células por dia */}
              {weekDays.map((d) => {
                const key = toDateString(d)
                const appts = grid[key]?.[hi] ?? []
                const isToday = d.toDateString() === today.toDateString()
                return (
                  <div
                    key={d.toISOString()}
                    className={cn(
                      'min-w-[52px] flex-1 border-l border-slate-50 p-0.5',
                      isToday && 'bg-primary/[0.02]',
                    )}
                  >
                    {appts.map((appt) => (
                      <button
                        key={appt.id}
                        onClick={() => onAppointmentClick(appt)}
                        title={`${appt.customer.name} — ${appt.service?.name ?? appt.package?.name ?? 'Serviço'} às ${toTimeLabel(appt)}`}
                        className={cn(
                          'w-full rounded text-left px-1 py-0.5 text-[10px] leading-tight transition',
                          'bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20',
                          appt.status === 'COMPLETED' && 'opacity-60',
                        )}
                      >
                        <span className="block truncate font-semibold">{toTimeLabel(appt)}</span>
                        <span className="block truncate text-slate-600">{appt.customer.name}</span>
                      </button>
                    ))}
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
```

- [ ] **Passo 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "agenda-week-grid"
```
Expected: sem saída

- [ ] **Passo 3: Commit**

```bash
git add src/components/domain/scheduling/agenda-week-grid.tsx
git commit -m "feat(scheduling): componente AgendaWeekGrid — grade de horários semanal"
```

---

### Tarefa 6: Integrar novos modos em `AgendaDayView`

**Files:**
- Modify: `src/components/domain/scheduling/agenda-day-view.tsx`

**Interfaces:**
- Consome: `AgendaMonthView`, `AgendaWeekGrid` (novos componentes das tarefas 4 e 5)
- Muda `ViewMode = 'day' | 'week'` para `ViewMode = 'day' | 'week' | 'month'`
- Quando modo = 'month': renderiza `AgendaMonthView`; ao clicar num dia troca para 'day'
- Quando modo = 'week': renderiza `AgendaWeekGrid` (novo) em vez da lista semanal antiga
- Quando modo = 'day': comportamento inalterado (lista por hora)
- O toggle passa a ter 3 botões: Dia | Semana | Mês

- [ ] **Passo 1: Atualizar os imports no topo de `agenda-day-view.tsx`**

Localizar a linha de imports em `src/components/domain/scheduling/agenda-day-view.tsx`:

```typescript
import { useState, useEffect } from 'react'
import { Plus, CalendarDays, LayoutList, CalendarRange } from 'lucide-react'
```

Substituir por:

```typescript
import { useState, useEffect } from 'react'
import { Plus, CalendarDays, LayoutList, CalendarRange, CalendarDays as CalendarMonth } from 'lucide-react'
import { AgendaMonthView } from './agenda-month-view'
import { AgendaWeekGrid } from './agenda-week-grid'
```

Nota: Lucide não tem um ícone "CalendarMonth" específico; usar `CalendarDays` para mês ou `Grid3x3` — verificar quais estão disponíveis. Na prática, usar:
- `LayoutList` → Dia
- `CalendarRange` → Semana  
- `CalendarDays` → Mês

- [ ] **Passo 2: Atualizar o tipo `ViewMode`**

Localizar:
```typescript
type ViewMode = 'day' | 'week'
```

Substituir por:
```typescript
type ViewMode = 'day' | 'week' | 'month'
```

- [ ] **Passo 3: Atualizar os imports e o `from`/`to` de query**

No bloco que calcula `from` e `to` (aproximadamente linha 143), a lógica atual para `viewMode === 'day'` e `viewMode === 'week'` deve permanecer. Adicionar que quando `viewMode === 'month'`, a query também usa o range da semana corrente (a lista de agendamentos do mês só é buscada internamente pelo `AgendaMonthView` via `useMonthlyAppointmentCounts`):

```typescript
const from =
  viewMode === 'day'
    ? startOfDay(selectedDate).toISOString()
    : weekStart.toISOString()
const to =
  viewMode === 'day'
    ? endOfDay(selectedDate).toISOString()
    : weekEnd.toISOString()
```

Esta lógica já cobre 'month' adequadamente (o mês não usa esses dados — usa o hook próprio).

- [ ] **Passo 4: Atualizar o toggle de view no JSX**

Localizar o bloco do toggle (aproximadamente linha 214):

```tsx
<div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1">
  <Button
    variant={viewMode === 'day' ? 'default' : 'ghost'}
    size="sm"
    onClick={() => setViewMode('day')}
    className="rounded-full"
  >
    <LayoutList className="size-4" />
    <span className="hidden sm:inline">Dia</span>
  </Button>
  <Button
    variant={viewMode === 'week' ? 'default' : 'ghost'}
    size="sm"
    onClick={() => setViewMode('week')}
    className="rounded-full"
  >
    <CalendarRange className="size-4" />
    <span className="hidden sm:inline">Semana</span>
  </Button>
</div>
```

Substituir por:

```tsx
<div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1">
  <Button
    variant={viewMode === 'day' ? 'default' : 'ghost'}
    size="sm"
    onClick={() => setViewMode('day')}
    className="rounded-full"
  >
    <LayoutList className="size-4" />
    <span className="hidden sm:inline">Dia</span>
  </Button>
  <Button
    variant={viewMode === 'week' ? 'default' : 'ghost'}
    size="sm"
    onClick={() => setViewMode('week')}
    className="rounded-full"
  >
    <CalendarRange className="size-4" />
    <span className="hidden sm:inline">Semana</span>
  </Button>
  <Button
    variant={viewMode === 'month' ? 'default' : 'ghost'}
    size="sm"
    onClick={() => setViewMode('month')}
    className="rounded-full"
  >
    <CalendarDays className="size-4" />
    <span className="hidden sm:inline">Mês</span>
  </Button>
</div>
```

- [ ] **Passo 5: Adicionar renderização do modo 'month'**

Localizar o bloco de renderização condicional (aproximadamente linha 273, onde começa `{isLoading ? ...`).

Antes do bloco `isLoading ?`, adicionar o early return para modo mês:

```tsx
{/* Modo mensal — renderizado antes dos outros estados */}
{viewMode === 'month' && (
  <AgendaMonthView
    selectedDate={selectedDate}
    onSelectDate={(d) => {
      if (dateProp === undefined) setInternalDate(d)
    }}
    onSelectDayView={() => setViewMode('day')}
  />
)}

{/* Conteúdo para modos dia e semana */}
{viewMode !== 'month' && (
  <>
    {isLoading ? (
      /* ... todo o bloco de loading/error/empty/day/week existente ... */
    ) : /* ... */ }
  </>
)}
```

**Atenção:** ao mover o código, garantir que os estados dos modais (`drawerOpen`, `createModalOpen`, etc.) continuam renderizados fora do bloco condicional, pois precisam estar presentes em todos os modos.

Estrutura final do return (resumida):

```tsx
return (
  <div className="flex flex-col gap-4">
    {/* Header: toggle de visão + filtro de profissional + botão novo */}
    <div className="flex items-center justify-between gap-2">
      {/* Toggle: Dia | Semana | Mês */}
      ...
      {/* ProfessionalFilter */}
      ...
      {/* Botão Novo agendamento */}
      ...
    </div>

    {/* Strip semanal — ocultar no modo mês */}
    {!dateProp && viewMode !== 'month' && (
      <AgendaWeekStrip ... />
    )}

    {/* Label do dia (só modo dia) */}
    {viewMode === 'day' && (
      <p className="text-sm font-semibold capitalize text-slate-600">
        {formatDayLabel(selectedDate)}
      </p>
    )}

    {/* Modo Mês */}
    {viewMode === 'month' && (
      <AgendaMonthView
        selectedDate={selectedDate}
        onSelectDate={(d) => { if (!dateProp) setInternalDate(d) }}
        onSelectDayView={() => setViewMode('day')}
      />
    )}

    {/* Modos Dia e Semana */}
    {viewMode !== 'month' && (
      <>
        {isLoading ? (
          <div className="space-y-3">...</div>
        ) : error ? (
          <div ...>...</div>
        ) : isEmpty ? (
          <div ...>...</div>
        ) : viewMode === 'week' ? (
          /* NOVO: AgendaWeekGrid em vez da lista */
          <AgendaWeekGrid
            selectedDate={selectedDate}
            onSelectDate={(d) => { if (!dateProp) setInternalDate(d); setViewMode('day') }}
            onAppointmentClick={handleCardClick}
            professionalId={queryProfessionalId}
          />
        ) : viewMode === 'day' && canViewAll && selectedProfessionalIds.length > 1 ? (
          /* Layout colunas multi-profissional — inalterado */
          ...
        ) : (
          /* Lista por hora — inalterado */
          ...
        )}
      </>
    )}

    {/* Modais — sempre presentes */}
    <AppointmentDrawer ... />
    <CreateAppointmentModal ... />
    <RegisterPaymentModal ... />
    {confirmModalAppointment && <ConfirmAppointmentModal ... />}

    {/* FAB */}
    ...
  </div>
)
```

- [ ] **Passo 6: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: zero erros

- [ ] **Passo 7: Rodar todos os testes**

```bash
npx vitest run
```
Expected: todos passando (nenhum teste existente quebrado)

- [ ] **Passo 8: Commit**

```bash
git add src/components/domain/scheduling/agenda-day-view.tsx
git commit -m "feat(scheduling): integra modos Mês (calendário) e Semana (grade horários) na AgendaDayView"
```

---

### Tarefa 7: Verificação final e PR

**Files:** sem alterações de código

- [ ] **Passo 1: TypeScript limpo**

```bash
npx tsc --noEmit 2>&1
```
Expected: zero erros

- [ ] **Passo 2: Todos os testes passando**

```bash
npx vitest run
```
Expected: todos passando

- [ ] **Passo 3: Verificar checklist mobile-first**

Confirmar no código gerado:
- [ ] Células do calendário mensal têm `min-h-[52px]` (≥ 44px touch target)
- [ ] Cabeçalho de dias do `AgendaWeekGrid` tem `min-w-[52px]` e altura adequada
- [ ] `overflow-x-auto` no `AgendaWeekGrid` para scroll horizontal no mobile
- [ ] O toggle Dia|Semana|Mês cabe em 375px sem overflow (ícones sem label no mobile)
- [ ] Botões de navegação do mês têm `size="icon"` (44×44px)

- [ ] **Passo 4: Abrir PR**

```bash
git push -u origin feat/calendario-indicadores-visuais
gh pr create \
  --title "feat(scheduling): indicadores visuais de agendamento no calendário (badges + anéis + grade)" \
  --body "$(cat <<'EOF'
## Resumo

- Novo modo **Mês**: calendário mensal com badge numérico e anel de ocupação SVG por dia
- Novo modo **Semana**: grade de horários (07–21h × Seg–Dom) substituindo a lista semanal
- Novo endpoint `GET /api/scheduling/appointments/counts` para contagens eficientes por mês
- Toggle Dia | Semana | Mês no `AgendaDayView`
- Capacity de ocupação calculada a partir do `slotIntervalMinutes` da `SchedulingPolicy`

## Plano

`docs/superpowers/plans/2026-07-02-calendario-indicadores-agendamento.md`

## Checklist de teste

- [ ] Abrir `/agenda` em mobile (375px) — toggle cabe sem overflow
- [ ] Clicar em "Mês" — calendário mensal aparece com badges nos dias com agendamentos
- [ ] Dias com muitos agendamentos mostram anel mais preenchido
- [ ] Clicar em um dia no mês → troca para modo Dia naquela data
- [ ] Clicar em "Semana" → grade de horários com agendamentos nas células corretas
- [ ] Clicar em agendamento na grade → abre o drawer
- [ ] Modo "Dia" permanece inalterado
- [ ] Dias sem agendamento não exibem badge nem anel

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Revisão do Plano contra a Spec

### Cobertura dos requisitos

| Requisito da spec | Tarefa |
|---|---|
| 3.1 Badge numérico por dia (visão mensal) | Tarefa 4 — `AgendaMonthView` |
| 3.2 Indicador de ocupação com borda proporcional | Tarefa 4 — `OccupancyRing` SVG |
| 3.3 Toggle Semanal/Mensal | Tarefa 6 — toggle Dia\|Semana\|Mês |
| 3.3 Visão semanal com grade de horários | Tarefa 5 — `AgendaWeekGrid` |
| 3.4 Submodo Lista (fase 2) | **Fora do escopo** — spec marca como opcional |
| Consulta 1 — contagem por dia (mensal) | Tarefa 1+2+3 — endpoint `/counts` |
| Consulta 2 — agendamentos detalhados (semanal) | Reutiliza `useAppointments` existente |
| Toque em dia → lista de agendamentos | Tarefa 6 — `onSelectDayView()` troca para modo 'day' |
| Dias sem agendamento sem badge | Tarefa 4 — `count === 0` não renderiza badge nem anel |
| Requisição mensal uma vez por troca de mês | Tarefa 3 — queryKey `['appointment-counts', year, month]` |

### Itens fora do escopo (spec marca como Fase 2)

- Submodo "Visão Lista" como alternativa à "Visão Contador" no calendário mensal
- Capacidade configurável pelo usuário (atualmente derivada do `slotIntervalMinutes`)
