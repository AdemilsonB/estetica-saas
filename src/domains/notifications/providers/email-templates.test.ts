import { describe, it, expect } from "vitest";
import {
  customerEmailHtml,
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

describe("customerEmailHtml — layout único do e-mail ao cliente", () => {
  it("monta o HTML do e-mail com o corpo do template e preserva quebras de linha", () => {
    const html = customerEmailHtml({ body: "Linha 1\nLinha 2", tenantName: "Salão da Lu" });
    expect(html).toContain("Linha 1<br />Linha 2");
    expect(html).toContain("Salão da Lu");
    expect(html).toContain("<!DOCTYPE html>");
  });

  it("não re-escapa o corpo: o service já escapou ao interpolar", () => {
    const html = customerEmailHtml({ body: "Maria &lt;script&gt;", tenantName: "Salão" });
    expect(html).toContain("Maria &lt;script&gt;");
    expect(html).not.toContain("&amp;lt;");
  });
});
