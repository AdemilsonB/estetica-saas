# WhatsApp Meta API — Fase 1: Fundação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir Z-API pela Meta Cloud API oficial — banco de dados, cliente HTTP, webhooks, gestão de templates e API routes de configuração.

**Architecture:** Novo domínio `whatsapp/` com `meta.client.ts` (HTTP), `meta.webhooks.ts` (parser HMAC), `config/` e `templates/`. Migration Prisma aditiva (não remove Z-API ainda — remoção na Fase 3). Runtime registra novas subscrições.

**Tech Stack:** Next.js 15 App Router, Prisma, Zod, Vitest, vitest-mock-extended, Meta Cloud API v21.

**Branch:** `feat/whatsapp-meta-api` a partir de `main`.

```bash
git checkout main && git pull origin main
git checkout -b feat/whatsapp-meta-api
```

---

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` | Modificar — novos modelos + enums + campos Customer |
| `src/shared/events/domain-events.ts` | Modificar — 3 novos eventos |
| `src/shared/errors/domain-error.ts` | Modificar — 4 novos erros |
| `src/shared/auth/permissions.ts` | Modificar — whatsapp permissions |
| `src/domains/whatsapp/types.ts` | Criar |
| `src/domains/whatsapp/config/config.repository.ts` | Criar |
| `src/domains/whatsapp/config/config.repository.test.ts` | Criar |
| `src/domains/whatsapp/config/config.service.ts` | Criar |
| `src/domains/whatsapp/config/config.service.test.ts` | Criar |
| `src/domains/whatsapp/config/schemas.ts` | Criar |
| `src/domains/whatsapp/meta-api/meta.client.ts` | Criar |
| `src/domains/whatsapp/meta-api/meta.client.test.ts` | Criar |
| `src/domains/whatsapp/meta-api/meta.webhooks.ts` | Criar |
| `src/domains/whatsapp/meta-api/meta.webhooks.test.ts` | Criar |
| `src/domains/whatsapp/templates/template.repository.ts` | Criar |
| `src/domains/whatsapp/templates/template.repository.test.ts` | Criar |
| `src/domains/whatsapp/templates/template.service.ts` | Criar |
| `src/domains/whatsapp/templates/template.service.test.ts` | Criar |
| `src/domains/whatsapp/templates/schemas.ts` | Criar |
| `src/app/api/iam/whatsapp/config/route.ts` | Criar |
| `src/app/api/whatsapp/templates/route.ts` | Criar |
| `src/app/api/whatsapp/templates/[id]/route.ts` | Criar |
| `src/app/api/whatsapp/templates/[id]/submit/route.ts` | Criar |
| `src/app/api/webhooks/whatsapp/route.ts` | Criar |
| `src/app/api/_lib/runtime.ts` | Modificar — nenhuma subscrição nova na Fase 1 |
| `src/shared/test/factories/whatsapp.factory.ts` | Criar |

---

### Task 1: Prisma — migration aditiva

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Adicionar enums ao schema**

Abrir `prisma/schema.prisma` e adicionar antes das models existentes:

```prisma
enum WhatsAppTemplateCategory {
  MARKETING
  UTILITY
  AUTHENTICATION
}

enum WhatsAppTemplateStatus {
  DRAFT
  PENDING_APPROVAL
  APPROVED
  REJECTED
  PAUSED
}

enum WhatsAppMessageStatus {
  QUEUED
  SENT
  DELIVERED
  READ
  FAILED
}
```

- [ ] **Step 2: Adicionar campos ao model Customer**

Localizar `model Customer` e adicionar após o campo `tags`:

```prisma
  birthDate         DateTime?
  lastAppointmentAt DateTime?
  whatsappOptOut    Boolean   @default(false)
  consentGiven      Boolean   @default(false)
  consentDate       DateTime?
  consentOrigin     String?
  whatsappMessages  WhatsAppMessage[]
  engagementScore   WhatsAppEngagement?
```

- [ ] **Step 3: Adicionar relação ao model Tenant**

Localizar `model Tenant` e adicionar após `brandingConfig BrandingConfig?`:

```prisma
  whatsappConfig    WhatsAppConfig?
  whatsappMessages  WhatsAppMessage[]
  automationRules   AutomationRule[]
  automationExecutions AutomationExecution[]
  whatsappTemplates WhatsAppTemplate[]
```

- [ ] **Step 4: Adicionar novos models ao final do schema**

```prisma
model WhatsAppConfig {
  id               String   @id @default(cuid())
  tenantId         String   @unique
  phoneNumberId    String
  wabaId           String
  accessToken      String
  displayPhone     String
  verifyToken      String
  connectionMethod String   @default("manual")
  active           Boolean  @default(false)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  tenant           Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([verifyToken])
}

model WhatsAppTemplate {
  id              String                   @id @default(cuid())
  tenantId        String
  metaTemplateId  String?
  name            String
  category        WhatsAppTemplateCategory
  language        String                   @default("pt_BR")
  headerText      String?
  bodyText        String
  footerText      String?
  buttons         Json?
  variables       Json
  status          WhatsAppTemplateStatus   @default(DRAFT)
  rejectionReason String?
  createdAt       DateTime                 @default(now())
  updatedAt       DateTime                 @updatedAt
  tenant          Tenant                   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, name])
  @@index([tenantId])
  @@index([tenantId, status])
}

model AutomationRule {
  id            String                @id @default(cuid())
  tenantId      String
  name          String
  trigger       String
  conditions    Json
  templateId    String?
  variables     Json
  active        Boolean               @default(true)
  cooldownDays  Int                   @default(30)
  maxPerMonth   Int                   @default(2)
  sendHourStart Int                   @default(8)
  sendHourEnd   Int                   @default(20)
  inactiveDays  Int?
  createdAt     DateTime              @default(now())
  updatedAt     DateTime              @updatedAt
  executions    AutomationExecution[]
  tenant        Tenant                @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([tenantId, trigger, active])
}

model AutomationExecution {
  id            String                   @id @default(cuid())
  tenantId      String
  ruleId        String
  customerId    String
  messageId     String?
  status        AutomationExecutionStatus
  skippedReason String?
  executedAt    DateTime                 @default(now())
  rule          AutomationRule           @relation(fields: [ruleId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([ruleId, customerId])
  @@index([tenantId, executedAt])
}

enum AutomationExecutionStatus {
  SUCCESS
  FAILED
  SKIPPED
}

model WhatsAppMessage {
  id             String                @id @default(cuid())
  tenantId       String
  customerId     String?
  templateId     String?
  metaMessageId  String?               @unique
  recipient      String
  templateName   String
  variables      Json
  status         WhatsAppMessageStatus @default(QUEUED)
  sentAt         DateTime?
  deliveredAt    DateTime?
  readAt         DateTime?
  failedAt       DateTime?
  failureReason  String?
  origin         String
  createdAt      DateTime              @default(now())
  updatedAt      DateTime              @updatedAt
  customer       Customer?             @relation(fields: [customerId], references: [id])
  tenant         Tenant                @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([tenantId, status])
  @@index([metaMessageId])
  @@index([tenantId, customerId])
}

model WhatsAppEngagement {
  id           String    @id @default(cuid())
  tenantId     String
  customerId   String    @unique
  score        Int       @default(50)
  totalSent    Int       @default(0)
  totalRead    Int       @default(0)
  totalReplied Int       @default(0)
  blockedAt    DateTime?
  lastSentAt   DateTime?
  updatedAt    DateTime  @updatedAt
  customer     Customer  @relation(fields: [customerId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([tenantId, score])
}
```

- [ ] **Step 5: Gerar e aplicar migration**

```bash
npx prisma migrate dev --name whatsapp_meta_api_foundation
```

Esperado: migration criada em `prisma/migrations/` e aplicada sem erros.

- [ ] **Step 6: Verificar tipos gerados**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 7: Commit**

```bash
git add prisma/
git commit -m "feat(db): migration aditiva — modelos WhatsApp, Automation e campos Customer"
```

---

### Task 2: Eventos de domínio + erros tipados

**Files:**
- Modify: `src/shared/events/domain-events.ts`
- Modify: `src/shared/errors/domain-error.ts`

- [ ] **Step 1: Adicionar novos eventos em domain-events.ts**

Abrir `src/shared/events/domain-events.ts`. Adicionar estes tipos à union `DomainEvent`:

```typescript
  | {
      type: "automation.action.requested";
      payload: {
        tenantId: string;
        ruleId: string;
        action: "send_whatsapp";
        templateId: string;
        customerId: string;
        recipient: string;
        variables: Record<string, string>;
        origin: "automation" | "transactional";
      };
    }
  | {
      type: "whatsapp.message.status.updated";
      payload: {
        tenantId: string;
        metaMessageId: string;
        status: "sent" | "delivered" | "read" | "failed";
        failureReason?: string;
      };
    }
  | {
      type: "whatsapp.optout.received";
      payload: { tenantId: string; phone: string };
    }
```

- [ ] **Step 2: Adicionar erros tipados em domain-error.ts**

Abrir `src/shared/errors/domain-error.ts` e adicionar ao final:

```typescript
// --- WhatsApp ---

export class WhatsAppConfigNotFoundError extends DomainError {
  constructor() {
    super("Configuracao WhatsApp nao encontrada.", "WHATSAPP_CONFIG_NOT_FOUND", 404);
  }
}

export class WhatsAppConfigInactiveError extends DomainError {
  constructor() {
    super("Configuracao WhatsApp inativa ou nao verificada.", "WHATSAPP_CONFIG_INACTIVE", 422);
  }
}

export class WhatsAppTemplateNotFoundError extends DomainError {
  constructor() {
    super("Template WhatsApp nao encontrado.", "WHATSAPP_TEMPLATE_NOT_FOUND", 404);
  }
}

export class WhatsAppTemplateNotApprovedError extends DomainError {
  constructor() {
    super("Template nao aprovado pela Meta.", "WHATSAPP_TEMPLATE_NOT_APPROVED", 422);
  }
}

// --- Automation ---

export class AutomationRuleNotFoundError extends DomainError {
  constructor() {
    super("Regra de automacao nao encontrada.", "AUTOMATION_RULE_NOT_FOUND", 404);
  }
}
```

- [ ] **Step 3: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 4: Commit**

```bash
git add src/shared/events/domain-events.ts src/shared/errors/domain-error.ts
git commit -m "feat(shared): novos eventos WhatsApp+Automation e erros tipados"
```

---

### Task 3: Permissions + tipos WhatsApp

**Files:**
- Modify: `src/shared/auth/permissions.ts`
- Create: `src/domains/whatsapp/types.ts`

- [ ] **Step 1: Adicionar permissions em permissions.ts**

Abrir `src/shared/auth/permissions.ts`. Adicionar ao objeto `PERMISSIONS`:

```typescript
  whatsapp: {
    manage: "whatsapp:manage",
    view: "whatsapp:view",
  },
  automation: {
    manage: "automation:manage",
    view: "automation:view",
  },
```

- [ ] **Step 2: Adicionar ao ROLE_PERMISSIONS**

No mesmo arquivo, garantir que `OWNER` e `MANAGER` tenham as novas permissões. O `Object.values(PERMISSIONS).flatMap(...)` já cobre automaticamente, mas verificar que STAFF não tem `whatsapp:manage` nem `automation:manage`. Adicionar a `STAFF`:

```typescript
  [UserRole.STAFF]: [
    // permissões existentes do STAFF...
    PERMISSIONS.whatsapp.view,
  ],
```

- [ ] **Step 3: Criar src/domains/whatsapp/types.ts**

```typescript
import type {
  WhatsAppConfig,
  WhatsAppTemplate,
  WhatsAppTemplateCategory,
  WhatsAppTemplateStatus,
  WhatsAppMessage,
  WhatsAppMessageStatus,
  WhatsAppEngagement,
} from "@prisma/client";

export type {
  WhatsAppConfig,
  WhatsAppTemplate,
  WhatsAppTemplateCategory,
  WhatsAppTemplateStatus,
  WhatsAppMessage,
  WhatsAppMessageStatus,
  WhatsAppEngagement,
};

export type TemplateVariable = {
  index: number;
  description: string;
};

export type TemplateButton = {
  type: "URL" | "PHONE_NUMBER" | "QUICK_REPLY";
  text: string;
  url?: string;
  phone?: string;
};

export type MetaTemplateComponent =
  | { type: "body"; parameters: Array<{ type: "text"; text: string }> }
  | { type: "header"; parameters: Array<{ type: "text"; text: string }> }
  | { type: "button"; sub_type: "url" | "quick_reply"; index: number; parameters: Array<{ type: "text"; text: string }> };
```

- [ ] **Step 4: Verificar**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/shared/auth/permissions.ts src/domains/whatsapp/types.ts
git commit -m "feat(whatsapp): permissions + tipos do domínio WhatsApp"
```

---

### Task 4: WhatsAppConfig — repository + service + schemas

**Files:**
- Create: `src/domains/whatsapp/config/schemas.ts`
- Create: `src/domains/whatsapp/config/config.repository.ts`
- Create: `src/domains/whatsapp/config/config.repository.test.ts`
- Create: `src/domains/whatsapp/config/config.service.ts`
- Create: `src/domains/whatsapp/config/config.service.test.ts`

- [ ] **Step 1: Criar schemas.ts**

```typescript
// src/domains/whatsapp/config/schemas.ts
import { z } from "zod";

export const saveWhatsAppConfigSchema = z.object({
  phoneNumberId: z.string().trim().min(1),
  wabaId: z.string().trim().min(1),
  accessToken: z.string().trim().min(1),
  displayPhone: z.string().trim().min(1),
});

export type SaveWhatsAppConfigInput = z.infer<typeof saveWhatsAppConfigSchema>;
```

- [ ] **Step 2: Criar config.repository.ts**

```typescript
// src/domains/whatsapp/config/config.repository.ts
import { randomUUID } from "crypto";
import { prisma } from "@/shared/database/prisma";
import type { SaveWhatsAppConfigInput } from "./schemas";

export class WhatsAppConfigRepository {
  async findByTenant(tenantId: string) {
    return prisma.whatsAppConfig.findUnique({ where: { tenantId } });
  }

  async findByVerifyToken(verifyToken: string) {
    return prisma.whatsAppConfig.findFirst({ where: { verifyToken } });
  }

  async findByWabaId(wabaId: string) {
    return prisma.whatsAppConfig.findFirst({ where: { wabaId } });
  }

  async upsert(tenantId: string, input: SaveWhatsAppConfigInput) {
    const existing = await this.findByTenant(tenantId);
    const verifyToken = existing?.verifyToken ?? randomUUID();

    return prisma.whatsAppConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        phoneNumberId: input.phoneNumberId,
        wabaId: input.wabaId,
        accessToken: input.accessToken,
        displayPhone: input.displayPhone,
        verifyToken,
        active: false,
      },
      update: {
        phoneNumberId: input.phoneNumberId,
        wabaId: input.wabaId,
        accessToken: input.accessToken,
        displayPhone: input.displayPhone,
      },
    });
  }

  async activate(tenantId: string) {
    return prisma.whatsAppConfig.update({
      where: { tenantId },
      data: { active: true },
    });
  }
}

export const whatsAppConfigRepository = new WhatsAppConfigRepository();
```

- [ ] **Step 3: Escrever testes do repository**

```typescript
// src/domains/whatsapp/config/config.repository.test.ts
import { describe, it, expect } from "vitest";
import { prismaMock } from "@/shared/test/prisma-mock";
import { WhatsAppConfigRepository } from "./config.repository";

const repo = new WhatsAppConfigRepository();

const makeConfig = (overrides = {}) => ({
  id: "cfg-1",
  tenantId: "tenant-1",
  phoneNumberId: "phone-1",
  wabaId: "waba-1",
  accessToken: "token-abc",
  displayPhone: "+5511999999999",
  verifyToken: "verify-uuid",
  connectionMethod: "manual",
  active: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("WhatsAppConfigRepository", () => {
  it("findByTenant retorna config existente", async () => {
    const config = makeConfig();
    prismaMock.whatsAppConfig.findUnique.mockResolvedValue(config);
    const result = await repo.findByTenant("tenant-1");
    expect(result).toEqual(config);
    expect(prismaMock.whatsAppConfig.findUnique).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1" },
    });
  });

  it("findByVerifyToken retorna config pelo token", async () => {
    const config = makeConfig();
    prismaMock.whatsAppConfig.findFirst.mockResolvedValue(config);
    const result = await repo.findByVerifyToken("verify-uuid");
    expect(result?.verifyToken).toBe("verify-uuid");
  });

  it("upsert cria nova config com verifyToken gerado", async () => {
    prismaMock.whatsAppConfig.findUnique.mockResolvedValue(null);
    const created = makeConfig({ active: false });
    prismaMock.whatsAppConfig.upsert.mockResolvedValue(created);

    const result = await repo.upsert("tenant-1", {
      phoneNumberId: "phone-1",
      wabaId: "waba-1",
      accessToken: "token-abc",
      displayPhone: "+5511999999999",
    });

    expect(result.active).toBe(false);
    expect(prismaMock.whatsAppConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-1" },
        create: expect.objectContaining({ active: false }),
      }),
    );
  });

  it("activate define active=true", async () => {
    const config = makeConfig({ active: true });
    prismaMock.whatsAppConfig.update.mockResolvedValue(config);
    const result = await repo.activate("tenant-1");
    expect(result.active).toBe(true);
  });
});
```

- [ ] **Step 4: Rodar testes do repository**

```bash
npx vitest run src/domains/whatsapp/config/config.repository.test.ts
```

Esperado: 4 passed.

- [ ] **Step 5: Criar config.service.ts**

```typescript
// src/domains/whatsapp/config/config.service.ts
import { WhatsAppConfigNotFoundError } from "@/shared/errors";
import { whatsAppConfigRepository } from "./config.repository";
import type { SaveWhatsAppConfigInput } from "./schemas";

export class WhatsAppConfigService {
  async get(tenantId: string) {
    const config = await whatsAppConfigRepository.findByTenant(tenantId);
    if (!config) throw new WhatsAppConfigNotFoundError();
    // Nunca expor accessToken na resposta
    const { accessToken: _, ...safe } = config;
    return safe;
  }

  async save(tenantId: string, input: SaveWhatsAppConfigInput) {
    const config = await whatsAppConfigRepository.upsert(tenantId, input);
    const { accessToken: _, ...safe } = config;
    return safe;
  }

  async verifyWebhook(verifyToken: string, challenge: string) {
    const config = await whatsAppConfigRepository.findByVerifyToken(verifyToken);
    if (!config) return null;
    await whatsAppConfigRepository.activate(config.tenantId);
    return challenge;
  }
}

export const whatsAppConfigService = new WhatsAppConfigService();
```

- [ ] **Step 6: Escrever testes do service**

```typescript
// src/domains/whatsapp/config/config.service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WhatsAppConfigService } from "./config.service";
import { whatsAppConfigRepository } from "./config.repository";
import { WhatsAppConfigNotFoundError } from "@/shared/errors";

vi.mock("./config.repository");

const mockRepo = vi.mocked(whatsAppConfigRepository);

const makeConfig = (overrides = {}) => ({
  id: "cfg-1",
  tenantId: "tenant-1",
  phoneNumberId: "phone-1",
  wabaId: "waba-1",
  accessToken: "secret-token",
  displayPhone: "+5511999999999",
  verifyToken: "verify-uuid",
  connectionMethod: "manual",
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("WhatsAppConfigService", () => {
  const service = new WhatsAppConfigService();

  beforeEach(() => vi.clearAllMocks());

  it("get lança erro se config não existe", async () => {
    mockRepo.findByTenant.mockResolvedValue(null);
    await expect(service.get("tenant-1")).rejects.toThrow(WhatsAppConfigNotFoundError);
  });

  it("get retorna config sem accessToken", async () => {
    mockRepo.findByTenant.mockResolvedValue(makeConfig());
    const result = await service.get("tenant-1");
    expect(result).not.toHaveProperty("accessToken");
    expect(result.phoneNumberId).toBe("phone-1");
  });

  it("save persiste config e omite accessToken", async () => {
    mockRepo.upsert.mockResolvedValue(makeConfig());
    const result = await service.save("tenant-1", {
      phoneNumberId: "phone-1",
      wabaId: "waba-1",
      accessToken: "secret-token",
      displayPhone: "+5511999999999",
    });
    expect(result).not.toHaveProperty("accessToken");
  });

  it("verifyWebhook ativa config quando token bate", async () => {
    mockRepo.findByVerifyToken.mockResolvedValue(makeConfig({ active: false }));
    mockRepo.activate.mockResolvedValue(makeConfig({ active: true }));
    const result = await service.verifyWebhook("verify-uuid", "challenge-123");
    expect(result).toBe("challenge-123");
    expect(mockRepo.activate).toHaveBeenCalledWith("tenant-1");
  });

  it("verifyWebhook retorna null se token inválido", async () => {
    mockRepo.findByVerifyToken.mockResolvedValue(null);
    const result = await service.verifyWebhook("token-errado", "challenge-123");
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 7: Rodar testes do service**

```bash
npx vitest run src/domains/whatsapp/config/config.service.test.ts
```

Esperado: 5 passed.

- [ ] **Step 8: Commit**

```bash
git add src/domains/whatsapp/config/
git commit -m "feat(whatsapp): WhatsAppConfig — repository, service e schemas com testes"
```

---

### Task 5: Meta API client

**Files:**
- Create: `src/domains/whatsapp/meta-api/meta.client.ts`
- Create: `src/domains/whatsapp/meta-api/meta.client.test.ts`

- [ ] **Step 1: Criar meta.client.ts**

```typescript
// src/domains/whatsapp/meta-api/meta.client.ts
import type { WhatsAppConfig } from "@prisma/client";
import type { MetaTemplateComponent, TemplateButton } from "../types";

const META_API_BASE = "https://graph.facebook.com/v21.0";

type SendTemplateParams = {
  to: string;
  templateName: string;
  language: string;
  components: MetaTemplateComponent[];
};

type SendTemplateResult = { messageId: string };

type CreateTemplateParams = {
  name: string;
  category: string;
  language: string;
  bodyText: string;
  headerText?: string;
  footerText?: string;
  buttons?: TemplateButton[];
};

type TemplateStatusResult = {
  metaTemplateId: string;
  status: string;
  rejectionReason?: string;
};

export class MetaApiClient {
  private headers(token: string) {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  async sendTemplate(
    config: Pick<WhatsAppConfig, "phoneNumberId" | "accessToken">,
    params: SendTemplateParams,
  ): Promise<SendTemplateResult> {
    const res = await fetch(
      `${META_API_BASE}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: this.headers(config.accessToken),
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: params.to,
          type: "template",
          template: {
            name: params.templateName,
            language: { code: params.language },
            components: params.components,
          },
        }),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Meta API erro ${res.status}: ${body}`);
    }

    const data = await res.json();
    return { messageId: data.messages[0].id as string };
  }

  async createTemplate(
    config: Pick<WhatsAppConfig, "wabaId" | "accessToken">,
    params: CreateTemplateParams,
  ): Promise<{ metaTemplateId: string; status: string }> {
    const components: Record<string, unknown>[] = [];
    if (params.headerText) {
      components.push({ type: "HEADER", format: "TEXT", text: params.headerText });
    }
    components.push({ type: "BODY", text: params.bodyText });
    if (params.footerText) {
      components.push({ type: "FOOTER", text: params.footerText });
    }
    if (params.buttons?.length) {
      components.push({
        type: "BUTTONS",
        buttons: params.buttons.map((b) => ({
          type: b.type,
          text: b.text,
          ...(b.url ? { url: b.url } : {}),
          ...(b.phone ? { phone_number: b.phone } : {}),
        })),
      });
    }

    const res = await fetch(
      `${META_API_BASE}/${config.wabaId}/message_templates`,
      {
        method: "POST",
        headers: this.headers(config.accessToken),
        body: JSON.stringify({
          name: params.name,
          language: params.language,
          category: params.category,
          components,
        }),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Meta API erro ${res.status}: ${body}`);
    }

    const data = await res.json();
    return { metaTemplateId: data.id as string, status: data.status as string };
  }

  async getTemplateStatus(
    config: Pick<WhatsAppConfig, "wabaId" | "accessToken">,
    templateName: string,
  ): Promise<TemplateStatusResult | null> {
    const url = new URL(`${META_API_BASE}/${config.wabaId}/message_templates`);
    url.searchParams.set("name", templateName);
    url.searchParams.set("fields", "id,name,status,rejected_reason");

    const res = await fetch(url.toString(), {
      headers: this.headers(config.accessToken),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const tpl = data.data?.[0];
    if (!tpl) return null;

    return {
      metaTemplateId: tpl.id as string,
      status: tpl.status as string,
      rejectionReason: tpl.rejected_reason as string | undefined,
    };
  }

  async deleteTemplate(
    config: Pick<WhatsAppConfig, "wabaId" | "accessToken">,
    templateName: string,
  ): Promise<void> {
    const url = new URL(`${META_API_BASE}/${config.wabaId}/message_templates`);
    url.searchParams.set("name", templateName);

    const res = await fetch(url.toString(), {
      method: "DELETE",
      headers: this.headers(config.accessToken),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Meta API erro ${res.status}: ${body}`);
    }
  }
}

export const metaApiClient = new MetaApiClient();
```

- [ ] **Step 2: Escrever testes do cliente**

```typescript
// src/domains/whatsapp/meta-api/meta.client.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MetaApiClient } from "./meta.client";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const config = {
  phoneNumberId: "phone-1",
  wabaId: "waba-1",
  accessToken: "token-abc",
};

describe("MetaApiClient", () => {
  const client = new MetaApiClient();

  beforeEach(() => fetchMock.mockReset());

  it("sendTemplate retorna messageId no sucesso", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: "wamid.abc" }] }),
    });

    const result = await client.sendTemplate(config, {
      to: "5511999999999",
      templateName: "retorno_cliente",
      language: "pt_BR",
      components: [{ type: "body", parameters: [{ type: "text", text: "João" }] }],
    });

    expect(result.messageId).toBe("wamid.abc");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("phone-1/messages"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("sendTemplate lança erro quando API retorna status não-ok", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "Bad Request",
    });

    await expect(
      client.sendTemplate(config, {
        to: "5511999999999",
        templateName: "template",
        language: "pt_BR",
        components: [],
      }),
    ).rejects.toThrow("Meta API erro 400");
  });

  it("createTemplate retorna metaTemplateId e status", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "meta-tpl-1", status: "PENDING" }),
    });

    const result = await client.createTemplate(config, {
      name: "aniversario",
      category: "MARKETING",
      language: "pt_BR",
      bodyText: "Parabéns {{1}}!",
    });

    expect(result.metaTemplateId).toBe("meta-tpl-1");
    expect(result.status).toBe("PENDING");
  });

  it("getTemplateStatus retorna null quando template não encontrado", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    const result = await client.getTemplateStatus(config, "nao_existe");
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 3: Rodar testes**

```bash
npx vitest run src/domains/whatsapp/meta-api/meta.client.test.ts
```

Esperado: 4 passed.

- [ ] **Step 4: Commit**

```bash
git add src/domains/whatsapp/meta-api/meta.client.ts src/domains/whatsapp/meta-api/meta.client.test.ts
git commit -m "feat(whatsapp): MetaApiClient — sendTemplate, createTemplate, getTemplateStatus com testes"
```

---

### Task 6: Meta webhooks

**Files:**
- Create: `src/domains/whatsapp/meta-api/meta.webhooks.ts`
- Create: `src/domains/whatsapp/meta-api/meta.webhooks.test.ts`

- [ ] **Step 1: Criar meta.webhooks.ts**

```typescript
// src/domains/whatsapp/meta-api/meta.webhooks.ts
import { createHmac } from "crypto";

const OPT_OUT_KEYWORDS = ["sair", "parar", "stop", "cancelar", "descadastrar"];

export type WebhookStatusEvent = {
  type: "message_status";
  metaMessageId: string;
  wabaId: string;
  status: "sent" | "delivered" | "read" | "failed";
  failureReason?: string;
};

export type WebhookIncomingMessage = {
  type: "incoming_message";
  wabaId: string;
  from: string;
  text: string;
  isOptOut: boolean;
};

export type ParsedWebhookEvent = WebhookStatusEvent | WebhookIncomingMessage;

export function verifyWebhookSignature(
  body: string,
  signature: string,
  appSecret: string,
): boolean {
  const expected = `sha256=${createHmac("sha256", appSecret).update(body).digest("hex")}`;
  return expected === signature;
}

export function parseWebhookPayload(body: unknown): ParsedWebhookEvent[] {
  const events: ParsedWebhookEvent[] = [];

  const payload = body as Record<string, unknown>;
  if (payload.object !== "whatsapp_business_account") return events;

  const entries = (payload.entry as Record<string, unknown>[]) ?? [];

  for (const entry of entries) {
    const wabaId = entry.id as string;
    const changes = (entry.changes as Record<string, unknown>[]) ?? [];

    for (const change of changes) {
      if (change.field !== "messages") continue;
      const value = change.value as Record<string, unknown>;

      const statuses = (value.statuses as Record<string, unknown>[]) ?? [];
      for (const s of statuses) {
        const failureReason =
          s.errors
            ? ((s.errors as Record<string, unknown>[])[0]?.title as string)
            : undefined;

        events.push({
          type: "message_status",
          metaMessageId: s.id as string,
          wabaId,
          status: s.status as "sent" | "delivered" | "read" | "failed",
          failureReason,
        });
      }

      const messages = (value.messages as Record<string, unknown>[]) ?? [];
      for (const m of messages) {
        if (m.type !== "text") continue;
        const text = ((m.text as Record<string, unknown>)?.body as string) ?? "";

        events.push({
          type: "incoming_message",
          wabaId,
          from: m.from as string,
          text,
          isOptOut: OPT_OUT_KEYWORDS.includes(text.trim().toLowerCase()),
        });
      }
    }
  }

  return events;
}
```

- [ ] **Step 2: Escrever testes de webhooks**

```typescript
// src/domains/whatsapp/meta-api/meta.webhooks.test.ts
import { describe, it, expect } from "vitest";
import { verifyWebhookSignature, parseWebhookPayload } from "./meta.webhooks";
import { createHmac } from "crypto";

const APP_SECRET = "test-app-secret";

function makeSignature(body: string) {
  return `sha256=${createHmac("sha256", APP_SECRET).update(body).digest("hex")}`;
}

describe("verifyWebhookSignature", () => {
  it("retorna true com assinatura válida", () => {
    const body = '{"object":"whatsapp_business_account"}';
    expect(verifyWebhookSignature(body, makeSignature(body), APP_SECRET)).toBe(true);
  });

  it("retorna false com assinatura inválida", () => {
    const body = '{"object":"whatsapp_business_account"}';
    expect(verifyWebhookSignature(body, "sha256=errado", APP_SECRET)).toBe(false);
  });
});

describe("parseWebhookPayload", () => {
  it("parseia evento de status delivered", () => {
    const payload = {
      object: "whatsapp_business_account",
      entry: [{
        id: "waba-1",
        changes: [{
          field: "messages",
          value: {
            statuses: [{ id: "wamid.abc", status: "delivered" }],
            messages: [],
          },
        }],
      }],
    };

    const events = parseWebhookPayload(payload);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "message_status",
      metaMessageId: "wamid.abc",
      status: "delivered",
      wabaId: "waba-1",
    });
  });

  it("parseia mensagem de texto com opt-out keyword", () => {
    const payload = {
      object: "whatsapp_business_account",
      entry: [{
        id: "waba-1",
        changes: [{
          field: "messages",
          value: {
            statuses: [],
            messages: [{
              type: "text",
              from: "5511999999999",
              id: "wamid.xyz",
              text: { body: "SAIR" },
            }],
          },
        }],
      }],
    };

    const events = parseWebhookPayload(payload);
    expect(events[0]).toMatchObject({
      type: "incoming_message",
      from: "5511999999999",
      isOptOut: true,
    });
  });

  it("retorna [] para payload de objeto diferente", () => {
    expect(parseWebhookPayload({ object: "page" })).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Rodar testes**

```bash
npx vitest run src/domains/whatsapp/meta-api/meta.webhooks.test.ts
```

Esperado: 5 passed.

- [ ] **Step 4: Commit**

```bash
git add src/domains/whatsapp/meta-api/meta.webhooks.ts src/domains/whatsapp/meta-api/meta.webhooks.test.ts
git commit -m "feat(whatsapp): meta.webhooks — parser HMAC-SHA256 + eventos de status e opt-out"
```

---

### Task 7: WhatsAppTemplate — repository + service

**Files:**
- Create: `src/domains/whatsapp/templates/schemas.ts`
- Create: `src/domains/whatsapp/templates/template.repository.ts`
- Create: `src/domains/whatsapp/templates/template.repository.test.ts`
- Create: `src/domains/whatsapp/templates/template.service.ts`
- Create: `src/domains/whatsapp/templates/template.service.test.ts`

- [ ] **Step 1: Criar schemas.ts**

```typescript
// src/domains/whatsapp/templates/schemas.ts
import { z } from "zod";

export const createTemplateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3)
    .max(60)
    .regex(/^[a-z0-9_]+$/, "Nome deve ter apenas letras minúsculas, números e underscores"),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]),
  language: z.string().default("pt_BR"),
  headerText: z.string().trim().max(60).optional(),
  bodyText: z.string().trim().min(10).max(1024),
  footerText: z.string().trim().max(60).optional(),
  buttons: z
    .array(
      z.object({
        type: z.enum(["URL", "PHONE_NUMBER", "QUICK_REPLY"]),
        text: z.string().trim().max(25),
        url: z.string().url().optional(),
        phone: z.string().optional(),
      }),
    )
    .max(3)
    .optional(),
  variables: z.array(
    z.object({ index: z.number().int().min(1), description: z.string().trim().min(1) }),
  ),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
```

- [ ] **Step 2: Criar template.repository.ts**

```typescript
// src/domains/whatsapp/templates/template.repository.ts
import type { WhatsAppTemplateStatus } from "@prisma/client";
import { prisma } from "@/shared/database/prisma";
import type { CreateTemplateInput } from "./schemas";

export class WhatsAppTemplateRepository {
  async findAll(tenantId: string) {
    return prisma.whatsAppTemplate.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(tenantId: string, id: string) {
    return prisma.whatsAppTemplate.findFirst({ where: { id, tenantId } });
  }

  async findApproved(tenantId: string) {
    return prisma.whatsAppTemplate.findMany({
      where: { tenantId, status: "APPROVED" },
      orderBy: { name: "asc" },
    });
  }

  async create(tenantId: string, input: CreateTemplateInput) {
    return prisma.whatsAppTemplate.create({
      data: {
        tenantId,
        name: input.name,
        category: input.category,
        language: input.language,
        headerText: input.headerText,
        bodyText: input.bodyText,
        footerText: input.footerText,
        buttons: input.buttons ?? [],
        variables: input.variables,
        status: "DRAFT",
      },
    });
  }

  async updateStatus(
    tenantId: string,
    id: string,
    status: WhatsAppTemplateStatus,
    metaTemplateId?: string,
    rejectionReason?: string,
  ) {
    return prisma.whatsAppTemplate.update({
      where: { id },
      data: {
        status,
        ...(metaTemplateId ? { metaTemplateId } : {}),
        ...(rejectionReason ? { rejectionReason } : {}),
      },
    });
  }

  async delete(tenantId: string, id: string) {
    return prisma.whatsAppTemplate.deleteMany({ where: { id, tenantId } });
  }
}

export const whatsAppTemplateRepository = new WhatsAppTemplateRepository();
```

- [ ] **Step 3: Criar template.service.ts**

```typescript
// src/domains/whatsapp/templates/template.service.ts
import {
  WhatsAppConfigInactiveError,
  WhatsAppConfigNotFoundError,
  WhatsAppTemplateNotFoundError,
} from "@/shared/errors";
import { whatsAppConfigRepository } from "../config/config.repository";
import { metaApiClient } from "../meta-api/meta.client";
import { whatsAppTemplateRepository } from "./template.repository";
import type { CreateTemplateInput } from "./schemas";

export class WhatsAppTemplateService {
  async list(tenantId: string) {
    return whatsAppTemplateRepository.findAll(tenantId);
  }

  async listApproved(tenantId: string) {
    return whatsAppTemplateRepository.findApproved(tenantId);
  }

  async create(tenantId: string, input: CreateTemplateInput) {
    return whatsAppTemplateRepository.create(tenantId, input);
  }

  async submitForApproval(tenantId: string, templateId: string) {
    const config = await whatsAppConfigRepository.findByTenant(tenantId);
    if (!config) throw new WhatsAppConfigNotFoundError();
    if (!config.active) throw new WhatsAppConfigInactiveError();

    const template = await whatsAppTemplateRepository.findById(tenantId, templateId);
    if (!template) throw new WhatsAppTemplateNotFoundError();

    const result = await metaApiClient.createTemplate(config, {
      name: template.name,
      category: template.category,
      language: template.language,
      bodyText: template.bodyText,
      headerText: template.headerText ?? undefined,
      footerText: template.footerText ?? undefined,
      buttons: (template.buttons as { type: "URL" | "PHONE_NUMBER" | "QUICK_REPLY"; text: string; url?: string; phone?: string }[]) ?? [],
    });

    return whatsAppTemplateRepository.updateStatus(
      tenantId,
      templateId,
      "PENDING_APPROVAL",
      result.metaTemplateId,
    );
  }

  async syncStatus(tenantId: string, templateId: string) {
    const config = await whatsAppConfigRepository.findByTenant(tenantId);
    if (!config) throw new WhatsAppConfigNotFoundError();

    const template = await whatsAppTemplateRepository.findById(tenantId, templateId);
    if (!template) throw new WhatsAppTemplateNotFoundError();

    const metaStatus = await metaApiClient.getTemplateStatus(config, template.name);
    if (!metaStatus) return template;

    const statusMap: Record<string, "APPROVED" | "REJECTED" | "PENDING_APPROVAL" | "PAUSED"> = {
      APPROVED: "APPROVED",
      REJECTED: "REJECTED",
      PENDING: "PENDING_APPROVAL",
      PAUSED: "PAUSED",
    };

    const mapped = statusMap[metaStatus.status] ?? "PENDING_APPROVAL";
    return whatsAppTemplateRepository.updateStatus(
      tenantId,
      templateId,
      mapped,
      metaStatus.metaTemplateId,
      metaStatus.rejectionReason,
    );
  }

  async delete(tenantId: string, templateId: string) {
    const template = await whatsAppTemplateRepository.findById(tenantId, templateId);
    if (!template) throw new WhatsAppTemplateNotFoundError();

    const config = await whatsAppConfigRepository.findByTenant(tenantId);
    if (config?.active && template.metaTemplateId) {
      await metaApiClient.deleteTemplate(config, template.name);
    }

    return whatsAppTemplateRepository.delete(tenantId, templateId);
  }
}

export const whatsAppTemplateService = new WhatsAppTemplateService();
```

- [ ] **Step 4: Escrever testes do service**

```typescript
// src/domains/whatsapp/templates/template.service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WhatsAppTemplateService } from "./template.service";
import { whatsAppConfigRepository } from "../config/config.repository";
import { whatsAppTemplateRepository } from "./template.repository";
import { metaApiClient } from "../meta-api/meta.client";
import {
  WhatsAppConfigNotFoundError,
  WhatsAppConfigInactiveError,
  WhatsAppTemplateNotFoundError,
} from "@/shared/errors";

vi.mock("../config/config.repository");
vi.mock("./template.repository");
vi.mock("../meta-api/meta.client");

const mockConfig = vi.mocked(whatsAppConfigRepository);
const mockRepo = vi.mocked(whatsAppTemplateRepository);
const mockMeta = vi.mocked(metaApiClient);

const makeConfig = (overrides = {}) => ({
  id: "cfg-1", tenantId: "t-1", phoneNumberId: "ph-1", wabaId: "waba-1",
  accessToken: "token", displayPhone: "+55", verifyToken: "v-token",
  connectionMethod: "manual", active: true,
  createdAt: new Date(), updatedAt: new Date(), ...overrides,
});

const makeTemplate = (overrides = {}) => ({
  id: "tpl-1", tenantId: "t-1", metaTemplateId: null,
  name: "retorno_cliente", category: "MARKETING" as const,
  language: "pt_BR", headerText: null, bodyText: "Olá {{1}}!",
  footerText: null, buttons: [], variables: [{ index: 1, description: "nome" }],
  status: "DRAFT" as const, rejectionReason: null,
  createdAt: new Date(), updatedAt: new Date(), ...overrides,
});

describe("WhatsAppTemplateService", () => {
  const service = new WhatsAppTemplateService();

  beforeEach(() => vi.clearAllMocks());

  it("submitForApproval lança erro se config não existe", async () => {
    mockConfig.findByTenant.mockResolvedValue(null);
    await expect(service.submitForApproval("t-1", "tpl-1")).rejects.toThrow(WhatsAppConfigNotFoundError);
  });

  it("submitForApproval lança erro se config inativa", async () => {
    mockConfig.findByTenant.mockResolvedValue(makeConfig({ active: false }));
    await expect(service.submitForApproval("t-1", "tpl-1")).rejects.toThrow(WhatsAppConfigInactiveError);
  });

  it("submitForApproval lança erro se template não encontrado", async () => {
    mockConfig.findByTenant.mockResolvedValue(makeConfig());
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.submitForApproval("t-1", "tpl-1")).rejects.toThrow(WhatsAppTemplateNotFoundError);
  });

  it("submitForApproval envia para Meta e atualiza status", async () => {
    mockConfig.findByTenant.mockResolvedValue(makeConfig());
    mockRepo.findById.mockResolvedValue(makeTemplate());
    mockMeta.createTemplate.mockResolvedValue({ metaTemplateId: "meta-1", status: "PENDING" });
    const updated = makeTemplate({ status: "PENDING_APPROVAL", metaTemplateId: "meta-1" });
    mockRepo.updateStatus.mockResolvedValue(updated);

    const result = await service.submitForApproval("t-1", "tpl-1");
    expect(result.status).toBe("PENDING_APPROVAL");
    expect(mockMeta.createTemplate).toHaveBeenCalledOnce();
  });

  it("delete remove template da Meta se já submetido", async () => {
    mockConfig.findByTenant.mockResolvedValue(makeConfig());
    mockRepo.findById.mockResolvedValue(makeTemplate({ metaTemplateId: "meta-1", status: "APPROVED" }));
    mockMeta.deleteTemplate.mockResolvedValue(undefined);
    mockRepo.delete.mockResolvedValue({ count: 1 });

    await service.delete("t-1", "tpl-1");
    expect(mockMeta.deleteTemplate).toHaveBeenCalledWith(expect.anything(), "retorno_cliente");
  });
});
```

- [ ] **Step 5: Rodar testes**

```bash
npx vitest run src/domains/whatsapp/templates/template.service.test.ts
```

Esperado: 5 passed.

- [ ] **Step 6: Commit**

```bash
git add src/domains/whatsapp/templates/
git commit -m "feat(whatsapp): WhatsAppTemplate — repository, service e schemas com testes"
```

---

### Task 8: API Routes + webhook endpoint + factory

**Files:**
- Create: `src/app/api/iam/whatsapp/config/route.ts`
- Create: `src/app/api/whatsapp/templates/route.ts`
- Create: `src/app/api/whatsapp/templates/[id]/route.ts`
- Create: `src/app/api/whatsapp/templates/[id]/submit/route.ts`
- Create: `src/app/api/webhooks/whatsapp/route.ts`
- Modify: `src/app/api/_lib/runtime.ts`
- Create: `src/shared/test/factories/whatsapp.factory.ts`

- [ ] **Step 1: Criar route de configuração**

```typescript
// src/app/api/iam/whatsapp/config/route.ts
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";
import { whatsAppConfigService } from "@/domains/whatsapp/config/config.service";
import { saveWhatsAppConfigSchema } from "@/domains/whatsapp/config/schemas";

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.whatsapp.manage);
    const config = await whatsAppConfigService.get(session.tenantId);
    return Response.json(config);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.whatsapp.manage);
    const input = await validateInput(request, saveWhatsAppConfigSchema);
    const config = await whatsAppConfigService.save(session.tenantId, input);
    return Response.json(config);
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 2: Criar route de templates (listagem + criação)**

```typescript
// src/app/api/whatsapp/templates/route.ts
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";
import { created } from "@/shared/http/responses";
import { whatsAppTemplateService } from "@/domains/whatsapp/templates/template.service";
import { createTemplateSchema } from "@/domains/whatsapp/templates/schemas";

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.whatsapp.view);
    const templates = await whatsAppTemplateService.list(session.tenantId);
    return Response.json(templates);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.whatsapp.manage);
    const input = await validateInput(request, createTemplateSchema);
    const template = await whatsAppTemplateService.create(session.tenantId, input);
    return created(template);
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 3: Criar route de template individual (delete + status sync)**

```typescript
// src/app/api/whatsapp/templates/[id]/route.ts
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { whatsAppTemplateService } from "@/domains/whatsapp/templates/template.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.whatsapp.view);
    const { id } = await params;
    const template = await whatsAppTemplateService.syncStatus(session.tenantId, id);
    return Response.json(template);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.whatsapp.manage);
    const { id } = await params;
    await whatsAppTemplateService.delete(session.tenantId, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 4: Criar route de submit para aprovação**

```typescript
// src/app/api/whatsapp/templates/[id]/submit/route.ts
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { whatsAppTemplateService } from "@/domains/whatsapp/templates/template.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.whatsapp.manage);
    const { id } = await params;
    const template = await whatsAppTemplateService.submitForApproval(session.tenantId, id);
    return Response.json(template);
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 5: Criar webhook endpoint (público — sem auth de tenant)**

```typescript
// src/app/api/webhooks/whatsapp/route.ts
import { whatsAppConfigService } from "@/domains/whatsapp/config/config.service";
import { whatsAppConfigRepository } from "@/domains/whatsapp/config/config.repository";
import { parseWebhookPayload, verifyWebhookSignature } from "@/domains/whatsapp/meta-api/meta.webhooks";
import { eventBus } from "@/shared/events/event-bus";

const META_APP_SECRET = process.env.META_APP_SECRET ?? "";

// Verificação do webhook pela Meta (GET)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode !== "subscribe" || !token || !challenge) {
    return new Response("Bad Request", { status: 400 });
  }

  const result = await whatsAppConfigService.verifyWebhook(token, challenge);
  if (!result) return new Response("Forbidden", { status: 403 });

  return new Response(result, { status: 200 });
}

// Eventos de entrega (POST)
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256") ?? "";

  if (META_APP_SECRET && !verifyWebhookSignature(rawBody, signature, META_APP_SECRET)) {
    return new Response("Forbidden", { status: 403 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const events = parseWebhookPayload(body);

  for (const event of events) {
    if (event.type === "message_status") {
      const config = await whatsAppConfigRepository.findByWabaId(event.wabaId);
      if (!config) continue;

      eventBus.publish({
        type: "whatsapp.message.status.updated",
        payload: {
          tenantId: config.tenantId,
          metaMessageId: event.metaMessageId,
          status: event.status,
          failureReason: event.failureReason,
        },
      });
    }

    if (event.type === "incoming_message" && event.isOptOut) {
      const config = await whatsAppConfigRepository.findByWabaId(event.wabaId);
      if (!config) continue;

      eventBus.publish({
        type: "whatsapp.optout.received",
        payload: { tenantId: config.tenantId, phone: event.from },
      });
    }
  }

  return Response.json({ ok: true });
}
```

- [ ] **Step 6: Criar factory de testes**

```typescript
// src/shared/test/factories/whatsapp.factory.ts
import type { WhatsAppConfig, WhatsAppTemplate, WhatsAppMessage } from "@prisma/client";

export function makeWhatsAppConfig(overrides: Partial<WhatsAppConfig> = {}): WhatsAppConfig {
  return {
    id: "cfg-test-id",
    tenantId: "tenant-test-id",
    phoneNumberId: "phone-test-id",
    wabaId: "waba-test-id",
    accessToken: "test-access-token",
    displayPhone: "+5511999999999",
    verifyToken: "verify-test-token",
    connectionMethod: "manual",
    active: true,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

export function makeWhatsAppTemplate(overrides: Partial<WhatsAppTemplate> = {}): WhatsAppTemplate {
  return {
    id: "tpl-test-id",
    tenantId: "tenant-test-id",
    metaTemplateId: null,
    name: "retorno_cliente",
    category: "MARKETING",
    language: "pt_BR",
    headerText: null,
    bodyText: "Olá {{1}}, sentimos sua falta!",
    footerText: null,
    buttons: [],
    variables: [{ index: 1, description: "nome do cliente" }],
    status: "DRAFT",
    rejectionReason: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

export function makeWhatsAppMessage(overrides: Partial<WhatsAppMessage> = {}): WhatsAppMessage {
  return {
    id: "msg-test-id",
    tenantId: "tenant-test-id",
    customerId: "customer-test-id",
    templateId: "tpl-test-id",
    metaMessageId: "wamid.test",
    recipient: "5511999999999",
    templateName: "retorno_cliente",
    variables: { "1": "João" },
    status: "SENT",
    sentAt: new Date("2026-01-01T10:00:00Z"),
    deliveredAt: null,
    readAt: null,
    failedAt: null,
    failureReason: null,
    origin: "automation",
    createdAt: new Date("2026-01-01T10:00:00Z"),
    updatedAt: new Date("2026-01-01T10:00:00Z"),
    ...overrides,
  };
}
```

- [ ] **Step 7: Rodar todos os testes da Fase 1**

```bash
npx vitest run src/domains/whatsapp/
```

Esperado: todos os testes passando.

- [ ] **Step 8: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 9: Commit final da Fase 1**

```bash
git add src/app/api/iam/whatsapp/ src/app/api/whatsapp/ src/app/api/webhooks/ src/shared/test/factories/whatsapp.factory.ts
git commit -m "feat(whatsapp): API routes config/templates/webhook + factory de testes"
```

---

## Checklist de conclusão da Fase 1

- [ ] `npx vitest run` — todos os testes passando
- [ ] `npx tsc --noEmit` — zero erros
- [ ] Migration aplicada sem erros
- [ ] `accessToken` nunca retornado nas API responses
- [ ] Webhook valida `X-Hub-Signature-256`
- [ ] Todos os modelos têm `@@index([tenantId])`
