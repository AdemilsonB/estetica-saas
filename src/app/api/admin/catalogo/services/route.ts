import { z } from 'zod'
import { BusinessSegment, PriceType, type Prisma } from '@prisma/client'
import { prisma } from '@/shared/database/prisma'
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

const createSchema = z.object({
  slug:              z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug inválido'),
  name:              z.string().min(1),
  description:       z.string().optional(),
  segments:          z.array(z.nativeEnum(BusinessSegment)).min(1),
  categoryId:        z.string().cuid().optional(),
  suggestedDuration: z.number().int().min(1),
  suggestedPrice:    z.number().min(0),
  priceType:         z.nativeEnum(PriceType).default('FIXED'),
  order:             z.number().int().default(0),
  metadata:          z.record(z.string(), z.unknown()).optional(),
})

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    await getAdminContext(request)
    const { searchParams } = new URL(request.url)
    const segments = searchParams.getAll('segments') as BusinessSegment[]
    const categoryId = searchParams.get('categoryId') ?? undefined
    const name = searchParams.get('name') ?? undefined
    const active = searchParams.get('active')
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? 20)))

    const where = {
      ...(active !== null ? { active: active === 'true' } : {}),
      ...(segments.length && { segments: { hasSome: segments } }),
      ...(categoryId && { categoryId }),
      ...(name && { name: { contains: name, mode: 'insensitive' as const } }),
    }

    const [data, total] = await Promise.all([
      prisma.catalogService.findMany({
        where,
        include: { category: true },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.catalogService.count({ where }),
    ])

    return Response.json({ data, total, page, pageSize })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  initializeDomainRuntime()
  try {
    await getAdminContext(request)
    const body = await request.json()
    const input = createSchema.parse(body)

    const existing = await prisma.catalogService.findUnique({ where: { slug: input.slug } })
    if (existing) {
      return Response.json({ error: { message: 'Slug já em uso' } }, { status: 409 })
    }

    const { metadata, ...rest } = input
    const service = await prisma.catalogService.create({
      data: { ...rest, ...(metadata !== undefined ? { metadata: metadata as Prisma.InputJsonValue } : {}) },
      include: { category: true },
    })
    return Response.json(service, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
