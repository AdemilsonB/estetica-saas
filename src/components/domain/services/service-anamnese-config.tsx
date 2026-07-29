'use client'

import { Label } from '@/components/ui/label'
import { NumberInput } from '@/components/ui/number-input'

type AnamneseMode = 'NONE' | 'OPTIONAL' | 'REQUIRED'

type Props = {
  mode: AnamneseMode
  validityDays: number
  onModeChange: (mode: AnamneseMode) => void
  onValidityDaysChange: (days: number) => void
}

const MODOS: { value: AnamneseMode; label: string }[] = [
  { value: 'NONE',     label: 'Não solicitar' },
  { value: 'OPTIONAL', label: 'Opcional — cliente pode pular' },
  { value: 'REQUIRED', label: 'Obrigatória — exigida para avançar' },
]

export function ServiceAnamneseConfig({ mode, validityDays, onModeChange, onValidityDaysChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium">Anamnese no agendamento</Label>
        <div className="space-y-1.5">
          {MODOS.map(({ value, label }) => (
            <label key={value} className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                name="anamneseMode"
                value={value}
                checked={mode === value}
                onChange={() => onModeChange(value)}
                className="accent-primary"
              />
              {label}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Quando ativada, será solicitada ficha capilar do cliente durante o agendamento.
        </p>
      </div>

      {mode !== 'NONE' && (
        <div className="space-y-1.5">
          <Label htmlFor="validity-days" className="text-sm font-medium">
            Validade da ficha (dias)
          </Label>
          <div className="w-32">
            <NumberInput
              id="validity-days"
              min={7}
              max={365}
              suffix="dias"
              value={String(validityDays)}
              onChange={(v) => onValidityDaysChange(v === '' ? 7 : Number(v))}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Após esse prazo o cliente será solicitado a atualizar a ficha.
          </p>
        </div>
      )}
    </div>
  )
}
