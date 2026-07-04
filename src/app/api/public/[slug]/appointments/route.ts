import { Prisma } from '@prisma/client'
import { z } from 'zod'

import { prisma } from '@/shared/database/prisma'
import {
  CustomerBlockedError,
  PublicBookingDisabledError,
  SlotUnavailableError,
  ValidationError,
} from '@/shared/errors/domain-error'
import { handleApiError } from '@/shared/http/handle-api-error'
import { checkRateLimit } from '@/shared/rate-limit/public-rate-limit'
import { customerRepository } from '@/domains/crm/customer.repository'
import { appointmentRepository } from '@/domains/scheduling/appointment.repository'
import { availabilityService } from '@/domains/scheduling/availability.service'
import { publicBookingRepository } from '@/domains/scheduling/public-booking.repository'
import { schedulingPolicyService } from '@/domains/scheduling/scheduling-policy.service'
import { schedulingService } from '@/domains/scheduling/scheduling.service'

const CreatePublicAppointmentSchema = z
  .object({
    // IDs vêm do nosso próprio banco — .min(1) evita falsos positivos do .cuid() com variações de formato
    serviceId: z.string().min(1).optional(),
    packageId: z.string().min(1).optional(),
    promotionId: z.string().min(1).optional(),
    professionalId: z.string().min(1).optional(),
    startsAt: z.string().datetime(),
    customerName: z.string().min(2).max(100),
    customerPhone: z.string().min(10).max(20),
    notes: z.string().max(500).optional(),
    anamneseId: z.string().min(1).optional(),
  })
  .refine((data) => data.serviceId || data.packageId, {
    message: 'serviceId ou packageId é obrigatório',
    path: ['serviceId'],
  })

type RouteContext = { params: Promise<{ slug: string }> }

export async function POST(req: Request, context: RouteContext) {
  try {
    // 1. Extrair IP do header
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

    // 2. Validar input com Zod
    const body = await req.json()
    const parsed = CreatePublicAppointmentSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Dados inválidos.',
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 422 },
      )
    }
    const input = parsed.data

    // 3. Rate limit por IP (5 agendamentos/hora)
    const ipLimit = await checkRateLimit({
      ip,
      action: 'appointment',
      maxPerWindow: 5,
    })
    if (!ipLimit.allowed) {
      return Response.json(
        {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message:
              'Muitas tentativas. Aguarde antes de tentar novamente.',
          },
        },
        { status: 429 },
      )
    }

    // 4. Rate limit por telefone (3 agendamentos/hora — MVP)
    const phoneLimit = await checkRateLimit({
      phone: input.customerPhone,
      action: 'appointment',
      maxPerWindow: 3,
    })
    if (!phoneLimit.allowed) {
      return Response.json(
        {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message:
              'Muitas tentativas com este telefone. Aguarde antes de tentar novamente.',
          },
        },
        { status: 429 },
      )
    }

    // 5. Buscar tenant pelo slug
    const { slug } = await context.params
    const tenant = await publicBookingRepository.findTenantBySlug(slug)

    // 6. Verificar política de agendamento público
    const policy = await schedulingPolicyService.getPolicy(tenant.id)
    if (!policy.allowPublicBooking) {
      throw new PublicBookingDisabledError()
    }

    // 7. Validar antecedência mínima (minAdvanceMinutes)
    const startsAt = new Date(input.startsAt)
    const now = new Date()
    const minAdvanceMs = policy.minAdvanceMinutes * 60 * 1000
    if (startsAt.getTime() < now.getTime() + minAdvanceMs) {
      throw new ValidationError(
        `O agendamento deve ser feito com pelo menos ${policy.minAdvanceMinutes} minuto(s) de antecedência.`,
        { minAdvanceMinutes: policy.minAdvanceMinutes },
      )
    }

    // 8. Validar janela máxima (maxAdvanceDays)
    const maxAdvanceMs = policy.maxAdvanceDays * 24 * 60 * 60 * 1000
    if (startsAt.getTime() > now.getTime() + maxAdvanceMs) {
      throw new ValidationError(
        `O agendamento não pode ser feito com mais de ${policy.maxAdvanceDays} dia(s) de antecedência.`,
        { maxAdvanceDays: policy.maxAdvanceDays },
      )
    }

    // 9. Criar/buscar customer via findOrCreateByPhone
    const customer = await customerRepository.findOrCreateByPhone(
      tenant.id,
      input.customerPhone,
      input.customerName,
    )

    // 10. Verificar se customer está bloqueado — resposta genérica (não revelar motivo)
    if (customer.isBlocked) {
      return Response.json(
        {
          error: 'Não foi possível completar o agendamento. Entre em contato com o salão.',
        },
        { status: 403 },
      )
    }

    // 11. Resolver professionalId: usar o enviado ou buscar primeiro profissional disponível
    let professionalId = input.professionalId
    if (!professionalId) {
      const professionals = await publicBookingRepository.findPublicProfessionals(tenant.id)
      if (professionals.length === 0) {
        throw new ValidationError(
          'Nenhum profissional disponível para agendamento online.',
        )
      }
      professionalId = professionals[0].id
    }

    // 12. Resolver userId: buscar o owner do tenant para satisfazer FK de createdByUserId
    const owner = await prisma.user.findFirst({
      where: { tenantId: tenant.id, role: 'OWNER' },
      select: { id: true },
    })
    if (!owner) {
      throw new ValidationError('Configuração do salão incompleta.')
    }

    // 13. Criar appointment: via service (serviceId) ou direto via repositório (packageId)
    let appointment: { id: string; startsAt: Date }

    if (input.packageId) {
      // Pacote: calcular duração somando serviços do pacote e criar direto no repositório
      const packages = await publicBookingRepository.findPublicPackages(tenant.id)
      const foundPkg = packages.find((p) => p.id === input.packageId)
      if (!foundPkg) {
        return Response.json(
          { error: { code: 'NOT_FOUND', message: 'Pacote não encontrado.' } },
          { status: 404 },
        )
      }

      const startsAtDate = new Date(input.startsAt)
      const endsAt = new Date(startsAtDate.getTime() + foundPkg.duration * 60 * 1000)

      // Check (overlap) + create na mesma transação Serializable — mesma defesa contra
      // double-booking aplicada em schedulingService.createAppointment (issue #138).
      try {
        appointment = await prisma.$transaction(
          async (tx) => {
            await availabilityService.ensureSlotAvailable(
              tenant.id,
              professionalId,
              startsAtDate,
              endsAt,
              tx,
            )

            return appointmentRepository.create(
              tenant.id,
              {
                customerId: customer.id,
                professionalId,
                packageId: input.packageId,
                promotionId: input.promotionId ?? null,
                startsAt: startsAtDate,
                endsAt,
                notes: input.notes,
                price: new Prisma.Decimal(foundPkg.price),
                createdByUserId: owner.id,
              },
              tx,
            )
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        )
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
          throw new SlotUnavailableError()
        }
        throw error
      }

      if (input.anamneseId) {
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: { anamneseId: input.anamneseId },
        })
      }

      // Publica o mesmo evento do serviço avulso: notifica a equipe e dispara
      // a confirmação (WhatsApp/e-mail) ao cliente também para pacotes.
      await schedulingService.emitAppointmentCreated(tenant.id, appointment.id, 'public')
    } else {
      // Serviço avulso: usar scheduling service existente
      appointment = await schedulingService.createAppointment(
        tenant.id,
        owner.id,
        {
          customerId: customer.id,
          professionalId,
          serviceId: input.serviceId!,
          startsAt: input.startsAt,
          notes: input.notes,
          allowOverlap: false,
          allowPastDate: false,
        },
        "public",
      )

      if (input.anamneseId) {
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: { anamneseId: input.anamneseId },
        })
      }
    }

    // 14. Retornar appointmentId e startsAt com status 201
    return Response.json(
      {
        appointmentId: appointment.id,
        startsAt: appointment.startsAt,
      },
      { status: 201 },
    )
  } catch (error) {
    // CustomerBlockedError não deve revelar detalhes ao cliente
    if (error instanceof CustomerBlockedError) {
      return Response.json(
        {
          error: 'Não foi possível completar o agendamento. Entre em contato com o salão.',
        },
        { status: 403 },
      )
    }
    return handleApiError(error)
  }
}
