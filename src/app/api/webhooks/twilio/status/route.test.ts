import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@/shared/test/prisma-mock";
import { NotificationStatus } from "@prisma/client";

const { mockValidateRequest } = vi.hoisted(() => ({
  mockValidateRequest: vi.fn(),
}));

vi.mock("twilio", () => {
  const twilioDefault = vi.fn() as ReturnType<typeof vi.fn> & {
    validateRequest: typeof mockValidateRequest;
  };
  twilioDefault.validateRequest = mockValidateRequest;
  return {
    default: twilioDefault,
    validateRequest: mockValidateRequest,
  };
});

vi.mock("@/app/api/_lib/runtime", () => ({
  initializeDomainRuntime: vi.fn(),
}));

import { POST } from "./route";

function makeRequest(body: Record<string, string>, signature = "valid-sig") {
  return new Request("http://localhost/api/webhooks/twilio/status", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-twilio-signature": signature,
      "x-forwarded-for": "1.2.3.4",
    },
    body: new URLSearchParams(body).toString(),
  });
}

describe("POST /api/webhooks/twilio/status", () => {
  beforeEach(() => {
    mockValidateRequest.mockReturnValue(true);
    prismaMock.notificationLog.updateMany.mockResolvedValue({ count: 1 });
  });

  it("retorna 204 e atualiza log para status delivered → DELIVERED", async () => {
    const req = makeRequest({ MessageSid: "SM123", MessageStatus: "delivered" });
    const res = await POST(req);

    expect(res.status).toBe(204);
    expect(prismaMock.notificationLog.updateMany).toHaveBeenCalledWith({
      where: { externalId: "SM123" },
      data: { status: NotificationStatus.DELIVERED, errorMessage: null },
    });
  });

  it("retorna 204 e atualiza para SENT em status sent/queued", async () => {
    const req = makeRequest({ MessageSid: "SM123", MessageStatus: "sent" });
    const res = await POST(req);

    expect(res.status).toBe(204);
    expect(prismaMock.notificationLog.updateMany).toHaveBeenCalledWith({
      where: { externalId: "SM123" },
      data: { status: NotificationStatus.SENT, errorMessage: null },
    });
  });

  it("retorna 204 e atualiza para FAILED com ErrorCode", async () => {
    const req = makeRequest({
      MessageSid: "SM123",
      MessageStatus: "failed",
      ErrorCode: "30007",
    });
    const res = await POST(req);

    expect(res.status).toBe(204);
    expect(prismaMock.notificationLog.updateMany).toHaveBeenCalledWith({
      where: { externalId: "SM123" },
      data: { status: NotificationStatus.FAILED, errorMessage: "30007" },
    });
  });

  it("retorna 403 para assinatura Twilio inválida", async () => {
    mockValidateRequest.mockReturnValue(false);
    const req = makeRequest({ MessageSid: "SM123", MessageStatus: "delivered" }, "bad-sig");

    const res = await POST(req);

    expect(res.status).toBe(403);
    expect(prismaMock.notificationLog.updateMany).not.toHaveBeenCalled();
  });
});
