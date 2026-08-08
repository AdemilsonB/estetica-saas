// Normaliza texto removendo acentos, espaços duplicados e convertendo para minúsculas.
// Usa NFD (decomposição) + remoção de marcas diacríticas combinantes para suportar
// acentos em qualquer posição do texto.
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}
