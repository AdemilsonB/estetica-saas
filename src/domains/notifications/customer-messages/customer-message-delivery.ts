import { featureGuard, FEATURES } from "@/domains/billing/feature-guard";

import type { CustomerMessageChannel } from "./types";

export type CustomerMessageBlockedReasonArgs = {
  tenantId: string;
  channels: CustomerMessageChannel[];
  cliente: { phone: string | null; email: string | null };
  tenant: {
    whatsappEnabled: boolean;
    evolutionConnected: boolean;
    evolutionStatus: string | null;
  };
};

/**
 * Devolve o motivo legível SÓ quando nenhum canal ligado consegue entregar. Se ao
 * menos um consegue, a mensagem sai e o toggle não pode aparecer desabilitado.
 */
export async function customerMessageBlockedReason(
  args: CustomerMessageBlockedReasonArgs,
): Promise<string | null> {
  if (args.channels.length === 0) {
    return "Nenhum canal está ligado para este aviso nas configurações.";
  }

  const emailEntrega = args.channels.includes("EMAIL") && Boolean(args.cliente.email);

  if (!args.channels.includes("WHATSAPP")) {
    return emailEntrega ? null : "Este cliente não tem e-mail cadastrado.";
  }

  let motivoWhatsApp: string | null = null;

  try {
    await featureGuard.assertAccess(args.tenantId, FEATURES.WHATSAPP_BASIC);
  } catch {
    motivoWhatsApp = "Seu plano não inclui o envio de WhatsApp.";
  }

  if (!motivoWhatsApp && !args.cliente.phone) {
    motivoWhatsApp = "Este cliente não tem telefone cadastrado.";
  }
  if (!motivoWhatsApp && !args.tenant.whatsappEnabled) {
    motivoWhatsApp = "O envio automático de WhatsApp está desligado nas configurações.";
  }
  if (
    !motivoWhatsApp &&
    (!args.tenant.evolutionConnected || args.tenant.evolutionStatus !== "CONNECTED")
  ) {
    motivoWhatsApp = "O WhatsApp do seu negócio não está conectado.";
  }

  if (!motivoWhatsApp) return null;
  return emailEntrega ? null : motivoWhatsApp;
}
