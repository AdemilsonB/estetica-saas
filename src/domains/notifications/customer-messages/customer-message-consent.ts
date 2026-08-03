import { getCatalogEntry } from "./customer-message-catalog";
import type { CustomerMessageEventKey } from "./types";

/**
 * Teto de mensagens promocionais por cliente por semana. Heurística de proteção
 * contra fadiga, não limite documentado por ninguém — ajustável.
 */
export const PROMOCIONAIS_MAX_POR_SEMANA = 1;

export type MotivoBloqueio = "sem-consentimento" | "opt-out" | "anti-fadiga";

export type ConsentSnapshot = {
  consentGiven: boolean;
  marketingOptOut: boolean;
  /** Promocionais entregues a este cliente nos últimos 7 dias. */
  promocionaisNaSemana: number;
};

export type ConsentDecision =
  | { permitido: true }
  | { permitido: false; motivo: MotivoBloqueio };

/**
 * Decide se um evento pode ser enviado a um cliente, com base na natureza declarada
 * no catálogo.
 *
 * Transacional é comunicação sobre um horário que o cliente marcou: envia sempre,
 * não depende de consentimento e opt-out não bloqueia. Promocional é o oposto.
 *
 * Derivar a decisão da natureza do catálogo — em vez de uma lista de eventos aqui —
 * é o que torna impossível esquecer a regra ao acrescentar um evento novo.
 */
export function avaliarConsentimento(
  event: CustomerMessageEventKey,
  snapshot: ConsentSnapshot,
): ConsentDecision {
  if (getCatalogEntry(event).nature === "transactional") {
    return { permitido: true };
  }

  if (!snapshot.consentGiven) {
    return { permitido: false, motivo: "sem-consentimento" };
  }

  // Antes da anti-fadiga de propósito: "ele pediu para sair" é um motivo acionável
  // para o tenant ler na prévia da campanha, "atingiu o limite da semana" não é.
  if (snapshot.marketingOptOut) {
    return { permitido: false, motivo: "opt-out" };
  }

  if (snapshot.promocionaisNaSemana >= PROMOCIONAIS_MAX_POR_SEMANA) {
    return { permitido: false, motivo: "anti-fadiga" };
  }

  return { permitido: true };
}
