import { normalizarTexto } from '../../../shared/utils/normalizar-texto'

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
])

export function ehPedidoDeDescadastro(texto: string): boolean {
  return PALAVRAS_DE_DESCADASTRO.has(normalizarTexto(texto));
}
