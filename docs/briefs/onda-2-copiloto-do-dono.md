# Brief — Copiloto do dono (IA de leitura) — Onda 2, 1º diferencial

> **Status:** ⏸️ ADIADO por custo (2026-07-20). Brief 100% aprovado e pronto,
> mas a API da Claude exige crédito mínimo pré-pago e o usuário não quer gastar
> neste momento. **Retomar assim que houver apetite para pôr créditos de API** —
> nada a redecidir, é só provisionar `ANTHROPIC_API_KEY` e executar este brief.
> Origem: `docs/estrategia-produto-2026-07.md` §6 A1 + §7 (IA fase 1).
> **Decisões:** modelo `claude-sonnet-5` (pago, sem treinar nos dados — LGPD);
> gating Enterprise por padrão, configurável pelo admin (capability `copilot`).
> **Bloqueio de runtime:** `ANTHROPIC_API_KEY` no Vercel (o usuário provisiona).

## Feature
Assistente que responde perguntas de negócio em linguagem natural sobre os dados
do próprio tenant — "quanto faturei essa semana vs. a passada?", "quais VIPs
sumiram há mais de 60 dias?", "qual profissional tem mais buraco na agenda?" —
consultando os repositories/relatórios que já existem e verbalizando o resultado.
**Somente leitura.** Materializa o posicionamento "AI-augmented" e dá a demo que
a landing não tem.

## Motivação
Diferencial de narrativa que nenhum concorrente BR tem; útil para todo tenant
(não só o lotado); reaproveita dados e repositories já prontos.

## Usuário principal
Dono/gestor do tenant (desktop-first, mas acessível no mobile).

## Arquitetura — decisão de segurança inegociável
- **Tool-calling, NUNCA text-to-SQL.** A IA escolhe entre ferramentas tipadas
  (Zod) que mapeiam para services/repositories existentes; o backend executa com
  `tenantId` sempre da sessão (nunca do modelo/prompt). A IA só verbaliza o
  resultado — **nunca calcula dinheiro/métrica**. Valor financeiro sempre de
  `Transaction.netAmount` via query real ([[feedback-layout-queries]]).
- **Claude API via `@anthropic-ai/sdk`** (projeto é TS): `client.beta.messages.toolRunner`
  + `betaZodTool` (Zod já é padrão do projeto). Streaming para a UX de chat;
  adaptive thinking. Requer `ANTHROPIC_API_KEY` no Vercel (custo — ver decisões).
- **Fuso do tenant** em toda ferramenta que fale de "hoje/semana" (bug recorrente).
- **Sem ações** no MVP (não cria/cancela/edita nada) — read-only elimina o risco
  de a IA escrever na agenda. Ações ficam para a fase 3.

## O que será feito (MVP)
1. **Camada de ferramentas (backend)** — conjunto inicial de tools read-only,
   cada uma um wrapper fino sobre service/repository já existente, tenant-scoped:
   - faturamento por período + comparativo (Reports/analytics);
   - clientes inativos / VIPs sumidos (já existe em Reports);
   - agendamentos/ocupação por profissional; ticket médio; top serviços/pacotes.
2. **Serviço de copiloto** — monta o Tool Runner, injeta `tenantId`/fuso, system
   prompt com as regras (só verbaliza, não inventa número, responde em PT-BR),
   e faz o streaming da resposta.
3. **API Route** `POST /api/copilot` (ou similar) — `getSessionContext()`, valida
   input com Zod, exige a permissão/plano definidos, faz streaming.
4. **UI de chat (frontend + agent-mobile)** — painel de chat no dashboard;
   **mockup aprovado antes do código React** ([[feedback-mockup-before-code]]).
   Estados loading/empty/error; sugestões de perguntas iniciais.
5. **Guardrails de custo** — limite de uso por tenant/período (evita abuso),
   logging estruturado das chamadas (sem `console.log`).
6. **Testes** — tools (mapeamento correto + escopo de tenant), serviço (o Runner
   chama a tool certa e não inventa número), rota (auth/gate/stream).

## O que NÃO está no escopo (MVP)
- **Ações** (agendar, cancelar, enviar mensagem) — read-only apenas.
- **Recepcionista de WhatsApp / chatbot do cliente** (fase 3, feature separada).
- **Perguntas fora do catálogo de ferramentas** — se não há tool, a IA diz que
  não sabe responder (não inventa).
- Gráficos gerados pela IA (só texto + talvez números destacados) no MVP.

## Domínios afetados
Novo módulo (ex.: `copilot`) que orquestra; consome Reports/analytics, financial,
scheduling, crm via as tools; frontend (dashboard) + agent-mobile.

## Restrição de plano (DECIDIDO)
**Enterprise por padrão, configurável pelo admin.** Implementar como capability
nova gateável no `capability-registry` (ex.: `copilot`, `status:'ga'`), ligada só
no ENTERPRISE no seed `BILLING_FEATURES`; o admin liga/desliga por plano no editor
de planos (mesmo padrão das demais capabilities). Gate real via `featureGuard`.

## Skills do Orchestrator
Arquiteto (integração externa de IA — o onboarding manda acionar) → backend
(tools + serviço + rota) → frontend + agent-mobile (chat, com mockup antes) →
testing + security → review → docs.

## Complexidade estimada
Complexo (>3h) — integração externa nova + UI de chat + camada de ferramentas.

## Dependências
- `ANTHROPIC_API_KEY` provisionada (decisão de custo do usuário).
- Repositories de Reports/analytics já existem (confirmado).

## Decisões pendentes (travar antes de implementar)
1. **Provisionar `ANTHROPIC_API_KEY`** e assumir o custo por consulta (o projeto
   roda com orçamento enxuto — ADR-001). Sem isso, não há como construir.
2. **Modelo:** Opus 4.8 (padrão, melhor) vs **Sonnet 5** (metade do custo, ótimo
   em tool-use) — recomendo começar em Sonnet 5 pelo custo, subir se faltar
   qualidade.
3. **Gating:** Pro+ (recomendado) vs todos os planos vs add-on por créditos.
4. **Escopo inicial de perguntas** (quais tools entram no MVP) — a lista acima é
   proposta; confirmar/enxugar.

## Guardrails "não quebrar"
- `tenantId` sempre da sessão; toda tool filtra tenant.
- IA nunca calcula número — só chama tool e verbaliza (sem text-to-SQL).
- Fuso do tenant em tudo que é temporal.
- Limite de uso + logging estruturado (custo sob controle).
- `tsc` 0 + `vitest` verde; PR para `main`.
