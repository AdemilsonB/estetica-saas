# Roadmap de Produto — 12 Fases
**Data:** 2026-05-27
**Origem:** Análise competitiva (Fresha, Booksy, Vagaro, GlossGenius, Mindbody, Treatwell, Square Appointments) + estado real do repositório
**Status:** Documento de referência — cada fase requer aprovação explícita antes de iniciar implementação

---

## Protocolo de execução

- Uma fase por vez
- Nenhuma fase inicia sem aprovação explícita do produto
- Ao concluir uma fase, apresentar resumo e aguardar aprovação para a próxima
- Fases 1–4 já estão concluídas e mergeadas na `main`

---

## Fases concluídas

### Fase 1 — Fundação técnica ✅
**Status:** Completa — mergeada na `main`

**O que foi entregue:**
- IAM completo: autenticação Supabase (email/senha + Google OAuth), RBAC com 4 roles (OWNER, MANAGER, PROFESSIONAL, RECEPTIONIST), permissões granulares
- Onboarding de tenant (registro + setup inicial)
- Gestão de equipe (convite por email, aceite, listagem)
- Infraestrutura: multi-tenancy obrigatório (`tenantId` em todo model), event bus interno, erros de domínio tipados, validação Zod, pg-boss instalado, middleware de autenticação

---

### Fase 2 — Core operacional ✅
**Status:** Completa — mergeada na `main`

**O que foi entregue:**
- **CRM:** cadastro e listagem de clientes, busca, paginação, perfil com histórico de agendamentos
- **Scheduling:** agenda semanal, verificação de disponibilidade, criação/edição/cancelamento de agendamentos, gestão de serviços (nome, duração, preço)
- **Financial:** registro de transações, geração automática de receita ao concluir agendamento via evento de domínio

---

### Fase 3 — Visibilidade do negócio ✅ (frontend de notificações parcial)
**Status:** Completa com pendências no frontend de notificações — mergeada na `main`

**O que foi entregue:**
- **Notifications (backend):** 4 templates WhatsApp funcionais via Z-API — `appointment-created`, `appointment-reminder` (24h antes via pg-boss), `appointment-confirmed`, `appointment-no-show`
- **Notifications (frontend):** configuração de credenciais Z-API (Instance ID + Token) e toggle ativar/desativar
- **Dashboard:** métricas agregadas do dia/semana/mês, polling a cada 30s
- **Reports:** 4 relatórios (faturamento, agendamentos, clientes, profissionais), filtros por período, exportação CSV
- **Settings:** informações do negócio, horários de funcionamento, catálogo de serviços, configuração WhatsApp

**Pendências (incorporadas na Fase 5):**
- Frontend de visualização dos templates (dono do salão não vê o texto das mensagens)
- Edição e personalização dos templates
- Histórico de notificações enviadas
- Teste de envio manual

---

### Fase 4 — Monetização SaaS ✅
**Status:** Completa — mergeada na `main`

**O que foi entregue:**
- Sistema de planos: FREE / STARTER / PRO / ENTERPRISE
- FeatureGuard centralizado (`featureGuard.assertAccess`) — bloqueia features por plano
- PlanLimits (`featureGuard.assertWithinLimit`) — bloqueia por limites de uso (usuários, agendamentos/mês)
- Trial de 14 dias automático no cadastro de novo tenant (inicia no plano STARTER)
- Expire sweep: job pg-boss `billing:expire-sweep` roda às 5h — expira trials vencidos
- UI de planos em `/configuracoes/planos` com UpgradeModal contextual

---

## Fases pendentes — aguardando aprovação

### Fase 5 — WhatsApp operacional completo
**Dependências:** Fase 3 (notificações backend), Fase 4 (billing/planos)
**Aprovação necessária para iniciar:** sim

**O que entrega:**
- **Onboarding ≤3 passos:** (1) Nome + tipo de negócio → (2) Profissionais → (3) Serviços com preços sugeridos → link de booking gerado. KPI alvo: `time_to_first_booking < 15 minutos`
- **Fluxo C/R:** ao criar agendamento → WhatsApp imediato de confirmação; 24h antes → "Responda C (confirmar) ou R (remarcar)"; resposta C → status muda para CONFIRMED automaticamente; resposta R → bot oferece os 3 próximos slots disponíveis; "SAIR" → opt-out imediato (obrigatório Meta)
- **Worker pg-boss fora do Vercel:** processo separado (Railway ou Render) — pré-requisito para WhatsApp automático funcionar em produção
- **Webhook inbound:** receiver para eventos de resposta da API do WhatsApp, processamento de estado da agenda
- **Frontend de templates:** visualização do texto de cada template, edição e personalização por tenant
- **Histórico de notificações:** listagem de mensagens enviadas com status (enviada, lida, falha)
- **Teste de envio manual:** dono do salão testa envio de template sem criar agendamento

**Diferencial vs concorrentes:** nenhum concorrente global integra WhatsApp como canal primário com resposta inbound. Custo estimado: R$15–25/mês por salão com 200 agendamentos.

---

### Fase 6 — UX operacional avançada
**Dependências:** Fase 5
**Aprovação necessária para iniciar:** sim

**O que entrega:**
- **Agenda (melhorias UX):** ações 1-toque no card de agendamento (confirmar presença, marcar pago, reagendar); barra de status do dia com % de ocupação e valor projetado vs realizado; busca rápida por cliente direto da agenda; toggle dia/semana sem sair da tela; slots livres como "buracos clicáveis" visíveis
- **Comissões:** percentual de comissão configurável por profissional e/ou por serviço; relatório mensal de comissão por profissional; exportação para WhatsApp ou PDF no fechamento do mês
- **Ficha de cliente acionável:** histórico em timeline (não tabela); campo de observação proeminente ("alérgica a amônia", "prefere manhã"); último atendimento + serviço mais frequente + profissional favorito; status automático (ativo / em risco de churn / inativo); ação rápida: agendar ou enviar WhatsApp direto do perfil. **Diferencial:** cliente não precisa criar conta para aparecer no CRM

**Gap de mercado explorado:** Booksy tem admin UX reconhecidamente frustrante (principal reclamação em reviews). Aqui está a oportunidade de diferenciação.

---

### Fase 7 — Retenção e aquisição
**Dependências:** Fase 6
**Aprovação necessária para iniciar:** sim

**O que entrega:**
- **Memberships e pacotes:** planos recorrentes de serviços (ex: "4 cortes/mês"), faturamento recorrente, controle de uso
- **Programa de fidelidade:** pontos ou recompensas por visita/indicação, incentivos configuráveis (desconto, serviço gratuito)
- **Campanhas de WhatsApp segmentadas:** seleção por segmento (ativos, inativos há X dias, por serviço, aniversário); editor de mensagem com variáveis ({nome}, {ultimo_servico}); envio agendado respeitando rate limit; relatório de entrega (enviado / lido / respondeu). Plano Starter+
- **Link de booking público:** página do salão com serviços, profissionais e disponibilidade — cliente agenda sem criar conta
- **Integração social:** botão de agendamento no Instagram, Facebook e Google Meu Negócio

---

### Fase 8 — Inventário e produto
**Dependências:** Fase 6
**Aprovação necessária para iniciar:** sim

**O que entrega:**
- Cadastro de produtos com estoque
- Consumo de produto por atendimento (registrado ao concluir)
- Alertas automáticos de estoque baixo
- Venda de produtos no PDV (junto ao serviço)
- Venda de produtos online (página de produtos do salão)
- Relatório de estoque e consumo por período

---

### Fase 9 — IA operacional
**Dependências:** Fase 7 e Fase 8 (dados suficientes para análise)
**Aprovação necessária para iniciar:** sim

**O que entrega:**
- **Insights proativos:** segunda-feira com >30% de ociosidade → sugestão de promoção relâmpago; no-show rate subiu 15% → sugestão de pedir confirmação prévia; ticket médio de profissional abaixo da equipe → sugestão de upsell
- **Alerta de churn:** cliente inativo há N dias (baseado no intervalo histórico dele) → alerta + sugestão de mensagem
- **Narrativa semanal automática:** "Melhor semana do mês — o que mudou: 3 novos clientes da [profissional]"
- **AI Analyst:** perguntas em linguagem natural sobre os dados do negócio ("Quem são meus clientes de maior receita?", "Qual serviço tem mais no-shows?")

**Implementação:** Claude API (Anthropic) para geração de narrativas e respostas. Dados gerados pelo sistema — IA formata e contextualiza. Diferencial real vs concorrentes: todos têm relatórios passivos, nenhum envia insight proativo.

---

### Fase 10 — WhatsApp Enterprise
**Dependências:** Fase 5 (WhatsApp Z-API funcionando), Fase 9 (opcional — campanhas inteligentes)
**Aprovação necessária para iniciar:** sim

**O que entrega:**
- **Migração Z-API → Meta Cloud API oficial:** registrar número do tenant no WABA via BSP (Zenvia); migrar `whatsapp.provider.ts`; eliminar risco de ban do número
- **Templates HSM aprovados:** mensagens fora da janela de 24h (campanhas, follow-up pós-visita, cobrança)
- **Bot de agendamento via WhatsApp:** cliente agenda diretamente pela conversa, sem abrir o sistema
- **Opt-in/opt-out formal:** controle de consentimento com registro de data e canal (obrigatório Meta e LGPD)
- **Campanhas com templates aprovados:** envio em massa com templates HSM, sem risco de bloqueio

**Por que não na Fase 5:** Z-API é solução funcional para MVP. Meta Cloud API exige processo de aprovação de conta WABA — prazo de semanas. Migrar quando o volume justificar.

---

### Fase 11 — Multi-unidade e clínicas estéticas
**Dependências:** Fase 6
**Aprovação necessária para iniciar:** sim

**O que entrega:**
- **Multi-unidade:** tenant pai com N unidades filhas; visão consolidada (faturamento, ocupação, ranking de profissionais por unidade); profissional pode trabalhar em mais de uma unidade; agenda por unidade com filtro rápido. Plano Pro+
- **Ficha clínica / anamnese:** estruturada por tipo de serviço (configurável); campos: histórico de reações, contraindicações, produtos/protocolos utilizados
- **Galeria antes/depois:** fotos vinculadas ao atendimento, organizadas por cliente e serviço
- **Assinatura digital:** cliente assina ficha de anamnese digitalmente (conformidade LGPD)

**Gap de mercado:** nenhum concorrente resolve bem clínicas estéticas. Oportunidade real para skincare, estética médica, nail design.

---

### Fase 12 — Ecossistema e integrações
**Dependências:** todas as fases anteriores
**Aprovação necessária para iniciar:** sim
**Modelo:** cada item é um módulo opcional — funciona apenas se configurado e ativado pelo tenant

**O que entrega:**

#### 12.1 Gateway de pagamento (Asaas)
- Cobrança recorrente automática (PIX + boleto + cartão)
- Webhook de pagamento → atualiza status da Subscription automaticamente
- Cancelamento self-service com acesso até fim do período
- Dunning automático (PAST_DUE → tentativas → EXPIRED)
- Portal do cliente: histórico de faturas
- **Por que Asaas:** suporte PT-BR, PIX nativo, API bem documentada, experiência com SaaS B2B brasileiro

#### 12.2 Programa de indicação
- Link de indicação único por tenant
- Recompensa: 1 mês grátis para quem indica + 1 mês grátis para o indicado
- Dashboard: indicações enviadas, cadastros, ativações

#### 12.3 Integração fiscal (NFC-e)
- Emissão de NFC-e direto do PDV após pagamento
- Armazenamento de XML e DANFE
- Relatório de faturamento fiscal por período
- Integração com SEFAZ via provedor Focus NFe

#### 12.4 API pública
- REST API documentada para integrações de parceiros
- Autenticação via API key por tenant
- Rate limiting por plano

#### 12.5 Branded App (PWA)
- Next.js PWA com nome e cores do salão
- Alternativa a app nativo — sem custo de App Store
- Listagem em Google Reserve / marketplace próprio

---

## Mapa de features × concorrentes

| Feature | Fresha | Booksy | Vagaro | GlossGenius | Mindbody | **Nosso** |
|---|---|---|---|---|---|---|
| Agendamento online | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ F2 |
| WhatsApp canal primário | ✗ | ✗ | ✗ | ✗ | ✗ | **✓ F5** |
| Confirmação C/R WhatsApp | ✗ | ✗ | ✗ | ✗ | ✗ | **✓ F5** |
| Onboarding <15 minutos | ✓ | ✗ | ✗ | ✓ | ✗ | **✓ F5** |
| Comissões por profissional | ✓ | ✗ | ✓ | ✗ | ✓ | ✓ F6 |
| Memberships e pacotes | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ F7 |
| Programa de fidelidade | ✓ | ✗ | ✓ | ✗ | ✓ | ✓ F7 |
| Link de booking público | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ F7 |
| Campanhas segmentadas | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ F7 |
| Gestão de estoque | ✓ | ✗ | ✓ | ✗ | ✓ | ✓ F8 |
| Insights proativos de IA | ✗ | ✗ | Básico | ✗ | Básico | **✓ F9** |
| AI Analyst (linguagem natural) | ✗ | ✗ | ✗ | ✓ | ✗ | **✓ F9** |
| WhatsApp Meta Cloud API | ✗ | ✗ | ✗ | ✗ | ✗ | **✓ F10** |
| Bot agendamento WhatsApp | ✗ | ✗ | ✗ | ✗ | ✗ | **✓ F10** |
| Multi-unidade | ✓ | ✗ | ✓ | ✗ | ✓ | ✓ F11 |
| Ficha clínica / anamnese | ✗ | ✗ | ✗ | ✗ | HIPAA | **✓ F11** |
| Gateway pagamento recorrente | ✓ | ✗ | ✓ | ✗ | ✓ | ✓ F12 |
| Integração fiscal NFC-e | ✗ | ✗ | ✗ | ✗ | ✗ | **✓ F12** |
| API pública | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ F12 |
| Sem obrigar cliente criar conta | ✗ | ✗ | ✓ | ✓ | ✗ | **✓ F6** |
| Trial sem cartão | ✓ | ✗ | ✗ | ✓ | ✗ | **✓ F4** |

---

## KPIs de produto por fase

| Fase | KPI principal | Alvo |
|---|---|---|
| F5 | Time to first booking | <15 min |
| F5 | No-show rate | Queda >30% vs baseline |
| F7 | Trial → Paid conversion | >25% |
| F7 | DAU/MAU ratio | >60% |
| F9 | NPS | >70 antes de paid traffic |
| F10 | Messages delivered/opened | >90% / >70% |

---

## Riscos técnicos prioritários

| Risco | Impacto | Resolver em |
|---|---|---|
| pg-boss + Vercel serverless | WhatsApp automático não funciona | Fase 5 |
| Concorrência de escrita na agenda | Double-booking sob carga | Fase 5 |
| Vazamento de dados multi-tenant | Risco crítico de negócio | Antes de clientes pagantes |
| WhatsApp Z-API (não-oficial) | Ban do número | Fase 10 |
| Connection pooling Supabase | Limite de conexões sob escala | Fase 11 (100+ tenants) |
