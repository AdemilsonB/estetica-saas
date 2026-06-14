'use client'

import { Check, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

const COMPRIMENTO_PT: Record<string, string> = {
  nuca: 'Nuca', ombro: 'Ombro', meio_costas: 'Meio das costas',
  cintura: 'Cintura', mais_cintura: 'Além da cintura',
}

type Summary = {
  comprimento?: string
  tipoFio?: string
  objetivos?: string[]
  temQuimicaRecente?: boolean
}

type Props = {
  ageDays: number
  isValid: boolean
  summary: Summary | null
  primaryColor: string
  onReuse: () => void
  onUpdate: () => void
}

export function AnamneseReuseScreen({ ageDays, isValid, summary, primaryColor, onReuse, onUpdate }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Ficha existente encontrada</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Encontramos suas informações de {ageDays} dia(s) atrás.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
        {summary?.comprimento && (
          <div className="p-3">
            <p className="text-xs text-slate-400">Comprimento</p>
            <p className="text-sm font-medium text-slate-800">{COMPRIMENTO_PT[summary.comprimento] ?? summary.comprimento}</p>
          </div>
        )}
        {(summary?.objetivos?.length ?? 0) > 0 && (
          <div className="p-3">
            <p className="text-xs text-slate-400 mb-1">Objetivos</p>
            <div className="flex flex-wrap gap-1">
              {summary!.objetivos!.map((o) => (
                <span key={o} className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                  {o.replace('_', ' ')}
                </span>
              ))}
            </div>
          </div>
        )}
        {summary?.temQuimicaRecente && (
          <div className="p-3">
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              ⚠️ Química recente registrada
            </span>
          </div>
        )}
      </div>

      {!isValid && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
          Seus dados têm {ageDays} dias. Recomendamos atualizar para uma estimativa mais precisa.
        </div>
      )}

      <div className="space-y-2">
        <Button onClick={onReuse} className="w-full gap-2" style={{ backgroundColor: primaryColor }}>
          <Check className="size-4" />
          Usar essas informações
        </Button>
        <Button variant="outline" onClick={onUpdate} className="w-full gap-2">
          <RefreshCw className="size-4" />
          Atualizar minha ficha
        </Button>
      </div>
    </div>
  )
}
