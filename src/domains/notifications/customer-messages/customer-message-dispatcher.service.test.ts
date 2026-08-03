import { describe, it, expect, beforeEach, vi } from "vitest";
import { customerMessageDispatcher } from "./customer-message-dispatcher.service";
import { customerMessageConsentRepository } from "./customer-message-consent.repository";
import { customerMessageSettingService } from "./customer-message-setting.service";

const logAndDispatch = vi.fn();

vi.mock("../notification.service", () => ({
  notificationService: { logAndDispatch: (...args: unknown[]) => logAndDispatch(...args) },
}));

vi.mock("./customer-message-setting.service", () => ({
  customerMessageSettingService: { resolve: vi.fn(), shouldNotify: vi.fn() },
}));

vi.mock("./customer-message-consent.repository", () => ({
  customerMessageConsentRepository: { carregarSnapshot: vi.fn() },
}));

const settings = vi.mocked(customerMessageSettingService);
const snapshot = vi.mocked(customerMessageConsentRepository).carregarSnapshot;

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

/** Igual ao helper `ligado()`, mas com o evento certo — a guarda lê a natureza dele. */
function ligadoPara(event: string, channels: ("WHATSAPP" | "EMAIL")[] = ["WHATSAPP"]) {
  settings.shouldNotify.mockResolvedValue(true);
  settings.resolve.mockResolvedValue({
    event,
    label: "",
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
    logAndDispatch.mockResolvedValue({ id: "log-1", status: "SENT", errorMessage: null });
    snapshot.mockResolvedValue({
      consentGiven: true,
      marketingOptOut: false,
      promocionaisNaSemana: 0,
    });
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

    expect(resultado).toEqual({ dispatched: [], skipReason: "desligado", logs: [] });
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

    expect(resultado).toEqual({ dispatched: [], skipReason: "sem-destinatario", logs: [] });
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

    expect(resultado).toEqual({ dispatched: [], skipReason: null, logs: [] });
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

  it("devolve o log criado por canal, com id e status — é assim que o chamador sabe se saiu", async () => {
    ligado();
    logAndDispatch.mockResolvedValue({ id: "log-42", status: "SENT", errorMessage: null });

    const resultado = await customerMessageDispatcher.dispatch({
      tenantId: "t1",
      event: "appointment_created",
      recipient: { phone: "11999990000" },
      payload: {},
    });

    expect(resultado.logs).toEqual([
      { channel: "WHATSAPP", notificationLogId: "log-42", status: "SENT", errorMessage: null },
    ]);
  });

  it("log FAILED vem com o motivo real preservado — é o que a profissional vai ler", async () => {
    ligado();
    logAndDispatch.mockResolvedValue({
      id: "log-43",
      status: "FAILED",
      errorMessage: "Limite mensal de WhatsApp atingido.",
    });

    const resultado = await customerMessageDispatcher.dispatch({
      tenantId: "t1",
      event: "appointment_created",
      recipient: { phone: "11999990000" },
      payload: {},
    });

    expect(resultado.logs).toEqual([
      {
        channel: "WHATSAPP",
        notificationLogId: "log-43",
        status: "FAILED",
        errorMessage: "Limite mensal de WhatsApp atingido.",
      },
    ]);
  });

  it("modo direto não consulta o liga/desliga por evento — quem escreveu já decidiu enviar", async () => {
    logAndDispatch.mockResolvedValue({ id: "log-1", status: "SENT", errorMessage: null });

    const resultado = await customerMessageDispatcher.dispatch({
      kind: "direct",
      tenantId: "t1",
      customerId: "c1",
      channels: ["WHATSAPP"],
      message: "Oi Maria, lembrete do seu horário.",
      templateKey: "scheduled-message",
      recipient: { phone: "11999990000" },
      payload: { customerName: "Maria" },
    });

    expect(settings.shouldNotify).not.toHaveBeenCalled();
    expect(settings.resolve).not.toHaveBeenCalled();
    expect(resultado.dispatched).toEqual(["WHATSAPP"]);
  });

  it("modo direto manda o texto livre como `message` e a chave de log informada", async () => {
    logAndDispatch.mockResolvedValue({ id: "log-1", status: "SENT", errorMessage: null });

    await customerMessageDispatcher.dispatch({
      kind: "direct",
      tenantId: "t1",
      customerId: "c1",
      channels: ["WHATSAPP"],
      message: "Texto escrito pela profissional",
      templateKey: "scheduled-message",
      recipient: { phone: "11999990000" },
      payload: { customerName: "Maria" },
    });

    expect(logAndDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "scheduled-message",
        payload: expect.objectContaining({ message: "Texto escrito pela profissional" }),
      }),
    );
  });

  it("modo direto sem destinatário no canal não envia e reporta o motivo", async () => {
    const resultado = await customerMessageDispatcher.dispatch({
      kind: "direct",
      tenantId: "t1",
      customerId: "c1",
      channels: ["WHATSAPP"],
      message: "Texto",
      templateKey: "scheduled-message",
      recipient: { phone: null },
      payload: {},
    });

    expect(resultado).toEqual({ dispatched: [], skipReason: "sem-destinatario", logs: [] });
    expect(logAndDispatch).not.toHaveBeenCalled();
  });

  describe("guarda de consentimento", () => {
    it("bloqueia promocional sem consentimento e não chama o transporte", async () => {
      ligadoPara("birthday");
      snapshot.mockResolvedValue({
        consentGiven: false,
        marketingOptOut: false,
        promocionaisNaSemana: 0,
      });

      const resultado = await customerMessageDispatcher.dispatch({
        tenantId: "t1",
        event: "birthday",
        customerId: "c1",
        recipient: { phone: "11999990000" },
        payload: {},
      });

      expect(resultado.skipReason).toBe("sem-consentimento");
      expect(resultado.dispatched).toEqual([]);
      expect(logAndDispatch).not.toHaveBeenCalled();
    });

    it("envia transacional mesmo com opt-out ativo", async () => {
      ligadoPara("appointment_reminder");
      snapshot.mockResolvedValue({
        consentGiven: false,
        marketingOptOut: true,
        promocionaisNaSemana: 99,
      });

      const resultado = await customerMessageDispatcher.dispatch({
        tenantId: "t1",
        event: "appointment_reminder",
        customerId: "c1",
        recipient: { phone: "11999990000" },
        payload: {},
      });

      expect(resultado.dispatched).toEqual(["WHATSAPP"]);
      expect(logAndDispatch).toHaveBeenCalledTimes(1);
    });

    it("não consulta a guarda quando o envio é `direct`", async () => {
      // Mensagem agendada um-a-um (ADR-019): quem escreveu o texto e marcou a hora
      // já decidiu enviar, e é individual, não disparo em massa.
      const resultado = await customerMessageDispatcher.dispatch({
        kind: "direct",
        tenantId: "t1",
        customerId: "c1",
        channels: ["WHATSAPP"],
        message: "Oi!",
        templateKey: "scheduled-message",
        recipient: { phone: "11999990000" },
        payload: {},
      });

      expect(resultado.dispatched).toEqual(["WHATSAPP"]);
      expect(snapshot).not.toHaveBeenCalled();
    });

    it("envia promocional quando o cliente não pôde ser carregado", async () => {
      // Falha de leitura não pode virar silêncio. O evento já passou pelo
      // liga/desliga do tenant; bloquear aqui perderia a mensagem sem rastro.
      snapshot.mockResolvedValue(null);
      ligadoPara("birthday");

      const resultado = await customerMessageDispatcher.dispatch({
        tenantId: "t1",
        event: "birthday",
        customerId: "c1",
        recipient: { phone: "11999990000" },
        payload: {},
      });

      expect(resultado.dispatched).toEqual(["WHATSAPP"]);
    });

    it("não consulta a guarda quando não há customerId", async () => {
      ligadoPara("appointment_created");

      await customerMessageDispatcher.dispatch({
        tenantId: "t1",
        event: "appointment_created",
        recipient: { phone: "11999990000" },
        payload: {},
      });

      expect(snapshot).not.toHaveBeenCalled();
    });
  });
});
