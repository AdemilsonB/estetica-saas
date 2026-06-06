'use client'

import { ChevronLeft } from 'lucide-react'
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
  // primaryColor é usado nos avatares dos profissionais
  void primaryColor

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

      <div className="space-y-2">
        {/* Qualquer disponível — sempre primeiro */}
        <button
          onClick={() => onSelect(null)}
          className="w-full text-left rounded-xl border-2 border-dashed border-slate-200 bg-white p-4 hover:border-slate-400 transition-all"
        >
          <p className="font-medium text-slate-700 text-sm">Qualquer disponível</p>
          <p className="text-xs text-slate-400 mt-0.5">Próximo horário livre entre todos</p>
        </button>

        {professionals.map((professional) => (
          <button
            key={professional.id}
            onClick={() => onSelect(professional)}
            className="w-full text-left rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-400 hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-3">
              <div
                className="size-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0"
                style={{ backgroundColor: primaryColor }}
              >
                {professional.name[0]?.toUpperCase()}
              </div>
              <p className="font-medium text-slate-900 text-sm">{professional.name}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
