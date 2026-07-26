import { describe, it, expect, beforeEach, vi } from "vitest";
import { customerMessageService } from "./customer-message.service";
import { customerMessageTemplateRepository } from "./customer-message-template.repository";
import { getCatalogEntry } from "./customer-message-catalog";

vi.mock("./customer-message-template.repository", () => ({
  customerMessageTemplateRepository: { findByEvent: vi.fn() },
}));

const repo = vi.mocked(customerMessageTemplateRepository);

const tenant = {
  name: "Salão da Lu",
  slug: "salao-da-lu",
  timezone: "America/Sao_Paulo",
  phone: "(11) 99999-0000",
  address: "Rua X, 123",
};

describe("customerMessageService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("usa o padrão do catálogo quando o tenant não personalizou", async () => {
    repo.findByEvent.mockResolvedValue(null);

    const resolvido = await customerMessageService.resolveTemplate(
      "tenant-1",
      "appointment_created",
      "WHATSAPP",
    );

    expect(resolvido.isCustom).toBe(false);
    expect(resolvido.body).toBe(getCatalogEntry("appointment_created").defaults.WHATSAPP.body);
  });

  it("a personalização do tenant sobrescreve o padrão", async () => {
    repo.findByEvent.mockResolvedValue({
      subject: null,
      body: "Oi {{primeiro_nome}}, tudo certo!",
      mediaUrl: null,
    } as never);

    const resolvido = await customerMessageService.resolveTemplate(
      "tenant-1",
      "appointment_created",
      "WHATSAPP",
    );

    expect(resolvido.isCustom).toBe(true);
    expect(resolvido.body).toBe("Oi {{primeiro_nome}}, tudo certo!");
  });

  it("renderiza interpolando as variáveis do contexto", async () => {
    repo.findByEvent.mockResolvedValue({
      subject: null,
      body: "Oi {{primeiro_nome}}! {{servico}} em {{data}} às {{hora}}.",
      mediaUrl: null,
    } as never);

    const render = await customerMessageService.render(
      "tenant-1",
      "appointment_created",
      "WHATSAPP",
      {
        customerName: "Maria Silva",
        serviceName: "Escova",
        startsAt: new Date("2026-08-02T17:00:00.000Z"),
        tenant,
      },
    );

    expect(render.text).toBe("Oi Maria! Escova em 02/08/2026 às 14:00.");
    expect(render.subject).toBeNull();
  });

  it("variável desconhecida vira string vazia e não quebra o envio", async () => {
    repo.findByEvent.mockResolvedValue({
      subject: null,
      body: "Oi {{cliente}}, {{variavel_inexistente}}fim",
      mediaUrl: null,
    } as never);

    const render = await customerMessageService.render(
      "tenant-1",
      "appointment_created",
      "WHATSAPP",
      { customerName: "Maria", tenant },
    );

    expect(render.text).toBe("Oi Maria, fim");
  });

  it("escapa HTML no canal EMAIL e não escapa no WHATSAPP", async () => {
    repo.findByEvent.mockResolvedValue({
      subject: "Oi {{cliente}}",
      body: "Olá {{cliente}}",
      mediaUrl: null,
    } as never);

    const email = await customerMessageService.render("t", "appointment_created", "EMAIL", {
      customerName: "Maria <script>",
      tenant,
    });
    expect(email.text).toContain("&lt;script&gt;");
    expect(email.subject).toContain("&lt;script&gt;");

    const whats = await customerMessageService.render("t", "appointment_created", "WHATSAPP", {
      customerName: "Maria <script>",
      tenant,
    });
    expect(whats.text).toContain("<script>");
  });

  it("propaga a mediaUrl da personalização", async () => {
    repo.findByEvent.mockResolvedValue({
      subject: null,
      body: "Oi",
      mediaUrl: "https://cdn.exemplo/banner.png",
    } as never);

    const render = await customerMessageService.render("t", "birthday", "WHATSAPP", {
      customerName: "Maria",
      tenant,
    });

    expect(render.mediaUrl).toBe("https://cdn.exemplo/banner.png");
  });
});
