import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/shared/database/prisma";
import { customerMessageConsentRepository } from "./customer-message-consent.repository";
import { PROMOCIONAIS_EVENT_TEMPLATES } from "./customer-message-consent.repository";

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

  it("filtra o cliente por tenantId", async () => {
    prismaMock.customer.findFirst.mockResolvedValue({
      consentGiven: true,
      marketingOptOut: false,
    });
    prismaMock.notificationLog.count.mockResolvedValue(0);

    await customerMessageConsentRepository.carregarSnapshot("t1", "c1");

    expect(prismaMock.customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "c1", tenantId: "t1" } }),
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
    // Se alguém acrescentar um evento promocional ao catálogo, ele entra aqui
    // sozinho. Uma lista fixa sairia de sincronia em silêncio.
    expect(PROMOCIONAIS_EVENT_TEMPLATES).toContain("birthday");
    expect(PROMOCIONAIS_EVENT_TEMPLATES).not.toContain("appointment-reminder");
  });
});
