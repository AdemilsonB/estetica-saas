import type {
  CustomerMessageCatalogEntry,
  CustomerMessageEventKey,
} from "./types";

// Variáveis comuns a todo evento ligado a um agendamento.
const VARS_AGENDAMENTO = [
  "cliente",
  "primeiro_nome",
  "servico",
  "profissional",
  "data",
  "hora",
  "dia_semana",
  "duracao",
  "valor",
  "negocio",
  "endereco",
  "telefone_negocio",
  "link_agendamento",
  "link_portal",
];

const VARS_CLIENTE = [
  "cliente",
  "primeiro_nome",
  "negocio",
  "endereco",
  "telefone_negocio",
  "link_agendamento",
  "link_portal",
];

/**
 * Esqueleto que reproduz exatamente o texto que o sistema envia hoje em
 * `buildEvolutionMessage` para os eventos com data/hora. Manter idêntico: o teste de
 * equivalência da Task 6 depende disto para garantir que nenhum tenant perceba a migração.
 */
const scaffoldComDataHora = (principal: string, final: string) =>
  `Olá, {{cliente}}! ${principal} 📅 {{data}} às {{hora}} | {{servico}} | {{negocio}}. ${final} 🔗 {{link_agendamento}}`;

/** Esqueleto de `appointment-reminder`: só hora, sem data e sem link. */
const scaffoldLembrete = (principal: string, final: string) =>
  `Olá, {{cliente}}! ${principal} Hoje às {{hora}} | {{servico}} | {{negocio}}. ${final}`;

/** Esqueleto sem data/hora: cancelamento e no-show. */
const scaffoldSimples = (principal: string, final: string) =>
  `Olá, {{cliente}}! ${principal} | {{servico}} | {{negocio}}. ${final}`;

/** Esqueleto de aniversário: sem serviço. */
const scaffoldAniversario = (principal: string, final: string) =>
  `Olá, {{cliente}}! ${principal} De {{negocio}}. ${final}`;

export const CUSTOMER_MESSAGE_CATALOG: CustomerMessageCatalogEntry[] = [
  {
    event: "appointment_requested",
    label: "Pedido de agendamento recebido",
    description:
      "Enviada quando o cliente agenda pela vitrine pública e o horário ainda aguarda sua confirmação.",
    nature: "transactional",
    defaultEnabled: true,
    variables: VARS_AGENDAMENTO,
    defaults: {
      WHATSAPP: {
        subject: null,
        body: "Olá, {{cliente}}! 📝 Recebemos seu pedido de agendamento para {{servico}} em {{data}} às {{hora}}. Assim que confirmarmos, te aviso por aqui. — {{negocio}}",
      },
      EMAIL: {
        subject: "Recebemos seu pedido de agendamento",
        body: "Olá, {{cliente}}!\n\nRecebemos seu pedido de agendamento:\n\n{{servico}} — {{data}} às {{hora}}\n\nAssim que confirmarmos, você recebe um novo aviso.\n\n— {{negocio}}",
      },
    },
    legacy: null,
  },
  {
    event: "appointment_created",
    label: "Agendamento criado",
    description: "Enviada quando você marca um horário pelo painel.",
    nature: "transactional",
    defaultEnabled: true,
    variables: VARS_AGENDAMENTO,
    defaults: {
      WHATSAPP: {
        subject: null,
        body: scaffoldComDataHora("Seu agendamento foi criado.", "Até lá!"),
      },
      EMAIL: {
        subject: "Agendamento confirmado",
        body: "Olá, {{cliente}}!\n\nSeu agendamento foi criado:\n\n{{servico}} — {{data}} às {{hora}}\n\n— {{negocio}}",
      },
    },
    legacy: {
      configKey: "confirmacao",
      principal: "Seu agendamento foi criado.",
      final: "Até lá!",
      scaffold: scaffoldComDataHora,
    },
  },
  {
    event: "appointment_confirmed",
    label: "Agendamento confirmado",
    description: "Enviada quando você confirma um pedido feito pela vitrine pública.",
    nature: "transactional",
    defaultEnabled: true,
    variables: VARS_AGENDAMENTO,
    defaults: {
      WHATSAPP: {
        subject: null,
        body: scaffoldComDataHora("Seu agendamento está confirmado.", "Te esperamos!"),
      },
      EMAIL: {
        subject: "Agendamento confirmado",
        body: "Olá, {{cliente}}!\n\nSeu agendamento está confirmado:\n\n{{servico}} — {{data}} às {{hora}}\n\n— {{negocio}}",
      },
    },
    legacy: {
      configKey: "confirmado",
      principal: "Seu agendamento está confirmado.",
      final: "Te esperamos!",
      scaffold: scaffoldComDataHora,
    },
  },
  {
    event: "appointment_rescheduled",
    label: "Agendamento remarcado",
    description: "Enviada quando a data ou a hora de um agendamento muda.",
    nature: "transactional",
    defaultEnabled: true,
    variables: VARS_AGENDAMENTO,
    defaults: {
      WHATSAPP: {
        subject: null,
        body: "Olá, {{cliente}}! Seu agendamento foi remarcado para {{data}} às {{hora}} | {{servico}} | {{negocio}}.",
      },
      EMAIL: {
        subject: "Seu agendamento foi remarcado",
        body: "Olá, {{cliente}}!\n\nSeu agendamento foi remarcado:\n\n{{servico}} — {{data}} às {{hora}}\n\n— {{negocio}}",
      },
    },
    legacy: null,
  },
  {
    event: "appointment_cancelled",
    label: "Agendamento cancelado",
    description: "Enviada quando um agendamento é cancelado.",
    nature: "transactional",
    defaultEnabled: true,
    variables: VARS_AGENDAMENTO,
    defaults: {
      WHATSAPP: {
        subject: null,
        body: scaffoldSimples(
          "Seu agendamento foi cancelado.",
          "Para reagendar, entre em contato conosco.",
        ),
      },
      EMAIL: {
        subject: "Agendamento cancelado",
        body: "Olá, {{cliente}}.\n\nSeu agendamento de {{servico}} foi cancelado.\n\nPara reagendar, entre em contato: {{telefone_negocio}}\n\n— {{negocio}}",
      },
    },
    legacy: {
      configKey: "cancelamento",
      principal: "Seu agendamento foi cancelado.",
      final: "Para reagendar, entre em contato conosco.",
      scaffold: scaffoldSimples,
    },
  },
  {
    event: "appointment_no_show",
    label: "Falta registrada",
    description: "Enviada quando você registra que o cliente não compareceu.",
    nature: "transactional",
    defaultEnabled: true,
    variables: VARS_AGENDAMENTO,
    defaults: {
      WHATSAPP: {
        subject: null,
        body: scaffoldSimples(
          "Notamos que você não compareceu ao seu horário.",
          "Quando quiser reagendar, estamos à disposição!",
        ),
      },
      EMAIL: {
        subject: "Sentimos sua falta",
        body: "Olá, {{cliente}}.\n\nNotamos que você não compareceu ao horário de {{servico}}.\n\nQuando quiser reagendar, estamos à disposição.\n\n— {{negocio}}",
      },
    },
    legacy: {
      configKey: "nao_comparecimento",
      principal: "Notamos que você não compareceu ao seu horário.",
      final: "Quando quiser reagendar, estamos à disposição!",
      scaffold: scaffoldSimples,
    },
  },
  {
    event: "appointment_reminder",
    label: "Lembrete de horário",
    description: "Enviada automaticamente antes do atendimento, no prazo que você configurou.",
    nature: "transactional",
    defaultEnabled: true,
    variables: VARS_AGENDAMENTO,
    defaults: {
      WHATSAPP: {
        subject: null,
        body: scaffoldLembrete("Lembrete:", "Até lá!"),
      },
      EMAIL: {
        subject: "Lembrete do seu agendamento",
        body: "Olá, {{cliente}}!\n\nLembrete do seu agendamento:\n\n{{servico}} — {{data}} às {{hora}}\n\n— {{negocio}}",
      },
    },
    legacy: {
      configKey: "lembrete",
      principal: "Lembrete:",
      final: "Até lá!",
      scaffold: scaffoldLembrete,
    },
  },
  {
    event: "birthday",
    label: "Aniversário",
    description: "Enviada no aniversário do cliente.",
    nature: "promotional",
    defaultEnabled: false,
    variables: VARS_CLIENTE,
    defaults: {
      WHATSAPP: {
        subject: null,
        body: scaffoldAniversario(
          "Feliz aniversário! Temos um presente especial para você.",
          "Venha nos visitar em breve!",
        ),
      },
      EMAIL: {
        subject: "Feliz aniversário!",
        body: "Olá, {{cliente}}!\n\nFeliz aniversário! Temos um presente especial para você.\n\nVenha nos visitar: {{link_agendamento}}\n\n— {{negocio}}",
      },
    },
    legacy: {
      configKey: "aniversario",
      principal: "Feliz aniversário! Temos um presente especial para você.",
      final: "Venha nos visitar em breve!",
      scaffold: scaffoldAniversario,
    },
  },
  {
    event: "return_due",
    label: "Hora do retorno",
    description:
      "Enviada quando chega a data de retorno recomendada do serviço que o cliente fez.",
    nature: "promotional",
    defaultEnabled: false,
    variables: [...VARS_CLIENTE, "ultimo_servico", "dias_sem_vir"],
    defaults: {
      WHATSAPP: {
        subject: null,
        body: "Oi, {{primeiro_nome}}! 💇 Já faz {{dias_sem_vir}} dias desde seu último {{ultimo_servico}} — costuma ser a hora de renovar. Quer garantir seu horário? 🔗 {{link_agendamento}}",
      },
      EMAIL: {
        subject: "Já é hora do seu retorno",
        body: "Oi, {{primeiro_nome}}!\n\nJá faz {{dias_sem_vir}} dias desde seu último {{ultimo_servico}}.\n\nQuer garantir seu horário? {{link_agendamento}}\n\n— {{negocio}}",
      },
    },
    legacy: null,
  },
  {
    event: "winback",
    label: "Reconquista",
    description: "Enviada para clientes que estão há muito tempo sem aparecer.",
    nature: "promotional",
    defaultEnabled: false,
    variables: [...VARS_CLIENTE, "ultimo_servico", "dias_sem_vir"],
    defaults: {
      WHATSAPP: {
        subject: null,
        body: "Oi, {{primeiro_nome}}! Sentimos sua falta por aqui — já são {{dias_sem_vir}} dias. 💛 Que tal marcar um horário? 🔗 {{link_agendamento}}",
      },
      EMAIL: {
        subject: "Sentimos sua falta",
        body: "Oi, {{primeiro_nome}}!\n\nSentimos sua falta por aqui — já são {{dias_sem_vir}} dias.\n\nQue tal marcar um horário? {{link_agendamento}}\n\n— {{negocio}}",
      },
    },
    legacy: null,
  },
];

export const CUSTOMER_MESSAGE_CATALOG_MAP = Object.fromEntries(
  CUSTOMER_MESSAGE_CATALOG.map((entrada) => [entrada.event, entrada]),
) as Record<CustomerMessageEventKey, CustomerMessageCatalogEntry>;

export function getCatalogEntry(event: CustomerMessageEventKey): CustomerMessageCatalogEntry {
  return CUSTOMER_MESSAGE_CATALOG_MAP[event];
}

/**
 * `NotificationDraft.template` ainda usa os nomes antigos com hífen. Este mapa permite
 * traduzir sem tocar em `subscriptions.ts` nem nos jobs nesta fase.
 */
export const LEGACY_TEMPLATE_TO_EVENT: Record<string, CustomerMessageEventKey> = {
  "appointment-created": "appointment_created",
  "appointment-confirmed": "appointment_confirmed",
  "appointment-rescheduled": "appointment_rescheduled",
  "appointment-cancelled": "appointment_cancelled",
  "appointment-no-show": "appointment_no_show",
  "appointment-reminder": "appointment_reminder",
  birthday: "birthday",
};
