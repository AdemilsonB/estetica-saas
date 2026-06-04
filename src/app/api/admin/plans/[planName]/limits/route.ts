import { z } from 'zod'
import { prisma } from '@/shared/database/prisma'
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

type Params = { params: Promise<{ planName: string }> }

const updateLimitsSchema = z.object({
  limits: z.array(z.object({
    limitKey: z.string().min(1),
    value:    z.number().int().min(0),
  })),
})

export async function GET(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    await getAdminContext(request)
    const { planName } = await params
    const limits = await prisma.planLimitConfig.findMany({
      where: { plan: planName as any },
      orderBy: { limitKey: 'asc' },
    })
    return Response.json(limits)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    await getAdminContext(request)
    const { planName } = await params
    const { limits } = await validateInput(request, updateLimitsSchema)
    await Promise.all(
      limits.map(({ limitKey, value }) =>
        prisma.planLimitConfig.upsert({
          where: { plan_limitKey: { plan: planName as any, limitKey } },
          update: { value },
          create: { plan: planName as any, limitKey, value },
        })
      )
    )
    const updated = await prisma.planLimitConfig.findMany({
      where: { plan: planName as any },
      orderBy: { limitKey: 'asc' },
    })
    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
