import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/shared/database/prisma";
import { POST } from "./route";

const marcarPorTelefone = vi.fn().mockResolvedValue({ marcados: 1 });
const sendRawText = vi.fn().mockResolvedValue(undefined);

vi.mock("@/domains/crm/opt-out.service", () => ({
  optOutService: { marcarPorTelefone: (...a: unknown[]) => marcarPorTelefone(...a) },
}));

vi.mock("@/domains/notifications/providers/evolution.provider", () => ({
  evolutionProvider: { sendRawText: (...a: unknown[]) => sendRawText(...a) },
}));

vi.mock("@/shared/auth/evolution-webhook-token", () => ({
  isValidEvolutionWebhookToken: () => true,
}));

const prismaMock = prisma as unknown as {
  tenant: { findFirst: ReturnType<typeof vi.fn> };
  whatsAppAutoReplyLog: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

function requisicao(texto: string) {
  return new Request("https://app.test/api/webhooks/evolution/messages?token=x", {
    method: "POST",
    body: JSON.stringify({
      event: "messages.upsert",
      instance: "inst-1",
      data: {
        key: { remoteJid: "5511999990000@s.whatsapp.net", fromMe: false, id: "m1" },
        message: { conversation: texto },
      },
    }),
  });
}

function tenant(overrides: Record<string, unknown> = {}) {
  return {
    id: "t1",
    slug: "salao",
    timezone: "America/Sao_Paulo",
    businessHours: null,
    autoReplyEnabled: true,
    autoReplyIntervalHours: 6,
    autoReplyMessage: null,
    offHoursEnabled: false,
    offHoursMessage: null,
    evolutionInstanceId: "inst-1",
    autoReplyCancelMessage: null,
    autoReplyPriceIntro: null,
    autoReplyHoursIntro: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.tenant = { findFirst: vi.fn().mockResolvedValue(tenant()) };
  prismaMock.whatsAppAutoReplyLog = {
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
  };
});

describe("webhook do Evolution — opt-out", () => {
  it("processa PARE mesmo com autoReplyEnabled desligado", async () => {
    // REGRESSÃO: o gate de autoReplyEnabled ficava antes de tudo, então tenant
    // com auto-resposta desligada nunca processava descadastro. Falha de LGPD.
    prismaMock.tenant.findFirst.mockResolvedValue(tenant({ autoReplyEnabled: false }));

    await POST(requisicao("PARE"));

    expect(marcarPorTelefone).toHaveBeenCalledWith("t1", "5511999990000", "whatsapp_reply");
  });

  it("processa PARE mesmo dentro da janela de anti-flood", async () => {
    // REGRESSÃO: o throttle de autoReplyIntervalHours rodava antes da
    // classificação. Quem respondeu algo há 2 h tinha o descadastro engolido.
    prismaMock.whatsAppAutoReplyLog.findFirst.mockResolvedValue({ id: "log-recente" });

    await POST(requisicao("PARE"));

    expect(marcarPorTelefone).toHaveBeenCalledTimes(1);
  });

  it("confirma o descadastro ao cliente", async () => {
    await POST(requisicao("PARE"));

    expect(sendRawText).toHaveBeenCalledTimes(1);
    expect(sendRawText.mock.calls[0][2]).toMatch(/não receberá|nao recebera/i);
  });

  it("não deixa o opt-out cair no chatbot depois", async () => {
    await POST(requisicao("PARE"));

    // Uma resposta só: a confirmação do descadastro. Nunca também a de agendar.
    expect(sendRawText).toHaveBeenCalledTimes(1);
    expect(prismaMock.whatsAppAutoReplyLog.create).not.toHaveBeenCalled();
  });

  it("mensagem comum segue para o chatbot normalmente", async () => {
    await POST(requisicao("quero agendar"));

    expect(marcarPorTelefone).not.toHaveBeenCalled();
    expect(prismaMock.whatsAppAutoReplyLog.create).toHaveBeenCalledTimes(1);
  });
});
