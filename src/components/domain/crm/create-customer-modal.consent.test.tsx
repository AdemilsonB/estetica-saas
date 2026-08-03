// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { CreateCustomerModal } from "./create-customer-modal";

const mutate = vi.fn();

vi.mock("@/hooks/crm/use-customers", () => ({
  useCreateCustomer: () => ({ mutate, isPending: false }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("./pick-contact-modal", () => ({
  PickContactModal: () => null,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("CreateCustomerModal — consentimento de marketing", () => {
  it("mostra a chave e nasce desmarcada", () => {
    // Desmarcada por padrão: a profissional marca quando o cliente autoriza.
    render(<CreateCustomerModal open onClose={vi.fn()} />);

    const chave = screen.getByLabelText(/receber promoções e novidades/i);
    expect(chave).toBeInTheDocument();
    expect(chave).not.toBeChecked();
  });

  it("envia consentGiven false quando não marcada", async () => {
    render(<CreateCustomerModal open onClose={vi.fn()} />);

    await userEvent.type(screen.getByPlaceholderText(/nome completo/i), "Maria Silva");
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    expect(mutate.mock.calls[0][0]).toEqual(
      expect.objectContaining({ consentGiven: false }),
    );
  });

  it("envia consentGiven true quando marcada", async () => {
    render(<CreateCustomerModal open onClose={vi.fn()} />);

    await userEvent.type(screen.getByPlaceholderText(/nome completo/i), "Maria Silva");
    await userEvent.click(screen.getByLabelText(/receber promoções e novidades/i));
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    expect(mutate.mock.calls[0][0]).toEqual(
      expect.objectContaining({ consentGiven: true }),
    );
  });

  it("envia a data de nascimento", async () => {
    // REGRESSÃO: `birthDate` era enviado pelo formulário mas `customerService.create`
    // nunca o repassava ao repositório — a data digitada no cadastro era descartada
    // em silêncio, e é ela que dispara a mensagem de aniversário.
    render(<CreateCustomerModal open onClose={vi.fn()} />);

    await userEvent.type(screen.getByPlaceholderText(/nome completo/i), "Maria Silva");
    await userEvent.type(screen.getByLabelText(/data de nascimento/i), "1990-03-15");
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    expect(mutate.mock.calls[0][0]).toEqual(
      expect.objectContaining({ birthDate: "1990-03-15" }),
    );
  });
});
