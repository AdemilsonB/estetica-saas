import { z } from 'zod'
import { BusinessSegment, PriceType, type Prisma } from '@prisma/client'
import { prisma } from '@/shared/database/prisma'
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { logAdminAction } from '@/shared/audit/admin-audit'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

const patchSchema = z.object({
  slug:              z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  name:              z.string().min(1).optional(),
  description:       z.string().optional(),
  segments:          z.array(z.nativeEnum(BusinessSegment)).min(1).optional(),
  categoryId:        z.string().cuid().nullable().optional(),
  suggestedDuration: z.number().int().min(1).optional(),
  suggestedPrice:    z.number().min(0).optional(),
  priceType:         z.nativeEnum(PriceType).optional(),
  order:             z.number().int().optional(),
  active:            z.boolean().optional(),
  metadata:          z.record(z.string(), z.unknown()).optional(),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  initializeDomainRuntime()
  try {
    const session = await getAdminContext(request)
    const { id } = await params
    const body = await request.json()
    const input = patchSchema.parse(body)

    if (input.slug) {
      const conflict = await prisma.catalogService.findFirst({
        where: { slug: input.slug, NOT: { id } },
      })
      if (conflict) {
        return Response.json({ error: { message: 'Slug já em uso' } }, { status: 409 })
      }
    }

    const { metadata, ...rest } = input
    const service = await prisma.catalogService.update({
      where: { id },
      data: { ...rest, ...(metadata !== undefined ? { metadata: metadata as Prisma.InputJsonValue } : {}) },
      include: { category: true },
    })

    await logAdminAction({
      adminUserId: session.userId,
      action: 'catalog.service_updated',
      targetType: 'CatalogService',
      targetId: id,
      request,
    })

    return Response.json(service)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  initializeDomainRuntime()
  try {
    const session = await getAdminContext(request)
    const { id } = await params
    await prisma.catalogService.update({ where: { id }, data: { active: false } })

    await logAdminAction({
      adminUserId: session.userId,
      action: 'catalog.service_deactivated',
      targetType: 'CatalogService',
      targetId: id,
      request,
    })

    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
