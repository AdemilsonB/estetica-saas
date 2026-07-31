import { z } from "zod";

/**
 * Data e hora chegam SEPARADAS e no formato local, nunca como instante ISO. É o que
 * força a conversão para UTC a acontecer no service, com o fuso do tenant — se o
 * componente mandasse um ISO, ele teria convertido no fuso do navegador, que é
 * exatamente o bug que o resumo diário da equipe já teve.
 */
const dataLocalSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data invalida.");

const horaLocalSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horario invalido.");

export const createScheduledMessageSchema = z.object({
  customerId: z.string().min(1),
  body: z.string().trim().min(1).max(1500),
  date: dataLocalSchema,
  time: horaLocalSchema,
});

export type CreateScheduledMessageInput = z.infer<typeof createScheduledMessageSchema>;

export const updateScheduledMessageSchema = z.object({
  body: z.string().trim().min(1).max(1500),
  date: dataLocalSchema,
  time: horaLocalSchema,
});

export type UpdateScheduledMessageInput = z.infer<typeof updateScheduledMessageSchema>;

export const previewScheduledMessageSchema = z.object({
  customerId: z.string().min(1),
  // Aqui o vazio é permitido: a prévia acompanha a digitação desde o primeiro caractere.
  body: z.string().max(1500),
});

export type PreviewScheduledMessageInput = z.infer<typeof previewScheduledMessageSchema>;
