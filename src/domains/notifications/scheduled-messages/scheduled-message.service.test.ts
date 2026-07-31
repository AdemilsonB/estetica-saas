import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("./scheduled-message.repository", () => ({
  scheduledMessageRepository: {
    findTenantContext: vi.fn(),
    findCustomerForMessage: vi.fn(),
    create: vi.fn(),
    listByCustomer: vi.fn(),

    findById: vi.fn(),
    update: vi.fn(),
    cancel: vi.fn(),
    findDue: vi.fn(),
    claim: vi.fn(),
    markSent: vi.fn(),
    markFailed: vi.fn(),
    expireStuck: vi.fn(),
  },
}));

vi.mock("../customer-messages/customer-message-dispatcher.service", () => ({
  customerMessageDispatcher: { dispatch: vi.fn() },
}));

import {
  ScheduledMessageInPastError,
  ScheduledMessageNotEditableError,
  ScheduledMessageNotFoundError,
  CustomerNotFoundError,
  ValidationError,
} from "@/shared/errors";

import { customerMessageDispatcher } from "../customer-messages/customer-message-dispatcher.service";

import { scheduledMessageRepository } from "./scheduled-message.repository";
import { scheduledMessageService } from "./scheduled-message.service";

const repo = vi.mocked(scheduledMessageRepository);
const dispatcher = vi.mocked(customerMessageDispatcher);

const TENANT = {
  name: "Studio Bela",
  slug: "studio-bela",
  timezone: "America/Sao_Paulo",
  phone: "1133334444",
  address: "Rua A, 100",
};

const CLIENTE = { id: "cli-1", name: "Maria Silva", phone: "11999990000" };

describe("scheduledMessageService.list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.findTenantContext.mockResolvedValue(TENANT as never);
  });

  it("formata data e hora no fuso do TENANT — a UI nunca converte sozinha", async () => {
    repo.listByCustomer.mockResolvedValue([
      { id: "sm-1", scheduledAt: new Date("2026-08-01T12:00:00.000Z") },
    ] as never);

    const itens = await scheduledMessageService.list("tenant-1", "cli-1");

    // 12:00 UTC = 09:00 em America/Sao_Paulo, independente do fuso da máquina.
    expect(itens[0].scheduledDate).toBe("2026-08-01");
    expect(itens[0].scheduledTime).toBe("09:00");
  });
});

describe("scheduledMessageService.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    repo.findTenantContext.mockResolvedValue(TENANT as never);
    repo.findCustomerForMessage.mockResolvedValue(CLIENTE as never);
    repo.create.mockResolvedValue({ id: "sm-1" } as never);
  });

  it("converte data e hora locais para UTC usando o fuso do TENANT, não o do processo", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-31T10:00:00.000Z"));

    await scheduledMessageService.create("tenant-1", "user-1", {
      customerId: "cli-1",
      body: "Oi Maria",
      date: "2026-08-01",
      time: "09:00",
    });

    // 09:00 em America/Sao_Paulo (UTC-3) = 12:00 UTC. Independe do fuso da máquina.
    expect(repo.create).toHaveBeenCalledWith("tenant-1", {
      customerId: "cli-1",
      body: "Oi Maria",
      scheduledAt: new Date("2026-08-01T12:00:00.000Z"),
      createdByUserId: "user-1",
    });
  });

  it("recusa horário no passado — a validação é do service, não da UI", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T15:00:00.000Z"));

    await expect(
      scheduledMessageService.create("tenant-1", "user-1", {
        customerId: "cli-1",
        body: "Oi",
        date: "2026-08-01",
        // 09:00 local = 12:00 UTC, três horas antes de agora.
        time: "09:00",
      }),
    ).rejects.toBeInstanceOf(ScheduledMessageInPastError);

    expect(repo.create).not.toHaveBeenCalled();
  });

  it("recusa cliente que não é do tenant da sessão", async () => {
    repo.findCustomerForMessage.mockResolvedValue(null);

    await expect(
      scheduledMessageService.create("tenant-1", "user-1", {
        customerId: "cli-de-outro-tenant",
        body: "Oi",
        date: "2099-01-01",
        time: "09:00",
      }),
    ).rejects.toBeInstanceOf(CustomerNotFoundError);
  });

  it("recusa cliente sem telefone — não adianta agendar o que nunca vai sair", async () => {
    repo.findCustomerForMessage.mockResolvedValue({ ...CLIENTE, phone: null } as never);

    await expect(
      scheduledMessageService.create("tenant-1", "user-1", {
        customerId: "cli-1",
        body: "Oi",
        date: "2099-01-01",
        time: "09:00",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("scheduledMessageService.update e cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    repo.findTenantContext.mockResolvedValue(TENANT as never);
  });

  it("não deixa editar mensagem já enviada", async () => {
    repo.findById.mockResolvedValue({ id: "sm-1", status: "SENT" } as never);

    await expect(
      scheduledMessageService.update("tenant-1", "sm-1", {
        body: "Outro texto",
        date: "2099-01-01",
        time: "09:00",
      }),
    ).rejects.toBeInstanceOf(ScheduledMessageNotEditableError);

    expect(repo.update).not.toHaveBeenCalled();
  });

  it("não deixa cancelar mensagem já enviada", async () => {
    repo.findById.mockResolvedValue({ id: "sm-1", status: "SENT" } as never);

    await expect(scheduledMessageService.cancel("tenant-1", "sm-1")).rejects.toBeInstanceOf(
      ScheduledMessageNotEditableError,
    );

    expect(repo.cancel).not.toHaveBeenCalled();
  });

  it("404 quando o id não existe no tenant da sessão", async () => {
    repo.findById.mockResolvedValue(null);

    await expect(scheduledMessageService.cancel("tenant-1", "sm-1")).rejects.toBeInstanceOf(
      ScheduledMessageNotFoundError,
    );
  });

  it("edita o que ainda está pendente, reconvertendo o horário no fuso do tenant", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-31T10:00:00.000Z"));
    repo.findById.mockResolvedValue({ id: "sm-1", status: "PENDING" } as never);
    repo.update.mockResolvedValue(true);

    await scheduledMessageService.update("tenant-1", "sm-1", {
      body: "Texto novo",
      date: "2026-08-02",
      time: "18:30",
    });

    expect(repo.update).toHaveBeenCalledWith("tenant-1", "sm-1", {
      body: "Texto novo",
      scheduledAt: new Date("2026-08-02T21:30:00.000Z"),
    });
  });

  it("se o cron levou a linha no meio da edição, o erro diz o status novo", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-31T10:00:00.000Z"));
    repo.findById
      .mockResolvedValueOnce({ id: "sm-1", status: "PENDING" } as never)
      .mockResolvedValueOnce({ id: "sm-1", status: "SENDING" } as never);
    repo.update.mockResolvedValue(false);

    await expect(
      scheduledMessageService.update("tenant-1", "sm-1", {
        body: "Texto novo",
        date: "2026-08-02",
        time: "18:30",
      }),
    ).rejects.toMatchObject({ details: { status: "SENDING" } });
  });
});

describe("scheduledMessageService.renderPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.findTenantContext.mockResolvedValue(TENANT as never);
    repo.findCustomerForMessage.mockResolvedValue(CLIENTE as never);
  });

  it("interpola as variáveis com os dados reais do cliente e do negócio", async () => {
    const texto = await scheduledMessageService.renderPreview(
      "tenant-1",
      "cli-1",
      "Oi {{primeiro_nome}}, aqui é do {{negocio}}!",
    );

    expect(texto).toBe("Oi Maria, aqui é do Studio Bela!");
  });
});

describe("scheduledMessageService.deliverDue", () => {
  const VENCIDA = {
    id: "sm-1",
    tenantId: "tenant-1",
    customerId: "cli-1",
    body: "Oi {{primeiro_nome}}",
    customer: CLIENTE,
    tenant: TENANT,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repo.expireStuck.mockResolvedValue(0);
    repo.findDue.mockResolvedValue([] as never);
  });

  it("entrega pelo dispatcher em modo direto, com o texto já interpolado", async () => {
    repo.findDue.mockResolvedValue([VENCIDA] as never);
    repo.claim.mockResolvedValue(VENCIDA as never);
    dispatcher.dispatch.mockResolvedValue({
      dispatched: ["WHATSAPP"],
      skipReason: null,
      logs: [
        {
          channel: "WHATSAPP",
          notificationLogId: "log-1",
          status: "SENT",
          errorMessage: null,
        },
      ],
    });

    const agora = new Date("2026-08-01T12:05:00.000Z");
    const resumo = await scheduledMessageService.deliverDue(agora);

    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "direct",
        tenantId: "tenant-1",
        channels: ["WHATSAPP"],
        message: "Oi Maria",
        templateKey: "scheduled-message",
        recipient: { phone: "11999990000" },
      }),
    );
    expect(repo.markSent).toHaveBeenCalledWith("sm-1", "log-1", agora);
    expect(resumo).toEqual({ enviadas: 1, falhas: 0, expiradas: 0 });
  });

  it("não envia quando outro tick já reivindicou a linha — idempotência", async () => {
    repo.findDue.mockResolvedValue([VENCIDA] as never);
    repo.claim.mockResolvedValue(null);

    const resumo = await scheduledMessageService.deliverDue(new Date());

    expect(dispatcher.dispatch).not.toHaveBeenCalled();
    expect(repo.markSent).not.toHaveBeenCalled();
    expect(repo.markFailed).not.toHaveBeenCalled();
    expect(resumo).toEqual({ enviadas: 0, falhas: 0, expiradas: 0 });
  });

  it("falha de entrega vira FAILED com o motivo real do log, sem reagendar", async () => {
    repo.findDue.mockResolvedValue([VENCIDA] as never);
    repo.claim.mockResolvedValue(VENCIDA as never);
    dispatcher.dispatch.mockResolvedValue({
      dispatched: ["WHATSAPP"],
      skipReason: null,
      logs: [
        {
          channel: "WHATSAPP",
          notificationLogId: "log-9",
          status: "FAILED",
          errorMessage: "Limite mensal de WhatsApp atingido.",
        },
      ],
    });

    const resumo = await scheduledMessageService.deliverDue(new Date());

    expect(repo.markFailed).toHaveBeenCalledWith(
      "sm-1",
      "Limite mensal de WhatsApp atingido.",
      "log-9",
    );
    expect(resumo).toEqual({ enviadas: 0, falhas: 1, expiradas: 0 });
  });

  it("exceção numa linha não derruba o lote — a próxima ainda é processada", async () => {
    repo.findDue.mockResolvedValue([VENCIDA, { ...VENCIDA, id: "sm-2" }] as never);
    repo.claim.mockImplementation(
      async (id: string) => ({ ...VENCIDA, id }) as never,
    );
    dispatcher.dispatch
      .mockRejectedValueOnce(new Error("banco fora do ar"))
      .mockResolvedValueOnce({
        dispatched: ["WHATSAPP"],
        skipReason: null,
        logs: [
          {
            channel: "WHATSAPP",
            notificationLogId: "log-2",
            status: "SENT",
            errorMessage: null,
          },
        ],
      });

    const resumo = await scheduledMessageService.deliverDue(new Date());

    expect(repo.markFailed).toHaveBeenCalledWith(
      "sm-1",
      expect.stringContaining("banco fora do ar"),
      null,
    );
    expect(repo.markSent).toHaveBeenCalledWith("sm-2", "log-2", expect.any(Date));
    expect(resumo).toEqual({ enviadas: 1, falhas: 1, expiradas: 0 });
  });

  it("cliente que perdeu o telefone entre agendar e enviar falha com motivo legível", async () => {
    const SEM_TELEFONE = { ...VENCIDA, customer: { ...CLIENTE, phone: null } };
    repo.findDue.mockResolvedValue([SEM_TELEFONE] as never);
    repo.claim.mockResolvedValue(SEM_TELEFONE as never);

    await scheduledMessageService.deliverDue(new Date());

    expect(dispatcher.dispatch).not.toHaveBeenCalled();
    expect(repo.markFailed).toHaveBeenCalledWith(
      "sm-1",
      "Cliente sem telefone cadastrado.",
      null,
    );
  });

  it("dispatcher falhando internamente (skipReason sem-destinatario com telefone OK) nao mente sobre o motivo", async () => {
    // `entregar` já garantiu que o cliente TEM telefone antes de chamar o dispatcher.
    // Se mesmo assim o dispatcher volta com `dispatched: []`/`skipReason:
    // "sem-destinatario"`, é porque o catch interno dele engoliu uma falha ao gravar o
    // NotificationLog — não porque falta telefone. O motivo salvo precisa refletir isso.
    repo.findDue.mockResolvedValue([VENCIDA] as never);
    repo.claim.mockResolvedValue(VENCIDA as never);
    dispatcher.dispatch.mockResolvedValue({
      dispatched: [],
      skipReason: "sem-destinatario",
      logs: [],
    });

    const resumo = await scheduledMessageService.deliverDue(new Date());

    expect(repo.markFailed).toHaveBeenCalledWith(
      "sm-1",
      "Nao foi possivel registrar o envio. Tente agendar de novo.",
      null,
    );
    expect(resumo).toEqual({ enviadas: 0, falhas: 1, expiradas: 0 });
  });

  it("derruba SENDING preso antes de varrer, e conta quantos", async () => {
    repo.expireStuck.mockResolvedValue(2);

    const agora = new Date("2026-08-01T12:00:00.000Z");
    const resumo = await scheduledMessageService.deliverDue(agora);

    // 15 minutos antes de agora.
    expect(repo.expireStuck).toHaveBeenCalledWith(new Date("2026-08-01T11:45:00.000Z"));
    expect(resumo.expiradas).toBe(2);
  });

  it("usa o corpo relido no claim, não o que o findDue tinha em mãos — a mensagem pode ter sido editada nesse meio-tempo", async () => {
    repo.findDue.mockResolvedValue([VENCIDA] as never); // body antigo: "Oi {{primeiro_nome}}"
    repo.claim.mockResolvedValue({
      ...VENCIDA,
      body: "Texto editado depois do findDue",
    } as never);
    dispatcher.dispatch.mockResolvedValue({
      dispatched: ["WHATSAPP"],
      skipReason: null,
      logs: [{ channel: "WHATSAPP", notificationLogId: "log-x", status: "SENT", errorMessage: null }],
    });

    await scheduledMessageService.deliverDue(new Date("2026-08-01T12:05:00.000Z"));

    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Texto editado depois do findDue" }),
    );
  });
});
