# Agendê — Estratégia de Produto e Roadmap (2026-07-19)

> Documento de estratégia consolidado. Serve como **base factual** para o
> redesign de produto do Agendê — o que já entregamos, o que ainda é promessa,
> onde estão os diferenciais defensáveis e em que ordem construir.
>
> **Não é um plano de implementação.** Cada iniciativa aqui vira código só depois
> de passar por `agent-onboarding` → brief aprovado → pipeline de skills
> (ver §12 e §13). Este `.md` é o insumo desses onboardings — mesmo papel que
> `docs/landing-page-auditoria-2026-07.md` cumpre para o redesign da landing.

---

## 1. Tese central

O Agendê tem um **núcleo operacional mais sólido que a média do mercado
brasileiro** (agenda, vitrine pública, financeiro, CRM com anamnese, portal do
cliente, estoque, branding, PWA, motor de notificações da equipe). Mas hoje ele:

1. **Vende aspiração que ainda não entrega** — o posicionamento é
   "AI-Augmented Business Operating System", e não há uma linha de IA rodando;
   e alguns itens de **planos pagos são placeholders** (multi-unidade, chatbot,
   campanhas).
2. **Deixa na mesa as duas alavancas que os líderes usam** — pagamento/sinal
   online do cliente e recorrência (clube de assinatura do salão).

O diferencial defensável mais provável: **ser o primeiro com IA *útil* de verdade
numa cunha bem escolhida (clínica ou barbearia), com pagamento online como motor
de receita por baixo** — construído em ondas, sem quebrar o que já funciona.

---

## 2. Diagnóstico: existe × placeholder × não existe

### 2.1 Entrega de verdade (núcleo sólido)
IAM/RBAC dinâmico, CRM, Scheduling, Financial (POS interno), Notifications
(motor da equipe + WhatsApp via Evolution API), Dashboard, Reports (4 páginas,
filtro por profissional), Settings, Serviços/Pacotes/Promoções, Produtos/Estoque,
Branding, Billing (Stripe para a assinatura do tenant), Auth/Onboarding, Vitrine
pública, Portal do cliente, Admin/backoffice, PWA.

### 2.2 Vendido mas **não** existe como funcionalidade (risco comercial/jurídico)

| Promessa | Onde aparece | Realidade |
|---|---|---|
| **Multi-unidade** ("até 3 unidades"/ilimitado) | Planos Pro/Enterprise | ❌ Não há model `Unit`. Placeholder de gating. |
| **WhatsApp premium: chatbot, aniversário** | Plano Pro | ❌ Placeholder — gate trava, sem motor. |
| **Campanhas de reengajamento** | Plano/roadmap | ❌ Automation é `stub` (Fase 2). |
| **"Fidelização" (+30%)** | Hero de features (landing) | ⚠️ Fino — hoje é badge VIP + favoritos, não programa de fidelidade/cashback/saldo de sessões. |
| **"Anti-falta -40%"** | Hero de features (landing) | ⚠️ Só lembretes/`minAdvanceMinutes`. Falta a arma real: sinal/pré-pagamento. |
| Rotas `/termos` e `/privacidade` | Footer da landing | ❌ Links mortos — e são exigência de LGPD + checkout Stripe. |

> **Regra de ouro desta estratégia:** antes de construir feature nova, resolver a
> honestidade da oferta (Onda 0). Vender o que não existe em tier pago é exposição
> a estorno, reclamação e churn de má-fé.

---

## 3. Tensão de posicionamento — "AI OS" é a promessa certa?

"Business Operating System AI-Augmented" hoje é **aspiração, não descrição**. A
cliente-alvo (dona de salão, barbeiro) compra resolução de dor concreta, não
categoria de software — a auditoria de landing mostra que a headline atual vende
"agenda com WhatsApp", o oposto do pretendido.

**Recomendação:** não jogar fora o posicionamento — **atrasá-lo**. "Operating
System" é o destino, o que se constrói por baixo. Ele só volta ao discurso de
venda quando houver **uma** prova de IA rodando (por isso o Copiloto e o
reengajamento importam como narrativa, não só como feature). Vender OS antes de
ter IA = parecer genérico *e* pretensioso ao mesmo tempo.

---

## 4. Decisão em aberto #1 — cunha vertical ou horizontal?

Hoje o Agendê atende quatro segmentos com o mesmo produto. Eles têm workflows
opostos — atender todos é confortável comercialmente e fraco em diferenciação.

| Segmento | Dor dominante | Feature que decide a compra | Referência de mercado |
|---|---|---|---|
| **Barbearia** | Frequência alta, ticket baixo, retenção | Clube de assinatura (corte mensal), comanda rápida, comissão do barbeiro | AppBarber |
| **Salão (cabelo/unha)** | Serviço longo, dependente do profissional | Encadeamento de serviços, remarcação, anamnese capilar | Trinks / Avec |
| **Clínica de estética** | Tratamento em série, ticket/LTV alto | Pacote de sessões com saldo + evolução com foto antes/depois + prontuário/consentimento | Belle / Clinicorp |
| **Estúdio (cílios, sobrancelha, tattoo)** | No-show alto, Instagram como funil | Sinal/pré-pagamento + portfólio visual | Booksy |

**Ativos que o Agendê já tem apontam para dois lados:** anamnese digital robusta,
imagens com enquadramento e `ServicePackage` puxam para **clínica**; comissão por
profissional, vitrine e recorrência puxam para **barbearia**.

**Palpite (não decisão):** clínica de estética é o alvo de maior LTV, menos bem
servido, e onde a IA rende mais (evolução de tratamento, anamnese→recomendação).
**Importante:** as iniciativas das Ondas 0 e 1 abaixo são valiosas
*independente* dessa escolha — não precisamos travar o roadmap nela.

---

## 5. Teardown competitivo

**Onde o Agendê já ganha:**
- Vitrine pública viva por tenant (branding real, selo "mais procurado" por
  volume, favoritos persistidos) — mais polida que a média BR.
- Motor de notificações da equipe (dispatcher por `eventType`, quiet hours no
  fuso do tenant, anti-fadiga) — engenharia acima do padrão do setor.
- Multi-tenancy + RBAC dinâmico consolidados (ADR-016).

**Onde perde (todos os líderes têm, o Agendê não):**
1. **Pagamento online do cliente + sinal anti-falta** (Fresha/Booksy). Maior
   lacuna de receita. Hoje só há checkout interno (POS).
2. **Clube de assinatura do salão / membership** (AppBarber/Vagaro).
3. **Descoberta/marketplace** (Trinks/Booksy) — vitrine é uma ilha.
4. **Lista de espera (waitlist)** — inexistente; alto valor para profissional
   lotado.
5. **Coleta de avaliação → Google** — há o selo de nota (gated por API key),
   falta o coletor pós-atendimento.

**Campo aberto (ninguém ganhou ainda):** IA útil. É a aposta de diferenciação,
não de paridade.

---

## 6. Portfólio de iniciativas

Cada item: **dor → o que já existe → o que falta → risco**. Priorização em §10,
sequência em §11.

### A) IA que fecha um loop de trabalho

- **A1. Copiloto do dono (IA de leitura)** — perguntas de negócio em linguagem
  natural ("quanto faturei essa semana?", "quais VIPs sumiram?").
  *Já existe:* repositories de Reports entregam os números. *Falta:* camada
  pergunta→consulta→resposta. *Risco:* baixo — **a IA nunca calcula dinheiro,
  só chama a query e verbaliza** (valor sempre de `Transaction.netAmount`).
- **A2. Reengajamento inteligente** — quem/quando/qual mensagem para clientes
  inativos. *Já existe:* lista de inativos nos Reports + ação WhatsApp + motor de
  notificações/`pg-boss`. *Falta:* geração da mensagem + agendamento do disparo
  com aprovação humana. *Risco:* médio — humano aprova o envio no início.
- **A3. Anti-falta preditivo** — score de risco de no-show por histórico.
  *Já existe:* status de no-show no `Appointment`. *Falta:* modelo/heurística +
  gatilho (confirmação extra ou sinal só para alto risco). *Risco:* médio.
- **A4. Recepcionista de WhatsApp com IA** — agenda de verdade consultando
  disponibilidade real (o "chatbot premium" placeholder virando produto).
  *Risco:* alto — agente que escreve na agenda erra caro; **só depois de A1/A2**.
- **A5. Briefing diário inteligente** — resumo do dia gerado por IA no job das
  08:00 que já roda. *Risco:* baixo.
- **A6. Gerador de conteúdo de marketing** — legenda de Instagram / promoção da
  semana a partir do catálogo. *Risco:* baixo; alto valor percebido.

### B) Alavancas de negócio (não-IA) que os líderes têm

- **B1. Sinal / pré-pagamento online** — cliente paga sinal para reservar.
  *Já existe:* Stripe integrado (para a assinatura do tenant), `Financial` com
  taxas/estornos. *Falta:* pagamento **do cliente** no ato da reserva na vitrine.
  Anti-falta real + possível take-rate. *Risco:* médio-alto (fluxo de pagamento).
- **B2. Clube de assinatura do salão (membership)** — cliente paga mensalidade
  ao salão. *Falta:* model de recorrência + rake. *Risco:* alto; muda o modelo
  de receita.
- **B3. Fidelidade/cashback + saldo de sessões** — `ServicePackage` vira saldo
  ("10 sessões, restam 4") e/ou pontos/cashback. Preenche a promessa
  "Fidelização". *Risco:* médio.
- **B4. Coleta de avaliação → Google** — nota pós-atendimento empurrada ao Google
  Business. *Risco:* baixo-médio.

### C) Otimização do dia a dia do profissional

- **C1. Lista de espera (waitlist)** — cliente "avisa quando abrir vaga"; agenda
  que se preenche sozinha. *Risco:* baixo. **Melhor custo-benefício puro produto.**
- **C2. Preenchimento inteligente de buraco** — "sua sexta 15h vagou, essas 5
  clientes costumam agendar nesse horário". Usa histórico + C1.
- **C3. Notas/preferências do cliente** — química, restrições, "não gosta de
  franja". Encaixa na anamnese. Ouro de retenção.
- **C4. Ganhos do profissional em tempo real (mobile)** — comissão acumulando no
  dia. *Já existe:* comissão por profissional. *Falta:* visão pessoal mobile.
- **C5. Comanda/atendimento rápido** — fechar atendimento em 2 toques
  (especialmente barbearia).

### D) Aposta de plataforma (longo prazo)

- **D1. Marketplace / descoberta cross-tenant** — diretório onde a cliente acha
  profissionais perto dela. Efeito de rede: de "ferramenta" para "plataforma".
  *Risco:* muito alto; exige densidade de oferta que ainda não há.

---

## 7. IA integrada — roadmap em fases e guardrails

**Princípio:** IA vira diferencial quando fecha um loop de trabalho, não quando é
um chat colado na tela. Ordem por risco crescente:

- **Fase 1 — IA de leitura** (baixo risco): A1 (Copiloto), A5 (Briefing).
- **Fase 2 — IA de sugestão** (humano aprova): A2 (Reengajamento), A3 (Anti-falta).
- **Fase 3 — IA que age** (só após confiança): A4 (Recepcionista WhatsApp).

**Guardrails transversais — decidir ANTES de qualquer linha de IA:**
- **Sem alucinação de número:** a IA nunca calcula dinheiro/métrica; ela chama a
  query/repository existente e apenas verbaliza. Valor financeiro sempre de
  `Transaction.netAmount`.
- **Custo do LLM entra no desenho de plano** (ver §8) — IA como add-on/tier ou
  créditos, senão a margem evapora.
- **LGPD / dado sensível:** anamnese de clínica é dado de saúde. IA que toque
  nisso exige base legal, consentimento e processamento que não treine modelo.
- **Fuso do tenant:** toda IA que fale de "hoje/essa semana" herda o fuso do
  tenant (já apanhamos disso: o resumo diário era fixo em UTC).
- **Encaixe técnico:** Claude API (Sonnet no grosso, Opus no copiloto analítico);
  dimensionar modelo/custo por interação no brief de cada fase.

---

## 8. Modelo de assinatura e monetização

Hoje os planos são **por assento/volume** (profissionais + agend./mês) — válido,
mas de teto baixo e é onde moram os placeholders perigosos. Três motores
adicionais, todos compatíveis com o que já existe:

1. **Take-rate de pagamentos** — processar o sinal/pagamento do cliente e ficar
   com um % (modelo Fresha). Cresce com o uso do cliente, não com assentos —
   teto muito maior.
2. **Rake sobre membership** — % da recorrência que o salão vende à cliente dele.
   Alinha o crescimento do Agendê ao sucesso do cliente.
3. **IA como add-on ou tier** — resolve o custo do LLM e cria motivo real para o
   tier alto.

Refinamentos independentes:
- **Toggle mensal/anual com desconto** — verificar se `PricingToggle` já faz de
  verdade ou é só estético. Anual reduz churn e antecipa caixa.
- **Consertar a escada de valor** — o "popular" (Pro) hoje carrega 3 features
  fantasma; precisa de motivo real (IA / relatórios avançados, que são reais).

---

## 9. Matriz de priorização

Ordem por **(impacto) × (esforço, dado o que já existe) × (fosso competitivo)**:

| Iniciativa | Impacto | Esforço | Fosso | Leitura |
|---|---|---|---|---|
| Honestidade da oferta (Onda 0) | Alto (risco) | Baixo | — | **Faça primeiro, não é opcional** |
| C1. Lista de espera | Alto | Baixo | Médio | Melhor custo-benefício "puro produto" |
| B1. Sinal/pré-pagamento | Alto | Médio-alto | Alto | Destrava anti-falta *e* receita |
| A1. Copiloto do dono | Alto (narrativa) | Médio | **Alto** | Materializa o posicionamento; dá a demo |
| B2. Clube de assinatura | Alto (retenção) | Alto | Alto | Muda modelo de receita; pesado |
| A2. Reengajamento inteligente | Médio-alto | Médio | Alto | Vira a Fase 2 (Automation) com IA |
| B3. Fidelidade/saldo de sessões | Médio | Médio | Médio | Preenche "Fidelização" fraca |
| B4. Avaliação → Google | Médio | Baixo-médio | Baixo | Rápido, reforça vitrine |
| C4. Ganhos do profissional (mobile) | Médio | Baixo | Baixo | Motivação do profissional |
| D1. Marketplace | Muito alto (teto) | Muito alto | Muito alto | Aposta de plataforma, horizonte 3 |

---

## 10. O que NÃO fazer (agora)

- **Multi-unidade** — sem model `Unit`, é reescrita de multi-tenancy dentro do
  tenant; maioria é unidade única. Tirar do plano pago em vez de construir às
  pressas.
- **Precificação dinâmica por demanda** — confunde/irrita a cliente de estética.
  Baixo retorno, alto risco de percepção.
- **Marketplace como primeira aposta** — exige densidade de oferta inexistente.
- **IA que age antes da IA que lê** — inverter a ordem mina a confiança na linha
  de IA inteira no primeiro erro caro.

---

## 11. Roadmap sequenciado (ondas)

> Cada onda entrega valor sozinha. Só começa a próxima com a anterior mergeada na
> `main` e estável. Uma iniciativa por vez dentro da onda.

### Onda 0 — Higiene e confiança (pré-requisito de tudo)
- Alinhar oferta: remover/rotular como "em breve" os placeholders (multi_unit,
  whatsapp_premium/chatbot, campaigns) nos planos pagos.
- Publicar Termos de Uso + Política de Privacidade reais (LGPD + Stripe).
- Consertar `/planos` (volta para `/`, nome "Agendê" no header) e links mortos.

### Onda 1 — Ganhos de produto (alto valor, baixo-médio esforço)
- C1. Lista de espera (waitlist).
- B4. Coleta de avaliação → Google.
- C4. Ganhos do profissional em tempo real (mobile).
- C3. Notas/preferências do cliente.

### Onda 2 — Motor de receita + primeira IA
- B1. Sinal / pré-pagamento online.
- A1. Copiloto do dono (IA fase 1) + A5. Briefing diário.

### Onda 3 — Retenção e automação inteligente
- B2. Clube de assinatura (membership) + B3. Fidelidade/saldo de sessões.
- A2. Reengajamento inteligente (IA fase 2) — transforma o Automation stub.

### Horizonte (depois)
- A4. Recepcionista de WhatsApp com IA (fase 3).
- D1. Marketplace / descoberta.

---

## 12. Como cada iniciativa vira desenvolvimento (o ecossistema de agents)

O projeto já tem o pipeline. Nada aqui pula etapa:

```
Ideia (item deste doc)
      ↓
agent-onboarding   ← explora intenção, propõe abordagens, produz o brief
      ↓
orchestrator       ← executa o brief com o pipeline correto
      ↓
[database] → [backend] → [frontend] + [agent-mobile] → [testing + security] → [review] → [documentation]
      ↓
PR para main → merge
```

- **Arquiteto/database:** modela schema novo (migration **aditiva**), define
  contrato de repository e eventos.
- **Backend:** service com regra de negócio + Zod em `schemas.ts` + erros
  tipados; publica eventos.
- **Frontend + agent-mobile:** UI mobile-first com loading/error/empty; checklist
  de scroll em Dialog; mobile é obrigatório.
- **Testing + security (paralelos):** cobertura de service/repository/route;
  Security Agent sem item 🔴 crítico.
- **Review (gate de build) → documentation → PR.**

**Uma iniciativa por brief.** Não dispara todos os agents de uma vez: a Onda 0
sozinha são 3 briefs pequenos e independentes.

---

## 13. Checklist "não quebrar o sistema" (obrigatório em todo brief)

Ancorado no que já custou incidente em produção neste projeto:

- **Migration sempre aditiva.** Nada de drop de coluna/tabela sem passo manual
  aprovado. Migration destrutiva = pausa e confirmação.
- **Vercel NÃO roda migration no build.** Migration precisa de aplicação manual
  (`prisma migrate deploy`) em janela combinada, com o backfill logo em seguida
  quando houver. Registrar o runbook no ADR correspondente.
- **NUNCA acoplar coluna nova à query de sessão `/me`.** Se a coluna nova entrar
  no `SELECT` da sessão e a migration atrasar, vira **logout global** (P2022 já
  aconteceu 2×). Campo novo fica fora do `/me`.
- **`tenantId` em todo model novo**, filtro de tenant em toda query do
  repository, `tenantId` sempre do token (nunca do body/URL), `@@index([tenantId])`.
- **Feature gate real vs. placeholder** — se a feature entra num tier pago, o
  gate tem que travar de verdade (ver memória `planos-gating-fase2`); não repetir
  o padrão dos placeholders.
- **Dual-write / compatibilidade retroativa** — dados legados não podem quebrar
  (padrão já usado no motor de notificações e no CPF/documento de tenant legado).
- **Fuso do tenant** em tudo que calcula "hoje/semana" (bug recorrente).
- **`npx tsc --noEmit` = 0 erros** e **`npx vitest run` verde** antes do PR.
- **Nenhuma entrega é concluída sem PR mergeada na `main`.**

---

## 14. Decisões em aberto (para refinar com o usuário antes de cada onda)

1. **Cunha vertical vs. horizontal** (§4) — não bloqueia Ondas 0/1, mas orienta
   Ondas 2/3 (clínica → saldo de sessões/evolução; barbearia → membership/comanda).
2. **Gateway de pagamento do cliente** (§6 B1) — Stripe (já integrado) vs.
   provedor BR com Pix nativo. Pix é quase obrigatório para sinal no Brasil.
3. **Modelo de monetização de IA** (§8) — add-on, tier ou créditos.
4. **`PricingToggle` mensal/anual** — já funcional ou só estético? (verificar).

---

## 15. Próximos passos

1. Aprovar este documento como base factual.
2. Rodar `agent-onboarding` no **primeiro item da Onda 0** (alinhamento da oferta
   / Termos / `/planos`) para produzir o primeiro brief real e validar o fluxo
   de ponta a ponta.
3. A cada onda concluída (mergeada e estável), reabrir este doc, atualizar o
   status das iniciativas e refinar a priorização das seguintes.

> Conexão com o restante da documentação: este doc conversa com
> `docs/landing-page-auditoria-2026-07.md` (a Onda 0 resolve vários pontos do §5
> daquela auditoria) e com `docs/decisions.md` (cada iniciativa que mexer em
> schema/pagamento/IA deve gerar um ADR).
