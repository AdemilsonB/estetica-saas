'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { usePwaInstall } from './use-pwa-install'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InstallInstructionsModal({ open, onOpenChange }: Props) {
  const { platform, deferredPrompt, promptInstall } = usePwaInstall()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Instalar o Agendê</DialogTitle>
          <DialogDescription>
            Tenha o app na tela inicial: abre rápido e sem a barra do navegador.
          </DialogDescription>
        </DialogHeader>

        {platform === 'ios' ? (
          <ol className="space-y-3 text-sm text-slate-700">
            <li>1. Toque no botão <strong>Compartilhar</strong> ⬆️ (base do Safari).</li>
            <li>2. Escolha <strong>Adicionar à Tela de Início</strong>.</li>
            <li>3. Toque em <strong>Adicionar</strong>. Pronto! 🎉</li>
          </ol>
        ) : deferredPrompt ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              É rápido: toque no botão abaixo e confirme a instalação.
            </p>
            <Button
              className="w-full bg-gradient-to-r from-violet-600 to-pink-600 text-white"
              onClick={() => { void promptInstall(); onOpenChange(false) }}
            >
              Instalar agora
            </Button>
          </div>
        ) : (
          <ol className="space-y-3 text-sm text-slate-700">
            <li>1. Abra o menu <strong>⋮</strong> (canto superior direito).</li>
            <li>2. Toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</li>
            <li>3. Confirme. Pronto! 🎉</li>
          </ol>
        )}
      </DialogContent>
    </Dialog>
  )
}
