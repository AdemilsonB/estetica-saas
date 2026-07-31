// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

vi.mock("@/hooks/notifications/use-scheduled-messages", () => ({
  useScheduledMessages: vi.fn(),
  useScheduledMessageOptions: vi.fn(),
  useScheduledMessagePreview: vi.fn(),
  useCreateScheduledMessage: vi.fn(),
  useUpdateScheduledMessage: vi.fn(),
  useCancelScheduledMessage: vi.fn(),
}));

import {
  useCancelScheduledMessage,
  useCreateScheduledMessage,
  useScheduledMessageOptions,
  useScheduledMessagePreview,
  useScheduledMessages,
  useUpdateScheduledMessage,
} from "@/hooks/notifications/use-scheduled-messages";

import { ScheduledMessagesDialog } from "./scheduled-messages-dialog";

const lista = vi.mocked(useScheduledMessages);
const opcoes = vi.mocked(useScheduledMessageOptions);
const previa = vi.mocked(useScheduledMessagePreview);
const criar = vi.mocked(useCreateScheduledMessage);
const editar = vi.mocked(useUpdateScheduledMessage);
const cancelar = vi.mocked(useCancelScheduledMessage);

const cancelarMutate = vi.fn();

function montar() {
  render(
    <ScheduledMessagesDialog
      open
      onClose={() => {}}
      customerId="cli-1"
      customerName="Maria Silva"
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  opcoes.mockReturnValue({
    data: { templates: [], variables: ["primeiro_nome"] },
  } as never);
  previa.mockReturnValue({ data: { preview: "", blockedReason: null } } as never);
  criar.mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
  editar.mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
  cancelar.mockReturnValue({ mutate: cancelarMutate, isPending: false } as never);
});

describe("ScheduledMessagesDialog", () => {
  it("mostra o estado de carregando", () => {
    lista.mockReturnValue({ isLoading: true } as never);
    montar();

    expect(screen.getByTestId("lembretes-carregando")).toBeInTheDocument();
  });

  it("mostra o estado de erro com ação de tentar de novo", () => {
    const refetch = vi.fn();
    lista.mockReturnValue({ isLoading: false, isError: true, refetch } as never);
    montar();

    expect(screen.getByText(/não foi possível carregar/i)).toBeInTheDocument();
  });

  it("mostra o estado vazio quando não há lembrete agendado", () => {
    lista.mockReturnValue({ isLoading: false, isError: false, data: [] } as never);
    montar();

    expect(screen.getByText(/nenhum lembrete agendado/i)).toBeInTheDocument();
  });

  it("lista o lembrete pendente com o motivo da falha quando houver", () => {
    lista.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [
        {
          id: "sm-1",
          body: "Oi Maria",
          scheduledAt: "2099-01-01T12:00:00.000Z",
          scheduledDate: "2099-01-01",
          scheduledTime: "09:00",
          status: "FAILED",
          sentAt: null,
          failureReason: "Limite mensal de WhatsApp atingido.",
          createdByUser: { id: "u1", name: "Ana" },
        },
      ],
    } as never);
    montar();

    expect(screen.getByText(/Limite mensal de WhatsApp atingido/)).toBeInTheDocument();
  });

  it("cancelar pede confirmação no próprio item antes de chamar a API", async () => {
    lista.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [
        {
          id: "sm-1",
          body: "Oi Maria",
          scheduledAt: "2099-01-01T12:00:00.000Z",
          scheduledDate: "2099-01-01",
          scheduledTime: "09:00",
          status: "PENDING",
          sentAt: null,
          failureReason: null,
          createdByUser: { id: "u1", name: "Ana" },
        },
      ],
    } as never);
    montar();

    await userEvent.click(screen.getByRole("button", { name: /cancelar lembrete/i }));
    expect(cancelarMutate).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /^sim, cancelar$/i }));
    expect(cancelarMutate).toHaveBeenCalledWith("sm-1", expect.anything());
  });

  it("avisa que o envio tem granularidade de ~10 minutos", async () => {
    lista.mockReturnValue({ isLoading: false, isError: false, data: [] } as never);
    montar();

    await userEvent.click(screen.getByRole("button", { name: /agendar lembrete/i }));

    expect(screen.getByText(/10 minutos/i)).toBeInTheDocument();
  });
});
