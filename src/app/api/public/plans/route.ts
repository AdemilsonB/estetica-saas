import { prisma } from '@/shared/database/prisma'
import { handleApiError } from '@/shared/http/handle-api-error'

export async function GET() {
  try {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    })

    const result = plans.map((plan) => ({
      name: plan.name,
      displayName: plan.displayName,
      price: Number(plan.price),
      description: plan.description ?? '',
      trialDays: plan.trialDays,
    }))

    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
