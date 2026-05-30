# Análise Competitiva — SaaS para Salões de Beleza

> Pesquisa realizada em: 2026-05-29  
> Objetivo: mapear concorrentes, funcionalidades, WhatsApp e oportunidades de diferenciação  
> Nicho definido: salões de beleza (não barbearias)

---

## 1. Concorrentes Analisados

### 1.1 NavalhaGO — navalhago.app

**Posicionamento:** "Automatiza tudo: agendamento, cobrança no Pix e confirmação no WhatsApp"  
**Público:** Barbearias com mínimo 3 cortes/dia  
**Trial:** 7 dias grátis, sem cartão  
**Preço entrada:** R$ 47/mês (escala por profissional: 2–6+)  
**Garantia:** 30 dias ou devolução  
**Billing:** Mensal ou anual (10% desconto)

**12 Módulos:**
1. Agendamento via link na bio do Instagram
2. Robô WhatsApp — confirmação 1 clique (taxa de presença declarada: 95%)
3. Pix automático obrigatório antes de confirmar agendamento
4. Controle de fiado + suspensão automática de inadimplentes
5. Venda de balcão com carrinho + comissão automática
6. Clube VIP — assinatura mensal do cliente, créditos por serviço
7. Cashback automático (fidelidade)
8. Sistema de afiliados (indica e ganha meses grátis)
9. Caixa + financeiro + relatórios
10. Emissão de NFS-e automática por atendimento
11. Multi-unidades (franquias)
12. Automação de Google Reviews pós-atendimento

**Pontos fortes:** Pix pré-agendamento elimina faltas. Trio de retenção: Clube VIP + Cashback + Afiliados.  
**Fraqueza:** Exclusivo para barbearias. Sem CRM profundo. Sem histórico de cliente.

---

### 1.2 Belasis — belasis.com.br

**Posicionamento:** "CRM com IA para beleza" — plataforma premium, 8 países, 16.000+ profissionais  
**Trial:** Disponível nos planos Lite e Pro  

**Planos:**
| Plano | Preço | Destaque |
|---|---|---|
| Lite | R$ 99/mês | Agendamento + NF-e |
| Pro | R$ 189/mês | CRM completo + campanhas + comissões (**popular**) |
| Scale | Sob consulta | IA proprietária + API + white-label + gerente dedicado |

**Funcionalidades por plano:**
- Lite: Agenda online, NF-e, CRM básico
- Pro: CRM completo, comissões automáticas, campanhas de marketing, WhatsApp Business API
- Scale: IA assistente, API pública, white-label, gerente de conta

**Integrações:** WhatsApp Business API oficial (Meta), Belasis Pay, extensão Chrome para CRM  
**Pontos fortes:** Único com IA, WhatsApp API oficial, CRM mais maduro  
**Fraqueza:** Sem Clube VIP, Cashback, controle de fiado. CRM real só no Pro (R$ 189)

---

### 1.3 Trinks — trinks.com

**Posicionamento:** Marketplace de descoberta + sistema de gestão  
**Usuários:** 100.000+ clientes finais, 40.000+ negócios, 20+ cidades  
**Trial:** 5 dias grátis  

**Diferencial único:** O cliente busca e descobre o salão dentro do app Trinks → gera tráfego novo (modelo B2B2C)  
**Notificações:** SMS (não WhatsApp)  
**Pagamentos:** Visa, Mastercard, Amex, Elo, Hipercard, Pix, Dinheiro, Depósito  
**Pontos fortes:** Marketplace gera tráfego orgânico. App mobile nativo iOS/Android.  
**Fraqueza:** Sem WhatsApp nativo. Fraco em automações de retenção. Sem cashback/clube.

---

### 1.4 Booksy — booksy.com

**Posicionamento:** Marketplace global de beleza  
**Cobertura BR:** 25+ cidades, 8+ categorias  

**Pontos fortes:** App mobile nativo, presença internacional, cartões-presente, Google/Instagram integrados  
**Fraqueza no Brasil:** Sem Pix nativo. Sem clube VIP nem cashback. Preço em dólar — caro para pequenos salões. Sem WhatsApp.

---

## 2. Mapa de Funcionalidades — Mercado vs. Nosso Sistema

| Funcionalidade | NavalhaGO | Belasis | Trinks | Booksy | **Nosso sistema** |
|---|---|---|---|---|---|
| Agendamento online | ✅ | ✅ | ✅ | ✅ | ✅ Feito |
| WhatsApp automático | ✅ Não-oficial | ✅ API Oficial | ❌ SMS | ❌ | ✅ Twilio |
| Confirmação agendamento | ✅ | ✅ | SMS | ❌ | ✅ Feito |
| Lembrete automático | ✅ | ✅ | SMS | Push | ✅ Feito |
| Cancelamento automático | ❌ | ❌ | ❌ | ❌ | ✅ **Exclusivo** |
| No-show automático | ❌ | ❌ | ❌ | ❌ | ✅ **Exclusivo** |
| Webhook status entrega | ❌ | Parcial | ❌ | ❌ | ✅ Feito |
| Quota WhatsApp por plano | ❌ | ❌ | ❌ | ❌ | ✅ **Exclusivo** |
| Pix integrado | ✅ Obrigatório | ✅ Pay | ✅ | ❌ | 🟡 Fase futura |
| CRM de clientes | ❌ Básico | ✅ Pro+ | ❌ Básico | ❌ Básico | ✅ Base feita |
| Ficha técnica cliente | ❌ | ❌ | ❌ | ❌ | 🟡 **Diferencial a construir** |
| Gestão de comissões | ✅ | ✅ Pro+ | ✅ | ❌ | ✅ Feito |
| Clube VIP / Assinatura | ✅ | ❌ | ✅ | ❌ | 🟡 Roadmap |
| Cashback | ✅ | ❌ | ❌ | ❌ | 🟡 Roadmap |
| Controle de fiado | ✅ | ❌ | ❌ | ❌ | 🟡 Roadmap |
| NFS-e automática | ✅ | ✅ | ❌ | ❌ | 🟡 Roadmap |
| Relatórios avançados | ✅ | ✅ | ❌ | ❌ | ✅ Feito |
| Multi-unidades | ✅ | ✅ Scale | ❌ | ✅ | ✅ Multi-tenant |
| IA operacional | ❌ | ✅ Scale | ❌ | ❌ | 🟡 Fase futura |
| Google Reviews automático | ✅ | ❌ | ❌ | ✅ | 🟡 Roadmap |
| Marketplace (descoberta) | ❌ | ❌ | ✅ | ✅ | ❌ Fora do escopo |
| **Página de agendamento público** | ✅ | ✅ | ✅ | ✅ | 🔴 **Próxima entrega** |
| **Chatbot WhatsApp booking** | ✅ Básico | ❌ | ❌ | ❌ | 🟡 Roadmap |
| **Campanhas WhatsApp segmentadas** | ✅ | ✅ Pro | ❌ | ❌ | 🟡 Roadmap |

---

## 3. Gaps Identificados — Oportunidades

### Gap 1 — CRM profundo para salões (nenhum faz bem)
Nenhum concorrente entrega no tier básico:
- Histórico de colorimetria e procedimentos
- Preferências de produto
- Alergias e restrições
- Fotos antes/depois por atendimento
- Ficha técnica vinculada ao profissional

### Gap 2 — Template no-show e cancelamento automático
NavalhaGO, Belasis, Trinks e Booksy não enviam WhatsApp automático quando cliente não aparece.
Nosso sistema já tem isso implementado — diferencial imediato.

### Gap 3 — Chatbot WhatsApp para booking (nenhum para salões)
NavalhaGO tem para barbearia. Nenhum dos focados em salão tem chatbot conversacional de agendamento via WhatsApp.

### Gap 4 — Pix pré-agendamento
Apenas NavalhaGO faz. Nenhum dos salão-focados exige Pix antes de confirmar. Reduz faltas dramaticamente.

### Gap 5 — Campanhas segmentadas por comportamento
Nenhum no tier básico faz: cliente que não vem há 60 dias → campanha específica. Segmentação por comportamento de frequência.

---

## 4. Posicionamento Definido

**Público:** Salões de beleza de todos os tamanhos (Free → Starter → Pro → Enterprise)

**Proposta de valor central:**
> O único sistema para salões de beleza que conhece cada cliente tão bem quanto a profissional que atende — e trabalha 24h para que nenhum cliente suma sem ser reconquistado.

**Diferenciação core:**
- CRM profundo com ficha técnica do cliente (colorimetria, alergias, histórico)
- Retenção automatizada: Clube VIP + Cashback + campanhas WhatsApp por comportamento
- Chatbot WhatsApp (Twilio) para agendamento conversacional
- Único com mensagens de no-show e cancelamento automáticas

---

## 5. Roadmap de Fases (Abordagem "Ondas por Persona")

### Fase lançamento — Salão pequeno (Starter)
- Polir produto atual
- CRM profundo: ficha técnica do cliente
- Página de agendamento público (`/agendar/[slug]`)
- Trial de 7 dias + landing page

### Fase 2 — 60 dias — Salão médio (Pro)
- Clube VIP (assinatura mensal do cliente)
- Cashback automático
- Campanhas WhatsApp segmentadas por comportamento
- Agendamento público + notificação WhatsApp pós-booking

### Fase 3 — 120 dias — Pro+
- Chatbot WhatsApp de agendamento (Twilio Studio)
- Assistente interno para atendente (Twilio Conversations)
- Controle de fiado + suspensão automática

### Fase 4 — 180 dias+ — Enterprise
- IA operacional: sugestão de horários ociosos, previsão de receita, alerta de churn
- NFS-e automática por atendimento
- Multi-unidades com dashboard consolidado
- Google Reviews automático pós-atendimento

---

## 6. WhatsApp — Análise de Tecnologias do Mercado

### 6.1 Mapa de tecnologias por concorrente

| Concorrente | Tecnologia | Canal | Uso principal |
|---|---|---|---|
| NavalhaGO | Z-API (não-oficial) | WhatsApp do salão | Confirmação, lembrete, fiado, Google Review |
| Belasis | Meta Cloud API (oficial) | WhatsApp Business | CRM, campanhas, recuperação de inativos |
| Trinks | SMS (Twilio ou similar) | SMS | Lembrete de agendamento |
| Booksy | Push notification | App | Confirmação, lembrete |
| **Nosso sistema** | **Twilio (BSP oficial Meta)** | **WhatsApp Business** | Confirmação, lembrete, cancelamento, no-show |

### 6.2 Comparativo das três tecnologias

#### Z-API / Evolution API (não-oficial)
- Engenharia reversa do WhatsApp Web (biblioteca Baileys)
- **Prós:** Barato (R$ 55–99/instância), ilimitado, fácil de configurar, sem aprovação de template
- **Contras:** Risco alto de ban do número — perde histórico de clientes. Violação de ToS do Meta.
- **Quem usa:** NavalhaGO, maioria dos SaaS pequenos brasileiros

#### WhatsApp Cloud API — Meta Direto
- API oficial do Meta, número verificado
- **Prós:** Zero risco de ban, templates ricos, selo verde, estável
- **Contras:** Precisa aprovação de template, cobrança por mensagem, mais complexo de configurar
- **Quem usa:** Belasis Pro+

#### Twilio WhatsApp (BSP oficial Meta)
- Twilio é um Business Solution Provider (BSP) credenciado pelo Meta
- **Prós:** API oficial + infraestrutura Twilio (Studio, Conversations, SMS fallback, Analytics)
- **Diferenciais sobre Meta direto:** Twilio Studio (chatbot visual), Conversations (inbox multi-agente), SMS fallback automático
- **Quem usa:** Nosso sistema ✅

### 6.3 Modelo de preços Twilio/Meta — 2026

**Modelo atual:** por mensagem (não mais por conversa, mudança de 2025)

| Tipo de mensagem | Twilio | Meta | Total |
|---|---|---|---|
| Freeform — dentro da janela 24h | US$ 0,005 | GRÁTIS | US$ 0,005 |
| Template Utilitário — dentro da janela 24h | US$ 0,005 | GRÁTIS | US$ 0,005 |
| Template Utilitário — fora da janela | US$ 0,005 | US$ 0,0034 | US$ 0,0084 |
| Template Marketing | US$ 0,005 | GRÁTIS | US$ 0,005 |
| Template Autenticação | US$ 0,005 | US$ 0,0034 | US$ 0,0084 |

**Janela de serviço:** cliente inicia → 24h de mensagens freeform gratuitas (Meta). Apenas Twilio cobra US$ 0,005/msg.

### 6.4 Simulação de custo — salão com 200 agendamentos/mês

| Cenário | Mensagens | Custo/mês |
|---|---|---|
| Só notificações (confirmação + lembrete) | 400 msgs utilitárias | ~US$ 3,36 ≈ R$ 17 |
| Chatbot booking (cliente inicia) | 2.000 msgs freeform | ~US$ 10 ≈ R$ 50 |
| Campanhas marketing (300 msgs) | 300 msgs marketing | ~US$ 1,50 ≈ R$ 8 |
| **Total (B + C + campanhas)** | **~2.700 msgs** | **~US$ 15 ≈ R$ 75** |

### 6.5 Estratégia de quota por plano

| Plano | Quota msgs/mês | Custo Twilio estimado | Preço plano | Margem WhatsApp |
|---|---|---|---|---|
| Starter | 200 (só notificações) | ~R$ 17 | R$ 79/mês | R$ 62 |
| Pro | 800 (notif + chatbot básico) | ~R$ 50 | R$ 179/mês | R$ 129 |
| Enterprise | 3.000 (tudo + campanhas) | ~R$ 80 | R$ 349/mês | R$ 269 |

### 6.6 Capacidades Twilio ainda não implementadas (roadmap)

| Capacidade | Produto Twilio | Fase |
|---|---|---|
| Chatbot de booking conversacional | Twilio Studio | Fase 3 |
| Inbox multi-agente para atendentes | Twilio Conversations | Fase 3 |
| SMS fallback automático | Programmable SMS | Fase 2 |
| Campanhas de marketing em massa | Messaging API (bulk) | Fase 2 |
| Analytics de delivery e leitura | Insights Dashboard | Fase 2 |

---

## 7. O que já existe no sistema (não reinventar)

Implementado no `src/domains/notifications/providers/whatsapp.provider.ts`:
- Twilio SDK integrado com Account SID + Auth Token
- 5 templates configurados: confirmação, confirmado, lembrete, cancelamento, **no-show**
- Retry automático (3 tentativas com backoff de 1s)
- Webhook de status de entrega (`/api/webhooks/twilio/status`)
- Quota mensal por tenant com controle por plano (`whatsapp-quota.service.ts`)
- Personalização de template por tenant (`whatsappTemplateConfig` JSON no Tenant)
- Timezone-aware — formata datas no fuso horário do salão
- URL pública já referenciada: `APP_URL/agendar/[slug]`

---

*Documento gerado em 2026-05-29 | Próxima ação: spec da página de agendamento público*
