import { normalizeImportedPhone } from "@/shared/utils/vcard";

type RawEvolutionContact = {
  id?: string;
  remoteJid?: string | null;
};

/**
 * Extrai o número local (sem DDI 55) de um contato da Evolution API.
 *
 * Na Evolution v2 o JID do WhatsApp vem em `remoteJid` (o `id` virou UUID do banco);
 * na v1 o JID ficava no próprio `id`. Aceitamos os dois para não depender da versão.
 * Retorna `null` para grupos, JIDs não pessoais ou números não brasileiros.
 */
export function extractContactPhone(contact: RawEvolutionContact): string | null {
  const jid = contact.remoteJid ?? contact.id ?? "";
  const match = jid.match(/^(\d{10,13})@s\.whatsapp\.net$/);
  if (!match) return null;
  const digits = match[1];
  // Apenas números brasileiros (55 + 10 ou 11 dígitos)
  if (!/^55\d{10,11}$/.test(digits)) return null;
  return normalizeImportedPhone(digits);
}
