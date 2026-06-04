import { z } from 'zod'
import { NAV_REGISTRY } from '@/shared/permissions/nav-registry'

const validActions = ['view', 'create', 'edit', 'delete'] as const

export const permissionsSchema = z.record(
  z.string(),
  z.array(z.enum(validActions))
)

export const createRoleSchema = z.object({
  name: z.string().min(1).max(50),
  permissions: permissionsSchema,
})

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  permissions: permissionsSchema.optional(),
})
