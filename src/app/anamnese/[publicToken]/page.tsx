'use client'

import { use } from 'react'
import { ClipboardList } from 'lucide-react'

export default function PublicAnamnesePage({
  params,
}: {
  params: Promise<{ publicToken: string }>
}) {
  // publicToken mantido para compatibilidade com links já enviados
  void use(params)

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="text-center space-y-3">
        <ClipboardList className="size-12 text-slate-300 mx-auto" />
        <p className="text-lg font-semibold text-slate-800">Link não disponível</p>
        <p className="mt-1 text-sm text-slate-500 max-w-xs mx-auto">
          Este link de anamnese não é mais válido. A ficha de anamnese agora é preenchida
          diretamente no momento do agendamento.
        </p>
      </div>
    </div>
  )
}
