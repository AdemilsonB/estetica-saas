import { customerService } from '@/domains/crm/customer.service'
import { toggleFavoriteSchema } from '@/domains/crm/types'
import { publicBookingRepository } from '@/domains/scheduling/public-booking.repository'
import { verifyPublicSession, COOKIE_NAME } from '@/shared/auth/public-session'
import { handleApiError } from '@/shared/http/handle-api-error'

function getSessionFromRequest(req: Request) {
  const cookieHeader = req.headers.get('cookie') ?? ''
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))
  if (!match?.[1]) return null
  return verifyPublicSession(match[1])
}

type RouteContext = { params: Promise<{ slug: string }> }

export async function GET(req: Request, context: RouteContext) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) {
      return Response.json({ error: { code: 'UNAUTHORIZED', message: 'Sessão inválida.' } }, { status: 401 })
    }

    const { slug } = await context.params
    const tenant = await publicBookingRepository.findTenantBySlug(slug)
    if (session.tenantId !== tenant.id) {
      return Response.json({ error: { code: 'UNAUTHORIZED', message: 'Sessão inválida.' } }, { status: 401 })
    }

    const favorites = await customerService.getFavorites(tenant.id, session.customerId)
    return Response.json(favorites)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: Request, context: RouteContext) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) {
      return Response.json({ error: { code: 'UNAUTHORIZED', message: 'Sessão inválida.' } }, { status: 401 })
    }

    const { slug } = await context.params
    const tenant = await publicBookingRepository.findTenantBySlug(slug)
    if (session.tenantId !== tenant.id) {
      return Response.json({ error: { code: 'UNAUTHORIZED', message: 'Sessão inválida.' } }, { status: 401 })
    }

    const body = await req.json()
    const parsed = toggleFavoriteSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.' } }, { status: 422 })
    }

    const result = await customerService.toggleFavorite(
      tenant.id,
      session.customerId,
      parsed.data.kind,
      parsed.data.itemId,
    )
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
