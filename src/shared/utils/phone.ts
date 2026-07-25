/**
 * Formata um telefone brasileiro em dígitos (com ou sem DDI 55) para exibição.
 * Números fora do padrão BR são devolvidos como vieram.
 */
export function formatBrazilianPhone(digits: string): string {
  let local = digits.replace(/\D/g, "");
  if (local.startsWith("55") && (local.length === 12 || local.length === 13)) {
    local = local.slice(2);
  }

  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return digits;
}
