'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Phone, Mail, Tag, Crown, MoreHorizontal, Archive } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useDeleteCustomer } from '@/hooks/crm/use-customers'
import { usePermissions } from '@/hooks/use-permissions'
import type { Customer } from '@/hooks/crm/use-customers'

type Props = {
  customer: Customer
}

export function CustomerCard({ customer }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { can } = usePermissions()
  const deleteCustomer = useDeleteCustomer()

  function handleArchive() {
    deleteCustomer.mutate(customer.id, {
      onSuccess: () => toast.success(`${customer.name} arquivado`),
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : 'Erro ao arquivar'),
    })
  }

  return (
    <>
      <div className="relative flex items-stretch rounded-2xl border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-sm">
        <Link
          href={`/clientes/${customer.id}`}
          className="flex min-w-0 flex-1 items-start gap-3 p-4"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
            {customer.name.slice(0, 2).toUpperCase()}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-slate-950">
                {customer.name}
              </p>
              {customer.isVip && (
                <Badge className="shrink-0 gap-1 rounded-full bg-amber-100 px-1.5 py-0 text-[10px] text-amber-700 border border-amber-200">
                  <Crown className="size-2.5" />
                  VIP
                </Badge>
              )}
            </div>

            <div className="mt-1 flex flex-col gap-0.5">
              {customer.phone && (
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Phone className="size-3" />
                  {customer.phone}
                </span>
              )}
              {customer.email && (
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Mail className="size-3" />
                  {customer.email}
                </span>
              )}
            </div>

            {customer.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {customer.tags.map((tag) => (
                  <Badge
                    key={tag}
                    className="flex items-center gap-0.5 rounded-full bg-slate-100 px-2 py-0 text-[10px] text-slate-600"
                  >
                    <Tag className="size-2.5" />
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </Link>

        {can('clientes', 'delete') && (
          <div className="flex items-center pr-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-slate-400 hover:text-slate-700"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">Opções</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-700"
                  onSelect={() => setConfirmOpen(true)}
                >
                  <Archive className="mr-2 size-4" />
                  Arquivar cliente
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{customer.name}</strong> será removido da lista. O histórico de
              agendamentos e dados serão preservados e podem ser restaurados pelo perfil do cliente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteCustomer.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              disabled={deleteCustomer.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteCustomer.isPending ? 'Arquivando...' : 'Arquivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
