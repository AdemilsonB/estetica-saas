import { prisma } from '@/shared/database/prisma'
import { NotFoundError } from '@/shared/errors/domain-error'

export class PublicBookingRepository {
  async findTenantBySlug(slug: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        phone: true,
        address: true,
        timezone: true,
        businessHours: true,
        evolutionConnected: true,
        brandingConfig: {
          select: {
            logoUrl: true,
            primaryColor: true,
            secondaryColor: true,
            accentColor: true,
            backgroundColor: true,
            foregroundColor: true,
            borderRadius: true,
            fontFamily: true,
          },
        },
        schedulingPolicy: true,
      },
    })
    if (!tenant) throw new NotFoundError('Salão')
    return tenant
  }

  async findPublicServices(tenantId: string) {
    const services = await prisma.service.findMany({
      where: { tenantId, active: true },
      select: {
        id: true,
        name: true,
        duration: true,
        price: true,
        priceType: true,
        priceMin: true,
        priceMax: true,
        imageUrl: true,
        description: true,
        categoryId: true,
        category: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    })
    return services.map(({ category, ...rest }) => ({
      ...rest,
      categoryName: category?.name ?? null,
    }))
  }

  async findPublicProfessionals(tenantId: string) {
    const professionals = await prisma.user.findMany({
      where: { tenantId, role: { in: ['PROFESSIONAL', 'OWNER', 'MANAGER'] } },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        professionalServices: { select: { serviceId: true } },
      },
      orderBy: { name: 'asc' },
    })
    return professionals.map((prof) => ({
      id: prof.id,
      name: prof.name,
      avatarUrl: prof.avatarUrl,
      serviceIds: prof.professionalServices.map((ps) => ps.serviceId),
    }))
  }
}

export const publicBookingRepository = new PublicBookingRepository()
