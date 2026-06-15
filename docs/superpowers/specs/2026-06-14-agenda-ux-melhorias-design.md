# Design: Melhorias de UX e Layout da Agenda

**Data:** 2026-06-14
**Branch:** `fix/agenda-ux-melhorias`
**Escopo:** 5 melhorias de layout e fluxo na tela de Agenda

---

## 1. Painel de detalhes (Sheet) — largura

### Problema
O `SheetContent` usa `sm:max-w-md` (448px), insuficiente para exibir o conteúdo sem compressão visual (ficha de anamnese, fotos, produtos, ações).

### Solução
- Alterar para `w-full sm:max-w-lg` (512px em desktop)
- Mobile continua full-width — sem regressão
- Ajuste de espaçamento interno: leve incremento no `gap` entre seções para aproveitamento do espaço extra

### Arquivo
- `src/components/domain/scheduling/appointment-drawer.tsx`

---

## 2. AppointmentCard — ícone e posicionamento

### Problema
O botão de reagendar usa `CalendarDays` (ícone de calendário) e fica posicionado `absolute right-3 top-3`, colidindo visualmente com o badge de status.

### Solução
- Trocar `CalendarDays` por `Pencil` (lucide-react)
- Mover botão para `absolute right-3 bottom-3` — sem sobreposição com badge

### Arquivo
- `src/components/domain/scheduling/appointment-card.tsx`

---

## 3. Filtro de profissionais

### Problemas
1. Usuário atual está `disabled` no filtro (não pode ser desmarcado)
2. Não há opção "Selecionar todos"
3. Profissional com role `PROFESSIONAL` inicia vendo apenas seus agendamentos, sem poder expandir facilmente

### Solução

**`ProfessionalFilter.tsx`:**
- Remove `if (id === currentUserId) return` e `disabled={isCurrentUser}`
- Mantém ordenação: usuário atual primeiro, demais em ordem alfabética
- Remove badge `(você)` — desnecessário sem o `disabled`
- Adiciona item "Todos" no topo do `CommandGroup`:
  - Exibe `Check` quando todos os membros estão selecionados
  - Clicar em "Todos" quando não estão todos → seleciona todos
  - Clicar em "Todos" quando todos estão → deseleciona todos (permite limpar)
- Label do trigger quando `selectedIds` vazio → exibe "Todos os profissionais"

**`agenda-day-view.tsx`:**
- `useEffect` de inicialização: seleciona todos os membros independente do role (`PROFESSIONAL` ou não)
- `queryProfessionalId` quando `selectedIds.length === 0` → retorna `undefined` (API traz todos)

### Comportamento "nenhum selecionado"
`selectedIds = []` equivale a todos — a agenda exibe agendamentos de todos os profissionais sem filtro de API.

### Arquivos
- `src/components/domain/scheduling/ProfessionalFilter.tsx`
- `src/components/domain/scheduling/agenda-day-view.tsx`

---

## 4. Modal de confirmação com valor e mensagem

### Problema
"Confirmar presença" chama diretamente `PATCH status=CONFIRMED` sem permitir ajuste de valor ou envio de mensagem ao cliente.

### Solução

**Novo componente:** `src/components/domain/scheduling/confirm-appointment-modal.tsx`

**Fluxo:**
1. Usuário clica "Confirmar presença" → abre `ConfirmAppointmentModal` (Dialog)
2. Modal carrega dados da anamnese (sugestão de preço já disponível no drawer via `AppointmentAnamnesePanel`)
3. Modal exibe:
   - **Valor a cobrar:** input numérico pré-preenchido com `confirmedPrice ?? sugestaoPreco.valorSugerido ?? price`
   - Se valor vier da sugestão: mostra linha informativa "Valor sugerido pela ficha (+R$ X,XX)"
   - **Mensagem para o cliente:** textarea pré-preenchida (editável)
4. Ao confirmar:
   - PATCH `/api/scheduling/appointments/[id]/status` com `{ status: 'CONFIRMED', notificationMessage, confirmedPrice }`
   - Call único — sem segunda requisição
5. Fecha modal e fecha drawer

**Mensagem pré-definida:**
```
Olá [Nome]! Seu agendamento de [Serviço] com [Profissional] em [dia da semana], [DD/MM] às [HH:MM] foi confirmado. Valor: R$ [valor formatado]. Aguardamos você!
```

**Schema:** `updateAppointmentStatusSchema` recebe campo adicional `confirmedPrice: z.number().positive().optional()`.
O service `updateAppointmentStatus` persiste `confirmedPrice` ao salvar o status — sem envolver a rota de reagendamento.

**Migration Prisma:**
```prisma
model Appointment {
  // ... campos existentes ...
  confirmedPrice  Decimal?  @db.Decimal(10,2)
}
```

**`ConfirmAppointmentModal` props:**
- `appointment: Appointment`
- `suggestedPrice?: number` — passado pelo drawer com o valor da anamnese (query cacheada pelo React Query, sem re-fetch)
- `open: boolean`
- `onClose: () => void`

### Arquivos
- `src/components/domain/scheduling/confirm-appointment-modal.tsx` ← novo
- `src/components/domain/scheduling/appointment-drawer.tsx` ← usa novo modal, passa `suggestedPrice`
- `prisma/schema.prisma` ← campo `confirmedPrice`
- Migration gerada pelo Prisma
- `src/domains/scheduling/types.ts` ← `updateAppointmentStatusSchema` aceita `confirmedPrice`
- `src/domains/scheduling/scheduling.service.ts` ← persiste `confirmedPrice` no `updateAppointmentStatus`

---

## 5. Checkout com valor confirmado

### Problema
`RegisterPaymentModal` usa `appointment.price` como base, ignorando o valor confirmado com o cliente.

### Solução

**`use-appointments.ts`:** tipo `Appointment` recebe campo `confirmedPrice: number | null`

**`register-payment-modal.tsx`:**
- Recebe `confirmedPrice?: number | null` via props (opcional para retrocompatibilidade)
- `gross = confirmedPrice ?? Number(appointment.price)`
- Label: se `confirmedPrice` existir e diferir de `price` → exibe "Valor confirmado"; caso contrário "Valor original"

**`agenda-day-view.tsx`:**
- `onCompleted` passa `appointment` normalmente; o modal lê `appointment.confirmedPrice`
- `RegisterPaymentModal` recebe `confirmedPrice={paymentAppointment?.confirmedPrice}`

### Arquivos
- `src/hooks/scheduling/use-appointments.ts`
- `src/components/domain/financial/register-payment-modal.tsx`
- `src/components/domain/scheduling/agenda-day-view.tsx`

---

## Ordem de implementação

```
1. Migration Prisma (confirmedPrice)
2. Backend: updateAppointmentSchema + service
3. Hook: tipo Appointment atualizado
4. ConfirmAppointmentModal (novo componente)
5. AppointmentDrawer: integra novo modal
6. RegisterPaymentModal: usa confirmedPrice
7. AppointmentCard: ícone + posicionamento
8. AppointmentDrawer: largura do Sheet
9. ProfessionalFilter: Select All + desmarcar todos
10. AgendaDayView: inicialização do filtro
```

---

## Fora de escopo
- Envio real da notificação WhatsApp (infraestrutura já existe via `notificationMessage` no status update)
- Relatórios comparativos entre `price` e `confirmedPrice`
- Histórico de alterações de valor
