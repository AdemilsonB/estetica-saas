'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { ClipboardList } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCustomerAnamnese, useSaveCustomerAnamnese } from '@/hooks/crm/use-customer-anamnese'

type Props = {
  open: boolean
  onClose: () => void
  customerId: string
  customerName: string
}

export function AnamneseSheet({ open, onClose, customerId, customerName }: Props) {
  const { data: anamnese, isLoading } = useCustomerAnamnese(customerId)
  const { mutateAsync: save, isPending: saving } = useSaveCustomerAnamnese(customerId)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')

  async function handleSave(blockType: string, data: unknown) {
    setSaveState('saving')
    try {
      await save({ blockType, data })
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2000)
    } catch {
      toast.error('Erro ao salvar anamnese')
      setSaveState('idle')
    }
  }

  const hasBlocks = anamnese && anamnese.blocks && Object.keys(anamnese.blocks).length > 0

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[600px] flex flex-col">
        <SheetHeader>
          <SheetTitle>Anamnese — {customerName}</SheetTitle>
          {anamnese?.updatedAt && (
            <p className="text-xs text-slate-400 mt-0.5">
              Última atualização:{' '}
              {new Date(anamnese.updatedAt).toLocaleDateString('pt-BR')}
            </p>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : !hasBlocks ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <ClipboardList className="size-10 text-slate-300" />
              <p className="text-sm text-slate-400">
                Nenhuma ficha de anamnese preenchida ainda.
              </p>
              <p className="text-xs text-slate-400 max-w-xs">
                A ficha é preenchida pelo cliente no momento do agendamento ou pelo profissional durante o atendimento.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {anamnese.blockTypes.map((blockType) => {
                const blockData = anamnese.blocks[blockType as keyof typeof anamnese.blocks]
                if (!blockData) return null
                return (
                  <div
                    key={blockType}
                    className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-slate-800 capitalize">
                        {blockType === 'capilar' ? 'Análise Capilar' : blockType}
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => handleSave(blockType, blockData)}
                        disabled={saving}
                      >
                        {saving ? 'Salvando...' : 'Atualizar'}
                      </Button>
                    </div>
                    <pre className="text-xs text-slate-600 whitespace-pre-wrap break-words">
                      {JSON.stringify(blockData, null, 2)}
                    </pre>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="border-t pt-3 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            {saveState === 'saving' && 'Salvando...'}
            {saveState === 'saved' && (
              <span className="text-emerald-600">Salvo ✓</span>
            )}
          </p>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
