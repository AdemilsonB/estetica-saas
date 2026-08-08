export type RespostaConfirmacao = "confirmar" | "cancelar";

/**
 * Casam apenas com a mensagem inteira, nunca dentro de uma frase: "vou confirmar
 * depois" é conversa, e agir sobre ela cancelaria ou confirmaria o horário de
 * alguém que não pediu nada.
 */
const CONFIRMAR = new Set(["1", "sim", "confirmar", "confirmo"]);
const CANCELAR = new Set(["2", "nao", "cancelar", "cancela"]);

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function interpretarResposta(texto: string): RespostaConfirmacao | null {
  const limpo = normalizar(texto);
  if (CONFIRMAR.has(limpo)) return "confirmar";
  if (CANCELAR.has(limpo)) return "cancelar";
  return null;
}
