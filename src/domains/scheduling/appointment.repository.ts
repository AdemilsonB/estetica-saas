import { AppointmentStatus, type Appointment, type Prisma } from "@prisma/client";

import { startOfMonth, endOfDay } from "@/lib/dates";
import { prisma } from "@/shared/database/prisma";

export type AppointmentFilters = {
  from?: Date;
  to?: Date;
  status?: AppointmentStatus;
  professionalId?: string;
};

export class AppointmentRepository {
  async findAll(tenantId: string, filters: AppointmentFilters = {}) {
    const { from, to, status, professionalId } = filters;
    return prisma.appointment.findMany({
      where: {
        tenantId,
        ...(status && { status }),
        ...(professionalId && { professionalId }),
        ...(from || to
          ? {
              startsAt: {
                ...(from && { gte: from }),
                ...(to && { lte: to }),
              },
            }
          : {}),
      },
      include: {
        customer: { select: { id: true, name: true, phone: true, notes: true } },
        professional: { select: { id: true, name: true } },
        service: { select: { id: true, name: true, duration: true } },
      },
      orderBy: { startsAt: "asc" },
    });
  }

  async findById(tenantId: string, appointmentId: string) {
    return prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId },
      include: {
        customer: true,
        professional: true,
        service: true,
      },
    });
  }

  async findOverlappingForProfessional(
    tenantId: string,
    professionalId: string,
    startsAt: Date,
    endsAt: Date,
    excludeId?: string,
  ) {
    return prisma.appointment.findFirst({
      where: {
        tenantId,
        professionalId,
        ...(excludeId && { id: { not: excludeId } }),
        status: {
          in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED],
        },
        startsAt: {
          lt: endsAt,
        },
        endsAt: {
          gt: startsAt,
        },
      },
    });
  }

  async create(
    tenantId: string,
    data: Omit<Prisma.AppointmentUncheckedCreateInput, "tenantId">,
  ): Promise<Appointment> {
    return prisma.appointment.create({
      data: {
        ...data,
        tenantId,
      },
    });
  }

  async countThisMonth(tenantId: string): Promise<number> {
    return prisma.appointment.count({
      where: {
        tenantId,
        startsAt: { gte: startOfMonth(new Date()), lte: endOfDay(new Date()) },
      },
    });
  }

  async updateStatus(
    tenantId: string,
    appointmentId: string,
    status: AppointmentStatus,
    confirmedPrice?: number,
  ) {
    await prisma.appointment.updateMany({
      where: { id: appointmentId, tenantId },
      data: {
        status,
        ...(confirmedPrice !== undefined ? { confirmedPrice } : {}),
      },
    });

    return prisma.appointment.findFirstOrThrow({
      where: { id: appointmentId, tenantId },
    });
  }

  async update(
    tenantId: string,
    id: string,
    data: {
      startsAt?: Date;
      endsAt?: Date;
      professionalId?: string;
      serviceId?: string;
    },
  ) {
    await prisma.appointment.updateMany({
      where: { id, tenantId },
      data,
    });
    return prisma.appointment.findFirstOrThrow({
      where: { id, tenantId },
      include: {
        customer: true,
        professional: true,
        service: true,
      },
    });
  }
}

export const appointmentRepository = new AppointmentRepository();
