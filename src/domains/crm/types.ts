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

// --- Anamnese ---

export type FieldType = "text" | "textarea" | "boolean" | "select" | "checkbox";
export type FieldSection = "basico" | "saude" | "estetico" | "objetivos";

export type FieldDef = {
  id: string;
  label: string;
  type: FieldType;
  options: string[];
  required: boolean;
  section: FieldSection;
};

export type AnamneseData = Record<string, string | string[] | boolean | null>;

export type AnamneseHistorySnapshot = {
  data: AnamneseData;
  savedAt: string;
  savedBy: string;
};

export const DEFAULT_ANAMNESE_FIELDS: FieldDef[] = [
  { id: "skin_type",       label: "Tipo de pele",                    type: "select",   options: ["Normal","Seca","Oleosa","Mista","Sensível"],                          required: true,  section: "basico" },
  { id: "phototype",       label: "Fototipo (Fitzpatrick)",          type: "select",   options: ["I","II","III","IV","V","VI"],                                         required: false, section: "basico" },
  { id: "age",             label: "Idade",                           type: "text",     options: [],                                                                      required: false, section: "basico" },
  { id: "allergies",       label: "Alergias conhecidas",             type: "checkbox", options: ["Látex","Níquel","Corantes","Parabenos","Fragrâncias","Nenhuma"],      required: false, section: "saude" },
  { id: "medications",     label: "Uso de medicamentos",             type: "textarea", options: [],                                                                      required: false, section: "saude" },
  { id: "conditions",      label: "Condições de saúde",              type: "checkbox", options: ["Diabetes","Hipertensão","Gestante","Cardiopatia","Nenhuma"],          required: false, section: "saude" },
  { id: "prev_procedures", label: "Procedimentos anteriores",        type: "textarea", options: [],                                                                      required: false, section: "estetico" },
  { id: "reactions",       label: "Reações adversas anteriores",     type: "textarea", options: [],                                                                      required: false, section: "estetico" },
  { id: "goals",           label: "Objetivos",                       type: "checkbox", options: ["Hidratação","Anti-aging","Clareamento","Firmeza","Relaxamento","Outro"], required: false, section: "objetivos" },
  { id: "consent",         label: "Termo de consentimento",          type: "boolean",  options: [],                                                                      required: true,  section: "objetivos" },
];

export const DEFAULT_LINK_MESSAGE =
  "Olá, {nome}! 😊 Para oferecer o melhor atendimento, pedimos que preencha sua ficha de anamnese antes da consulta:\n\n{link}\n\nQualquer dúvida, estamos à disposição!";

export const fieldDefSchema = z.object({
  id:       z.string().min(1).max(50),
  label:    z.string().min(1).max(100),
  type:     z.enum(["text", "textarea", "boolean", "select", "checkbox"]),
  options:  z.array(z.string().max(100)).default([]),
  required: z.boolean(),
  section:  z.enum(["basico", "saude", "estetico", "objetivos"]),
});

export const updateAnamneseTemplateSchema = z.object({
  fields:      z.array(fieldDefSchema).min(1).max(50),
  linkMessage: z.string().max(1000).optional(),
});

export const saveAnamneseSchema = z.object({
  data: z.record(z.string(), z.union([z.string(), z.array(z.string()), z.boolean(), z.null()])),
});

export const sendAnamnaseLinkSchema = z.object({
  message: z.string().min(10).max(1000),
});

export const submitPublicAnamneseSchema = z.object({
  data: z.record(z.string(), z.union([z.string(), z.array(z.string()), z.boolean(), z.null()])),
});

export type UpdateAnamneseTemplateInput = z.infer<typeof updateAnamneseTemplateSchema>;
export type SaveAnamneseInput = z.infer<typeof saveAnamneseSchema>;
export type SendAnamnaseLinkInput = z.infer<typeof sendAnamnaseLinkSchema>;
export type SubmitPublicAnamneseInput = z.infer<typeof submitPublicAnamneseSchema>;
