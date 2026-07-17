// src/components/domain/landing/use-count-up.ts
'use client'

import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

export type ParsedMetric = {
  prefix: string
  number: number
  decimals: number
  suffix: string
}

/** Separa "+1.200", "98%", "-40%", "24h", "4,9" em partes animáveis. */
export function parseMetric(value: string): ParsedMetric | null {
  const match = value.match(/^(\D*?)([\d.,]+)(\D*)$/)
  if (!match) return null
  const [, prefixRaw, numRaw, suffix] = match
  // Normaliza pt-BR: remove separador de milhar '.', troca decimal ',' por '.'
  const normalized = numRaw.replace(/\./g, '').replace(',', '.')
  const number = Number(normalized)
  if (Number.isNaN(number)) return null
  const decimals = numRaw.includes(',') ? (numRaw.split(',')[1]?.length ?? 0) : 0
  return { prefix: prefixRaw, number, decimals, suffix }
}

export function formatMetric(number: number, decimals: number): string {
  return number.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** Anima 0 → alvo quando `active` fica true. Reduced-motion = valor final direto. */
export function useCountUp(value: string, active: boolean): string {
  const reduceMotion = useReducedMotion()
  const parsed = parseMetric(value)
  const [display, setDisplay] = useState<string>(() =>
    parsed ? `${parsed.prefix}${formatMetric(0, parsed.decimals)}${parsed.suffix}` : value,
  )

  useEffect(() => {
    if (!parsed) {
      setDisplay(value)
      return
    }
    if (!active) return
    if (reduceMotion) {
      setDisplay(`${parsed.prefix}${formatMetric(parsed.number, parsed.decimals)}${parsed.suffix}`)
      return
    }
    const duration = 1500
    const start = performance.now()
    let raf = 0
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(`${parsed.prefix}${formatMetric(parsed.number * eased, parsed.decimals)}${parsed.suffix}`)
      if (p < 1) raf = requestAnimationFrame(step)
      else setDisplay(`${parsed.prefix}${formatMetric(parsed.number, parsed.decimals)}${parsed.suffix}`)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, value, reduceMotion])

  return display
}
