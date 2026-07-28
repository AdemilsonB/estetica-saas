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

export const updateCustomerMessageSettingSchema = z.object({
  event: customerMessageEventSchema,
  enabled: z.boolean(),
  channels: z.array(customerMessageChannelSchema),
});

export type UpdateCustomerMessageSettingInput = z.infer<
  typeof updateCustomerMessageSettingSchema
>;

export const customerMessagePreviewSchema = z
  .object({
    event: customerMessageEventSchema,
    appointmentId: z.string().min(1).optional(),
    customerId: z.string().min(1).optional(),
    serviceId: z.string().min(1).optional(),
    professionalId: z.string().min(1).optional(),
    startsAt: z.string().datetime().optional(),
  })
  .refine((d) => d.appointmentId || d.customerId, {
    message: "Informe appointmentId ou customerId.",
    path: ["customerId"],
  });

export type CustomerMessagePreviewInput = z.infer<typeof customerMessagePreviewSchema>;
