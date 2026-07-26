import { z } from "zod";

export const customerMessageEventSchema = z.enum([
  "appointment_requested",
  "appointment_created",
  "appointment_confirmed",
  "appointment_rescheduled",
  "appointment_cancelled",
  "appointment_no_show",
  "appointment_reminder",
  "birthday",
  "return_due",
  "winback",
]);

export const customerMessageChannelSchema = z.enum(["WHATSAPP", "EMAIL"]);

export const updateCustomerMessageTemplateSchema = z.object({
  event: customerMessageEventSchema,
  channel: customerMessageChannelSchema,
  subject: z.string().trim().min(1).max(120).nullable(),
  body: z.string().trim().min(1).max(1500),
  mediaUrl: z.string().url().nullable(),
});

export type UpdateCustomerMessageTemplateInput = z.infer<
  typeof updateCustomerMessageTemplateSchema
>;
