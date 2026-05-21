import { z } from "zod";
import type { DomainEvent } from "@/shared/events/domain-events";

export type AutomationTrigger = DomainEvent["type"];

export const AUTOMATION_ACTIONS = [
  "send_whatsapp",
  "send_email",
  "add_tag",
  "remove_tag",
  "create_task",
  "notify_manager",
] as const;

export type AutomationAction = (typeof AUTOMATION_ACTIONS)[number];

export const automationConditionSchema = z.object({
  field: z.string(),
  operator: z.enum(["equals", "not_equals", "contains", "greater_than", "less_than"]),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

export type AutomationCondition = z.infer<typeof automationConditionSchema>;

export const automationActionConfigSchema = z.object({
  type: z.enum(AUTOMATION_ACTIONS),
  params: z.record(z.string(), z.unknown()),
});

export type AutomationActionConfig = z.infer<typeof automationActionConfigSchema>;

export const createAutomationRuleSchema = z.object({
  name: z.string().trim().min(2).max(100),
  trigger: z.string() as z.ZodType<AutomationTrigger>,
  conditions: z.array(automationConditionSchema).default([]),
  actions: z.array(automationActionConfigSchema).min(1),
  active: z.boolean().default(true),
});

export type CreateAutomationRuleInput = z.infer<typeof createAutomationRuleSchema>;

export type AutomationRule = {
  id: string;
  tenantId: string;
  name: string;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationActionConfig[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type AutomationExecutionStatus = "success" | "failed" | "skipped";

export type AutomationExecution = {
  id: string;
  tenantId: string;
  ruleId: string;
  triggerEvent: AutomationTrigger;
  status: AutomationExecutionStatus;
  errorMessage: string | null;
  executedAt: Date;
};
