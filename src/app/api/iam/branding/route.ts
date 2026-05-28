import { revalidateTag } from 'next/cache'

import { brandingService } from '@/domains/iam/branding.service'
import { UpdateBrandingSchema } from '@/domains/iam/branding.schemas'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { deriveSecondary, deriveAccent } from '@/lib/branding/build-css-variables'

export async function GET(req: Request) {
  try {
    const session = await getSessionContext(req)
    const config = await brandingService.get(session.tenantId)
    return Response.json(config)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getSessionContext(req)
    const input = await validateInput(req, UpdateBrandingSchema)

    const fullInput = {
      ...input,
      ...(input.primaryColor
        ? {
            secondaryColor: deriveSecondary(input.primaryColor),
            accentColor: deriveAccent(input.primaryColor),
          }
        : {}),
    }

    const updated = await brandingService.update(session.tenantId, fullInput)
    revalidateTag(`branding-${session.tenantId}`, 'default')
    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
