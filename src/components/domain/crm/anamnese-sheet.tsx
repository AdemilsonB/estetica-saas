'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { ExternalLink } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AnamneseFormField } from './anamnese-form-field'
import { AnamneseSendLinkDialog } from './anamnese-send-link-dialog'
import { useCustomerAnamnese, useSaveAnamnese } from '@/hooks/crm/use-customer-anamnese'
import { useAnamneseTemplate } from '@/hooks/crm/use-anamnese-template'
import { DEFAULT_LINK_MESSAGE } from '@/domains/crm/types'
import type { FieldDef } from '@/domains/crm/types'

const SECTIONS: { key: string; label: string }[] = [
  { key: 'basico',    label: 'Informações básicas' },
  { key: 'saude',     label: 'Histórico de saúde' },
  { key: 'estetico',  label: 'Histórico estético' },
  { key: 'objetivos', label: 'Objetivos e expectativas' },
]

type Props = {
  open: boolean
  onClose: () => void
  customerId: string
  customerName: string
}

export function AnamneseSheet({ open, onClose, customerId, customerName }: Props) {
  const { data: template, isLoading: loadingTemplate } = useAnamneseTemplate()
  const { data: anamnese, isLoading: loadingAnamnese } = useCustomerAnamnese(customerId)
  const { mutateAsync: save } = useSaveAnamnese(customerId)

  const [formData, setFormData] = useState<
    Record<string, string | string[] | boolean | null>
  >({})
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (anamnese?.data) {
      setFormData(anamnese.data as Record<string, string | string[] | boolean | null>)
    }
  }, [anamnese])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const doSave = useCallback(
    async (data: Record<string, string | string[] | boolean | null>) => {
      setSaveState('saving')
      try {
        await save(data)
        setSaveState('saved')
        setTimeout(() => setSaveState('idle'), 2000)
      } catch {
        toast.error('Erro ao salvar anamnese')
        setSaveState('idle')
      }
    },
    [save],
  )

  function handleFieldChange(
    fieldId: string,
    value: string | string[] | boolean | null,
  ) {
    const updated = { ...formData, [fieldId]: value }
    setFormData(updated)
    setSaveState('idle')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSave(updated), 2000)
  }

  const fields: FieldDef[] = template?.fields ?? []
  const isLoading = loadingTemplate || loadingAnamnese

  const linkMessage =
    template?.linkMessage ??
    DEFAULT_LINK_MESSAGE.replace('{nome}', customerName)

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-[600px] flex flex-col">
          <SheetHeader className="flex-row items-center justify-between pr-6">
            <div>
              <SheetTitle>Anamnese — {customerName}</SheetTitle>
              {anamnese?.filledAt && (
                <p className="text-xs text-slate-400 mt-0.5">
                  Última atualização:{' '}
                  {anamnese.filledBy === 'client' ? 'cliente' : 'profissional'} ·{' '}
                  {new Date(anamnese.filledAt).toLocaleDateString('pt-BR')}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1 text-xs"
              onClick={() => setLinkDialogOpen(true)}
            >
              <ExternalLink className="size-3" />
              Enviar link
            </Button>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto py-4">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : fields.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">
                Nenhum campo no template. Configure em Configurações → CRM.
              </p>
            ) : (
              <Accordion
                type="single"
                collapsible
                defaultValue="basico"
                className="space-y-2"
              >
                {SECTIONS.map(({ key, label }) => {
                  const sectionFields = fields.filter((f) => f.section === key)
                  if (sectionFields.length === 0) return null
                  return (
                    <AccordionItem
                      key={key}
                      value={key}
                      className="border rounded-lg px-3"
                    >
                      <AccordionTrigger className="text-sm font-medium py-3">
                        {label}
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 pb-3">
                          {sectionFields.map((field) => (
                            <AnamneseFormField
                              key={field.id}
                              field={field}
                              value={formData[field.id] ?? null}
                              onChange={(v) => handleFieldChange(field.id, v)}
                            />
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )
                })}
              </Accordion>
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

      <AnamneseSendLinkDialog
        open={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        customerId={customerId}
        customerName={customerName}
        defaultMessage={linkMessage}
      />
    </>
  )
}
