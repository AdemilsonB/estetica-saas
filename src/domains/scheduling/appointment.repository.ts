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
        customer: true,
        professional: true,
        service: true,
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
  ) {
    return prisma.appointment.findFirst({
      where: {
        tenantId,
        professionalId,
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
  ) {
    await prisma.appointment.updateMany({
      where: { id: appointmentId, tenantId },
      data: { status },
    });

    return prisma.appointment.findFirstOrThrow({
      where: { id: appointmentId, tenantId },
    });
  }
}

export const appointmentRepository = new AppointmentRepository();
