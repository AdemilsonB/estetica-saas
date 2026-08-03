import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/shared/database/prisma";
import { optOutService } from "./opt-out.service";

const prismaMock = prisma as unknown as {
  customer: { updateMany: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  prismaMock.customer = { updateMany: vi.fn().mockResolvedValue({ count: 1 }) };
});

describe("optOutService.marcarPorTelefone", () => {
  it("marca o opt-out com data e origem", async () => {
    await optOutService.marcarPorTelefone("t1", "11999990000", "whatsapp_reply");

    const data = prismaMock.customer.updateMany.mock.calls[0][0].data;
    expect(data.marketingOptOut).toBe(true);
    expect(data.marketingOptOutOrigin).toBe("whatsapp_reply");
    expect(data.marketingOptOutAt).toBeInstanceOf(Date);
  });

  it("filtra sempre por tenantId", async () => {
    await optOutService.marcarPorTelefone("t1", "11999990000", "whatsapp_reply");

    const where = prismaMock.customer.updateMany.mock.calls[0][0].where;
    expect(where.tenantId).toBe("t1");
  });

  it("casa o telefone com e sem o DDI 55", async () => {
    // O import de contatos grava sem DDI, mas o WhatsApp entrega o remoteJid com.
    // Sem as duas variantes, o descadastro simplesmente não acha a pessoa.
    await optOutService.marcarPorTelefone("t1", "5511999990000", "whatsapp_reply");

    const where = prismaMock.customer.updateMany.mock.calls[0][0].where;
    expect(where.phone.in).toEqual(
      expect.arrayContaining(["5511999990000", "11999990000"]),
    );
  });

  it("devolve a contagem de clientes marcados", async () => {
    prismaMock.customer.updateMany.mockResolvedValue({ count: 2 });

    const resultado = await optOutService.marcarPorTelefone("t1", "11999990000", "portal");

    expect(resultado).toEqual({ marcados: 2 });
  });
});
