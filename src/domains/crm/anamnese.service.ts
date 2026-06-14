import { customerAnamneseRepository } from './customer-anamnese.repository'
import { customerRepository } from './customer.repository'
import { anamneseBlocksSchema, submitAnamneseSchema } from './anamnese-blocks.types'
import type { AnamneseBlocks, SubmitAnamneseInput } from './anamnese-blocks.types'
import { ValidationError, NotFoundError } from '@/shared/errors/domain-error'

const VALIDITY_DAYS_DEFAULT = 90

export class AnamneseService {
  async checkExisting(tenantId: string, phone: string, validityDays = VALIDITY_DAYS_DEFAULT) {
    const customer = await customerRepository.findByPhone(tenantId, phone)
    if (!customer) return null

    const anamnese = await customerAnamneseRepository.findByCustomer(tenantId, customer.id)
    if (!anamnese) return null

    const ageDays = Math.floor(
      (Date.now() - anamnese.updatedAt.getTime()) / (1000 * 60 * 60 * 24),
    )
    const blocks = anamnese.blocks as AnamneseBlocks
    const capilar = blocks.capilar

    return {
      anamneseId: anamnese.id,
      customerId: customer.id,
      isValid: ageDays <= validityDays,
      ageDays,
      summary: {
        comprimento: capilar?.comprimento,
        tipoFio: capilar?.tipoFio,
        objetivos: capilar?.objetivos,
        temQuimicaRecente:
          [capilar?.coloracao, capilar?.descoloracao, capilar?.progressiva, capilar?.botox]
            .some((c) => c?.feito && c.quando === 'menos_30_dias') ?? false,
      },
    }
  }

  async submitFromBooking(tenantId: string, customerId: string, input: SubmitAnamneseInput) {
    const parsed = submitAnamneseSchema.safeParse(input)
    if (!parsed.success) {
      throw new ValidationError('Dados da anamnese inválidos.', parsed.error.flatten().fieldErrors)
    }
    return customerAnamneseRepository.upsert(tenantId, customerId, parsed.data.blockType, parsed.data.data)
  }

  async saveByProfessional(tenantId: string, customerId: string, blockType: string, data: unknown) {
    const customer = await customerRepository.findById(tenantId, customerId)
    if (!customer) throw new NotFoundError('Cliente')

    const parsed = anamneseBlocksSchema.safeParse({ [blockType]: data })
    if (!parsed.success) {
      throw new ValidationError('Dados da anamnese inválidos.', parsed.error.flatten().fieldErrors)
    }

    const blockData = parsed.data[blockType as keyof typeof parsed.data]
    return customerAnamneseRepository.upsert(tenantId, customerId, blockType, blockData)
  }

  async getByCustomer(tenantId: string, customerId: string) {
    return customerAnamneseRepository.findByCustomer(tenantId, customerId)
  }

  async getByAppointment(tenantId: string, appointmentId: string) {
    const { prisma } = await import('@/shared/database/prisma')
    const apt = await prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId },
      select: { anamneseId: true, price: true },
    })
    if (!apt?.anamneseId) return null

    const anamnese = await customerAnamneseRepository.findByTenantAndId(tenantId, apt.anamneseId)
    return anamnese ? { anamnese, appointmentPrice: Number(apt.price) } : null
  }
}

export const anamneseService = new AnamneseService()
