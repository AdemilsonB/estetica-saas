import { AppointmentStatus } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";

export class ReviewRepository {
  create(data: {
    tenantId: string;
    appointmentId: string;
    customerId: string;
    rating: number;
    comment: string | null;
    routedToGoogle: boolean;
  }) {
    return prisma.appointmentReview.create({ data });
  }

  findByAppointment(tenantId: string, appointmentId: string) {
    return prisma.appointmentReview.findFirst({ where: { tenantId, appointmentId } });
  }

  /** Dados mínimos do atendimento para checar elegibilidade (mesmo tenant). */
  findAppointmentForReview(tenantId: string, appointmentId: string) {
    return prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId },
      select: { id: true, customerId: true, status: true },
    });
  }

  /** Atendimento concluído mais recente do cliente ainda sem avaliação. */
  findLatestReviewableAppointment(tenantId: string, customerId: string) {
    return prisma.appointment.findFirst({
      where: {
        tenantId,
        customerId,
        status: AppointmentStatus.COMPLETED,
        review: { is: null },
      },
      orderBy: { startsAt: "desc" },
      select: {
        id: true,
        startsAt: true,
        service: { select: { name: true } },
        professional: { select: { name: true } },
      },
    });
  }

  async getStats(tenantId: string) {
    const [agg, byRating, routedCount] = await Promise.all([
      prisma.appointmentReview.aggregate({
        where: { tenantId },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      prisma.appointmentReview.groupBy({
        by: ["rating"],
        where: { tenantId },
        _count: { _all: true },
      }),
      prisma.appointmentReview.count({ where: { tenantId, routedToGoogle: true } }),
    ]);
    return { agg, byRating, routedCount };
  }

  listWithComments(tenantId: string, take: number) {
    return prisma.appointmentReview.findMany({
      where: { tenantId, comment: { not: null } },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        rating: true,
        comment: true,
        routedToGoogle: true,
        createdAt: true,
        customer: { select: { name: true } },
        appointment: { select: { startsAt: true, service: { select: { name: true } } } },
      },
    });
  }
}

export const reviewRepository = new ReviewRepository();
