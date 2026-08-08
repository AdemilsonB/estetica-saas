/**
 * Textos padrão da confirmação por resposta.
 *
 * O convite é ANEXADO ao lembrete renderizado, nunca embutido no template do
 * catálogo de mensagens: assim, desligar a automação não deixa um pedido órfão
 * num texto que o tenant editou, e ligar não exige que ele edite nada.
 */
export const REPLY_CONFIRM_DEFAULTS = {
  convite: "\n\nResponda *1* para confirmar ou *2* para cancelar.",
  confirmado: "Prontinho, seu horário está confirmado! Até logo. 😊",
  cancelado: "Seu horário foi cancelado. Quando quiser remarcar, é só chamar!",
  /** Usado quando há mais de um horário candidato. `{{data_hora}}` é obrigatório. */
  ambiguo: "Você tem mais de um horário marcado. Considerei o de {{data_hora}}.",
} as const;

/** Texto do tenant, ou o padrão. Só em branco conta como ausência. */
export function montarConvite(personalizado: string | null): string {
  const limpo = personalizado?.trim();
  return limpo ? limpo : REPLY_CONFIRM_DEFAULTS.convite;
}
