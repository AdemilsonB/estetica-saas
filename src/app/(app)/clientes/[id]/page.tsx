// src/app/(app)/clientes/[id]/page.tsx
'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, CalendarPlus, ShieldOff, ShieldCheck, Archive, ArchiveRestore } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CustomerProfileHeader } from '@/components/domain/crm/customer-profile-header'
import { AppointmentHistory } from '@/components/domain/crm/appointment-history'
import { AnamneseSheet } from '@/components/domain/crm/anamnese-sheet'
import { EditCustomerModal } from '@/components/domain/crm/edit-customer-modal'
import { CreateAppointmentModal } from '@/components/domain/scheduling/create-appointment-modal'
import { useCustomer } from '@/hooks/crm/use-customer'
import { useBlockCustomer } from '@/hooks/crm/use-block-customer'
import { useRestoreCustomer } from '@/hooks/crm/use-customers'

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
  const [editOpen, setEditOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [anamneseOpen, setAnamneseOpen] = useState(false)
  const [blockDialogOpen, setBlockDialogOpen] = useState(false)
  const [unblockDialogOpen, setUnblockDialogOpen] = useState(false)
  const [blockReason, setBlockReason] = useState('')
  const { block, unblock, isBlocking, isUnblocking } = useBlockCustomer(id)
  const { mutate: restore, isPending: isRestoring } = useRestoreCustomer(id)

  useEffect(() => {
    if (customer) setNotes(customer.notes ?? '')
  }, [customer])

  function handleRestore() {
    restore(undefined, {
      onSuccess: () => toast.success('Cliente restaurado'),
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : 'Erro ao restaurar'),
    })
  }

  function handleConfirmBlock() {
    block(
      { reason: blockReason.trim() || undefined },
      {
        onSuccess: () => {
          setBlockDialogOpen(false)
          setBlockReason('')
        },
      },
    )
  }

  function handleConfirmUnblock() {
    unblock(undefined, {
      onSuccess: () => {
        setUnblockDialogOpen(false)
      },
    })
  }

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
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="-ml-2 text-slate-500"
        >
          <ArrowLeft className="size-4" />
          Voltar
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setScheduleOpen(true)}
          >
            <CalendarPlus className="mr-1.5 size-4" />
            Agendar Horário
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
          >
            Editar dados
          </Button>
        </div>
      </div>

      <CustomerProfileHeader customer={customer} />

      {/* Banner de arquivado */}
      {customer.deletedAt && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <Archive className="mt-0.5 size-5 shrink-0 text-amber-500" />
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium text-amber-800">Cliente arquivado</p>
            <p className="text-xs text-amber-600">
              Este cliente não aparece na lista. Restaure para reativá-lo.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRestore}
            disabled={isRestoring}
            className="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100"
          >
            <ArchiveRestore className="mr-1.5 size-4" />
            {isRestoring ? 'Restaurando...' : 'Restaurar'}
          </Button>
        </div>
      )}

      {/* Banner de bloqueio */}
      {customer.isBlocked && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-500" />
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium text-red-800">Cliente bloqueado</p>
            {customer.blockedReason && (
              <p className="text-sm text-red-600">Motivo: {customer.blockedReason}</p>
            )}
            <p className="text-xs text-red-500">
              Este cliente não pode realizar novos agendamentos enquanto estiver bloqueado.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setUnblockDialogOpen(true)}
            className="shrink-0 border-red-300 text-red-700 hover:bg-red-100"
          >
            <ShieldCheck className="mr-1.5 size-4" />
            Desbloquear
          </Button>
        </div>
      )}

      {/* Botão de bloquear (quando não está bloqueado) */}
      {!customer.isBlocked && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBlockDialogOpen(true)}
            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <ShieldOff className="mr-1.5 size-4" />
            Bloquear cliente
          </Button>
        </div>
      )}

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
              className="bg-primary text-primary-foreground hover:bg-primary/90"
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

      <EditCustomerModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        customer={customer}
      />

      <CreateAppointmentModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        defaultCustomerId={id}
        defaultCustomerName={customer.name}
      />

      {/* Dialog de bloqueio */}
      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bloquear cliente</DialogTitle>
            <DialogDescription>
              Ao bloquear <strong>{customer.name}</strong>, ele não poderá mais realizar novos
              agendamentos neste estabelecimento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="block-reason" className="text-sm font-medium">
              Motivo (opcional)
            </Label>
            <Textarea
              id="block-reason"
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="Descreva o motivo do bloqueio..."
              maxLength={500}
              className="min-h-25 resize-none"
            />
            <p className="text-right text-xs text-slate-400">{blockReason.length}/500</p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBlockDialogOpen(false)
                setBlockReason('')
              }}
              disabled={isBlocking}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmBlock}
              disabled={isBlocking}
            >
              {isBlocking ? 'Bloqueando...' : 'Confirmar bloqueio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de desbloqueio */}
      <Dialog open={unblockDialogOpen} onOpenChange={setUnblockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desbloquear cliente</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja desbloquear <strong>{customer.name}</strong>? Ele voltará a
              poder realizar novos agendamentos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUnblockDialogOpen(false)}
              disabled={isUnblocking}
            >
              Cancelar
            </Button>
            <Button onClick={handleConfirmUnblock} disabled={isUnblocking}>
              {isUnblocking ? 'Desbloqueando...' : 'Desbloquear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
