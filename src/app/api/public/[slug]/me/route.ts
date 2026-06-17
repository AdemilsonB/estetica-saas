// src/app/api/public/[slug]/me/route.ts
import { z } from 'zod'
import { prisma } from '@/shared/database/prisma'
import { publicBookingRepository } from '@/domains/scheduling/public-booking.repository'
import {
  verifyPublicSession,
  COOKIE_NAME,
} from '@/shared/auth/public-session'
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

    const customer = await prisma.customer.findFirst({
      where: { id: session.customerId, tenantId: tenant.id },
      select: {
        id: true,
        name: true,
        cpf: true,
        phone: true,
        email: true,
        birthDate: true,
        appointments: {
          where: { tenantId: tenant.id },
          orderBy: { startsAt: 'desc' },
          take: 21,
          select: {
            id: true,
            startsAt: true,
            status: true,
            price: true,
            service: { select: { name: true } },
            package: { select: { name: true } },
            professional: { select: { name: true } },
          },
        },
      },
    })

    if (!customer) {
      return Response.json({ error: { code: 'NOT_FOUND', message: 'Cliente não encontrado.' } }, { status: 404 })
    }

    return Response.json({
      id: customer.id,
      name: customer.name,
      cpf: customer.cpf,
      phone: customer.phone,
      email: customer.email,
      birthDate: customer.birthDate,
      appointments: customer.appointments.map((a) => ({
        id: a.id,
        startsAt: a.startsAt,
        status: a.status,
        price: Number(a.price),
        serviceName: a.service?.name ?? a.package?.name ?? null,
        professionalName: a.professional.name,
      })),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

const UpdateMeSchema = z
  .object({
    phone: z.string().min(10).max(20).optional(),
    email: z.string().email().max(100).optional(),
  })
  .refine((d) => d.phone ?? d.email, { message: 'Pelo menos um campo.' })

export async function PATCH(req: Request, context: RouteContext) {
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
    const parsed = UpdateMeSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.' } }, { status: 422 })
    }

    const updated = await prisma.customer.update({
      where: { id: session.customerId },
      data: parsed.data,
      select: { id: true, name: true, phone: true, email: true },
    })

    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}

