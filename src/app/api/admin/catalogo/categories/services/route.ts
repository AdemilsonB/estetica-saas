import { z } from 'zod'
import { BusinessSegment } from '@prisma/client'
import { prisma } from '@/shared/database/prisma'
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { logAdminAction } from '@/shared/audit/admin-audit'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

const createSchema = z.object({
  slug:     z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug inválido'),
  name:     z.string().min(1),
  segments: z.array(z.nativeEnum(BusinessSegment)).min(1),
  order:    z.number().int().default(0),
})

export async function POST(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getAdminContext(request)
    const body = await request.json()
    const input = createSchema.parse(body)

    const existing = await prisma.catalogServiceCategory.findUnique({ where: { slug: input.slug } })
    if (existing) {
      return Response.json({ error: { message: 'Slug já em uso' } }, { status: 409 })
    }

    const category = await prisma.catalogServiceCategory.create({ data: input })

    await logAdminAction({
      adminUserId: session.userId,
      action: 'catalog.service_category_created',
      targetType: 'CatalogServiceCategory',
      targetId: category.id,
      request,
    })

    return Response.json(category, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
