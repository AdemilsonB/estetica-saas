import { AUTO_REPLY_DEFAULTS, DIAS_ABREVIADOS } from "./auto-reply-catalog";

export { AUTO_REPLY_DEFAULTS };

export type AutoReplyOverrides = {
  autoReplyMessage: string | null;
  autoReplyCancelMessage: string | null;
  autoReplyPriceIntro: string | null;
  autoReplyHoursIntro: string | null;
};

export type ServicoResumo = { name: string; price: unknown; priceType: string };

type BusinessHours = Record<string, { open: string; close: string; enabled: boolean }>;

/**
 * Texto personalizado do tenant, ou o padrão. Só em branco conta como ausência:
 * `''` é falsy e já causou bug neste projeto — um switch mandava string vazia e o
 * gateway caía no template, enviando mesmo desligado.
 */
function ouPadrao(personalizado: string | null, padrao: string): string {
  const limpo = personalizado?.trim();
  return limpo ? limpo : padrao;
}

function comLink(texto: string, bookingLink: string): string {
  // Aceita as duas grafias: `{{link_agendamento}}` é o padrão novo, `{booking_link}`
  // é o que os tenants que já personalizaram têm gravado.
  return texto
    .replaceAll("{{link_agendamento}}", bookingLink)
    .replaceAll("{booking_link}", bookingLink);
}

export function montarRespostaBook(o: AutoReplyOverrides, bookingLink: string): string {
  return comLink(ouPadrao(o.autoReplyMessage, AUTO_REPLY_DEFAULTS.book), bookingLink);
}

export function montarRespostaCancel(o: AutoReplyOverrides, bookingLink: string): string {
  return comLink(ouPadrao(o.autoReplyCancelMessage, AUTO_REPLY_DEFAULTS.cancel), bookingLink);
}

export function montarRespostaPrecos(o: AutoReplyOverrides, servicos: ServicoResumo[]): string {
  if (servicos.length === 0) return AUTO_REPLY_DEFAULTS.priceEmpty;

  const linhas = servicos.map((s) =>
    s.priceType === "ON_CONSULTATION"
      ? `• ${s.name}: Sob consulta`
      : `• ${s.name}: R$ ${Number(s.price).toFixed(2).replace(".", ",")}`,
  );

  return `${ouPadrao(o.autoReplyPriceIntro, AUTO_REPLY_DEFAULTS.priceIntro)}\n${linhas.join("\n")}`;
}

export function montarRespostaHorarios(
  o: AutoReplyOverrides,
  businessHours: BusinessHours | null,
): string {
  if (!businessHours) return AUTO_REPLY_DEFAULTS.hoursEmpty;

  const linhas = Object.entries(businessHours)
    .filter(([, v]) => v.enabled)
    .map(([k, v]) => `${DIAS_ABREVIADOS[k] ?? k}: ${v.open}–${v.close}`);

  if (linhas.length === 0) return AUTO_REPLY_DEFAULTS.hoursEmpty;

  return `${ouPadrao(o.autoReplyHoursIntro, AUTO_REPLY_DEFAULTS.hoursIntro)}\n${linhas.join("\n")}`;
}
