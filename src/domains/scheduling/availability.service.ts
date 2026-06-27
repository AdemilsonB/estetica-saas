import type { Prisma } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";
import { SlotUnavailableError } from "@/shared/errors";
import { IamRepository } from "@/domains/iam/iam.repository";
import { dayBoundsInTz, monthBoundsInTz, localDateTimeToUtc } from "@/lib/dates";

import { appointmentRepository } from "./appointment.repository";

export type TimeSlot = {
  time: string;
  available: boolean;
  bookedBy?: string;
};

export type DayAvailability = {
  date: string;
  open: boolean;
  available: boolean;
};

type DayConfig = { active: boolean; open: string; close: string };
type SlotAppointment = { startsAt: Date; endsAt: Date; customer?: { name: string } };

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
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    const overlapping = await appointmentRepository.findOverlappingForProfessional(
      tenantId,
      professionalId,
      startsAt,
      endsAt,
      undefined,
      client,
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
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    const overlapping = await appointmentRepository.findOverlappingForProfessional(
      tenantId,
      professionalId,
      startsAt,
      endsAt,
      excludeAppointmentId,
      client,
    );
    if (overlapping) {
      throw new SlotUnavailableError();
    }
  }

  /**
   * Constrói os slots de um dia a partir do expediente e dos agendamentos já
   * carregados (compartilhado entre a visão de dia e a visão de mês — evita
   * duplicar a lógica de geração/conflito de slots).
   */
  private buildDaySlots(
    date: string,
    dayConfig: DayConfig,
    appointments: SlotAppointment[],
    serviceDuration: number,
    interval: number,
    timezone: string,
    now: Date,
    minAdvanceMinutes: number,
  ): TimeSlot[] {
    const openMin = timeToMinutes(dayConfig.open);
    const closeMin = timeToMinutes(dayConfig.close);
    const earliestBookable = now.getTime() + minAdvanceMinutes * 60 * 1000;

    const slots: TimeSlot[] = [];
    // Intervalo fixo como passo; slot é incluído apenas se a duração cabe até o fechamento
    for (let min = openMin; min + serviceDuration <= closeMin; min += interval) {
      const slotStart = localDateTimeToUtc(date, minutesToTime(min), timezone);
      const slotEnd = new Date(slotStart.getTime() + serviceDuration * 60 * 1000);

      const conflictingAppt = appointments.find(
        (a) => a.startsAt < slotEnd && a.endsAt > slotStart,
      );
      const tooSoon = slotStart.getTime() < earliestBookable;

      slots.push({
        time: minutesToTime(min),
        available: !conflictingAppt && !tooSoon,
        bookedBy: conflictingAppt?.customer?.name.split(" ")[0],
      });
    }

    return slots;
  }

  /** Quantos dias de calendário (no timezone do tenant) separam `date` de hoje. */
  private daysFromToday(date: string, timezone: string, now: Date): number {
    const { start: dayStart } = dayBoundsInTz(timezone, new Date(`${date}T12:00:00Z`));
    const { start: todayStart } = dayBoundsInTz(timezone, now);
    return Math.round((dayStart.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000));
  }

  async getAvailableSlots(
    tenantId: string,
    professionalId: string,
    date: string,
    serviceDuration: number,
    slotIntervalMinutes = 30,
    minAdvanceMinutes = 0,
    maxAdvanceDays = Infinity,
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

    const now = new Date();
    if (this.daysFromToday(date, timezone, now) > maxAdvanceDays) {
      return [];
    }

    const interval = Math.max(slotIntervalMinutes, 5);

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

    return this.buildDaySlots(date, dayConfig, existingAppointments, serviceDuration, interval, timezone, now, minAdvanceMinutes);
  }

  /**
   * Disponibilidade de cada dia de um mês para um profissional/serviço.
   * Faz UMA consulta de agendamentos do mês inteiro e calcula em memória,
   * para alimentar o calendário público (dias fechados x abertos x lotados).
   */
  async getMonthAvailability(
    tenantId: string,
    professionalId: string,
    year: number,
    month: number, // 1-12
    serviceDuration: number,
    slotIntervalMinutes = 30,
    minAdvanceMinutes = 0,
    maxAdvanceDays = Infinity,
  ): Promise<DayAvailability[]> {
    const iamRepo = new IamRepository();
    const [businessHours, tz] = await Promise.all([
      iamRepo.getBusinessHours(tenantId),
      iamRepo.getTenantTimezone(tenantId),
    ]);
    const timezone = tz ?? "America/Sao_Paulo";
    const interval = Math.max(slotIntervalMinutes, 5);
    const now = new Date();

    const mm = String(month).padStart(2, "0");
    const anchor = new Date(`${year}-${mm}-15T12:00:00Z`);
    const { start: monthStart, end: monthEnd } = monthBoundsInTz(timezone, anchor);

    const appointments = await prisma.appointment.findMany({
      where: {
        tenantId,
        professionalId,
        status: { in: ["SCHEDULED", "CONFIRMED"] },
        startsAt: { gte: monthStart, lte: monthEnd },
      },
      select: { startsAt: true, endsAt: true },
    });

    const daysInMonth = new Date(year, month, 0).getDate();
    const result: DayAvailability[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dd = String(day).padStart(2, "0");
      const date = `${year}-${mm}-${dd}`;
      const dayOfWeek = new Date(`${date}T12:00:00Z`).getUTCDay();
      const dayConfig = businessHours[String(dayOfWeek)];

      if (!dayConfig || !dayConfig.active) {
        result.push({ date, open: false, available: false });
        continue;
      }

      if (this.daysFromToday(date, timezone, now) > maxAdvanceDays) {
        result.push({ date, open: true, available: false });
        continue;
      }

      const slots = this.buildDaySlots(date, dayConfig, appointments, serviceDuration, interval, timezone, now, minAdvanceMinutes);
      result.push({ date, open: true, available: slots.some((s) => s.available) });
    }

    return result;
  }
}

export const availabilityService = new AvailabilityService();
