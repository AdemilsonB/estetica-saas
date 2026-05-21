import { EventEmitter } from "node:events";

import type { DomainEvent } from "./domain-events";

type EventType = DomainEvent["type"];
type EventPayload<TType extends EventType> = Extract<
  DomainEvent,
  { type: TType }
>["payload"];

export class DomainEventBus {
  private readonly emitter = new EventEmitter();

  publish<TType extends EventType>(event: Extract<DomainEvent, { type: TType }>) {
    this.emitter.emit(event.type, event.payload);
  }

  subscribe<TType extends EventType>(
    type: TType,
    handler: (payload: EventPayload<TType>) => Promise<void> | void,
  ) {
    this.emitter.on(type, (payload: EventPayload<TType>) => {
      void handler(payload);
    });
  }
}

export const eventBus = new DomainEventBus();
