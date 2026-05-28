import { describe, it, expect } from 'vitest'
import { hexToOklch, buildCssVariables, calcForeground, BORDER_RADIUS_MAP, FONT_VARIABLE_MAP, deriveSecondary, deriveAccent, hexToOklchStr } from './build-css-variables'

describe('hexToOklch', () => {
  it('converte branco para oklch(1 0 0)', () => {
    const { l, c, h } = hexToOklch('#ffffff')
    expect(l).toBeCloseTo(1, 2)
    expect(c).toBeCloseTo(0, 2)
  })

  it('converte preto para oklch(0 0 0)', () => {
    const { l, c, h } = hexToOklch('#000000')
    expect(l).toBeCloseTo(0, 2)
    expect(c).toBeCloseTo(0, 2)
  })

  it('converte #191919 para um L baixo (cor escura)', () => {
    const { l } = hexToOklch('#191919')
    expect(l).toBeLessThan(0.25)
  })

  it('converte #f8f8f7 para um L alto (cor clara)', () => {
    const { l } = hexToOklch('#f8f8f7')
    expect(l).toBeGreaterThan(0.95)
  })

  it('expande hex curto #fff para branco', () => {
    const { l } = hexToOklch('#fff')
    expect(l).toBeCloseTo(1, 2)
  })
})

describe('calcForeground', () => {
  it('retorna branco para cor primária escura (#191919)', () => {
    expect(calcForeground('#191919')).toBe('oklch(0.985 0 0)')
  })

  it('retorna preto para cor primária clara (#f0f0f0)', () => {
    expect(calcForeground('#f0f0f0')).toBe('oklch(0.145 0 0)')
  })
})

describe('BORDER_RADIUS_MAP', () => {
  it('mapeia none para 0rem', () => {
    expect(BORDER_RADIUS_MAP['none']).toBe('0rem')
  })
  it('mapeia medium para 0.625rem', () => {
    expect(BORDER_RADIUS_MAP['medium']).toBe('0.625rem')
  })
  it('mapeia full para 1.5rem', () => {
    expect(BORDER_RADIUS_MAP['full']).toBe('1.5rem')
  })
})

describe('FONT_VARIABLE_MAP', () => {
  it('mapeia inter para var(--font-inter)', () => {
    expect(FONT_VARIABLE_MAP['inter']).toBe('var(--font-inter)')
  })
})

describe('buildCssVariables', () => {
  it('gera string CSS com variáveis oklch válidas', () => {
    const result = buildCssVariables({
      primaryColor: '#191919',
      secondaryColor: '#6366f1',
      accentColor: '#f59e0b',
      backgroundColor: '#f8f8f7',
      fontFamily: 'inter',
      borderRadius: 'medium',
      colorScheme: 'light',
      logoUrl: null,
    })
    expect(result.styleTag).toContain('--primary:')
    expect(result.styleTag).toContain('--background:')
    expect(result.styleTag).toContain('--radius:')
    expect(result.styleTag).toContain('--font-sans:')
    expect(result.styleTag).toContain('oklch(')
  })

  it('isDark é true quando colorScheme é dark', () => {
    const result = buildCssVariables({
      primaryColor: '#191919',
      secondaryColor: '#6366f1',
      accentColor: '#f59e0b',
      backgroundColor: '#1a1a1a',
      fontFamily: 'inter',
      borderRadius: 'medium',
      colorScheme: 'dark',
      logoUrl: null,
    })
    expect(result.isDark).toBe(true)
  })

  it('isDark é false quando colorScheme é light', () => {
    const result = buildCssVariables({
      primaryColor: '#191919',
      secondaryColor: '#6366f1',
      accentColor: '#f59e0b',
      backgroundColor: '#f8f8f7',
      fontFamily: 'inter',
      borderRadius: 'medium',
      colorScheme: 'light',
      logoUrl: null,
    })
    expect(result.isDark).toBe(false)
  })
})

describe('deriveSecondary', () => {
  it('retorna string oklch válida para cor rose', () => {
    const result = deriveSecondary('#e11d48')
    expect(result).toMatch(/^oklch\(/)
  })

  it('tem luminosidade alta (>0.9) para qualquer cor primária', () => {
    const result = deriveSecondary('#4f46e5')
    const match = result.match(/oklch\(([\d.]+)/)
    expect(match).not.toBeNull()
    expect(parseFloat(match![1])).toBeGreaterThan(0.9)
  })
})

describe('deriveAccent', () => {
  it('retorna string oklch com luminosidade mais alta que deriveSecondary', () => {
    const sec = deriveSecondary('#4f46e5')
    const acc = deriveAccent('#4f46e5')
    const lSec = parseFloat(sec.match(/oklch\(([\d.]+)/)![1])
    const lAcc = parseFloat(acc.match(/oklch\(([\d.]+)/)![1])
    expect(lAcc).toBeGreaterThanOrEqual(lSec)
  })
})

describe('hexToOklchStr', () => {
  it('converte hex para string oklch(L C H)', () => {
    const result = hexToOklchStr('#ffffff')
    expect(result).toMatch(/^oklch\(1(\.\d+)? 0(\.\d+)? 0(\.\d+)?/)
  })
})

describe('calcForeground com input oklch', () => {
  it('retorna escuro para string oklch de luminosidade alta', () => {
    expect(calcForeground('oklch(0.93 0.04 264)')).toBe('oklch(0.145 0 0)')
  })

  it('retorna claro para string oklch de luminosidade baixa', () => {
    expect(calcForeground('oklch(0.2 0.1 30)')).toBe('oklch(0.985 0 0)')
  })
})

describe('buildCssVariables com secondary derivado (oklch string)', () => {
  it('styleTag contém --sidebar-accent', () => {
    const result = buildCssVariables({
      primaryColor: '#e11d48',
      secondaryColor: 'oklch(0.93 0.04 14.5)',
      accentColor: 'oklch(0.95 0.03 14.5)',
      backgroundColor: '#f8f8f7',
      fontFamily: 'inter',
      borderRadius: 'medium',
      colorScheme: 'light',
      logoUrl: null,
    })
    expect(result.styleTag).toContain('--sidebar-accent:')
    expect(result.styleTag).toContain('--ring:')
  })
})
