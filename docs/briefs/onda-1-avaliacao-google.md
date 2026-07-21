# Brief — Funil de avaliação → Google (Onda 1, diferencial sem custo)

> **Status:** ✅ IMPLEMENTADO (2026-07-20, branch `feat/avaliacao-google`). Mockup
> aprovado pelo usuário. `tsc` 0, 10 testes de service verdes, suíte 772 passed
> (só as 4 falhas pré-existentes). Falta: aplicar a migration em produção
> (`prisma migrate deploy`) e mergear o PR. Origem: `docs/estrategia-produto-2026-07.md` §6 B4.

## Feature
Após um atendimento concluído, o cliente avalia (1–5). Se a nota é alta, ele é
levado a **avaliar no Google** (link direto, `writereview?placeid=`); se é baixa,
o feedback é captado **em privado** para o dono agir — protege a reputação
pública e dá sinal acionável. Aumenta nota/volume de avaliações no Google →
mais descoberta e confiança → mais cliente novo (ajuda o salão sub-agendado).

> ⚠️ **Nunca posta avaliação no Google automaticamente** (viola política do Google
> e seria avaliação falsa). Só coleta a nota interna e *encaminha* o cliente
> satisfeito ao Google via link. Sem fabricar review.

## Motivação
Reputação é o motor de descoberta que a maioria (salão sub-agendado) precisa;
reaproveita `googlePlaceId` que o Tenant já tem; zero custo externo.

## Usuário principal
Cliente final (avalia, mobile) + dono (lê os feedbacks, acompanha reputação).

## O que já existe (reúso)
- `Tenant.googleBusinessUrl` / `Tenant.googlePlaceId` (schema:173-174) → monta o
  link de "avaliar no Google".
- Identidade do cliente no portal (login por CPF).
- Status `AppointmentStatus.COMPLETED` marca elegibilidade.
- `src/lib/google-places.ts` (helper existente).

## O que será feito (MVP)
1. **Schema (migration ADITIVA):** model `AppointmentReview` — `tenantId`
   (indexado), `appointmentId` (`@@unique` — uma por atendimento), `customerId`,
   `professionalId?`, `serviceId?`, `rating Int` (1–5), `comment String?`
   (feedback privado), `routedToGoogle Boolean`, `createdAt`. `@@index([tenantId])`.
2. **Backend** (repo tenant-scoped + service):
   - registrar avaliação (valida atendimento COMPLETED do tenant, 1 por atendimento);
   - agregações para o dono (média, contagem, % encaminhado ao Google, últimos
     feedbacks baixos) — no fuso do tenant.
3. **API Routes:** `POST` avaliação (portal, `getSessionContext` do cliente) +
   `GET` resumo/lista para o dono (permissão adequada).
4. **UI cliente (portal, mobile-first):** bloco "Avalie seu último atendimento"
   (estrelas + comentário opcional). Ao enviar: nota ≥ limiar **e** tenant com
   `googlePlaceId` → CTA "Adorou? Avalie no Google" (link direto); nota < limiar
   → agradece e capta o comentário em privado (sem CTA do Google).
   **Mockup aprovado antes do código React** ([[feedback-mockup-before-code]]).
5. **UI dono:** seção "Avaliações" (média interna, contagem, % ao Google, lista
   de feedbacks — destaque para os baixos, acionáveis). Estados loading/empty/error.
6. **Testes:** service (elegibilidade, 1-por-atendimento, split alto/baixo,
   escopo de tenant, fuso) 80%, repo 60%, rotas 70%.

## Decisões (defaults — vetar antes de construir)
- **Limiar alto/baixo:** ≥ 4 → Google, < 4 → privado (configurável depois).
- **Canal do pedido:** **portal do cliente** como núcleo (custo zero, sem gating).
  E-mail pós-conclusão via Resend fica como incremento opcional; **WhatsApp fora
  do MVP** (é gated/pago `whatsapp_basic` — não amarrar ao plano agora).
- **Gating:** **todos os planos** (é crescimento/reputação, custo ~zero; não
  premium-gate). O passo do Google degrada sozinho se o tenant não tem `googlePlaceId`
  (mostra aviso ao dono para configurar em Configurações).
- **Relação com #166 (reviews):** este funil **não** cria reviews públicas
  próprias — encaminha ao Google. Convive com o selo de nota do Google já existente.

## O que NÃO está no escopo
- Postar/auto-gerar avaliação no Google (impossível/ilegal).
- Reviews públicas próprias na vitrine (decisão da #166, separada).
- Disparo por WhatsApp (gated/pago — fase futura).

## Domínios afetados
Novo (review) sobre scheduling/crm; frontend (portal do cliente + painel do dono)
+ agent-mobile.

## Complexidade estimada
Médio (1–3h) — model + funil + 2 telas, sem integração externa paga.

## Guardrails "não quebrar"
- Migration **aditiva** (só cria `AppointmentReview`); aplicação em produção é
  passo manual (`prisma migrate deploy`) — Vercel não roda no build
  ([[feedback-migrations-vercel-session-coupling]]); **nada novo no `/me`**.
- `tenantId` sempre da sessão; filtro em toda query; 1 avaliação por atendimento.
- Fuso do tenant nas agregações "do mês".
- Sem fabricar review — só link para o Google.
- `tsc` 0 + `vitest` verde; PR para `main`.
