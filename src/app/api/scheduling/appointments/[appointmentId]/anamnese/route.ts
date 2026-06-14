import { getSessionContext } from '@/shared/auth/session'
import { ensurePermission, PERMISSIONS } from '@/shared/auth/permissions'
import { handleApiError } from '@/shared/http/handle-api-error'
import { anamneseService } from '@/domains/crm/anamnese.service'
import { calcularSugestaoPreco } from '@/domains/crm/price-suggestion'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import type { AnamneseBlocks } from '@/domains/crm/anamnese-blocks.types'

type RouteContext = {
  params: Promise<{ appointmentId: string }>
}

export async function GET(req: Request, context: RouteContext) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(req)
    ensurePermission(session, PERMISSIONS.appointments.view)
    const { appointmentId } = await context.params

    const result = await anamneseService.getByAppointment(session.tenantId, appointmentId)
    if (!result) return Response.json(null)

    const blocks = result.anamnese.blocks as AnamneseBlocks
    const sugestao = calcularSugestaoPreco(result.appointmentPrice, blocks)

    return Response.json({ anamnese: result.anamnese, sugestaoPreco: sugestao })
  } catch (error) {
    return handleApiError(error)
  }
}
