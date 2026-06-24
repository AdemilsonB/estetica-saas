import { z } from 'zod'
import { BusinessSegment } from '@prisma/client'
import { prisma } from '@/shared/database/prisma'
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { logAdminAction } from '@/shared/audit/admin-audit'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

const patchSchema = z.object({
  slug:     z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  name:     z.string().min(1).optional(),
  segments: z.array(z.nativeEnum(BusinessSegment)).min(1).optional(),
  order:    z.number().int().optional(),
  active:   z.boolean().optional(),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  initializeDomainRuntime()
  try {
    const session = await getAdminContext(request)
    const { id } = await params
    const body = await request.json()
    const input = patchSchema.parse(body)

    if (input.slug) {
      const conflict = await prisma.catalogProductCategory.findFirst({
        where: { slug: input.slug, NOT: { id } },
      })
      if (conflict) {
        return Response.json({ error: { message: 'Slug já em uso' } }, { status: 409 })
      }
    }

    const category = await prisma.catalogProductCategory.update({ where: { id }, data: input })

    await logAdminAction({
      adminUserId: session.userId,
      action: 'catalog.product_category_updated',
      targetType: 'CatalogProductCategory',
      targetId: id,
      request,
    })

    return Response.json(category)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  initializeDomainRuntime()
  try {
    const session = await getAdminContext(request)
    const { id } = await params
    await prisma.catalogProductCategory.update({ where: { id }, data: { active: false } })

    await logAdminAction({
      adminUserId: session.userId,
      action: 'catalog.product_category_deactivated',
      targetType: 'CatalogProductCategory',
      targetId: id,
      request,
    })

    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
