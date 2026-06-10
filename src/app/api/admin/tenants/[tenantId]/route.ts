import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { NotFoundError } from '@/shared/errors'
import { adminRepository } from '@/domains/admin/admin.repository'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  initializeDomainRuntime()
  try {
    await getAdminContext(request)
    const { tenantId } = await params
    const tenant = await adminRepository.findTenantDetail(tenantId)
    if (!tenant) throw new NotFoundError('Tenant')
    return Response.json(tenant)
  } catch (error) {
    return handleApiError(error)
  }
}
