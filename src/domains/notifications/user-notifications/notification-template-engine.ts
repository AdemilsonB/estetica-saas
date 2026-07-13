export type TemplateVariables = Record<string, string>;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Substitui {{variavel}} pelo valor correspondente; variável desconhecida vira
// string vazia (nunca quebra o envio). `escape=true` deve ser usado sempre no
// canal EMAIL (o valor pode conter HTML perigoso, ex.: nome de cliente).
export function interpolateTemplate(template: string, vars: TemplateVariables, escape: boolean): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => {
    const value = vars[key] ?? "";
    return escape ? escapeHtml(value) : value;
  });
}

export function renderNotification(
  template: { subject: string | null; body: string },
  vars: TemplateVariables,
  channel: "IN_APP" | "EMAIL",
): { subject: string; body: string } {
  const escape = channel === "EMAIL";
  return {
    subject: template.subject ? interpolateTemplate(template.subject, vars, escape) : "",
    body: interpolateTemplate(template.body, vars, escape),
  };
}
