// src/app/api/public/[slug]/auth/route.ts
import { z } from 'zod'
import { prisma } from '@/shared/database/prisma'
import { publicBookingRepository } from '@/domains/scheduling/public-booking.repository'
import { checkRateLimit } from '@/shared/rate-limit/public-rate-limit'
import {
  createPublicSession,
  COOKIE_NAME,
  MAX_AGE_SECONDS,
} from '@/shared/auth/public-session'
import { handleApiError } from '@/shared/http/handle-api-error'

const AuthSchema = z.object({
  cpf: z.string().min(11).max(14),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, '')
}

type RouteContext = { params: Promise<{ slug: string }> }

export async function POST(req: Request, context: RouteContext) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const limit = await checkRateLimit({
      ip,
      action: 'customer_auth',
      maxPerWindow: 5,
      windowMs: 15 * 60 * 1000,
    })
    if (!limit.allowed) {
      return Response.json(
        { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Muitas tentativas. Aguarde 15 minutos.' } },
        { status: 429 },
      )
    }

    const body = await req.json()
    const parsed = AuthSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.' } }, { status: 422 })
    }

    const { slug } = await context.params
    const tenant = await publicBookingRepository.findTenantBySlug(slug)

    const cpf = normalizeCpf(parsed.data.cpf)
    const birthDate = new Date(parsed.data.birthDate)

    const customer = await prisma.customer.findFirst({
      where: {
        tenantId: tenant.id,
        cpf,
        birthDate: {
          gte: new Date(birthDate.getFullYear(), birthDate.getMonth(), birthDate.getDate()),
          lt: new Date(birthDate.getFullYear(), birthDate.getMonth(), birthDate.getDate() + 1),
        },
      },
      select: { id: true, name: true },
    })

    // Resposta genérica — não revela qual campo falhou
    if (!customer) {
      return Response.json(
        { error: { code: 'AUTH_FAILED', message: 'Dados não encontrados.' } },
        { status: 401 },
      )
    }

    const token = createPublicSession(customer.id, tenant.id, slug)
    return new Response(JSON.stringify({ id: customer.id, name: customer.name }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${MAX_AGE_SECONDS}`,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
