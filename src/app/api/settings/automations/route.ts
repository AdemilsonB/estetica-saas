import { z } from 'zod'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { ensurePermission, PERMISSIONS } from '@/shared/auth/permissions'
import { validateInput } from '@/shared/http/validate-input'
import { handleApiError } from '@/shared/http/handle-api-error'
import { prisma } from '@/shared/database/prisma'

const AUTOMATIONS_SELECT = {
  reminderLeadHours:      true,
  autoReplyEnabled:       true,
  autoReplyIntervalHours: true,
  autoReplyMessage:       true,
  offHoursEnabled:        true,
  offHoursMessage:        true,
  dailyStatusEnabled:     true,
  dailyStatusHour:        true,
  birthdayEnabled:        true,
  birthdayMessage:        true,
  birthdayGiftServiceId:  true,
} as const

const AutomationsSchema = z.object({
  reminderLeadHours:      z.number().int().min(0).max(72).optional(),
  autoReplyEnabled:       z.boolean().optional(),
  autoReplyIntervalHours: z.number().int().min(1).max(24).optional(),
  autoReplyMessage:       z.string().max(500).nullable().optional(),
  offHoursEnabled:        z.boolean().optional(),
  offHoursMessage:        z.string().max(500).nullable().optional(),
  dailyStatusEnabled:     z.boolean().optional(),
  dailyStatusHour:        z.number().int().min(0).max(23).optional(),
  birthdayEnabled:        z.boolean().optional(),
  birthdayMessage:        z.string().max(300).nullable().optional(),
  birthdayGiftServiceId:  z.string().nullable().optional(),
})

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.settings.view)

    const tenant = await prisma.tenant.findFirst({
      where: { id: session.tenantId },
      select: AUTOMATIONS_SELECT,
    })

    if (!tenant) return Response.json({ error: 'Tenant não encontrado' }, { status: 404 })
    return Response.json(tenant)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.settings.manage)

    const input = await validateInput(request, AutomationsSchema)

    const tenant = await prisma.tenant.update({
      where: { id: session.tenantId },
      data: input,
      select: AUTOMATIONS_SELECT,
    })

    return Response.json(tenant)
  } catch (error) {
    return handleApiError(error)
  }
}
