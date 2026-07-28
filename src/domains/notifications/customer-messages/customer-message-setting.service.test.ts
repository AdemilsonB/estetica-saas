import { describe, it, expect, beforeEach, vi } from "vitest";
import { customerMessageSettingService } from "./customer-message-setting.service";
import { customerMessageSettingRepository } from "./customer-message-setting.repository";

vi.mock("./customer-message-setting.repository", () => ({
  customerMessageSettingRepository: {
    findByEvent: vi.fn(),
    listByTenant: vi.fn(),
    upsert: vi.fn(),
  },
}));

const repo = vi.mocked(customerMessageSettingRepository);

describe("customerMessageSettingService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sem registro no banco, o evento vem ligado no WhatsApp (padrão do catálogo)", async () => {
    repo.findByEvent.mockResolvedValue(null);

    const resolvido = await customerMessageSettingService.resolve("t1", "appointment_created");

    expect(resolvido.enabled).toBe(true);
    expect(resolvido.channels).toEqual(["WHATSAPP"]);
    expect(resolvido.isCustom).toBe(false);
    expect(resolvido.label).toBe("Agendamento criado");
  });

  it("o registro do tenant sobrescreve o padrão", async () => {
    repo.findByEvent.mockResolvedValue({
      id: "c1",
      tenantId: "t1",
      event: "appointment_no_show",
      enabled: false,
      channels: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const resolvido = await customerMessageSettingService.resolve("t1", "appointment_no_show");

    expect(resolvido.enabled).toBe(false);
    expect(resolvido.channels).toEqual([]);
    expect(resolvido.isCustom).toBe(true);
  });

  it("resolveAll devolve os 10 eventos mesmo com o banco vazio, no padrão do catálogo", async () => {
    repo.listByTenant.mockResolvedValue([]);

    const todos = await customerMessageSettingService.resolveAll("t1");

    expect(todos).toHaveLength(10);
    // Transacional nasce ligado; promocional nasce desligado (opt-in por LGPD,
    // decisão registrada nas Global Constraints). Nunca asserir `true` para os 10.
    for (const item of todos) {
      expect(item.enabled).toBe(item.nature === "transactional");
    }
    expect(todos.filter((e) => e.enabled)).toHaveLength(7);
  });

  it("shouldNotify sem override usa o padrão do tenant", async () => {
    repo.findByEvent.mockResolvedValue(null);
    await expect(
      customerMessageSettingService.shouldNotify("t1", "appointment_created"),
    ).resolves.toBe(true);
  });

  it("shouldNotify com override false não envia, mesmo com o padrão ligado", async () => {
    repo.findByEvent.mockResolvedValue(null);
    await expect(
      customerMessageSettingService.shouldNotify("t1", "appointment_created", false),
    ).resolves.toBe(false);
  });

  it("shouldNotify com override true envia, mesmo com o padrão desligado", async () => {
    repo.findByEvent.mockResolvedValue({
      id: "c1",
      tenantId: "t1",
      event: "appointment_created",
      enabled: false,
      channels: ["WHATSAPP"],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      customerMessageSettingService.shouldNotify("t1", "appointment_created", true),
    ).resolves.toBe(true);

    // E o override true não deve consultar o banco à toa.
    expect(repo.findByEvent).not.toHaveBeenCalled();
  });

  it("save persiste com o tenantId recebido e devolve o estado resolvido", async () => {
    repo.upsert.mockResolvedValue({
      id: "c1",
      tenantId: "t1",
      event: "birthday",
      enabled: false,
      channels: ["WHATSAPP"],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const salvo = await customerMessageSettingService.save("t1", {
      event: "birthday",
      enabled: false,
      channels: ["WHATSAPP"],
    });

    expect(repo.upsert).toHaveBeenCalledWith("t1", {
      event: "birthday",
      enabled: false,
      channels: ["WHATSAPP"],
    });
    expect(salvo.enabled).toBe(false);
    expect(salvo.isCustom).toBe(true);
  });
});
