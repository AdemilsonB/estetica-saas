'use client'

import { useRef, useState } from 'react'
import { ChevronLeft, Loader2, Search, Upload, Users } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ImportOriginChooser } from './import-origin-chooser'
import { useEvolutionContacts } from '@/hooks/settings/use-evolution-status'
import { useImportContacts, supportsContactPicker } from '@/hooks/crm/use-import-contacts'
import { formatBrazilianPhone } from '@/shared/utils/phone'

type Props = {
  open: boolean
  onClose: () => void
  /** Devolve o contato escolhido para o formulário preencher — não cria nada sozinho. */
  onPick: (contact: { name: string; phone: string }) => void
}

type Step = 'chooser' | 'whatsapp' | 'vcf'

/**
 * Atalho para escolher 1 contato (WhatsApp ou agenda do celular) e preencher
 * o formulário de Novo cliente, sem precisar sair pra /clientes e voltar.
 * Sempre aberto empilhado sobre o CreateCustomerModal.
 */
export function PickContactModal({ open, onClose, onPick }: Props) {
  const [step, setStep] = useState<Step>('chooser')
  const [search, setSearch] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const whatsapp = useEvolutionContacts({ enabled: open && step === 'whatsapp' })
  const vcf = useImportContacts()

  function handleClose() {
    setStep('chooser')
    setSearch('')
    vcf.reset()
    onClose()
  }

  function handlePick(name: string, phone: string) {
    onPick({ name: name.trim(), phone })
    handleClose()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length > 0) vcf.pickFromVCards(files)
  }

  const whatsappContacts = whatsapp.data?.contacts ?? []
  const searchNormalized = search.trim().toLowerCase()
  const filteredWhatsapp = searchNormalized
    ? whatsappContacts.filter(
        (c) =>
          c.name.toLowerCase().includes(searchNormalized) ||
          // '' é substring de qualquer string — sem o fallback, uma busca só
          // de letras (sem dígito nenhum) zera pra '' aqui e o .includes('')
          // vira sempre-verdadeiro, anulando o filtro pra QUALQUER contato.
          c.phone.includes(searchNormalized.replace(/\D/g, '') || searchNormalized),
      )
    : whatsappContacts

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()} modal={false}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-md" stacked>
        <DialogHeader>
          <DialogTitle>
            {step === 'chooser'
              ? 'Importar contato'
              : step === 'whatsapp'
                ? 'Contatos do WhatsApp'
                : 'Contatos do celular'}
          </DialogTitle>
        </DialogHeader>

        {step === 'chooser' && (
          <ImportOriginChooser
            enabled={open && step === 'chooser'}
            onSelectWhatsapp={() => setStep('whatsapp')}
            onSelectVcf={() => setStep('vcf')}
            whatsappSubtitle="Escolha um contato da lista"
            vcfSubtitle="Da agenda do aparelho ou de um arquivo .vcf"
          />
        )}

        {step === 'whatsapp' && (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <button
              type="button"
              onClick={() => setStep('chooser')}
              className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              <ChevronLeft className="size-3.5" />
              Voltar
            </button>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar por nome ou número..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Único container com scroll (min-h-0 é o que permite um filho flex
                encolher abaixo do conteúdo e o overflow entrar em ação) — antes
                este container tinha um max-h fixo DENTRO de um DialogContent que
                também rolava sozinho (overflow-y-auto duplo), e nem toque nem a
                digitação na busca conseguiam rolar a lista de forma confiável. */}
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain">
              {whatsapp.isLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="size-6 animate-spin text-slate-400" />
                </div>
              ) : whatsapp.isError ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  Não foi possível carregar os contatos.
                </p>
              ) : filteredWhatsapp.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">
                  {search ? 'Nenhum contato encontrado' : 'Nenhum contato sincronizado ainda'}
                </p>
              ) : (
                filteredWhatsapp.map((contact) => (
                  <button
                    key={contact.phone}
                    type="button"
                    onClick={() => handlePick(contact.name, contact.phone)}
                    className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {contact.name.trim() || '(sem nome no WhatsApp)'}
                      </p>
                      <p className="text-xs text-slate-500">{formatBrazilianPhone(contact.phone)}</p>
                    </div>
                    {contact.inCrm && (
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        já é cliente
                      </Badge>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {step === 'vcf' && (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                setStep('chooser')
                vcf.reset()
              }}
              className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              <ChevronLeft className="size-3.5" />
              Voltar
            </button>

            {vcf.step === 'idle' && (
              <div className="space-y-2">
                {supportsContactPicker() ? (
                  <Button
                    onClick={vcf.pickFromDevice}
                    variant="outline"
                    className="h-12 w-full justify-start gap-3 rounded-2xl"
                  >
                    <Users className="size-5 text-slate-500" />
                    <div className="text-left">
                      <p className="text-sm font-medium">Selecionar dos contatos</p>
                      <p className="text-xs text-slate-500">Abre os contatos do aparelho</p>
                    </div>
                  </Button>
                ) : (
                  <>
                    <p className="text-xs text-slate-500">
                      No iPhone: abra Contatos, segure o contato desejado → Compartilhar → Salvar
                      em Arquivos, depois selecione o arquivo aqui.
                    </p>
                    <Button
                      onClick={() => fileRef.current?.click()}
                      variant="outline"
                      className="h-12 w-full justify-start gap-3 rounded-2xl"
                    >
                      <Upload className="size-4 text-slate-500" />
                      <span className="text-sm font-medium">Selecionar arquivo .vcf</span>
                    </Button>
                  </>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept=".vcf,.vcard,text/vcard,text/x-vcard,text/directory"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            )}

            {vcf.step === 'loading' && (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="size-8 animate-spin text-slate-400" />
                <p className="text-sm text-slate-500">Carregando contatos...</p>
              </div>
            )}

            {vcf.step === 'preview' && (
              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain">
                {vcf.contacts.map((contact) => (
                  <button
                    key={contact.phone}
                    type="button"
                    disabled={contact.alreadyExists}
                    onClick={() => handlePick(contact.name, contact.phone)}
                    className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${
                      contact.alreadyExists ? 'cursor-default opacity-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{contact.name}</p>
                      <p className="text-xs text-slate-500">{formatBrazilianPhone(contact.phone)}</p>
                    </div>
                    {contact.alreadyExists && (
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        já é cliente
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            )}

            {vcf.step === 'error' && (
              <div className="space-y-3 py-4 text-center">
                <p className="text-sm text-red-600">{vcf.error}</p>
                <Button variant="outline" size="sm" onClick={vcf.reset}>
                  Tentar novamente
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
