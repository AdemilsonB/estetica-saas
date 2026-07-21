import { reviewService } from '@/domains/reviews/review.service'
import { submitReviewSchema } from '@/domains/reviews/schemas'
import { publicBookingRepository } from '@/domains/scheduling/public-booking.repository'
import { verifyPublicSession, COOKIE_NAME } from '@/shared/auth/public-session'
import { handleApiError } from '@/shared/http/handle-api-error'

function getSessionFromRequest(req: Request) {
  const cookieHeader = req.headers.get('cookie') ?? ''
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))
  if (!match?.[1]) return null
  return verifyPublicSession(match[1])
}

const UNAUTHORIZED = { error: { code: 'UNAUTHORIZED', message: 'Sessão inválida.' } }

type RouteContext = { params: Promise<{ slug: string }> }

/** Atendimento pendente de avaliação do cliente logado. */
export async function GET(req: Request, context: RouteContext) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) return Response.json(UNAUTHORIZED, { status: 401 })

    const { slug } = await context.params
    const tenant = await publicBookingRepository.findTenantBySlug(slug)
    if (session.tenantId !== tenant.id) return Response.json(UNAUTHORIZED, { status: 401 })

    const pending = await reviewService.getPendingReview(tenant.id, session.customerId)
    return Response.json({ pending })
  } catch (error) {
    return handleApiError(error)
  }
}

/** Registra a avaliação. Resposta indica se o cliente deve ser levado ao Google. */
export async function POST(req: Request, context: RouteContext) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) return Response.json(UNAUTHORIZED, { status: 401 })

    const { slug } = await context.params
    const tenant = await publicBookingRepository.findTenantBySlug(slug)
    if (session.tenantId !== tenant.id) return Response.json(UNAUTHORIZED, { status: 401 })

    const parsed = submitReviewSchema.safeParse(await req.json())
    if (!parsed.success) {
      return Response.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.' } },
        { status: 422 },
      )
    }

    const result = await reviewService.submitReview(tenant.id, session.customerId, parsed.data)
    return Response.json(result, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
