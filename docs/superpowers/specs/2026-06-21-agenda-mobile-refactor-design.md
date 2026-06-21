# Spec: Refatoração e Melhorias da Agenda Mobile

**Data:** 2026-06-21  
**Branch alvo:** `fix/mobile-swipe-agenda-columns`  
**Escopo:** 6 itens — 3 bugs, 1 refatoração de UX, 2 novas funcionalidades

---

## Resumo

Correções de layout mobile, refatoração do fluxo de edição de agendamentos, e duas novas funcionalidades (botão Agendar no CRM e calendário toggle na agenda).

---

## Item 1 — Layout quebrado nos cards de agendamento

**Problema:** No layout de múltiplas colunas (view por profissional), cada coluna tem `min-w-37.5` (150px). Os botões de ação "Confirmar" e "Fechar pagamento" usam `flex-1` e ficam lado a lado — em 150px não há espaço suficiente para texto + ícone, quebrando o layout no iPhone 12 Pro (390px).

**Solução em `appointment-card.tsx`:**
- Botões de ação empilhados verticalmente (`flex-col`) em vez de `flex-row` quando dentro de colunas estreitas
- Ícones SVG removidos dos botões de ação (texto puro)
- Aumentar `min-w` das colunas no layout de múltiplos profissionais de `min-w-37.5` para `min-w-44` (176px) — cabe dois botões lado a lado com conforto
- Garantir que o card não ultrapasse a largura da coluna: `overflow-hidden` no container do card

**Arquivos:**
- `src/components/domain/scheduling/appointment-card.tsx`
- `src/components/domain/scheduling/agenda-day-view.tsx` (ajuste de `min-w`)

---

## Item 2 — Edição de agendamento inline no drawer (Opção A aprovada)

**Problema:** O fluxo de edição atual usa um `RescheduleModal` Dialog separado, aberto pelo botão de lápis no card. O usuário quer editar dentro do mesmo contexto do agendamento, sem trocar de superfície.

**Solução:** Adicionar modo edição no `AppointmentDrawer` existente.

### Regras de negócio
- Edição disponível **apenas** quando `status === 'SCHEDULED'`
- Após `CONFIRMED`, `COMPLETED`, `CANCELLED` ou `NO_SHOW`: sem edição
- Se nenhum campo foi alterado, o botão "Salvar" fica desabilitado
- Se o cliente tem telefone cadastrado, a mensagem WhatsApp é enviada ao salvar
- Ao salvar com sucesso: drawer fecha, cache `appointments` é invalidado

### Mudanças no `AppointmentDrawer`
- Novo estado `isEditing: boolean` (inicia `false`)
- Quando `status === 'SCHEDULED'` e `!isEditing`: botão **"Editar agendamento"** aparece acima de "Confirmar presença"
- Quando `isEditing === true`:
  - O bloco de informações somente-leitura é substituído por formulário com:
    - `Select` de profissional (usa `useTeamMembers`)
    - `input[type=date]` para nova data
    - Grade de horários disponíveis (usa `useAvailableSlots`)
    - `Textarea` com mensagem WhatsApp pré-preenchida (template do `reschedule-modal.tsx`)
  - Botões: "Cancelar edição" (volta para view) e "Salvar alterações" (chama `useRescheduleAppointment`)
- Ao fechar o drawer com `isEditing === true`: volta para `isEditing = false` sem salvar

### Remoções
- `reschedule-modal.tsx` — deletado
- `appointment-card.tsx` — remove prop `onReschedule` e botão de lápis (Pencil icon)
- `agenda-day-view.tsx` — remove `handleReschedule`, `reschedulingAppointment`, `rescheduleModalOpen`, `<RescheduleModal>`

**Arquivos:**
- `src/components/domain/scheduling/appointment-drawer.tsx` (edit mode)
- `src/components/domain/scheduling/appointment-card.tsx` (remove lápis)
- `src/components/domain/scheduling/agenda-day-view.tsx` (remove reschedule)
- `src/components/domain/scheduling/reschedule-modal.tsx` (deletar)

---

## Item 3 — Botão "Confirmar" na listagem deve abrir modal com valor

**Problema:** `handleConfirmInline` em `agenda-day-view.tsx` chama `updateStatus.mutate({ status: 'CONFIRMED' })` diretamente, sem permitir ao usuário ajustar o valor cobrado. O `ConfirmAppointmentModal` (que permite editar valor + mensagem) só é acessível via drawer de detalhes.

**Solução em `agenda-day-view.tsx`:**
- Adicionar estado: `confirmModalAppointment: Appointment | null` (inicia `null`)
- `handleConfirmInline(appt)` passa a setar `confirmModalAppointment = appt` em vez de chamar `updateStatus.mutate`
- Adicionar `<ConfirmAppointmentModal appointment={confirmModalAppointment} open={!!confirmModalAppointment} onClose={() => setConfirmModalAppointment(null)} />` no render
- O `ConfirmAppointmentModal` já existe e tem toda a lógica de valor sugerido pela anamnese

**Arquivos:**
- `src/components/domain/scheduling/agenda-day-view.tsx`

---

## Item 4 — Botão "Agendar Horário" no perfil do cliente

**Problema:** Para agendar a partir do perfil de um cliente, o usuário precisa sair para a agenda e selecionar o cliente manualmente.

**Solução:**

### `CreateAppointmentModal`
- Nova prop: `defaultCustomerId?: string`
- Quando `defaultCustomerId` é fornecido:
  - O step de seleção de cliente pula para o cliente pré-selecionado
  - O campo de busca de cliente é substituído pelo nome do cliente (somente leitura)
  - O fluxo continua normalmente (serviço → profissional → data/horário → confirmar)

### `/clientes/[id]/page.tsx`
- Novo estado: `scheduleOpen: boolean`
- Botão **"Agendar Horário"** adicionado na barra de topo (ao lado de "Editar dados"), com ícone `CalendarPlus`
- `<CreateAppointmentModal open={scheduleOpen} onClose={() => setScheduleOpen(false)} defaultCustomerId={id} />`

**Arquivos:**
- `src/components/domain/scheduling/create-appointment-modal.tsx`
- `src/app/(app)/clientes/[id]/page.tsx`

---

## Item 5 — Calendário minimalista toggle no week strip

**Problema:** O week strip só permite navegar semana a semana. Para selecionar uma data distante (ex: 3 semanas à frente), o usuário precisa clicar nas setas múltiplas vezes.

**Solução em `AgendaWeekStrip`:**
- Adicionar botão de ícone `CalendarDays` à esquerda das setas de navegação
- Ao clicar: abre `Popover` com `Calendar` (shadcn/ui — react-day-picker)
- Configuração do `Calendar`: `mode="single"`, `selected={selectedDate}`, `onSelect={(d) => { onSelectDate(d); fechar popover }}`, `locale` do `date-fns/locale/pt-BR`
- O botão recebe classe `bg-slate-100` quando o popover está aberto
- Ao selecionar uma data, o week strip navega automaticamente para a semana correspondente (comportamento existente via `onSelectDate`)
- O `Calendar` do shadcn já está disponível no projeto (verificar se `date-fns` está instalado — é dependência do react-day-picker)

**Arquivos:**
- `src/components/domain/scheduling/agenda-week-strip.tsx`

---

## Item 6 — Samba (scroll horizontal) após swipe

**Problema:** Após um gesto de swipe na navegação, o `motion.div` do `SwipeNavWrapper` translada para fora da viewport. Sem `overflow-x: hidden` no container pai, o navegador expõe um scrollbar horizontal, criando o efeito de "samba". O problema pode ocorrer em **qualquer rota** do `SWIPE_ROUTES` (`/dashboard`, `/agenda`, `/servicos`, `/clientes`, `/equipe`, `/configuracoes`) e também em páginas de detalhe de cliente (`/clientes/[id]`).

**Solução em `app-shell.tsx`:**
- No `div` mais externo (`min-h-screen bg-background text-foreground`), adicionar `overflow-x-hidden`
- O fix é **global** — cobre todas as rotas de uma vez, pois o `SwipeNavWrapper` está sempre dentro desse container
- Isso clippa o `motion.div` durante a translação sem afetar scroll vertical, modais (Dialog/Sheet usam portals fora do DOM do shell) ou qualquer outra funcionalidade

**Teste de regressão obrigatório após o fix:**
- Swipe de `/dashboard` → `/agenda` → nenhuma tela samba
- Swipe de `/agenda` → `/servicos` → nenhuma tela samba
- Swipe de `/clientes` → `/equipe` → nenhuma tela samba
- Swipe de qualquer rota → `/configuracoes` → nenhuma tela samba
- Scroll vertical em página longa (configurações, clientes) continua funcionando
- Abrir Sheet (drawer de agendamento) após swipe → sem comportamento estranho
- Abrir Dialog (modal de confirmação) após swipe → sem comportamento estranho

**Arquivos:**
- `src/components/app/app-shell.tsx`

---

## Ordem de implementação sugerida

1. **Item 6** — samba (1 linha, zero risco)
2. **Item 1** — layout dos cards (CSS/layout)
3. **Item 3** — confirmar abre modal (estado simples)
4. **Item 2** — edit mode no drawer (maior escopo)
5. **Item 4** — agendar do CRM (prop + botão)
6. **Item 5** — calendário toggle (componente novo)

---

## Checklist de entrega

- [ ] `npx tsc --noEmit` zero erros
- [ ] `npx vitest run` todos passando
- [ ] Testado no Chrome DevTools com viewport 390px (iPhone 12 Pro)
- [ ] Testado swipe em todas as rotas do ciclo → sem scroll horizontal em nenhuma
- [ ] Scroll vertical em páginas longas continua funcionando após swipe
- [ ] Sheet e Dialog abertos após swipe sem comportamento estranho
- [ ] Botão "Confirmar" na listagem abre modal com valor
- [ ] Edição no drawer só disponível em SCHEDULED
- [ ] Botão "Agendar Horário" no CRM pré-seleciona o cliente
- [ ] Calendário toggle abre/fecha ao clicar no ícone
- [ ] PR aberta para `main`
