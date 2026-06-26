import { z } from 'zod'
import { publicBookingRepository } from '@/domains/scheduling/public-booking.repository'
import { checkRateLimit } from '@/shared/rate-limit/public-rate-limit'
import { handleApiError } from '@/shared/http/handle-api-error'

const QuerySchema = z.object({
  phone: z.string().min(10).max(15),
})

export async function GET(
  req: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params
    const { searchParams } = new URL(req.url)
    const parsed = QuerySchema.safeParse({ phone: searchParams.get('phone') })
    if (!parsed.success) {
      return Response.json({ error: 'Telefone inválido.' }, { status: 400 })
    }

    // Endurecimento contra enumeração/exposição de histórico por telefone (fator único):
    // - limite por IP por hora reduz varredura de números a partir de uma origem;
    // - limite por telefone (normalizado) protege uma vítima específica de consultas
    //   distribuídas a partir de IPs diferentes.
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const phoneKey = parsed.data.phone.replace(/\D/g, '')

    const ipLimit = await checkRateLimit({
      ip,
      action: 'public-history',
      maxPerWindow: 10,
      windowMs: 60 * 60 * 1000,
    })
    if (!ipLimit.allowed) {
      return Response.json({ error: 'Muitas tentativas. Aguarde um momento.' }, { status: 429 })
    }

    const phoneLimit = await checkRateLimit({
      phone: phoneKey,
      action: 'public-history-phone',
      maxPerWindow: 5,
      windowMs: 60 * 60 * 1000,
    })
    if (!phoneLimit.allowed) {
      return Response.json({ error: 'Muitas tentativas. Aguarde um momento.' }, { status: 429 })
    }

    const tenant = await publicBookingRepository.findTenantBySlug(slug)
    const history = await publicBookingRepository.findPublicHistory(tenant.id, parsed.data.phone)

    return Response.json(history)
  } catch (error) {
    return handleApiError(error)
  }
}
