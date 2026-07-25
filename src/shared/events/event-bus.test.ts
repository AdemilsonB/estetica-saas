import { describe, it, expect, vi } from "vitest";

// O setup global de testes mocka `@/shared/events/event-bus`; aqui testamos a
// implementação real do bus, então desfazemos o mock só para este arquivo.
vi.unmock("@/shared/events/event-bus");

import { DomainEventBus } from "./event-bus";

// O event bus é tipado sobre a união DomainEvent; para testar o MECANISMO
// (rastrear promises e drenar com flush) usamos tipos arbitrários via cast.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyBus = () => new DomainEventBus() as any;

describe("DomainEventBus.flush", () => {
  it("dispara handlers de forma síncrona no publish (comportamento preservado)", () => {
    const bus = anyBus();
    const handler = vi.fn();
    bus.subscribe("evt", handler);

    bus.publish({ type: "evt", payload: { n: 1 } });

    expect(handler).toHaveBeenCalledWith({ n: 1 });
  });

  it("flush aguarda o término de handlers assíncronos", async () => {
    const bus = anyBus();
    let done = false;
    bus.subscribe("evt", async () => {
      await new Promise((r) => setTimeout(r, 10));
      done = true;
    });

    bus.publish({ type: "evt", payload: {} });
    // sem flush, o trabalho async ainda não terminou
    expect(done).toBe(false);

    await bus.flush();
    expect(done).toBe(true);
  });

  it("flush drena cascatas (handler que publica outro evento)", async () => {
    const bus = anyBus();
    let inner = false;

    bus.subscribe("outer", async () => {
      await new Promise((r) => setTimeout(r, 5));
      bus.publish({ type: "inner", payload: {} });
    });
    bus.subscribe("inner", async () => {
      await new Promise((r) => setTimeout(r, 5));
      inner = true;
    });

    bus.publish({ type: "outer", payload: {} });
    await bus.flush();

    expect(inner).toBe(true);
  });

  it("um handler que rejeita não quebra o flush nem os demais handlers", async () => {
    const bus = anyBus();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let siblingDone = false;

    bus.subscribe("evt", async () => {
      throw new Error("falha proposital");
    });
    bus.subscribe("evt", async () => {
      await new Promise((r) => setTimeout(r, 10));
      siblingDone = true;
    });

    bus.publish({ type: "evt", payload: {} });
    await expect(bus.flush()).resolves.toBeUndefined();
    expect(siblingDone).toBe(true);
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it("flush com nada pendente resolve imediatamente", async () => {
    const bus = anyBus();
    await expect(bus.flush()).resolves.toBeUndefined();
  });
});
