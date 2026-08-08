/**
 * Palavras que significam "não quero mais receber". Casam apenas com a mensagem
 * inteira, nunca dentro de uma frase: "pode parar de mandar às 7h?" é conversa,
 * e marcar opt-out por causa dela silenciaria o canal sem o cliente ter pedido.
 */
const PALAVRAS_DE_DESCADASTRO = new Set([
  "pare",
  "parar",
  "sair",
  "descadastrar",
  "cancelar inscricao",
]);

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function ehPedidoDeDescadastro(texto: string): boolean {
  return PALAVRAS_DE_DESCADASTRO.has(normalizar(texto));
}
