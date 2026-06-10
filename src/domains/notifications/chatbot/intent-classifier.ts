export type Intent = 'BOOK' | 'CANCEL' | 'PRICE' | 'HOURS' | 'FALLBACK'

const PATTERNS: Record<Exclude<Intent, 'FALLBACK'>, RegExp> = {
  BOOK:   /\b(agendar|marcar|quero agendar|quero marcar|reservar)\b/i,
  CANCEL: /\b(cancelar|desmarcar|cancela|cancelo|nao vou|nao consigo)\b/i,
  PRICE:  /\b(preco|valor|quanto custa|tabela|valores|cobranca|cobram)\b/i,
  HOURS:  /\b(horario de funcionamento|que horas|abre|fecha|funcionamento)\b/i,
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export function classifyIntent(text: string): Intent {
  const normalized = normalize(text)
  for (const [intent, regex] of Object.entries(PATTERNS) as [Exclude<Intent, 'FALLBACK'>, RegExp][]) {
    if (regex.test(normalized)) return intent
  }
  return 'FALLBACK'
}
