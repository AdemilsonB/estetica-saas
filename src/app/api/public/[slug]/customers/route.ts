// src/app/api/public/[slug]/customers/route.ts
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

const CreateCustomerSchema = z.object({
  name: z.string().min(2).max(100),
  cpf: z.string().min(11).max(14),
  phone: z.string().min(10).max(20),
  email: z.string().email().max(100),
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
      action: 'customer_register',
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
    const parsed = CreateCustomerSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.', details: parsed.error.flatten().fieldErrors } },
        { status: 422 },
      )
    }

    const { slug } = await context.params
    const tenant = await publicBookingRepository.findTenantBySlug(slug)

    const cpf = normalizeCpf(parsed.data.cpf)
    const birthDate = new Date(parsed.data.birthDate)

    // Verifica se já existe Customer com mesmo CPF no tenant
    const existing = await prisma.customer.findFirst({
      where: { tenantId: tenant.id, cpf },
      select: { id: true, name: true },
    })

    const customer =
      existing ??
      (await prisma.customer.create({
        data: {
          tenantId: tenant.id,
          name: parsed.data.name,
          cpf,
          phone: parsed.data.phone,
          email: parsed.data.email,
          birthDate,
          consentGiven: true,
          consentDate: new Date(),
          consentOrigin: 'public_booking',
        },
        select: { id: true, name: true },
      }))

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
