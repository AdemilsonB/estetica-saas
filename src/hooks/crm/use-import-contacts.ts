'use client'

import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  buildPreviewPhoneVariants,
  normalizeImportedPhone,
  parseVCards,
} from '@/shared/utils/vcard'

export type ContactItem = {
  name: string
  phone: string
  selected: boolean
  alreadyExists: boolean
}

export type ImportStep =
  | 'idle'
  | 'loading'
  | 'preview'
  | 'importing'
  | 'done'
  | 'error'

export type ImportResult = { created: number; skipped: number }

// Limite do Zod nas rotas de preview/import — requisições maiores vão em lotes
const API_BATCH_SIZE = 500

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

export function supportsContactPicker(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'contacts' in navigator &&
    'ContactsManager' in window
  )
}

export function useImportContacts() {
  const queryClient = useQueryClient()
  const [step, setStep] = useState<ImportStep>('idle')
  const [contacts, setContacts] = useState<ContactItem[]>([])
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setStep('idle')
    setContacts([])
    setResult(null)
    setError(null)
  }, [])

  const applyPreview = useCallback(
    async (raw: Array<{ name: string; phone: string }>) => {
      setStep('loading')

      try {
        // Variantes com/sem DDI 55 para casar clientes gravados em qualquer forma
        const variants = buildPreviewPhoneVariants(raw.map((c) => c.phone))
        const existingSet = new Set<string>()

        for (const batch of chunk(variants, API_BATCH_SIZE)) {
          const res = await fetch('/api/crm/customers/import/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phones: batch }),
          })
          if (!res.ok) throw new Error('Falha ao verificar contatos existentes')

          const { existing } = (await res.json()) as { existing: string[] }
          for (const phone of existing) existingSet.add(phone)
        }

        const exists = (phone: string) =>
          existingSet.has(phone) || existingSet.has('55' + phone)

        setContacts(
          raw.map((c) => ({
            name: c.name,
            phone: c.phone,
            selected: !exists(c.phone),
            alreadyExists: exists(c.phone),
          })),
        )
        setStep('preview')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido')
        setStep('error')
      }
    },
    [],
  )

  const pickFromDevice = useCallback(async () => {
    setStep('loading')
    try {
      // A ContactsManager API não tem typings nativos no TypeScript
      const mgr = (navigator as unknown as { contacts: {
        select: (props: string[], opts: { multiple: boolean }) => Promise<Array<{ name: string[]; tel: string[] }>>
      } }).contacts

      const selected = await mgr.select(['name', 'tel'], { multiple: true })

      const raw: Array<{ name: string; phone: string }> = []
      const seenPhones = new Set<string>()
      for (const entry of selected) {
        const name = entry.name[0]?.trim()
        const phone = normalizeImportedPhone(entry.tel[0] ?? '')
        if (name && phone.length >= 8 && !seenPhones.has(phone)) {
          seenPhones.add(phone)
          raw.push({ name, phone })
        }
      }

      if (raw.length === 0) {
        setStep('idle')
        return
      }

      await applyPreview(raw)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Acesso aos contatos negado')
      setStep('error')
    }
  }, [applyPreview])

  const pickFromVCards = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return
      setStep('loading')
      try {
        // iOS costuma gerar um .vcf por contato — aceitar vários arquivos de uma vez
        const contents = await Promise.all(files.map((file) => file.text()))

        const raw: Array<{ name: string; phone: string }> = []
        const seenPhones = new Set<string>()
        for (const content of contents) {
          for (const contact of parseVCards(content)) {
            if (!seenPhones.has(contact.phone)) {
              seenPhones.add(contact.phone)
              raw.push(contact)
            }
          }
        }

        if (raw.length === 0) {
          setError(
            'Nenhum contato com telefone encontrado. Confira se o arquivo é um .vcf exportado dos Contatos (não um PDF ou print) e tente de novo.',
          )
          setStep('error')
          return
        }

        await applyPreview(raw)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao ler arquivo')
        setStep('error')
      }
    },
    [applyPreview],
  )

  const toggleContact = useCallback((phone: string) => {
    setContacts((prev) =>
      prev.map((c) =>
        c.phone === phone ? { ...c, selected: !c.selected } : c,
      ),
    )
  }, [])

  const toggleAll = useCallback((selected: boolean) => {
    setContacts((prev) =>
      prev.map((c) => (c.alreadyExists ? c : { ...c, selected })),
    )
  }, [])

  const importSelected = useCallback(async () => {
    const toImport = contacts.filter((c) => c.selected && !c.alreadyExists)
    if (toImport.length === 0) return

    setStep('importing')

    try {
      let created = 0
      let skipped = 0

      for (const batch of chunk(toImport, API_BATCH_SIZE)) {
        const res = await fetch('/api/crm/customers/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contacts: batch.map(({ name, phone }) => ({ name, phone })),
          }),
        })
        if (!res.ok) throw new Error('Falha ao importar contatos')

        const data = (await res.json()) as ImportResult
        created += data.created
        skipped += data.skipped
      }

      setResult({ created, skipped })
      setStep('done')
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao importar')
      setStep('error')
    }
  }, [contacts, queryClient])

  const selectedCount = contacts.filter((c) => c.selected && !c.alreadyExists).length
  const newCount = contacts.filter((c) => !c.alreadyExists).length
  const existingCount = contacts.filter((c) => c.alreadyExists).length

  return {
    step,
    contacts,
    result,
    error,
    selectedCount,
    newCount,
    existingCount,
    reset,
    pickFromDevice,
    pickFromVCards,
    toggleContact,
    toggleAll,
    importSelected,
  }
}
