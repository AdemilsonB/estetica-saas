# Mapeamento de Funcionalidades — MinhaAgenda × estetica-saas

**Data:** 2026-05-31  
**Fonte:** MinhaAgenda ([minhaagendaapp.com.br](https://minhaagendaapp.com.br)) — app mobile/web para profissionais autônomos, v1.318, 4,9★ com ~20k avaliações  
**Propósito:** Referência de UX + gap analysis — incorporar features de mercado comprovadas sem reinventar a roda  
**Como usar:** Antes de iniciar qualquer feature nova, consulte este documento. Se a feature está mapeada, use a coluna "UX Ref" como base de design e "Melhoria" como diferenciação competitiva. Cada ❌ ou 🔄 é candidato a uma `feat/` branch própria.

---

## Legenda

| Ícone | Significado |
|-------|-------------|
| ✅ | Existe no estetica-saas — funcional |
| 🔄 | Parcial — existe mas incompleto ou diferente |
| ❌ | Falta — não implementado |

---

## 1. Agenda / Agendamento

| Feature | Status | UX Ref — como MinhaAgenda implementa | Melhoria no estetica-saas |
|---------|--------|--------------------------------------|---------------------------|
| Criar agendamento | ✅ | Formulário simples: cliente → serviço → profissional → data/hora | Já funcional |
| Editar agendamento | ✅ | Tap no card → editar campos inline | Já funcional |
| Cancelar agendamento | ✅ | Ação no card com confirmação | Já funcional |
| Reagendar (drag or flow) | 🔄 | Botão "remarcar" abre seletor de nova data/hora mantendo cliente e serviço | Adicionar atalho "Remarcar" direto no card sem precisar editar todos os campos |
| Marcar não comparecimento (no-show) | 🔄 | Botão "Não compareceu" no card do agendamento — registra ausência no histórico do cliente | Adicionar status `NO_SHOW` explícito + incrementar contador no perfil do cliente |
| Multa por não comparecimento | ❌ | Ao marcar no-show, opção de lançar cobrança de multa configurável (% do serviço ou valor fixo) | Integrar ao domínio Financial como transaction negativa; configurável por serviço nas Settings |
| Cobranças pendentes (débitos) | ❌ | Lista de clientes com saldo devedor — cada entrada mostra valor, data e serviço | Módulo "Caixa/Cobranças" no Financial: marcar agendamento como "pago", "pendente" ou "cortesia" |
| Expediente por turnos (manhã/tarde/noite) | 🔄 | Settings de expediente permitem múltiplos turnos por dia (ex: 08h–12h e 14h–18h) | Expandir modelo de BusinessHours para suportar múltiplos intervalos por dia |
| Expediente especial / folga avulsa | ❌ | Profissional pode liberar ou bloquear um dia específico fora do padrão semanal | Adicionar `SpecialAvailability` no domínio Scheduling: override de um dia específico |
| Lista de espera | ❌ | Cliente entra na fila; quando horário abre, notificação automática de convite | Lista de espera por serviço/profissional/data com notificação WhatsApp automática ao liberar slot |
| Conversão de lista de espera em agendamento | ❌ | Um tap converte o registro da lista em agendamento confirmado | Fluxo: notificação → link de confirmação no WhatsApp → agendamento criado automaticamente |
| Feriados no calendário | ❌ | Feriados nacionais e locais destacados nas visões semanal e mensal | Integrar tabela de feriados nacionais brasileiros + campo para feriados locais nas Settings |
| Modo offline | ❌ | Agenda funciona sem internet; sincroniza quando conectar | Service worker + IndexedDB para leitura offline dos agendamentos do dia (escrita sincronizada ao reconectar) |
| Visualização diária / semanal / mensal | 🔄 | Três visões com navegação por swipe; card colorido por status | Adicionar visão mensal (hoje só existe semanal) |

---

## 2. CRM / Clientes

| Feature | Status | UX Ref — como MinhaAgenda implementa | Melhoria no estetica-saas |
|---------|--------|--------------------------------------|---------------------------|
| Cadastro de cliente | ✅ | Nome, telefone, email, data de nascimento | Já funcional |
| Histórico de agendamentos | ✅ | Timeline de serviços com data, valor e profissional | Já funcional |
| Busca e filtros de clientes | 🔄 | Busca por nome + filtros por: último atendimento, frequência, valor gasto | Adicionar filtros avançados: "sem agendamento há X dias", "maior ticket médio", "aniversariantes do mês" |
| Ficha de anamnese digitalizada | ❌ | Formulário customizável por tipo de serviço (ex: alergias, histórico médico, foto antes/depois) — preenchido na primeira consulta e arquivado no perfil | Anamnese por template de serviço: campos livres + múltipla escolha + upload de foto; acessível antes do atendimento |
| Campo de observações do cliente | ❌ | Campo de texto livre "Observação/Referência" visível ao criar agendamento (ex: "prefere profissional X", "alérgica a produto Y") | Campo `notes` no modelo Customer; exibido em destaque no modal de agendamento |
| Identificação dos melhores clientes | ❌ | Badge automático "Cliente VIP" para quem está no top 20% por frequência ou ticket | Ranking automático com badge no perfil; segmento filtrável na lista de clientes |
| Lembrete de aniversário | ❌ | No dia do aniversário, mensagem WhatsApp automática pré-configurada ("Feliz aniversário + desconto especial") | Job pg-boss diário às 9h verificando aniversariantes; template WhatsApp editável nas Settings |
| Contador de no-shows por cliente | ❌ | Número de ausências visível no perfil do cliente | Incrementa a cada status `NO_SHOW`; exibido com alerta se > 2 no-shows nos últimos 90 dias |
| Opt-out de comunicação | 🔄 | Clientes podem pedir para não receber mensagens | Já existe `consentGiven` — adicionar `optOutWhatsApp` granular por tipo de mensagem |

---

## 3. Financeiro

| Feature | Status | UX Ref — como MinhaAgenda implementa | Melhoria no estetica-saas |
|---------|--------|--------------------------------------|---------------------------|
| Receita automática ao concluir agendamento | ✅ | Transação criada via evento de domínio | Já funcional |
| Controle de receita e lucro | ✅ | Dashboard financeiro com total do período | Já funcional (Reports) |
| Registro de despesas variáveis | ❌ | Formulário simples: categoria, descrição, valor, data — lançamento manual | Adicionar modelo `Expense` no Financial: tipo (variável/fixa), categoria, recorrência |
| Despesas fixas e recorrentes | ❌ | Despesa marcada como "fixa mensal" se replica automaticamente no próximo mês | `Expense` com campo `recurrenceType` (none / monthly / weekly); job pg-boss gera instância mensal |
| Cálculo de lucro real (receita − despesas) | ❌ | Dashboard mostra receita bruta, total de despesas e lucro líquido no período | Estender Dashboard com aba "Resultado" = soma de revenues − sum of expenses no período |
| Taxa de cartão por bandeira | ❌ | Cada pagamento pode ter taxa de débito/crédito configurada por bandeira (Visa 1,5%, Master 1,7%...) | Campo `paymentMethod` + `cardFee` no Financial; taxa descontada no cálculo de lucro |
| Controle de comissões por profissional | ❌ | Cada serviço tem % de comissão por profissional; relatório de comissão por período | Adicionar `commissionRate` em `ProfessionalService` (M2M entre Professional e Service); relatório de comissão |
| Preço de custo de produtos | ❌ | Cada produto tem preço de custo; margem calculada automaticamente na venda | Módulo de Produtos (separado de Serviços) com `costPrice` e `salePrice` |
| Metas financeiras | ❌ | Usuário define meta de receita mensal; gauge/progresso exibido no dashboard | Modelo `Goal` por período; barra de progresso no Dashboard |
| Gerador de recibos personalizados | ❌ | Recibo com logo, dados do profissional, serviços e valores — gerado em PDF ou imagem para enviar via WhatsApp | Template de recibo configurável nas Settings; gerado em PDF via `@react-pdf/renderer` ou similar |
| Relatório de vendas de produtos | ❌ | Separado do relatório de serviços; mostra produto, quantidade, receita e margem | Novo relatório no módulo Reports após implementar módulo de Produtos |
| Geração de despesa "cortesia" automática | ❌ | Ao marcar agendamento como "cortesia", gera despesa automática com o valor do serviço | Evento `appointment.courtesy` → Financial cria expense com valor do serviço |

---

## 4. Notificações / WhatsApp

| Feature | Status | UX Ref — como MinhaAgenda implementa | Melhoria no estetica-saas |
|---------|--------|--------------------------------------|---------------------------|
| Lembrete de agendamento (24h antes) | ✅ | Mensagem automática via WhatsApp 24h antes | Já funcional (pg-boss) |
| Confirmação de agendamento | ✅ | Mensagem enviada ao criar agendamento | Já funcional |
| Mensagem de aniversário | ❌ | Template editável enviado automaticamente no dia do aniversário do cliente | Job diário + template `birthday` nas Settings de notificações |
| Lembrete bulk (todos do dia) | ❌ | Botão "Enviar lembrete para todos de hoje" — dispara mensagem para todos os agendamentos do dia com 1 clique | Ação na agenda diária; job pg-boss enfileira envios individuais com rate limiting |
| Mensagens pré-definidas customizáveis | 🔄 | 4 templates no sistema com edição de texto livre pelo usuário | Hoje templates são fixos no código; mover para banco de dados (`NotificationTemplate`) com edição na UI |
| Configurações avançadas de lembrete | ❌ | Usuário configura: quantas horas antes enviar (ex: 2h, 24h, 48h), horário máximo de envio (não enviar depois das 22h) | Campo `reminderLeadHours` e `sendAfterHour`/`sendBeforeHour` nas Settings de notificações |
| Lista de sessões de pacote via WhatsApp | ❌ | Envia para o cliente a lista de sessões do pacote contratado com datas e status | Depende de implementar o módulo de Pacotes — mensagem gerada ao confirmar compra de pacote |
| Histórico de notificações enviadas | ❌ | Log com data, cliente, tipo de mensagem e status de entrega | Modelo `NotificationLog` no banco; tela de histórico nas configurações de notificações |

---

## 5. Fidelidade

| Feature | Status | UX Ref — como MinhaAgenda implementa | Melhoria no estetica-saas |
|---------|--------|--------------------------------------|---------------------------|
| Cartão fidelidade digital | ❌ | Cada cliente tem cartão com X selos por serviço realizado; ao completar, ganha desconto ou serviço grátis — configurável pelo profissional | Modelo `LoyaltyCard` com `stampsRequired`, `reward` (desconto % ou serviço grátis), `currentStamps`; selo adicionado automaticamente ao concluir agendamento |
| Configuração do programa de fidelidade | ❌ | Settings simples: quantos serviços para completar o cartão, qual é o prêmio | UI em Configurações; suporte a múltiplos programas por serviço (ex: cartão de manicure separado de escova) |
| Visualização do cartão pelo cliente | ❌ | Cliente vê o progresso no portal de agendamento público ou via link enviado por WhatsApp | Exibir selos no portal `/agendar/[slug]` após identificação do cliente pelo telefone |
| Desconto automático ao resgatar | ❌ | Ao completar o cartão, desconto aplicado automaticamente no próximo agendamento | Evento `loyalty.cardCompleted` → Financial aplica desconto no próximo appointment do cliente |

---

## 6. Produtos

| Feature | Status | UX Ref — como MinhaAgenda implementa | Melhoria no estetica-saas |
|---------|--------|--------------------------------------|---------------------------|
| Catálogo de produtos | ❌ | Lista de produtos com nome, preço de custo e preço de venda — separado do catálogo de serviços | Novo modelo `Product` no domínio Financial ou novo domínio `inventory`; gerenciado nas Settings |
| Adicionar produto no agendamento | ❌ | Ao registrar o atendimento, profissional pode adicionar produtos usados/vendidos com quantidade | Extensão do modelo `Appointment` com relação `AppointmentProduct[]` |
| Relatório de vendas de produtos | ❌ | Separado do relatório de serviços: produto, quantidade vendida, receita, margem | Novo relatório no Reports |

---

## 7. Pacotes de Sessões

| Feature | Status | UX Ref — como MinhaAgenda implementa | Melhoria no estetica-saas |
|---------|--------|--------------------------------------|---------------------------|
| Pacote de sessões (ex: 10 sessões de drenagem) | ❌ | Profissional cria pacote com N sessões e preço total; cliente paga uma vez e consome sessões ao longo do tempo | Modelo `Package` com `sessionsTotal`, `sessionsUsed`, `validUntil`; agendamento consome 1 sessão do pacote |
| Venda de pacote | ❌ | Formulário de venda gera transação financeira e cria o pacote para o cliente | Evento `package.sold` → Financial registra receita; pacote aparece no perfil do cliente |
| Controle de sessões restantes | ❌ | Badge no perfil do cliente mostrando sessões disponíveis por pacote | `sessionsRemaining` calculado; alerta quando restam 1 ou 2 sessões |
| Lista de sessões por WhatsApp | ❌ | Envia extrato de sessões do pacote para o cliente via WhatsApp | Mensagem gerada automaticamente após cada agendamento que usa uma sessão do pacote |

---

## 8. Operacional / Plataforma

| Feature | Status | UX Ref — como MinhaAgenda implementa | Melhoria no estetica-saas |
|---------|--------|--------------------------------------|---------------------------|
| Catálogo de serviços com valores | ✅ | Lista de serviços com nome, duração e preço | Já funcional |
| Cadastro de equipe / profissionais | ✅ | Cadastro com nome, função e comissão | Já funcional (sem comissão — adicionar) |
| Portal de agendamento público | ✅ | Link `/agendar/[slug]` compartilhável | Já funcional |
| Acesso multi-plataforma (web/mobile/tablet) | ✅ | App mobile nativo + versão web | estetica-saas é web responsivo (PWA potencial) |
| Dados na nuvem (sync em tempo real) | ✅ | Supabase Realtime ativo | Já funcional |
| Sistema de planos SaaS | ✅ | Planos com feature gating | Já funcional (FREE/STARTER/PRO/ENTERPRISE) |

---

## Resumo de Gaps

| Domínio | ✅ Existe | 🔄 Parcial | ❌ Falta | Total |
|---------|-----------|-----------|---------|-------|
| Agenda / Agendamento | 3 | 4 | 7 | 14 |
| CRM / Clientes | 2 | 2 | 5 | 9 |
| Financeiro | 2 | 1 | 10 | 13 |
| Notificações / WhatsApp | 2 | 1 | 5 | 8 |
| Fidelidade | 0 | 0 | 4 | 4 |
| Produtos | 0 | 0 | 3 | 3 |
| Pacotes de Sessões | 0 | 0 | 4 | 4 |
| Operacional / Plataforma | 6 | 0 | 0 | 6 |
| **Total** | **15** | **8** | **38** | **61** |

**38 features a implementar** distribuídas em 8 domínios. 8 features parciais que precisam de complemento.

---

## Roadmap Sugerido

Ordenado por **impacto de negócio × esforço de implementação**. Cada linha é candidata a uma `feat/` branch própria.

### Quick Wins (baixo esforço, alto impacto imediato)

| # | Feature | Domínio | Esforço estimado |
|---|---------|---------|-----------------|
| 1 | Campo de observações do cliente (`notes`) | CRM | 0,5 dia |
| 2 | Status `NO_SHOW` explícito + contador no perfil | Agenda / CRM | 1 dia |
| 3 | Filtros avançados na lista de clientes | CRM | 1 dia |
| 4 | Atalho "Remarcar" direto no card do agendamento | Agenda | 0,5 dia |
| 5 | Templates de notificação editáveis (mover para banco) | Notificações | 1,5 dias |
| 6 | Lembrete bulk "todos de hoje" | Notificações | 1 dia |
| 7 | Configuração avançada de lembrete (horas antes, janela de envio) | Notificações | 1 dia |
| 8 | Mensagem de aniversário automática via WhatsApp | Notificações | 1 dia |
| 9 | Feriados nacionais no calendário | Agenda | 1 dia |
| 10 | Histórico de notificações enviadas | Notificações | 1 dia |

### Medium (esforço médio, impacto alto)

| # | Feature | Domínio | Esforço estimado |
|---|---------|---------|-----------------|
| 11 | Registro de despesas variáveis | Financeiro | 2 dias |
| 12 | Despesas fixas/recorrentes (job pg-boss) | Financeiro | 1,5 dias |
| 13 | Dashboard de resultado (receita − despesas) | Financeiro | 1 dia |
| 14 | Comissões por profissional por serviço | Financeiro | 2 dias |
| 15 | Relatório de comissões | Financeiro | 1 dia |
| 16 | Multas por não comparecimento | Agenda / Financeiro | 2 dias |
| 17 | Cobranças pendentes (débitos de clientes) | Financeiro | 2 dias |
| 18 | Ficha de anamnese digitalizada | CRM | 3 dias |
| 19 | Identificação de clientes VIP (top 20%) | CRM | 1 dia |
| 20 | Expediente especial / folga avulsa | Agenda | 2 dias |
| 21 | Cartão fidelidade digital (configuração + selos) | Fidelidade | 3 dias |
| 22 | Fidelidade no portal público (ver progresso) | Fidelidade | 1,5 dias |
| 23 | Metas financeiras com progresso no dashboard | Financeiro | 2 dias |
| 24 | Taxa de cartão por bandeira | Financeiro | 1 dia |
| 25 | Gerador de recibos personalizados (PDF) | Financeiro | 3 dias |

### Complex (múltiplos domínios, esforço alto)

| # | Feature | Domínio | Esforço estimado |
|---|---------|---------|-----------------|
| 26 | Catálogo de produtos + venda no agendamento | Produtos | 4 dias |
| 27 | Relatório de vendas de produtos | Produtos / Reports | 1 dia |
| 28 | Pacotes de sessões (venda + consumo) | Pacotes | 4 dias |
| 29 | Lista de espera com notificação automática | Agenda / Notificações | 3 dias |
| 30 | Conversão de lista de espera em agendamento | Agenda | 1 dia |
| 31 | Modo offline (Service Worker + IndexedDB) | Plataforma | 3 dias |
| 32 | Visualização mensal da agenda | Agenda | 2 dias |
| 33 | Desconto automático ao resgatar fidelidade | Fidelidade / Financeiro | 2 dias |
| 34 | Cortesia → despesa automática | Agenda / Financeiro | 1 dia |
| 35 | Geração de despesa `courtesy` via evento | Financeiro | 0,5 dia |
| 36 | Lista de sessões de pacote via WhatsApp | Pacotes / Notificações | 1 dia |

---

## Como usar este documento no fluxo de desenvolvimento

```
Escolher feature do roadmap acima
        ↓
Abrir Onboarding com: "Quero implementar [feature] — referência UX e melhoria já estão em docs/superpowers/specs/2026-05-31-minha-agenda-feature-mapping.md"
        ↓
Onboarding → Orchestrator → feat/[nome] → pipeline completo → PR → main
```

Nenhuma feature deste documento deve ser iniciada sem antes passar pelo Onboarding.
