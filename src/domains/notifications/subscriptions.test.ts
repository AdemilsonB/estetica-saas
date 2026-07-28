import { describe, it, expect, beforeEach, vi } from "vitest";

const dispatch = vi.fn();

vi.mock("./customer-messages/customer-message-dispatcher.service", () => ({
  customerMessageDispatcher: { dispatch: (...args: unknown[]) => dispatch(...args) },
}));

type Handler = (payload: never) => Promise<void>;

const handlers = new Map<string, Handler>();

// Duas armadilhas aqui, ambas já custaram tempo:
//
// 1. `subscriptions.ts` tem um guard de módulo (`notificationsRegistered`) que faz a
//    segunda chamada de registerNotificationSubscriptions() virar no-op. Sem
//    `vi.resetModules()`, só o PRIMEIRO caso teria handlers e todos os outros
//    quebrariam com "handlers.get(...) is not a function".
// 2. Depois de `resetModules`, o mock de `@/shared/events/event-bus` é reconstruído.
//    Um `import { eventBus }` estático no topo deste arquivo apontaria para a instância
//    ANTIGA, e a mockImplementation não valeria para o módulo recém-importado. Por isso
//    o eventBus também é importado dentro do beforeEach, depois do reset.
beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  handlers.clear();

  const { eventBus } = await import("@/shared/events/event-bus");
  vi.mocked(eventBus.subscribe).mockImplementation(((tipo: string, handler: Handler) => {
    handlers.set(tipo, handler);
  }) as unknown as typeof eventBus.subscribe);

  const { registerNotificationSubscriptions } = await import("./subscriptions");
  registerNotificationSubscriptions();
});

function agendamento(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: "t1",
    appointment: {
      id: "a1",
      status: "SCHEDULED",
      startsAt: new Date("2026-08-02T17:00:00.000Z"),
      origin: "PANEL",
    },
    customer: { id: "c1", name: "Maria Silva", phone: "11999990000", email: "maria@ex.com" },
    service: { id: "s1", name: "Escova", duration: 45 },
    professional: { id: "p1", name: "Ana Souza", email: "ana@ex.com" },
    ...overrides,
  } as never;
}

describe("registerNotificationSubscriptions", () => {
  it("agendamento do painel dispara appointment_created", async () => {
    await handlers.get("scheduling.appointment.created")!(agendamento({ origin: "panel" }));

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ event: "appointment_created", tenantId: "t1" }),
    );
  });

  it("agendamento da vitrine dispara appointment_requested, não appointment_created", async () => {
    await handlers.get("scheduling.appointment.created")!(agendamento({ origin: "public" }));

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ event: "appointment_requested" }),
    );
  });

  it("leva o nome do profissional para o template", async () => {
    await handlers.get("scheduling.appointment.created")!(agendamento({ origin: "panel" }));

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ professionalName: "Ana Souza" }),
      }),
    );
  });

  it("o notify da ação é repassado como override, não interpretado aqui", async () => {
    await handlers.get("scheduling.appointment.created")!(
      agendamento({ origin: "panel", notify: false }),
    );

    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ notifyOverride: false }));
  });

  it("confirmação de agendamento do painel não manda segunda mensagem", async () => {
    await handlers.get("scheduling.appointment.confirmed")!(agendamento());

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("confirmação de pedido nascido online manda appointment_confirmed", async () => {
    await handlers.get("scheduling.appointment.confirmed")!(
      agendamento({
        appointment: { id: "a1", status: "CONFIRMED", startsAt: new Date(), origin: "PUBLIC" },
      }),
    );

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ event: "appointment_confirmed" }),
    );
  });

  it("confirmação do painel com notify explícito ainda avisa o cliente", async () => {
    await handlers.get("scheduling.appointment.confirmed")!(agendamento({ notify: true }));

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ event: "appointment_confirmed", notifyOverride: true }),
    );
  });

  it("cancelamento repassa a mensagem pontual escrita na hora", async () => {
    await handlers.get("scheduling.appointment.cancelled")!(
      agendamento({ notificationMessage: "Precisei cancelar, me desculpe." }),
    );

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "appointment_cancelled",
        message: "Precisei cancelar, me desculpe.",
      }),
    );
  });

  it("no-show dispara o evento correspondente com o override da ação", async () => {
    await handlers.get("scheduling.appointment.no_show")!(agendamento({ notify: false }));

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ event: "appointment_no_show", notifyOverride: false }),
    );
  });

  it("remarcação de cliente sem telefone ainda oferece o e-mail ao dispatcher", async () => {
    await handlers.get("scheduling.appointment.rescheduled")!({
      tenantId: "t1",
      appointmentId: "a1",
      customerId: "c1",
      customerName: "Maria Silva",
      customerPhone: null,
      customerEmail: "maria@ex.com",
      serviceName: "Escova",
      professionalName: "Ana Souza",
      oldStartsAt: new Date("2026-08-01T17:00:00.000Z"),
      newStartsAt: new Date("2026-08-03T18:00:00.000Z"),
      newEndsAt: new Date("2026-08-03T18:45:00.000Z"),
      notificationMessage: "",
    } as never);

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "appointment_rescheduled",
        recipient: { phone: null, email: "maria@ex.com" },
      }),
    );
  });
});
