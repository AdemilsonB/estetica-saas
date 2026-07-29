'use client'

import { forwardRef, useState, useCallback, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type NumberInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'value' | 'type' | 'min' | 'max'
> & {
  /** Valor cru como string (ex: '12'). String vazia = campo sem valor. */
  value: string
  /** Emite o valor cru ou '' quando o campo é esvaziado. */
  onChange: (rawValue: string) => void
  min?: number
  max?: number
  /** Sufixo visual não-editável (ex: 'min', 'dias', 'un'). */
  suffix?: string
}

/**
 * Campo de quantidade inteira (estoque, dias, ordem, limites).
 *
 * Ao contrário de <Input type="number"> com estado numérico, este campo pode ser
 * esvaziado por completo: emite '' em vez de reintroduzir um 0 imutável. A tela
 * consumidora decide se vazio bloqueia o envio ou vira um valor padrão.
 */
export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value, onChange, className, min, max, suffix, placeholder = '', disabled, ...props }, ref) => {
    const [display, setDisplay] = useState(() => value ?? '')

    // Sincroniza com atualizações vindas do pai sem atropelar a digitação.
    useEffect(() => {
      const incoming = value ?? ''
      setDisplay((current) => (current === incoming ? current : incoming))
    }, [value])

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const digits = e.target.value.replace(/\D/g, '')
        if (!digits) {
          setDisplay('')
          onChange('')
          return
        }
        // Remove zeros à esquerda ('007' → '7'), preservando o '0' isolado.
        const normalized = String(parseInt(digits, 10))
        const num = Number(normalized)
        if (min !== undefined && num < min) return
        if (max !== undefined && num > max) return

        setDisplay(normalized)
        onChange(normalized)
      },
      [onChange, min, max],
    )

    return (
      <div className="relative w-full">
        <Input
          ref={ref}
          {...props}
          disabled={disabled}
          value={display}
          onChange={handleChange}
          placeholder={placeholder}
          inputMode="numeric"
          autoComplete="off"
          className={cn(suffix && 'pr-12', className)}
        />
        {suffix && (
          <span
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground select-none',
              disabled && 'opacity-50',
            )}
          >
            {suffix}
          </span>
        )}
      </div>
    )
  },
)
NumberInput.displayName = 'NumberInput'
