'use client'

import { useState } from 'react'
import { ContactRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useEvolutionStatus, useEvolutionContacts } from '@/hooks/settings/use-evolution-status'
import { EvolutionContactsImport } from '@/components/domain/settings/evolution-contacts-import'
import { ImportContactsModal } from './import-contacts-modal'
import { ImportOriginChooser } from './import-origin-chooser'

type Mode = 'chooser' | 'vcf' | 'whatsapp' | null

export function ImportContactsButton() {
  const [mode, setMode] = useState<Mode>(null)
  // Só consulta o status do WhatsApp quando o seletor de origem abre
  const { data: status } = useEvolutionStatus({ enabled: mode === 'chooser' })
  const whatsappConnected = status?.connected === true

  // Pré-carrega os contatos junto com o seletor: ao escolher "Do WhatsApp
  // conectado" a lista já vem pronta do cache (mesma queryKey do modal).
  useEvolutionContacts({ enabled: mode === 'chooser' && whatsappConnected })

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setMode('chooser')}
        className="h-11 shrink-0 gap-2 rounded-lg px-3"
      >
        <ContactRound className="size-5" />
        <span>Importar</span>
      </Button>

      {/* Seletor de origem — um Dialog por vez, nunca aninhados */}
      <Dialog open={mode === 'chooser'} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Importar clientes</DialogTitle>
          </DialogHeader>

          <ImportOriginChooser
            enabled={mode === 'chooser'}
            onSelectWhatsapp={() => setMode('whatsapp')}
            onSelectVcf={() => setMode('vcf')}
          />
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
