'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useSendAnamneseLink } from '@/hooks/crm/use-send-anamnese-link'

type Props = {
  open: boolean
  onClose: () => void
  customerId: string
  customerName: string
  defaultMessage: string
}

export function AnamneseSendLinkDialog({
  open,
  onClose,
  customerId,
  customerName,
  defaultMessage,
}: Props) {
  const [message, setMessage] = useState(defaultMessage)
  const { mutateAsync, isPending } = useSendAnamneseLink(customerId)

  async function handleSend() {
    try {
      await mutateAsync(message)
      toast.success('Link enviado via WhatsApp')
      onClose()
    } catch {
      toast.error('Falha ao enviar link')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar ficha de anamnese</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <Label className="text-xs font-medium text-slate-700">
            Mensagem para {customerName}:
          </Label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-[140px] resize-none text-sm"
          />
          <p className="text-xs text-slate-400">
            Variáveis disponíveis: <code>{'{nome}'}</code>, <code>{'{link}'}</code>
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={isPending || message.trim().length < 10}
            className="bg-slate-950 text-white hover:bg-slate-800"
          >
            {isPending ? 'Enviando...' : 'Enviar via WhatsApp'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
