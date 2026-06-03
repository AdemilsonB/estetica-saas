# Fix Dashboard Métricas — Valores Incorretos

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir os 3 bugs críticos no dashboard que causam valores errados — fuso horário, fonte de receita e filtro de pagamento.

**Architecture:** Duas mudanças independentes: (1) adicionar helpers `dayBoundsInTz`/`monthBoundsInTz` em `src/lib/dates.ts` que usam `Intl.DateTimeFormat` para calcular limites de dia/mês no fuso do tenant sem libs externas; (2) reescrever as queries de receita em `src/app/api/dashboard/metrics/route.ts` para buscar `Transaction.netAmount` (type=INCOME, filtrado por `paidAt`) em vez de `Appointment.price` (status=COMPLETED). Remover também `DaySummaryCards` que é código morto com os mesmos bugs.

**Tech Stack:** TypeScript strict, Prisma, Vitest, `Intl.DateTimeFormat` (nativo Node.js ≥ 13)

---

## Contexto — Causas raiz identificadas

| Bug | Localização | Causa |
|-----|-------------|-------|
| 1 — Timezone errado | `route.ts:31-34` | `setHours(0,0,0,0)` usa UTC do servidor; BRT = UTC-3 → dia começa às 21h BRT do dia anterior |
| 2 — Receita usa preço de tabela | `route.ts:49-64` | `Appointment._sum.price` é o preço do serviço; valor real = `Transaction.netAmount` (já criado pelo domínio financeiro ao fazer checkout) |
| 3 — Receita inclui não pagos | `route.ts:51-53` | `status=COMPLETED` inclui PENDING/COURTESY/DEBT; `Transaction type=INCOME` existe somente quando pagamento foi registrado |

O `Tenant.timezone` já existe no schema (`String @default("America/Sao_Paulo")`).
O `Transaction.netAmount` já é criado em `src/domains/financial/subscriptions.ts` quando `scheduling.appointment.paid` dispara.

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---------|------|-----------------|
| `src/lib/dates.ts` | Modificar | Adicionar `dayBoundsInTz()` e `monthBoundsInTz()` — helpers timezone-aware |
| `src/lib/dates.test.ts` | Criar | Testes unitários para os novos helpers |
| `src/app/api/dashboard/metrics/route.ts` | Modificar | Usar helpers + Transaction.netAmount para receita |
| `src/components/domain/dashboard/day-summary-cards.tsx` | Deletar | Código morto com os mesmos 3 bugs |

---

## Task 1: Adicionar helpers timezone-aware em `src/lib/dates.ts`

**Files:**
- Modify: `src/lib/dates.ts`
- Create: `src/lib/dates.test.ts`

Os helpers calculam limites de dia/mês em qualquer timezone usando `Intl.DateTimeFormat` nativo — sem dependências externas.

**Como funciona o cálculo:**
1. `tzOffsetMs(tz, date)` calcula o offset em ms entre UTC e o timezone (ex: BRT=UTC-3 → +10800000ms)
2. `dayBoundsInTz` obtém a data local (ex: "2026-06-02") via `Intl`, depois aplica: `Date.UTC(y,mo-1,d,0,0,0) + offsetMs` → UTC real da meia-noite local

**Verificação para BRT (UTC-3):**
- `dayBoundsInTz('America/Sao_Paulo')` para 2026-06-02 (inverno):
  - `start = 2026-06-02T03:00:00.000Z` ← meia-noite BRT em UTC ✓
  - `end = 2026-06-03T02:59:59.999Z` ← 23:59:59 BRT em UTC ✓

- [ ] **Step 1: Escrever o teste falhando**

  Crie o arquivo `src/lib/dates.test.ts` com este conteúdo:

  ```typescript
  import { describe, it, expect } from 'vitest'
  import { dayBoundsInTz, monthBoundsInTz } from './dates'

  describe('dayBoundsInTz', () => {
    it('retorna meia-noite BRT (UTC+3h) como start para America/Sao_Paulo no inverno', () => {
      // 2026-06-15 = inverno no Brasil = BRT = UTC-3
      const ref = new Date('2026-06-15T15:00:00Z') // 12:00 BRT, dia 15
      const { start, end } = dayBoundsInTz('America/Sao_Paulo', ref)
      expect(start.toISOString()).toBe('2026-06-15T03:00:00.000Z') // 00:00 BRT
      expect(end.toISOString()).toBe('2026-06-16T02:59:59.999Z')   // 23:59:59 BRT
    })

    it('retorna limites idênticos ao UTC quando timezone é UTC', () => {
      const ref = new Date('2026-06-15T15:00:00Z')
      const { start, end } = dayBoundsInTz('UTC', ref)
      expect(start.toISOString()).toBe('2026-06-15T00:00:00.000Z')
      expect(end.toISOString()).toBe('2026-06-15T23:59:59.999Z')
    })

    it('não cruza o dia local quando o ref é às 23h BRT', () => {
      // 23:00 BRT = 02:00 UTC do dia seguinte — o "dia local" ainda é o mesmo
      const ref = new Date('2026-06-16T02:00:00Z') // 23:00 BRT do dia 15
      const { start, end } = dayBoundsInTz('America/Sao_Paulo', ref)
      expect(start.toISOString()).toBe('2026-06-15T03:00:00.000Z') // ainda dia 15 BRT
      expect(end.toISOString()).toBe('2026-06-16T02:59:59.999Z')
    })
  })

  describe('monthBoundsInTz', () => {
    it('retorna dia 1 às 00:00 BRT como start e último dia às 23:59 BRT como end', () => {
      const ref = new Date('2026-06-15T15:00:00Z') // meio do mês, BRT
      const { start, end } = monthBoundsInTz('America/Sao_Paulo', ref)
      expect(start.toISOString()).toBe('2026-06-01T03:00:00.000Z') // 00:00 BRT junho 1
      expect(end.toISOString()).toBe('2026-07-01T02:59:59.999Z')   // 23:59:59 BRT junho 30
    })

    it('retorna mês correto quando data ref está no último dia do mês às 23h BRT', () => {
      const ref = new Date('2026-07-01T01:30:00Z') // 22:30 BRT de 30/06
      const { start, end } = monthBoundsInTz('America/Sao_Paulo', ref)
      expect(start.toISOString()).toBe('2026-06-01T03:00:00.000Z') // ainda junho
      expect(end.toISOString()).toBe('2026-07-01T02:59:59.999Z')
    })
  })
  ```

- [ ] **Step 2: Rodar os testes e verificar que falham**

  Run: `npx vitest run src/lib/dates.test.ts --reporter=verbose`

  Expected: `FAIL` com `dayBoundsInTz is not a function` ou similar.

- [ ] **Step 3: Implementar os helpers em `src/lib/dates.ts`**

  Adicione ao final do arquivo `src/lib/dates.ts` (preservando todas as funções existentes):

  ```typescript
  // --- Helpers timezone-aware (usam Intl.DateTimeFormat — sem libs externas) ---

  function tzOffsetMs(tz: string, at: Date): number {
    const utcMs = at.getTime();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(at);
    const p = (type: string) =>
      Number(parts.find((x) => x.type === type)!.value);
    const localMs = Date.UTC(
      p('year'), p('month') - 1, p('day'),
      p('hour'), p('minute'), p('second'),
    );
    // Para UTC-3 (BRT): utcMs > localMs → retorna +10800000
    return utcMs - localMs;
  }

  /**
   * Retorna {start, end} do dia atual no timezone informado.
   * Ex: dayBoundsInTz('America/Sao_Paulo') → {start: 03:00Z, end: próx. 02:59Z}
   */
  export function dayBoundsInTz(tz: string, date: Date = new Date()): { start: Date; end: Date } {
    const offsetMs = tzOffsetMs(tz, date);
    const localDateStr = new Intl.DateTimeFormat('sv-SE', { timeZone: tz }).format(date);
    const [y, mo, d] = localDateStr.split('-').map(Number);
    return {
      start: new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0) + offsetMs),
      end: new Date(Date.UTC(y, mo - 1, d, 23, 59, 59, 999) + offsetMs),
    };
  }

  /**
   * Retorna {start, end} do mês atual no timezone informado.
   * Ex: monthBoundsInTz('America/Sao_Paulo') em junho → {start: jun-01T03Z, end: jul-01T02:59Z}
   */
  export function monthBoundsInTz(tz: string, date: Date = new Date()): { start: Date; end: Date } {
    const offsetMs = tzOffsetMs(tz, date);
    const localDateStr = new Intl.DateTimeFormat('sv-SE', { timeZone: tz }).format(date);
    const [y, mo] = localDateStr.split('-').map(Number);
    const start = new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0, 0) + offsetMs);
    // Fim do mês = início do próximo mês - 1ms
    const end = new Date(new Date(Date.UTC(y, mo, 1, 0, 0, 0, 0) + offsetMs).getTime() - 1);
    return { start, end };
  }
  ```

- [ ] **Step 4: Rodar os testes e verificar que passam**

  Run: `npx vitest run src/lib/dates.test.ts --reporter=verbose`

  Expected: `Tests  5 passed (5)` — zero falhas.

- [ ] **Step 5: Commit**

  ```bash
  git checkout -b fix/dashboard-metricas-corretas
  git add src/lib/dates.ts src/lib/dates.test.ts
  git commit -m "feat(lib): adiciona dayBoundsInTz e monthBoundsInTz com suporte a timezone"
  ```

---

## Task 2: Corrigir `GET /api/dashboard/metrics`

**Files:**
- Modify: `src/app/api/dashboard/metrics/route.ts`

**O que muda:**
1. Busca `tenant.timezone` do banco antes de calcular qualquer data
2. Usa `dayBoundsInTz(tz)` e `monthBoundsInTz(tz)` no lugar das funções locais sem timezone
3. Remove funções locais `startOfDay`, `endOfDay`, `startOfMonth` (eram duplicatas incorretas)
4. Substitui `prisma.appointment.aggregate(_sum: price)` por `prisma.transaction.aggregate(_sum: netAmount)` filtrando `type=INCOME` e `paidAt` no range

- [ ] **Step 1: Substituir o conteúdo completo do arquivo**

  Arquivo: `src/app/api/dashboard/metrics/route.ts`

  ```typescript
  import { AppointmentStatus, TransactionType } from "@prisma/client";

  import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
  import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
  import { getSessionContext } from "@/shared/auth/session";
  import { handleApiError } from "@/shared/http/handle-api-error";
  import { prisma } from "@/shared/database/prisma";
  import { dayBoundsInTz, monthBoundsInTz } from "@/lib/dates";

  export async function GET(request: Request) {
    initializeDomainRuntime();
    try {
      const session = await getSessionContext(request);
      ensurePermission(session, PERMISSIONS.appointments.view);

      const tenant = await prisma.tenant.findFirstOrThrow({
        where: { id: session.tenantId },
        select: { timezone: true },
      });

      const tz = tenant.timezone ?? "America/Sao_Paulo";
      const { start: dayStart, end: dayEnd } = dayBoundsInTz(tz);
      const { start: monthStart } = monthBoundsInTz(tz);

      const [statusGroups, profGroups, revenueToday, revenueMonth] =
        await Promise.all([
          // Agendamentos do dia por status (usa startsAt — slot de tempo do atendimento)
          prisma.appointment.groupBy({
            by: ["status"],
            where: {
              tenantId: session.tenantId,
              startsAt: { gte: dayStart, lte: dayEnd },
            },
            _count: { status: true },
          }),
          // Ocupação por profissional (usa startsAt)
          prisma.appointment.groupBy({
            by: ["professionalId"],
            where: {
              tenantId: session.tenantId,
              startsAt: { gte: dayStart, lte: dayEnd },
            },
            _count: { professionalId: true },
            orderBy: { _count: { professionalId: "desc" } },
          }),
          // Receita do dia: Transaction.netAmount onde type=INCOME e paidAt no range
          // netAmount = grossAmount - desconto + gorjeta - taxa de cartão (valor real recebido)
          prisma.transaction.aggregate({
            where: {
              tenantId: session.tenantId,
              type: TransactionType.INCOME,
              paidAt: { gte: dayStart, lte: dayEnd },
            },
            _sum: { netAmount: true },
          }),
          // Receita do mês: mesmo critério, range do mês
          prisma.transaction.aggregate({
            where: {
              tenantId: session.tenantId,
              type: TransactionType.INCOME,
              paidAt: { gte: monthStart, lte: dayEnd },
            },
            _sum: { netAmount: true },
          }),
        ]);

      const allStatuses: AppointmentStatus[] = [
        AppointmentStatus.SCHEDULED,
        AppointmentStatus.CONFIRMED,
        AppointmentStatus.COMPLETED,
        AppointmentStatus.CANCELLED,
        AppointmentStatus.NO_SHOW,
      ];
      const byStatus = Object.fromEntries(
        allStatuses.map((s) => [
          s,
          statusGroups.find((g) => g.status === s)?._count.status ?? 0,
        ]),
      ) as Record<AppointmentStatus, number>;

      const profIds = profGroups.map((g) => g.professionalId);
      const profUsers =
        profIds.length > 0
          ? await prisma.user.findMany({
              where: { id: { in: profIds } },
              select: { id: true, name: true },
            })
          : [];

      const byProfessional = profGroups.map((g) => ({
        id: g.professionalId,
        name:
          profUsers.find((u) => u.id === g.professionalId)?.name ?? "Desconhecido",
        count: g._count.professionalId,
      }));

      const revenue = {
        today: Number(revenueToday._sum.netAmount ?? 0),
        month: Number(revenueMonth._sum.netAmount ?? 0),
      };

      return Response.json({ byStatus, byProfessional, revenue });
    } catch (error) {
      return handleApiError(error);
    }
  }
  ```

- [ ] **Step 2: Verificar TypeScript**

  Run: `npx tsc --noEmit`

  Expected: zero erros. Se houver erro de tipo em `Decimal | null`, verificar que `Number(null ?? 0)` = 0.

- [ ] **Step 3: Rodar todos os testes**

  Run: `npx vitest run --reporter=verbose 2>&1 | tail -8`

  Expected: `Tests  102 passed | 4 skipped` — o novo teste de dates.ts soma 5 casos, total deve subir de 97 para 102 passed.

- [ ] **Step 4: Commit**

  ```bash
  git add src/app/api/dashboard/metrics/route.ts
  git commit -m "fix(dashboard): corrigir timezone, fonte de receita e filtro de pagamento nas métricas"
  ```

---

## Task 3: Remover `DaySummaryCards` (código morto)

**Files:**
- Delete: `src/components/domain/dashboard/day-summary-cards.tsx`

Este componente não é importado em lugar nenhum (verificado via grep). Contém os mesmos 3 bugs e confunde futuros desenvolvedores sobre qual componente é o "correto".

- [ ] **Step 1: Confirmar que não há imports**

  Run: `npx grep -r "DaySummaryCards\|day-summary-cards" src/ --include="*.ts" --include="*.tsx" -l`

  Expected: apenas o próprio arquivo `src/components/domain/dashboard/day-summary-cards.tsx`. Se aparecer outro arquivo, NÃO deletar e reportar BLOCKED.

- [ ] **Step 2: Deletar o arquivo**

  ```bash
  rm src/components/domain/dashboard/day-summary-cards.tsx
  ```

- [ ] **Step 3: Verificar TypeScript**

  Run: `npx tsc --noEmit`

  Expected: zero erros (nada importava este arquivo).

- [ ] **Step 4: Commit**

  ```bash
  git add -A
  git commit -m "chore(dashboard): remove DaySummaryCards — código morto com bugs de timezone e receita"
  ```

---

## Task 4: Verificação final e PR

**Files:**
- Nenhum

- [ ] **Step 1: TypeScript limpo**

  Run: `npx tsc --noEmit`

  Expected: zero saída.

- [ ] **Step 2: Todos os testes passando**

  Run: `npx vitest run 2>&1 | tail -6`

  Expected:
  ```
  Test Files  20 passed (20)
        Tests  102 passed | 4 skipped (106)
  ```
  (19 arquivos anteriores + 1 novo `dates.test.ts` = 20; 97 + 5 novos = 102 passed)

- [ ] **Step 3: Push e PR**

  ```bash
  git push -u origin fix/dashboard-metricas-corretas
  gh pr create \
    --title "fix(dashboard): corrigir timezone, fonte de receita e filtro nas métricas" \
    --body "$(cat <<'EOF'
  ## Summary

  Corrige 3 bugs críticos no dashboard que causavam valores errados:

  - **Timezone**: `setHours(0,0,0,0)` usava UTC do servidor; agora usa `dayBoundsInTz(tenant.timezone)` que calcula limites corretos para `America/Sao_Paulo` via `Intl.DateTimeFormat` (sem libs externas)
  - **Fonte de receita**: queries usavam `Appointment.price` (preço de tabela); agora usam `Transaction.netAmount` (valor real recebido = preço − desconto + gorjeta − taxa cartão)
  - **Filtro de pagamento**: `status=COMPLETED` incluía atendimentos PENDING/COURTESY/DEBT; agora filtra `Transaction type=INCOME` — existe apenas quando pagamento foi registrado via checkout
  - Remove `DaySummaryCards` (código morto com os mesmos 3 bugs)

  ## Test plan

  - [ ] `npx vitest run` — 102 passed, 4 skipped, 0 failed
  - [ ] `npx tsc --noEmit` — zero erros
  - [ ] Dashboard exibe receita do dia = soma dos `netAmount` das transações INCOME do dia em BRT
  - [ ] Contagem de agendamentos reflete o dia correto em BRT (não UTC)

  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  EOF
  )" \
    --base main \
    --head fix/dashboard-metricas-corretas
  ```

---

## Self-Review

**Cobertura da spec:**
- ✅ Bug 1 (timezone): `dayBoundsInTz` + `monthBoundsInTz` — Task 1 + Task 2
- ✅ Bug 2 (preço de tabela): `Transaction.netAmount` — Task 2
- ✅ Bug 3 (filtro de pagamento): `type=INCOME` — Task 2
- ✅ Código morto: `DaySummaryCards` deletado — Task 3
- ✅ Testes para helpers timezone-aware: 5 casos em dates.test.ts — Task 1
- ✅ Recomendação arquitetural: toda mudança de layout deve revisar queries correspondentes — salva em memory

**Não está no escopo (fora deste fix):**
- `AppointmentRepository.countThisMonth()` — usa `startOfMonth` sem timezone, afeta limite mensal de billing. Pode ser corrigido em PR separado se necessário.
- Reports (`/api/reports/*`) — recebem `from`/`to` do frontend (browser timezone correto). Não afetados.
