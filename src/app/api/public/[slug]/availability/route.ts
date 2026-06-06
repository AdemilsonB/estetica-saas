import { publicBookingRepository } from '@/domains/scheduling/public-booking.repository'
import { availabilityService } from '@/domains/scheduling/availability.service'
import { schedulingPolicyService } from '@/domains/scheduling/scheduling-policy.service'
import { catalogServiceRepository } from '@/domains/scheduling/service.repository'
import { handleApiError } from '@/shared/http/handle-api-error'

export async function GET(
  req: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    const serviceId = searchParams.get('serviceId')
    const professionalId = searchParams.get('professionalId')

    if (!date || !serviceId) {
      return Response.json(
        { error: 'Parâmetros date e serviceId são obrigatórios.' },
        { status: 400 },
      )
    }

    const tenant = await publicBookingRepository.findTenantBySlug(slug)
    const policy = await schedulingPolicyService.getPolicy(tenant.id)

    if (!policy.allowPublicBooking) {
      return Response.json({ slots: [] })
    }

    const service = await catalogServiceRepository.findById(tenant.id, serviceId)
    if (!service) {
      return Response.json({ error: 'Serviço não encontrado.' }, { status: 404 })
    }

    // Se professionalId não foi informado, busca o primeiro profissional disponível do tenant
    let resolvedProfessionalId = professionalId
    if (!resolvedProfessionalId) {
      const professionals = await publicBookingRepository.findPublicProfessionals(tenant.id)
      if (professionals.length === 0) {
        return Response.json({ slots: [] })
      }
      resolvedProfessionalId = professionals[0].id
    }

    // getAvailableSlots retorna TimeSlot[] com { time, available, bookedBy? }
    // Para o booking público, retornamos apenas os slots disponíveis
    const allSlots = await availabilityService.getAvailableSlots(
      tenant.id,
      resolvedProfessionalId,
      date,
      service.duration,
    )

    const availableSlots = allSlots
      .filter((slot) => slot.available)
      .map((slot) => slot.time)

    return Response.json({ slots: availableSlots })
  } catch (error) {
    return handleApiError(error)
  }
}
