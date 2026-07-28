import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/app/api/_lib/runtime", () => ({ initializeDomainRuntime: vi.fn() }));
vi.mock("@/shared/auth/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/domains/notifications/customer-messages/customer-message-setting.service", () => ({
  customerMessageSettingService: { resolveAll: vi.fn(), save: vi.fn() },
}));

import { getSessionContext } from "@/shared/auth/session";
import { customerMessageSettingService } from "@/domains/notifications/customer-messages/customer-message-setting.service";
import { GET, PUT } from "./route";

const session = vi.mocked(getSessionContext);
const service = vi.mocked(customerMessageSettingService);

const resolvido = {
  event: "birthday" as const,
  label: "Aniversário",
  description: "",
  nature: "promotional" as const,
  enabled: false,
  channels: ["WHATSAPP" as const],
  isCustom: true,
};

function sessaoDono() {
  session.mockResolvedValue({
    tenantId: "tenant-1",
    userId: "user-1",
    isOwner: true,
    permissions: {},
  } as unknown as Awaited<ReturnType<typeof getSessionContext>>);
}

describe("/api/notifications/customer-messages/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessaoDono();
  });

  it("GET devolve a matriz do tenant da sessão", async () => {
    service.resolveAll.mockResolvedValue([resolvido]);

    const res = await GET(new Request("http://localhost/api/notifications/customer-messages/settings"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(service.resolveAll).toHaveBeenCalledWith("tenant-1");
    expect(body.items).toHaveLength(1);
  });

  it("PUT salva usando o tenantId da sessão, ignorando qualquer tenantId do body", async () => {
    service.save.mockResolvedValue(resolvido);

    const res = await PUT(
      new Request("http://localhost/api/notifications/customer-messages/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: "tenant-INVASOR",
          event: "birthday",
          enabled: false,
          channels: ["WHATSAPP"],
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(service.save).toHaveBeenCalledWith("tenant-1", {
      event: "birthday",
      enabled: false,
      channels: ["WHATSAPP"],
    });
  });

  it("PUT rejeita evento fora do enum", async () => {
    const res = await PUT(
      new Request("http://localhost/api/notifications/customer-messages/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "evento_inventado", enabled: true, channels: [] }),
      }),
    );

    expect(res.status).toBe(422);
    expect(service.save).not.toHaveBeenCalled();
  });
});
