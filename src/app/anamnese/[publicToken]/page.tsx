'use client'

import { use, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { AnamneseFormField } from '@/components/domain/crm/anamnese-form-field'
import {
  usePublicAnamnese,
  useSubmitPublicAnamnese,
} from '@/hooks/crm/use-public-anamnese'

const SECTIONS: { key: string; label: string }[] = [
  { key: 'basico',    label: 'Informações básicas' },
  { key: 'saude',     label: 'Histórico de saúde' },
  { key: 'estetico',  label: 'Histórico estético' },
  { key: 'objetivos', label: 'Objetivos e expectativas' },
]

export default function PublicAnamnesePage({
  params,
}: {
  params: Promise<{ publicToken: string }>
}) {
  const { publicToken } = use(params)
  const { data, isLoading, isError } = usePublicAnamnese(publicToken)
  const { mutateAsync: submit, isPending, isSuccess } = useSubmitPublicAnamnese(publicToken)

  const [formData, setFormData] = useState<
    Record<string, string | string[] | boolean | null>
  >({})
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [initialized, setInitialized] = useState(false)

  if (data && !initialized) {
    setFormData(data.data as Record<string, string | string[] | boolean | null>)
    setInitialized(true)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-full max-w-lg p-6 space-y-4">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-64 mx-auto" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-800">Link não encontrado</p>
          <p className="mt-1 text-sm text-slate-500">
            Este link não é mais válido ou foi removido.
          </p>
        </div>
      </div>
    )
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center">
          <CheckCircle2 className="size-12 text-emerald-500 mx-auto" />
          <p className="mt-4 text-lg font-semibold text-slate-800">Ficha recebida!</p>
          <p className="mt-1 text-sm text-slate-500">Obrigado! Até logo 🎉</p>
        </div>
      </div>
    )
  }

  const requiredFields = data.fields.filter(
    (f) => f.required && f.type !== 'boolean',
  )
  const allRequiredFilled = requiredFields.every((f) => {
    const v = formData[f.id]
    if (Array.isArray(v)) return v.length > 0
    return v != null && v !== ''
  })

  async function handleSubmit() {
    await submit(formData)
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="mx-auto max-w-lg">
        <div className="text-center mb-8">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
            Ficha de anamnese
          </p>
          <h1 className="text-xl font-semibold text-slate-900">
            Olá{data.customerName ? `, ${data.customerName}` : ''}!
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Preencha seus dados abaixo para oferecer o melhor atendimento.
          </p>
        </div>

        <Accordion type="single" collapsible defaultValue="basico" className="space-y-2">
          {SECTIONS.map(({ key, label }) => {
            const sectionFields = data.fields.filter((f) => f.section === key)
            if (sectionFields.length === 0) return null
            return (
              <AccordionItem
                key={key}
                value={key}
                className="border rounded-xl bg-white px-4"
              >
                <AccordionTrigger className="text-sm font-medium py-4">
                  {label}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pb-4">
                    {sectionFields.map((field) => (
                      <AnamneseFormField
                        key={field.id}
                        field={field}
                        value={formData[field.id] ?? null}
                        onChange={(v) =>
                          setFormData((prev) => ({ ...prev, [field.id]: v }))
                        }
                      />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>

        <div className="mt-4 rounded-xl border bg-white px-4 py-3 flex items-start gap-2">
          <Checkbox
            id="terms"
            checked={termsAccepted}
            onCheckedChange={(v) => setTermsAccepted(v === true)}
            className="mt-0.5"
          />
          <Label htmlFor="terms" className="text-sm cursor-pointer text-slate-700">
            Li e concordo com os termos e autorizo o uso dos dados para fins de
            atendimento.
          </Label>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={isPending || !termsAccepted || !allRequiredFilled}
          className="w-full mt-6 bg-slate-950 text-white hover:bg-slate-800 rounded-full"
          size="lg"
        >
          {isPending ? 'Enviando...' : 'Enviar ficha'}
        </Button>
      </div>
    </div>
  )
}
