import { describe, it, expect } from "vitest";
import {
  professionalNewAppointmentHtml,
  professionalCancelledAppointmentHtml,
} from "./email-templates";

const data = {
  professionalName: "Ana",
  customerName: "Maria",
  serviceName: "Corte",
  dateTime: "hoje às 14h",
  tenantName: "Salão da Ana",
};

describe("templates de e-mail do profissional", () => {
  it("novo agendamento inclui cliente, serviço e horário", () => {
    const html = professionalNewAppointmentHtml(data);
    expect(html).toContain("Maria");
    expect(html).toContain("Corte");
    expect(html).toContain("hoje às 14h");
  });

  it("cancelamento sinaliza o cancelamento", () => {
    const html = professionalCancelledAppointmentHtml(data);
    expect(html.toLowerCase()).toContain("cancel");
    expect(html).toContain("Maria");
  });
});
