// src/app/(app)/clientes/[id]/page.tsx
'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CustomerProfileHeader } from '@/components/domain/crm/customer-profile-header'
import { AppointmentHistory } from '@/components/domain/crm/appointment-history'
import { useCustomer } from '@/hooks/crm/use-customer'

export default function CustomerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { data: customer, isLoading, isError, refetch } = useCustomer(id)

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
        </TabsList>
        <TabsContent value="historico" className="mt-4">
          <AppointmentHistory appointments={customer.appointments} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
