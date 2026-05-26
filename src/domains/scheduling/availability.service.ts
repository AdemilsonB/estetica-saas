import { prisma } from "@/shared/database/prisma";
import { SlotUnavailableError } from "@/shared/errors";
import { IamRepository } from "@/domains/iam/iam.repository";

import { appointmentRepository } from "./appointment.repository";

export type TimeSlot = {
  time: string;
  available: boolean;
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

  async getAvailableSlots(
    tenantId: string,
    professionalId: string,
    date: string,
    serviceDuration: number,
  ): Promise<TimeSlot[]> {
    const iamRepo = new IamRepository();
    const businessHours = await iamRepo.getBusinessHours(tenantId);
    const dayOfWeek = new Date(date + "T12:00:00").getDay();
    const dayConfig = businessHours[String(dayOfWeek)];

    if (!dayConfig || !dayConfig.active) {
      return [];
    }

    const step = Math.max(serviceDuration, 15);
    const openMin = timeToMinutes(dayConfig.open);
    const closeMin = timeToMinutes(dayConfig.close);

    const dayStart = new Date(date + "T00:00:00");
    const dayEnd = new Date(date + "T23:59:59");

    const existingAppointments = await prisma.appointment.findMany({
      where: {
        tenantId,
        professionalId,
        status: { in: ["SCHEDULED", "CONFIRMED"] },
        startsAt: { gte: dayStart, lte: dayEnd },
      },
      select: { startsAt: true, endsAt: true },
    });

    const slots: TimeSlot[] = [];
    for (let min = openMin; min + step <= closeMin; min += step) {
      const slotStart = new Date(`${date}T${minutesToTime(min)}:00`);
      const slotEnd = new Date(slotStart.getTime() + step * 60 * 1000);

      const conflicting = existingAppointments.some(
        (a) => a.startsAt < slotEnd && a.endsAt > slotStart,
      );

      slots.push({ time: minutesToTime(min), available: !conflicting });
    }

    return slots;
  }
}

export const availabilityService = new AvailabilityService();
