'use client'

import { useState, useRef } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

function applyPhoneMask(digits: string): string {
  const d = digits.slice(0, 11)
  if (d.length <= 2) return `(${d}`
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export function PersonalStep({
  onSubmit,
  onBack,
}: {
  onSubmit: (data: { customerName: string; customerPhone: string; notes?: string }) => void
  onBack: () => void
}) {
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [welcomeBack, setWelcomeBack] = useState<string | null>(null)
  const lookupDoneRef = useRef(false)

  async function lookupByPhone(digits: string) {
    if (digits.length < 11 || lookupDoneRef.current) return
    lookupDoneRef.current = true
    try {
      const res = await fetch(`/api/public/customer-lookup?phone=${digits}`)
      if (res.ok) {
        const data = (await res.json()) as { name?: string }
        if (data.name) {
          setName(data.name)
          setWelcomeBack(data.name)
        }
      }
    } catch {
      // silencioso — não crítico
    }
  }

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '')
    setPhone(applyPhoneMask(digits))
    lookupDoneRef.current = false
    setWelcomeBack(null)
    void lookupByPhone(digits)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const digits = phone.replace(/\D/g, '')
    onSubmit({ customerName: name, customerPhone: digits, notes: notes || undefined })
  }

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 -ml-1 py-1 px-1 rounded"
      >
        <ChevronLeft className="size-4" />
        Voltar
      </button>

      <div>
        <h2 className="text-xl font-semibold text-slate-900">Seus dados</h2>
        <p className="text-sm text-slate-500 mt-1">Sem cadastro. Sem senha.</p>
      </div>

      {welcomeBack && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
          Bem-vinda de volta, <strong>{welcomeBack}</strong>! 👋
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="phone">WhatsApp</Label>
          <Input
            id="phone"
            type="tel"
            inputMode="numeric"
            placeholder="(00) 00000-0000"
            value={phone}
            onChange={handlePhoneChange}
            required
            autoComplete="tel"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="name">Seu nome</Label>
          <Input
            id="name"
            placeholder="Nome completo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            autoComplete="name"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">
            Observações{' '}
            <span className="text-slate-400 font-normal">(opcional)</span>
          </Label>
          <Textarea
            id="notes"
            placeholder="Alguma observação para o profissional?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        <Button type="submit" className="w-full" size="lg">
          Continuar →
        </Button>
      </form>
    </div>
  )
}
