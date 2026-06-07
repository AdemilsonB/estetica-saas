import { prisma } from "@/shared/database/prisma";
import { SlotUnavailableError } from "@/shared/errors";
import { IamRepository } from "@/domains/iam/iam.repository";
import { dayBoundsInTz, localDateTimeToUtc } from "@/lib/dates";

import { appointmentRepository } from "./appointment.repository";

export type TimeSlot = {
  time: string;
  available: boolean;
  bookedBy?: string;
};

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export class AvailabilityService {
  async ensureSlotAvailable(
    tenantId: string,
    professionalId: string,
    startsAt: Date,
    endsAt: Date,
  ) {
    const overlapping = await appointmentRepository.findOverlappingForProfessional(
      tenantId,
      professionalId,
      startsAt,
      endsAt,
    );
    if (overlapping) {
      throw new SlotUnavailableError();
    }
  }

  async ensureSlotAvailableExcluding(
    tenantId: string,
    professionalId: string,
    startsAt: Date,
    endsAt: Date,
    excludeAppointmentId: string,
  ) {
    const overlapping = await appointmentRepository.findOverlappingForProfessional(
      tenantId,
      professionalId,
      startsAt,
      endsAt,
      excludeAppointmentId,
    );
    if (overlapping) {
      throw new SlotUnavailableError();
    }
  }

  async getAvailableSlots(
    tenantId: string,
    professionalId: string,
    date: string,
    serviceDuration: number,
    slotIntervalMinutes = 30,
  ): Promise<TimeSlot[]> {
    const iamRepo = new IamRepository();
    const [businessHours, tz] = await Promise.all([
      iamRepo.getBusinessHours(tenantId),
      iamRepo.getTenantTimezone(tenantId),
    ]);
    const timezone = tz ?? "America/Sao_Paulo";

    const dayOfWeek = new Date(date + "T12:00:00Z").getUTCDay();
    const dayConfig = businessHours[String(dayOfWeek)];

    if (!dayConfig || !dayConfig.active) {
      return [];
    }

    const interval = Math.max(slotIntervalMinutes, 5);
    const openMin = timeToMinutes(dayConfig.open);
    const closeMin = timeToMinutes(dayConfig.close);

    // Limites do dia no timezone do tenant (corrige o bug de UTC)
    const { start: dayStart, end: dayEnd } = dayBoundsInTz(timezone, new Date(`${date}T12:00:00Z`));

    const existingAppointments = await prisma.appointment.findMany({
      where: {
        tenantId,
        professionalId,
        status: { in: ["SCHEDULED", "CONFIRMED"] },
        startsAt: { gte: dayStart, lte: dayEnd },
      },
      select: {
        startsAt: true,
        endsAt: true,
        customer: { select: { name: true } },
      },
    });

    const slots: TimeSlot[] = [];
    // Intervalo fixo como passo; slot é incluído apenas se duração cabe até o fechamento
    for (let min = openMin; min + serviceDuration <= closeMin; min += interval) {
      const slotStart = localDateTimeToUtc(date, minutesToTime(min), timezone);
      const slotEnd = new Date(slotStart.getTime() + serviceDuration * 60 * 1000);

      const conflictingAppt = existingAppointments.find(
        (a) => a.startsAt < slotEnd && a.endsAt > slotStart,
      );

      slots.push({
        time: minutesToTime(min),
        available: !conflictingAppt,
        bookedBy: conflictingAppt?.customer.name.split(" ")[0],
      });
    }

    return slots;
  }
}

export const availabilityService = new AvailabilityService();
