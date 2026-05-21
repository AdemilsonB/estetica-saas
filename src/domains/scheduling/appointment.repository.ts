import { AppointmentStatus, type Appointment, type Prisma } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";

export class AppointmentRepository {
  async findAll(tenantId: string) {
    return prisma.appointment.findMany({
      where: { tenantId },
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
    data: Prisma.AppointmentUncheckedCreateInput,
  ): Promise<Appointment> {
    return prisma.appointment.create({
      data: {
        ...data,
        tenantId,
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
