import { describe, it, expect } from "vitest";
import { interpolateTemplate, renderNotification } from "./notification-template-engine";

describe("interpolateTemplate", () => {
  it("substitui variáveis conhecidas", () => {
    const result = interpolateTemplate("Olá {{cliente}}, {{servico}} às {{hora}}", {
      cliente: "Maria",
      servico: "Corte",
      hora: "14:00",
    }, false);
    expect(result).toBe("Olá Maria, Corte às 14:00");
  });

  it("variável desconhecida vira string vazia", () => {
    const result = interpolateTemplate("Olá {{cliente}}, {{inexistente}}", { cliente: "Maria" }, false);
    expect(result).toBe("Olá Maria, ");
  });

  it("faz escape de HTML quando escape=true", () => {
    const result = interpolateTemplate("{{cliente}}", { cliente: "<script>alert(1)</script>" }, true);
    expect(result).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("não escapa quando escape=false (in-app é texto puro)", () => {
    const result = interpolateTemplate("{{cliente}}", { cliente: "Maria & João" }, false);
    expect(result).toBe("Maria & João");
  });
});

describe("renderNotification", () => {
  it("aplica escape no canal EMAIL e não no IN_APP", () => {
    const template = { subject: "Oi {{cliente}}", body: "{{cliente}} <3" };
    const email = renderNotification(template, { cliente: "M&M" }, "EMAIL");
    const inApp = renderNotification(template, { cliente: "M&M" }, "IN_APP");
    expect(email.subject).toBe("Oi M&amp;M");
    expect(email.body).toBe("M&amp;M <3");
    expect(inApp.body).toBe("M&M <3");
  });

  it("subject nulo vira string vazia", () => {
    const result = renderNotification({ subject: null, body: "{{cliente}}" }, { cliente: "Ana" }, "IN_APP");
    expect(result.subject).toBe("");
  });
});
