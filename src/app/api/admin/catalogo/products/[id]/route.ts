import { z } from 'zod'
import { BusinessSegment } from '@prisma/client'
import { prisma } from '@/shared/database/prisma'
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

const patchSchema = z.object({
  slug:           z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  name:           z.string().min(1).optional(),
  description:    z.string().optional(),
  segments:       z.array(z.nativeEnum(BusinessSegment)).min(1).optional(),
  categoryId:     z.string().cuid().nullable().optional(),
  suggestedPrice: z.number().min(0).optional(),
  order:          z.number().int().optional(),
  active:         z.boolean().optional(),
  metadata:       z.record(z.unknown()).optional(),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  initializeDomainRuntime()
  try {
    await getAdminContext(request)
    const { id } = await params
    const body = await request.json()
    const input = patchSchema.parse(body)

    if (input.slug) {
      const conflict = await prisma.catalogProduct.findFirst({
        where: { slug: input.slug, NOT: { id } },
      })
      if (conflict) {
        return Response.json({ error: { message: 'Slug já em uso' } }, { status: 409 })
      }
    }

    const product = await prisma.catalogProduct.update({
      where: { id },
      data: input,
      include: { category: true },
    })
    return Response.json(product)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  initializeDomainRuntime()
  try {
    await getAdminContext(request)
    const { id } = await params
    await prisma.catalogProduct.update({ where: { id }, data: { active: false } })
    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
