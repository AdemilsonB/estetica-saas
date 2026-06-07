import { iamService } from '@/domains/iam/iam.service'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { ensurePermission, PERMISSIONS } from '@/shared/auth/permissions'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.users.view)

    const { searchParams } = new URL(request.url)
    const serviceId = searchParams.get('serviceId')

    if (!serviceId) {
      const users = await iamService.listUsers(session.tenantId)
      return Response.json(users)
    }

    // Filtro por serviço — retorna { professionals, filtered }
    const linked = await iamService.listProfessionalsByService(session.tenantId, serviceId)

    if (linked.length > 0) {
      return Response.json({ professionals: linked, filtered: true })
    }

    // Fallback: nenhum profissional vinculado — retorna todos
    const all = await iamService.listUsers(session.tenantId)
    const eligible = all.filter((u) =>
      ['OWNER', 'MANAGER', 'PROFESSIONAL'].includes(u.role),
    )
    return Response.json({ professionals: eligible, filtered: false })
  } catch (error) {
    return handleApiError(error)
  }
}
