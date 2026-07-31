// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { CustomerProfileHeader } from "./customer-profile-header";

// Este projeto não liga `test.globals` no vitest.config.ts, então o auto-cleanup
// do Testing Library (que depende de um `afterEach` global) não dispara sozinho —
// sem isto, o DOM de um teste vaza para o próximo (mesmo padrão usado em outros
// testes de componente do repo, ex.: create-appointment-modal.defaults.test.tsx).
afterEach(() => {
  cleanup();
});

const BASE = {
  id: "cli-1",
  name: "Maria Silva",
  phone: "11999990000",
  email: null,
  tags: [],
  notes: null,
  noShowCount: 0,
  isBlocked: false,
  blockedReason: null,
  deletedAt: null,
  appointments: [],
};

function montar(extra: Record<string, unknown> = {}) {
  const onScheduleMessage = vi.fn();
  render(
    <CustomerProfileHeader
      customer={{ ...BASE, ...extra } as never}
      onScheduleMessage={onScheduleMessage}
      scheduledCount={(extra.scheduledCount as number) ?? 0}
    />,
  );
  return { onScheduleMessage };
}

describe("CustomerProfileHeader — botão de lembrete", () => {
  it("mostra o botão ao lado do nome e dispara o callback", async () => {
    const { onScheduleMessage } = montar();

    const botao = screen.getByRole("button", { name: /lembrete/i });
    await userEvent.click(botao);

    expect(onScheduleMessage).toHaveBeenCalledTimes(1);
  });

  it("não oferece o botão para cliente sem telefone — não há como entregar", () => {
    montar({ phone: null });

    expect(screen.queryByRole("button", { name: /lembrete/i })).not.toBeInTheDocument();
  });

  it("mostra quantos lembretes estão agendados", () => {
    montar({ scheduledCount: 3 });

    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("sem lembrete agendado, não mostra contador zerado", () => {
    montar({ scheduledCount: 0 });

    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
