'use client'

import { useRef } from 'react'
import { Upload, Users, CheckCircle2, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { useImportContacts, supportsContactPicker } from '@/hooks/crm/use-import-contacts'

type Props = {
  open: boolean
  onClose: () => void
}

export function ImportContactsModal({ open, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const {
    step,
    contacts,
    result,
    error,
    selectedCount,
    newCount,
    existingCount,
    reset,
    pickFromDevice,
    pickFromVCard,
    toggleContact,
    toggleAll,
    importSelected,
  } = useImportContacts()

  function handleClose() {
    reset()
    onClose()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) pickFromVCard(file)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importar contatos</DialogTitle>
        </DialogHeader>

        {/* Estado: idle — escolha do método */}
        {step === 'idle' && (
          <div className="space-y-3 pt-2">
            {supportsContactPicker() ? (
              <Button
                onClick={pickFromDevice}
                className="w-full justify-start gap-3 h-14 rounded-2xl border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                variant="outline"
              >
                <Users className="size-5 text-slate-500" />
                <div className="text-left">
                  <p className="text-sm font-medium">Selecionar dos contatos</p>
                  <p className="text-xs text-slate-500">Abre os contatos do dispositivo</p>
                </div>
              </Button>
            ) : (
              <Button
                onClick={() => fileRef.current?.click()}
                className="w-full justify-start gap-3 h-14 rounded-2xl border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                variant="outline"
              >
                <Upload className="size-5 text-slate-500" />
                <div className="text-left">
                  <p className="text-sm font-medium">Importar arquivo .vcf</p>
                  <p className="text-xs text-slate-500">
                    No iPhone: Contatos → Exportar → Todos os contatos
                  </p>
                </div>
              </Button>
            )}

            <input
              ref={fileRef}
              type="file"
              accept=".vcf,text/vcard"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        )}

        {/* Estado: loading */}
        {step === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="size-8 animate-spin text-slate-400" />
            <p className="text-sm text-slate-500">Carregando contatos...</p>
          </div>
        )}

        {/* Estado: preview — seleção dos contatos */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">
                <span className="font-medium text-slate-900">{newCount} novos</span>
                {existingCount > 0 && (
                  <span className="text-slate-400"> · {existingCount} já cadastrados</span>
                )}
              </p>
              <button
                className="text-xs text-slate-500 underline underline-offset-2"
                onClick={() => toggleAll(selectedCount < newCount)}
              >
                {selectedCount < newCount ? 'Selecionar todos' : 'Desmarcar todos'}
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-1 rounded-xl border border-slate-100 p-1">
              {contacts.map((contact) => (
                <label
                  key={contact.phone}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition ${
                    contact.alreadyExists
                      ? 'opacity-50 cursor-default'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <Checkbox
                    checked={contact.selected}
                    disabled={contact.alreadyExists}
                    onCheckedChange={() => !contact.alreadyExists && toggleContact(contact.phone)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {contact.name}
                    </p>
                    <p className="text-xs text-slate-500">{contact.phone}</p>
                  </div>
                  {contact.alreadyExists && (
                    <Badge className="shrink-0 rounded-full bg-slate-100 px-2 text-[10px] text-slate-500">
                      Já cadastrado
                    </Badge>
                  )}
                </label>
              ))}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-slate-950 text-white hover:bg-slate-800"
                disabled={selectedCount === 0}
                onClick={importSelected}
              >
                Importar {selectedCount > 0 ? `(${selectedCount})` : ''}
              </Button>
            </div>
          </div>
        )}

        {/* Estado: importing */}
        {step === 'importing' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="size-8 animate-spin text-slate-400" />
            <p className="text-sm text-slate-500">Importando contatos...</p>
          </div>
        )}

        {/* Estado: done */}
        {step === 'done' && result && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="size-10 text-green-500" />
            <div>
              <p className="font-medium text-slate-900">
                {result.created} contato{result.created !== 1 ? 's' : ''} importado{result.created !== 1 ? 's' : ''}
              </p>
              {result.skipped > 0 && (
                <p className="text-sm text-slate-500">
                  {result.skipped} já estavam cadastrados
                </p>
              )}
            </div>
            <Button onClick={handleClose} className="mt-2 bg-slate-950 text-white hover:bg-slate-800">
              Fechar
            </Button>
          </div>
        )}

        {/* Estado: error */}
        {step === 'error' && (
          <div className="space-y-4 py-4 text-center">
            <p className="text-sm text-red-600">{error}</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={reset}>
                Tentar novamente
              </Button>
              <Button variant="ghost" onClick={handleClose}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
