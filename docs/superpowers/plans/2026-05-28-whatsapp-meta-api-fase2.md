# WhatsApp Meta API — Fase 2: Motor de Automação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Pré-requisito:** Fase 1 completa e mergeada.

**Goal:** Construir o domínio `automation` — repositório de regras, service de avaliação de condições, subscriptions para event-based triggers e scheduler pg-boss para time-based triggers (aniversário, cliente inativo).

**Architecture:** `automation/` recebe eventos via `eventBus`, avalia regras por tenant, verifica cooldown e publica `automation.action.requested`. O scheduler `pg-boss` roda cron diário e encontra clientes elegíveis para triggers temporais. Nenhuma chamada direta ao `whatsapp/` domain.

**Tech Stack:** Next.js 15, Prisma, pg-boss v12, Zod, Vitest.

**Branch:** continua em `feat/whatsapp-meta-api`.

---

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| `src/domains/automation/types.ts` | Modificar — expande stub com tipos concretos |
| `src/domains/automation/schemas.ts` | Criar |
| `src/domains/automation/automation.repository.ts` | Criar |
| `src/domains/automation/automation.repository.test.ts` | Criar |
| `src/domains/automation/automation.service.ts` | Criar |
| `src/domains/automation/automation.service.test.ts` | Criar |
| `src/domains/automation/automation.scheduler.ts` | Criar |
| `src/domains/automation/automation.scheduler.test.ts` | Criar |
| `src/domains/automation/subscriptions.ts` | Criar |
| `src/app/api/automation/rules/route.ts` | Criar |
| `src/app/api/automation/rules/[id]/route.ts` | Criar |
| `src/app/api/_lib/runtime.ts` | Modificar — registra automation subscriptions + scheduler |
| `src/shared/test/factories/automation.factory.ts` | Criar |

---

### Task 9: Tipos e schemas de automação

**Files:**
- Modify: `src/domains/automation/types.ts`
- Create: `src/domains/automation/schemas.ts`

- [ ] **Step 1: Substituir conteúdo de types.ts**

O arquivo atual tem tipos TypeScript do stub inicial. Substituir completamente:

```typescript
// src/domains/automation/types.ts
import type { AutomationRule, AutomationExecution, AutomationExecutionStatus } from "@prisma/client";

export type { AutomationRule, AutomationExecution, AutomationExecutionStatus };

export const AUTOMATION_TRIGGERS = [
  "appointment.created",
  "appointment.completed",
  "appointment.cancelled",
  "appointment.no_show",
  "customer.created",
  "customer.inactive",
  "customer.birthday",
  "customer.return_window",
] as const;

export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number];

export type AutomationCondition = {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "greater_than" | "less_than";
  value: string | number | boolean;
};

export type VariableMapping = {
  templateVar: string;   // "1", "2", "3"
  source: "customer.name" | "customer.phone" | "customer.birthDate" | "static" | string;
  value?: string;        // para source = "static"
};

export type EventContext = {
  tenantId: string;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  [key: string]: unknown;
};
```

- [ ] **Step 2: Criar schemas.ts**

```typescript
// src/domains/automation/schemas.ts
import { z } from "zod";
import { AUTOMATION_TRIGGERS } from "./types";

export const automationConditionSchema = z.object({
  field: z.string().trim().min(1),
  operator: z.enum(["equals", "not_equals", "contains", "greater_than", "less_than"]),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

export const variableMappingSchema = z.object({
  templateVar: z.string().trim().min(1),
  source: z.string().trim().min(1),
  value: z.string().optional(),
});

export const createAutomationRuleSchema = z.object({
  name: z.string().trim().min(2).max(100),
  trigger: z.enum(AUTOMATION_TRIGGERS),
  conditions: z.array(automationConditionSchema).default([]),
  templateId: z.string().optional(),
  variables: z.array(variableMappingSchema).default([]),
  active: z.boolean().default(true),
  cooldownDays: z.number().int().min(0).max(365).default(30),
  maxPerMonth: z.number().int().min(1).max(10).default(2),
  sendHourStart: z.number().int().min(0).max(23).default(8),
  sendHourEnd: z.number().int().min(0).max(23).default(20),
  inactiveDays: z.number().int().min(1).max(365).optional(),
});

export const updateAutomationRuleSchema = createAutomationRuleSchema
  .partial()
  .extend({ active: z.boolean().optional() });

export type CreateAutomationRuleInput = z.infer<typeof createAutomationRuleSchema>;
export type UpdateAutomationRuleInput = z.infer<typeof updateAutomationRuleSchema>;
```

- [ ] **Step 3: Verificar**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/domains/automation/types.ts src/domains/automation/schemas.ts
git commit -m "feat(automation): tipos concretos e schemas Zod de regras de automação"
```

---

### Task 10: AutomationRule repository

**Files:**
- Create: `src/domains/automation/automation.repository.ts`
- Create: `src/domains/automation/automation.repository.test.ts`

- [ ] **Step 1: Criar automation.repository.ts**

```typescript
// src/domains/automation/automation.repository.ts
import { prisma } from "@/shared/database/prisma";
import type { CreateAutomationRuleInput, UpdateAutomationRuleInput } from "./schemas";

export class AutomationRepository {
  async findAll(tenantId: string) {
    return prisma.automationRule.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { executions: true } } },
    });
  }

  async findById(tenantId: string, id: string) {
    return prisma.automationRule.findFirst({ where: { id, tenantId } });
  }

  async findActiveByTrigger(tenantId: string, trigger: string) {
    return prisma.automationRule.findMany({
      where: { tenantId, trigger, active: true },
    });
  }

  async findActiveTimeBased(tenantId: string) {
    return prisma.automationRule.findMany({
      where: {
        tenantId,
        active: true,
        trigger: { in: ["customer.inactive", "customer.birthday", "customer.return_window"] },
      },
    });
  }

  async create(tenantId: string, input: CreateAutomationRuleInput) {
    return prisma.automationRule.create({
      data: {
        tenantId,
        name: input.name,
        trigger: input.trigger,
        conditions: input.conditions,
        templateId: input.templateId,
        variables: input.variables,
        active: input.active,
        cooldownDays: input.cooldownDays,
        maxPerMonth: input.maxPerMonth,
        sendHourStart: input.sendHourStart,
        sendHourEnd: input.sendHourEnd,
        inactiveDays: input.inactiveDays,
      },
    });
  }

  async update(tenantId: string, id: string, input: UpdateAutomationRuleInput) {
    return prisma.automationRule.update({
      where: { id },
      data: input,
    });
  }

  async delete(tenantId: string, id: string) {
    return prisma.automationRule.deleteMany({ where: { id, tenantId } });
  }

  async checkCooldown(ruleId: string, customerId: string, cooldownDays: number): Promise<boolean> {
    const since = new Date();
    since.setDate(since.getDate() - cooldownDays);

    const recent = await prisma.automationExecution.findFirst({
      where: {
        ruleId,
        customerId,
        status: "SUCCESS",
        executedAt: { gte: since },
      },
    });

    return !!recent;
  }

  async countMonthlyForCustomer(tenantId: string, customerId: string): Promise<number> {
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);

    return prisma.automationExecution.count({
      where: {
        tenantId,
        customerId,
        status: "SUCCESS",
        executedAt: { gte: firstOfMonth },
      },
    });
  }

  async logExecution(data: {
    tenantId: string;
    ruleId: string;
    customerId: string;
    status: "SUCCESS" | "FAILED" | "SKIPPED";
    skippedReason?: string;
    messageId?: string;
  }) {
    return prisma.automationExecution.create({ data });
  }

  async findEligibleInactiveCustomers(tenantId: string, inactiveDays: number) {
    const since = new Date();
    since.setDate(since.getDate() - inactiveDays);

    return prisma.customer.findMany({
      where: {
        tenantId,
        whatsappOptOut: false,
        consentGiven: true,
        phone: { not: null },
        lastAppointmentAt: { lt: since, not: null },
      },
      select: { id: true, name: true, phone: true, lastAppointmentAt: true },
    });
  }

  async findBirthdayCustomers(tenantId: string) {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    // Busca clientes cujo birthDate tem mesmo mês e dia de hoje
    return prisma.$queryRaw<Array<{ id: string; name: string; phone: string | null }>>`
      SELECT id, name, phone
      FROM "Customer"
      WHERE "tenantId" = ${tenantId}
        AND "whatsappOptOut" = false
        AND "consentGiven" = true
        AND phone IS NOT NULL
        AND "birthDate" IS NOT NULL
        AND EXTRACT(MONTH FROM "birthDate") = ${month}
        AND EXTRACT(DAY FROM "birthDate") = ${day}
    `;
  }
}

export const automationRepository = new AutomationRepository();
```

- [ ] **Step 2: Escrever testes do repository**

```typescript
// src/domains/automation/automation.repository.test.ts
import { describe, it, expect } from "vitest";
import { prismaMock } from "@/shared/test/prisma-mock";
import { AutomationRepository } from "./automation.repository";

const repo = new AutomationRepository();

const makeRule = (overrides = {}) => ({
  id: "rule-1", tenantId: "t-1", name: "Inativo 60 dias",
  trigger: "customer.inactive", conditions: [], templateId: "tpl-1",
  variables: [], active: true, cooldownDays: 30, maxPerMonth: 2,
  sendHourStart: 8, sendHourEnd: 20, inactiveDays: 60,
  createdAt: new Date(), updatedAt: new Date(), ...overrides,
});

describe("AutomationRepository", () => {
  it("findActiveByTrigger retorna apenas regras ativas", async () => {
    const rule = makeRule();
    prismaMock.automationRule.findMany.mockResolvedValue([rule]);
    const result = await repo.findActiveByTrigger("t-1", "customer.inactive");
    expect(result).toHaveLength(1);
    expect(prismaMock.automationRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "t-1", trigger: "customer.inactive", active: true } }),
    );
  });

  it("checkCooldown retorna true quando existe execução recente", async () => {
    prismaMock.automationExecution.findFirst.mockResolvedValue({
      id: "exec-1", tenantId: "t-1", ruleId: "rule-1", customerId: "c-1",
      messageId: null, status: "SUCCESS", skippedReason: null, executedAt: new Date(),
    });
    const result = await repo.checkCooldown("rule-1", "c-1", 30);
    expect(result).toBe(true);
  });

  it("checkCooldown retorna false sem execução recente", async () => {
    prismaMock.automationExecution.findFirst.mockResolvedValue(null);
    const result = await repo.checkCooldown("rule-1", "c-1", 30);
    expect(result).toBe(false);
  });

  it("logExecution cria registro no banco", async () => {
    const exec = {
      id: "exec-1", tenantId: "t-1", ruleId: "rule-1", customerId: "c-1",
      messageId: null, status: "SUCCESS" as const, skippedReason: null, executedAt: new Date(),
    };
    prismaMock.automationExecution.create.mockResolvedValue(exec);

    await repo.logExecution({ tenantId: "t-1", ruleId: "rule-1", customerId: "c-1", status: "SUCCESS" });

    expect(prismaMock.automationExecution.create).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 3: Rodar testes**

```bash
npx vitest run src/domains/automation/automation.repository.test.ts
```

Esperado: 4 passed.

- [ ] **Step 4: Commit**

```bash
git add src/domains/automation/automation.repository.ts src/domains/automation/automation.repository.test.ts
git commit -m "feat(automation): AutomationRepository — regras, cooldown e elegibilidade"
```

---

### Task 11: AutomationService — avaliação de regras

**Files:**
- Create: `src/domains/automation/automation.service.ts`
- Create: `src/domains/automation/automation.service.test.ts`

- [ ] **Step 1: Criar automation.service.ts**

```typescript
// src/domains/automation/automation.service.ts
import { eventBus } from "@/shared/events/event-bus";
import { AutomationRuleNotFoundError } from "@/shared/errors";
import { automationRepository } from "./automation.repository";
import type { AutomationCondition, EventContext, VariableMapping } from "./types";
import type { CreateAutomationRuleInput, UpdateAutomationRuleInput } from "./schemas";

function evaluateCondition(condition: AutomationCondition, context: EventContext): boolean {
  const value = context[condition.field];
  switch (condition.operator) {
    case "equals": return value === condition.value;
    case "not_equals": return value !== condition.value;
    case "contains":
      return typeof value === "string" && value.includes(String(condition.value));
    case "greater_than":
      return typeof value === "number" && value > Number(condition.value);
    case "less_than":
      return typeof value === "number" && value < Number(condition.value);
    default: return true;
  }
}

function resolveVariables(
  mappings: VariableMapping[],
  context: EventContext,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const mapping of mappings) {
    if (mapping.source === "static") {
      result[mapping.templateVar] = mapping.value ?? "";
    } else {
      const parts = mapping.source.split(".");
      let val: unknown = context;
      for (const part of parts) {
        val = (val as Record<string, unknown>)?.[part];
      }
      result[mapping.templateVar] = String(val ?? "");
    }
  }
  return result;
}

function isWithinSendWindow(start: number, end: number): boolean {
  const hour = new Date().getHours();
  return hour >= start && hour < end;
}

export class AutomationService {
  async list(tenantId: string) {
    return automationRepository.findAll(tenantId);
  }

  async create(tenantId: string, input: CreateAutomationRuleInput) {
    return automationRepository.create(tenantId, input);
  }

  async update(tenantId: string, id: string, input: UpdateAutomationRuleInput) {
    const rule = await automationRepository.findById(tenantId, id);
    if (!rule) throw new AutomationRuleNotFoundError();
    return automationRepository.update(tenantId, id, input);
  }

  async delete(tenantId: string, id: string) {
    const rule = await automationRepository.findById(tenantId, id);
    if (!rule) throw new AutomationRuleNotFoundError();
    return automationRepository.delete(tenantId, id);
  }

  async evaluateEventTrigger(trigger: string, context: EventContext) {
    if (!context.customerPhone) return;

    const rules = await automationRepository.findActiveByTrigger(context.tenantId, trigger);

    for (const rule of rules) {
      const conditionsMet = (rule.conditions as AutomationCondition[]).every((c) =>
        evaluateCondition(c, context),
      );

      if (!conditionsMet) {
        await automationRepository.logExecution({
          tenantId: context.tenantId,
          ruleId: rule.id,
          customerId: context.customerId,
          status: "SKIPPED",
          skippedReason: "conditions_not_met",
        });
        continue;
      }

      const inCooldown = await automationRepository.checkCooldown(
        rule.id,
        context.customerId,
        rule.cooldownDays,
      );

      if (inCooldown) {
        await automationRepository.logExecution({
          tenantId: context.tenantId,
          ruleId: rule.id,
          customerId: context.customerId,
          status: "SKIPPED",
          skippedReason: "cooldown",
        });
        continue;
      }

      const monthlyCount = await automationRepository.countMonthlyForCustomer(
        context.tenantId,
        context.customerId,
      );

      if (monthlyCount >= rule.maxPerMonth) {
        await automationRepository.logExecution({
          tenantId: context.tenantId,
          ruleId: rule.id,
          customerId: context.customerId,
          status: "SKIPPED",
          skippedReason: "frequency_limit",
        });
        continue;
      }

      if (!isWithinSendWindow(rule.sendHourStart, rule.sendHourEnd)) {
        await automationRepository.logExecution({
          tenantId: context.tenantId,
          ruleId: rule.id,
          customerId: context.customerId,
          status: "SKIPPED",
          skippedReason: "fora_janela",
        });
        continue;
      }

      if (!rule.templateId) {
        await automationRepository.logExecution({
          tenantId: context.tenantId,
          ruleId: rule.id,
          customerId: context.customerId,
          status: "SKIPPED",
          skippedReason: "template_nao_configurado",
        });
        continue;
      }

      const variables = resolveVariables(rule.variables as VariableMapping[], context);

      eventBus.publish({
        type: "automation.action.requested",
        payload: {
          tenantId: context.tenantId,
          ruleId: rule.id,
          action: "send_whatsapp",
          templateId: rule.templateId,
          customerId: context.customerId,
          recipient: context.customerPhone,
          variables,
          origin: "automation",
        },
      });

      await automationRepository.logExecution({
        tenantId: context.tenantId,
        ruleId: rule.id,
        customerId: context.customerId,
        status: "SUCCESS",
      });
    }
  }
}

export const automationService = new AutomationService();
```

- [ ] **Step 2: Escrever testes do service**

```typescript
// src/domains/automation/automation.service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AutomationService } from "./automation.service";
import { automationRepository } from "./automation.repository";
import { eventBus } from "@/shared/events/event-bus";

vi.mock("./automation.repository");
vi.mock("@/shared/events/event-bus");

const mockRepo = vi.mocked(automationRepository);
const mockBus = vi.mocked(eventBus);

const makeRule = (overrides = {}) => ({
  id: "rule-1", tenantId: "t-1", name: "Inativo",
  trigger: "customer.inactive", conditions: [], templateId: "tpl-1",
  variables: [{ templateVar: "1", source: "customer.name" }],
  active: true, cooldownDays: 30, maxPerMonth: 2,
  sendHourStart: 0, sendHourEnd: 23, inactiveDays: 60,
  createdAt: new Date(), updatedAt: new Date(), ...overrides,
});

const makeContext = (overrides = {}) => ({
  tenantId: "t-1", customerId: "c-1",
  customerName: "João Silva", customerPhone: "5511999999999",
  ...overrides,
});

describe("AutomationService.evaluateEventTrigger", () => {
  const service = new AutomationService();

  beforeEach(() => vi.clearAllMocks());

  it("não processa se cliente sem telefone", async () => {
    await service.evaluateEventTrigger("customer.inactive", makeContext({ customerPhone: null }));
    expect(mockRepo.findActiveByTrigger).not.toHaveBeenCalled();
  });

  it("publica automation.action.requested quando todas as condições passam", async () => {
    mockRepo.findActiveByTrigger.mockResolvedValue([makeRule()]);
    mockRepo.checkCooldown.mockResolvedValue(false);
    mockRepo.countMonthlyForCustomer.mockResolvedValue(0);
    mockRepo.logExecution.mockResolvedValue({} as never);

    await service.evaluateEventTrigger("customer.inactive", makeContext());

    expect(mockBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "automation.action.requested",
        payload: expect.objectContaining({
          templateId: "tpl-1",
          customerId: "c-1",
          variables: { "1": "João Silva" },
        }),
      }),
    );
  });

  it("registra SKIPPED com motivo cooldown", async () => {
    mockRepo.findActiveByTrigger.mockResolvedValue([makeRule()]);
    mockRepo.checkCooldown.mockResolvedValue(true);
    mockRepo.logExecution.mockResolvedValue({} as never);

    await service.evaluateEventTrigger("customer.inactive", makeContext());

    expect(mockBus.publish).not.toHaveBeenCalled();
    expect(mockRepo.logExecution).toHaveBeenCalledWith(
      expect.objectContaining({ status: "SKIPPED", skippedReason: "cooldown" }),
    );
  });

  it("registra SKIPPED quando templateId não configurado", async () => {
    mockRepo.findActiveByTrigger.mockResolvedValue([makeRule({ templateId: null })]);
    mockRepo.checkCooldown.mockResolvedValue(false);
    mockRepo.countMonthlyForCustomer.mockResolvedValue(0);
    mockRepo.logExecution.mockResolvedValue({} as never);

    await service.evaluateEventTrigger("customer.inactive", makeContext());

    expect(mockBus.publish).not.toHaveBeenCalled();
    expect(mockRepo.logExecution).toHaveBeenCalledWith(
      expect.objectContaining({ skippedReason: "template_nao_configurado" }),
    );
  });

  it("registra SKIPPED quando limite mensal atingido", async () => {
    mockRepo.findActiveByTrigger.mockResolvedValue([makeRule()]);
    mockRepo.checkCooldown.mockResolvedValue(false);
    mockRepo.countMonthlyForCustomer.mockResolvedValue(2); // maxPerMonth = 2
    mockRepo.logExecution.mockResolvedValue({} as never);

    await service.evaluateEventTrigger("customer.inactive", makeContext());

    expect(mockBus.publish).not.toHaveBeenCalled();
    expect(mockRepo.logExecution).toHaveBeenCalledWith(
      expect.objectContaining({ skippedReason: "frequency_limit" }),
    );
  });
});
```

- [ ] **Step 3: Rodar testes**

```bash
npx vitest run src/domains/automation/automation.service.test.ts
```

Esperado: 5 passed.

- [ ] **Step 4: Commit**

```bash
git add src/domains/automation/automation.service.ts src/domains/automation/automation.service.test.ts
git commit -m "feat(automation): AutomationService — avaliação de triggers, condições, cooldown e frequência"
```

---

### Task 12: Automation subscriptions (event-based)

**Files:**
- Create: `src/domains/automation/subscriptions.ts`

- [ ] **Step 1: Criar subscriptions.ts**

```typescript
// src/domains/automation/subscriptions.ts
import { eventBus } from "@/shared/events/event-bus";
import { automationService } from "./automation.service";

let registered = false;

export function registerAutomationSubscriptions() {
  if (registered) return;
  registered = true;

  eventBus.subscribe("scheduling.appointment.created", async ({ tenantId, appointment, customer }) => {
    await automationService.evaluateEventTrigger("appointment.created", {
      tenantId,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      appointmentId: appointment.id,
      startsAt: appointment.startsAt.toISOString(),
    });
  });

  eventBus.subscribe("scheduling.appointment.completed", async ({ tenantId, appointment, customer, service }) => {
    await automationService.evaluateEventTrigger("appointment.completed", {
      tenantId,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      appointmentId: appointment.id,
      serviceName: service.name,
    });
  });

  eventBus.subscribe("scheduling.appointment.cancelled", async ({ tenantId, appointment, customer }) => {
    await automationService.evaluateEventTrigger("appointment.cancelled", {
      tenantId,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      appointmentId: appointment.id,
    });
  });

  eventBus.subscribe("scheduling.appointment.no_show", async ({ tenantId, appointment, customer }) => {
    await automationService.evaluateEventTrigger("appointment.no_show", {
      tenantId,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      appointmentId: appointment.id,
    });
  });

  eventBus.subscribe("crm.customer.created", async ({ tenantId, customer }) => {
    await automationService.evaluateEventTrigger("customer.created", {
      tenantId,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
    });
  });
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/domains/automation/subscriptions.ts
git commit -m "feat(automation): subscriptions — escuta eventos de agendamento e CRM"
```

---

### Task 13: AutomationScheduler + runtime + API routes

**Files:**
- Create: `src/domains/automation/automation.scheduler.ts`
- Create: `src/domains/automation/automation.scheduler.test.ts`
- Create: `src/app/api/automation/rules/route.ts`
- Create: `src/app/api/automation/rules/[id]/route.ts`
- Modify: `src/app/api/_lib/runtime.ts`
- Create: `src/shared/test/factories/automation.factory.ts`

- [ ] **Step 1: Criar automation.scheduler.ts**

```typescript
// src/domains/automation/automation.scheduler.ts
import type { Job } from "pg-boss";
import { prisma } from "@/shared/database/prisma";
import { getPgBoss } from "@/shared/queue/pg-boss";
import { automationRepository } from "./automation.repository";
import { automationService } from "./automation.service";

export const AUTOMATION_SCAN_JOB = "automation-daily-scan";
export const AUTOMATION_ACTION_JOB = "automation-process-action";

type ActionJobPayload = {
  tenantId: string;
  ruleId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  trigger: string;
};

export async function scheduleAutomationDailyScan() {
  const boss = getPgBoss();
  await boss.schedule(AUTOMATION_SCAN_JOB, "0 9 * * *", {}, { tz: "America/Sao_Paulo" });
}

export async function handleAutomationDailyScan(_jobs: Job<Record<string, never>>[]) {
  const tenants = await prisma.whatsAppConfig.findMany({
    where: { active: true },
    select: { tenantId: true },
  });

  const boss = getPgBoss();

  for (const { tenantId } of tenants) {
    const rules = await automationRepository.findActiveTimeBased(tenantId);

    for (const rule of rules) {
      let candidates: Array<{ id: string; name: string; phone: string | null }> = [];

      if (rule.trigger === "customer.inactive" && rule.inactiveDays) {
        candidates = await automationRepository.findEligibleInactiveCustomers(
          tenantId,
          rule.inactiveDays,
        );
      }

      if (rule.trigger === "customer.birthday") {
        candidates = await automationRepository.findBirthdayCustomers(tenantId);
      }

      // Limita 100 por rodada para evitar sobrecarga
      const batch = candidates.slice(0, 100);

      for (const customer of batch) {
        if (!customer.phone) continue;

        await boss.send(
          AUTOMATION_ACTION_JOB,
          {
            tenantId,
            ruleId: rule.id,
            customerId: customer.id,
            customerName: customer.name,
            customerPhone: customer.phone,
            trigger: rule.trigger,
          } satisfies ActionJobPayload,
          {
            singletonKey: `${rule.id}-${customer.id}-${new Date().toISOString().slice(0, 10)}`,
            retryLimit: 2,
            retryDelay: 300,
          },
        );
      }
    }
  }
}

export async function handleAutomationAction(jobs: Job<ActionJobPayload>[]) {
  for (const job of jobs) {
    const { tenantId, ruleId, customerId, customerName, customerPhone, trigger } = job.data;

    const rule = await automationRepository.findById(tenantId, ruleId);
    if (!rule || !rule.active) continue;

    await automationService.evaluateEventTrigger(trigger, {
      tenantId,
      customerId,
      customerName,
      customerPhone,
    });
  }
}
```

- [ ] **Step 2: Escrever testes do scheduler**

```typescript
// src/domains/automation/automation.scheduler.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleAutomationDailyScan } from "./automation.scheduler";
import { automationRepository } from "./automation.repository";
import { getPgBoss } from "@/shared/queue/pg-boss";
import { prismaMock } from "@/shared/test/prisma-mock";

vi.mock("./automation.repository");
vi.mock("@/shared/queue/pg-boss");

const mockRepo = vi.mocked(automationRepository);
const mockGetBoss = vi.mocked(getPgBoss);

const makeBoss = () => ({ send: vi.fn().mockResolvedValue("job-id"), schedule: vi.fn() });

describe("handleAutomationDailyScan", () => {
  beforeEach(() => vi.clearAllMocks());

  it("não enfileira nada se não há tenants com WhatsApp ativo", async () => {
    prismaMock.whatsAppConfig.findMany.mockResolvedValue([]);
    const boss = makeBoss();
    mockGetBoss.mockReturnValue(boss as never);

    await handleAutomationDailyScan([]);
    expect(boss.send).not.toHaveBeenCalled();
  });

  it("enfileira job por cliente elegível de regra inativa", async () => {
    prismaMock.whatsAppConfig.findMany.mockResolvedValue([{ tenantId: "t-1" }] as never);
    const boss = makeBoss();
    mockGetBoss.mockReturnValue(boss as never);

    mockRepo.findActiveTimeBased.mockResolvedValue([{
      id: "rule-1", tenantId: "t-1", trigger: "customer.inactive",
      inactiveDays: 60, conditions: [], templateId: "tpl-1",
      variables: [], active: true, cooldownDays: 30, maxPerMonth: 2,
      sendHourStart: 8, sendHourEnd: 20, name: "Inativo",
      createdAt: new Date(), updatedAt: new Date(),
    }] as never);

    mockRepo.findEligibleInactiveCustomers.mockResolvedValue([
      { id: "c-1", name: "João", phone: "5511999999999", lastAppointmentAt: new Date() },
    ]);

    await handleAutomationDailyScan([]);
    expect(boss.send).toHaveBeenCalledOnce();
  });

  it("respeita limite de 100 clientes por regra", async () => {
    prismaMock.whatsAppConfig.findMany.mockResolvedValue([{ tenantId: "t-1" }] as never);
    const boss = makeBoss();
    mockGetBoss.mockReturnValue(boss as never);

    mockRepo.findActiveTimeBased.mockResolvedValue([{
      id: "rule-1", tenantId: "t-1", trigger: "customer.inactive",
      inactiveDays: 60, conditions: [], templateId: "tpl-1",
      variables: [], active: true, cooldownDays: 30, maxPerMonth: 2,
      sendHourStart: 8, sendHourEnd: 20, name: "Inativo",
      createdAt: new Date(), updatedAt: new Date(),
    }] as never);

    // 150 clientes elegíveis — deve enviar só 100
    const customers = Array.from({ length: 150 }, (_, i) => ({
      id: `c-${i}`, name: `Cliente ${i}`, phone: `551199999${String(i).padStart(4, "0")}`, lastAppointmentAt: new Date(),
    }));
    mockRepo.findEligibleInactiveCustomers.mockResolvedValue(customers);

    await handleAutomationDailyScan([]);
    expect(boss.send).toHaveBeenCalledTimes(100);
  });
});
```

- [ ] **Step 3: Rodar testes do scheduler**

```bash
npx vitest run src/domains/automation/automation.scheduler.test.ts
```

Esperado: 3 passed.

- [ ] **Step 4: Criar API route de regras (listagem + criação)**

```typescript
// src/app/api/automation/rules/route.ts
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";
import { created } from "@/shared/http/responses";
import { automationService } from "@/domains/automation/automation.service";
import { createAutomationRuleSchema } from "@/domains/automation/schemas";

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.automation.view);
    const rules = await automationService.list(session.tenantId);
    return Response.json(rules);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.automation.manage);
    const input = await validateInput(request, createAutomationRuleSchema);
    const rule = await automationService.create(session.tenantId, input);
    return created(rule);
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 5: Criar API route de regra individual (update + delete)**

```typescript
// src/app/api/automation/rules/[id]/route.ts
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";
import { automationService } from "@/domains/automation/automation.service";
import { updateAutomationRuleSchema } from "@/domains/automation/schemas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.automation.manage);
    const { id } = await params;
    const input = await validateInput(request, updateAutomationRuleSchema);
    const rule = await automationService.update(session.tenantId, id, input);
    return Response.json(rule);
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
    ensurePermission(session, PERMISSIONS.automation.manage);
    const { id } = await params;
    await automationService.delete(session.tenantId, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 6: Atualizar runtime.ts**

Abrir `src/app/api/_lib/runtime.ts` e adicionar registro das novas subscriptions e scheduler:

```typescript
import { registerFinancialSubscriptions } from "@/domains/financial/subscriptions";
import { registerNotificationSubscriptions } from "@/domains/notifications/subscriptions";
import { registerBillingJobs } from "@/domains/billing/subscriptions";
import { registerAutomationSubscriptions } from "@/domains/automation/subscriptions";
import { startPgBoss } from "@/shared/queue/pg-boss";
import {
  APPOINTMENT_REMINDER_JOB,
  handleAppointmentReminder,
} from "@/shared/queue/jobs/appointment-reminder";
import {
  AUTOMATION_SCAN_JOB,
  AUTOMATION_ACTION_JOB,
  handleAutomationDailyScan,
  handleAutomationAction,
  scheduleAutomationDailyScan,
} from "@/domains/automation/automation.scheduler";

let initialized = false;

export function initializeDomainRuntime() {
  if (initialized) return;

  registerFinancialSubscriptions();
  registerNotificationSubscriptions();
  registerAutomationSubscriptions();

  startPgBoss().then(async (boss) => {
    boss.work(APPOINTMENT_REMINDER_JOB, handleAppointmentReminder);
    boss.work(AUTOMATION_SCAN_JOB, handleAutomationDailyScan);
    boss.work(AUTOMATION_ACTION_JOB, handleAutomationAction);
    await scheduleAutomationDailyScan();
    registerBillingJobs(boss);
  }).catch(console.error);

  initialized = true;
}
```

- [ ] **Step 7: Criar factory de testes**

```typescript
// src/shared/test/factories/automation.factory.ts
import type { AutomationRule, AutomationExecution } from "@prisma/client";

export function makeAutomationRule(overrides: Partial<AutomationRule> = {}): AutomationRule {
  return {
    id: "rule-test-id",
    tenantId: "tenant-test-id",
    name: "Inativo 60 dias",
    trigger: "customer.inactive",
    conditions: [],
    templateId: "tpl-test-id",
    variables: [{ templateVar: "1", source: "customer.name" }],
    active: true,
    cooldownDays: 30,
    maxPerMonth: 2,
    sendHourStart: 8,
    sendHourEnd: 20,
    inactiveDays: 60,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

export function makeAutomationExecution(overrides: Partial<AutomationExecution> = {}): AutomationExecution {
  return {
    id: "exec-test-id",
    tenantId: "tenant-test-id",
    ruleId: "rule-test-id",
    customerId: "customer-test-id",
    messageId: null,
    status: "SUCCESS",
    skippedReason: null,
    executedAt: new Date("2026-01-01T10:00:00Z"),
    ...overrides,
  };
}
```

- [ ] **Step 8: Rodar todos os testes da Fase 2**

```bash
npx vitest run src/domains/automation/
```

Esperado: todos os testes passando.

- [ ] **Step 9: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 10: Commit final da Fase 2**

```bash
git add src/domains/automation/ src/app/api/automation/ src/app/api/_lib/runtime.ts src/shared/test/factories/automation.factory.ts
git commit -m "feat(automation): motor de regras completo — repository, service, scheduler pg-boss, subscriptions e API routes"
```

---

## Checklist de conclusão da Fase 2

- [ ] `npx vitest run` — todos os testes passando
- [ ] `npx tsc --noEmit` — zero erros
- [ ] Scheduler registrado com `singletonKey` (sem duplicatas por cliente/dia)
- [ ] Subscriptions registradas no runtime
- [ ] `automation.action.requested` publicado com payload completo
