export type CustomerMessageEventKey =
  | "appointment_requested"
  | "appointment_created"
  | "appointment_confirmed"
  | "appointment_rescheduled"
  | "appointment_cancelled"
  | "appointment_no_show"
  | "appointment_reminder"
  | "birthday"
  | "return_due"
  | "winback";

export type CustomerMessageChannel = "WHATSAPP" | "EMAIL";

/**
 * Transacional = comunicação sobre um horário que o cliente marcou. Nunca respeita
 * opt-out de marketing e nunca conta no anti-fadiga. Promocional = o oposto.
 */
export type CustomerMessageNature = "transactional" | "promotional";

/**
 * Ligação com a configuração legada (`Tenant.whatsappTemplateConfig`), usada apenas
 * pelo backfill da Fase 1. Eventos sem equivalente legado têm `legacy: null`.
 */
export type LegacyTemplateBinding = {
  configKey: string;
  principal: string;
  final: string;
  scaffold: (principal: string, final: string) => string;
};

export type CustomerMessageCatalogEntry = {
  event: CustomerMessageEventKey;
  label: string;
  description: string;
  nature: CustomerMessageNature;
  defaultEnabled: boolean;
  variables: string[];
  defaults: Record<CustomerMessageChannel, { subject: string | null; body: string }>;
  legacy: LegacyTemplateBinding | null;
};

export type RenderedCustomerMessage = {
  subject: string | null;
  text: string;
  mediaUrl: string | null;
};

import type { CustomerMessageEvent } from "@prisma/client";

/**
 * Garante em tempo de compilação que `CustomerMessageEventKey` e o enum do Prisma têm
 * exatamente os mesmos valores. Se alguém adicionar um evento em só um dos dois lugares,
 * `npx tsc --noEmit` quebra aqui.
 */
type AssertMesmosValores<A, B> = A extends B ? (B extends A ? true : never) : never;
export type _EnumEmSincronia = AssertMesmosValores<
  CustomerMessageEventKey,
  `${CustomerMessageEvent}`
>;
