import { z } from 'zod'
import { PlanName } from '@prisma/client'
import { prisma } from '@/shared/database/prisma'
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { logAdminAction } from '@/shared/audit/admin-audit'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { CAPABILITY_REGISTRY } from '@/shared/permissions/capability-registry'

type Params = { params: Promise<{ planName: string }> }

const VALID_PLANS = Object.values(PlanName)
const ESSENTIAL_KEYS = new Set(CAPABILITY_REGISTRY.filter((c) => c.essential).map((c) => c.key))

function isPlanName(value: string): value is PlanName {
  return VALID_PLANS.includes(value as PlanName)
}

const updateFeaturesSchema = z.object({
  features: z.array(z.object({
    sectionKey: z.string().min(1),
    enabled:    z.boolean(),
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
    const features = await prisma.planFeatureConfig.findMany({
      where: { plan: planName },
      orderBy: { sectionKey: 'asc' },
    })
    return Response.json(features)
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
    const { features } = await validateInput(request, updateFeaturesSchema)
    const safeFeatures = features.map((f) =>
      ESSENTIAL_KEYS.has(f.sectionKey) ? { ...f, enabled: true } : f,
    )
    await Promise.all(
      safeFeatures.map(({ sectionKey, enabled }) =>
        prisma.planFeatureConfig.upsert({
          where: { plan_sectionKey: { plan: planName, sectionKey } },
          update: { enabled },
          create: { plan: planName, sectionKey, enabled },
        })
      )
    )
    const updated = await prisma.planFeatureConfig.findMany({
      where: { plan: planName },
      orderBy: { sectionKey: 'asc' },
    })

    await logAdminAction({
      adminUserId: session.userId,
      action: 'plan.features_updated',
      targetType: 'Plan',
      targetId: planName,
      metadata: { features: safeFeatures },
      request,
    })

    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
