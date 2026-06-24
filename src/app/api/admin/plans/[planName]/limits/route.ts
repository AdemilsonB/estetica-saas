import { z } from 'zod'
import { PlanName } from '@prisma/client'
import { prisma } from '@/shared/database/prisma'
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { logAdminAction } from '@/shared/audit/admin-audit'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

type Params = { params: Promise<{ planName: string }> }

const VALID_PLANS = Object.values(PlanName)

function isPlanName(value: string): value is PlanName {
  return VALID_PLANS.includes(value as PlanName)
}

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
    if (!isPlanName(planName)) {
      return Response.json({ error: 'Plano inválido' }, { status: 400 })
    }
    const limits = await prisma.planLimitConfig.findMany({
      where: { plan: planName },
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
    const session = await getAdminContext(request)
    const { planName } = await params
    if (!isPlanName(planName)) {
      return Response.json({ error: 'Plano inválido' }, { status: 400 })
    }
    const { limits } = await validateInput(request, updateLimitsSchema)
    await Promise.all(
      limits.map(({ limitKey, value }) =>
        prisma.planLimitConfig.upsert({
          where: { plan_limitKey: { plan: planName, limitKey } },
          update: { value },
          create: { plan: planName, limitKey, value },
        })
      )
    )
    const updated = await prisma.planLimitConfig.findMany({
      where: { plan: planName },
      orderBy: { limitKey: 'asc' },
    })

    await logAdminAction({
      adminUserId: session.userId,
      action: 'plan.limits_updated',
      targetType: 'Plan',
      targetId: planName,
      metadata: { limits },
      request,
    })

    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
