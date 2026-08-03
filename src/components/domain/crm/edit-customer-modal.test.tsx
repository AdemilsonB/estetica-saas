// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { EditCustomerModal } from "./edit-customer-modal";

const update = vi.fn();

vi.mock("@/hooks/crm/use-customers", () => ({
  useUpdateCustomer: () => ({ mutate: update, isPending: false }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const clienteBase = {
  id: "c1",
  name: "Maria Silva",
  phone: "11999990000",
  email: null,
  birthDate: null,
  notes: null,
  consentGiven: false,
  marketingOptOut: false,
};

function abrir(overrides: Partial<typeof clienteBase> = {}) {
  return render(
    <EditCustomerModal open onClose={vi.fn()} customer={{ ...clienteBase, ...overrides }} />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("EditCustomerModal — consentimento de marketing", () => {
  it("mostra a chave de consentimento", () => {
    abrir();
    expect(screen.getByLabelText(/receber promoções e novidades/i)).toBeInTheDocument();
  });

  it("reflete o consentimento atual do cliente", () => {
    abrir({ consentGiven: true });
    expect(screen.getByLabelText(/receber promoções e novidades/i)).toBeChecked();
  });

  it("envia consentGiven ao salvar", async () => {
    abrir({ consentGiven: false });

    await userEvent.click(screen.getByLabelText(/receber promoções e novidades/i));
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0].input).toEqual(
      expect.objectContaining({ consentGiven: true }),
    );
  });

  it("desabilita a chave e explica quando o cliente pediu descadastro", () => {
    // Religar por um formulário do painel desfaria o pedido do cliente sem que ele
    // soubesse. Reverter exige o próprio cliente refazer, pelo Portal ou WhatsApp.
    abrir({ consentGiven: true, marketingOptOut: true });

    expect(screen.getByLabelText(/receber promoções e novidades/i)).toBeDisabled();
    expect(screen.getByText(/pediu para não receber promoções/i)).toBeInTheDocument();
  });

  it("não mostra o aviso de descadastro quando não há opt-out", () => {
    abrir({ marketingOptOut: false });
    expect(screen.queryByText(/pediu para não receber promoções/i)).not.toBeInTheDocument();
  });

  it("envia a data de nascimento ao salvar", async () => {
    // REGRESSÃO: `birthDate` era aceito pelo schema e enviado pelo formulário, mas
    // `customerService.update` nunca o repassava ao repositório — a profissional
    // corrigia a data e nada era salvo. Importa porque é ela que dispara o
    // aniversário.
    abrir({ birthDate: "1990-03-15T00:00:00.000Z" });

    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    expect(update.mock.calls[0][0].input).toEqual(
      expect.objectContaining({ birthDate: "1990-03-15" }),
    );
  });
});
