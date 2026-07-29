'use client'

import { forwardRef, useState, useCallback, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/** Teto de dígitos para não estourar o Decimal(10,2) do Prisma. */
const MAX_DIGITS = 12

type CurrencyInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'value' | 'type'
> & {
  /** Valor cru em reais, como string (ex: '90.00'). String vazia = campo sem valor. */
  value: string
  /** Emite o valor cru em reais ('90.00') ou '' quando o campo é esvaziado. */
  onChange: (rawValue: string) => void
}

/** Formata centavos como '1.234,56' — sem o prefixo, que é adorno visual. */
function centsToDisplay(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Converte o valor cru do pai ('90.00') para o texto exibido ('90,00'). */
export function rawToDisplay(value: string): string {
  if (value === '' || value === null || value === undefined) return ''
  const num = Number(value)
  if (!Number.isFinite(num)) return ''
  return centsToDisplay(Math.round(num * 100))
}

/**
 * Campo de dinheiro com máscara centavos-primeiro.
 *
 * O prefixo 'R$' é renderizado fora do <input>, então não pode ser apagado nem
 * confundido com conteúdo. Digitar 9 → 0,09; 90 → 0,90; 9000 → 90,00.
 * Apagar tudo deixa o campo vazio (emite ''), nunca um zero imutável.
 */
export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, className, placeholder = '0,00', disabled, ...props }, ref) => {
    const [display, setDisplay] = useState(() => rawToDisplay(value))

    // Mantém o campo em sincronia quando o valor muda por fora (modal de edição
    // que carrega dados async, botão "Cortesia", sugestão vinda da anamnese).
    // Compara pelo valor normalizado para não atropelar a digitação em curso.
    useEffect(() => {
      const incoming = rawToDisplay(value)
      setDisplay((current) => (current === incoming ? current : incoming))
    }, [value])

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, MAX_DIGITS)
        if (!digits) {
          setDisplay('')
          onChange('')
          return
        }
        const cents = parseInt(digits, 10)
        setDisplay(centsToDisplay(cents))
        onChange((cents / 100).toFixed(2))
      },
      [onChange],
    )

    return (
      <div className="relative w-full">
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground select-none',
            disabled && 'opacity-50',
          )}
        >
          R$
        </span>
        <Input
          ref={ref}
          {...props}
          disabled={disabled}
          value={display}
          onChange={handleChange}
          placeholder={placeholder}
          inputMode="numeric"
          autoComplete="off"
          className={cn('pl-9', className)}
        />
      </div>
    )
  },
)
CurrencyInput.displayName = 'CurrencyInput'
