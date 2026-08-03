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
        consentGiven: true,
        marketingOptOut: true,
        appointments: {
          where: { tenantId: tenant.id },
          orderBy: { startsAt: 'desc' },
          take: 21,
          select: {
            id: true,
            startsAt: true,
            status: true,
            price: true,
            service: { select: { id: true, name: true } },
            package: { select: { id: true, name: true } },
            professional: { select: { id: true, name: true } },
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
      // Uma chave só para o cliente: ele não precisa entender a diferença entre
      // consentimento de cadastro e opt-out posterior.
      aceitaPromocoes: customer.consentGiven && !customer.marketingOptOut,
      appointments: customer.appointments.map((a) => ({
        id: a.id,
        startsAt: a.startsAt,
        status: a.status,
        price: Number(a.price),
        serviceId: a.service?.id ?? null,
        packageId: a.package?.id ?? null,
        serviceName: a.service?.name ?? a.package?.name ?? null,
        professionalId: a.professional.id,
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
    aceitaPromocoes: z.boolean().optional(),
  })
  // Checagem explícita por `undefined`: com `??`, um `aceitaPromocoes: false` seria
  // falsy e a requisição legítima de DESLIGAR a preferência cairia em 422.
  .refine(
    (d) => d.phone !== undefined || d.email !== undefined || d.aceitaPromocoes !== undefined,
    { message: 'Pelo menos um campo.' },
  )

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

    const { aceitaPromocoes, ...contato } = parsed.data

    // Desligar NÃO zera `consentGiven`: o consentimento de cadastro continua
    // registrado, e o opt-out é o pedido posterior de não receber. Zerar os dois
    // apagaria a trilha de que houve consentimento antes.
    const data = {
      ...contato,
      ...(aceitaPromocoes === undefined
        ? {}
        : aceitaPromocoes
          ? {
              consentGiven: true,
              consentDate: new Date(),
              consentOrigin: 'portal',
              marketingOptOut: false,
              marketingOptOutAt: null,
              marketingOptOutOrigin: null,
            }
          : {
              marketingOptOut: true,
              marketingOptOutAt: new Date(),
              marketingOptOutOrigin: 'portal',
            }),
    }

    const updated = await prisma.customer.update({
      where: { id: session.customerId, tenantId: tenant.id },
      data,
      select: { id: true, name: true, phone: true, email: true },
    })

    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}

