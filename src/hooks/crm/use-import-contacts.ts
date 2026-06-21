'use client'

import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

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

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '')
}

export function parseVCard(content: string): Array<{ name: string; phone: string }> {
  const blocks = content.split(/BEGIN:VCARD/i).slice(1)
  const contacts: Array<{ name: string; phone: string }> = []

  for (const block of blocks) {
    const fnMatch = block.match(/^FN:(.+)$/m)
    const telMatches = [...block.matchAll(/^TEL[^:]*:(.+)$/gm)]

    const name = fnMatch?.[1]?.trim()
    const rawPhone = telMatches[0]?.[1]?.trim()
    const phone = rawPhone ? normalizePhone(rawPhone) : undefined

    if (name && phone && phone.length >= 8) {
      contacts.push({ name, phone })
    }
  }

  return contacts
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
        const phones = raw.map((c) => c.phone)
        const res = await fetch('/api/crm/customers/import/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phones }),
        })
        if (!res.ok) throw new Error('Falha ao verificar contatos existentes')

        const { existing } = (await res.json()) as { existing: string[] }
        const existingSet = new Set(existing)

        setContacts(
          raw.map((c) => ({
            name: c.name,
            phone: c.phone,
            selected: !existingSet.has(c.phone),
            alreadyExists: existingSet.has(c.phone),
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
      for (const entry of selected) {
        const name = entry.name[0]?.trim()
        const phone = normalizePhone(entry.tel[0] ?? '')
        if (name && phone.length >= 8) {
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

  const pickFromVCard = useCallback(
    async (file: File) => {
      setStep('loading')
      try {
        const text = await file.text()
        const raw = parseVCard(text)

        if (raw.length === 0) {
          setError('Nenhum contato com telefone encontrado no arquivo')
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
      const res = await fetch('/api/crm/customers/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contacts: toImport.map(({ name, phone }) => ({ name, phone })),
        }),
      })
      if (!res.ok) throw new Error('Falha ao importar contatos')

      const data = (await res.json()) as ImportResult
      setResult(data)
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
    pickFromVCard,
    toggleContact,
    toggleAll,
    importSelected,
  }
}
