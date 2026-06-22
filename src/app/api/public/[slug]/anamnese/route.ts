import { publicBookingRepository } from '@/domains/scheduling/public-booking.repository'
import { anamneseService } from '@/domains/crm/anamnese.service'
import { submitAnamneseSchema } from '@/domains/crm/anamnese-blocks.types'
import { customerRepository } from '@/domains/crm/customer.repository'
import { handleApiError } from '@/shared/http/handle-api-error'
import { checkRateLimit } from '@/shared/rate-limit/public-rate-limit'

export async function POST(
  req: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const ipLimit = await checkRateLimit({
      ip,
      action: 'anamnese_submit',
      maxPerWindow: 5,
      windowMs: 15 * 60 * 1000,
    })
    if (!ipLimit.allowed) {
      return Response.json(
        { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Muitas tentativas. Aguarde 15 minutos.' } },
        { status: 429 },
      )
    }

    const { slug } = await context.params
    const tenant = await publicBookingRepository.findTenantBySlug(slug)

    const body = await req.json()
    const parsed = submitAnamneseSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        { error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors } },
        { status: 422 },
      )
    }

    const phoneLimit = await checkRateLimit({
      phone: parsed.data.phone,
      action: 'anamnese_submit',
      maxPerWindow: 5,
      windowMs: 15 * 60 * 1000,
    })
    if (!phoneLimit.allowed) {
      return Response.json(
        { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Muitas tentativas. Aguarde 15 minutos.' } },
        { status: 429 },
      )
    }

    const customer = await customerRepository.findOrCreateByPhone(
      tenant.id,
      parsed.data.phone,
      'Cliente',
    )

    const anamnese = await anamneseService.submitFromBooking(tenant.id, customer.id, parsed.data)

    return Response.json({ anamneseId: anamnese.id, customerId: customer.id }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
