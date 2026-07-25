'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ContactRound, MessageCircle, Smartphone, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useEvolutionStatus } from '@/hooks/settings/use-evolution-status'
import { EvolutionContactsImport } from '@/components/domain/settings/evolution-contacts-import'
import { ImportContactsModal } from './import-contacts-modal'

type Mode = 'chooser' | 'vcf' | 'whatsapp' | null

export function ImportContactsButton() {
  const [mode, setMode] = useState<Mode>(null)
  // Só consulta o status do WhatsApp quando o seletor de origem abre
  const { data: status, isLoading } = useEvolutionStatus({ enabled: mode === 'chooser' })

  const whatsappConnected = status?.connected === true

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setMode('chooser')}
        className="shrink-0 rounded-full"
      >
        <ContactRound className="size-4" />
        <span className="hidden sm:inline">Importar</span>
      </Button>

      {/* Seletor de origem — um Dialog por vez, nunca aninhados */}
      <Dialog open={mode === 'chooser'} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Importar clientes</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            {whatsappConnected ? (
              <button
                type="button"
                onClick={() => setMode('whatsapp')}
                className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:bg-slate-50"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                  <MessageCircle className="size-5 text-emerald-600" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-slate-900">
                    Do WhatsApp conectado
                  </span>
                  <span className="block text-xs text-slate-500">
                    Traz seus contatos com revisão antes de salvar
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-slate-400" />
              </button>
            ) : (
              <div className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-200">
                  <MessageCircle className="size-5 text-slate-500" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-slate-700">
                    Do WhatsApp
                  </span>
                  <span className="block text-xs text-slate-500">
                    {isLoading
                      ? 'Verificando conexão...'
                      : 'WhatsApp não conectado'}
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
              onClick={() => setMode('vcf')}
              className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:bg-slate-50"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-violet-100">
                <Smartphone className="size-5 text-violet-600" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-900">
                  Da agenda do celular
                </span>
                <span className="block text-xs text-slate-500">
                  Contatos do aparelho ou arquivo .vcf
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-slate-400" />
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <ImportContactsModal open={mode === 'vcf'} onClose={() => setMode(null)} />
      <EvolutionContactsImport
        open={mode === 'whatsapp'}
        onOpenChange={(o) => !o && setMode(null)}
      />
    </>
  )
}
