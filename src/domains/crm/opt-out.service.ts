import { prisma } from "@/shared/database/prisma";

export type OptOutOrigem = "whatsapp_reply" | "portal" | "panel";

/**
 * Gera as variantes com e sem DDI 55. O import de contatos grava o telefone sem
 * o prefixo, mas o WhatsApp entrega o `remoteJid` com ele — sem as duas variantes,
 * o descadastro não encontra a pessoa.
 */
function variantesDeTelefone(telefone: string): string[] {
  const digitos = telefone.replace(/\D/g, "");
  const variantes = new Set([digitos]);

  if (digitos.startsWith("55") && digitos.length > 12) {
    variantes.add(digitos.slice(2));
  } else {
    variantes.add(`55${digitos}`);
  }

  return [...variantes];
}

export class OptOutService {
  /**
   * Marca o descadastro de marketing de todos os clientes daquele tenant com o
   * telefone informado. `updateMany` porque a mesma pessoa pode ter mais de um
   * cadastro no tenant — marcar todos é o comportamento correto: ela pediu para sair.
   */
  async marcarPorTelefone(
    tenantId: string,
    telefone: string,
    origem: OptOutOrigem,
  ): Promise<{ marcados: number }> {
    const { count } = await prisma.customer.updateMany({
      where: { tenantId, phone: { in: variantesDeTelefone(telefone) } },
      data: {
        marketingOptOut: true,
        marketingOptOutAt: new Date(),
        marketingOptOutOrigin: origem,
      },
    });

    return { marcados: count };
  }
}

export const optOutService = new OptOutService();
