# Brief — Lista de espera / Waitlist (Onda 1, 1º diferencial)

> **Status:** ⏸️ PARQUEADO (2026-07-20). Forma já decidida ("Janela + 1º a agendar"),
> mas o usuário questionou o valor como PRIMEIRO diferencial — corretamente: waitlist
> só ajuda profissional lotado (minoria dos tenants), não o salão sub-agendado
> (maioria). Retomar como feature complementar quando houver demanda de tenants
> lotados. 1º diferencial escolhido no lugar: **Copiloto do dono (IA)**. Origem:
> `docs/estrategia-produto-2026-07.md` §6 C1.

## Feature
Lista de espera: o cliente entra numa fila por serviço + profissional (opcional) +
janela de data; quando um agendamento cancela e abre vaga compatível, o sistema
avisa os clientes da fila por WhatsApp/e-mail ("abriu vaga, agende agora") — o
primeiro a agendar leva. Não agenda ninguém automaticamente.

## Motivação
Agenda de profissional lotado se preenche sozinha, sem trabalho manual da equipe.
Diferencial ausente em boa parte dos concorrentes BR; alto valor, baixo custo
(reaproveita o evento de cancelamento e o canal de cliente que já existem).

## Usuário principal
Cliente final (mobile, vitrine pública). Beneficiário indireto: o negócio (menos
buraco na agenda).

## Forma aprovada (decisão do usuário)
- **Granularidade:** serviço + profissional (opcional) + janela de datas
  (ex.: "essa semana com a Ana", ou "qualquer profissional entre 20 e 27/07").
- **Oferta da vaga:** ao cancelar, notifica TODOS os compatíveis na fila;
  primeiro a agendar leva (não reserva o slot, não auto-agenda).

## Arquitetura — pontos de reúso (já existem)
- Evento `scheduling.appointment.cancelled` (scheduling.service.ts:612) já é
  publicado e escutado por Notifications (subscriptions.ts:16) → **é o gatilho**.
- Canal de cliente (Evolution API WhatsApp + e-mail Resend) já entrega mensagens.
- `/api/cron/tick` (pg-boss) já roda em produção → hospeda o job de expiração.
- Identidade do cliente na vitrine já existe (login por CPF / VitrineAccountButton).

## O que será feito (MVP)
1. **Schema (migration ADITIVA):** model `WaitlistEntry` — `tenantId` (indexado),
   `customerId`, `serviceId`, `professionalId String?` (null = qualquer),
   `windowStart`/`windowEnd` (datas), `status` (enum `WaitlistStatus`:
   ACTIVE/NOTIFIED/BOOKED/EXPIRED/CANCELLED), `notifiedAt DateTime?`, timestamps.
   `@@index([tenantId, serviceId, status])`.
2. **Repository** (filtra `tenantId` em toda query) + **Service**:
   - entrar na fila (valida serviço/profissional do tenant, janela futura);
   - matching na cancelação: `status=ACTIVE` ∧ `serviceId` igual ∧
     (`professionalId` null ∨ == cancelado) ∧ `windowStart ≤ data ≤ windowEnd`,
     ordenado por `createdAt` (justiça); notifica com cooldown anti-spam
     (não renotifica a mesma entry dentro de N horas), grava `notifiedAt`;
   - expiração: job no tick marca `EXPIRED` quando `windowEnd < hoje` (fuso do tenant);
   - cancelar/sair da fila (pelo cliente).
3. **Subscriber** em `scheduling.appointment.cancelled` → chama o matching/notify.
4. **Mensagem de cliente** "abriu vaga para {serviço} com {profissional} — agende:
   {link}", link para a vitrine pré-filtrada no serviço/profissional.
5. **UI vitrine (mobile-first):** CTA "Avisar quando abrir vaga" no serviço/
   profissional (visível só quando `allowPublicBooking` está ligado), abrindo um
   form curto (profissional opcional + janela de datas). Exige identificação do
   cliente (reusa o login por CPF) — se anônimo, leva a identificar.
6. **Portal do cliente:** bloco "Minha lista de espera" (ver/cancelar entradas).
7. **Testes:** service (matching, cooldown, expiração, escopo de tenant) 80%,
   repository 60%, rota 70%.

## O que NÃO está no escopo (MVP)
- **Auto-agendamento** do primeiro da fila (opção descartada — risco em estética).
- **Reserva/hold** temporário do slot (é first-come sem reserva).
- **Staff adicionar cliente à fila** pelo painel (só self-serve na vitrine agora).
- **Gating por plano** — MVP disponível em todos os planos vendidos (decisão de
  produto: não travar um diferencial novo antes de provar adoção; revisitar depois).
- Waitlist para pacote/promoção (só serviço no MVP).

## Domínios afetados
scheduling (model/matching), notifications (subscriber + mensagem de cliente),
crm (identidade do cliente), frontend (vitrine + portal) + agent-mobile.

## Restrição de plano
Nenhuma no MVP (ver "não no escopo").

## Skills do Orchestrator
database (migration + model) → backend (repo/service/subscriber/job) →
frontend + agent-mobile (vitrine + portal) → testing + security → review → docs.

## Complexidade estimada
Complexo (>3h) — feature nova ponta a ponta, mas com gatilho/canal reaproveitados.

## Dependências
Nenhuma bloqueante. `allowPublicBooking` e login por CPF já existem.

## Guardrails "não quebrar"
- Migration **aditiva** (só cria model/enum novos) — sem tocar em `Appointment`.
- Aplicar migration em produção é passo manual (`prisma migrate deploy`) — Vercel
  não roda no build (ver [[feedback-migrations-vercel-session-coupling]]).
- **Nada de campo novo na query de sessão `/me`** (nem do cliente nem da equipe).
- `tenantId` sempre do token/sessão, nunca do body; filtro em toda query.
- Respeitar `allowPublicBooking` (sem CTA de waitlist se o agendamento público
  estiver desligado) e `publicPageEnabled`.
- Anti-spam real no notify (cooldown) — cliente não pode receber enxurrada de
  avisos se várias vagas abrirem no mesmo dia.
- `tsc` 0 + `vitest` verde; PR para `main`.
