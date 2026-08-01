'use client'

import Link from 'next/link'
import { MessageCircle, Smartphone, ChevronRight } from 'lucide-react'
import { useEvolutionStatus } from '@/hooks/settings/use-evolution-status'

type Props = {
  /** Só consulta o status do WhatsApp enquanto este passo estiver visível. */
  enabled: boolean
  onSelectWhatsapp: () => void
  onSelectVcf: () => void
  whatsappSubtitle?: string
  vcfSubtitle?: string
}

/**
 * Passo "de onde vem o contato" — WhatsApp conectado ou agenda do celular/.vcf.
 * Usado tanto no importador em massa de /clientes quanto no atalho de importar
 * um contato dentro do formulário de Novo cliente.
 */
export function ImportOriginChooser({
  enabled,
  onSelectWhatsapp,
  onSelectVcf,
  whatsappSubtitle = 'Traz seus contatos com revisão antes de salvar',
  vcfSubtitle = 'Contatos do aparelho ou arquivo .vcf',
}: Props) {
  const { data: status, isLoading } = useEvolutionStatus({ enabled })
  const whatsappConnected = status?.connected === true

  return (
    <div className="space-y-3 pt-2">
      {whatsappConnected ? (
        <button
          type="button"
          onClick={onSelectWhatsapp}
          className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:bg-slate-50"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100">
            <MessageCircle className="size-5 text-emerald-600" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-slate-900">
              Do WhatsApp conectado
            </span>
            <span className="block text-xs text-slate-500">{whatsappSubtitle}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-slate-400" />
        </button>
      ) : (
        <div className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-200">
            <MessageCircle className="size-5 text-slate-500" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-slate-700">Do WhatsApp</span>
            <span className="block text-xs text-slate-500">
              {isLoading ? 'Verificando conexão...' : 'WhatsApp não conectado'}
            </span>
          </span>
          {!isLoading && (
            <Link
              href="/configuracoes"
              className="shrink-0 text-xs font-medium text-primary underline underline-offset-2"
            >
              Conectar
            </Link>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={onSelectVcf}
        className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:bg-slate-50"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-violet-100">
          <Smartphone className="size-5 text-violet-600" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-slate-900">Da agenda do celular</span>
          <span className="block text-xs text-slate-500">{vcfSubtitle}</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-slate-400" />
      </button>
    </div>
  )
}
