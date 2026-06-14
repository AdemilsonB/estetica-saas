'use client'

import { Info } from 'lucide-react'

export function SettingsAnamneseTab() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
      <Info className="mt-0.5 size-5 shrink-0 text-blue-500" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-blue-900">
          Anamnese configurada por serviço
        </p>
        <p className="text-sm text-blue-700">
          A ficha de anamnese agora é definida por tipo de serviço. Para configurar quais perguntas
          são exibidas em cada serviço, acesse <strong>Configurações → Serviços</strong> e edite o
          serviço desejado.
        </p>
      </div>
    </div>
  )
}
