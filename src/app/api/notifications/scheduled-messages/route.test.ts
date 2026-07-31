import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/app/api/_lib/runtime", () => ({ initializeDomainRuntime: vi.fn() }));
vi.mock("@/shared/auth/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/domains/notifications/scheduled-messages/scheduled-message.service", () => ({
  scheduledMessageService: { list: vi.fn(), create: vi.fn() },
}));

import { getSessionContext } from "@/shared/auth/session";
import { scheduledMessageService } from "@/domains/notifications/scheduled-messages/scheduled-message.service";

import { GET, POST } from "./route";

const session = vi.mocked(getSessionContext);
const service = vi.mocked(scheduledMessageService);

function sessaoCom(permissions: Record<string, string[]>) {
  session.mockResolvedValue({
    tenantId: "tenant-1",
    userId: "user-1",
    isOwner: false,
    permissions,
  } as unknown as Awaited<ReturnType<typeof getSessionContext>>);
}

const PODE_TUDO = { clientes: ["view", "create", "edit", "delete"] };

describe("/api/notifications/scheduled-messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessaoCom(PODE_TUDO);
  });

  it("GET lista as mensagens do cliente no tenant da sessão", async () => {
    service.list.mockResolvedValue([] as never);

    const res = await GET(
      new Request("http://localhost/api/notifications/scheduled-messages?customerId=cli-1"),
    );

    expect(res.status).toBe(200);
    expect(service.list).toHaveBeenCalledWith("tenant-1", "cli-1");
  });

  it("GET sem customerId é 422, não uma listagem do tenant inteiro", async () => {
    const res = await GET(new Request("http://localhost/api/notifications/scheduled-messages"));

    expect(res.status).toBe(422);
    expect(service.list).not.toHaveBeenCalled();
  });

  it("GET exige clientes:view", async () => {
    sessaoCom({ clientes: [] });

    const res = await GET(
      new Request("http://localhost/api/notifications/scheduled-messages?customerId=cli-1"),
    );

    expect(res.status).toBe(403);
    expect(service.list).not.toHaveBeenCalled();
  });

  it("POST cria usando tenantId e userId da sessão, ignorando o que vier no body", async () => {
    service.create.mockResolvedValue({ id: "sm-1" } as never);

    const res = await POST(
      new Request("http://localhost/api/notifications/scheduled-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: "tenant-INVASOR",
          createdByUserId: "user-INVASOR",
          customerId: "cli-1",
          body: "Oi Maria",
          date: "2099-01-01",
          time: "09:00",
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(service.create).toHaveBeenCalledWith("tenant-1", "user-1", {
      customerId: "cli-1",
      body: "Oi Maria",
      date: "2099-01-01",
      time: "09:00",
    });
  });

  it("POST exige clientes:edit — ver cliente não basta para mandar mensagem", async () => {
    sessaoCom({ clientes: ["view"] });

    const res = await POST(
      new Request("http://localhost/api/notifications/scheduled-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: "cli-1",
          body: "Oi",
          date: "2099-01-01",
          time: "09:00",
        }),
      }),
    );

    expect(res.status).toBe(403);
    expect(service.create).not.toHaveBeenCalled();
  });

  it("POST rejeita horário fora do formato HH:mm", async () => {
    const res = await POST(
      new Request("http://localhost/api/notifications/scheduled-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: "cli-1",
          body: "Oi",
          date: "2099-01-01",
          time: "25:99",
        }),
      }),
    );

    expect(res.status).toBe(422);
    expect(service.create).not.toHaveBeenCalled();
  });

  it("POST rejeita corpo vazio", async () => {
    const res = await POST(
      new Request("http://localhost/api/notifications/scheduled-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: "cli-1",
          body: "   ",
          date: "2099-01-01",
          time: "09:00",
        }),
      }),
    );

    expect(res.status).toBe(422);
  });
});
