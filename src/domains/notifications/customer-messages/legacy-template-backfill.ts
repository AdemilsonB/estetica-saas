import { getCatalogEntry } from "./customer-message-catalog";
import type { CustomerMessageEventKey } from "./types";

export type LegacyWhatsAppConfig = Record<
  string,
  { mensagemPrincipal?: string; mensagemFinal?: string } | undefined
>;

/**
 * Converte a configuração legada (`Tenant.whatsappTemplateConfig`) no corpo completo do
 * template novo, injetando os fragmentos salvos pelo tenant no esqueleto que hoje é
 * hardcoded. O texto resultante renderiza igual ao que o tenant já envia.
 *
 * Devolve `null` quando não há nada a migrar — evento sem equivalente legado, config
 * ausente, ou tenant que nunca personalizou aquele evento. Nesses casos NÃO se cria
 * registro: a resolução cai no catálogo, e melhorias futuras no texto padrão chegam
 * automaticamente a quem nunca personalizou.
 */
export function buildLegacyBody(
  event: CustomerMessageEventKey,
  legacy: LegacyWhatsAppConfig | null,
): string | null {
  const entrada = getCatalogEntry(event);
  if (!entrada.legacy || !legacy) return null;

  const salvo = legacy[entrada.legacy.configKey];
  if (!salvo) return null;

  const principal = salvo.mensagemPrincipal;
  const final = salvo.mensagemFinal;
  if (principal === undefined && final === undefined) return null;

  return entrada.legacy.scaffold(
    principal ?? entrada.legacy.principal,
    final ?? entrada.legacy.final,
  );
}
