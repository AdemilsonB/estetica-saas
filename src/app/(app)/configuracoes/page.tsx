'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BusinessInfoForm } from '@/components/domain/settings/business-info-form'
import { BusinessHoursForm } from '@/components/domain/settings/business-hours-form'
import { WhatsAppSettingsForm } from '@/components/domain/settings/whatsapp-settings-form'
import { NotificationHistory } from '@/components/domain/settings/notification-history'
import { BrandingForm } from '@/components/domain/settings/branding-form'
import { CardFeesForm } from '@/components/domain/settings/card-fees-form'
import { SettingsAnamneseTab } from '@/components/domain/crm/settings-anamnese-tab'
import { SchedulingPolicyForm } from '@/components/domain/settings/scheduling-policy-form'
import { usePermissions } from '@/hooks/use-permissions'
import { BillingPlansContent } from '@/components/domain/billing/billing-plans-content'
import { WhatsAppAutomationsForm } from '@/components/domain/settings/whatsapp-automations-form'
import { LinkSharingHub } from '@/components/domain/settings/link-sharing-hub'
import { Loader2 } from 'lucide-react'

type BrandingConfig = {
  logoUrl: string | null
  primaryColor: string
  accentColor: string
  backgroundColor: string
  borderColor: string
  foregroundColor: string
  mutedColor: string
  fontFamily: string
  borderRadius: string
  colorScheme: string
}

export default function ConfiguracoesPage() {
  const { can, user, isLoading } = usePermissions()
  const router = useRouter()
  const [brandingConfig, setBrandingConfig] = useState<BrandingConfig | null>(null)
  const [brandingLoading, setBrandingLoading] = useState(false)

  useEffect(() => {
    if (!isLoading && !can('configuracoes', 'view')) {
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

  if (!can('configuracoes', 'view')) return null

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          Configurações
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Gerencie os dados do seu negócio e integrações
        </p>
      </div>

      <Tabs defaultValue="negocio" onValueChange={handleTabChange}>
        <div className="overflow-x-auto pb-1 scrollbar-hide">
          <TabsList className="flex h-auto min-w-max justify-start">
            <TabsTrigger value="negocio">Negócio</TabsTrigger>
            <TabsTrigger value="meu-link">Meu Link</TabsTrigger>
            <TabsTrigger value="horarios">Horários</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
            <TabsTrigger value="automacoes">Automações</TabsTrigger>
            <TabsTrigger value="layout">Layout</TabsTrigger>
            <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
            <TabsTrigger value="crm">CRM</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="negocio" className="mt-6">
          <div className="space-y-4">
            <section className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm sm:p-6">
              <h2 className="mb-4 text-base font-semibold text-slate-950">
                Dados do negócio
              </h2>
              <BusinessInfoForm />
            </section>

            <section className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm sm:p-6">
              <h2 className="mb-2 text-base font-semibold text-slate-950">
                Agenda online
              </h2>
              <p className="mb-6 text-sm text-slate-500">
                Configure como os clientes podem agendar pelo link público do seu negócio.
              </p>
              <SchedulingPolicyForm />
            </section>

            {user?.isOwner && (
              <section className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm sm:p-6">
                <h2 className="mb-4 text-base font-semibold text-slate-950">
                  Plano e assinatura
                </h2>
                <BillingPlansContent />
              </section>
            )}
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

        <TabsContent value="whatsapp" className="mt-6">
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/80 bg-white/85 p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-slate-950">
                Notificações WhatsApp
              </h2>
              <WhatsAppSettingsForm />
            </div>
            <NotificationHistory />
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

        <TabsContent value="financeiro" className="mt-6">
          <div className="rounded-2xl border border-white/80 bg-white/85 p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-slate-950">Taxas de pagamento</h2>
            <CardFeesForm />
          </div>
        </TabsContent>
        <TabsContent value="crm" className="mt-6">
          <div className="rounded-2xl border border-white/80 bg-white/85 p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-slate-950">
              Configurações de anamnese
            </h2>
            <SettingsAnamneseTab />
          </div>
        </TabsContent>

        <TabsContent value="automacoes" className="mt-6">
          <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
            <h2 className="mb-1 text-base font-semibold text-foreground">Automações WhatsApp</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Configure mensagens automáticas enviadas pelo WhatsApp do seu negócio.
              Requer WhatsApp conectado em Configurações → WhatsApp.
            </p>
            <WhatsAppAutomationsForm />
          </div>
        </TabsContent>

        <TabsContent value="meu-link" className="mt-6">
          <div className="rounded-2xl border border-white/80 bg-white/85 p-6 shadow-sm space-y-2">
            <h2 className="text-base font-semibold text-slate-950">Meu link de agendamento</h2>
            <p className="text-sm text-slate-500 mb-4">
              Compartilhe este link com seus clientes para que possam agendar online.
            </p>
            {user && !user.tenantSlug ? (
              <p className="text-sm text-slate-500 py-4">
                Seu negócio ainda não possui um link público configurado. Entre em contato com o suporte.
              </p>
            ) : user?.tenantSlug ? (
              <LinkSharingHub
                slug={user.tenantSlug}
                baseUrl={process.env.NEXT_PUBLIC_APP_URL ?? 'https://agend.me'}
              />
            ) : null}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
