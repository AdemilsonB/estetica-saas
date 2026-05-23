'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BusinessInfoForm } from '@/components/domain/settings/business-info-form'
import { ServiceCatalog } from '@/components/domain/settings/service-catalog'
import { WhatsAppSettingsForm } from '@/components/domain/settings/whatsapp-settings-form'
import { usePermissions } from '@/hooks/use-permissions'

export default function ConfiguracoesPage() {
  const { can, isLoading } = usePermissions()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !can('settings:view')) {
      router.replace('/agenda')
    }
  }, [isLoading, can, router])

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-rose-200 border-t-rose-600" />
      </div>
    )
  }

  if (!can('settings:view')) return null

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          Configurações
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Gerencie os dados do seu negócio, serviços e integrações
        </p>
      </div>

      <Tabs defaultValue="negocio">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="negocio">Negócio</TabsTrigger>
          <TabsTrigger value="servicos">Serviços</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
        </TabsList>

        <TabsContent value="negocio" className="mt-6">
          <div className="rounded-2xl border border-white/80 bg-white/85 p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-slate-950">
              Dados do negócio
            </h2>
            <BusinessInfoForm />
          </div>
        </TabsContent>

        <TabsContent value="servicos" className="mt-6">
          <div className="rounded-2xl border border-white/80 bg-white/85 p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-slate-950">
              Catálogo de serviços
            </h2>
            <ServiceCatalog />
          </div>
        </TabsContent>

        <TabsContent value="whatsapp" className="mt-6">
          <div className="rounded-2xl border border-white/80 bg-white/85 p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-slate-950">
              Notificações WhatsApp
            </h2>
            <WhatsAppSettingsForm />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
