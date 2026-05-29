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
