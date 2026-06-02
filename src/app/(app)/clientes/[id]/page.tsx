// src/app/(app)/clientes/[id]/page.tsx
'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { CustomerProfileHeader } from '@/components/domain/crm/customer-profile-header'
import { AppointmentHistory } from '@/components/domain/crm/appointment-history'
import { AnamneseSheet } from '@/components/domain/crm/anamnese-sheet'
import { useCustomer } from '@/hooks/crm/use-customer'

export default function CustomerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { data: customer, isLoading, isError, refetch } = useCustomer(id)
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [anamneseOpen, setAnamneseOpen] = useState(false)

  useEffect(() => {
    if (customer) setNotes(customer.notes ?? '')
  }, [customer])

  async function handleSaveNotes() {
    setSavingNotes(true)
    try {
      await fetch(`/api/crm/customers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      toast.success('Observações salvas')
    } catch {
      toast.error('Erro ao salvar observações')
    } finally {
      setSavingNotes(false)
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  if (isError || !customer) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm text-red-600">Cliente não encontrado.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.back()}
        className="-ml-2 text-slate-500"
      >
        <ArrowLeft className="size-4" />
        Voltar
      </Button>

      <CustomerProfileHeader customer={customer} />

      <Tabs defaultValue="historico">
        <TabsList className="w-full">
          <TabsTrigger value="historico" className="flex-1">
            Histórico ({customer.appointments.length})
          </TabsTrigger>
          <TabsTrigger value="observacoes" className="flex-1">
            Observações
          </TabsTrigger>
          <TabsTrigger value="anamnese" className="flex-1">
            Anamnese
          </TabsTrigger>
        </TabsList>
        <TabsContent value="historico" className="mt-4">
          <AppointmentHistory appointments={customer.appointments} />
        </TabsContent>
        <TabsContent value="observacoes" className="mt-4">
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <Label htmlFor="customer-notes" className="text-sm font-medium text-slate-700">
              Observações do cliente
            </Label>
            <Textarea
              id="customer-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Alergias, preferências, histórico relevante..."
              className="min-h-[120px] resize-none"
            />
            <p className="text-xs text-slate-400">
              Visível no card de agendamento ao atender este cliente.
            </p>
            <Button
              onClick={handleSaveNotes}
              disabled={savingNotes}
              className="bg-slate-950 text-white hover:bg-slate-800"
              size="sm"
            >
              {savingNotes ? 'Salvando...' : 'Salvar observações'}
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="anamnese" className="mt-4">
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">
              Ficha de anamnese do cliente. Editada pelo profissional ou enviada via link para o cliente preencher.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAnamneseOpen(true)}
            >
              Abrir ficha de anamnese
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <AnamneseSheet
        open={anamneseOpen}
        onClose={() => setAnamneseOpen(false)}
        customerId={id}
        customerName={customer.name}
      />
    </div>
  )
}
