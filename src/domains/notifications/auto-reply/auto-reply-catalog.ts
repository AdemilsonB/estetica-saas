/**
 * Textos padrão do sistema para as respostas automáticas do webhook.
 *
 * Mesma arquitetura de duas camadas do catálogo de mensagens ao cliente: isto é o
 * padrão, o `Tenant` guarda só a personalização, e ausência de registro significa
 * "usa o padrão", nunca "sem mensagem". Melhorar estes textos depois não exige
 * migration nem backfill.
 */
export const AUTO_REPLY_DEFAULTS = {
  book: "Olá! Para agendar seu horário, acesse: {{link_agendamento}}",
  cancel:
    "Para cancelar ou remarcar seu agendamento, acesse: {{link_agendamento}} " +
    "ou fale com a gente por aqui.",
  priceIntro: "Nossos serviços:",
  priceEmpty: "Entre em contato para conhecer nossos serviços.",
  hoursIntro: "Nosso horário de funcionamento:",
  hoursEmpty: "Entre em contato para saber nosso horário de funcionamento.",
} as const;

export const DIAS_ABREVIADOS: Record<string, string> = {
  sun: "Dom",
  mon: "Seg",
  tue: "Ter",
  wed: "Qua",
  thu: "Qui",
  fri: "Sex",
  sat: "Sáb",
};
