import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/shared/database/prisma";
import { customerMessageConsentRepository } from "./customer-message-consent.repository";
import { PROMOCIONAIS_EVENT_TEMPLATES } from "./customer-message-consent.repository";
import {
  CUSTOMER_MESSAGE_CATALOG,
  CUSTOMER_MESSAGE_TEMPLATE_KEY,
} from "./customer-message-catalog";

const prismaMock = prisma as unknown as {
  customer: { findFirst: ReturnType<typeof vi.fn> };
  notificationLog: { count: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  prismaMock.customer = { findFirst: vi.fn() };
  prismaMock.notificationLog = { count: vi.fn() };
});

describe("customerMessageConsentRepository.carregarSnapshot", () => {
  it("devolve null quando o cliente não existe no tenant", async () => {
    prismaMock.customer.findFirst.mockResolvedValue(null);

    const snapshot = await customerMessageConsentRepository.carregarSnapshot("t1", "c1");

    expect(snapshot).toBeNull();
    expect(prismaMock.notificationLog.count).not.toHaveBeenCalled();
  });

  it("devolve null quando o cliente foi soft-deleted", async () => {
    prismaMock.customer.findFirst.mockResolvedValue(null);

    const snapshot = await customerMessageConsentRepository.carregarSnapshot("t1", "c1-deleted");

    expect(snapshot).toBeNull();
    expect(prismaMock.notificationLog.count).not.toHaveBeenCalled();
  });

  it("filtra o cliente por tenantId e deletedAt", async () => {
    prismaMock.customer.findFirst.mockResolvedValue({
      consentGiven: true,
      marketingOptOut: false,
    });
    prismaMock.notificationLog.count.mockResolvedValue(0);

    await customerMessageConsentRepository.carregarSnapshot("t1", "c1");

    expect(prismaMock.customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "c1", tenantId: "t1", deletedAt: null } }),
    );
  });

  it("conta apenas templates promocionais dos últimos 7 dias", async () => {
    prismaMock.customer.findFirst.mockResolvedValue({
      consentGiven: true,
      marketingOptOut: false,
    });
    prismaMock.notificationLog.count.mockResolvedValue(2);

    const snapshot = await customerMessageConsentRepository.carregarSnapshot("t1", "c1");

    expect(snapshot).toEqual({
      consentGiven: true,
      marketingOptOut: false,
      promocionaisNaSemana: 2,
    });

    const where = prismaMock.notificationLog.count.mock.calls[0][0].where;
    expect(where.tenantId).toBe("t1");
    expect(where.customerId).toBe("c1");
    expect(where.template).toEqual({ in: PROMOCIONAIS_EVENT_TEMPLATES });
    expect(where.createdAt.gte).toBeInstanceOf(Date);
  });

  it("acompanha o catalogo: evento promocional novo entra na lista sem tocar no repositorio", () => {
    // Testa sincronismo: duplica a expressão do repositório aqui para garantir que qualquer
    // evento novo adicionado ao catálogo quebrará o teste enquanto a repository não for
    // atualizada. A expressão duplicada é intencional — a guarda de sincronia.
    // (Não detecta substituição por literal com mesmos valores — isso não é risco realista.)
    const computedPromocionais = CUSTOMER_MESSAGE_CATALOG
      .filter((entrada) => entrada.nature === "promotional")
      .map((entrada) => CUSTOMER_MESSAGE_TEMPLATE_KEY[entrada.event]);

    expect(PROMOCIONAIS_EVENT_TEMPLATES).toEqual(computedPromocionais);

    // Cobertura dos eventos atuais
    expect(PROMOCIONAIS_EVENT_TEMPLATES).toContain("birthday");
    expect(PROMOCIONAIS_EVENT_TEMPLATES).toContain("return-due");
    expect(PROMOCIONAIS_EVENT_TEMPLATES).toContain("winback");

    // Exclui transacionais (guarda contra erro de filtro)
    expect(PROMOCIONAIS_EVENT_TEMPLATES).not.toContain("appointment-reminder");
    expect(PROMOCIONAIS_EVENT_TEMPLATES).not.toContain("appointment-confirmed");
  });
});
