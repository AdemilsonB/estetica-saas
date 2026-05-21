import { z } from "zod";

export const createCustomerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(8).max(30).optional(),
  email: z.email().optional(),
  notes: z.string().trim().max(500).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
});

export const updateCustomerSchema = createCustomerSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "Informe ao menos um campo para atualizar.",
);

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
