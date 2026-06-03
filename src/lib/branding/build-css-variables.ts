export type BrandingInput = {
  primaryColor: string
  accentColor: string
  backgroundColor: string
  borderColor: string
  foregroundColor: string
  mutedColor: string
  fontFamily: 'inter' | 'manrope' | 'geist' | 'dm-sans' | 'plus-jakarta-sans' | 'lato'
  borderRadius: 'none' | 'medium' | 'full'
  colorScheme: 'light' | 'dark'
  logoUrl: string | null
  secondaryColor?: string
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

function toLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function parseHex(hex: string): [number, number, number] {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ]
}

export function hexToOklch(hex: string): { l: number; c: number; h: number } {
  const [sr, sg, sb] = parseHex(hex)
  const lr = toLinear(sr), lg = toLinear(sg), lb = toLinear(sb)
  const lms_l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
  const lms_m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
  const lms_s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb
  const lc = Math.cbrt(lms_l), mc = Math.cbrt(lms_m), sc = Math.cbrt(lms_s)
  const labL = 0.2104542553 * lc + 0.7936177850 * mc - 0.0040720468 * sc
  const labA = 1.9779984951 * lc - 2.4285922050 * mc + 0.4505937099 * sc
  const labB = 0.0259040371 * lc + 0.7827717662 * mc - 0.8086757660 * sc
  const c = Math.sqrt(labA * labA + labB * labB)
  const h = Math.atan2(labB, labA) * (180 / Math.PI)
  return { l: labL, c, h: h < 0 ? h + 360 : h }
}

function oklchStr(hex: string): string {
  const { l, c, h } = hexToOklch(hex)
  const cRounded = Math.round(c * 1000) / 1000
  // Quando croma é praticamente zero (cor acromática), hue é indefinida — normaliza para 0
  const hRounded = cRounded === 0 ? 0 : Math.round(h * 100) / 100
  return `oklch(${Math.round(l * 1000) / 1000} ${cRounded} ${hRounded})`
}

/** Converte hex para string oklch — exportado para uso em applyPreview no cliente */
export function hexToOklchStr(hex: string): string {
  return oklchStr(hex)
}

function toOklch(colorStr: string): string {
  return colorStr.startsWith('oklch(') ? colorStr : oklchStr(colorStr)
}

function parseLuminance(colorStr: string): number {
  if (colorStr.startsWith('oklch(')) {
    const match = colorStr.match(/oklch\(([\d.]+)/)
    return match ? parseFloat(match[1]) : 0.5
  }
  return hexToOklch(colorStr).l
}

export function calcForeground(colorStr: string): string {
  return parseLuminance(colorStr) > 0.5 ? 'oklch(0.145 0 0)' : 'oklch(0.985 0 0)'
}

function deriveLight(primaryHex: string, lightness: number, chromaFactor: number): string {
  const { c, h } = hexToOklch(primaryHex)
  return `oklch(${lightness} ${Math.round(c * chromaFactor * 1000) / 1000} ${Math.round(h * 100) / 100})`
}

export function deriveSecondary(primaryHex: string): string {
  return deriveLight(primaryHex, 0.93, 0.18)
}

export function deriveAccent(primaryHex: string): string {
  return deriveLight(primaryHex, 0.95, 0.14)
}

export function buildCssVariables(config: BrandingInput): CssVariablesResult {
  const isDark = config.colorScheme === 'dark'
  const radius = BORDER_RADIUS_MAP[config.borderRadius] ?? BORDER_RADIUS_MAP['medium']
  const fontVar = FONT_VARIABLE_MAP[config.fontFamily] ?? FONT_VARIABLE_MAP['inter']

  const primary = oklchStr(config.primaryColor)
  const primaryFg = calcForeground(config.primaryColor)
  const accent = toOklch(config.accentColor)
  const accentFg = calcForeground(config.accentColor)
  const bg = oklchStr(config.backgroundColor)
  const border = oklchStr(config.borderColor)
  const fg = oklchStr(config.foregroundColor)
  const muted = oklchStr(config.mutedColor)

  const styleTag = [
    `--primary: ${primary};`,
    `--primary-foreground: ${primaryFg};`,
    `--accent: ${accent};`,
    `--accent-foreground: ${accentFg};`,
    `--background: ${bg};`,
    `--foreground: ${fg};`,
    `--border: ${border};`,
    `--muted-foreground: ${muted};`,
    `--sidebar: ${bg};`,
    `--sidebar-foreground: ${fg};`,
    `--sidebar-primary: ${primary};`,
    `--sidebar-primary-foreground: ${primaryFg};`,
    `--sidebar-accent: ${accent};`,
    `--sidebar-accent-foreground: ${primary};`,
    `--ring: ${primary};`,
    `--radius: ${radius};`,
    `--font-sans: ${fontVar};`,
  ].join('\n    ')

  return { styleTag, isDark }
}
