import type { TemplateVariables } from "../user-notifications/notification-template-engine";

export type CustomerMessageContext = {
  customerName: string;
  serviceName?: string;
  professionalName?: string;
  startsAt?: Date;
  durationMinutes?: number;
  price?: number;
  daysSinceLastVisit?: number;
  lastServiceName?: string;
  tenant: {
    name: string;
    slug: string;
    timezone: string;
    phone?: string | null;
    address?: string | null;
  };
};

function formatar(date: Date, timezone: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, ...options }).format(date);
}

function primeiroNome(nomeCompleto: string): string {
  return nomeCompleto.trim().split(/\s+/)[0] ?? "";
}

/**
 * Monta o dicionário de variáveis do template. Todo valor é string — campo ausente vira
 * string vazia, para que `interpolateTemplate` nunca produza "undefined" no texto enviado.
 */
export function buildCustomerMessageVariables(ctx: CustomerMessageContext): TemplateVariables {
  const tz = ctx.tenant.timezone;
  const appUrl = process.env.APP_URL ?? "";

  let valor = "";
  if (ctx.price !== undefined) {
    const formatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(ctx.price);
    // Normalizar espaço não-quebrável (U+00A0) para espaço comum
    valor = formatted.replace(/ /g, " ");
  }

  return {
    cliente: ctx.customerName,
    primeiro_nome: primeiroNome(ctx.customerName),
    servico: ctx.serviceName ?? "",
    profissional: ctx.professionalName ?? "",
    data: ctx.startsAt
      ? formatar(ctx.startsAt, tz, { day: "2-digit", month: "2-digit", year: "numeric" })
      : "",
    hora: ctx.startsAt ? formatar(ctx.startsAt, tz, { hour: "2-digit", minute: "2-digit" }) : "",
    dia_semana: ctx.startsAt ? formatar(ctx.startsAt, tz, { weekday: "long" }) : "",
    duracao: ctx.durationMinutes !== undefined ? `${ctx.durationMinutes} min` : "",
    valor,
    negocio: ctx.tenant.name,
    endereco: ctx.tenant.address ?? "",
    telefone_negocio: ctx.tenant.phone ?? "",
    // `/agendar/[slug]` é o fluxo de agendamento (o mesmo link que o código legado já
    // envia — a equivalência da Task 6 depende disso) e `/[slug]/cliente` é o portal.
    link_agendamento: `${appUrl}/agendar/${ctx.tenant.slug}`,
    link_portal: `${appUrl}/${ctx.tenant.slug}/cliente`,
    dias_sem_vir: ctx.daysSinceLastVisit !== undefined ? String(ctx.daysSinceLastVisit) : "",
    ultimo_servico: ctx.lastServiceName ?? "",
  };
}
