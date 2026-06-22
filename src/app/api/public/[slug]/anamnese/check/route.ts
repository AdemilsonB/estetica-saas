import { publicBookingRepository } from '@/domains/scheduling/public-booking.repository'
import { anamneseService } from '@/domains/crm/anamnese.service'
import { handleApiError } from '@/shared/http/handle-api-error'
import { prisma } from '@/shared/database/prisma'
import { checkRateLimit } from '@/shared/rate-limit/public-rate-limit'

export async function GET(
  req: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params
    const url = new URL(req.url)
    const phone = url.searchParams.get('phone')
    const serviceId = url.searchParams.get('serviceId')

    if (!phone) {
      return Response.json({ error: 'phone é obrigatório' }, { status: 400 })
    }

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const [ipLimit, phoneLimit] = await Promise.all([
      checkRateLimit({ ip, action: 'anamnese_check', maxPerWindow: 5, windowMs: 15 * 60 * 1000 }),
      checkRateLimit({ phone, action: 'anamnese_check', maxPerWindow: 5, windowMs: 15 * 60 * 1000 }),
    ])
    if (!ipLimit.allowed || !phoneLimit.allowed) {
      return Response.json(
        { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Muitas tentativas. Aguarde 15 minutos.' } },
        { status: 429 },
      )
    }

    const tenant = await publicBookingRepository.findTenantBySlug(slug)

    let validityDays = 90
    if (serviceId) {
      const svc = await prisma.service.findFirst({
        where: { id: serviceId, tenantId: tenant.id, active: true },
        select: { anamneseValidityDays: true },
      })
      if (svc) validityDays = svc.anamneseValidityDays
    }

    const result = await anamneseService.checkExisting(tenant.id, phone, validityDays)

    return Response.json(
      result ?? { anamneseId: null, customerId: null, isValid: false, ageDays: 0, summary: null },
    )
  } catch (error) {
    return handleApiError(error)
  }
}
