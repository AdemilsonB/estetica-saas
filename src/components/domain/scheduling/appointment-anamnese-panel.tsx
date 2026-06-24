'use client'

import { useQuery } from '@tanstack/react-query'
import { Scissors, AlertTriangle, Camera } from 'lucide-react'
import type { CapilarBlock } from '@/domains/crm/anamnese-blocks.types'
import type { SugestaoPreco } from '@/domains/crm/price-suggestion'

type AnamneseData = {
  anamnese: {
    id: string
    blocks: { capilar?: CapilarBlock }
    blockTypes: string[]
    updatedAt: string
  }
  sugestaoPreco: SugestaoPreco | null
}

const COMPRIMENTO_PT: Record<string, string> = {
  nuca: 'Nuca',
  ombro: 'Ombro',
  meio_costas: 'Meio das costas',
  cintura: 'Cintura',
  mais_cintura: 'Além da cintura',
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

type Props = {
  appointmentId: string
  onPriceAdjust?: (price: number) => void
}

export function AppointmentAnamnesePanel({ appointmentId, onPriceAdjust }: Props) {
  const { data, isLoading } = useQuery<AnamneseData | null>({
    queryKey: ['appointment-anamnese', appointmentId],
    queryFn: async () => {
      const res = await fetch(`/api/scheduling/appointments/${appointmentId}/anamnese`)
      if (!res.ok) return null
      return res.json()
    },
    staleTime: 2 * 60 * 1000,
  })

  if (isLoading) return (
    <div className="flex items-center justify-center p-6">
      <div className="size-5 rounded-full border-2 border-slate-300 border-t-slate-700 animate-spin" />
    </div>
  )

  if (!data?.anamnese) return null

  const capilar = data.anamnese.blocks.capilar
  const sugestao = data.sugestaoPreco

  const temQuimicaRecente = capilar && [capilar.coloracao, capilar.descoloracao, capilar.progressiva, capilar.botox]
    .some((c) => c?.feito && c.quando === 'menos_30_dias')

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ficha do cliente</p>

      <div className="flex flex-wrap gap-2">
        {capilar?.comprimento && (
          <span className="flex items-center gap-1.5 text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">
            <Scissors className="size-3" />
            {COMPRIMENTO_PT[capilar.comprimento] ?? capilar.comprimento}
            {capilar.tipoFio && ` · ${capilar.tipoFio}`}
          </span>
        )}
        {[capilar?.photoFront, capilar?.photoSide, capilar?.photoBack].filter(Boolean).length > 0 && (
          <span className="flex items-center gap-1.5 text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">
            <Camera className="size-3" />
            {[capilar?.photoFront, capilar?.photoSide, capilar?.photoBack].filter(Boolean).length} foto(s)
          </span>
        )}
        {temQuimicaRecente && (
          <span className="flex items-center gap-1.5 text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">
            <AlertTriangle className="size-3" />
            Química recente
          </span>
        )}
      </div>

      {(capilar?.photoFront ?? capilar?.photoSide ?? capilar?.photoBack) && (
        <div className="flex gap-2">
          {([
            { key: 'photoFront', label: 'Frente', url: capilar?.photoFront },
            { key: 'photoSide',  label: 'Lado',   url: capilar?.photoSide },
            { key: 'photoBack',  label: 'Atrás',  url: capilar?.photoBack },
          ] as const).filter((p) => p.url).map((p) => (
            <div key={p.key} className="flex flex-col items-center gap-0.5">
              <a href={p.url} target="_blank" rel="noopener noreferrer"
                className="size-16 rounded-lg overflow-hidden border border-slate-200 block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.label} className="w-full h-full object-cover" />
              </a>
              <span className="text-[10px] text-slate-400">{p.label}</span>
            </div>
          ))}
        </div>
      )}

      {(capilar?.objetivos?.length ?? 0) > 0 && (
        <div>
          <p className="text-xs text-slate-400 mb-1">Objetivo</p>
          <div className="flex flex-wrap gap-1">
            {capilar!.objetivos!.map((o) => (
              <span key={o} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                {o.replace('_', ' ')}
              </span>
            ))}
          </div>
          {capilar?.descricaoLivre && (
            <p className="text-xs text-slate-600 mt-1 italic whitespace-pre-line">"{capilar.descricaoLivre}"</p>
          )}
        </div>
      )}

      {sugestao && sugestao.ajustes.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
          <p className="text-xs font-semibold text-amber-800">Sugestão de ajuste de preço</p>
          <div className="space-y-1">
            {sugestao.ajustes.map((a, i) => (
              <div key={i} className="flex items-center justify-between text-xs text-amber-700">
                <span>{a.motivo}</span>
                <span className="font-medium">+{formatCurrency(a.valorAdicional)}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between text-sm font-semibold text-amber-900 pt-1 border-t border-amber-200">
            <span>Valor sugerido</span>
            <span>{formatCurrency(sugestao.valorSugerido)}</span>
          </div>
          {onPriceAdjust && (
            <button onClick={() => onPriceAdjust(sugestao.valorSugerido)}
              className="w-full mt-1 text-xs text-amber-700 underline hover:text-amber-900">
              Aplicar valor sugerido
            </button>
          )}
        </div>
      )}
    </div>
  )
}
