'use client'

import { forwardRef, useState, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type CurrencyInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  value: string
  onChange: (rawValue: string) => void
}

function centsToDisplay(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function valueToDisplay(value: string): string {
  if (!value) return ''
  const num = parseFloat(value)
  if (isNaN(num)) return ''
  return centsToDisplay(Math.round(num * 100))
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, className, ...props }, ref) => {
    const [display, setDisplay] = useState(() => valueToDisplay(value))

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const digits = e.target.value.replace(/\D/g, '')
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
      <Input
        ref={ref}
        {...props}
        value={display}
        onChange={handleChange}
        inputMode="numeric"
        className={cn(className)}
      />
    )
  },
)
CurrencyInput.displayName = 'CurrencyInput'
