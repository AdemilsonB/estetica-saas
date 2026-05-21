import { AppointmentStatus } from "@prisma/client";
import { z } from "zod";

export const listAppointmentsSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  status: z.nativeEnum(AppointmentStatus).optional(),
  professionalId: z.string().cuid().optional(),
});

export type ListAppointmentsQuery = z.infer<typeof listAppointmentsSchema>;

export const createServiceSchema = z.object({
  name: z.string().trim().min(2).max(100),
  duration: z.number().int().min(5).max(480),
  price: z.number().positive(),
  active: z.boolean().default(true),
});

export const createAppointmentSchema = z.object({
  customerId: z.string().cuid(),
  professionalId: z.string().cuid(),
  serviceId: z.string().cuid(),
  startsAt: z.string().datetime(),
  notes: z.string().trim().max(500).optional(),
});

export const updateAppointmentStatusSchema = z.object({
  status: z.nativeEnum(AppointmentStatus),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentStatusInput = z.infer<
  typeof updateAppointmentStatusSchema
>;
