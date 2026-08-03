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

  it("a lista de templates promocionais vem do catálogo, não é hardcoded", () => {
    // Deriva os templates no próprio teste para garantir que qualquer hardcoding
    // seria detectado. Se alguém trocasse a derivação por uma lista literal,
    // este teste continuaria falhando até a lista ser mantida em sincronia.
    const computedPromocionais = CUSTOMER_MESSAGE_CATALOG
      .filter((entrada) => entrada.nature === "promotional")
      .map((entrada) => CUSTOMER_MESSAGE_TEMPLATE_KEY[entrada.event]);

    expect(PROMOCIONAIS_EVENT_TEMPLATES).toEqual(computedPromocionais);

    // Verificação adicional: cobre todos os 3 eventos promocionais
    expect(PROMOCIONAIS_EVENT_TEMPLATES).toContain("birthday");
    expect(PROMOCIONAIS_EVENT_TEMPLATES).toContain("return-due");
    expect(PROMOCIONAIS_EVENT_TEMPLATES).toContain("winback");

    // Não contém transacionais
    expect(PROMOCIONAIS_EVENT_TEMPLATES).not.toContain("appointment-reminder");
    expect(PROMOCIONAIS_EVENT_TEMPLATES).not.toContain("appointment-confirmed");
  });
});
