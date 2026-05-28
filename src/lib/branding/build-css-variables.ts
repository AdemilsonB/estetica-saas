export type BrandingInput = {
  primaryColor: string
  secondaryColor: string
  accentColor: string
  backgroundColor: string
  fontFamily: string
  borderRadius: string
  colorScheme: string
  logoUrl: string | null
}

export type CssVariablesResult = {
  styleTag: string
  isDark: boolean
}

export const BORDER_RADIUS_MAP: Record<string, string> = {
  none: '0rem',
  medium: '0.625rem',
  full: '1.5rem',
}

export const FONT_VARIABLE_MAP: Record<string, string> = {
  inter: 'var(--font-inter)',
  manrope: 'var(--font-manrope)',
  geist: 'var(--font-geist-sans)',
  'dm-sans': 'var(--font-dm-sans)',
  'plus-jakarta-sans': 'var(--font-plus-jakarta-sans)',
  lato: 'var(--font-lato)',
}

// Converte canal sRGB [0,1] para linear
function toLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

// Converte hex #rrggbb para sRGB [0,1]
function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  return [r, g, b]
}

// sRGB → oklch (algoritmo direto: linear RGB → LMS → Oklab → oklch)
// Referência: https://bottosson.github.io/posts/oklab/
export function hexToOklch(hex: string): { l: number; c: number; h: number } {
  const [sr, sg, sb] = parseHex(hex)
  const lr = toLinear(sr)
  const lg = toLinear(sg)
  const lb = toLinear(sb)

  // M1: linear sRGB → LMS
  const lms_l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
  const lms_m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
  const lms_s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb

  // Raiz cúbica não-linear
  const lc = Math.cbrt(lms_l)
  const mc = Math.cbrt(lms_m)
  const sc = Math.cbrt(lms_s)

  // M2: LMS' → Oklab
  const labL = 0.2104542553 * lc + 0.7936177850 * mc - 0.0040720468 * sc
  const labA = 1.9779984951 * lc - 2.4285922050 * mc + 0.4505937099 * sc
  const labB = 0.0259040371 * lc + 0.7827717662 * mc - 0.8086757660 * sc

  const c = Math.sqrt(labA * labA + labB * labB)
  const h = Math.atan2(labB, labA) * (180 / Math.PI)

  return { l: labL, c, h: h < 0 ? h + 360 : h }
}

function oklchStr(hex: string): string {
  const { l, c, h } = hexToOklch(hex)
  const lRounded = Math.round(l * 1000) / 1000
  const cRounded = Math.round(c * 1000) / 1000
  const hRounded = Math.round(h * 100) / 100
  return `oklch(${lRounded} ${cRounded} ${hRounded})`
}

// Calcula foreground (claro ou escuro) com base no L da cor
export function calcForeground(hex: string): string {
  const { l } = hexToOklch(hex)
  return l > 0.5 ? 'oklch(0.145 0 0)' : 'oklch(0.985 0 0)'
}

export function buildCssVariables(config: BrandingInput): CssVariablesResult {
  const isDark = config.colorScheme === 'dark'
  const radius = BORDER_RADIUS_MAP[config.borderRadius] ?? BORDER_RADIUS_MAP['medium']
  const fontVar = FONT_VARIABLE_MAP[config.fontFamily] ?? FONT_VARIABLE_MAP['inter']

  const primary = oklchStr(config.primaryColor)
  const primaryFg = calcForeground(config.primaryColor)
  const secondary = oklchStr(config.secondaryColor)
  const secondaryFg = calcForeground(config.secondaryColor)
  const accent = oklchStr(config.accentColor)
  const accentFg = calcForeground(config.accentColor)
  const bg = oklchStr(config.backgroundColor)
  const fg = calcForeground(config.backgroundColor)

  const styleTag = [
    `--primary: ${primary};`,
    `--primary-foreground: ${primaryFg};`,
    `--secondary: ${secondary};`,
    `--secondary-foreground: ${secondaryFg};`,
    `--accent: ${accent};`,
    `--accent-foreground: ${accentFg};`,
    `--background: ${bg};`,
    `--foreground: ${fg};`,
    `--sidebar: ${bg};`,
    `--sidebar-foreground: ${fg};`,
    `--sidebar-primary: ${primary};`,
    `--sidebar-primary-foreground: ${primaryFg};`,
    `--radius: ${radius};`,
    `--font-sans: ${fontVar};`,
  ].join('\n    ')

  return { styleTag, isDark }
}
