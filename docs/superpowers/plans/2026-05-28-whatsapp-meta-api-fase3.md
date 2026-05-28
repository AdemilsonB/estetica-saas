# WhatsApp Meta API — Fase 3: Execução + Remoção do Z-API

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Pré-requisito:** Fases 1 e 2 completas e mergeadas.

**Goal:** Implementar a camada de execução do domínio `whatsapp` — mensagens, anti-spam, engagement, subscriptions que escutam `automation.action.requested` e enviam via Meta API. Remover Z-API completamente. Adicionar API routes de histórico.

**Architecture:** `whatsapp/subscriptions.ts` escuta `automation.action.requested` e `whatsapp.message.status.updated` e `whatsapp.optout.received`. Anti-spam valida em 3 camadas antes de chamar `meta.client.sendTemplate`. Migration remove campos Z-API do Tenant.

**Tech Stack:** Next.js 15, Prisma, Zod, Vitest.

**Branch:** continua em `feat/whatsapp-meta-api`.

---

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| `src/domains/whatsapp/messages/message.repository.ts` | Criar |
| `src/domains/whatsapp/messages/message.repository.test.ts` | Criar |
| `src/domains/whatsapp/engagement/engagement.service.ts` | Criar |
| `src/domains/whatsapp/engagement/engagement.service.test.ts` | Criar |
| `src/domains/whatsapp/anti-spam/antispam.service.ts` | Criar |
| `src/domains/whatsapp/anti-spam/antispam.service.test.ts` | Criar |
| `src/domains/whatsapp/subscriptions.ts` | Criar |
| `src/domains/notifications/providers/whatsapp.provider.ts` | Modificar — remove Z-API, delega via eventBus |
| `src/shared/queue/jobs/appointment-reminder.ts` | Modificar — remove provider "z-api" |
| `src/app/api/whatsapp/messages/route.ts` | Criar |
| `prisma/schema.prisma` | Modificar — remove campos Z-API do Tenant |

---

### Task 14: WhatsAppMessage repository

**Files:**
- Create: `src/domains/whatsapp/messages/message.repository.ts`
- Create: `src/domains/whatsapp/messages/message.repository.test.ts`

- [ ] **Step 1: Criar message.repository.ts**

```typescript
// src/domains/whatsapp/messages/message.repository.ts
import type { WhatsAppMessageStatus } from "@prisma/client";
import { prisma } from "@/shared/database/prisma";

export type CreateMessageInput = {
  tenantId: string;
  customerId?: string;
  templateId?: string;
  recipient: string;
  templateName: string;
  variables: Record<string, string>;
  origin: "automation" | "transactional" | "manual";
};

export type MessageFilters = {
  status?: WhatsAppMessageStatus;
  customerId?: string;
  page?: number;
  pageSize?: number;
};

export class WhatsAppMessageRepository {
  async create(input: CreateMessageInput) {
    return prisma.whatsAppMessage.create({
      data: {
        tenantId: input.tenantId,
        customerId: input.customerId,
        templateId: input.templateId,
        recipient: input.recipient,
        templateName: input.templateName,
        variables: input.variables,
        origin: input.origin,
        status: "QUEUED",
      },
    });
  }

  async updateByMetaMessageId(
    metaMessageId: string,
    status: WhatsAppMessageStatus,
    data: {
      sentAt?: Date;
      deliveredAt?: Date;
      readAt?: Date;
      failedAt?: Date;
      failureReason?: string;
    },
  ) {
    return prisma.whatsAppMessage.updateMany({
      where: { metaMessageId },
      data: { status, ...data },
    });
  }

  async updateMetaId(id: string, metaMessageId: string) {
    return prisma.whatsAppMessage.update({
      where: { id },
      data: { metaMessageId, status: "SENT", sentAt: new Date() },
    });
  }

  async findAll(tenantId: string, filters: MessageFilters = {}) {
    const { status, customerId, page = 1, pageSize = 20 } = filters;
    const skip = (page - 1) * pageSize;

    const where = {
      tenantId,
      ...(status ? { status } : {}),
      ...(customerId ? { customerId } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.whatsAppMessage.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: { customer: { select: { id: true, name: true } } },
      }),
      prisma.whatsAppMessage.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async getMetrics(tenantId: string) {
    const [sent, delivered, read, failed] = await Promise.all([
      prisma.whatsAppMessage.count({ where: { tenantId, status: { in: ["SENT", "DELIVERED", "READ"] } } }),
      prisma.whatsAppMessage.count({ where: { tenantId, status: { in: ["DELIVERED", "READ"] } } }),
      prisma.whatsAppMessage.count({ where: { tenantId, status: "READ" } }),
      prisma.whatsAppMessage.count({ where: { tenantId, status: "FAILED" } }),
    ]);

    return { sent, delivered, read, failed };
  }
}

export const whatsAppMessageRepository = new WhatsAppMessageRepository();
```

- [ ] **Step 2: Escrever testes**

```typescript
// src/domains/whatsapp/messages/message.repository.test.ts
import { describe, it, expect } from "vitest";
import { prismaMock } from "@/shared/test/prisma-mock";
import { WhatsAppMessageRepository } from "./message.repository";
import { makeWhatsAppMessage } from "@/shared/test/factories/whatsapp.factory";

const repo = new WhatsAppMessageRepository();

describe("WhatsAppMessageRepository", () => {
  it("create persiste mensagem com status QUEUED", async () => {
    const msg = makeWhatsAppMessage({ status: "QUEUED", metaMessageId: null });
    prismaMock.whatsAppMessage.create.mockResolvedValue(msg);

    await repo.create({
      tenantId: "t-1", recipient: "5511999999999",
      templateName: "retorno_cliente", variables: { "1": "João" },
      origin: "automation",
    });

    expect(prismaMock.whatsAppMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "QUEUED" }) }),
    );
  });

  it("updateByMetaMessageId atualiza status", async () => {
    prismaMock.whatsAppMessage.updateMany.mockResolvedValue({ count: 1 });

    await repo.updateByMetaMessageId("wamid.abc", "DELIVERED", { deliveredAt: new Date() });

    expect(prismaMock.whatsAppMessage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { metaMessageId: "wamid.abc" } }),
    );
  });

  it("findAll aplica filtros e paginação", async () => {
    prismaMock.whatsAppMessage.findMany.mockResolvedValue([]);
    prismaMock.whatsAppMessage.count.mockResolvedValue(0);

    const result = await repo.findAll("t-1", { page: 2, pageSize: 10 });

    expect(result.page).toBe(2);
    expect(prismaMock.whatsAppMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
  });
});
```

- [ ] **Step 3: Rodar testes**

```bash
npx vitest run src/domains/whatsapp/messages/message.repository.test.ts
```

Esperado: 3 passed.

- [ ] **Step 4: Commit**

```bash
git add src/domains/whatsapp/messages/
git commit -m "feat(whatsapp): WhatsAppMessageRepository — create, updateStatus, findAll, métricas"
```

---

### Task 15: Engagement service

**Files:**
- Create: `src/domains/whatsapp/engagement/engagement.service.ts`
- Create: `src/domains/whatsapp/engagement/engagement.service.test.ts`

- [ ] **Step 1: Criar engagement.service.ts**

```typescript
// src/domains/whatsapp/engagement/engagement.service.ts
import { prisma } from "@/shared/database/prisma";

const SCORE_DELIVERED = 1;
const SCORE_READ = 5;
const SCORE_REPLIED = 10;
const SCORE_BLOCKED = -50;

export class EngagementService {
  async getOrCreate(tenantId: string, customerId: string) {
    return prisma.whatsAppEngagement.upsert({
      where: { customerId },
      create: { tenantId, customerId, score: 50 },
      update: {},
    });
  }

  async onMessageDelivered(tenantId: string, customerId: string) {
    await this.adjustScore(tenantId, customerId, SCORE_DELIVERED, {
      totalSent: { increment: 1 },
      lastSentAt: new Date(),
    });
  }

  async onMessageRead(tenantId: string, customerId: string) {
    await this.adjustScore(tenantId, customerId, SCORE_READ, {
      totalRead: { increment: 1 },
    });
  }

  async onMessageReplied(tenantId: string, customerId: string) {
    await this.adjustScore(tenantId, customerId, SCORE_REPLIED, {
      totalReplied: { increment: 1 },
    });
  }

  async onBlocked(tenantId: string, customerId: string) {
    await prisma.whatsAppEngagement.upsert({
      where: { customerId },
      create: { tenantId, customerId, score: 0, blockedAt: new Date() },
      update: { score: 0, blockedAt: new Date() },
    });
  }

  async isBlocked(customerId: string): Promise<boolean> {
    const e = await prisma.whatsAppEngagement.findUnique({ where: { customerId } });
    return !!(e?.blockedAt || (e?.score !== undefined && e.score <= 10));
  }

  private async adjustScore(
    tenantId: string,
    customerId: string,
    delta: number,
    extra: Record<string, unknown> = {},
  ) {
    const existing = await this.getOrCreate(tenantId, customerId);
    const newScore = Math.max(0, Math.min(100, existing.score + delta));

    await prisma.whatsAppEngagement.update({
      where: { customerId },
      data: { score: newScore, ...extra },
    });
  }
}

export const engagementService = new EngagementService();
```

- [ ] **Step 2: Escrever testes**

```typescript
// src/domains/whatsapp/engagement/engagement.service.test.ts
import { describe, it, expect } from "vitest";
import { prismaMock } from "@/shared/test/prisma-mock";
import { EngagementService } from "./engagement.service";

const service = new EngagementService();

const makeEngagement = (overrides = {}) => ({
  id: "eng-1", tenantId: "t-1", customerId: "c-1",
  score: 50, totalSent: 0, totalRead: 0, totalReplied: 0,
  blockedAt: null, lastSentAt: null, updatedAt: new Date(), ...overrides,
});

describe("EngagementService", () => {
  it("onMessageRead incrementa score em 5", async () => {
    prismaMock.whatsAppEngagement.upsert.mockResolvedValue(makeEngagement({ score: 50 }));
    prismaMock.whatsAppEngagement.update.mockResolvedValue(makeEngagement({ score: 55 }));

    await service.onMessageRead("t-1", "c-1");

    expect(prismaMock.whatsAppEngagement.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ score: 55 }) }),
    );
  });

  it("onBlocked zera score e registra blockedAt", async () => {
    prismaMock.whatsAppEngagement.upsert.mockResolvedValue(makeEngagement({ score: 0, blockedAt: new Date() }));

    await service.onBlocked("t-1", "c-1");

    expect(prismaMock.whatsAppEngagement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ score: 0, blockedAt: expect.any(Date) }),
      }),
    );
  });

  it("isBlocked retorna true quando score <= 10", async () => {
    prismaMock.whatsAppEngagement.findUnique.mockResolvedValue(makeEngagement({ score: 5 }));
    const result = await service.isBlocked("c-1");
    expect(result).toBe(true);
  });

  it("score nunca excede 100", async () => {
    prismaMock.whatsAppEngagement.upsert.mockResolvedValue(makeEngagement({ score: 98 }));
    prismaMock.whatsAppEngagement.update.mockResolvedValue(makeEngagement({ score: 100 }));

    await service.onMessageRead("t-1", "c-1");

    expect(prismaMock.whatsAppEngagement.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ score: 100 }) }),
    );
  });
});
```

- [ ] **Step 3: Rodar testes**

```bash
npx vitest run src/domains/whatsapp/engagement/engagement.service.test.ts
```

Esperado: 4 passed.

- [ ] **Step 4: Commit**

```bash
git add src/domains/whatsapp/engagement/
git commit -m "feat(whatsapp): EngagementService — score 0-100 com delivered/read/blocked"
```

---

### Task 16: Anti-spam service

**Files:**
- Create: `src/domains/whatsapp/anti-spam/antispam.service.ts`
- Create: `src/domains/whatsapp/anti-spam/antispam.service.test.ts`

- [ ] **Step 1: Criar antispam.service.ts**

```typescript
// src/domains/whatsapp/anti-spam/antispam.service.ts
import { prisma } from "@/shared/database/prisma";
import { engagementService } from "../engagement/engagement.service";

export type CanSendResult =
  | { allowed: true }
  | { allowed: false; reason: "optout" | "blacklist" | "low_score" | "no_consent" };

export class AntiSpamService {
  async canSend(tenantId: string, customerId: string): Promise<CanSendResult> {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId },
      select: { whatsappOptOut: true, consentGiven: true },
    });

    if (!customer) return { allowed: false, reason: "optout" };

    if (customer.whatsappOptOut) return { allowed: false, reason: "optout" };

    if (!customer.consentGiven) return { allowed: false, reason: "no_consent" };

    const blocked = await engagementService.isBlocked(customerId);
    if (blocked) return { allowed: false, reason: blocked ? "blacklist" : "low_score" };

    return { allowed: true };
  }

  async registerOptOut(tenantId: string, phone: string) {
    await prisma.customer.updateMany({
      where: { tenantId, phone },
      data: { whatsappOptOut: true },
    });
  }
}

export const antiSpamService = new AntiSpamService();
```

- [ ] **Step 2: Escrever testes**

```typescript
// src/domains/whatsapp/anti-spam/antispam.service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@/shared/test/prisma-mock";
import { AntiSpamService } from "./antispam.service";
import { engagementService } from "../engagement/engagement.service";

vi.mock("../engagement/engagement.service");

const mockEngagement = vi.mocked(engagementService);
const service = new AntiSpamService();

const makeCustomer = (overrides = {}) => ({
  whatsappOptOut: false, consentGiven: true, ...overrides,
});

describe("AntiSpamService.canSend", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna allowed=true quando todas as camadas passam", async () => {
    prismaMock.customer.findFirst.mockResolvedValue(makeCustomer() as never);
    mockEngagement.isBlocked.mockResolvedValue(false);

    const result = await service.canSend("t-1", "c-1");
    expect(result).toEqual({ allowed: true });
  });

  it("bloqueia se whatsappOptOut=true", async () => {
    prismaMock.customer.findFirst.mockResolvedValue(makeCustomer({ whatsappOptOut: true }) as never);

    const result = await service.canSend("t-1", "c-1");
    expect(result).toEqual({ allowed: false, reason: "optout" });
  });

  it("bloqueia se consentGiven=false", async () => {
    prismaMock.customer.findFirst.mockResolvedValue(makeCustomer({ consentGiven: false }) as never);

    const result = await service.canSend("t-1", "c-1");
    expect(result).toEqual({ allowed: false, reason: "no_consent" });
  });

  it("bloqueia se isBlocked retorna true", async () => {
    prismaMock.customer.findFirst.mockResolvedValue(makeCustomer() as never);
    mockEngagement.isBlocked.mockResolvedValue(true);

    const result = await service.canSend("t-1", "c-1");
    expect(result.allowed).toBe(false);
  });
});
```

- [ ] **Step 3: Rodar testes**

```bash
npx vitest run src/domains/whatsapp/anti-spam/antispam.service.test.ts
```

Esperado: 4 passed.

- [ ] **Step 4: Commit**

```bash
git add src/domains/whatsapp/anti-spam/
git commit -m "feat(whatsapp): AntiSpamService — 3 camadas (optout, consent, engagement)"
```

---

### Task 17: WhatsApp subscriptions (executor)

**Files:**
- Create: `src/domains/whatsapp/subscriptions.ts`
- Modify: `src/app/api/_lib/runtime.ts`

- [ ] **Step 1: Criar whatsapp/subscriptions.ts**

```typescript
// src/domains/whatsapp/subscriptions.ts
import { eventBus } from "@/shared/events/event-bus";
import { whatsAppConfigRepository } from "./config/config.repository";
import { whatsAppTemplateRepository } from "./templates/template.repository";
import { whatsAppMessageRepository } from "./messages/message.repository";
import { engagementService } from "./engagement/engagement.service";
import { antiSpamService } from "./anti-spam/antispam.service";
import { metaApiClient } from "./meta-api/meta.client";
import type { MetaTemplateComponent } from "./types";

let registered = false;

export function registerWhatsAppSubscriptions() {
  if (registered) return;
  registered = true;

  // Executa ação de envio solicitada pelo automation
  eventBus.subscribe("automation.action.requested", async (payload) => {
    if (payload.action !== "send_whatsapp") return;

    const { tenantId, templateId, customerId, recipient, variables, ruleId, origin } = payload;

    // Camada anti-spam
    const canSend = await antiSpamService.canSend(tenantId, customerId);
    if (!canSend.allowed) return;

    const config = await whatsAppConfigRepository.findByTenant(tenantId);
    if (!config?.active) return;

    const template = await whatsAppTemplateRepository.findById(tenantId, templateId);
    if (!template || template.status !== "APPROVED") return;

    // Monta componentes do template com as variáveis
    const parameters = Object.entries(variables).map(([, text]) => ({ type: "text" as const, text }));
    const components: MetaTemplateComponent[] = parameters.length
      ? [{ type: "body", parameters }]
      : [];

    // Cria registro de mensagem antes de enviar
    const message = await whatsAppMessageRepository.create({
      tenantId,
      customerId,
      templateId,
      recipient,
      templateName: template.name,
      variables,
      origin,
    });

    try {
      const result = await metaApiClient.sendTemplate(config, {
        to: recipient,
        templateName: template.name,
        language: template.language,
        components,
      });

      await whatsAppMessageRepository.updateMetaId(message.id, result.messageId);
      await engagementService.onMessageDelivered(tenantId, customerId);
    } catch (err) {
      await whatsAppMessageRepository.updateByMetaMessageId(message.id, "FAILED", {
        failedAt: new Date(),
        failureReason: err instanceof Error ? err.message : "Erro desconhecido",
      });
    }
  });

  // Atualiza status via webhook
  eventBus.subscribe("whatsapp.message.status.updated", async ({ tenantId, metaMessageId, status, failureReason }) => {
    const now = new Date();
    const statusMap = {
      sent: { sentAt: now },
      delivered: { deliveredAt: now },
      read: { readAt: now },
      failed: { failedAt: now, failureReason },
    } as const;

    const extra = statusMap[status] ?? {};
    const prismaStatus = status.toUpperCase() as "SENT" | "DELIVERED" | "READ" | "FAILED";

    await whatsAppMessageRepository.updateByMetaMessageId(metaMessageId, prismaStatus, extra);

    if (status === "read") {
      const msg = await import("@/shared/database/prisma").then(({ prisma }) =>
        prisma.whatsAppMessage.findFirst({ where: { metaMessageId }, select: { customerId: true } }),
      );
      if (msg?.customerId) {
        await engagementService.onMessageRead(tenantId, msg.customerId);
      }
    }
  });

  // Processa opt-out recebido via webhook
  eventBus.subscribe("whatsapp.optout.received", async ({ tenantId, phone }) => {
    await antiSpamService.registerOptOut(tenantId, phone);
  });
}
```

- [ ] **Step 2: Atualizar runtime.ts**

Abrir `src/app/api/_lib/runtime.ts` e adicionar import e chamada:

```typescript
import { registerWhatsAppSubscriptions } from "@/domains/whatsapp/subscriptions";
```

Dentro de `initializeDomainRuntime()`, após `registerAutomationSubscriptions()`:

```typescript
  registerWhatsAppSubscriptions();
```

- [ ] **Step 3: Verificar**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/domains/whatsapp/subscriptions.ts src/app/api/_lib/runtime.ts
git commit -m "feat(whatsapp): subscriptions — executor de automation.action.requested + status webhook + opt-out"
```

---

### Task 18: Remoção do Z-API + migration + API routes de histórico

**Files:**
- Modify: `prisma/schema.prisma` — remove campos Z-API do Tenant
- Modify: `src/domains/notifications/providers/whatsapp.provider.ts`
- Modify: `src/shared/queue/jobs/appointment-reminder.ts`
- Create: `src/app/api/whatsapp/messages/route.ts`

- [ ] **Step 1: Migration — remover campos Z-API do Tenant**

Abrir `prisma/schema.prisma`. Localizar `model Tenant` e remover:

```prisma
// REMOVER estas três linhas:
zApiInstanceId    String?
zApiToken         String?
whatsappEnabled   Boolean @default(false)
```

Rodar migration:

```bash
npx prisma migrate dev --name remove_zapi_fields_from_tenant
```

Esperado: migration criada e aplicada. Se houver dados em produção, executar antes:
`UPDATE "Tenant" SET "zApiInstanceId" = NULL, "zApiToken" = NULL` para limpar.

- [ ] **Step 2: Simplificar whatsapp.provider.ts**

O provider passa a ser um thin wrapper que não faz nada — o envio real acontece via `whatsapp/subscriptions.ts`. Substituir o conteúdo de `src/domains/notifications/providers/whatsapp.provider.ts`:

```typescript
// src/domains/notifications/providers/whatsapp.provider.ts
// Envio via WhatsApp agora é feito pelo domínio whatsapp/
// através do evento automation.action.requested.
// Este provider está mantido como stub para compatibilidade da interface NotificationService.

import { NotificationStatus } from "@prisma/client";
import type { NotificationDraft, NotificationDeliveryResult } from "../types";

export class WhatsAppProvider {
  async send(_draft: NotificationDraft): Promise<NotificationDeliveryResult> {
    // O envio real é disparado via automation.action.requested → whatsapp/subscriptions.ts
    return { status: NotificationStatus.PENDING };
  }
}

export const whatsAppProvider = new WhatsAppProvider();
```

- [ ] **Step 3: Atualizar appointment-reminder.ts**

Abrir `src/shared/queue/jobs/appointment-reminder.ts`. Substituir a linha `provider: "z-api"` por `provider: "meta-api"`:

```typescript
      provider: "meta-api",
```

- [ ] **Step 4: Criar route de histórico de mensagens**

```typescript
// src/app/api/whatsapp/messages/route.ts
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { whatsAppMessageRepository } from "@/domains/whatsapp/messages/message.repository";
import { z } from "zod";

const querySchema = z.object({
  status: z.enum(["QUEUED", "SENT", "DELIVERED", "READ", "FAILED"]).optional(),
  customerId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.whatsapp.view);

    const { searchParams } = new URL(request.url);
    const query = querySchema.parse({
      status: searchParams.get("status") ?? undefined,
      customerId: searchParams.get("customerId") ?? undefined,
      page: searchParams.get("page") ?? 1,
      pageSize: searchParams.get("pageSize") ?? 20,
    });

    const [messages, metrics] = await Promise.all([
      whatsAppMessageRepository.findAll(session.tenantId, query),
      whatsAppMessageRepository.getMetrics(session.tenantId),
    ]);

    return Response.json({ ...messages, metrics });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 5: Rodar todos os testes da Fase 3**

```bash
npx vitest run src/domains/whatsapp/
```

Esperado: todos os testes passando.

- [ ] **Step 6: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 7: Commit final da Fase 3**

```bash
git add prisma/ src/domains/whatsapp/ src/domains/notifications/providers/ src/shared/queue/jobs/ src/app/api/whatsapp/messages/
git commit -m "feat(whatsapp): execução Meta API completa — anti-spam, engagement, subscriptions, histórico; remove Z-API"
```

---

## Checklist de conclusão da Fase 3

- [ ] `npx vitest run` — todos os testes passando
- [ ] `npx tsc --noEmit` — zero erros
- [ ] Migration remove campos Z-API sem erros
- [ ] Campos `zApiInstanceId`, `zApiToken`, `whatsappEnabled` removidos do schema
- [ ] Opt-out processado automaticamente via webhook
- [ ] Anti-spam bloqueia antes de qualquer chamada à Meta API
