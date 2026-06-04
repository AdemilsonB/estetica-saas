import { prisma } from '@/shared/database/prisma'
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { z } from 'zod'
import { validateInput } from '@/shared/http/validate-input'

const UpdateSchema = z.object({
  requireEmailVerification: z.boolean(),
})

async function getOrCreateSettings() {
  const existing = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } })
  if (existing) return existing
  return prisma.platformSettings.create({ data: { id: 'singleton' } })
}

export async function GET(request: Request) {
  try {
    await getAdminContext(request)
    const settings = await getOrCreateSettings()
    return Response.json(settings)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request) {
  try {
    await getAdminContext(request)
    const input = await validateInput(request, UpdateSchema)
    const settings = await prisma.platformSettings.upsert({
      where: { id: 'singleton' },
      update: { requireEmailVerification: input.requireEmailVerification },
      create: { id: 'singleton', requireEmailVerification: input.requireEmailVerification },
    })
    return Response.json(settings)
  } catch (error) {
    return handleApiError(error)
  }
}
