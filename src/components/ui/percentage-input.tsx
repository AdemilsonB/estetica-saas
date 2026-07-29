'use client'

import { forwardRef, useState, useCallback, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type PercentageInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'value' | 'type'
> & {
  /** Valor cru como string (ex: '12.5'). String vazia = campo sem valor. */
  value: string
  /** Emite o valor cru ou '' quando o campo é esvaziado. */
  onChange: (rawValue: string) => void
  /** Teto aceito. Padrão 100. */
  max?: number
}

/** Converte o valor cru do pai ('12.50') para o texto exibido ('12,5'). */
function rawToDisplay(value: string): string {
  if (value === '' || value === null || value === undefined) return ''
  const num = Number(value)
  if (!Number.isFinite(num)) return ''
  return num.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

/**
 * Campo de percentual.
 *
 * O sufixo '%' é adorno visual fora do <input>, então não é apagável nem
 * atrapalha a digitação. O campo pode ser esvaziado por completo (emite ''),
 * nunca fica preso num zero.
 */
export const PercentageInput = forwardRef<HTMLInputElement, PercentageInputProps>(
  ({ value, onChange, className, max = 100, placeholder = '0', disabled, ...props }, ref) => {
    const [display, setDisplay] = useState(() => rawToDisplay(value))

    // Sincroniza quando o valor muda por fora (ex: "aplicar em massa" na grade
    // de comissões), sem atropelar a digitação em curso.
    useEffect(() => {
      const incoming = rawToDisplay(value)
      setDisplay((current) => {
        const currentNum = Number(current.replace(',', '.'))
        const incomingNum = Number(incoming.replace(',', '.'))
        if (current !== '' && incoming !== '' && currentNum === incomingNum) return current
        return current === incoming ? current : incoming
      })
    }, [value])

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        // Aceita dígitos e um separador decimal; normaliza vírgula para ponto.
        const cleaned = e.target.value.replace(/[^\d.,]/g, '').replace(',', '.')
        if (!cleaned) {
          setDisplay('')
          onChange('')
          return
        }
        // Mantém apenas o primeiro separador e no máximo 2 casas.
        const [intPart, ...rest] = cleaned.split('.')
        const decPart = rest.join('').slice(0, 2)
        const normalized = rest.length > 0 ? `${intPart}.${decPart}` : intPart

        const num = Number(normalized)
        if (!Number.isFinite(num) || num < 0 || num > max) return

        setDisplay(normalized.replace('.', ','))
        onChange(normalized)
      },
      [onChange, max],
    )

    const handleBlur = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        // Normaliza a exibição ao sair ('12,' → '12'), preservando o campo vazio.
        setDisplay(rawToDisplay(value))
        props.onBlur?.(e)
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [value, props.onBlur],
    )

    return (
      <div className="relative w-full">
        <Input
          ref={ref}
          {...props}
          disabled={disabled}
          value={display}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          inputMode="decimal"
          autoComplete="off"
          className={cn('pr-7', className)}
        />
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground select-none',
            disabled && 'opacity-50',
          )}
        >
          %
        </span>
      </div>
    )
  },
)
PercentageInput.displayName = 'PercentageInput'
