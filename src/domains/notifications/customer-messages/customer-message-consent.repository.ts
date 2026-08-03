import { prisma } from "@/shared/database/prisma";

import {
  CUSTOMER_MESSAGE_CATALOG,
  CUSTOMER_MESSAGE_TEMPLATE_KEY,
} from "./customer-message-catalog";
import type { ConsentSnapshot } from "./customer-message-consent";

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Chaves de template dos eventos promocionais, derivadas do catálogo. Uma lista
 * fixa aqui sairia de sincronia em silêncio quando alguém acrescentasse um evento.
 */
export const PROMOCIONAIS_EVENT_TEMPLATES: string[] = CUSTOMER_MESSAGE_CATALOG
  .filter((entrada) => entrada.nature === "promotional")
  .map((entrada) => CUSTOMER_MESSAGE_TEMPLATE_KEY[entrada.event]);

export class CustomerMessageConsentRepository {
  /**
   * Carrega o que a guarda precisa para decidir. Devolve `null` quando o cliente
   * não existe naquele tenant — nunca busca sem `tenantId`.
   */
  async carregarSnapshot(tenantId: string, customerId: string): Promise<ConsentSnapshot | null> {
    const cliente = await prisma.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null },
      select: { consentGiven: true, marketingOptOut: true },
    });

    if (!cliente) return null;

    const promocionaisNaSemana = await prisma.notificationLog.count({
      where: {
        tenantId,
        customerId,
        template: { in: PROMOCIONAIS_EVENT_TEMPLATES },
        createdAt: { gte: new Date(Date.now() - SETE_DIAS_MS) },
      },
    });

    return {
      consentGiven: cliente.consentGiven,
      marketingOptOut: cliente.marketingOptOut,
      promocionaisNaSemana,
    };
  }
}

export const customerMessageConsentRepository = new CustomerMessageConsentRepository();
