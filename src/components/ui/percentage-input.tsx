'use client'

import { forwardRef, useState, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type PercentageInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  value: string
  onChange: (rawValue: string) => void
}

export const PercentageInput = forwardRef<HTMLInputElement, PercentageInputProps>(
  ({ value, onChange, className, ...props }, ref) => {
    const [display, setDisplay] = useState(value ? `${value}%` : '')

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.')
        if (!raw) {
          setDisplay('')
          onChange('')
          return
        }
        const num = parseFloat(raw)
        if (isNaN(num) || num < 0 || num > 100) return
        setDisplay(`${raw}%`)
        onChange(num.toFixed(2))
      },
      [onChange],
    )

    const handleBlur = useCallback(() => {
      const raw = display.replace('%', '').trim().replace(',', '.')
      const num = parseFloat(raw)
      if (!isNaN(num) && num >= 0 && num <= 100) {
        const formatted = num.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
        setDisplay(`${formatted}%`)
        onChange(num.toFixed(2))
      }
    }, [display, onChange])

    return (
      <Input
        ref={ref}
        {...props}
        value={display}
        onChange={handleChange}
        onBlur={handleBlur}
        inputMode="decimal"
        placeholder="0%"
        className={cn(className)}
      />
    )
  },
)
PercentageInput.displayName = 'PercentageInput'
