/**
 * Parser de vCard (.vcf) tolerante aos formatos encontrados no mundo real:
 *
 * - iOS/iCloud (vCard 3.0): propriedades com prefixo de grupo (`item1.TEL`),
 *   dobra de linha (CRLF + espaço), telefone com rótulo personalizado,
 *   foto em base64 embutida.
 * - WhatsApp (vCard 3.0): `TEL;type=CELL;waid=...`.
 * - Android/backups antigos (vCard 2.1): parâmetros sem `type=`,
 *   quoted-printable com soft line breaks.
 *
 * Extrai apenas o que o import de clientes precisa: nome + melhor telefone.
 */

export type VCardContact = {
  name: string
  phone: string
}

type ParsedTel = {
  params: string
  value: string
}

type CurrentCard = {
  fn?: string
  n?: string
  tels: ParsedTel[]
}

const MIN_PHONE_DIGITS = 8

/**
 * Normaliza telefone importado para dígitos, removendo DDI 55 e zero de
 * operadora quando o resultado é um número brasileiro válido (10-11 dígitos).
 */
export function normalizeImportedPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '')

  // DDI brasileiro: 55 + 10-11 dígitos locais
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2)
  }

  // Zero de operadora: 011 98765-4321
  if (digits.startsWith('0') && (digits.length === 11 || digits.length === 12)) {
    digits = digits.slice(1)
  }

  return digits
}

/**
 * Expande a lista de telefones normalizados com a variante prefixada com DDI 55,
 * para o preview de duplicados casar clientes gravados em qualquer uma das formas.
 */
export function buildPreviewPhoneVariants(phones: string[]): string[] {
  const variants = new Set<string>()
  for (const phone of phones) {
    variants.add(phone)
    // Formato brasileiro: DDD + celular (9xxxx) ou DDD + fixo (2-5xxx)
    const looksBrazilian =
      (phone.length === 11 && phone[2] === '9') ||
      (phone.length === 10 && phone[2] >= '2' && phone[2] <= '5')
    if (looksBrazilian) {
      variants.add('55' + phone)
    }
  }
  return [...variants]
}

// Desfaz a dobra de linha do vCard: linha iniciada por espaço/tab continua a anterior
function unfoldLines(content: string): string[] {
  const rawLines = content.split(/\r\n|\r|\n/)
  const lines: string[] = []
  for (const raw of rawLines) {
    if ((raw.startsWith(' ') || raw.startsWith('\t')) && lines.length > 0) {
      lines[lines.length - 1] += raw.slice(1)
    } else if (raw.length > 0) {
      lines.push(raw)
    }
  }
  return lines
}

// vCard 2.1: valor quoted-printable terminado em "=" continua na linha seguinte
function joinQuotedPrintableSoftBreaks(lines: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]
    const colon = line.indexOf(':')
    const head = colon === -1 ? '' : line.slice(0, colon)
    if (/ENCODING=QUOTED-PRINTABLE/i.test(head)) {
      while (line.endsWith('=') && i + 1 < lines.length) {
        line = line.slice(0, -1) + lines[i + 1]
        i++
      }
    }
    out.push(line)
  }
  return out
}

function decodeQuotedPrintable(value: string): string {
  const bytes: number[] = []
  for (let i = 0; i < value.length; i++) {
    const hex = value.slice(i + 1, i + 3)
    if (value[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(hex)) {
      bytes.push(parseInt(hex, 16))
      i += 2
    } else {
      bytes.push(value.charCodeAt(i) & 0xff)
    }
  }
  return new TextDecoder('utf-8').decode(new Uint8Array(bytes))
}

// Desfaz escapes do vCard 3.0 (\, \; \\ e \n literal)
function unescapeValue(value: string): string {
  return value
    .replace(/\\n/gi, ' ')
    .replace(/\\([\\,;])/g, '$1')
    .trim()
}

type ParsedProperty = {
  name: string
  params: string
  value: string
}

// Interpreta uma linha lógica: [grupo.]NOME[;param;param]:valor
function parseProperty(line: string): ParsedProperty | null {
  const colon = line.indexOf(':')
  if (colon === -1) return null

  const head = line.slice(0, colon)
  const value = line.slice(colon + 1)

  const semicolon = head.indexOf(';')
  let name = semicolon === -1 ? head : head.slice(0, semicolon)
  const params = semicolon === -1 ? '' : head.slice(semicolon + 1)

  // Prefixo de grupo do iOS: item1.TEL → TEL
  const dot = name.indexOf('.')
  if (dot !== -1) name = name.slice(dot + 1)

  return { name: name.trim().toUpperCase(), params: params.toUpperCase(), value }
}

function decodeValue(prop: ParsedProperty): string {
  const raw = prop.params.includes('ENCODING=QUOTED-PRINTABLE')
    ? decodeQuotedPrintable(prop.value)
    : prop.value
  return unescapeValue(raw)
}

// Monta nome a partir do N (Família;Nome;Adicional;Prefixo;Sufixo) → "Nome Família"
function nameFromN(nValue: string): string {
  const [family = '', given = ''] = nValue.split(';').map((part) => unescapeValue(part))
  return [given, family].filter(Boolean).join(' ').trim()
}

// Melhor telefone do contato: marcado como pref > celular/iPhone > primeiro válido
function pickBestPhone(tels: ParsedTel[]): string | null {
  const candidates = tels
    .map((tel) => ({ params: tel.params, phone: normalizeImportedPhone(tel.value) }))
    .filter((tel) => tel.phone.length >= MIN_PHONE_DIGITS)

  if (candidates.length === 0) return null

  const preferred = candidates.find((tel) => tel.params.includes('PREF'))
  if (preferred) return preferred.phone

  const cell = candidates.find(
    (tel) => tel.params.includes('CELL') || tel.params.includes('IPHONE'),
  )
  return (cell ?? candidates[0]).phone
}

/**
 * Extrai contatos (nome + telefone) de um arquivo .vcf com um ou mais vCards.
 * Contatos sem nome ou sem telefone válido são ignorados; telefones duplicados
 * ficam com a primeira ocorrência.
 */
export function parseVCards(content: string): VCardContact[] {
  const lines = joinQuotedPrintableSoftBreaks(unfoldLines(content))
  const contacts: VCardContact[] = []
  const seenPhones = new Set<string>()
  let current: CurrentCard | null = null

  for (const line of lines) {
    const prop = parseProperty(line)
    if (!prop) continue

    if (prop.name === 'BEGIN' && prop.value.trim().toUpperCase() === 'VCARD') {
      current = { tels: [] }
      continue
    }
    if (!current) continue

    if (prop.name === 'END' && prop.value.trim().toUpperCase() === 'VCARD') {
      const name = current.fn || (current.n ? nameFromN(current.n) : '')
      const phone = pickBestPhone(current.tels)
      if (name && phone && !seenPhones.has(phone)) {
        seenPhones.add(phone)
        contacts.push({ name, phone })
      }
      current = null
      continue
    }

    if (prop.name === 'FN') {
      current.fn = decodeValue(prop)
    } else if (prop.name === 'N') {
      current.n = prop.params.includes('ENCODING=QUOTED-PRINTABLE')
        ? decodeQuotedPrintable(prop.value)
        : prop.value
    } else if (prop.name === 'TEL') {
      current.tels.push({ params: prop.params, value: prop.value })
    }
  }

  return contacts
}
