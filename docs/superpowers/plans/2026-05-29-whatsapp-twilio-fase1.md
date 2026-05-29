# WhatsApp Twilio Fase 1 — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o provider Z-API (não-oficial) pelo WhatsApp Business API oficial via Twilio, com templates customizáveis por tenant, quota mensal por plano e webhook de status.

**Architecture:** O domínio `notifications` já possui `logAndDispatch`, subscriptions de eventos e pg-boss para reminders — apenas o provider é substituído. A quota usa uma nova tabela `WhatsAppMonthlyUsage` com upsert atômico por `(tenantId, year, month)`. O webhook Twilio atualiza o `NotificationLog` via `externalId` (Twilio Message SID).

**Tech Stack:** Next.js 15 App Router, Prisma 7, Twilio SDK (`twilio` npm), pg-boss, Vitest + vitest-mock-extended, Zod, TypeScript strict, Shadcn UI + TailwindCSS, TanStack Query.

**Spec:** `docs/superpowers/specs/2026-05-28-whatsapp-twilio-fase1-design.md`

---

## Mapa de arquivos

| Arquivo | Task |
|---|---|
| `prisma/schema.prisma` | Task 2 |
| `src/domains/billing/types.ts` | Task 3 |
| `src/shared/errors/domain-error.ts` | Task 4 |
| `src/domains/notifications/types.ts` | Task 5 |
| `src/domains/notifications/quota/whatsapp-quota.service.ts` | Task 6 |
| `src/domains/notifications/quota/whatsapp-quota.service.test.ts` | Task 6 |
| `src/shared/test/factories/whatsapp-usage.factory.ts` | Task 6 |
| `src/domains/notifications/providers/whatsapp.provider.ts` | Task 7 |
| `src/domains/notifications/providers/whatsapp.provider.test.ts` | Task 7 |
| `src/domains/notifications/notification.service.ts` | Task 8 |
| `src/domains/notifications/subscriptions.ts` | Task 9 |
| `src/shared/queue/jobs/appointment-reminder.ts` | Task 9 |
| `src/shared/queue/jobs/whatsapp-quota-reset.ts` | Task 10 |
| `src/app/api/_lib/runtime.ts` | Task 10 |
| `src/app/api/webhooks/twilio/status/route.ts` | Task 11 |
| `src/app/api/webhooks/twilio/status/route.test.ts` | Task 11 |
| `src/app/api/whatsapp/usage/route.ts` | Task 12 |
| `src/app/api/whatsapp/usage/route.test.ts` | Task 12 |
| `src/app/api/whatsapp/templates/route.ts` | Task 13 |
| `src/app/api/notifications/settings/route.ts` | Task 14 |
| `src/hooks/settings/use-notification-settings.ts` | Task 15 |
| `src/components/domain/settings/whatsapp-settings-form.tsx` | Task 15 |
| `src/components/domain/settings/whatsapp-usage-card.tsx` | Task 16 |
| `src/components/domain/settings/whatsapp-template-editor.tsx` | Task 17 |

---

## Task 1: Instalar SDK Twilio e configurar variáveis de ambiente

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `.env.example` (se existir) ou documentar no PR

- [ ] **Step 1: Instalar o pacote Twilio**

```bash
npm install twilio
```

Saída esperada: `added X packages` sem erros.

- [ ] **Step 2: Verificar que os tipos TypeScript estão disponíveis**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Saída esperada: sem erros relacionados a `twilio`.

- [ ] **Step 3: Adicionar variáveis ao `.env.local` (desenvolvimento)**

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
APP_URL=http://localhost:3000

# Template SIDs — usar SIDs reais após aprovação Meta; sandbox não exige SIDs
TWILIO_TPL_CONFIRMATION=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_TPL_CONFIRMED=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_TPL_REMINDER=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_TPL_CANCELLATION=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_TPL_NO_SHOW=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> Em desenvolvimento, usar o número sandbox `whatsapp:+14155238886`. Para ativar: enviar "join [palavra-chave]" para esse número via WhatsApp no celular de teste.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(whatsapp): instala SDK Twilio"
```

---

## Task 2: Prisma schema — migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Atualizar o schema**

Abrir `prisma/schema.prisma` e aplicar as mudanças abaixo:

**2a — Atualizar enum `NotificationStatus`** (adicionar `DELIVERED`):

```prisma
enum NotificationStatus {
  PENDING
  SENT
  DELIVERED
  FAILED
}
```

**2b — Atualizar model `Tenant`** (remover Z-API, adicionar timezone e whatsappTemplateConfig):

Remover as linhas:
```prisma
  zApiInstanceId    String?
  zApiToken         String?
```

Adicionar após `whatsappEnabled`:
```prisma
  timezone              String  @default("America/Sao_Paulo")
  whatsappTemplateConfig Json?
```

**2c — Adicionar model `WhatsAppMonthlyUsage`** (antes ou depois de `NotificationLog`):

```prisma
model WhatsAppMonthlyUsage {
  id        String   @id @default(cuid())
  tenantId  String
  year      Int
  month     Int
  count     Int      @default(0)
  updatedAt DateTime @updatedAt

  @@unique([tenantId, year, month])
  @@index([tenantId])
}
```

**2d — Atualizar model `NotificationLog`** (adicionar `externalId`):

Adicionar após `errorMessage`:
```prisma
  externalId     String?
```

**2e — Atualizar model `Customer`** (adicionar campos consent para Fase 2):

Adicionar após `tags`:
```prisma
  consentGiven  Boolean   @default(false)
  consentDate   DateTime?
  consentOrigin String?
```

- [ ] **Step 2: Gerar e aplicar a migration**

```bash
npx prisma migrate dev --name whatsapp-twilio-fase1
```

Saída esperada: `Your database is now in sync with your schema.`

- [ ] **Step 3: Regenerar o Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 4: Verificar TypeScript após mudanças de schema**

```bash
npx tsc --noEmit 2>&1 | grep -c "error" || echo "0 erros"
```

> Podem aparecer erros em arquivos que ainda referenciam `zApiInstanceId`/`zApiToken` — serão resolvidos nas tasks seguintes.

- [ ] **Step 5: Commit**

```bash
git add prisma/
git commit -m "feat(whatsapp): migration Twilio Fase 1 — remove Z-API, adiciona DELIVERED, WhatsAppMonthlyUsage, timezone, consent"
```

---

## Task 3: `billing/types.ts` — renomear `maxNotificationsPerMonth` → `maxWhatsAppPerMonth`

**Files:**
- Modify: `src/domains/billing/types.ts`

- [ ] **Step 1: Atualizar o tipo `PlanLimits` e a constante `PLAN_LIMITS`**

```typescript
// src/domains/billing/types.ts
import { z } from "zod";
import { PlanName, SubscriptionStatus } from "@prisma/client";

export { PlanName, SubscriptionStatus };

export const PLAN_LIMITS: Record<PlanName, PlanLimits> = {
  FREE:       { maxUsers: 2,   maxAppointmentsPerMonth: 50,   maxWhatsAppPerMonth: 0,     maxUnits: 1 },
  STARTER:    { maxUsers: 5,   maxAppointmentsPerMonth: 300,  maxWhatsAppPerMonth: 500,   maxUnits: 1 },
  PRO:        { maxUsers: 20,  maxAppointmentsPerMonth: 2000, maxWhatsAppPerMonth: 2000,  maxUnits: 3 },
  ENTERPRISE: { maxUsers: -1,  maxAppointmentsPerMonth: -1,   maxWhatsAppPerMonth: 5000,  maxUnits: -1 },
} as const;

export type PlanLimits = {
  maxUsers: number;
  maxAppointmentsPerMonth: number;
  maxWhatsAppPerMonth: number;
  maxUnits: number;
};

export const updateSubscriptionSchema = z.object({
  plan: z.nativeEnum(PlanName),
  status: z.nativeEnum(SubscriptionStatus),
  reason: z.string().min(1),
});

export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
```

- [ ] **Step 2: Verificar se `maxNotificationsPerMonth` é referenciado em outro lugar**

```bash
npx tsc --noEmit 2>&1 | grep "maxNotifications"
```

Saída esperada: nenhuma saída (campo não é usado em mais nenhum lugar).

- [ ] **Step 3: Commit**

```bash
git add src/domains/billing/types.ts
git commit -m "feat(billing): renomeia maxNotificationsPerMonth para maxWhatsAppPerMonth com novos limites por plano"
```

---

## Task 4: `InvalidPhoneError` — erro tipado para telefone inválido

**Files:**
- Modify: `src/shared/errors/domain-error.ts`

- [ ] **Step 1: Adicionar `InvalidPhoneError` ao arquivo de erros**

Abrir `src/shared/errors/domain-error.ts` e adicionar ao final (antes do fechamento do arquivo, após `PlanLimitError`):

```typescript
export class InvalidPhoneError extends DomainError {
  constructor(phone: string) {
    super(
      `Número de telefone inválido: "${phone}". Esperado formato brasileiro (10-13 dígitos).`,
      "INVALID_PHONE",
      422,
      { phone },
    );
  }
}
```

- [ ] **Step 2: Verificar que está exportado via index**

O arquivo `src/shared/errors/index.ts` já tem `export * from "./domain-error"`, então nada precisa ser mudado.

- [ ] **Step 3: Commit**

```bash
git add src/shared/errors/domain-error.ts
git commit -m "feat(errors): adiciona InvalidPhoneError para validação de telefone WhatsApp"
```

---

## Task 5: `notifications/types.ts` — adicionar `externalId` ao resultado de entrega

**Files:**
- Modify: `src/domains/notifications/types.ts`

- [ ] **Step 1: Atualizar `NotificationDeliveryResult`**

```typescript
// src/domains/notifications/types.ts
import { NotificationChannel, NotificationStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export type NotificationDraft = {
  tenantId: string;
  appointmentId?: string;
  customerId?: string;
  channel: NotificationChannel;
  template: string;
  recipient: string;
  provider: string;
  payload: Prisma.InputJsonValue;
};

export type NotificationDeliveryResult = {
  status: NotificationStatus;
  errorMessage?: string;
  externalId?: string;
};
```

- [ ] **Step 2: Confirmar que TypeScript aceita**

```bash
npx tsc --noEmit 2>&1 | grep "notifications/types" || echo "ok"
```

- [ ] **Step 3: Commit**

```bash
git add src/domains/notifications/types.ts
git commit -m "feat(notifications): adiciona externalId ao NotificationDeliveryResult para rastreamento Twilio"
```

---

## Task 6: WhatsApp Quota Service (TDD)

**Files:**
- Create: `src/domains/notifications/quota/whatsapp-quota.service.ts`
- Create: `src/domains/notifications/quota/whatsapp-quota.service.test.ts`
- Create: `src/shared/test/factories/whatsapp-usage.factory.ts`

- [ ] **Step 1: Criar factory de teste**

```typescript
// src/shared/test/factories/whatsapp-usage.factory.ts
import type { WhatsAppMonthlyUsage } from "@prisma/client";

export function makeWhatsAppUsage(
  overrides: Partial<WhatsAppMonthlyUsage> = {},
): WhatsAppMonthlyUsage {
  const now = new Date();
  return {
    id: "usage-1",
    tenantId: "tenant-1",
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    count: 0,
    updatedAt: now,
    ...overrides,
  };
}
```

- [ ] **Step 2: Escrever os testes (devem falhar — o service ainda não existe)**

```typescript
// src/domains/notifications/quota/whatsapp-quota.service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@/shared/test/prisma-mock";
import { PlanName, SubscriptionStatus } from "@prisma/client";
import { makeWhatsAppUsage } from "@/shared/test/factories/whatsapp-usage.factory";

vi.mock("@/domains/billing/feature-guard", () => ({
  featureGuard: {
    getSubscriptionState: vi.fn(),
  },
}));

import { featureGuard } from "@/domains/billing/feature-guard";

// Import após os mocks
const { WhatsAppQuotaService } = await import("./whatsapp-quota.service");
const service = new WhatsAppQuotaService();

describe("WhatsAppQuotaService", () => {
  beforeEach(() => {
    vi.mocked(featureGuard.getSubscriptionState).mockResolvedValue({
      plan: PlanName.STARTER,
      status: SubscriptionStatus.ACTIVE,
    });
  });

  describe("checkAndIncrement", () => {
    it("retorna true e incrementa quando abaixo do limite", async () => {
      prismaMock.whatsAppMonthlyUsage.upsert.mockResolvedValue(
        makeWhatsAppUsage({ count: 100 }),
      );

      const result = await service.checkAndIncrement("tenant-1");

      expect(result).toBe(true);
      expect(prismaMock.whatsAppMonthlyUsage.upsert).toHaveBeenCalledOnce();
      expect(prismaMock.whatsAppMonthlyUsage.update).not.toHaveBeenCalled();
    });

    it("retorna false e reverte o increment quando ultrapassa o limite do STARTER (500)", async () => {
      prismaMock.whatsAppMonthlyUsage.upsert.mockResolvedValue(
        makeWhatsAppUsage({ count: 501 }),
      );
      prismaMock.whatsAppMonthlyUsage.update.mockResolvedValue(
        makeWhatsAppUsage({ count: 500 }),
      );

      const result = await service.checkAndIncrement("tenant-1");

      expect(result).toBe(false);
      expect(prismaMock.whatsAppMonthlyUsage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { count: { decrement: 1 } },
        }),
      );
    });

    it("retorna true para ENTERPRISE até 5000", async () => {
      vi.mocked(featureGuard.getSubscriptionState).mockResolvedValue({
        plan: PlanName.ENTERPRISE,
        status: SubscriptionStatus.ACTIVE,
      });
      prismaMock.whatsAppMonthlyUsage.upsert.mockResolvedValue(
        makeWhatsAppUsage({ count: 4999 }),
      );

      const result = await service.checkAndIncrement("tenant-1");

      expect(result).toBe(true);
    });

    it("retorna false para FREE (limite 0)", async () => {
      vi.mocked(featureGuard.getSubscriptionState).mockResolvedValue({
        plan: PlanName.FREE,
        status: SubscriptionStatus.ACTIVE,
      });
      prismaMock.whatsAppMonthlyUsage.upsert.mockResolvedValue(
        makeWhatsAppUsage({ count: 1 }),
      );
      prismaMock.whatsAppMonthlyUsage.update.mockResolvedValue(
        makeWhatsAppUsage({ count: 0 }),
      );

      const result = await service.checkAndIncrement("tenant-1");

      expect(result).toBe(false);
    });
  });

  describe("decrement", () => {
    it("decrementa o count do mês corrente (apenas se count > 0)", async () => {
      prismaMock.whatsAppMonthlyUsage.updateMany.mockResolvedValue({ count: 1 });

      await service.decrement("tenant-1");

      expect(prismaMock.whatsAppMonthlyUsage.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: "tenant-1",
            count: { gt: 0 },
          }),
          data: { count: { decrement: 1 } },
        }),
      );
    });
  });

  describe("getUsage", () => {
    it("retorna used, limit e resetDate corretos", async () => {
      prismaMock.whatsAppMonthlyUsage.findUnique.mockResolvedValue(
        makeWhatsAppUsage({ count: 347 }),
      );

      const result = await service.getUsage("tenant-1");

      expect(result.used).toBe(347);
      expect(result.limit).toBe(500);
      expect(result.resetDate).toMatch(/^\d{4}-\d{2}-01$/);
    });

    it("retorna used=0 quando não há registro para o mês", async () => {
      prismaMock.whatsAppMonthlyUsage.findUnique.mockResolvedValue(null);

      const result = await service.getUsage("tenant-1");

      expect(result.used).toBe(0);
    });
  });
});
```

- [ ] **Step 3: Rodar os testes — confirmar que FALHAM**

```bash
npx vitest run src/domains/notifications/quota/whatsapp-quota.service.test.ts
```

Saída esperada: `FAIL` com `Cannot find module './whatsapp-quota.service'`.

- [ ] **Step 4: Implementar o service**

```typescript
// src/domains/notifications/quota/whatsapp-quota.service.ts
import { prisma } from "@/shared/database/prisma";
import { featureGuard } from "@/domains/billing/feature-guard";
import { PLAN_LIMITS } from "@/domains/billing/types";

export class WhatsAppQuotaService {
  async checkAndIncrement(tenantId: string): Promise<boolean> {
    const { plan } = await featureGuard.getSubscriptionState(tenantId);
    const limit = PLAN_LIMITS[plan].maxWhatsAppPerMonth;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const record = await prisma.whatsAppMonthlyUsage.upsert({
      where: { tenantId_year_month: { tenantId, year, month } },
      create: { tenantId, year, month, count: 1 },
      update: { count: { increment: 1 } },
    });

    if (limit !== -1 && record.count > limit) {
      await prisma.whatsAppMonthlyUsage.update({
        where: { tenantId_year_month: { tenantId, year, month } },
        data: { count: { decrement: 1 } },
      });
      return false;
    }

    return true;
  }

  async decrement(tenantId: string): Promise<void> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    await prisma.whatsAppMonthlyUsage.updateMany({
      where: { tenantId, year, month, count: { gt: 0 } },
      data: { count: { decrement: 1 } },
    });
  }

  async getUsage(
    tenantId: string,
  ): Promise<{ used: number; limit: number; resetDate: string }> {
    const { plan } = await featureGuard.getSubscriptionState(tenantId);
    const limit = PLAN_LIMITS[plan].maxWhatsAppPerMonth;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const record = await prisma.whatsAppMonthlyUsage.findUnique({
      where: { tenantId_year_month: { tenantId, year, month } },
    });

    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const resetDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

    return { used: record?.count ?? 0, limit, resetDate };
  }
}

export const whatsAppQuotaService = new WhatsAppQuotaService();
```

- [ ] **Step 5: Rodar os testes — confirmar que PASSAM**

```bash
npx vitest run src/domains/notifications/quota/whatsapp-quota.service.test.ts
```

Saída esperada: `PASS` com todos os testes verdes.

- [ ] **Step 6: Commit**

```bash
git add src/domains/notifications/quota/ src/shared/test/factories/whatsapp-usage.factory.ts
git commit -m "feat(notifications): WhatsAppQuotaService com checkAndIncrement, decrement e getUsage"
```

---

## Task 7: WhatsApp Provider — substituição completa Z-API → Twilio (TDD)

**Files:**
- Create (substituir): `src/domains/notifications/providers/whatsapp.provider.ts`
- Create: `src/domains/notifications/providers/whatsapp.provider.test.ts`

- [ ] **Step 1: Escrever os testes do provider (devem falhar — o provider ainda usa Z-API)**

```typescript
// src/domains/notifications/providers/whatsapp.provider.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@/shared/test/prisma-mock";
import { NotificationChannel, NotificationStatus } from "@prisma/client";

vi.mock("twilio", () => ({
  default: vi.fn(() => ({
    messages: {
      create: vi.fn(),
    },
  })),
  validateRequest: vi.fn(),
}));

vi.mock("@/domains/billing/feature-guard", () => ({
  featureGuard: { assertAccess: vi.fn() },
  FEATURES: { WHATSAPP_BASIC: "whatsapp_basic" },
}));

vi.mock("../quota/whatsapp-quota.service", () => ({
  whatsAppQuotaService: {
    checkAndIncrement: vi.fn(),
    decrement: vi.fn(),
  },
}));

import twilio from "twilio";
import { featureGuard } from "@/domains/billing/feature-guard";
import { whatsAppQuotaService } from "../quota/whatsapp-quota.service";
import { WhatsAppProvider } from "./whatsapp.provider";

const provider = new WhatsAppProvider();

const mockDraft = {
  tenantId: "tenant-1",
  appointmentId: "appt-1",
  customerId: "cust-1",
  channel: NotificationChannel.WHATSAPP,
  template: "appointment-created",
  recipient: "11987654321",
  provider: "twilio",
  payload: {
    appointmentId: "appt-1",
    customerName: "João Silva",
    serviceName: "Corte",
    startsAt: "2026-06-01T12:00:00.000Z",
  },
};

const mockTenant = {
  whatsappEnabled: true,
  name: "Barbearia Silva",
  slug: "barbearia-silva",
  timezone: "America/Sao_Paulo",
  whatsappTemplateConfig: null,
};

describe("WhatsAppProvider", () => {
  beforeEach(() => {
    vi.mocked(featureGuard.assertAccess).mockResolvedValue(undefined);
    vi.mocked(whatsAppQuotaService.checkAndIncrement).mockResolvedValue(true);
    vi.mocked(whatsAppQuotaService.decrement).mockResolvedValue(undefined);
  });

  it("envia mensagem e retorna SENT com externalId", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(mockTenant as never);
    const mockCreate = vi.fn().mockResolvedValue({ sid: "SM123456" });
    vi.mocked(twilio).mockReturnValue({ messages: { create: mockCreate } } as never);

    const result = await provider.send(mockDraft);

    expect(result.status).toBe(NotificationStatus.SENT);
    expect(result.externalId).toBe("SM123456");
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("retorna PENDING quando whatsappEnabled é false", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(
      { ...mockTenant, whatsappEnabled: false } as never,
    );

    const result = await provider.send(mockDraft);

    expect(result.status).toBe(NotificationStatus.PENDING);
  });

  it("retorna FAILED para telefone inválido (< 10 dígitos)", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(mockTenant as never);

    const result = await provider.send({ ...mockDraft, recipient: "123" });

    expect(result.status).toBe(NotificationStatus.FAILED);
    expect(result.errorMessage).toContain("Telefone inválido");
  });

  it("retorna FAILED quando quota está esgotada", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(mockTenant as never);
    vi.mocked(whatsAppQuotaService.checkAndIncrement).mockResolvedValue(false);

    const result = await provider.send(mockDraft);

    expect(result.status).toBe(NotificationStatus.FAILED);
    expect(result.errorMessage).toContain("Limite mensal");
  });

  it("faz retry 2x em erro de rede, reverte quota e retorna FAILED", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(mockTenant as never);
    const mockCreate = vi.fn().mockRejectedValue(new Error("Network error"));
    vi.mocked(twilio).mockReturnValue({ messages: { create: mockCreate } } as never);

    const result = await provider.send(mockDraft);

    expect(result.status).toBe(NotificationStatus.FAILED);
    expect(mockCreate).toHaveBeenCalledTimes(3); // 1 inicial + 2 retries
    expect(whatsAppQuotaService.decrement).toHaveBeenCalledWith("tenant-1");
  });

  it("usa mensagem personalizada do tenant quando configurada", async () => {
    const tenantWithConfig = {
      ...mockTenant,
      whatsappTemplateConfig: {
        confirmacao: {
          mensagemPrincipal: "Seu horário foi reservado!",
          mensagemFinal: "Nos vemos lá!",
        },
      },
    };
    prismaMock.tenant.findFirst.mockResolvedValue(tenantWithConfig as never);
    const mockCreate = vi.fn().mockResolvedValue({ sid: "SM999" });
    vi.mocked(twilio).mockReturnValue({ messages: { create: mockCreate } } as never);

    await provider.send(mockDraft);

    const callArg = mockCreate.mock.calls[0][0];
    const vars = JSON.parse(callArg.contentVariables);
    expect(vars["2"]).toBe("Seu horário foi reservado!");
    expect(vars["7"]).toBe("Nos vemos lá!");
  });

  it("não acessa startsAt para template appointment-cancelled", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(mockTenant as never);
    const mockCreate = vi.fn().mockResolvedValue({ sid: "SM777" });
    vi.mocked(twilio).mockReturnValue({ messages: { create: mockCreate } } as never);

    const cancelledDraft = {
      ...mockDraft,
      template: "appointment-cancelled",
      payload: {
        appointmentId: "appt-1",
        customerName: "João Silva",
        serviceName: "Corte",
        status: "CANCELLED",
        // startsAt AUSENTE — intencional
      },
    };

    const result = await provider.send(cancelledDraft);

    expect(result.status).toBe(NotificationStatus.SENT);
  });
});
```

- [ ] **Step 2: Rodar os testes — confirmar que FALHAM**

```bash
npx vitest run src/domains/notifications/providers/whatsapp.provider.test.ts
```

Saída esperada: falhas relacionadas a Z-API / ausência de método `send` com lógica Twilio.

- [ ] **Step 3: Implementar o provider Twilio (substituição completa)**

```typescript
// src/domains/notifications/providers/whatsapp.provider.ts
import twilio from "twilio";
import { NotificationStatus } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";
import { featureGuard, FEATURES } from "@/domains/billing/feature-guard";
import { InvalidPhoneError } from "@/shared/errors";
import { whatsAppQuotaService } from "../quota/whatsapp-quota.service";
import type { NotificationDraft, NotificationDeliveryResult } from "../types";

// Fail-fast na inicialização — nunca em build do Next.js
if (
  process.env.NODE_ENV !== "test" &&
  process.env.NEXT_PHASE !== "phase-production-build"
) {
  const required = [
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_WHATSAPP_FROM",
    "APP_URL",
    "TWILIO_TPL_CONFIRMATION",
    "TWILIO_TPL_CONFIRMED",
    "TWILIO_TPL_REMINDER",
    "TWILIO_TPL_CANCELLATION",
    "TWILIO_TPL_NO_SHOW",
  ] as const;
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`[WhatsAppProvider] Env var ${key} não configurada`);
    }
  }
}

const TEMPLATE_SIDS: Record<string, string> = {
  "appointment-created":   process.env.TWILIO_TPL_CONFIRMATION ?? "",
  "appointment-confirmed": process.env.TWILIO_TPL_CONFIRMED ?? "",
  "appointment-reminder":  process.env.TWILIO_TPL_REMINDER ?? "",
  "appointment-cancelled": process.env.TWILIO_TPL_CANCELLATION ?? "",
  "appointment-no-show":   process.env.TWILIO_TPL_NO_SHOW ?? "",
};

const TEMPLATE_TO_CONFIG_KEY: Record<string, string> = {
  "appointment-created":   "confirmacao",
  "appointment-confirmed": "confirmado",
  "appointment-reminder":  "lembrete",
  "appointment-cancelled": "cancelamento",
  "appointment-no-show":   "nao_comparecimento",
};

const TEMPLATE_DEFAULTS: Record<string, { mensagemPrincipal: string; mensagemFinal: string }> = {
  confirmacao:        { mensagemPrincipal: "Seu agendamento foi criado.", mensagemFinal: "Até lá!" },
  confirmado:         { mensagemPrincipal: "Seu agendamento está confirmado.", mensagemFinal: "Te esperamos!" },
  lembrete:           { mensagemPrincipal: "Lembrete:", mensagemFinal: "Até lá!" },
  cancelamento:       { mensagemPrincipal: "Seu agendamento foi cancelado.", mensagemFinal: "Para reagendar, entre em contato conosco." },
  nao_comparecimento: { mensagemPrincipal: "Notamos que você não compareceu ao seu horário.", mensagemFinal: "Quando quiser reagendar, estamos à disposição!" },
};

type AppointmentNotificationPayload = {
  appointmentId: string;
  customerName: string;
  serviceName: string;
  startsAt?: string;
  status?: string;
};

type TemplateConfig = { mensagemPrincipal?: string; mensagemFinal?: string };

function toWhatsAppNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) {
    throw new InvalidPhoneError(raw);
  }
  const e164 = digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
  return `whatsapp:${e164}`;
}

function fmt(isoString: string, timezone: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, ...options }).format(
    new Date(isoString),
  );
}

function buildTemplateParams(
  template: string,
  payload: AppointmentNotificationPayload,
  tenant: { name: string; slug: string; timezone: string; whatsappTemplateConfig: unknown },
): { contentSid: string; contentVariables: Record<string, string> } {
  const configKey = TEMPLATE_TO_CONFIG_KEY[template];
  const rawConfigs = tenant.whatsappTemplateConfig as Record<string, TemplateConfig> | null;
  const tenantConfig = rawConfigs?.[configKey] ?? {};
  const defaults = TEMPLATE_DEFAULTS[configKey];

  const principal = tenantConfig.mensagemPrincipal ?? defaults.mensagemPrincipal;
  const final = tenantConfig.mensagemFinal ?? defaults.mensagemFinal;
  const contentSid = TEMPLATE_SIDS[template];
  const tz = tenant.timezone;

  let contentVariables: Record<string, string>;

  if (template === "appointment-created" || template === "appointment-confirmed") {
    const startsAt = payload.startsAt!;
    contentVariables = {
      "1": payload.customerName,
      "2": principal,
      "3": fmt(startsAt, tz, { day: "2-digit", month: "2-digit", year: "numeric" }),
      "4": fmt(startsAt, tz, { hour: "2-digit", minute: "2-digit" }),
      "5": payload.serviceName,
      "6": tenant.name,
      "7": final,
      "8": `${process.env.APP_URL}/agendar/${tenant.slug}`,
    };
  } else if (template === "appointment-reminder") {
    const startsAt = payload.startsAt!;
    contentVariables = {
      "1": payload.customerName,
      "2": principal,
      "3": fmt(startsAt, tz, { hour: "2-digit", minute: "2-digit" }),
      "4": payload.serviceName,
      "5": tenant.name,
      "6": final,
    };
  } else {
    contentVariables = {
      "1": payload.customerName,
      "2": principal,
      "3": payload.serviceName,
      "4": tenant.name,
      "5": final,
    };
  }

  return { contentSid, contentVariables };
}

async function sendWithRetry(
  client: ReturnType<typeof twilio>,
  params: Parameters<typeof client.messages.create>[0],
  maxRetries = 2,
): Promise<Awaited<ReturnType<typeof client.messages.create>>> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await client.messages.create(params);
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }
  throw lastError;
}

export class WhatsAppProvider {
  private getClient() {
    return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }

  async send(draft: NotificationDraft): Promise<NotificationDeliveryResult> {
    try {
      await featureGuard.assertAccess(draft.tenantId, FEATURES.WHATSAPP_BASIC);
    } catch {
      return { status: NotificationStatus.FAILED, errorMessage: "Plano não suporta WhatsApp." };
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id: draft.tenantId },
      select: {
        whatsappEnabled: true,
        name: true,
        slug: true,
        timezone: true,
        whatsappTemplateConfig: true,
      },
    });

    if (!tenant?.whatsappEnabled) {
      return { status: NotificationStatus.PENDING };
    }

    let to: string;
    try {
      to = toWhatsAppNumber(draft.recipient);
    } catch {
      return {
        status: NotificationStatus.FAILED,
        errorMessage: `Telefone inválido: ${draft.recipient}`,
      };
    }

    const canSend = await whatsAppQuotaService.checkAndIncrement(draft.tenantId);
    if (!canSend) {
      return {
        status: NotificationStatus.FAILED,
        errorMessage: "Limite mensal de WhatsApp atingido.",
      };
    }

    const payload = draft.payload as AppointmentNotificationPayload;
    const { contentSid, contentVariables } = buildTemplateParams(draft.template, payload, tenant);

    try {
      const client = this.getClient();
      const message = await sendWithRetry(client, {
        from: process.env.TWILIO_WHATSAPP_FROM,
        to,
        contentSid,
        contentVariables: JSON.stringify(contentVariables),
        statusCallback: `${process.env.APP_URL}/api/webhooks/twilio/status`,
      });
      return { status: NotificationStatus.SENT, externalId: message.sid };
    } catch (err) {
      await whatsAppQuotaService.decrement(draft.tenantId);
      return {
        status: NotificationStatus.FAILED,
        errorMessage: err instanceof Error ? err.message : "Erro ao enviar via Twilio.",
      };
    }
  }
}

export const whatsAppProvider = new WhatsAppProvider();
```

- [ ] **Step 4: Rodar os testes — confirmar que PASSAM**

```bash
npx vitest run src/domains/notifications/providers/whatsapp.provider.test.ts
```

Saída esperada: todos os testes `PASS`.

- [ ] **Step 5: Commit**

```bash
git add src/domains/notifications/providers/
git commit -m "feat(notifications): substitui provider Z-API por Twilio com templates, quota e retry"
```

---

## Task 8: `notification.service.ts` — propagar `externalId` ao log

**Files:**
- Modify: `src/domains/notifications/notification.service.ts`

- [ ] **Step 1: Atualizar o service para passar `externalId` ao criar o log**

```typescript
// src/domains/notifications/notification.service.ts
import { NotificationChannel, NotificationStatus } from "@prisma/client";

import { eventBus } from "@/shared/events/event-bus";

import { notificationRepository } from "./notification.repository";
import { whatsAppProvider } from "./providers/whatsapp.provider";
import type { NotificationDraft } from "./types";

export class NotificationService {
  async logAndDispatch(draft: NotificationDraft) {
    const delivery =
      draft.channel === NotificationChannel.WHATSAPP
        ? await whatsAppProvider.send(draft)
        : { status: NotificationStatus.PENDING, errorMessage: "Canal nao suportado." };

    const notification = await notificationRepository.createLog(draft.tenantId, {
      appointmentId: draft.appointmentId,
      customerId: draft.customerId,
      channel: draft.channel,
      template: draft.template,
      recipient: draft.recipient,
      provider: draft.provider,
      status: delivery.status,
      payload: draft.payload,
      errorMessage: delivery.errorMessage,
      externalId: delivery.externalId,
    });

    eventBus.publish({
      type: "notifications.notification.logged",
      payload: { tenantId: draft.tenantId, notification },
    });

    return notification;
  }
}

export const notificationService = new NotificationService();
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "notification.service" || echo "ok"
```

- [ ] **Step 3: Commit**

```bash
git add src/domains/notifications/notification.service.ts
git commit -m "feat(notifications): propaga externalId (Twilio SID) ao NotificationLog"
```

---

## Task 9: Trocar `provider: "z-api"` → `"twilio"` nas subscriptions e reminder

**Files:**
- Modify: `src/domains/notifications/subscriptions.ts`
- Modify: `src/shared/queue/jobs/appointment-reminder.ts`

- [ ] **Step 1: Atualizar `subscriptions.ts`** — substituir todos os `provider: "z-api"` por `provider: "twilio"`

No arquivo `src/domains/notifications/subscriptions.ts`, fazer a substituição em todos os 4 listeners. Exemplo (repetir para todos):

```typescript
await notificationService.logAndDispatch({
  tenantId,
  appointmentId: appointment.id,
  channel: NotificationChannel.WHATSAPP,
  template: "appointment-created",
  recipient: customer.phone,
  provider: "twilio",   // ← era "z-api"
  payload: { ... },
});
```

- [ ] **Step 2: Atualizar `appointment-reminder.ts`** — trocar `provider: "z-api"` por `provider: "twilio"`

```typescript
await notificationService.logAndDispatch({
  tenantId,
  appointmentId,
  customerId: appointment.customerId,
  channel: NotificationChannel.WHATSAPP,
  template: "appointment-reminder",
  recipient: appointment.customer.phone,
  provider: "twilio",   // ← era "z-api"
  payload: {
    appointmentId,
    startsAt: appointment.startsAt.toISOString(),
    customerName: appointment.customer.name,
    serviceName: appointment.service.name,
  },
});
```

- [ ] **Step 3: Confirmar sem referências ao Z-API**

```bash
grep -r "z-api" src/ --include="*.ts" || echo "Nenhuma referência encontrada"
```

Saída esperada: `Nenhuma referência encontrada`.

- [ ] **Step 4: Commit**

```bash
git add src/domains/notifications/subscriptions.ts src/shared/queue/jobs/appointment-reminder.ts
git commit -m "feat(notifications): troca provider z-api por twilio em subscriptions e appointment-reminder"
```

---

## Task 10: Cron de limpeza de histórico + registrar no runtime

**Files:**
- Create: `src/shared/queue/jobs/whatsapp-quota-reset.ts`
- Modify: `src/app/api/_lib/runtime.ts`

- [ ] **Step 1: Criar o job de limpeza**

```typescript
// src/shared/queue/jobs/whatsapp-quota-reset.ts
import type PgBoss from "pg-boss";

import { prisma } from "@/shared/database/prisma";

export const WHATSAPP_QUOTA_CLEANUP_JOB = "whatsapp-quota-cleanup";

export async function registerWhatsAppQuotaCleanup(boss: PgBoss): Promise<void> {
  await boss.schedule(
    WHATSAPP_QUOTA_CLEANUP_JOB,
    "0 2 1 * *", // dia 1 de cada mês, 02:00 UTC
    {},
  );

  await boss.work(WHATSAPP_QUOTA_CLEANUP_JOB, async () => {
    const now = new Date();
    const currentYearMonth = now.getFullYear() * 12 + (now.getMonth() + 1);
    const cutoff = currentYearMonth - 12;

    await prisma.$executeRaw`
      DELETE FROM "WhatsAppMonthlyUsage"
      WHERE (year * 12 + month) < ${cutoff}
    `;
  });
}
```

- [ ] **Step 2: Registrar o job no runtime**

```typescript
// src/app/api/_lib/runtime.ts
import { registerFinancialSubscriptions } from "@/domains/financial/subscriptions";
import { registerNotificationSubscriptions } from "@/domains/notifications/subscriptions";
import { registerBillingJobs } from "@/domains/billing/subscriptions";
import { startPgBoss } from "@/shared/queue/pg-boss";
import {
  APPOINTMENT_REMINDER_JOB,
  handleAppointmentReminder,
} from "@/shared/queue/jobs/appointment-reminder";
import { registerWhatsAppQuotaCleanup } from "@/shared/queue/jobs/whatsapp-quota-reset";

let initialized = false;

export function initializeDomainRuntime() {
  if (initialized) {
    return;
  }

  registerFinancialSubscriptions();
  registerNotificationSubscriptions();

  startPgBoss().then(async (boss) => {
    boss.work(APPOINTMENT_REMINDER_JOB, handleAppointmentReminder);
    registerBillingJobs(boss);
    await registerWhatsAppQuotaCleanup(boss);
  }).catch(console.error);

  initialized = true;
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "runtime\|quota-reset" || echo "ok"
```

- [ ] **Step 4: Commit**

```bash
git add src/shared/queue/jobs/whatsapp-quota-reset.ts src/app/api/_lib/runtime.ts
git commit -m "feat(queue): cron mensal de limpeza de histórico WhatsAppMonthlyUsage (> 12 meses)"
```

---

## Task 11: Webhook de status Twilio (TDD)

**Files:**
- Create: `src/app/api/webhooks/twilio/status/route.ts`
- Create: `src/app/api/webhooks/twilio/status/route.test.ts`

- [ ] **Step 1: Escrever os testes (devem falhar)**

```typescript
// src/app/api/webhooks/twilio/status/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@/shared/test/prisma-mock";
import { NotificationStatus } from "@prisma/client";

vi.mock("twilio", () => ({
  default: vi.fn(),
  validateRequest: vi.fn(),
}));

import twilio from "twilio";

// Import após os mocks
const { POST } = await import("./route");

function makeRequest(body: Record<string, string>, signature = "valid-sig") {
  return new Request("http://localhost/api/webhooks/twilio/status", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-twilio-signature": signature,
      "x-forwarded-for": "1.2.3.4",
    },
    body: new URLSearchParams(body).toString(),
  });
}

describe("POST /api/webhooks/twilio/status", () => {
  beforeEach(() => {
    vi.mocked(twilio.validateRequest).mockReturnValue(true);
    prismaMock.notificationLog.updateMany.mockResolvedValue({ count: 1 });
  });

  it("retorna 204 e atualiza log para status delivered → DELIVERED", async () => {
    const req = makeRequest({ MessageSid: "SM123", MessageStatus: "delivered" });
    const res = await POST(req);

    expect(res.status).toBe(204);
    expect(prismaMock.notificationLog.updateMany).toHaveBeenCalledWith({
      where: { externalId: "SM123" },
      data: { status: NotificationStatus.DELIVERED, errorMessage: null },
    });
  });

  it("retorna 204 e atualiza para SENT em status sent/queued", async () => {
    const req = makeRequest({ MessageSid: "SM123", MessageStatus: "sent" });
    const res = await POST(req);

    expect(res.status).toBe(204);
    expect(prismaMock.notificationLog.updateMany).toHaveBeenCalledWith({
      where: { externalId: "SM123" },
      data: { status: NotificationStatus.SENT, errorMessage: null },
    });
  });

  it("retorna 204 e atualiza para FAILED com ErrorCode", async () => {
    const req = makeRequest({
      MessageSid: "SM123",
      MessageStatus: "failed",
      ErrorCode: "30007",
    });
    const res = await POST(req);

    expect(res.status).toBe(204);
    expect(prismaMock.notificationLog.updateMany).toHaveBeenCalledWith({
      where: { externalId: "SM123" },
      data: { status: NotificationStatus.FAILED, errorMessage: "30007" },
    });
  });

  it("retorna 403 para assinatura Twilio inválida", async () => {
    vi.mocked(twilio.validateRequest).mockReturnValue(false);
    const req = makeRequest({ MessageSid: "SM123", MessageStatus: "delivered" }, "bad-sig");

    const res = await POST(req);

    expect(res.status).toBe(403);
    expect(prismaMock.notificationLog.updateMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar testes — confirmar FAIL**

```bash
npx vitest run src/app/api/webhooks/twilio/status/route.test.ts
```

- [ ] **Step 3: Implementar o webhook**

```typescript
// src/app/api/webhooks/twilio/status/route.ts
import twilio from "twilio";
import { NotificationStatus } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";

// Rate limiter in-memory — funciona por processo (não distribuído)
// Em produção com múltiplas instâncias, substituir por Upstash Redis
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60_000; // 1 minuto
  const maxRequests = 100;

  const entry = rateLimitStore.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + windowMs });
    return false;
  }
  if (entry.count >= maxRequests) return true;
  entry.count++;
  return false;
}

function mapTwilioStatus(twilioStatus: string): NotificationStatus {
  switch (twilioStatus) {
    case "delivered":
      return NotificationStatus.DELIVERED;
    case "failed":
    case "undelivered":
      return NotificationStatus.FAILED;
    default:
      return NotificationStatus.SENT;
  }
}

export async function POST(request: Request) {
  initializeDomainRuntime();

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";

  if (isRateLimited(ip)) {
    return new Response(null, { status: 429 });
  }

  const bodyText = await request.text();
  const params = new URLSearchParams(bodyText);
  const paramObject = Object.fromEntries(params.entries());

  const authToken = process.env.TWILIO_AUTH_TOKEN ?? "";
  const signature = request.headers.get("x-twilio-signature") ?? "";
  const url = `${process.env.APP_URL}/api/webhooks/twilio/status`;

  const isValid = twilio.validateRequest(authToken, signature, url, paramObject);
  if (!isValid) {
    return new Response(null, { status: 403 });
  }

  const messageSid = params.get("MessageSid");
  const messageStatus = params.get("MessageStatus") ?? "";
  const errorCode = params.get("ErrorCode") ?? null;

  if (!messageSid) {
    return new Response(null, { status: 400 });
  }

  const status = mapTwilioStatus(messageStatus);

  await prisma.notificationLog.updateMany({
    where: { externalId: messageSid },
    data: { status, errorMessage: errorCode },
  });

  return new Response(null, { status: 204 });
}
```

- [ ] **Step 4: Rodar testes — confirmar PASS**

```bash
npx vitest run src/app/api/webhooks/twilio/status/route.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/webhooks/twilio/status/
git commit -m "feat(webhook): endpoint POST /api/webhooks/twilio/status com validação de assinatura e mapeamento DELIVERED"
```

---

## Task 12: API de uso WhatsApp (TDD)

**Files:**
- Create: `src/app/api/whatsapp/usage/route.ts`
- Create: `src/app/api/whatsapp/usage/route.test.ts`

- [ ] **Step 1: Escrever os testes**

```typescript
// src/app/api/whatsapp/usage/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlanName, SubscriptionStatus } from "@prisma/client";

vi.mock("@/shared/auth/session", () => ({
  getSessionContext: vi.fn(),
}));

vi.mock("@/domains/billing/feature-guard", () => ({
  featureGuard: { assertAccess: vi.fn(), canAccess: vi.fn() },
  FEATURES: { WHATSAPP_BASIC: "whatsapp_basic" },
}));

vi.mock("@/domains/notifications/quota/whatsapp-quota.service", () => ({
  whatsAppQuotaService: { getUsage: vi.fn() },
}));

vi.mock("@/app/api/_lib/runtime", () => ({
  initializeDomainRuntime: vi.fn(),
}));

import { getSessionContext } from "@/shared/auth/session";
import { featureGuard } from "@/domains/billing/feature-guard";
import { whatsAppQuotaService } from "@/domains/notifications/quota/whatsapp-quota.service";
import { GET } from "./route";

function makeRequest() {
  return new Request("http://localhost/api/whatsapp/usage", {
    headers: { authorization: "Bearer token" },
  });
}

describe("GET /api/whatsapp/usage", () => {
  beforeEach(() => {
    vi.mocked(getSessionContext).mockResolvedValue({
      tenantId: "tenant-1",
      userId: "user-1",
      role: "OWNER",
    } as never);
    vi.mocked(featureGuard.assertAccess).mockResolvedValue(undefined);
    vi.mocked(whatsAppQuotaService.getUsage).mockResolvedValue({
      used: 347,
      limit: 500,
      resetDate: "2026-06-01",
    });
  });

  it("retorna dados de uso para tenant STARTER autenticado", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.used).toBe(347);
    expect(body.limit).toBe(500);
    expect(body.resetDate).toBe("2026-06-01");
  });

  it("retorna 403 quando feature gate falha (plano FREE)", async () => {
    const { PlanFeatureError } = await import("@/shared/errors");
    vi.mocked(featureGuard.assertAccess).mockRejectedValue(
      new PlanFeatureError("whatsapp_basic", PlanName.STARTER),
    );

    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Rodar testes — confirmar FAIL**

```bash
npx vitest run src/app/api/whatsapp/usage/route.test.ts
```

- [ ] **Step 3: Implementar o endpoint**

```typescript
// src/app/api/whatsapp/usage/route.ts
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { featureGuard, FEATURES } from "@/domains/billing/feature-guard";
import { whatsAppQuotaService } from "@/domains/notifications/quota/whatsapp-quota.service";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { prisma } from "@/shared/database/prisma";

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    await featureGuard.assertAccess(session.tenantId, FEATURES.WHATSAPP_BASIC);

    const usage = await whatsAppQuotaService.getUsage(session.tenantId);

    const tenant = await prisma.tenant.findFirst({
      where: { id: session.tenantId },
      select: { plan: true },
    });

    return Response.json({
      used: usage.used,
      limit: usage.limit,
      resetDate: usage.resetDate,
      plan: tenant?.plan ?? "STARTER",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 4: Rodar testes — confirmar PASS**

```bash
npx vitest run src/app/api/whatsapp/usage/route.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/whatsapp/usage/
git commit -m "feat(api): GET /api/whatsapp/usage com feature gate WHATSAPP_BASIC"
```

---

## Task 13: API de templates WhatsApp

**Files:**
- Create: `src/app/api/whatsapp/templates/route.ts`

- [ ] **Step 1: Implementar GET e PUT**

```typescript
// src/app/api/whatsapp/templates/route.ts
import { z } from "zod";

import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { featureGuard, FEATURES } from "@/domains/billing/feature-guard";
import { prisma } from "@/shared/database/prisma";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";

const TEMPLATE_DEFAULTS: Record<string, { mensagemPrincipal: string; mensagemFinal: string }> = {
  confirmacao:        { mensagemPrincipal: "Seu agendamento foi criado.", mensagemFinal: "Até lá!" },
  confirmado:         { mensagemPrincipal: "Seu agendamento está confirmado.", mensagemFinal: "Te esperamos!" },
  lembrete:           { mensagemPrincipal: "Lembrete:", mensagemFinal: "Até lá!" },
  cancelamento:       { mensagemPrincipal: "Seu agendamento foi cancelado.", mensagemFinal: "Para reagendar, entre em contato conosco." },
  nao_comparecimento: { mensagemPrincipal: "Notamos que você não compareceu ao seu horário.", mensagemFinal: "Quando quiser reagendar, estamos à disposição!" },
};

const updateTemplateSchema = z.object({
  template: z.enum([
    "confirmacao",
    "confirmado",
    "lembrete",
    "cancelamento",
    "nao_comparecimento",
  ]),
  mensagemPrincipal: z.string().min(1).max(120),
  mensagemFinal: z.string().min(1).max(80),
});

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.view);
    await featureGuard.assertAccess(session.tenantId, FEATURES.WHATSAPP_BASIC);

    const tenant = await prisma.tenant.findFirst({
      where: { id: session.tenantId },
      select: { whatsappTemplateConfig: true },
    });

    const savedConfig = (tenant?.whatsappTemplateConfig ?? {}) as Record<
      string,
      { mensagemPrincipal?: string; mensagemFinal?: string }
    >;

    const result = Object.fromEntries(
      Object.entries(TEMPLATE_DEFAULTS).map(([key, defaults]) => [
        key,
        {
          mensagemPrincipal: savedConfig[key]?.mensagemPrincipal ?? defaults.mensagemPrincipal,
          mensagemFinal: savedConfig[key]?.mensagemFinal ?? defaults.mensagemFinal,
        },
      ]),
    );

    return Response.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.manage);
    await featureGuard.assertAccess(session.tenantId, FEATURES.WHATSAPP_BASIC);

    const input = await validateInput(request, updateTemplateSchema);

    const current = await prisma.tenant.findFirst({
      where: { id: session.tenantId },
      select: { whatsappTemplateConfig: true },
    });

    const existing = (current?.whatsappTemplateConfig ?? {}) as Record<string, unknown>;

    await prisma.tenant.update({
      where: { id: session.tenantId },
      data: {
        whatsappTemplateConfig: {
          ...existing,
          [input.template]: {
            mensagemPrincipal: input.mensagemPrincipal,
            mensagemFinal: input.mensagemFinal,
          },
        },
      },
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "whatsapp/templates" || echo "ok"
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/whatsapp/templates/
git commit -m "feat(api): GET e PUT /api/whatsapp/templates para personalização de mensagens por tenant"
```

---

## Task 14: Reescrever `notifications/settings/route.ts` — remover Z-API

**Files:**
- Modify: `src/app/api/notifications/settings/route.ts`

- [ ] **Step 1: Reescrever o arquivo**

```typescript
// src/app/api/notifications/settings/route.ts
import { z } from "zod";

import { prisma } from "@/shared/database/prisma";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { featureGuard, FEATURES } from "@/domains/billing/feature-guard";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";
import { ForbiddenError } from "@/shared/errors";

const SUPPORTED_TIMEZONES = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Belem",
  "America/Fortaleza",
  "America/Recife",
  "America/Maceio",
  "America/Bahia",
  "America/Porto_Velho",
  "America/Boa_Vista",
  "America/Rio_Branco",
  "America/Noronha",
] as const;

const updateNotificationSettingsSchema = z.object({
  whatsappEnabled: z.boolean().optional(),
  timezone: z.enum(SUPPORTED_TIMEZONES).optional(),
});

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.view);

    const tenant = await prisma.tenant.findFirst({
      where: { id: session.tenantId },
      select: { whatsappEnabled: true, timezone: true, plan: true },
    });

    return Response.json(
      tenant ?? { whatsappEnabled: false, timezone: "America/Sao_Paulo", plan: "FREE" },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.manage);

    const input = await validateInput(request, updateNotificationSettingsSchema);

    // Impede tenants FREE de ativar WhatsApp
    if (input.whatsappEnabled === true) {
      const hasAccess = await featureGuard.canAccess(
        session.tenantId,
        FEATURES.WHATSAPP_BASIC,
      );
      if (!hasAccess) {
        throw new ForbiddenError(
          "WhatsApp requer plano STARTER ou superior.",
        );
      }
    }

    const tenant = await prisma.tenant.update({
      where: { id: session.tenantId },
      data: input,
      select: { whatsappEnabled: true, timezone: true, plan: true },
    });

    return Response.json(tenant);
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 2: Verificar TypeScript — confirmar que não há mais referências a zApiInstanceId/zApiToken**

```bash
npx tsc --noEmit 2>&1 | grep "zApi" || echo "ok"
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/notifications/settings/route.ts
git commit -m "feat(api): reescreve /api/notifications/settings — remove Z-API, adiciona timezone e guard de plano FREE"
```

---

## Task 15: Reescrever `whatsapp-settings-form.tsx` + atualizar hook

**Files:**
- Modify: `src/hooks/settings/use-notification-settings.ts`
- Modify: `src/components/domain/settings/whatsapp-settings-form.tsx`

- [ ] **Step 1: Atualizar o hook `use-notification-settings.ts`**

```typescript
// src/hooks/settings/use-notification-settings.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type NotificationSettings = {
  whatsappEnabled: boolean;
  timezone: string;
  plan: string;
};

type UpdateNotificationSettings = {
  whatsappEnabled?: boolean;
  timezone?: string;
};

async function fetchNotificationSettings(): Promise<NotificationSettings> {
  const res = await fetch("/api/notifications/settings");
  if (!res.ok) throw new Error("Erro ao buscar configurações");
  return res.json() as Promise<NotificationSettings>;
}

async function updateNotificationSettings(
  input: UpdateNotificationSettings,
): Promise<NotificationSettings> {
  const res = await fetch("/api/notifications/settings", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Erro ao salvar configurações");
  return res.json() as Promise<NotificationSettings>;
}

export function useNotificationSettings() {
  return useQuery({
    queryKey: ["notification-settings"],
    queryFn: fetchNotificationSettings,
  });
}

export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateNotificationSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-settings"] });
    },
  });
}
```

- [ ] **Step 2: Reescrever o formulário `whatsapp-settings-form.tsx`**

```typescript
// src/components/domain/settings/whatsapp-settings-form.tsx
"use client";

import { MessageCircle, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useNotificationSettings,
  useUpdateNotificationSettings,
} from "@/hooks/settings/use-notification-settings";

const TIMEZONES = [
  { value: "America/Sao_Paulo",   label: "Brasília (UTC-3)" },
  { value: "America/Manaus",      label: "Manaus (UTC-4)" },
  { value: "America/Belem",       label: "Belém (UTC-3)" },
  { value: "America/Fortaleza",   label: "Fortaleza (UTC-3)" },
  { value: "America/Recife",      label: "Recife (UTC-3)" },
  { value: "America/Maceio",      label: "Maceió (UTC-3)" },
  { value: "America/Bahia",       label: "Salvador (UTC-3)" },
  { value: "America/Porto_Velho", label: "Porto Velho (UTC-4)" },
  { value: "America/Boa_Vista",   label: "Boa Vista (UTC-4)" },
  { value: "America/Rio_Branco",  label: "Rio Branco (UTC-5)" },
  { value: "America/Noronha",     label: "Fernando de Noronha (UTC-2)" },
];

export function WhatsAppSettingsForm() {
  const { data, isLoading } = useNotificationSettings();
  const { mutate, isPending } = useUpdateNotificationSettings();

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />;
  }

  const isFree = data?.plan === "FREE";
  const isEnabled = data?.whatsappEnabled ?? false;

  if (isFree) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <Lock className="mt-0.5 size-5 shrink-0 text-slate-400" />
        <div>
          <p className="font-medium text-slate-700">WhatsApp não disponível no plano Free</p>
          <p className="mt-1 text-sm text-slate-500">
            Faça upgrade para o plano Starter ou superior para ativar notificações automáticas via WhatsApp.
          </p>
        </div>
      </div>
    );
  }

  function handleToggle() {
    mutate({ whatsappEnabled: !isEnabled });
  }

  function handleTimezoneChange(value: string) {
    mutate({ timezone: value });
  }

  return (
    <div className="space-y-6">
      {/* Toggle WhatsApp */}
      <div className="flex items-center justify-between rounded-2xl border border-white/80 bg-white/85 px-5 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="inline-flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <MessageCircle className="size-5" />
          </div>
          <div>
            <p className="font-medium text-slate-950">Notificações WhatsApp</p>
            <p className="text-xs text-slate-500">
              Confirmações e lembretes automáticos via Twilio
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            className={
              isEnabled
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-100 text-slate-500"
            }
          >
            {isEnabled ? "Ativo" : "Inativo"}
          </Badge>
          <Button
            variant={isEnabled ? "destructive" : "default"}
            size="sm"
            onClick={handleToggle}
            disabled={isPending}
          >
            {isEnabled ? "Desativar" : "Ativar"}
          </Button>
        </div>
      </div>

      {/* Timezone */}
      <div className="space-y-2">
        <Label htmlFor="timezone">Fuso horário do negócio</Label>
        <Select
          value={data?.timezone ?? "America/Sao_Paulo"}
          onValueChange={handleTimezoneChange}
          disabled={isPending}
        >
          <SelectTrigger id="timezone" className="w-full sm:w-72">
            <SelectValue placeholder="Selecione o fuso horário" />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((tz) => (
              <SelectItem key={tz.value} value={tz.value}>
                {tz.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-slate-400">
          Usado para formatar datas e horários nas mensagens enviadas ao cliente.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "whatsapp-settings" || echo "ok"
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/settings/use-notification-settings.ts src/components/domain/settings/whatsapp-settings-form.tsx
git commit -m "feat(frontend): reescreve WhatsAppSettingsForm — remove Z-API, adiciona timezone e guard para plano FREE"
```

---

## Task 16: Componente `WhatsAppUsageCard`

**Files:**
- Create: `src/components/domain/settings/whatsapp-usage-card.tsx`

- [ ] **Step 1: Criar o hook de uso**

Adicionar ao arquivo `src/hooks/settings/use-notification-settings.ts` (ao final):

```typescript
// Adicionar ao final de src/hooks/settings/use-notification-settings.ts

export type WhatsAppUsage = {
  used: number;
  limit: number;
  resetDate: string;
  plan: string;
};

async function fetchWhatsAppUsage(): Promise<WhatsAppUsage> {
  const res = await fetch("/api/whatsapp/usage");
  if (!res.ok) throw new Error("Erro ao buscar uso WhatsApp");
  return res.json() as Promise<WhatsAppUsage>;
}

export function useWhatsAppUsage() {
  return useQuery({
    queryKey: ["whatsapp-usage"],
    queryFn: fetchWhatsAppUsage,
  });
}
```

- [ ] **Step 2: Criar o componente**

```typescript
// src/components/domain/settings/whatsapp-usage-card.tsx
"use client";

import { useWhatsAppUsage } from "@/hooks/settings/use-notification-settings";

function formatResetDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

export function WhatsAppUsageCard() {
  const { data, isLoading } = useWhatsAppUsage();

  if (isLoading) {
    return <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />;
  }

  if (!data) return null;

  const { used, limit, resetDate } = data;
  const percent = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const isNearLimit = percent >= 90;

  return (
    <div className="rounded-2xl border border-white/80 bg-white/85 p-5 shadow-sm">
      <p className="mb-3 text-sm font-semibold text-slate-700">
        Mensagens WhatsApp este mês
      </p>

      <div className="mb-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${
            isNearLimit ? "bg-red-500" : "bg-emerald-500"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          <span className={isNearLimit ? "font-semibold text-red-600" : "font-semibold text-slate-700"}>
            {used.toLocaleString("pt-BR")}
          </span>{" "}
          / {limit.toLocaleString("pt-BR")} mensagens
        </span>
        <span>Renova em {formatResetDate(resetDate)}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Integrar no `whatsapp-settings-form.tsx`**

Adicionar import e renderizar o `WhatsAppUsageCard` abaixo do toggle, visível apenas quando `isEnabled`:

```typescript
// Adicionar ao topo dos imports em whatsapp-settings-form.tsx:
import { WhatsAppUsageCard } from "./whatsapp-usage-card";

// Adicionar após o bloco do toggle (dentro do return, após o div do toggle):
{isEnabled && (
  <WhatsAppUsageCard />
)}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/domain/settings/whatsapp-usage-card.tsx src/hooks/settings/use-notification-settings.ts src/components/domain/settings/whatsapp-settings-form.tsx
git commit -m "feat(frontend): WhatsAppUsageCard com barra de progresso e data de renovação"
```

---

## Task 17: Componente `WhatsAppTemplateEditor`

**Files:**
- Create: `src/components/domain/settings/whatsapp-template-editor.tsx`

- [ ] **Step 1: Adicionar hooks de templates ao hook file**

Adicionar ao final de `src/hooks/settings/use-notification-settings.ts`:

```typescript
// Adicionar ao final de src/hooks/settings/use-notification-settings.ts

export type TemplateConfig = {
  mensagemPrincipal: string;
  mensagemFinal: string;
};

export type WhatsAppTemplates = Record<string, TemplateConfig>;

async function fetchWhatsAppTemplates(): Promise<WhatsAppTemplates> {
  const res = await fetch("/api/whatsapp/templates");
  if (!res.ok) throw new Error("Erro ao buscar templates");
  return res.json() as Promise<WhatsAppTemplates>;
}

async function updateWhatsAppTemplate(input: {
  template: string;
  mensagemPrincipal: string;
  mensagemFinal: string;
}): Promise<void> {
  const res = await fetch("/api/whatsapp/templates", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Erro ao salvar template");
}

export function useWhatsAppTemplates() {
  return useQuery({
    queryKey: ["whatsapp-templates"],
    queryFn: fetchWhatsAppTemplates,
  });
}

export function useUpdateWhatsAppTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateWhatsAppTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
    },
  });
}
```

- [ ] **Step 2: Criar o componente editor**

```typescript
// src/components/domain/settings/whatsapp-template-editor.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useWhatsAppTemplates,
  useUpdateWhatsAppTemplate,
} from "@/hooks/settings/use-notification-settings";

type TemplateName =
  | "confirmacao"
  | "confirmado"
  | "lembrete"
  | "cancelamento"
  | "nao_comparecimento";

const TEMPLATE_LABELS: Record<TemplateName, string> = {
  confirmacao:        "Confirmação de agendamento",
  confirmado:         "Agendamento confirmado",
  lembrete:           "Lembrete 24h antes",
  cancelamento:       "Cancelamento",
  nao_comparecimento: "Não comparecimento",
};

function buildPreview(
  template: TemplateName,
  principal: string,
  final: string,
): string {
  const c = {
    nome: "João Silva",
    data: "28/05/2026",
    hora: "14:00",
    servico: "Corte",
    salao: "Seu Negócio",
    link: "https://app.com/agendar/seu-negocio",
  };
  switch (template) {
    case "confirmacao":
      return `Olá, ${c.nome}! ${principal} 📅 ${c.data} às ${c.hora} | ${c.servico} | ${c.salao}. ${final} ${c.link}`;
    case "confirmado":
      return `✅ ${c.nome}, ${principal}! 📅 ${c.data} às ${c.hora} | ${c.servico} | ${c.salao}. ${final} ${c.link}`;
    case "lembrete":
      return `Olá, ${c.nome}! 👋 ${principal} Amanhã às ${c.hora} para ${c.servico} no ${c.salao}. ${final}`;
    case "cancelamento":
      return `Olá, ${c.nome}. ${principal} ${c.servico} | ${c.salao}. ${final}`;
    case "nao_comparecimento":
      return `Olá, ${c.nome}! 😕 ${principal} ${c.servico} | ${c.salao}. ${final}`;
  }
}

export function WhatsAppTemplateEditor() {
  const { data: templates, isLoading } = useWhatsAppTemplates();
  const { mutate, isPending } = useUpdateWhatsAppTemplate();

  const [selected, setSelected] = useState<TemplateName>("confirmacao");
  const [principal, setPrincipal] = useState("");
  const [final, setFinal] = useState("");

  useEffect(() => {
    if (templates?.[selected]) {
      setPrincipal(templates[selected].mensagemPrincipal);
      setFinal(templates[selected].mensagemFinal);
    }
  }, [templates, selected]);

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />;
  }

  function handleSave() {
    mutate({ template: selected, mensagemPrincipal: principal, mensagemFinal: final });
  }

  const preview = buildPreview(selected, principal, final);
  const principalOver = principal.length > 120;
  const finalOver = final.length > 80;

  return (
    <div className="space-y-4 rounded-2xl border border-white/80 bg-white/85 p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-700">Personalizar mensagens</p>

      <div className="space-y-2">
        <Label>Template</Label>
        <Select
          value={selected}
          onValueChange={(v) => setSelected(v as TemplateName)}
        >
          <SelectTrigger className="w-full sm:w-80">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(TEMPLATE_LABELS) as TemplateName[]).map((key) => (
              <SelectItem key={key} value={key}>
                {TEMPLATE_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label htmlFor="principal">Mensagem principal</Label>
          <span className={`text-xs ${principalOver ? "text-red-500" : "text-slate-400"}`}>
            {principal.length}/120
          </span>
        </div>
        <Textarea
          id="principal"
          value={principal}
          onChange={(e) => setPrincipal(e.target.value)}
          rows={2}
          className="resize-none"
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label htmlFor="final">Mensagem de encerramento</Label>
          <span className={`text-xs ${finalOver ? "text-red-500" : "text-slate-400"}`}>
            {final.length}/80
          </span>
        </div>
        <Textarea
          id="final"
          value={final}
          onChange={(e) => setFinal(e.target.value)}
          rows={2}
          className="resize-none"
        />
      </div>

      <div className="rounded-xl bg-slate-50 p-3">
        <p className="mb-1 text-xs font-medium text-slate-500">Prévia</p>
        <p className="text-sm text-slate-700">{preview}</p>
      </div>

      <Button
        onClick={handleSave}
        disabled={isPending || principalOver || finalOver}
        className="w-full sm:w-auto"
      >
        {isPending ? "Salvando..." : "Salvar personalização"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Integrar na `whatsapp-settings-form.tsx`**

Adicionar import e renderizar após o `WhatsAppUsageCard`:

```typescript
// Adicionar ao topo dos imports em whatsapp-settings-form.tsx:
import { WhatsAppTemplateEditor } from "./whatsapp-template-editor";

// Adicionar após o WhatsAppUsageCard:
{isEnabled && (
  <>
    <WhatsAppUsageCard />
    <WhatsAppTemplateEditor />
  </>
)}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/domain/settings/whatsapp-template-editor.tsx src/hooks/settings/use-notification-settings.ts src/components/domain/settings/whatsapp-settings-form.tsx
git commit -m "feat(frontend): WhatsAppTemplateEditor com dropdown, preview em tempo real e limite de caracteres"
```

---

## Task 18: Verificação final — TypeScript + testes completos

**Files:** Nenhum novo arquivo.

- [ ] **Step 1: Verificar TypeScript sem erros**

```bash
npx tsc --noEmit
```

Saída esperada: nenhum erro. Se houver erros, corrigi-los antes de continuar.

- [ ] **Step 2: Rodar suíte completa de testes**

```bash
npx vitest run
```

Saída esperada: todos os testes passando. Nenhum `FAIL`.

- [ ] **Step 3: Verificar que não há referências residuais ao Z-API**

```bash
grep -r "z-api\|zApiInstanceId\|zApiToken\|z_api\|ZAPI" src/ --include="*.ts" --include="*.tsx" -l
```

Saída esperada: nenhuma linha.

- [ ] **Step 4: Confirmar que migration foi aplicada e schema está sincronizado**

```bash
npx prisma migrate status
```

Saída esperada: `Database schema is up to date!`

- [ ] **Step 5: Commit final se houver ajustes**

```bash
git add -A
git commit -m "chore(whatsapp): ajustes finais de TypeScript e testes"
```

- [ ] **Step 6: Abrir Pull Request**

```bash
git push origin HEAD
gh pr create \
  --title "feat(whatsapp): Twilio Fase 1 — transacionais, quota, templates customizáveis" \
  --body "$(cat <<'EOF'
## Resumo

- Substitui provider Z-API (não-oficial) por Twilio WhatsApp Business API oficial
- 5 templates UTILITY com variáveis customizáveis por tenant via painel
- Quota mensal por plano: FREE=0, STARTER=500, PRO=2000, ENTERPRISE=5000
- Webhook de status com validação de assinatura Twilio e status DELIVERED
- Timezone por tenant para formatação correta de datas nas mensagens
- Guard de plano: tenants FREE não podem ativar WhatsApp
- Rate limiting no webhook (100 req/min por IP, in-memory)

## Arquivos principais

- `src/domains/notifications/providers/whatsapp.provider.ts` — provider completo
- `src/domains/notifications/quota/whatsapp-quota.service.ts` — controle de quota
- `src/app/api/webhooks/twilio/status/route.ts` — webhook de entrega
- `src/components/domain/settings/whatsapp-template-editor.tsx` — editor de templates

## Como testar

1. Configurar `.env.local` com credenciais Twilio Sandbox
2. Ativar sandbox: enviar "join [palavra-chave]" para `+14155238886`
3. Ativar WhatsApp em Configurações → WhatsApp (plano STARTER+)
4. Criar um agendamento — mensagem deve chegar no celular de teste

## Dependências

- Portal de agendamento público (`/agendar/{slug}`) — Fase 2
  - Link `{{8}}` nos templates de confirmação aponta para esta URL (ainda 404)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Auto-revisão do plano contra a spec

### Cobertura de requisitos

| Requisito da spec | Task |
|---|---|
| Remover `zApiInstanceId`/`zApiToken` do schema | Task 2 |
| Adicionar `timezone` ao Tenant | Task 2 |
| Adicionar `DELIVERED` ao enum `NotificationStatus` | Task 2 |
| Adicionar `WhatsAppMonthlyUsage` | Task 2 |
| Adicionar `externalId` ao `NotificationLog` | Task 2 |
| Campos consent no `Customer` | Task 2 |
| `maxWhatsAppPerMonth` em `billing/types.ts` | Task 3 |
| `InvalidPhoneError` tipado | Task 4 |
| `externalId` no `NotificationDeliveryResult` | Task 5 |
| Quota service: `checkAndIncrement`, `decrement`, `getUsage` | Task 6 |
| Provider Twilio com `buildTemplateParams` (payload flat) | Task 7 |
| Validação de SIDs na inicialização | Task 7 |
| Rollback de quota em falha de rede | Task 7 |
| Retry max 2x com delay 1s | Task 7 |
| `toWhatsAppNumber` com `InvalidPhoneError` | Task 7 |
| Templates com 8 variáveis para confirmacao/confirmado | Task 7 |
| Valores padrão de templates | Task 7 |
| `buildTemplateParams` não acessa `startsAt` para cancelamento/no-show | Task 7 |
| Propagação de `externalId` ao log | Task 8 |
| Troca de `provider: "z-api"` para `"twilio"` | Task 9 |
| Cron de limpeza de histórico > 12 meses | Task 10 |
| Registro do cron no runtime | Task 10 |
| Webhook com validação de assinatura Twilio | Task 11 |
| Webhook com status `DELIVERED` | Task 11 |
| Rate limiting 100 req/min no webhook | Task 11 |
| `GET /api/whatsapp/usage` com feature gate | Task 12 |
| `GET` e `PUT /api/whatsapp/templates` | Task 13 |
| `/api/notifications/settings` reescrito sem Z-API | Task 14 |
| Guard de plano FREE no PATCH | Task 14 |
| `whatsapp-settings-form.tsx` reescrito sem Z-API | Task 15 |
| Seletor de timezone | Task 15 |
| Guard para plano FREE na UI | Task 15 |
| `WhatsAppUsageCard` com barra de progresso | Task 16 |
| `WhatsAppTemplateEditor` com preview em tempo real | Task 17 |
| TypeScript + testes passando | Task 18 |
| PR aberta para `main` | Task 18 |
