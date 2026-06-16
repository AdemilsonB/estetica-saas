'use client'

import { type ReactNode } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

interface SettingsCardSheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function SettingsCardSheet({ open, onClose, title, children }: SettingsCardSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-6 pb-6">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  )
}
