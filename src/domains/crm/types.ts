import { z } from "zod";

export const listCustomersSchema = z.object({
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  onlyVip: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  birthdayMonth: z.coerce.number().int().min(1).max(12).optional(),
  noAppointmentDays: z.coerce.number().int().min(1).max(730).optional(),
  minAvgTicket: z.coerce.number().min(0).optional(),
  hasPendingDebt: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

export type ListCustomersQuery = z.infer<typeof listCustomersSchema>;

export const createCustomerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(8).max(30).optional(),
  email: z.email().optional(),
  birthDate: z.string().date().optional(),
  notes: z.string().trim().max(500).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
});

export const updateCustomerSchema = createCustomerSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "Informe ao menos um campo para atualizar.",
);

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

