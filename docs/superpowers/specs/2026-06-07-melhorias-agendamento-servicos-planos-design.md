# Design: Melhorias — Agendamento, Serviços e Planos

**Data:** 2026-06-07  
**Branch:** feat/service-categories  
**Escopo:** 4 melhorias independentes no sistema

---

## 1. Modal de Agendamento — Inverter Ordem (Serviço → Profissional)

### Problema

O modal `CreateAppointmentModal` exibe o seletor de Profissional antes do de Serviço. O fluxo correto é: o usuário escolhe o serviço primeiro, e o sistema filtra os profissionais habilitados para aquele serviço.

### Arquivos afetados

- `src/components/domain/scheduling/create-appointment-modal.tsx`

### Comportamento atual

```
Profissional → Serviço → Data → Horário → Cliente
```

### Comportamento desejado

```
Serviço → Profissional (filtrado pelo serviço) → Data → Horário → Cliente
```

### Detalhes de implementação

- No JSX, mover o bloco `<div>Serviço</div>` para antes do bloco `<div>Profissional</div>`.
- Adicionar `useEffect` que reseta `professionalId` para `''` sempre que `serviceId` mudar.
- O Select de Profissional já usa `professionalsByService.professionals` quando `serviceId` está definido — comportamento correto, só precisa vir depois.
- O aviso de "nenhum profissional configurado" continua acima do Select de Profissional.
- Usuários sem permissão `agenda.edit` continuam com profissional fixo (sem Select).

---

## 2. Lógica de Disponibilidade de Slots

### Problema

**Bug:** `availability.service.ts` usa `const step = Math.max(serviceDuration, 15)` como intervalo de geração dos slots. Isso faz o sistema pular `duração do serviço` minutos entre cada slot candidato — slots com intervalos de 60, 90, 120 min quando deveriam ser de 30 min.

**Área pública:** a API pública só retorna slots disponíveis (`string[]`). A spec exige que todos os slots sejam retornados, com indicação de ocupado/disponível, sem expor dados de terceiros.

### Arquivos afetados

- `prisma/schema.prisma` — adição de campo
- `prisma/migrations/` — nova migration
- `src/domains/scheduling/availability.service.ts`
- `src/app/api/scheduling/availability/route.ts`
- `src/app/api/public/[slug]/availability/route.ts`
- `src/components/domain/booking/datetime-step.tsx`
- `src/hooks/scheduling/use-availability.ts`

### 2.1 Schema — `slotIntervalMinutes`

Adicionar ao model `SchedulingPolicy`:

```prisma
slotIntervalMinutes Int @default(30)
```

Migration aditiva, sem impacto em dados existentes.

### 2.2 `AvailabilityService.getAvailableSlots`

**Lógica corrigida:**

```
interval = policy.slotIntervalMinutes (padrão 30)

para min = openMin; min + serviceDuration <= closeMin; min += interval:
  slotStart = localDateTimeToUtc(date, minutesToTime(min), timezone)
  slotEnd   = slotStart + serviceDuration * 60s

  conflito = agendamentos onde: startsAt < slotEnd AND endsAt > slotStart

  slots.push({ time: minutesToTime(min), available: !conflito, bookedBy: ... })
```

**Mudanças na assinatura da função:**

```ts
async getAvailableSlots(
  tenantId: string,
  professionalId: string,
  date: string,
  serviceDuration: number,
  slotIntervalMinutes?: number,   // novo parâmetro opcional, default 30
): Promise<TimeSlot[]>
```

O `slotIntervalMinutes` é carregado da `SchedulingPolicy` pelo caller (API Route), não internamente no service, para manter o service testável sem mock de policy.

### 2.3 API interna (`/api/scheduling/availability`)

Carrega `slotIntervalMinutes` da policy antes de chamar o service:

```ts
const policy = await schedulingPolicyService.getPolicy(session.tenantId)
const slots = await availabilityService.getAvailableSlots(
  session.tenantId, professionalId, date,
  service.duration,
  policy.slotIntervalMinutes,
)
return Response.json({ slots })  // retorna todos (disponíveis + ocupados)
```

### 2.4 API pública (`/api/public/[slug]/availability`)

Retorna **todos** os slots com status, sem dados privados:

```ts
// Em vez de:
const availableSlots = allSlots.filter(s => s.available).map(s => s.time)
return Response.json({ slots: availableSlots })

// Passa a ser:
const publicSlots = allSlots.map(s => ({
  time: s.time,
  available: s.available,
  // bookedBy NÃO é incluído — privacidade
}))
return Response.json({ slots: publicSlots })
```

### 2.5 `DateTimeStep.tsx` (área pública)

Adaptar para receber `{ time: string, available: boolean }[]`:

- Slots disponíveis: botão clicável normal.
- Slots ocupados: botão desabilitado com label "Agendado" abaixo do horário.
- Sem revelar nome, serviço ou qualquer dado de terceiro.

**Tipo local:**

```ts
type PublicSlot = { time: string; available: boolean }
```

Estado muda de `string[]` para `PublicSlot[]`.

---

## 3. Aba "Planos" nas Configurações

### Problema

A page `/configuracoes/planos` existe isolada, sem acesso pela navegação de configurações. O componente `BillingPlansContent` está pronto.

### Arquivo afetado

- `src/app/(app)/configuracoes/page.tsx`

### Comportamento desejado

- Adicionar tab "Planos" visível **apenas para Owner** (`user?.isOwner`).
- Conteúdo: `<BillingPlansContent />` dentro da tab, sem redirecionar para `/configuracoes/planos`.
- A grid de tabs passa de `grid-cols-8` para `grid-cols-9` quando Owner.
- Import: `import { BillingPlansContent } from '@/components/domain/billing/billing-plans-content'`

### Posição da tab

Inserir como última tab, após "Cargos":

```
Negócio | Horários | WhatsApp | Layout | Financeiro | CRM | Agend. Online | Cargos* | Planos*
(* = só Owner)
```

---

## 4. Ordem das Abas em Serviços

### Arquivo afetado

- `src/app/(app)/servicos/page.tsx`

### Ordem atual

```
Serviços | Pacotes | Promoções | Categorias
```

### Ordem desejada

```
Categorias | Serviços | Pacotes | Promoções
```

### Detalhe

- `defaultValue` permanece `"servicos"` (abre em Serviços).
- Apenas a posição visual das tabs é alterada — o `TabsContent` de cada tab não muda.

---

## Sequência de implementação

1. Ordem das abas em Serviços — mais simples, zero risco.
2. Aba Planos nas Configurações — isolada, sem backend.
3. Modal de Agendamento — inverter ordem, puro frontend.
4. Lógica de slots — migration + backend + frontend público.

---

## Checklist de verificação

- [ ] `npx tsc --noEmit` — zero erros
- [ ] `npx vitest run` — todos os testes passando
- [ ] Modal: profissional reseta ao trocar serviço
- [ ] Slots: intervalo de 30 min com serviço de 1h gera: 09:00, 09:30, 10:00... até 17:00 (para encerramento 18:00)
- [ ] Área pública: slots ocupados visíveis como desabilitados, sem dado de terceiro
- [ ] Aba Planos: só aparece para Owner
- [ ] Abas Serviços: ordem correta, default abre em Serviços
