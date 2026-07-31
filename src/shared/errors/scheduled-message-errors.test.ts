import { describe, it, expect } from "vitest";

import {
  DomainError,
  ScheduledMessageInPastError,
  ScheduledMessageNotEditableError,
  ScheduledMessageNotFoundError,
} from "./domain-error";

describe("erros de mensagem agendada", () => {
  it("ScheduledMessageNotFoundError é 404 com código próprio", () => {
    const erro = new ScheduledMessageNotFoundError();
    expect(erro).toBeInstanceOf(DomainError);
    expect(erro.statusCode).toBe(404);
    expect(erro.code).toBe("SCHEDULED_MESSAGE_NOT_FOUND");
  });

  it("ScheduledMessageNotEditableError é 409 e diz qual status travou a edição", () => {
    const erro = new ScheduledMessageNotEditableError("SENT");
    expect(erro.statusCode).toBe(409);
    expect(erro.code).toBe("SCHEDULED_MESSAGE_NOT_EDITABLE");
    expect(erro.details).toEqual({ status: "SENT" });
    expect(erro.message).toContain("ja foi enviada");
  });

  it("ScheduledMessageInPastError é 422 — validação de negócio, não de formato", () => {
    const erro = new ScheduledMessageInPastError();
    expect(erro.statusCode).toBe(422);
    expect(erro.code).toBe("SCHEDULED_MESSAGE_IN_PAST");
  });
});
