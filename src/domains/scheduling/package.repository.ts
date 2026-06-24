import { Prisma } from '@prisma/client'
import { prisma } from '@/shared/database/prisma'

const SERVICE_SELECT = { select: { id: true, name: true, duration: true, price: true } }

const INCLUDE = {
  items: { include: { service: SERVICE_SELECT } },
}

type CreatePackageData = {
  name: string
  description?: string
  price: number
  serviceIds: string[]
  imageUrl?: string
}

type UpdatePackageData = {
  name?: string
  description?: string
  price?: number
  serviceIds?: string[]
  imageUrl?: string | null
  imageCropX?: number | null
  imageCropY?: number | null
  imageCropZoom?: number | null
}

export class PackageRepository {
  async list(tenantId: string) {
    return prisma.servicePackage.findMany({
      where: { tenantId, active: true },
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
  }

  async findById(tenantId: string, packageId: string) {
    return prisma.servicePackage.findFirst({
      where: { id: packageId, tenantId },
      include: INCLUDE,
    })
  }

  async create(tenantId: string, data: CreatePackageData) {
    return prisma.servicePackage.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description,
        price: new Prisma.Decimal(data.price),
        imageUrl: data.imageUrl,
        items: { create: data.serviceIds.map((serviceId) => ({ serviceId })) },
      },
      include: INCLUDE,
    })
  }

  async update(tenantId: string, packageId: string, data: UpdatePackageData) {
    return prisma.$transaction(async (tx) => {
      if (data.serviceIds) {
        await tx.servicePackageItem.deleteMany({ where: { packageId } })
        await tx.servicePackageItem.createMany({
          data: data.serviceIds.map((serviceId) => ({ packageId, serviceId })),
        })
      }
      return tx.servicePackage.update({
        where: { id: packageId, tenantId },
        data: {
          name: data.name,
          description: data.description,
          price: data.price !== undefined ? new Prisma.Decimal(data.price) : undefined,
          imageUrl: data.imageUrl,
          imageCropX: data.imageCropX,
          imageCropY: data.imageCropY,
          imageCropZoom: data.imageCropZoom,
        },
        include: INCLUDE,
      })
    })
  }

  async deactivate(tenantId: string, packageId: string) {
    return prisma.servicePackage.update({
      where: { id: packageId, tenantId },
      data: { active: false },
    })
  }
}

export const packageRepository = new PackageRepository()
