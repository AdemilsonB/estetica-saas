import { z } from 'zod'
import { PlanName, SubscriptionStatus } from '@prisma/client'

export { PlanName, SubscriptionStatus }

export const updateSubscriptionSchema = z.object({
  plan: z.nativeEnum(PlanName),
  status: z.nativeEnum(SubscriptionStatus),
  reason: z.string().min(1),
})

export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>
