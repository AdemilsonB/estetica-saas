'use client'

import { useState } from 'react'
import { ContactRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ImportContactsModal } from './import-contacts-modal'

export function ImportContactsButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-full"
      >
        <ContactRound className="size-4" />
        <span className="hidden sm:inline">Importar</span>
      </Button>

      <ImportContactsModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
