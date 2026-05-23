# Spec: Fluxo de Uso do Sistema — Prompts de Desenvolvimento

**Data:** 2026-05-22
**Projeto:** SaaS Operacional para Estética
**Escopo:** Conjunto de prompts encadeados para implementação do frontend operacional completo

---

## Contexto

O backend do projeto está completo para os domínios IAM, CRM, Scheduling e Financial. As telas de autenticação (login, onboarding, recuperação de senha) estão implementadas. O grupo de rotas `(app)/` contém apenas uma home estática.

O objetivo deste conjunto de prompts é guiar a implementação de todo o frontend operacional em sessões focadas, cada uma entregando valor incremental e referenciando o que foi construído anteriormente.

---

## Perfis de usuário

| Perfil | Tela inicial após login | Capacidades |
|--------|------------------------|-------------|
| **Dono (OWNER)** | Dashboard com resumo do dia | Acesso total: agenda, clientes, financeiro, equipe, configurações |
| **Atendente / Recepcionista (RECEPTIONIST)** | Agenda do dia | Agenda, clientes, sem acesso a financeiro e equipe |
| **Profissional (PROFESSIONAL)** | Agenda do dia (apenas seus atendimentos) | Apenas própria agenda |
| **Autônomo** | Agenda do dia | Acesso total como dono, sem gestão de equipe — usa o mesmo papel OWNER, diferenciado por `tenant.type = "solo"` |

---

## Navegação global

- **Mobile:** Bottom navigation com 5 ícones — Agenda, Clientes, Financeiro, Equipe, Configurações
- **Desktop:** Sidebar colapsável à esquerda com os mesmos itens + nome do tenant no topo
- Itens invisíveis para papéis sem permissão (ex: Financeiro oculto para PROFESSIONAL)

---

## Sessões de desenvolvimento

### Sessão 1 — Shell de navegação

**Agente:** Frontend
**Dependências:** nenhuma (pré-condição: auth funcionando)

**Telas / rotas:**
- `(app)/layout.tsx` — layout raiz com sidebar + bottom nav
- `(app)/page.tsx` — redirect para `/agenda` ou `/dashboard` conforme papel

**Componentes:**
- `components/domain/shell/AppSidebar.tsx`
- `components/domain/shell/BottomNav.tsx`
- `components/domain/shell/NavItem.tsx`

**Comportamento por papel:**
- OWNER / autônomo: todos os 5 itens visíveis
- RECEPTIONIST: Agenda, Clientes — Financeiro e Equipe ocultos
- PROFESSIONAL: apenas Agenda visível

**Estados obrigatórios:**
- Loading do perfil do usuário (skeleton no sidebar/bottom nav)
- Fallback se sessão expirar (redirect para `/login`)

**Critérios de aceite:**
- [ ] Sidebar visível no desktop (≥1024px), oculto no mobile
- [ ] Bottom nav visível no mobile (<1024px), oculto no desktop
- [ ] Item ativo destacado visualmente na rota atual
- [ ] Redirect correto após login por papel
- [ ] Itens sem permissão não renderizados

---

### Sessão 2 — Tela inicial adaptativa + Agenda

**Agente:** Frontend
**Dependências:** Sessão 1 concluída; APIs `/api/scheduling/appointments` e `/api/scheduling/availability` disponíveis

**Telas / rotas:**
- `(app)/dashboard/page.tsx` — home do OWNER com resumo do dia
- `(app)/agenda/page.tsx` — agenda diária/semanal

**Componentes:**
- `components/domain/scheduling/AgendaView.tsx` — visualização diária e semanal alternável
- `components/domain/scheduling/AppointmentCard.tsx` — card de agendamento com status colorido
- `components/domain/scheduling/CreateAppointmentModal.tsx` — modal de criação (máx. 3 cliques)
- `components/domain/scheduling/AppointmentStatusActions.tsx` — botões confirmar / concluir / cancelar
- `components/domain/dashboard/DaySummaryCard.tsx` — resumo do dia para OWNER

**Fluxo completo — criar agendamento:**
1. Clique em horário vago na agenda (ou botão "+")
2. Modal abre: seleção de cliente (busca inline) + serviço + profissional (se OWNER)
3. Confirmar → loading → toast de sucesso → agendamento aparece na agenda

**Fluxo completo — concluir atendimento:**
1. Clique no card do agendamento → drawer lateral com detalhes
2. Botão "Concluir" → confirmação inline
3. Status atualiza → evento dispara → modal de registro de pagamento abre automaticamente

**Estados obrigatórios:**
- Agenda vazia (empty state com CTA para criar agendamento)
- Loading de slots (skeleton na grade de horários)
- Erro de conflito de horário (toast com mensagem clara)
- Agendamento em cada status com cor distinta: SCHEDULED (cinza), CONFIRMED (azul), COMPLETED (verde), CANCELLED (vermelho), NO_SHOW (laranja)

**Componentes Shadcn necessários:**
`Dialog`, `Drawer`, `Sheet`, `Badge`, `Button`, `Skeleton`, `Toast`, `Select`, `Command` (busca de cliente)

**Critérios de aceite:**
- [ ] Agenda alterna entre visão diária e semanal
- [ ] Agendamento criado em até 3 cliques
- [ ] Status de cada agendamento visível com cor
- [ ] Concluir agendamento abre fluxo de pagamento
- [ ] OWNER vê resumo do dia no dashboard (próximos atendimentos, receita do dia)
- [ ] PROFESSIONAL vê apenas seus próprios agendamentos

---

### Sessão 3 — CRM — Clientes

**Agente:** Frontend
**Dependências:** Sessão 1 concluída; APIs `/api/crm/customers` disponíveis

**Telas / rotas:**
- `(app)/clientes/page.tsx` — listagem com busca e filtros
- `(app)/clientes/[id]/page.tsx` — perfil do cliente + histórico

**Componentes:**
- `components/domain/crm/CustomerList.tsx`
- `components/domain/crm/CustomerCard.tsx`
- `components/domain/crm/CustomerProfileHeader.tsx`
- `components/domain/crm/AppointmentHistory.tsx`
- `components/domain/crm/CreateCustomerModal.tsx` — cadastro rápido

**Fluxo completo — cadastrar cliente:**
1. Botão "Novo cliente" → modal
2. Preenche nome + telefone (mínimo) → Salvar
3. Cliente aparece na lista / é selecionável no agendamento

**Fluxo completo — consultar perfil:**
1. Clique no cliente na lista
2. Perfil abre: dados, tags, último atendimento, histórico completo paginado

**Estados obrigatórios:**
- Lista vazia (empty state com CTA para cadastrar primeiro cliente)
- Loading com skeleton de cards
- Busca sem resultados
- Perfil: histórico vazio

**Componentes Shadcn necessários:**
`Input`, `Table`, `Avatar`, `Badge`, `Dialog`, `Tabs`, `Skeleton`, `Pagination`

**Critérios de aceite:**
- [ ] Busca por nome ou telefone funciona em tempo real (debounce)
- [ ] Tags do cliente visíveis na listagem
- [ ] Histórico de atendimentos paginado no perfil
- [ ] Cadastro rápido acessível também dentro do modal de agendamento

---

### Sessão 4 — Financeiro

**Agente:** Frontend
**Dependências:** Sessão 2 concluída (fluxo de concluir atendimento); APIs `/api/financial/transactions` disponíveis

**Telas / rotas:**
- `(app)/financeiro/page.tsx` — resumo do dia + lista de transações
- `(app)/financeiro/transacoes/page.tsx` — histórico completo com filtros

**Componentes:**
- `components/domain/financial/DaySummary.tsx` — receita do dia, total de atendimentos, ticket médio
- `components/domain/financial/TransactionList.tsx`
- `components/domain/financial/TransactionCard.tsx`
- `components/domain/financial/RegisterPaymentModal.tsx` — acionado ao concluir atendimento

**Fluxo completo — registrar pagamento:**
1. Ao concluir atendimento (Sessão 2), modal abre automaticamente
2. Valor preenchido automaticamente (preço do serviço)
3. Selecionar forma de pagamento → Confirmar
4. Transação registrada → toast → modal fecha

**Fluxo completo — consultar fechamento do dia:**
1. Entrar em Financeiro
2. Ver resumo no topo: total de receita, número de atendimentos, ticket médio
3. Scroll para lista de transações do dia agrupadas

**Estados obrigatórios:**
- Dia sem transações (empty state)
- Loading de resumo (skeleton nos cards de totais)
- Erro no registro de pagamento (toast com opção de tentar novamente)

**Componentes Shadcn necessários:**
`Card`, `Table`, `Select`, `Dialog`, `Badge`, `Skeleton`, `Separator`

**Critérios de aceite:**
- [ ] Resumo do dia atualiza ao registrar pagamento (invalidação de cache TanStack Query)
- [ ] Forma de pagamento obrigatória no registro
- [ ] Filtro por data no histórico de transações
- [ ] Acesso bloqueado para papéis sem permissão `financial:view`

---

### Sessão 5 — Equipe e permissões

**Agente:** Frontend
**Dependências:** Sessão 1 concluída; API `/api/iam/users` disponível. **Atenção:** a API `/api/iam/invites` pode precisar ser criada pelo Backend Agent antes desta sessão — verificar se existe antes de iniciar.

**Telas / rotas:**
- `(app)/equipe/page.tsx` — listagem de usuários do tenant + convites pendentes

**Componentes:**
- `components/domain/iam/TeamMemberList.tsx`
- `components/domain/iam/TeamMemberCard.tsx`
- `components/domain/iam/InviteMemberModal.tsx`
- `components/domain/iam/RoleSelector.tsx`

**Fluxo completo — convidar membro:**
1. Botão "Convidar" → modal
2. Preenche e-mail + seleciona papel
3. Enviar → e-mail de convite disparado → convite pendente aparece na lista

**Fluxo completo — alterar papel:**
1. Clique no membro → dropdown inline de papel
2. Confirmar troca → atualiza na lista

**Estados obrigatórios:**
- Lista vazia (empty state — "Adicione profissionais ao seu negócio")
- Convites pendentes com badge distinto
- Loading ao enviar convite

**Componentes Shadcn necessários:**
`Avatar`, `Badge`, `Dialog`, `Select`, `Table`, `DropdownMenu`

**Critérios de aceite:**
- [ ] Apenas OWNER acessa esta tela
- [ ] Convites pendentes exibidos separadamente dos membros ativos
- [ ] Papel editável inline sem abrir modal separado
- [ ] Não é possível remover o próprio OWNER

---

### Sessão 6 — Notificações WhatsApp

**Agente:** Database → Backend → Frontend (nesta ordem)
**Dependências:** Sessão 1 concluída; domínio `notifications/` existente (stub); Evolution API configurada. **Requer sessão de Database Agent primeiro** para criar os models `NotificationSettings` e `MessageTemplate` no Prisma.

**Telas / rotas:**
- `(app)/configuracoes/notificacoes/page.tsx` — configuração do canal WhatsApp e templates

**Backend a implementar nesta sessão:**
- `domains/notifications/whatsapp.provider.ts` — integração real Evolution API (substituir stub)
- `app/api/notifications/settings/route.ts` — GET/PUT das configurações por tenant
- `app/api/notifications/templates/route.ts` — CRUD de templates de mensagem
- Schema Prisma: `NotificationSettings` e `MessageTemplate`

**Componentes:**
- `components/domain/notifications/WhatsAppConnectionCard.tsx` — status da conexão + QR code
- `components/domain/notifications/MessageTemplateEditor.tsx` — editor de template com variáveis (`{{nome_cliente}}`, `{{horario}}`, `{{servico}}`)
- `components/domain/notifications/NotificationToggleList.tsx` — toggles por evento (confirmação, lembrete 24h, cancelamento)

**Eventos cobertos:**
| Evento | Template padrão editável |
|--------|--------------------------|
| `appointment.created` | "Olá {{nome_cliente}}, seu agendamento de {{servico}} está confirmado para {{horario}}." |
| `appointment.reminder` | "Lembrete: você tem {{servico}} amanhã às {{horario}}. Até lá!" |
| `appointment.cancelled` | "Seu agendamento de {{servico}} em {{horario}} foi cancelado." |

**Estados obrigatórios:**
- WhatsApp desconectado (exibe QR code para parear)
- WhatsApp conectado (exibe número + status verde)
- Template com variável inválida (validação inline)
- Toggle desligado (mensagem "Notificação desativada para este evento")

**Critérios de aceite:**
- [ ] Conexão WhatsApp via QR code funciona
- [ ] Templates editáveis com preview das variáveis substituídas
- [ ] Cada evento pode ser ativado/desativado independentemente
- [ ] Envio de mensagem de teste por evento
- [ ] Apenas OWNER acessa configurações de notificações

---

### Sessão 7 — Automações (Fase 2)

**Agente:** Database → Backend → Frontend (nesta ordem)
**Dependências:** Sessões 1–6 concluídas; domínio `automation/` existente (stub). **Requer sessão de Database Agent primeiro** para criar os models `AutomationRule` e `AutomationExecution` no Prisma.

**Telas / rotas:**
- `(app)/configuracoes/automacoes/page.tsx` — lista de automações ativas
- `(app)/configuracoes/automacoes/nova/page.tsx` — builder de nova regra
- `(app)/configuracoes/automacoes/[id]/page.tsx` — histórico de execuções

**Backend a implementar nesta sessão:**
- `domains/automation/automation.service.ts` — engine de avaliação de triggers
- `domains/automation/trigger.handler.ts` — handlers por tipo de evento
- `app/api/automation/rules/route.ts` — CRUD de regras
- `app/api/automation/history/route.ts` — histórico de execuções
- Schema Prisma: `AutomationRule` e `AutomationExecution`

**Componentes:**
- `components/domain/automation/AutomationRuleCard.tsx` — card com trigger + ação + toggle ativo/inativo
- `components/domain/automation/TriggerSelector.tsx` — seletor de evento disparador
- `components/domain/automation/ConditionBuilder.tsx` — condições opcionais (ex: "apenas clientes VIP")
- `components/domain/automation/ActionSelector.tsx` — seletor de ação (WhatsApp, e-mail, tag, tarefa)
- `components/domain/automation/ExecutionHistory.tsx` — log de execuções com status

**Triggers disponíveis na UI:**
- Agendamento criado
- Atendimento concluído
- Atendimento cancelado
- No-show registrado
- Cliente sem agendamento há X dias

**Ações disponíveis na UI:**
- Enviar mensagem WhatsApp (usa templates da Sessão 6)
- Adicionar tag ao cliente
- Notificar dono do negócio

**Estados obrigatórios:**
- Lista vazia (empty state com CTA para criar primeira automação)
- Automação desativada (toggle off com visual acinzentado)
- Execução com falha (badge vermelho + detalhes do erro no histórico)
- Automação sem ação configurada (validação no builder, não permite salvar)

**Critérios de aceite:**
- [ ] Criar automação em máx. 4 passos no builder
- [ ] Toggle ativa/desativa sem recarregar a página
- [ ] Histórico mostra: data, trigger disparado, ação executada, status (sucesso/falha)
- [ ] Automações executam de forma assíncrona via pg-boss (não bloqueiam a operação)
- [ ] Apenas OWNER acessa esta tela

---

## Padrões transversais a todos os prompts

### Cada prompt deve referenciar
- As APIs já existentes do backend (listar endpoints relevantes)
- O que foi entregue nas sessões anteriores
- Os tipos TypeScript dos domínios afetados (`domains/[dominio]/types.ts`)

### Estados obrigatórios em todo componente de listagem
- `loading` — skeleton com número de itens estimado
- `empty` — ilustração + mensagem contextual + CTA principal
- `error` — mensagem de erro + botão "Tentar novamente"

### Padrão de data fetching
```typescript
// Sempre via TanStack Query
const { data, isLoading, error } = useQuery({
  queryKey: ['recurso', tenantId, filtros],
  queryFn: () => fetchRecurso(filtros),
})
```

### Padrão de mutação com feedback
```typescript
const mutation = useMutation({
  mutationFn: criarRecurso,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['recurso'] })
    toast.success('Mensagem de sucesso')
    onClose()
  },
  onError: (error) => {
    toast.error(getErrorMessage(error))
  },
})
```

### Regra de permissão em componente
```typescript
// Usar hook de permissão — nunca verificar role diretamente
const { can } = usePermissions()
if (!can('financial:view')) return <AccessDenied />
```

---

## Ordem de entrega recomendada

```
Sessão 1 → Sessão 2 → Sessão 3 → Sessão 4 → Sessão 5 → Sessão 6 → Sessão 7
   Shell      Agenda    Clientes  Financeiro   Equipe    WhatsApp  Automações
  (base)    (core)     (CRM)     (caixa)     (IAM UI)   (Notif.)   (Fase 2)
```

Sessões 3, 4 e 5 podem ser desenvolvidas em paralelo após a Sessão 2.
Sessão 6 requer Sessão 1 e configuração do Evolution API no ambiente.
Sessão 7 requer todas as sessões anteriores concluídas.
