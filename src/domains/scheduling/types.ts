import { AppointmentStatus } from "@prisma/client";
import { z } from "zod";

export const listAppointmentsSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  status: z.nativeEnum(AppointmentStatus).optional(),
  professionalId: z.string().uuid().optional(),
});

export type ListAppointmentsQuery = z.infer<typeof listAppointmentsSchema>;

export const createServiceSchema = z.object({
  name: z.string().trim().min(2).max(100),
  duration: z.number().int().min(5).max(480),
  price: z.number().nonnegative(),
  priceType: z.enum(['FIXED', 'STARTING_FROM', 'RANGE', 'ON_CONSULTATION']).default('FIXED'),
  priceMin: z.number().positive().optional(),
  priceMax: z.number().positive().optional(),
  description: z.string().trim().max(1000).optional(),
  categoryId: z.string().cuid().optional().nullable(),
  active: z.boolean().default(true),
})

export const updateServiceSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  duration: z.number().int().min(5).max(480).optional(),
  price: z.number().nonnegative().optional(),
  priceType: z.enum(['FIXED', 'STARTING_FROM', 'RANGE', 'ON_CONSULTATION']).optional(),
  priceMin: z.number().positive().optional().nullable(),
  priceMax: z.number().positive().optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
  categoryId: z.string().cuid().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
})

export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

export const createAppointmentSchema = z.object({
  customerId: z.string().cuid(),
  professionalId: z.string().uuid(),
  serviceId: z.string().cuid(),
  startsAt: z.string().datetime(),
  notes: z.string().trim().max(500).optional(),
  allowOverlap: z.boolean().optional().default(false),
  notificationMessage: z.string().trim().optional(),
});

export const updateAppointmentStatusSchema = z.object({
  status: z.nativeEnum(AppointmentStatus),
  notificationMessage: z.string().trim().optional(),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentStatusInput = z.infer<
  typeof updateAppointmentStatusSchema
>;

export const updateAppointmentSchema = z
  .object({
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    professionalId: z.string().uuid().optional(),
    serviceId: z.string().cuid().optional(),
    notificationMessage: z.string().min(1).max(1000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Informe ao menos um campo para atualizar.");

export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;

export const createPackageSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
  price: z.number().positive(),
  serviceIds: z.array(z.string().cuid()).min(1, 'Pacote deve ter ao menos 1 serviço'),
  imageUrl: z.string().url().optional(),
})

export const updatePackageSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(500).optional(),
    price: z.number().positive().optional(),
    serviceIds: z.array(z.string().cuid()).min(1).optional(),
    imageUrl: z.string().url().optional().nullable(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Informe ao menos um campo para atualizar.')

export type CreatePackageInput = z.infer<typeof createPackageSchema>
export type UpdatePackageInput = z.infer<typeof updatePackageSchema>

const promoItemSchema = z
  .object({
    serviceId: z.string().cuid().optional(),
    packageId: z.string().cuid().optional(),
  })
  .refine((i) => i.serviceId || i.packageId, 'Item deve ter serviceId ou packageId')

export const createPromotionSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().max(500).optional(),
    discountType: z.enum(['PERCENTAGE', 'FIXED']),
    discountValue: z.number().positive(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    imageUrl: z.string().url().optional(),
    items: z.array(promoItemSchema).min(1, 'Promoção deve ter ao menos 1 item'),
  })
  .refine(
    (data) => data.discountType !== 'PERCENTAGE' || data.discountValue <= 100,
    { message: 'Desconto percentual não pode ultrapassar 100%', path: ['discountValue'] },
  )

export const updatePromotionSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(500).optional(),
    discountType: z.enum(['PERCENTAGE', 'FIXED']).optional(),
    discountValue: z.number().positive().optional(),
    startsAt: z.string().datetime().optional().nullable(),
    endsAt: z.string().datetime().optional().nullable(),
    active: z.boolean().optional(),
    imageUrl: z.string().url().optional().nullable(),
    items: z.array(promoItemSchema).min(1).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Informe ao menos um campo para atualizar.')

export type CreatePromotionInput = z.infer<typeof createPromotionSchema>
export type UpdatePromotionInput = z.infer<typeof updatePromotionSchema>

export const createServiceCategorySchema = z.object({
  name: z.string().trim().min(2).max(60),
  order: z.number().int().min(0).optional(),
})

export const updateServiceCategorySchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  order: z.number().int().min(0).optional(),
})

export type CreateServiceCategoryInput = z.infer<typeof createServiceCategorySchema>
export type UpdateServiceCategoryInput = z.infer<typeof updateServiceCategorySchema>
