import { serviceCategoryRepository } from '@/domains/scheduling/service-category.repository'
import { createServiceCategorySchema } from '@/domains/scheduling/types'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { ensurePermission, PERMISSIONS } from '@/shared/auth/permissions'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { created } from '@/shared/http/responses'
import { validateInput } from '@/shared/http/validate-input'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.services.view)
    const categories = await serviceCategoryRepository.list(session.tenantId)
    return Response.json(categories)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.services.manage)
    const input = await validateInput(request, createServiceCategorySchema)
    const category = await serviceCategoryRepository.create(session.tenantId, input)
    return created(category)
  } catch (error) {
    return handleApiError(error)
  }
}
