import { describe, it, expect } from "vitest";
import { extractContactPhone } from "./extract-phone";

describe("extractContactPhone (Evolution v1/v2)", () => {
  it("extrai o telefone de contato v2 (JID em remoteJid, id é UUID)", () => {
    const phone = extractContactPhone({
      id: "b3f1c0a2-1234-4d5e-9abc-1234567890ab",
      remoteJid: "5511999999999@s.whatsapp.net",
    });
    // normalizado sem DDI 55, celular de 11 dígitos
    expect(phone).toBe("11999999999");
  });

  it("mantém compatibilidade v1 (JID no campo id)", () => {
    const phone = extractContactPhone({
      id: "5511988887777@s.whatsapp.net",
    });
    expect(phone).toBe("11988887777");
  });

  it("ignora grupos e JIDs não pessoais", () => {
    expect(
      extractContactPhone({ id: "uuid", remoteJid: "123456789-987@g.us" }),
    ).toBeNull();
  });

  it("ignora números não brasileiros", () => {
    expect(
      extractContactPhone({ id: "uuid", remoteJid: "12025551234@s.whatsapp.net" }),
    ).toBeNull();
  });
});
