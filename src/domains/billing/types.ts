import { z } from "zod";

export const PLAN_NAMES = ["free", "starter", "pro", "enterprise"] as const;
export type PlanName = (typeof PLAN_NAMES)[number];

export const PLAN_LIMITS: Record<PlanName, PlanLimits> = {
  free:       { maxUsers: 2,   maxAppointmentsPerMonth: 50,   maxNotificationsPerMonth: 0,    maxUnits: 1 },
  starter:    { maxUsers: 5,   maxAppointmentsPerMonth: 300,  maxNotificationsPerMonth: 200,  maxUnits: 1 },
  pro:        { maxUsers: 20,  maxAppointmentsPerMonth: 2000, maxNotificationsPerMonth: 2000, maxUnits: 3 },
  enterprise: { maxUsers: -1,  maxAppointmentsPerMonth: -1,   maxNotificationsPerMonth: -1,   maxUnits: -1 },
} as const;

export type PlanLimits = {
  maxUsers: number;
  maxAppointmentsPerMonth: number;
  maxNotificationsPerMonth: number;
  maxUnits: number;
};

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "cancelled" | "expired";

export const createSubscriptionSchema = z.object({
  tenantId: z.string().cuid(),
  plan: z.enum(PLAN_NAMES),
  trialEndsAt: z.string().datetime().optional(),
  externalId: z.string().optional(),
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;

export type Subscription = {
  id: string;
  tenantId: string;
  plan: PlanName;
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  externalId: string | null;
  createdAt: Date;
  updatedAt: Date;
};
