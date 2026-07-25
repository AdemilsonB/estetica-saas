import { EventEmitter } from "node:events";

import type { DomainEvent } from "./domain-events";

type EventType = DomainEvent["type"];
type EventPayload<TType extends EventType> = Extract<
  DomainEvent,
  { type: TType }
>["payload"];

export class DomainEventBus {
  private readonly emitter = new EventEmitter();

  // Handlers rodam de forma "fire-and-forget" a partir do publish (síncrono).
  // Em ambiente serverless (Vercel), a função é congelada assim que a rota
  // retorna a resposta — e uma promise de handler ainda pendente (ex.: enviar
  // WhatsApp via Evolution + gravar NotificationLog) NUNCA termina: a mensagem
  // não sai e nada é logado. Para resolver, rastreamos as promises em andamento
  // e expomos `flush()`, que a rota aguarda (via `after()`) antes de a função
  // ser encerrada, garantindo que todo efeito colateral de evento se complete.
  private readonly pending = new Set<Promise<unknown>>();

  publish<TType extends EventType>(event: Extract<DomainEvent, { type: TType }>) {
    this.emitter.emit(event.type, event.payload);
  }

  subscribe<TType extends EventType>(
    type: TType,
    handler: (payload: EventPayload<TType>) => Promise<void> | void,
  ) {
    this.emitter.on(type, (payload: EventPayload<TType>) => {
      let result: Promise<void> | void;
      try {
        result = handler(payload);
      } catch (err) {
        console.error(`[event-bus] handler síncrono de "${type}" falhou:`, err);
        return;
      }

      if (result && typeof (result as Promise<void>).then === "function") {
        // Nunca deixamos a promise rejeitar sem tratamento: um handler que
        // falha não pode derrubar o flush nem os demais handlers do evento.
        const tracked = Promise.resolve(result).catch((err) => {
          console.error(`[event-bus] handler de "${type}" falhou:`, err);
        });
        this.pending.add(tracked);
        // Auto-limpeza para o caso long-running (dev): sem flush, o set não cresce.
        void tracked.finally(() => this.pending.delete(tracked));
      }
    });
  }

  /**
   * Aguarda todos os handlers assíncronos em andamento terminarem, drenando
   * também cascatas (handlers que publicam novos eventos durante a execução).
   * Chamada pelas rotas (via `after()`) para não congelar a função antes de os
   * efeitos colaterais de evento concluírem em serverless.
   */
  async flush(): Promise<void> {
    while (this.pending.size > 0) {
      const batch = [...this.pending];
      await Promise.allSettled(batch);
      for (const p of batch) this.pending.delete(p);
    }
  }
}

export const eventBus = new DomainEventBus();
