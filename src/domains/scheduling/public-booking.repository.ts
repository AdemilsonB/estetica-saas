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
            bannerUrl: true,
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
        anamneseMode: true,
        anamneseBlocks: true,
        anamneseValidityDays: true,
        category: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    })
    return services.map(({ category, ...rest }) => ({
      ...rest,
      anamneseBlocks: rest.anamneseBlocks as string[],
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

  async findPublicPackages(tenantId: string) {
    const packages = await prisma.servicePackage.findMany({
      where: { tenantId, active: true },
      include: {
        items: {
          include: {
            service: { select: { id: true, name: true, duration: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    })
    return packages.map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      description: pkg.description,
      imageUrl: pkg.imageUrl,
      price: Number(pkg.price),
      duration: pkg.items.reduce((sum, item) => sum + item.service.duration, 0),
      services: pkg.items.map((item) => ({
        id: item.service.id,
        name: item.service.name,
        duration: item.service.duration,
      })),
    }))
  }

  async findPublicPromotions(tenantId: string) {
    const now = new Date()
    const promotions = await prisma.promotion.findMany({
      where: {
        tenantId,
        active: true,
        OR: [
          { startsAt: null, endsAt: null },
          { startsAt: { lte: now }, endsAt: { gte: now } },
          { startsAt: { lte: now }, endsAt: null },
          { startsAt: null, endsAt: { gte: now } },
        ],
      },
      include: {
        items: {
          include: {
            service: { select: { id: true, name: true, duration: true, price: true } },
            package: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    })
    return promotions.map((promo) => ({
      id: promo.id,
      name: promo.name,
      description: promo.description,
      imageUrl: promo.imageUrl,
      discountType: promo.discountType,
      discountValue: Number(promo.discountValue),
      services: promo.items.flatMap((i) =>
        i.service
          ? [
              {
                id: i.service.id,
                name: i.service.name,
                duration: i.service.duration,
                originalPrice: Number(i.service.price),
              },
            ]
          : [],
      ),
    }))
  }
}

export const publicBookingRepository = new PublicBookingRepository()
