import { z } from 'zod'
import { prisma } from '@/shared/database/prisma'
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

type Params = { params: Promise<{ planName: string }> }

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
    const features = await prisma.planFeatureConfig.findMany({
      where: { plan: planName as any },
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
    await getAdminContext(request)
    const { planName } = await params
    const { features } = await validateInput(request, updateFeaturesSchema)
    await Promise.all(
      features.map(({ sectionKey, enabled }) =>
        prisma.planFeatureConfig.upsert({
          where: { plan_sectionKey: { plan: planName as any, sectionKey } },
          update: { enabled },
          create: { plan: planName as any, sectionKey, enabled },
        })
      )
    )
    const updated = await prisma.planFeatureConfig.findMany({
      where: { plan: planName as any },
      orderBy: { sectionKey: 'asc' },
    })
    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
