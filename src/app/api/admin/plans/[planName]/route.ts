import { z } from 'zod'
import { prisma } from '@/shared/database/prisma'
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

type Params = { params: Promise<{ planName: string }> }

const updatePlanSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  price:       z.number().min(0).optional(),
  description: z.string().max(200).nullable().optional(),
  trialDays:   z.number().int().min(0).max(365).optional(),
  isActive:    z.boolean().optional(),
})

export async function PUT(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    await getAdminContext(request)
    const { planName } = await params
    const input = await validateInput(request, updatePlanSchema)
    const plan = await prisma.plan.update({
      where: { name: planName as any },
      data: input,
    })
    return Response.json(plan)
  } catch (error) {
    return handleApiError(error)
  }
}
