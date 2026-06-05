# Design — Filtro por Profissional na Agenda

**Data:** 2026-06-05
**Abordagem aprovada:** Colunas apenas no modo Dia; modo Semana mantém layout atual

---

## Escopo

Adicionar filtro multi-select de profissional na aba Agenda, com layout de colunas no modo Dia e controle de acesso via aba Cargos nas configurações.

| Entrega | Descrição |
|---------|-----------|
| Nova permissão `agenda.view_all` | Controla quem pode usar o filtro |
| Filtro multi-select na agenda | Dropdown com profissionais do tenant |
| Layout de colunas no modo Dia | Uma coluna por profissional selecionado |
| Modo Semana inalterado | Filtro restringe cards, sem colunas |

---

## Decisões de design

- **Permissão por cargo, não por usuário** — `view_all` é adicionada ao `NAV_REGISTRY` da seção `agenda`; a `RolePermissionMatrix` já renderiza qualquer ação presente no registry sem mudança de componente
- **OWNER sempre tem `view_all` implicitamente** — como todas as demais permissões
- **Profissional logado não pode ser desmarcado** — sempre vê seus próprios agendamentos
- **Coluna única quando 1 profissional selecionado** — volta ao layout atual sem cabeçalho de profissional
- **Sem persistência do filtro** — state local na página; sem URL params ou localStorage por ora
- **Sem mudança de schema Prisma** — `Role.permissions` já é `Json` genérico
- **Contador do `AgendaWeekStrip` não muda** — exibe total de agendamentos do dia independente do filtro selecionado; sem mudança no componente
- **MANAGER sempre tem `view_all` implicitamente** — via `buildOwnerPermissions()` ou `ROLE_PERMISSIONS[MANAGER]`; a implementação deve garantir isso ao adicionar a ação ao NAV_REGISTRY

---

## Permissão

### `NAV_REGISTRY` — nova ação na seção `agenda`

**Arquivo:** `src/shared/permissions/nav-registry.ts`

Adicionar `'view_all'` ao array de ações da seção `agenda`:

```typescript
agenda: {
  label: 'Agenda',
  actions: ['view', 'create', 'edit', 'delete', 'view_all'],
  actionLabels: {
    view:     'Visualizar',
    create:   'Criar',
    edit:     'Editar',
    delete:   'Excluir',
    view_all: 'Ver todos os profissionais',
  }
}
```

### Regras de visibilidade do filtro

| Perfil | Condição | Comportamento padrão |
|--------|----------|----------------------|
| OWNER / MANAGER | sempre tem `view_all` | todos os profissionais selecionados |
| PROFESSIONAL com `view_all` no cargo | cargo configurado pelo OWNER | apenas o próprio pré-selecionado |
| PROFESSIONAL sem `view_all` | padrão | filtro oculto; vê só seus agendamentos |
| RECEPTIONIST com `view_all` | cargo configurado pelo OWNER | todos pré-selecionados |

### Verificação no frontend

```typescript
const { can } = usePermissions()
const canViewAll = can('agenda', 'view_all')
// filtro renderizado apenas quando canViewAll === true
```

---

## UI — Filtro multi-select

### Localização

Barra superior do `AgendaDayView`, à direita do seletor Dia/Semana.
Renderizado condicionalmente quando `canViewAll === true`.

### Comportamento

- Lista de profissionais via `useTeamMembers()` (hook existente)
- Componente: `Popover` + `Command` do Shadcn (padrão já usado no `CreateAppointmentModal`)
- O profissional logado aparece no topo com label "(você)" e checkbox desabilitado (não pode desmarcar)
- **OWNER/MANAGER:** começa com todos selecionados
- **PROFESSIONAL com permissão:** começa apenas com o próprio selecionado
- Botão do dropdown exibe nomes quando ≤ 2 selecionados; "X profissionais" quando > 2
- State: `selectedProfessionalIds: string[]` gerenciado na `agenda/page.tsx` e passado como prop para `AgendaDayView`

### Novo componente

```
src/components/domain/scheduling/ProfessionalFilter.tsx
```

Props:
```typescript
interface ProfessionalFilterProps {
  selectedIds: string[]
  onChange: (ids: string[]) => void
  currentUserId: string
}
```

---

## UI — Layout de colunas no modo Dia

### Condição de ativação

`selectedProfessionalIds.length > 1` **e** modo Dia ativo.

Quando `selectedProfessionalIds.length === 1` → layout atual de coluna única (sem cabeçalho de profissional).

### Estrutura do layout

```
┌──────┬────────────────┬────────────────┬────────────────┐
│      │ Ana            │ João           │ Maria          │
│      │ (avatar + nome)│ (avatar + nome)│ (avatar + nome)│
├──────┼────────────────┼────────────────┼────────────────┤
│ 08:00│ [AppointmentCard]              │                │
│ 09:00│                │ [AppointmentCard]               │
│ 10:00│ [AppointmentCard]              │ [AppointmentCard]│
└──────┴────────────────┴────────────────┴────────────────┘
```

- Coluna de horários: largura fixa `56px`, sticky à esquerda
- Coluna por profissional: largura mínima `240px`
- Container: `overflow-x-auto` para scroll horizontal
- Cabeçalho de coluna: avatar (iniciais, sem imagem) + nome do profissional
- Cards: `AppointmentCard` existente sem modificação
- Agendamentos são agrupados por profissional dentro do `AgendaDayView`; nenhuma mudança em hooks ou API

### Agrupamento de dados

```typescript
// dentro de AgendaDayView, modo Dia com múltiplos profissionais
const byProfessional = selectedProfessionalIds.map(profId => ({
  professional: teamMembers.find(m => m.id === profId),
  appointments: appointments.filter(a => a.professionalId === profId),
}))
```

---

## UI — Modo Semana

Sem mudança de layout. O filtro multi-select aparece visualmente mas os agendamentos são exibidos agrupados por dia (comportamento atual). O filtro apenas restringe quais agendamentos aparecem nos 7 dias.

Nenhum componente do modo Semana é alterado.

---

## Arquivos modificados

| Arquivo | Tipo de mudança |
|---------|----------------|
| `src/shared/permissions/nav-registry.ts` | Adiciona ação `view_all` na seção `agenda` |
| `src/app/(app)/agenda/page.tsx` | State `selectedProfessionalIds`; passa prop para `AgendaDayView` |
| `src/components/domain/scheduling/agenda-day-view.tsx` | Recebe `selectedProfessionalIds`; renderiza layout de colunas no modo Dia |
| `src/components/domain/scheduling/ProfessionalFilter.tsx` | **Novo** — dropdown multi-select de profissionais |

### Sem mudança necessária

- `prisma/schema.prisma` — sem alteração de schema
- `src/components/domain/iam/role-permission-matrix.tsx` — já renderiza qualquer ação do NAV_REGISTRY
- `src/hooks/scheduling/use-appointments.ts` — já aceita `professionalId`; a filtragem dos múltiplos IDs ocorre no frontend por ora
- `src/hooks/iam/use-team.ts` — já existente, sem mudança

---

## Filtragem de agendamentos

A API de agendamentos aceita um único `professionalId`. Para o filtro multi-select, a estratégia é:

- Quando `selectedProfessionalIds.length === 1`: passa `professionalId` na query (comportamento atual)
- Quando `selectedProfessionalIds.length > 1` (ou todos): **não passa `professionalId`** na query; o agrupamento por coluna no frontend usa `.filter()` local sobre o array completo de agendamentos retornado

Essa abordagem evita múltiplas queries paralelas e é adequada para o volume esperado (agendamentos de 1 dia por tenant).

---

## Testes

| Arquivo | Cobertura alvo |
|---------|---------------|
| `ProfessionalFilter.test.tsx` | Renderização, seleção, bloqueio do próprio profissional |
| `agenda-day-view.test.tsx` | Layout de colunas ativado com 2+ profissionais; coluna única com 1 |

---

## Fora do escopo desta entrega

- Persistência do filtro em URL params ou localStorage
- Queries paralelas por profissional (otimização futura para grandes equipes)
- Arrastar agendamentos entre colunas
- Alertas de conflito visual entre colunas
