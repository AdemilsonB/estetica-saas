import { AppointmentStatus } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";
import { ReviewAlreadyExistsError, ReviewNotEligibleError } from "@/shared/errors";
import { buildGoogleReviewUrl } from "@/lib/google-places";

import { reviewRepository } from "./review.repository";
import { HIGH_RATING_THRESHOLD, type SubmitReviewInput } from "./schemas";

export type PendingReview = {
  appointmentId: string;
  serviceName: string | null;
  professionalName: string;
  startsAt: Date;
};

export type SubmitReviewResult = {
  rating: number;
  routedToGoogle: boolean;
  /** Link do Google só quando a nota é alta E o tenant tem Place ID configurado. */
  googleReviewUrl: string | null;
};

export type RatingDistribution = Record<1 | 2 | 3 | 4 | 5, number>;

export type ReviewSummary = {
  total: number;
  average: number;
  distribution: RatingDistribution;
  routedToGoogle: number;
  feedback: Array<{
    id: string;
    rating: number;
    comment: string | null;
    routedToGoogle: boolean;
    createdAt: Date;
    customerName: string;
    serviceName: string | null;
  }>;
};

export class ReviewService {
  private readonly repo = reviewRepository;

  /** O atendimento que o cliente pode avaliar agora (ou null). */
  async getPendingReview(tenantId: string, customerId: string): Promise<PendingReview | null> {
    const appt = await this.repo.findLatestReviewableAppointment(tenantId, customerId);
    if (!appt) return null;
    return {
      appointmentId: appt.id,
      serviceName: appt.service?.name ?? null,
      professionalName: appt.professional.name,
      startsAt: appt.startsAt,
    };
  }

  async submitReview(
    tenantId: string,
    customerId: string,
    input: SubmitReviewInput,
  ): Promise<SubmitReviewResult> {
    const appt = await this.repo.findAppointmentForReview(tenantId, input.appointmentId);
    if (
      !appt ||
      appt.customerId !== customerId ||
      appt.status !== AppointmentStatus.COMPLETED
    ) {
      throw new ReviewNotEligibleError();
    }

    const existing = await this.repo.findByAppointment(tenantId, input.appointmentId);
    if (existing) throw new ReviewAlreadyExistsError();

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { googlePlaceId: true },
    });
    const googleReviewUrl = buildGoogleReviewUrl(tenant?.googlePlaceId);
    const routedToGoogle = input.rating >= HIGH_RATING_THRESHOLD && googleReviewUrl !== null;

    const comment = input.comment?.trim() ? input.comment.trim() : null;

    await this.repo.create({
      tenantId,
      appointmentId: input.appointmentId,
      customerId,
      rating: input.rating,
      comment,
      routedToGoogle,
    });

    return {
      rating: input.rating,
      routedToGoogle,
      googleReviewUrl: routedToGoogle ? googleReviewUrl : null,
    };
  }

  /** Visão do dono: média, distribuição, % encaminhado ao Google e feedbacks. */
  async getSummary(tenantId: string): Promise<ReviewSummary> {
    const [{ agg, byRating, routedCount }, comments] = await Promise.all([
      this.repo.getStats(tenantId),
      this.repo.listWithComments(tenantId, 20),
    ]);

    const distribution: RatingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const row of byRating) {
      const r = row.rating;
      if (r >= 1 && r <= 5) distribution[r as 1 | 2 | 3 | 4 | 5] = row._count._all;
    }

    return {
      total: agg._count._all,
      average: agg._avg.rating ?? 0,
      distribution,
      routedToGoogle: routedCount,
      feedback: comments.map((c) => ({
        id: c.id,
        rating: c.rating,
        comment: c.comment,
        routedToGoogle: c.routedToGoogle,
        createdAt: c.createdAt,
        customerName: c.customer.name,
        serviceName: c.appointment.service?.name ?? null,
      })),
    };
  }
}

export const reviewService = new ReviewService();
