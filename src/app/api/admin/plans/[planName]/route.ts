import { z } from 'zod'
import { revalidatePath } from 'next/cache'
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

const updatePlanSchema = z.object({
  displayName:   z.string().min(1).max(50).optional(),
  price:         z.number().min(0).optional(),
  description:   z.string().max(2000).nullable().optional(),
  trialDays:     z.number().int().min(0).max(365).optional(),
  stripePriceId: z.string().max(100).nullable().optional(),
  isActive:      z.boolean().optional(),
})

export async function PUT(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    const session = await getAdminContext(request)
    const { planName } = await params
    if (!isPlanName(planName)) {
      return Response.json({ error: 'Plano inválido' }, { status: 400 })
    }
    const input = await validateInput(request, updatePlanSchema)
    const plan = await prisma.plan.update({
      where: { name: planName },
      data: input,
    })

    await logAdminAction({
      adminUserId: session.userId,
      action: 'plan.updated',
      targetType: 'Plan',
      targetId: planName,
      metadata: input,
      request,
    })

    // Estoura o cache ISR das páginas públicas que exibem dados de plano,
    // para que a edição do admin apareça imediatamente (sem esperar revalidate).
    revalidatePath('/')
    revalidatePath('/planos')

    return Response.json(plan)
  } catch (error) {
    return handleApiError(error)
  }
}
