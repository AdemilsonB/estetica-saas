import { TransactionType } from "@prisma/client";
import { z } from "zod";

export const createTransactionSchema = z.object({
  appointmentId: z.string().cuid().optional(),
  type: z.nativeEnum(TransactionType),
  category: z.string().trim().min(2).max(60),
  description: z.string().trim().min(2).max(200),
  amount: z.number().positive(),
  paidAt: z.string().datetime().optional(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
