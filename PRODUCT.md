# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Donos/gestoras de negócios de estética e sua equipe de profissionais, mais os
clientes finais desses negócios.

- **Foco primário de produto:** salão de beleza (cabelo/unha) — serviço mais
  longo, dependente do profissional, com encadeamento de serviços e
  remarcação como dores centrais.
- **Segmentos secundários possíveis, já atendidos pelo mesmo produto hoje:**
  barbearia, clínica de estética, estúdio (cílios/sobrancelha/tattoo). Decisão
  confirmada em 2026-08-01: salão é o foco, os outros continuam servidos —
  não travar o roadmap na escolha de um único segmento.
- **Dono/gestora:** opera majoritariamente em desktop — configura o negócio,
  equipe, cargos, catálogo, financeiro e relatórios.
- **Equipe/profissionais:** usam agenda e comanda no dia a dia do
  atendimento, majoritariamente em mobile.
- **Cliente final:** agenda, confirma, recebe notificações e interage via
  vitrine pública + portal do cliente. Mais de 70% do tráfego de cliente
  final é mobile.

## Product Purpose

SaaS operacional multi-tenant para negócios de estética. Substitui planilha,
telefone tocando e agenda de papel por uma plataforma integrada: agenda,
CRM com anamnese, financeiro, notificações via WhatsApp, vitrine pública e
portal do cliente num só produto. Sucesso = o negócio opera com menos
fricção (menos falta, mais agendamento online, financeiro em tempo real,
menos trabalho manual da dona/gestora).

Já está em produção real com tenants ativos — não é um projeto greenfield.
Mudanças de schema seguem protocolo próprio de migration manual em produção
(ver CLAUDE.md).

## Positioning

Posicionamento de destino: **"Vertical AI-Augmented Business Operating
System"**. Decisão confirmada em 2026-08-01: **esse discurso fica em espera**
até existir pelo menos uma funcionalidade de IA real rodando (Fase 1 do
roadmap de IA — Copiloto do dono e/ou Briefing diário, ver
`docs/estrategia-produto-2026-07.md` §7). Até lá, não usar a narrativa de "AI
Operating System" como se already fosse descrição — trataria como aspiração
que ainda não existe.

Mecanismo defensável hoje, enquanto a IA não chega: núcleo operacional mais
completo e integrado que a média do mercado brasileiro — agenda, CRM,
financeiro, notificações e vitrine pública num só produto multi-tenant com
RBAC dinâmico, não um conjunto de ferramentas coladas.

## Operating Context

- Multi-tenant: cada negócio é um tenant isolado (`tenantId` em todo dado de
  negócio).
- Dono/gestora configura o negócio em desktop; equipe opera o atendimento
  diário em mobile; cliente final interage por mobile via vitrine pública,
  portal do cliente e WhatsApp.
- Anamnese de clínica é dado de saúde sob LGPD — qualquer IA ou feature que
  toque nisso exige base legal e consentimento, nunca treinar modelo com
  esse dado.
- Produto já em produção — features novas convivem com dados reais de
  tenants existentes; migrations são sempre aditivas quando possível.

## Capabilities and Constraints

- Núcleo entregue de verdade (não placeholder): IAM/RBAC dinâmico, CRM,
  Scheduling, Financial, Notifications (motor da equipe + WhatsApp via
  Evolution API + motor de mensagens ao cliente), Dashboard, Reports,
  Settings, Serviços/Pacotes/Promoções, Produtos/Estoque, Branding, Billing
  (Stripe para a assinatura do tenant), Auth/Onboarding, Vitrine pública,
  Portal do cliente, Admin/backoffice, PWA. Status detalhado por domínio:
  ver tabela em CLAUDE.md.
- **Vendido mas ainda não existe como funcionalidade** (não tratar como
  capacidade real em nenhum trabalho futuro até ser construído de verdade):
  multi-unidade (não há model `Unit`), WhatsApp premium (chatbot,
  aniversário automático), campanhas de reengajamento (Automation é stub).
- Automation (reengajamento, campanhas) é Fase 2 — stub hoje.
- IA: nenhuma linha rodando ainda. Quando existir, princípio fixo do
  roadmap: IA nunca calcula/fabrica valor financeiro ou métrica — sempre
  chama o repository/query existente e verbaliza; valor financeiro sempre
  de `Transaction.netAmount`.
- Terminologia: "tenant" é termo interno/técnico; usuário final vê "negócio"
  (dono/gestora) ou o nome do próprio salão/clínica (cliente final).

## Brand Commitments

Nome do produto: **Agendê**. Cada tenant tem identidade visual própria
(branding customizável — cores/logo), aplicada à vitrine pública e ao
portal do cliente daquele negócio; isso não substitui a marca do Agendê em
si nas superfícies do próprio produto (landing, painel administrativo,
backoffice).

## Evidence on Hand

- **Não existem depoimentos, estudos de caso ou métricas reais publicados
  ainda.** Os números da proof bar da landing atual ("+1.200 salões
  ativos", "98% satisfação", "-40% menos faltas") e os 3 depoimentos
  exibidos vêm de dados semeados (`LandingMetric`/`LandingTestimonial`,
  seed), não de clientes reais — trabalho futuro não deve citá-los como
  prova real nem inventar evidência nova para substituí-los.
- Produto está de fato em produção com tenants reais operando, mas sem
  métricas agregadas reais documentadas até o momento.

## Product Principles

1. **Foco de produto é salão de beleza**, com barbearia/clínica/estúdio como
   segmentos secundários já servidos pelo mesmo produto — decisões de
   design priorizam o workflow de salão quando houver conflito, sem excluir
   os demais.
2. **Mobile-first para quem não é dono/gestora** — equipe e cliente final
   vivem no mobile; desktop-first só é aceitável em telas majoritariamente
   administrativas.
3. **Honestidade da oferta antes de expansão** — nunca sugerir, vender ou
   projetar visualmente uma capacidade que ainda é placeholder
   (multi-unidade, chatbot IA, campanhas) como se já existisse.
4. **"AI-Augmented Business Operating System" é destino, não descrição
   atual** — o discurso volta à superfície de venda só quando houver IA
   real rodando; até lá, o produto se apresenta pelo que já entrega de
   verdade.
5. **Produto já é produção real, não greenfield** — todo trabalho novo
   convive com tenants e dados existentes; nunca tratar o projeto como se
   estivesse partindo do zero.

## Accessibility & Inclusion

Best-effort — sem exigência formal de WCAG confirmada. Mobile-first e
usabilidade básica cobrem a necessidade real hoje; revisitar se surgir
necessidade concreta.
