import { TransactionType } from "@prisma/client";
import { z } from "zod";

export const listTransactionsSchema = z.object({
  type: z.nativeEnum(TransactionType).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListTransactionsQuery = z.infer<typeof listTransactionsSchema>;

export const createTransactionSchema = z.object({
  appointmentId: z.string().cuid().optional(),
  type: z.nativeEnum(TransactionType),
  category: z.string().trim().min(2).max(60),
  description: z.string().trim().min(2).max(200),
  amount: z.number().positive(),
  paidAt: z.string().datetime().optional(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
