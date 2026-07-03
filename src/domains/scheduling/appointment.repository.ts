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
        package: { select: { id: true, name: true } },
        promotion: { select: { id: true, name: true } },
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
        package: true,
        promotion: true,
      },
    });
  }

  async findOverlappingForProfessional(
    tenantId: string,
    professionalId: string,
    startsAt: Date,
    endsAt: Date,
    excludeId?: string,
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    return client.appointment.findFirst({
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
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ): Promise<Appointment> {
    return client.appointment.create({
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

  async countByDateRange(
    tenantId: string,
    from: Date,
    to: Date,
  ): Promise<Record<string, number>> {
    const appointments = await prisma.appointment.findMany({
      where: {
        tenantId,
        status: {
          notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
        },
        startsAt: { gte: from, lte: to },
      },
      select: { startsAt: true },
    });

    const counts: Record<string, number> = {};
    for (const appt of appointments) {
      const key = appt.startsAt.toLocaleDateString("en-CA", {
        timeZone: "America/Sao_Paulo",
      });
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
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
        package: true,
        promotion: true,
      },
    });
  }
}

export const appointmentRepository = new AppointmentRepository();
