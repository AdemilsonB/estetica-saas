import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/shared/test/prisma-mock";
import { ReviewAlreadyExistsError, ReviewNotEligibleError } from "@/shared/errors";

import { reviewService } from "./review.service";

const TENANT = "t1";
const CUSTOMER = "cust1";
const APPT = "appt1";

function eligibleAppointment(overrides: Record<string, unknown> = {}) {
  return { id: APPT, customerId: CUSTOMER, status: "COMPLETED", ...overrides };
}

describe("ReviewService.submitReview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("nota alta + tenant com Place ID → encaminha ao Google", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue(eligibleAppointment() as never);
    prismaMock.appointmentReview.findFirst.mockResolvedValue(null as never);
    prismaMock.tenant.findUnique.mockResolvedValue({ googlePlaceId: "PLACE123" } as never);
    prismaMock.appointmentReview.create.mockResolvedValue({} as never);

    const res = await reviewService.submitReview(TENANT, CUSTOMER, {
      appointmentId: APPT,
      rating: 5,
    });

    expect(res.routedToGoogle).toBe(true);
    expect(res.googleReviewUrl).toContain("writereview?placeid=PLACE123");
    // Escopo de tenant + persistência corretos
    expect(prismaMock.appointment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: APPT, tenantId: TENANT }) }),
    );
    expect(prismaMock.appointmentReview.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: TENANT,
        appointmentId: APPT,
        customerId: CUSTOMER,
        rating: 5,
        routedToGoogle: true,
        comment: null,
      }),
    });
  });

  it("nota baixa → feedback privado, sem Google, comentário guardado", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue(eligibleAppointment() as never);
    prismaMock.appointmentReview.findFirst.mockResolvedValue(null as never);
    prismaMock.tenant.findUnique.mockResolvedValue({ googlePlaceId: "PLACE123" } as never);
    prismaMock.appointmentReview.create.mockResolvedValue({} as never);

    const res = await reviewService.submitReview(TENANT, CUSTOMER, {
      appointmentId: APPT,
      rating: 2,
      comment: "  demorou muito  ",
    });

    expect(res.routedToGoogle).toBe(false);
    expect(res.googleReviewUrl).toBeNull();
    expect(prismaMock.appointmentReview.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ rating: 2, routedToGoogle: false, comment: "demorou muito" }),
    });
  });

  it("nota alta mas tenant sem Place ID → não encaminha", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue(eligibleAppointment() as never);
    prismaMock.appointmentReview.findFirst.mockResolvedValue(null as never);
    prismaMock.tenant.findUnique.mockResolvedValue({ googlePlaceId: null } as never);
    prismaMock.appointmentReview.create.mockResolvedValue({} as never);

    const res = await reviewService.submitReview(TENANT, CUSTOMER, { appointmentId: APPT, rating: 5 });

    expect(res.routedToGoogle).toBe(false);
    expect(res.googleReviewUrl).toBeNull();
  });

  it("atendimento não concluído → ReviewNotEligibleError", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue(
      eligibleAppointment({ status: "SCHEDULED" }) as never,
    );
    await expect(
      reviewService.submitReview(TENANT, CUSTOMER, { appointmentId: APPT, rating: 5 }),
    ).rejects.toBeInstanceOf(ReviewNotEligibleError);
    expect(prismaMock.appointmentReview.create).not.toHaveBeenCalled();
  });

  it("atendimento de outro cliente → ReviewNotEligibleError", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue(
      eligibleAppointment({ customerId: "outro" }) as never,
    );
    await expect(
      reviewService.submitReview(TENANT, CUSTOMER, { appointmentId: APPT, rating: 5 }),
    ).rejects.toBeInstanceOf(ReviewNotEligibleError);
  });

  it("atendimento inexistente no tenant → ReviewNotEligibleError", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue(null as never);
    await expect(
      reviewService.submitReview(TENANT, CUSTOMER, { appointmentId: APPT, rating: 5 }),
    ).rejects.toBeInstanceOf(ReviewNotEligibleError);
  });

  it("já avaliado → ReviewAlreadyExistsError", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue(eligibleAppointment() as never);
    prismaMock.appointmentReview.findFirst.mockResolvedValue({ id: "r1" } as never);
    await expect(
      reviewService.submitReview(TENANT, CUSTOMER, { appointmentId: APPT, rating: 5 }),
    ).rejects.toBeInstanceOf(ReviewAlreadyExistsError);
    expect(prismaMock.appointmentReview.create).not.toHaveBeenCalled();
  });
});

describe("ReviewService.getPendingReview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mapeia o atendimento avaliável", async () => {
    const startsAt = new Date("2026-07-19T14:00:00Z");
    prismaMock.appointment.findFirst.mockResolvedValue({
      id: "a1",
      startsAt,
      service: { name: "Corte" },
      professional: { name: "Ana" },
    } as never);

    const pending = await reviewService.getPendingReview(TENANT, CUSTOMER);
    expect(pending).toEqual({
      appointmentId: "a1",
      serviceName: "Corte",
      professionalName: "Ana",
      startsAt,
    });
  });

  it("retorna null quando não há atendimento avaliável", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue(null as never);
    expect(await reviewService.getPendingReview(TENANT, CUSTOMER)).toBeNull();
  });
});

describe("ReviewService.getSummary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("agrega média, distribuição, % ao Google e feedbacks", async () => {
    prismaMock.appointmentReview.aggregate.mockResolvedValue({
      _avg: { rating: 4.2 },
      _count: { _all: 10 },
    } as never);
    prismaMock.appointmentReview.groupBy.mockResolvedValue([
      { rating: 5, _count: { _all: 6 } },
      { rating: 4, _count: { _all: 2 } },
      { rating: 2, _count: { _all: 2 } },
    ] as never);
    prismaMock.appointmentReview.count.mockResolvedValue(8 as never);
    prismaMock.appointmentReview.findMany.mockResolvedValue([
      {
        id: "r1",
        rating: 2,
        comment: "demorou",
        routedToGoogle: false,
        createdAt: new Date("2026-07-18T10:00:00Z"),
        customer: { name: "João" },
        appointment: { startsAt: new Date(), service: { name: "Barba" } },
      },
    ] as never);

    const summary = await reviewService.getSummary(TENANT);

    expect(summary.total).toBe(10);
    expect(summary.average).toBe(4.2);
    expect(summary.distribution).toEqual({ 1: 0, 2: 2, 3: 0, 4: 2, 5: 6 });
    expect(summary.routedToGoogle).toBe(8);
    expect(summary.feedback[0]).toMatchObject({ customerName: "João", serviceName: "Barba", rating: 2 });
    // Toda agregação escopada ao tenant
    expect(prismaMock.appointmentReview.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT } }),
    );
  });
});
