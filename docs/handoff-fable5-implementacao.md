# Handoff de implementação — Claude Fable 5 no Agendê

> **Para o Fable 5 (você): leia este arquivo inteiro primeiro, uma vez.** Ele
> existe para você NÃO gastar créditos explorando o repositório. Tudo que você
> precisa para começar a produzir está aqui e no `CLAUDE.md`.

---

## 0. Contexto de custo — leia antes de tudo

Você está executando com um **orçamento fixo de créditos promocionais: ~R$538
(≈ US$100)**. Fable 5 custa ~US$10/milhão de tokens de entrada e **US$50/milhão
de saída** — cada token que você escreve custa. O objetivo é **entregar melhorias
significativas e mergeadas SEM estourar esse orçamento**. Trabalhe com a
disciplina de um sênior consciente de custo, não de um agente que explora à
vontade.

Regras de eficiência (todas economizam créditos e mantêm qualidade):

- **Não varra o código amplamente.** As convenções, caminhos e estado estão
  neste doc + `CLAUDE.md` + `docs/estrategia-produto-2026-07.md`. Leia esses três,
  depois vá direto aos arquivos citados. Prefira ler arquivos específicos a
  fazer grep/glob genérico repetido.
- **Effort baixo/médio no rotineiro.** Use `low`/`medium` para a maior parte do
  trabalho (transcrição, UI simples, CRUD). Reserve `high`/`xhigh` só para lógica
  de negócio sensível (pagamento, segurança) ou decisão de arquitetura.
- **Não superengenheire.** Nada de abstrações, helpers, feature flags ou
  tratamento de erro para casos que não acontecem, além do que a tarefa pede.
  Faça a coisa mais simples que funciona bem. Cada linha extra é token de saída.
- **Aja quando tiver contexto suficiente.** Não re-derive fatos já dados aqui,
  não narre opções que não vai seguir, não peça confirmação para ações
  reversíveis dentro do escopo. Recomende, não faça survey exaustivo.
- **Uma feature por PR pequeno e mergeável.** Não empilhe várias features numa
  branch — dificulta revisão e desperdiça retrabalho se algo volta.
- **Verifique barato.** `npx tsc --noEmit` + `npx vitest run <arquivos afetados>`
  a cada passo. Rode a suíte **completa** só uma vez, antes de abrir o PR.
- **Fundamente afirmações de progresso.** Só diga "feito/passando" com a saída do
  comando na mão. Se um teste falha, diga com a saída.

---

## 1. Objetivo (o porquê — mantenha isto em mente em cada decisão)

Transformar o Agendê numa ferramenta que **ajuda o cliente de verdade**, com
**excelência, segurança e praticidade**, e **melhor que os concorrentes**
(Trinks, Booksy, AppBarber, Avec, Belle). Toda melhoria que você fizer deve mover
pelo menos um destes eixos: *ajuda o cliente / segurança / praticidade /
diferencial competitivo*. Se um item não move nenhum, não faça.

---

## 2. Como trabalhar neste projeto (pipeline + memória)

- Siga o pipeline do projeto (descrito no `CLAUDE.md`): para cada item —
  brainstorm curto **só se ambíguo** → **mockup estático/ASCII aprovado antes do
  React** quando a feature tem UI (o usuário exige isso) → branch `feat/` →
  database? → backend → frontend + mobile → testes → security → PR para `main`.
  Não gaste créditos em cerimônia: o valor está no código entregue e verificado.
- **Mantenha um arquivo de progresso `docs/fable5-progress.md`**: uma linha por
  feature (feita/em andamento/pendência), aprendizados não óbvios, e sua
  estimativa de créditos gastos. Consulte-o entre features e antes de decidir
  parar. Uma lição por linha; não duplique o que o repo já registra.
- Tudo em **Português do Brasil** (código, comentários, commits, UI, PR).

---

## 3. Guardrails inegociáveis (quebrar = retrabalho = créditos perdidos)

Estes já causaram incidente neste projeto. Respeite-os sem exceção:

1. **Multi-tenancy:** `tenantId` em todo model novo; filtro por `tenantId` em
   TODA query do repository; `tenantId` sempre do token/sessão, NUNCA do body/URL;
   `@@index([tenantId])`.
2. **Migrations sempre ADITIVAS.** A Vercel **não roda migration no build** — a
   aplicação em produção é manual e é do usuário, não sua. **NUNCA** adicione
   coluna nova à query de sessão `/me` (isso já derrubou o login inteiro 2×,
   erro P2022).
3. **Camadas:** API Route fina (valida com Zod + `getSessionContext`) → Service
   (regras de negócio) → Repository (filtra tenant) → Prisma. Erros **tipados**
   de `src/shared/errors` (nunca `throw new Error('string')`). Sem `any`, sem
   `as unknown as`.
4. **Domínios não se importam diretamente** — comunicação via `eventBus`.
5. **UI mobile-first:** alvos de toque ≥44px, estados loading/empty/error,
   `DialogContent` sempre com `max-h` + `overflow-y-auto`. Passe pelo checklist
   do `agent-mobile`.
6. **Segurança e integridade:** valide input no boundary; nunca fabrique dado,
   avaliação, ou registro; nunca vaze credencial; nada de dado sensível em log.
7. **Gate por feature:** `tsc --noEmit` = 0 e `vitest` verde. **4 falhas são
   PRÉ-EXISTENTES** e não são suas: `scheduling.service.update` (checkout
   atômico), `appointment-reminder`, `customer-history-client` ×2. Confirme que o
   número não passou de 4; não conte essas como regressão.
8. **Nada é entregue sem PR mergeado na `main`.**

---

## 4. Estado atual — NÃO reconstrua o que já existe

A fonte de verdade é a **tabela de domínios do `CLAUDE.md`** (leia-a). Resumo do
que já está mergeado e funcionando: IAM/RBAC, CRM, Scheduling, Financial,
Notifications (motor da equipe + WhatsApp Evolution), Dashboard, Reports,
Settings, Serviços/Pacotes/Promoções, Produtos/Estoque, Branding, Billing
(Stripe), Auth/Onboarding, Vitrine pública, Portal do cliente, Admin, PWA, e o
**funil de avaliação → Google (#284)** recém-entregue.

**Estado do banco de PRODUÇÃO (atualizado 2026-07-25):**
- ✅ Migration da avaliação (`20260720120000_add_appointment_review`) **aplicada**.
- ✅ Onda 0 (`scripts/prod-onda-0-alinhamento-oferta.sql`) **aplicada** — planos honestos.
- ✅ Gates de relatório (#255) **verificados/curados** (`scripts/prod-checagem-relatorios-255.sql`).
- ⏳ **Único pendente:** `npm run rbac:backfill` — de **baixa urgência** (o app já cobre em
  runtime via fallback do ADR-016) e **do usuário, não sua**. Não bloqueia nada.

**Infra — atenção (não é tarefa sua, mas afeta suas suposições):** o Supabase está no
plano **FREE**, que **pausa por inatividade** (derruba o app até reabrir) e bloqueia a
porta 5432 em algumas redes locais. Em **desenvolvimento**, assuma que o banco local tem
tudo (rode as migrations locais); **nunca** rode migration/scripts contra produção — isso
é responsabilidade do usuário.

**Runbook de produção versionado** (o usuário roda, não você): `scripts/prod-*.sql`
(migration manual da avaliação via SQL Editor, Onda 0, checagem #255) e
`scripts/prod-onda-0-alinhamento-oferta.sql`. Se você criar migration nova, **entregue
também um `.sql` manual equivalente** (o usuário aplica via Supabase SQL Editor quando a
porta 5432 estiver bloqueada) + registre no `_prisma_migrations` com o checksum correto.

---

## 5. Sobre o Copiloto de IA — NÃO gaste estes créditos com ele

Existe um brief pronto do "Copiloto do dono" (IA de leitura) em
`docs/briefs/onda-2-copiloto-do-dono.md`. **Não o construa com estes créditos.**
Motivo: uma feature de IA precisa de gasto de API **contínuo em produção** — não
faz sentido usar créditos promocionais de desenvolvimento para construir algo que
depois não roda de graça. **Priorize melhorias SEM custo de runtime** (as do §6).
O Copiloto fica para quando o usuário decidir bancar o runtime à parte.

---

## 6. Backlog priorizado — execute TOP-DOWN até ~80% do orçamento

Trabalhe de cima para baixo. Cada item traz **objetivo / porquê / onde / feito
quando**, mas **não** o passo-a-passo do código — você projeta a implementação
(prompts prescritivos demais reduzem sua qualidade). Pare e reporte ao estimar
~80% dos créditos gastos.

### Tier 1 — Confiança, segurança e base legal (rápido, alto ROI)

1. **Onda 0 — finalizar oferta e páginas legais.**
   - *Objetivo:* Termos de Uso + Política de Privacidade reais e publicados
     (rotas `/termos` e `/privacidade` hoje são **links mortos**); consertar
     `/planos` (adicionar link de volta para `/`, trocar "Estética SaaS" por
     "Agendê" no header, remover os links mortos do footer).
   - *Porquê:* exigência de LGPD e do checkout Stripe; confiança básica.
   - *Onde:* ver diagnóstico em `docs/landing-page-auditoria-2026-07.md` §5;
     páginas em `src/app/(public)/`.
   - *Feito quando:* rotas existem com conteúdo real, sem link morto, `/planos`
     navegável e com o nome correto.

2. **Consolidar segurança já em andamento (não reconstruir).**
   - *Objetivo:* fechar os itens críticos da auditoria QA. **Existe o PR #215
     aberto** ("checkout atômico, vitrine SSR, billing, índices, a11y") — a falha
     de teste `SchedulingService.markPayment — atomicidade` é justamente esse
     caso.
   - *Porquê:* checkout não-atômico é o crítico nº1 (risco de receita
     inconsistente).
   - *Ação:* **avalie revisar/rebasear/mergear o #215 em vez de reescrever.**
     Só construa do zero o que não estiver coberto lá. Barato e alto impacto.

### Tier 2 — Ajuda o cliente e praticidade (sem custo de runtime)

3. **Ganhos do profissional em tempo real (mobile).**
   - *Objetivo:* o profissional vê a **própria comissão acumulando no dia**, no
     celular.
   - *Porquê:* motivação da equipe; praticidade; nenhum concorrente BR faz bem.
   - *Onde:* reusa comissão por profissional já existente (Financial/Equipe); é
     leitura, mobile-first. Sem migration nova se os dados já existem.
   - *Feito quando:* profissional logado vê o total do dia/período dele.

4. **Notas/preferências do cliente.**
   - *Objetivo:* registrar preferências e restrições na ficha (química usada,
     "não gosta de franja", alergia).
   - *Porquê:* ouro de retenção e qualidade de atendimento.
   - *Onde:* encaixa no CRM/anamnese (`src/domains/crm`). Campo/estrutura aditiva.

5. **Avaliação → disparo ativo (estende o #284).**
   - *Objetivo:* após atendimento concluído, **convidar** o cliente a avaliar por
     **e-mail** (Resend, já usado). WhatsApp fica de fora (é gated/pago).
   - *Porquê:* fecha o loop do funil de avaliação e aumenta o volume de reviews
     no Google (mais descoberta).
   - *Onde:* domínio `src/domains/reviews` + motor de notificações/`pg-boss`
     (`/api/cron/tick`) já existentes. Anti-spam: 1 convite por atendimento.

### Tier 3 — Diferencial competitivo maior (só se sobrar orçamento)

6. **Sinal / pré-pagamento (anti-falta + receita).**
   - *Objetivo:* cliente paga um sinal (Pix nativo BR) para reservar; reduz
     no-show e abre receita.
   - *Porquê:* é *a* feature anti-falta dos líderes (Fresha/Booksy); dor
     universal.
   - *Cuidado:* é grande e exige **decisão de gateway (Pix)** — **brainstorm com
     o usuário antes** de codar. Runtime é taxa por transação (paga por uso, gera
     receita — aceitável). Não comece sem o gateway definido.

7. **Lista de espera (waitlist).**
   - *Objetivo:* cliente entra na fila; ao abrir vaga (cancelamento) é avisado.
   - *Status:* **parqueada** — só ajuda profissional lotado (minoria dos tenants).
     Brief pronto em `docs/briefs/onda-1-lista-de-espera.md`. Só faça se Tiers 1-2
     estiverem completos E sobrar orçamento.

---

## 7. Ao terminar (ou ao atingir ~80% do orçamento)

Reporte com honestidade total:
- o que foi **mergeado** (com número do PR);
- o que ficou pela metade e por quê;
- sua **estimativa de créditos gastos** e quanto resta;
- as pendências de **produção** (migrations a aplicar);
- atualize `docs/fable5-progress.md`, o `CLAUDE.md` (tabela de domínios) e a
  documentação de decisão (`docs/decisions.md`) para o que mexeu em schema.

Não sugira "nova sessão por limite de contexto" nem pare por ansiedade de
contexto — você tem espaço; siga até o orçamento ou a lista acabarem.
