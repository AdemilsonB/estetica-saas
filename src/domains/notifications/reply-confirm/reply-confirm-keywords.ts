import { normalizarTexto } from '../../../shared/utils/normalizar-texto'

export type RespostaConfirmacao = "confirmar" | "cancelar";

/**
 * Casam apenas com a mensagem inteira, nunca dentro de uma frase: "vou confirmar
 * depois" é conversa, e agir sobre ela cancelaria ou confirmaria o horário de
 * alguém que não pediu nada.
 */
const CONFIRMAR = new Set(["1", "sim", "confirmar", "confirmo"]);
const CANCELAR = new Set(["2", "nao", "cancelar", "cancela"]);


export function interpretarResposta(texto: string): RespostaConfirmacao | null {
  const limpo = normalizarTexto(texto);
  if (CONFIRMAR.has(limpo)) return "confirmar";
  if (CANCELAR.has(limpo)) return "cancelar";
  return null;
}
