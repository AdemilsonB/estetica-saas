# Filtro por Profissional na Agenda — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar filtro multi-select de profissional na aba Agenda, com layout de colunas no modo Dia e controle de acesso via aba Cargos nas Configurações.

**Architecture:** A permissão `view_all` é adicionada ao `NAV_REGISTRY` da seção `agenda`, o que faz ela aparecer automaticamente na `RolePermissionMatrix` existente. O estado do filtro vive dentro do `AgendaDayView`. Quando múltiplos profissionais estão selecionados no modo Dia, o componente renderiza colunas paralelas em vez da lista por hora.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Shadcn UI (Popover/Command), TanStack Query, Vitest + @testing-library/react

---

## Mapa de arquivos

| Arquivo | Ação |
|---------|------|
| `src/shared/permissions/nav-registry.ts` | Modificar — adiciona `view_all` ao tipo `NavAction` e à seção `agenda` |
| `src/components/domain/iam/role-permission-matrix.tsx` | Modificar — adiciona `view_all` em `ALL_ACTIONS` e `ACTION_LABELS` |
| `src/domains/iam/iam.service.ts` | Modificar — expõe `role` no retorno de `getCurrentUser` |
| `src/hooks/use-current-user.ts` | Modificar — adiciona `role` ao tipo `CurrentUser` |
| `src/components/domain/scheduling/ProfessionalFilter.tsx` | **Criar** — dropdown multi-select de profissionais |
| `src/components/domain/scheduling/__tests__/ProfessionalFilter.test.tsx` | **Criar** — testes unitários |
| `src/components/domain/scheduling/agenda-day-view.tsx` | Modificar — adiciona filtro, state, layout de colunas |

---

## Task 1: Permissão `view_all` — NAV_REGISTRY e RolePermissionMatrix

**Files:**
- Modify: `src/shared/permissions/nav-registry.ts`
- Modify: `src/components/domain/iam/role-permission-matrix.tsx`

- [ ] **Step 1: Atualizar o tipo `NavAction` e a seção `agenda` no NAV_REGISTRY**

Em `src/shared/permissions/nav-registry.ts`, substitua as linhas 1 e o bloco `agenda`:

```typescript
// linha 1 — tipo atualizado
export type NavAction = 'view' | 'create' | 'edit' | 'delete' | 'view_all'

// ...resto do arquivo sem mudança...

// bloco agenda — substituir o existente
  {
    key: 'agenda',
    label: 'Agenda',
    description: 'Atendimentos e encaixes',
    icon: 'CalendarDays',
    href: '/agenda',
    actions: ['view', 'create', 'edit', 'delete', 'view_all'],
    defaultPermissions: {
      MANAGER:      ['view', 'create', 'edit', 'delete', 'view_all'],
      PROFESSIONAL: ['view', 'create'],
      RECEPTIONIST: ['view', 'create', 'edit'],
    },
  },
```

`buildOwnerPermissions()` já itera `s.actions`, então `view_all` é incluído automaticamente para OWNER.

- [ ] **Step 2: Adicionar `view_all` em `ALL_ACTIONS` e `ACTION_LABELS` na RolePermissionMatrix**

Em `src/components/domain/iam/role-permission-matrix.tsx`, substitua as constantes:

```typescript
const ACTION_LABELS: Record<NavAction, string> = {
  view:     'Visualizar',
  create:   'Criar',
  edit:     'Editar',
  delete:   'Excluir',
  view_all: 'Ver todos',
}

const ALL_ACTIONS: NavAction[] = ['view', 'create', 'edit', 'delete', 'view_all']
```

A lógica do `toggle` existente já trata `view_all` corretamente:
- Marcar `view_all` auto-adiciona `view` (cai no ramo `action !== 'view' && checked`)
- Desmarcar `view` limpa tudo incluindo `view_all` (ramo `action === 'view' && !checked`)
- Desmarcar `view_all` apenas remove ele (ramo `else`)

Seções que não têm `view_all` em `section.actions` vão exibir `–` na coluna (comportamento já existente).

- [ ] **Step 3: Verificar tipagem**

```bash
npx tsc --noEmit
```

Expected: zero erros. Se houver erro de exhaustiveness no `ACTION_LABELS`, significa que o tipo `NavAction` no import não foi atualizado — confirme que o arquivo `nav-registry.ts` foi salvo.

- [ ] **Step 4: Commit**

```bash
git add src/shared/permissions/nav-registry.ts src/components/domain/iam/role-permission-matrix.tsx
git commit -m "feat(iam): adiciona permissao view_all na secao agenda"
```

---

## Task 2: Expor `role` em `getCurrentUser`

O `AgendaDayView` precisa do `role` do usuário logado para inicializar o filtro corretamente (PROFESSIONAL começa com apenas o próprio; todos os outros começam com todos).

**Files:**
- Modify: `src/domains/iam/iam.service.ts:44-54`
- Modify: `src/hooks/use-current-user.ts:3-13`

- [ ] **Step 1: Adicionar `role` no retorno de `getCurrentUser`**

Em `src/domains/iam/iam.service.ts`, o `return` do método `getCurrentUser` (linha ~44) está assim:

```typescript
    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      isOwner: session.isOwner,
      roleId: user.roleId,
      roleName: session.isOwner ? "Dono" : (user.customRole?.name ?? "Sem cargo"),
      permissions: session.permissions,
      businessName: user.tenant.name,
    };
```

Substitua por:

```typescript
    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      role: user.role,
      isOwner: session.isOwner,
      roleId: user.roleId,
      roleName: session.isOwner ? "Dono" : (user.customRole?.name ?? "Sem cargo"),
      permissions: session.permissions,
      businessName: user.tenant.name,
    };
```

O campo `user.role` já existe no `select` do Prisma (linha 33 do mesmo arquivo).

- [ ] **Step 2: Adicionar `role` ao tipo `CurrentUser`**

Em `src/hooks/use-current-user.ts`, substitua o tipo:

```typescript
export type CurrentUser = {
  id: string
  tenantId: string
  email: string
  name: string
  role: 'OWNER' | 'MANAGER' | 'PROFESSIONAL' | 'RECEPTIONIST'
  isOwner: boolean
  roleId: string | null
  roleName: string
  permissions: Record<string, string[]>
  businessName: string
}
```

- [ ] **Step 3: Verificar tipagem**

```bash
npx tsc --noEmit
```

Expected: zero erros.

- [ ] **Step 4: Commit**

```bash
git add src/domains/iam/iam.service.ts src/hooks/use-current-user.ts
git commit -m "feat(iam): expoe campo role no getCurrentUser"
```

---

## Task 3: Criar `ProfessionalFilter` (TDD)

**Files:**
- Create: `src/components/domain/scheduling/__tests__/ProfessionalFilter.test.tsx`
- Create: `src/components/domain/scheduling/ProfessionalFilter.tsx`

- [ ] **Step 1: Criar o arquivo de teste**

Crie `src/components/domain/scheduling/__tests__/ProfessionalFilter.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
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

  it('não chama onChange ao clicar no próprio profissional logado', () => {
    const onChange = vi.fn()
    render(
      <ProfessionalFilter selectedIds={['u1']} onChange={onChange} currentUserId="u1" />,
    )
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByText(/Ana Silva/))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('exibe "(você)" ao lado do profissional logado', () => {
    render(
      <ProfessionalFilter selectedIds={['u1']} onChange={() => {}} currentUserId="u1" />,
    )
    fireEvent.click(screen.getByRole('combobox'))
    expect(screen.getByText('(você)')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Executar os testes para confirmar que falham**

```bash
npx vitest run src/components/domain/scheduling/__tests__/ProfessionalFilter.test.tsx
```

Expected: FAIL com "Cannot find module '../ProfessionalFilter'" ou similar.

- [ ] **Step 3: Criar o componente `ProfessionalFilter`**

Crie `src/components/domain/scheduling/ProfessionalFilter.tsx`:

```tsx
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

  function toggle(id: string) {
    if (id === currentUserId) return
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((s) => s !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  const label =
    selectedIds.length === 0
      ? 'Nenhum profissional'
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
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar profissional..." />
          <CommandEmpty>Nenhum profissional encontrado.</CommandEmpty>
          <CommandGroup>
            {sorted.map((member) => {
              const isCurrentUser = member.id === currentUserId
              const isSelected = selectedIds.includes(member.id)
              return (
                <CommandItem
                  key={member.id}
                  value={member.name}
                  onSelect={() => toggle(member.id)}
                  disabled={isCurrentUser}
                  className={cn(isCurrentUser && 'cursor-default opacity-70')}
                >
                  <Check
                    className={cn(
                      'mr-2 size-4',
                      isSelected ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <span className="truncate">
                    {member.name}
                    {isCurrentUser && (
                      <span className="ml-1 text-xs text-slate-400">(você)</span>
                    )}
                  </span>
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

- [ ] **Step 4: Executar os testes para confirmar que passam**

```bash
npx vitest run src/components/domain/scheduling/__tests__/ProfessionalFilter.test.tsx
```

Expected: todos os 6 testes PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/domain/scheduling/ProfessionalFilter.tsx \
        src/components/domain/scheduling/__tests__/ProfessionalFilter.test.tsx
git commit -m "feat(agenda): cria componente ProfessionalFilter com testes"
```

---

## Task 4: Atualizar `AgendaDayView` — filtro de profissional e layout de colunas

**Files:**
- Modify: `src/components/domain/scheduling/agenda-day-view.tsx`

O arquivo atual tem 325 linhas. As mudanças são feitas em partes específicas — não é necessário reescrever o arquivo inteiro.

- [ ] **Step 1: Adicionar imports**

No topo do arquivo, após os imports existentes, adicione:

```typescript
// adicionar à linha de imports do React
import { useState, useEffect } from 'react'

// adicionar ao bloco de imports de hooks
import { useTeamMembers } from '@/hooks/iam/use-team'
import type { TeamMember } from '@/hooks/iam/use-team'

// adicionar ao bloco de imports de componentes locais
import { ProfessionalFilter } from './ProfessionalFilter'
```

> Nota: o `useState` já está importado. Substitua `import { useState }` por `import { useState, useEffect }`.

- [ ] **Step 2: Adicionar a função helper `toHour` antes da declaração do componente**

Logo após a função `groupByDay` (linha ~67 do arquivo original), adicione:

```typescript
function toHour(appt: Appointment) {
  return new Date(appt.startsAt).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}
```

- [ ] **Step 3: Adicionar state e lógica de filtro dentro do componente**

Logo após a linha `const { can } = usePermissions()`, adicione:

```typescript
  const canViewAll = can('agenda', 'view_all')
  const { data: teamMembers = [] } = useTeamMembers()

  const [selectedProfessionalIds, setSelectedProfessionalIds] = useState<string[]>([])

  // Inicializa o filtro uma vez quando os dados chegam
  useEffect(() => {
    if (!canViewAll || teamMembers.length === 0 || selectedProfessionalIds.length > 0) return
    if (currentUser?.role === 'PROFESSIONAL') {
      setSelectedProfessionalIds([currentUser.id])
    } else {
      setSelectedProfessionalIds(teamMembers.map((m) => m.id))
    }
  }, [teamMembers, currentUser, canViewAll])
```

- [ ] **Step 4: Substituir a lógica de `professionalId` e atualizar `sorted`**

Localize e substitua este bloco existente:

```typescript
  // Apenas profissionais com roleId específico veem seus próprios agendamentos
  const professionalId = currentUser?.roleId ? currentUser.id : undefined
```

Por:

```typescript
  // Sem view_all: comportamento original — profissional vê só seus agendamentos
  // Com view_all e 1 selecionado: filtra por esse profissional na API
  // Com view_all e múltiplos: busca todos e filtra localmente
  const queryProfessionalId = !canViewAll
    ? currentUser?.roleId
      ? currentUser.id
      : undefined
    : selectedProfessionalIds.length === 1
      ? selectedProfessionalIds[0]
      : undefined
```

E na chamada de `useAppointments`, substitua `professionalId` por `queryProfessionalId`:

```typescript
  const {
    data: appointments = [],
    isLoading,
    error,
    refetch,
  } = useAppointments({ from, to, professionalId: queryProfessionalId })

  const filteredAppointments =
    canViewAll && selectedProfessionalIds.length > 1
      ? appointments.filter((a) => selectedProfessionalIds.includes(a.professionalId))
      : appointments

  const sorted = [...filteredAppointments].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  )
```

- [ ] **Step 5: Adicionar dados para o layout de colunas**

Após a linha `const dayKeys = Object.keys(dayGroups).sort(...)`, adicione:

```typescript
  // Dados para o layout de colunas (modo Dia com múltiplos profissionais)
  const byProfessional = selectedProfessionalIds.map((profId) => ({
    professional: teamMembers.find((m) => m.id === profId) ?? ({
      id: profId,
      name: 'Profissional',
      email: '',
      role: 'PROFESSIONAL' as const,
      isOwner: false,
      roleId: null,
      roleName: '',
      createdAt: '',
    } satisfies TeamMember),
    appointments: sorted.filter((a) => a.professionalId === profId),
  }))

  const allColumnHours = [
    ...new Set(byProfessional.flatMap(({ appointments: a }) => a.map(toHour))),
  ].sort()
```

- [ ] **Step 6: Adicionar `ProfessionalFilter` no header**

No bloco do header (dentro de `<div className="flex items-center justify-between gap-2">`), entre o seletor Dia/Semana e o botão de novo agendamento, adicione:

```tsx
        {canViewAll && currentUser && (
          <ProfessionalFilter
            selectedIds={selectedProfessionalIds}
            onChange={setSelectedProfessionalIds}
            currentUserId={currentUser.id}
          />
        )}
```

O header ficará assim:

```tsx
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1">
          {/* botões Dia/Semana existentes */}
        </div>

        {canViewAll && currentUser && (
          <ProfessionalFilter
            selectedIds={selectedProfessionalIds}
            onChange={setSelectedProfessionalIds}
            currentUserId={currentUser.id}
          />
        )}

        {can('agenda', 'create') && (
          <Button ...>
            {/* botão novo agendamento existente */}
          </Button>
        )}
      </div>
```

- [ ] **Step 7: Adicionar o layout de colunas**

Localize a condição do modo dia (dentro do bloco de renderização, após o empty state):

```tsx
      ) : viewMode === 'day' ? (
        <div className="space-y-6">
```

Substitua por (insere o layout de colunas antes do layout atual de coluna única):

```tsx
      ) : viewMode === 'day' && canViewAll && selectedProfessionalIds.length > 1 ? (
        <div className="overflow-x-auto">
          <div className="inline-flex min-w-full flex-col">
            {/* cabeçalho com nome dos profissionais */}
            <div className="mb-3 flex">
              <div className="w-14 shrink-0" />
              {byProfessional.map(({ professional }) => (
                <div key={professional.id} className="min-w-[240px] flex-1 px-2">
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
                      className="min-w-[240px] flex-1 space-y-2 px-1 pb-2"
                    >
                      {appts.map((appt) => (
                        <AppointmentCard
                          key={appt.id}
                          appointment={appt}
                          onClick={handleCardClick}
                          onReschedule={handleReschedule}
                        />
                      ))}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      ) : viewMode === 'day' ? (
        <div className="space-y-6">
          {/* layout original de coluna única — não alterar */}
```

- [ ] **Step 8: Verificar tipagem**

```bash
npx tsc --noEmit
```

Expected: zero erros. Erros comuns e correções:
- `'view_all' is not assignable to NavAction` → Task 1 não foi feita ainda
- `Property 'role' does not exist on CurrentUser` → Task 2 não foi feita ainda
- `satisfies TeamMember` não suportado → usar `as TeamMember` como fallback

- [ ] **Step 9: Executar todos os testes**

```bash
npx vitest run
```

Expected: todos os testes passando. Se algum teste de agendamentos usar o valor `professionalId` do contexto e quebrar, atualize o mock para incluir `professionalId` nos objetos de appointment.

- [ ] **Step 10: Teste manual**

Inicie o servidor de desenvolvimento e verifique:

1. **Como OWNER**: filtro aparece no header da agenda; todos os profissionais pré-selecionados; modo Dia com 2+ profissionais exibe colunas com nomes no cabeçalho; desmarcar um profissional remove sua coluna; com 1 profissional selecionado, volta ao layout de lista.
2. **Como PROFESSIONAL** (sem `view_all` no cargo): filtro não aparece; agenda exibe apenas os próprios agendamentos.
3. **Na aba Cargos** (`/configuracoes?tab=cargos`): ao selecionar a seção Agenda, a coluna "Ver todos" aparece como checkbox; ao marcar e salvar, o PROFESSIONAL logado passa a ver o filtro.
4. **Modo Semana**: filtro aparece mas o layout permanece idêntico ao atual (agrupado por dia).

- [ ] **Step 11: Commit**

```bash
git add src/components/domain/scheduling/agenda-day-view.tsx
git commit -m "feat(agenda): adiciona filtro por profissional com layout de colunas no modo Dia"
```

---

## Task 5: Branch e PR

- [ ] **Step 1: Verificar branch**

```bash
git status
git log --oneline -5
```

Confirme que os commits estão em uma branch de feature (`feat/filtro-profissional-agenda`). Se estiver em `main`, mova os commits:

```bash
git checkout -b feat/filtro-profissional-agenda
```

- [ ] **Step 2: Push e PR**

```bash
git push -u origin feat/filtro-profissional-agenda
gh pr create \
  --title "feat(agenda): filtro por profissional com layout de colunas" \
  --body "$(cat <<'EOF'
## O que muda

- Nova permissão `view_all` na seção Agenda — configurável por cargo em Configurações > Cargos
- OWNER e MANAGER têm `view_all` por padrão
- Filtro multi-select de profissionais aparece no header da Agenda para quem tem a permissão
- Modo Dia com 2+ profissionais exibe layout de colunas (uma por profissional)
- Modo Semana mantém o layout atual, filtro apenas restringe quais agendamentos aparecem

## Checklist de teste

- [ ] OWNER vê filtro com todos pré-selecionados
- [ ] PROFESSIONAL sem permissão não vê o filtro
- [ ] PROFESSIONAL com `view_all` no cargo vê o filtro com apenas o próprio pré-selecionado
- [ ] Layout de colunas ativa com 2+ profissionais no modo Dia
- [ ] Coluna "Ver todos" aparece na RolePermissionMatrix da seção Agenda
- [ ] `npx tsc --noEmit` — zero erros
- [ ] `npx vitest run` — todos os testes passando

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review do plano

**Cobertura da spec:**
- ✅ Nova permissão `agenda.view_all` → Tasks 1 e 2
- ✅ `RolePermissionMatrix` exibe `view_all` → Task 1, Step 2
- ✅ Filtro multi-select no header → Task 4, Steps 5-6
- ✅ OWNER começa com todos; PROFESSIONAL começa com próprio → Task 4, Step 3
- ✅ Profissional logado não pode ser desmarcado → Task 3, implementação do `toggle`
- ✅ Layout de colunas modo Dia com 2+ profissionais → Task 4, Step 7
- ✅ Modo Semana sem mudança de layout → zero alterações nos componentes de semana
- ✅ Testes → Task 3, Steps 1-4

**Consistência de tipos:**
- `NavAction` em `nav-registry.ts` inclui `view_all` antes de ser usado em `role-permission-matrix.tsx`
- `CurrentUser.role` adicionado em Task 2 antes de ser lido em Task 4
- `ProfessionalFilterProps` definido em Task 3 antes de ser consumido em Task 4
- `toHour(appt: Appointment)` usa o tipo `Appointment` importado do hook — consistente
- `byProfessional` usa `TeamMember` do `use-team.ts` — consistente com o tipo retornado por `useTeamMembers()`
