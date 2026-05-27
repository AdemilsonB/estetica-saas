# Roadmap de Melhorias — Baseado em Análise de Mercado

**Data:** 2026-05-27
**Origem:** Análise competitiva de Fresha, Booksy, Vagaro, GlossGenius, Mindbody, Treatwell, Square Appointments
**Status:** Referência de produto — cada item vira um spec/plan próprio antes da implementação

---

## Contexto da Análise

O benchmarking identificou que todos os concorrentes globais (Fresha, Booksy, Vagaro) falham
no mercado brasileiro em um ponto crítico: **nenhum integra WhatsApp como canal primário**.
No Brasil, WhatsApp tem 96% de penetração e 97% de taxa de leitura vs <20% de email.

Este roadmap organiza as melhorias em 4 horizontes de tempo, priorizadas pelo impacto no
produto e no negócio.

---

## Horizonte 1 — Fundação (próximas 2–4 semanas)

*Pré-requisitos para tudo mais. Sem eles, não há produto.*

### 1.1 Sistema de Planos e Feature Gating ✅ (spec criado)
- Subscription model + FeatureGuard centralizado
- Trial de 14 dias automático no cadastro
- Modal de upgrade no frontend
- **Spec:** `docs/superpowers/specs/2026-05-27-planos-feature-gating-design.md`

### 1.2 Onboarding em ≤ 3 Passos
**Por que:** cada passo extra de setup representa 5–15% de abandono. Meta: <15 minutos do
cadastro ao primeiro agendamento real.

**O que fazer:**
- Fluxo: (1) Nome + tipo de negócio → (2) Profissionais → (3) Serviços com preços sugeridos
- Ao final: link de booking gerado automaticamente
- Tutorial contextual: aparece só quando o usuário toca a funcionalidade pela primeira vez
- KPI: medir `time_to_first_booking` — alvo <15 minutos

**Não fazer:** mostrar configurações avançadas (horários, notificações, integrações) antes
do primeiro valor percebido.

### 1.3 WhatsApp: Fluxo de Confirmação com Resposta C/R (Plano Starter+)
**Por que:** é o único diferencial real vs todos os concorrentes globais no Brasil.

**O que fazer:**
- Ao criar agendamento → WhatsApp imediato de confirmação
- 24h antes → "Responda C (confirmar) ou R (remarcar)"
- Resposta "C" → status muda para CONFIRMED na agenda automaticamente
- Resposta "R" → bot oferece os 3 próximos slots disponíveis
- "SAIR" → opt-out imediato + mensagem de confirmação (obrigatório Meta)
- Lembrete 2h antes (dentro da janela → gratuito)
- Mensagem pós-atendimento com link de avaliação

**Infraestrutura necessária (ver análise técnica completa):**
- Webhook receiver para eventos da API do WhatsApp
- Processamento de resposta inbound e atualização de estado da agenda
- Worker separado do Vercel (Railway/Render) para filas pg-boss

**Custo por salão típico (200 agendamentos/mês):** ~R$15–25/mês de custo de API
**Monetização:** add-on R$39/mês com ~50% de margem

### 1.4 Resumo do Dia Automático
**Por que:** feature de alta percepção de valor, baixo esforço. Cria hábito de uso diário.

**O que fazer:**
- Notificação push (ou tela ao abrir o app) com snapshot do dia:
  - Total faturado + por forma de pagamento
  - Comparativo com ontem e mesma semana passada
  - Agendamentos pendentes de pagamento
  - "Sua melhor terça do mês" / alertas contextuais
- Fechamento de caixa em 1 toque: exporta resumo por WhatsApp ou PDF

---

## Horizonte 2 — Retenção (1–3 meses)

*Features que reduzem churn nos primeiros 90 dias.*

### 2.1 Agenda: Melhorias de UX Operacional
**Por que:** é a tela mais usada. Cada fricção aqui é churn.

**O que fazer:**
- Card de agendamento com ação de 1 toque: confirmar presença / marcar pago / reagendar
- Barra de status do dia: % ocupação + valor projetado vs realizado
- Busca rápida por cliente diretamente da agenda
- Toggle dia/semana sem sair da tela
- Slots livres como "buracos clicáveis" visíveis (não espaços em branco)

**Gap vs concorrentes:** Booksy tem admin UX frustrante (principal reclamação em reviews).
Aqui está a oportunidade de diferenciação.

### 2.2 CRM: Ficha de Cliente Acionável
**Por que:** profissional precisa entender o cliente em 5 segundos antes do atendimento.

**O que fazer:**
- Histórico de atendimentos em timeline (não tabela)
- Campo de observação proeminente ("alérgica a amônia", "prefere manhã")
- Último atendimento + serviço mais frequente + profissional favorito
- Status automático: ativo / em risco de churn / inativo
- Ação rápida: agendar ou enviar WhatsApp direto do perfil
- **Cliente não precisa criar conta** para aparecer no CRM (diferencial vs Fresha)

### 2.3 Controle de Comissões por Profissional
**Por que:** donos de salão não vivem sem isso. Ausência causa churn imediato.

**O que fazer:**
- Percentual de comissão configurável por profissional e/ou por serviço
- Relatório de comissão mensal por profissional
- Exportação para WhatsApp/PDF no fechamento do mês
- Futuro: integração com folha de pagamento

### 2.4 Campanhas de WhatsApp (Plano Starter+)
**O que fazer:**
- Seleção de segmento: ativos / inativos há X dias / por serviço / aniversário
- Editor de mensagem simples com variáveis ({nome}, {ultimo_servico})
- Envio agendado (respeitando rate limit por conta)
- Relatório de entrega: enviado / lido / respondeu

---

## Horizonte 3 — Crescimento (3–6 meses)

*Features que expandem receita e viabilizam upsell.*

### 3.1 WhatsApp Premium: Migração para Meta Cloud API (Plano Pro+)
**Por que:** Z-API é uma solução não-oficial. Risco de ban, sem suporte, instável.
Meta Cloud API é o padrão correto: confiável, templates aprovados, webhook oficial.

**O que mudar:**
- Registrar número do tenant no WABA (WhatsApp Business Account) via BSP (Zenvia inicialmente)
- Migrar de Z-API para Meta Cloud API no `whatsapp.provider.ts`
- Implementar templates HSM aprovados para mensagens fora da janela de 24h
- Controle de opt-in/opt-out formal
- Worker de filas em processo separado (Railway/Render) — requisito técnico não negociável

**Arquitetura detalhada:** ver análise técnica WhatsApp (gerada nesta sessão)

### 3.2 Insights de Negócio Proativos (IA)
**Por que:** todos os concorrentes têm relatórios passivos. Ninguém envia "sua quinta está
ociosa — quer criar uma promoção?". Esse é o diferencial "AI-Augmented" que não é marketing
vazio.

**Insights específicos a entregar:**
- Segunda-feira com >30% de ociosidade → sugestão de promoção relâmpago
- Cliente inativo há N dias (baseado no intervalo histórico dele) → alerta + sugestão de mensagem
- No-show rate subiu 15% esta semana → sugestão de pedir confirmação prévia
- Ticket médio de profissional X abaixo da equipe → sugestão de upsell
- Narrativa semanal: "Melhor semana do mês — o que mudou: 3 novos clientes da [profissional]"

**Implementação:** Claude API (Anthropic) para geração de narrativas e sugestões.
Dados sempre gerados pelo próprio sistema — IA só formata e contextualiza.

### 3.3 Ficha de Atendimento para Clínicas Estéticas
**Por que:** nenhum concorrente resolve bem. Gap real para clínicas de skincare, estética
médica, nail design.

**O que fazer:**
- Anamnese estruturada por tipo de serviço (configurável)
- Galeria de fotos antes/depois vinculada ao atendimento
- Ficha técnica de produto/protocolo utilizado
- Histórico de reações ou contraindicações
- Assinatura digital do cliente (LGPD)

### 3.4 Multi-Unidade (Plano Pro+)
**O que fazer:**
- Tenant pai com N unidades filhas
- Visão consolidada: faturamento, ocupação, ranking de profissionais por unidade
- Profissional pode trabalhar em mais de uma unidade
- Agenda por unidade com filtro rápido

---

## Horizonte 4 — Escala (6–12 meses)

*Expansão de receita, diferenciação avançada.*

### 4.1 Gateway de Pagamento — Asaas
**O que fazer:**
- Cobrança automática recorrente (PIX + boleto + cartão)
- Webhook de pagamento → atualiza status da Subscription automaticamente
- Cancelamento self-service com access até fim do período
- Dunning automático (PAST_DUE → tentativas de cobrança → EXPIRED)
- Portal de cliente para histórico de faturas

**Por que Asaas:** suporte PT-BR, PIX nativo, API bem documentada, experiência com SaaS B2B
brasileiro.

### 4.2 Programa de Indicação
**Por que:** canal com menor CAC no mercado de salões. Um cliente satisfeito que indica vale
5–10 leads qualificados.

**O que fazer:**
- Link de indicação único por tenant
- Recompensa: 1 mês grátis para quem indica + 1 mês grátis para o indicado
- Dashboard de indicações: quantas, quem se cadastrou, quantas ativaram

### 4.3 Integração Fiscal (NFC-e)
**O que fazer:**
- Emissão de NFC-e direto do POS após pagamento
- Armazenamento de XML e DANFE
- Relatório de faturamento fiscal por período
- Integração com SEFAZ de cada estado (via provedor como Focus NFe)

### 4.4 API Pública e Branded App
**O que fazer:**
- REST API documentada para integrações de parceiros
- Branded app: Next.js PWA com nome e cores do salão (alternativa barata ao app nativo)
- Listagem em Google Reserve / marketplace próprio

---

## Mapa de Features × Concorrentes

| Feature                          | Fresha | Booksy | Vagaro | GlossGenius | **Nosso** |
|----------------------------------|--------|--------|--------|-------------|-----------|
| Agendamento online               | ✓      | ✓      | ✓      | ✓           | ✓         |
| WhatsApp como canal primário     | ✗      | ✗      | ✗      | ✗           | **✓**     |
| Confirmação C/R por WhatsApp     | ✗      | ✗      | ✗      | ✗           | **✓**     |
| Marketplace de captação          | ✓      | ✓      | ✗      | ✗           | Futuro    |
| Relatórios avançados             | Básico | Básico | ✓      | Básico      | ✓ Pro+    |
| Multi-unidade                    | ✓      | ✗      | ✓      | ✗           | ✓ Pro+    |
| Insights proativos de IA         | ✗      | ✗      | Básico | ✗           | **✓**     |
| Ficha clínica / anamnese         | ✗      | ✗      | ✗      | ✗           | **✓**     |
| Onboarding <15 minutos           | ✓      | ✗      | ✗      | ✓           | **✓**     |
| Sem obrigar cliente criar conta  | ✗      | ✗      | ✓      | ✓           | **✓**     |
| Trial sem cartão                 | ✓      | ✗      | ✗      | ✓           | **✓**     |

---

## Posicionamento Definido

**Frase:** "O sistema que agenda, confirma e gerencia — enquanto você atende."

**3 Pilares:**
1. **Agenda que trabalha por você** — WhatsApp automático confirma, relembra e organiza.
2. **Financeiro na palma da mão** — caixa, comissões, ticket médio em 30 segundos.
3. **IA que conhece seu negócio** — insights que chegam até você, não relatórios que você precisa interpretar.

**Modelo de preço:** R$49/profissional/mês (por profissional ativo, não por feature)
**Add-on WhatsApp:** R$39/mês (Meta Cloud API — plano Pro)

---

## Riscos Técnicos a Resolver (ordem de urgência)

| Risco | Impacto | Quando resolver |
|---|---|---|
| pg-boss + Vercel serverless | WhatsApp automático não funciona | Antes de ter 1 cliente em produção |
| Concorrência de escrita na agenda | Double-booking sob carga | Antes de ter 10 clientes simultâneos |
| Vazamento de dados multi-tenant | Morte do negócio | Antes de ter 5 clientes pagantes |
| WhatsApp Z-API (não-oficial) | Ban do número | Horizonte 3 — migrar para Meta API |
| Connection pooling Supabase | Limite de conexões sob escala | Quando atingir 100+ tenants ativos |

---

## KPIs de Produto para Acompanhar

| KPI | Alvo | Mede o quê |
|---|---|---|
| Time to first booking | <15 min | Onboarding |
| Trial → Paid conversion | >25% | Proposta de valor |
| DAU/MAU ratio | >60% | Retenção |
| No-show rate dos clientes | Queda >30% vs baseline | Eficácia do WhatsApp |
| NPS | >70 antes de paid traffic | Satisfação |
| Messages delivered/opened | >90% / >70% | Saúde do WhatsApp |

---

## Próximas Ações Imediatas

1. **Implementar spec de planos** (este roadmap, item 1.1) — pré-requisito para tudo
2. **Resolver pg-boss + Vercel** (worker em Railway/Render) — pré-requisito para WhatsApp
3. **Onboarding ≤3 passos** (item 1.2) — medir time_to_first_booking
4. **WhatsApp C/R** (item 1.3) — maior diferencial vs mercado
5. **Resumo do dia** (item 1.4) — retenção diária barata de implementar
6. **Ir ao mercado com 10 clientes reais** — antes de Horizonte 2
