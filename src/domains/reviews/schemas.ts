import { z } from "zod";

/** Nota a partir da qual o cliente é encaminhado ao Google (abaixo = feedback privado). */
export const HIGH_RATING_THRESHOLD = 4;

export const submitReviewSchema = z.object({
  appointmentId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;
