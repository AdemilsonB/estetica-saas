'use client'

import { ChevronLeft } from 'lucide-react'
import { EntityImage } from '@/components/domain/shared/entity-image'
import type { PublicProfessional } from '@/app/(public)/agendar/[slug]/types'

export function ProfessionalStep({
  professionals,
  onSelect,
  onBack,
  primaryColor,
}: {
  professionals: PublicProfessional[]
  onSelect: (professional: PublicProfessional | null) => void
  onBack: () => void
  primaryColor: string
}) {
  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 -ml-1 py-1 px-1 rounded"
      >
        <ChevronLeft className="size-4" />
        Voltar
      </button>

      <div>
        <h2 className="text-xl font-semibold text-slate-900">Escolha o profissional</h2>
        <p className="text-sm text-slate-500 mt-1">Ou selecione o primeiro disponível</p>
      </div>

      {/* Qualquer disponível — largura total */}
      <button
        onClick={() => onSelect(null)}
        className="w-full text-left rounded-xl border-2 border-dashed border-slate-200 bg-white p-4 hover:border-slate-400 transition-all"
      >
        <p className="font-medium text-slate-700 text-sm">Qualquer disponível</p>
        <p className="text-xs text-slate-400 mt-0.5">Próximo horário livre entre todos</p>
      </button>

      {/* Grid de profissionais com foto média + nome */}
      <div className="grid grid-cols-2 gap-3">
        {professionals.map((professional) => (
          <button
            key={professional.id}
            onClick={() => onSelect(professional)}
            className="flex flex-col items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-400 hover:shadow-sm transition-all text-center"
          >
            <EntityImage
              src={professional.avatarUrl}
              alt={professional.name}
              shape="circle"
              cropX={professional.avatarCropX}
              cropY={professional.avatarCropY}
              cropZoom={professional.avatarCropZoom}
              className="size-20 border border-slate-100 shrink-0"
              fallback={
                <div
                  className="flex size-full items-center justify-center text-white font-bold text-2xl"
                  style={{ backgroundColor: primaryColor }}
                >
                  {professional.name[0]?.toUpperCase()}
                </div>
              }
            />
            <p className="font-medium text-slate-900 text-sm leading-tight">{professional.name}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
