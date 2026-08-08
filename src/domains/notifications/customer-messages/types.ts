import type { CustomerMessageEvent } from "@prisma/client";

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
  /** Canais ligados por padrão. Tenant sem registro em CustomerMessageSetting usa isto. */
  defaultChannels: CustomerMessageChannel[];
  variables: string[];
  defaults: Record<CustomerMessageChannel, { subject: string | null; body: string }>;
  legacy: LegacyTemplateBinding | null;
  /**
   * `"soon"` quando o evento existe no catálogo mas **nada o dispara** ainda. A UI
   * mostra o texto e desabilita o liga/desliga, em vez de oferecer um controle que
   * não faz nada — um toggle que o profissional liga e nada acontece é pior que a
   * ausência do recurso. Ausente = `"ga"`.
   */
  status?: "ga" | "soon";
};

export type RenderedCustomerMessage = {
  subject: string | null;
  text: string;
  mediaUrl: string | null;
};

/**
 * Garante em tempo de compilação que `CustomerMessageEventKey` e o enum
 * `CustomerMessageEvent` do Prisma têm exatamente os mesmos valores. Se alguém
 * adicionar um evento em só um dos dois lugares, `Exclude` deixa de ser `never`,
 * a constraint `T extends never` falha e `npx tsc --noEmit` quebra aqui.
 */
type AssertNever<T extends never> = T;
type _SemEventoSoNaUniao = AssertNever<Exclude<CustomerMessageEventKey, `${CustomerMessageEvent}`>>;
type _SemEventoSoNoEnum = AssertNever<Exclude<`${CustomerMessageEvent}`, CustomerMessageEventKey>>;
