import { describe, it, expect, beforeEach, vi } from "vitest";
import { customerMessageDispatcher } from "./customer-message-dispatcher.service";
import { customerMessageSettingService } from "./customer-message-setting.service";

const logAndDispatch = vi.fn();

vi.mock("../notification.service", () => ({
  notificationService: { logAndDispatch: (...args: unknown[]) => logAndDispatch(...args) },
}));

vi.mock("./customer-message-setting.service", () => ({
  customerMessageSettingService: { resolve: vi.fn(), shouldNotify: vi.fn() },
}));

const settings = vi.mocked(customerMessageSettingService);

function ligado(channels: ("WHATSAPP" | "EMAIL")[] = ["WHATSAPP"]) {
  settings.shouldNotify.mockResolvedValue(true);
  settings.resolve.mockResolvedValue({
    event: "appointment_created",
    label: "Agendamento criado",
    description: "",
    nature: "transactional",
    enabled: true,
    channels,
    isCustom: false,
  });
}

describe("customerMessageDispatcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logAndDispatch.mockResolvedValue({ id: "log-1" });
  });

  it("envia por WhatsApp com a chave de log correta do evento", async () => {
    ligado();

    const resultado = await customerMessageDispatcher.dispatch({
      tenantId: "t1",
      event: "appointment_created",
      appointmentId: "a1",
      customerId: "c1",
      recipient: { phone: "11999990000" },
      payload: { customerName: "Maria" },
    });

    expect(resultado.dispatched).toEqual(["WHATSAPP"]);
    expect(logAndDispatch).toHaveBeenCalledTimes(1);
    expect(logAndDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t1",
        channel: "WHATSAPP",
        template: "appointment-created",
        recipient: "11999990000",
      }),
    );
  });

  it("não envia nada quando o padrão do tenant está desligado", async () => {
    settings.shouldNotify.mockResolvedValue(false);

    const resultado = await customerMessageDispatcher.dispatch({
      tenantId: "t1",
      event: "appointment_created",
      recipient: { phone: "11999990000" },
      payload: {},
    });

    expect(resultado).toEqual({ dispatched: [], skipReason: "desligado" });
    expect(logAndDispatch).not.toHaveBeenCalled();
    // Nem chega a resolver canais quando já sabe que não envia.
    expect(settings.resolve).not.toHaveBeenCalled();
  });

  it("repassa o override ao service — a decisão é do service, não do chamador", async () => {
    settings.shouldNotify.mockResolvedValue(false);

    await customerMessageDispatcher.dispatch({
      tenantId: "t1",
      event: "appointment_created",
      notifyOverride: false,
      recipient: { phone: "11999990000" },
      payload: {},
    });

    expect(settings.shouldNotify).toHaveBeenCalledWith("t1", "appointment_created", false);
  });

  it("pula o canal sem destinatário e reporta quando nenhum canal tem para onde enviar", async () => {
    ligado(["WHATSAPP", "EMAIL"]);

    const resultado = await customerMessageDispatcher.dispatch({
      tenantId: "t1",
      event: "appointment_created",
      recipient: { phone: null, email: null },
      payload: {},
    });

    expect(resultado).toEqual({ dispatched: [], skipReason: "sem-destinatario" });
    expect(logAndDispatch).not.toHaveBeenCalled();
  });

  it("envia nos dois canais quando os dois estão ligados e há destinatário", async () => {
    ligado(["WHATSAPP", "EMAIL"]);

    const resultado = await customerMessageDispatcher.dispatch({
      tenantId: "t1",
      event: "appointment_created",
      recipient: { phone: "11999990000", email: "maria@exemplo.com" },
      payload: {},
    });

    expect(resultado.dispatched).toEqual(["WHATSAPP", "EMAIL"]);
    expect(logAndDispatch).toHaveBeenCalledTimes(2);
  });

  it("a mensagem pontual entra no payload como `message`, que tem precedência sobre o template", async () => {
    ligado();

    await customerMessageDispatcher.dispatch({
      tenantId: "t1",
      event: "appointment_cancelled",
      recipient: { phone: "11999990000" },
      message: "Oi Maria, precisei cancelar hoje.",
      payload: { customerName: "Maria" },
    });

    expect(logAndDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ message: "Oi Maria, precisei cancelar hoje." }),
      }),
    );
  });

  it("não deixa escapar exceção de shouldNotify/resolve — devolve resultado vazio", async () => {
    settings.shouldNotify.mockRejectedValue(new Error("banco fora do ar"));

    const resultado = await customerMessageDispatcher.dispatch({
      tenantId: "t1",
      event: "appointment_created",
      recipient: { phone: "11999990000" },
      payload: {},
    });

    expect(resultado).toEqual({ dispatched: [], skipReason: null });
    expect(logAndDispatch).not.toHaveBeenCalled();
  });

  it("uma falha num canal não impede o outro, e nada escapa do dispatch", async () => {
    ligado(["WHATSAPP", "EMAIL"]);
    logAndDispatch.mockRejectedValueOnce(new Error("provedor fora do ar"));

    const resultado = await customerMessageDispatcher.dispatch({
      tenantId: "t1",
      event: "appointment_created",
      recipient: { phone: "11999990000", email: "maria@exemplo.com" },
      payload: {},
    });

    expect(resultado.dispatched).toEqual(["EMAIL"]);
  });
});
