import { publicBookingRepository } from '@/domains/scheduling/public-booking.repository'
import { availabilityService } from '@/domains/scheduling/availability.service'
import { schedulingPolicyService } from '@/domains/scheduling/scheduling-policy.service'
import { catalogServiceRepository } from '@/domains/scheduling/service.repository'
import { packageRepository } from '@/domains/scheduling/package.repository'
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
    const packageId = searchParams.get('packageId')
    const professionalId = searchParams.get('professionalId')

    if (!date || (!serviceId && !packageId)) {
      return Response.json(
        { error: 'Parâmetros date e serviceId (ou packageId) são obrigatórios.' },
        { status: 400 },
      )
    }

    const tenant = await publicBookingRepository.findTenantBySlug(slug)
    const policy = await schedulingPolicyService.getPolicy(tenant.id)

    if (!tenant.publicPageEnabled || !policy.allowPublicBooking) {
      return Response.json({ slots: [] })
    }

    let duration: number
    if (serviceId) {
      const service = await catalogServiceRepository.findById(tenant.id, serviceId)
      if (!service) {
        return Response.json({ error: 'Serviço não encontrado.' }, { status: 404 })
      }
      duration = service.duration
    } else {
      const pkg = await packageRepository.findById(tenant.id, packageId!)
      if (!pkg) {
        return Response.json({ error: 'Pacote não encontrado.' }, { status: 404 })
      }
      duration = pkg.items.reduce((sum, item) => sum + item.service.duration, 0)
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

    const allSlots = await availabilityService.getAvailableSlots(
      tenant.id,
      resolvedProfessionalId,
      date,
      duration,
      policy.slotIntervalMinutes,
      policy.minAdvanceMinutes,
      policy.maxAdvanceDays,
    )

    // Retorna todos os slots com status. Nunca expõe bookedBy (privacidade).
    const publicSlots = allSlots.map((slot) => ({
      time: slot.time,
      available: slot.available,
    }))

    return Response.json({ slots: publicSlots })
  } catch (error) {
    return handleApiError(error)
  }
}
