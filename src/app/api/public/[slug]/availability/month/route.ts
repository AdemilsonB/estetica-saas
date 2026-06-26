import { publicBookingRepository } from '@/domains/scheduling/public-booking.repository'
import { availabilityService } from '@/domains/scheduling/availability.service'
import { schedulingPolicyService } from '@/domains/scheduling/scheduling-policy.service'
import { catalogServiceRepository } from '@/domains/scheduling/service.repository'
import { handleApiError } from '@/shared/http/handle-api-error'

// Retorna a disponibilidade de cada dia de um mês (fechado / aberto / com vaga),
// para o calendário público destacar dias clicáveis sem o cliente tentar às cegas.
export async function GET(
  req: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month') // formato YYYY-MM
    const serviceId = searchParams.get('serviceId')
    const professionalId = searchParams.get('professionalId')

    const match = month?.match(/^(\d{4})-(\d{2})$/)
    if (!match || !serviceId) {
      return Response.json(
        { error: 'Parâmetros month (YYYY-MM) e serviceId são obrigatórios.' },
        { status: 400 },
      )
    }
    const year = Number(match[1])
    const monthNumber = Number(match[2])
    if (monthNumber < 1 || monthNumber > 12) {
      return Response.json({ error: 'Mês inválido.' }, { status: 400 })
    }

    const tenant = await publicBookingRepository.findTenantBySlug(slug)
    const policy = await schedulingPolicyService.getPolicy(tenant.id)

    if (!policy.allowPublicBooking) {
      return Response.json({ days: [] })
    }

    const service = await catalogServiceRepository.findById(tenant.id, serviceId)
    if (!service) {
      return Response.json({ error: 'Serviço não encontrado.' }, { status: 404 })
    }

    // Sem profissional informado, usa o primeiro disponível — consistente com a rota de slots
    let resolvedProfessionalId = professionalId
    if (!resolvedProfessionalId) {
      const professionals = await publicBookingRepository.findPublicProfessionals(tenant.id)
      if (professionals.length === 0) {
        return Response.json({ days: [] })
      }
      resolvedProfessionalId = professionals[0].id
    }

    const days = await availabilityService.getMonthAvailability(
      tenant.id,
      resolvedProfessionalId,
      year,
      monthNumber,
      service.duration,
      policy.slotIntervalMinutes,
    )

    return Response.json({ days })
  } catch (error) {
    return handleApiError(error)
  }
}
