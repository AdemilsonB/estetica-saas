'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BusinessInfoForm } from '@/components/domain/settings/business-info-form'
import { BusinessHoursForm } from '@/components/domain/settings/business-hours-form'
import { ServiceCatalog } from '@/components/domain/settings/service-catalog'
import { WhatsAppSettingsForm } from '@/components/domain/settings/whatsapp-settings-form'
import { BrandingForm } from '@/components/domain/settings/branding-form'
import { usePermissions } from '@/hooks/use-permissions'
import { Loader2 } from 'lucide-react'

type BrandingConfig = {
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  accentColor: string
  backgroundColor: string
  fontFamily: string
  borderRadius: string
  colorScheme: string
}

export default function ConfiguracoesPage() {
  const { can, isLoading } = usePermissions()
  const router = useRouter()
  const [brandingConfig, setBrandingConfig] = useState<BrandingConfig | null>(null)
  const [brandingLoading, setBrandingLoading] = useState(false)

  useEffect(() => {
    if (!isLoading && !can('settings:view')) {
      router.replace('/agenda')
    }
  }, [isLoading, can, router])

  function handleTabChange(value: string) {
    if (value === 'layout' && !brandingConfig && !brandingLoading) {
      setBrandingLoading(true)
      fetch('/api/iam/branding')
        .then((r) => r.json())
        .then((data) => setBrandingConfig(data as BrandingConfig))
        .finally(() => setBrandingLoading(false))
    }
  }

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

      <Tabs defaultValue="negocio" onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="negocio">Negócio</TabsTrigger>
          <TabsTrigger value="horarios">Horários</TabsTrigger>
          <TabsTrigger value="servicos">Serviços</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="layout">Layout</TabsTrigger>
        </TabsList>

        <TabsContent value="negocio" className="mt-6">
          <div className="rounded-2xl border border-white/80 bg-white/85 p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-slate-950">
              Dados do negócio
            </h2>
            <BusinessInfoForm />
          </div>
        </TabsContent>

        <TabsContent value="horarios" className="mt-6">
          <div className="rounded-2xl border border-white/80 bg-white/85 p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-slate-950">
              Horários de expediente
            </h2>
            <p className="mb-4 text-sm text-slate-500">
              Configure os dias e horários em que seu negócio está aberto. Esses horários definem os slots disponíveis para agendamento.
            </p>
            <BusinessHoursForm />
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

        <TabsContent value="layout" className="mt-6">
          <div className="rounded-2xl border border-white/80 bg-white/85 p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-slate-950">
              Identidade visual e layout
            </h2>
            {brandingLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-6 animate-spin text-slate-400" />
              </div>
            )}
            {brandingConfig && !brandingLoading && (
              <BrandingForm initial={brandingConfig} />
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
