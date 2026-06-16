'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Building2, Clock, Palette, Link as LinkIcon,
  Settings2, MessageCircle, Zap, CreditCard,
  Sparkles, ClipboardList, Loader2, ExternalLink,
} from 'lucide-react'
import { SettingsGroup } from '@/components/domain/settings/settings-group'
import { SettingsCard } from '@/components/domain/settings/settings-card'
import { SettingsCardSheet } from '@/components/domain/settings/settings-card-sheet'
import { BusinessInfoForm } from '@/components/domain/settings/business-info-form'
import { BusinessHoursForm } from '@/components/domain/settings/business-hours-form'
import { BrandingForm } from '@/components/domain/settings/branding-form'
import { LinkSharingHub } from '@/components/domain/settings/link-sharing-hub'
import { SchedulingPolicyForm } from '@/components/domain/settings/scheduling-policy-form'
import { WhatsAppSettingsForm } from '@/components/domain/settings/whatsapp-settings-form'
import { NotificationHistory } from '@/components/domain/settings/notification-history'
import { WhatsAppAutomationsForm } from '@/components/domain/settings/whatsapp-automations-form'
import { CardFeesForm } from '@/components/domain/settings/card-fees-form'
import { BillingPlansContent } from '@/components/domain/billing/billing-plans-content'
import { usePermissions } from '@/hooks/use-permissions'
import { useEvolutionStatus } from '@/hooks/settings/use-evolution-status'
import { Button } from '@/components/ui/button'

type OpenSheet =
  | 'negocio' | 'horarios' | 'branding' | 'link'
  | 'agendamento' | 'whatsapp' | 'automacoes'
  | 'taxas' | 'plano'
  | null

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

type BusinessInfo = {
  name?: string
  phone?: string
}

export default function ConfiguracoesPage() {
  const { can, user, isLoading } = usePermissions()
  const router = useRouter()
  const { data: evolutionStatus } = useEvolutionStatus()

  const [openSheet, setOpenSheet] = useState<OpenSheet>(null)
  const [brandingConfig, setBrandingConfig] = useState<BrandingConfig | null>(null)
  const [brandingLoading, setBrandingLoading] = useState(false)
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo | null>(null)

  useEffect(() => {
    if (!isLoading && !can('configuracoes', 'view')) {
      router.replace('/agenda')
    }
  }, [isLoading, can, router])

  useEffect(() => {
    fetch('/api/iam/business-info')
      .then((r) => r.json())
      .then((data) => setBusinessInfo(data as BusinessInfo))
      .catch(() => {})
  }, [])

  function openBrandingSheet() {
    if (!brandingConfig && !brandingLoading) {
      setBrandingLoading(true)
      fetch('/api/iam/branding')
        .then((r) => r.json())
        .then((data) => setBrandingConfig(data as BrandingConfig))
        .finally(() => setBrandingLoading(false))
    }
    setOpenSheet('branding')
  }

  function closeSheet() {
    setOpenSheet(null)
  }

  const businessInfoComplete =
    businessInfo !== null &&
    Boolean(businessInfo.name?.trim()) &&
    Boolean(businessInfo.phone?.trim())

  const whatsappConnected = evolutionStatus?.connected === true

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-rose-200 border-t-rose-600" />
      </div>
    )
  }

  if (!can('configuracoes', 'view')) return null

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Configurações
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie os dados do seu negócio e integrações
        </p>
      </div>

      {/* GRUPO 1 — Configure seu negócio */}
      <SettingsGroup title="Configure seu negócio" badge="essencial" defaultExpanded>
        <SettingsCard
          icon={Building2}
          title="Dados do negócio"
          subtitle="Nome, telefone e endereço do seu estabelecimento"
          statusBadge={
            businessInfo === null
              ? undefined
              : businessInfoComplete
              ? { label: '✓ Completo', variant: 'ok' }
              : { label: '⚠ Pendente', variant: 'warn' }
          }
          onEdit={() => setOpenSheet('negocio')}
        />

        <SettingsCard
          icon={Clock}
          title="Horários de funcionamento"
          subtitle="Dias e horários em que seu negócio está aberto para atendimentos"
          onEdit={() => setOpenSheet('horarios')}
        />

        <SettingsCard
          icon={Palette}
          title="Identidade visual"
          subtitle="Logo e cores do seu negócio — aparecem no agendamento online"
          statusBadge={
            brandingConfig !== null
              ? brandingConfig.logoUrl
                ? { label: '✓ Logo enviada', variant: 'ok' }
                : { label: 'Sem logo', variant: 'neutral' }
              : undefined
          }
          onEdit={openBrandingSheet}
        />
      </SettingsGroup>

      {/* GRUPO 2 — Divulgue e automatize */}
      <SettingsGroup title="Divulgue e automatize">
        <SettingsCard
          icon={LinkIcon}
          title="Meu link de agendamento"
          subtitle="Compartilhe com clientes para que agendem sozinhos, sem precisar do WhatsApp"
          onEdit={() => setOpenSheet('link')}
        >
          <p className="mt-1 text-[11px] text-blue-600">
            💡 Dica: cole esse link na bio do Instagram
          </p>
        </SettingsCard>

        <SettingsCard
          icon={Settings2}
          title="Regras de agendamento online"
          subtitle="Antecedência mínima, janela de dias disponíveis e intervalo entre horários"
          onEdit={() => setOpenSheet('agendamento')}
        />

        <SettingsCard
          icon={MessageCircle}
          title="WhatsApp e notificações"
          subtitle="Conecte seu WhatsApp para enviar confirmações e lembretes automáticos"
          statusBadge={
            evolutionStatus !== undefined
              ? whatsappConnected
                ? { label: 'Conectado', variant: 'ok' }
                : { label: 'Inativo', variant: 'neutral' }
              : undefined
          }
          onEdit={() => setOpenSheet('whatsapp')}
        />

        <SettingsCard
          icon={Zap}
          title="Automações de mensagens"
          subtitle="Lembrete de agendamento, resposta automática, parabéns e resumo do dia"
          onEdit={() => setOpenSheet('automacoes')}
        />
      </SettingsGroup>

      {/* GRUPO 3 — Financeiro e acesso */}
      <SettingsGroup title="Financeiro e acesso">
        <SettingsCard
          icon={CreditCard}
          title="Taxas de pagamento"
          subtitle="Percentual das maquininhas de débito e crédito — usado para calcular o lucro real"
          onEdit={() => setOpenSheet('taxas')}
        />

        {user?.isOwner && (
          <SettingsCard
            icon={Sparkles}
            title="Plano e assinatura"
            subtitle="Seu plano atual, limites de uso e opções de upgrade"
            onEdit={() => setOpenSheet('plano')}
          />
        )}

        <SettingsCard
          icon={ClipboardList}
          title="Ficha de anamnese"
          subtitle="A anamnese é configurada por serviço — acesse um serviço para definir as perguntas"
          isStatic
        >
          <div className="mt-3">
            <Button asChild variant="outline" size="sm">
              <Link href="/servicos" className="flex items-center gap-1.5">
                <ExternalLink className="size-3.5" />
                Ir para Serviços
              </Link>
            </Button>
          </div>
        </SettingsCard>
      </SettingsGroup>

      {/* ── Sheets ── */}

      <SettingsCardSheet open={openSheet === 'negocio'} onClose={closeSheet} title="Dados do negócio">
        <BusinessInfoForm />
      </SettingsCardSheet>

      <SettingsCardSheet open={openSheet === 'horarios'} onClose={closeSheet} title="Horários de funcionamento">
        <p className="text-sm text-muted-foreground">
          Configure os dias e horários em que seu negócio está aberto. Esses horários definem os slots disponíveis para agendamento.
        </p>
        <BusinessHoursForm />
      </SettingsCardSheet>

      <SettingsCardSheet open={openSheet === 'branding'} onClose={closeSheet} title="Identidade visual">
        {brandingLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {brandingConfig && !brandingLoading && (
          <BrandingForm initial={brandingConfig} />
        )}
      </SettingsCardSheet>

      <SettingsCardSheet open={openSheet === 'link'} onClose={closeSheet} title="Meu link de agendamento">
        {user?.tenantSlug ? (
          <LinkSharingHub
            slug={user.tenantSlug}
            baseUrl={process.env.NEXT_PUBLIC_APP_URL ?? 'https://agend.me'}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Seu negócio ainda não possui um link público configurado. Entre em contato com o suporte.
          </p>
        )}
      </SettingsCardSheet>

      <SettingsCardSheet open={openSheet === 'agendamento'} onClose={closeSheet} title="Regras de agendamento online">
        <SchedulingPolicyForm />
      </SettingsCardSheet>

      <SettingsCardSheet open={openSheet === 'whatsapp'} onClose={closeSheet} title="WhatsApp e notificações">
        <WhatsAppSettingsForm />
        <NotificationHistory />
      </SettingsCardSheet>

      <SettingsCardSheet open={openSheet === 'automacoes'} onClose={closeSheet} title="Automações de mensagens">
        {!whatsappConnected && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Conecte o WhatsApp primeiro para ativar as automações.
          </div>
        )}
        <WhatsAppAutomationsForm />
      </SettingsCardSheet>

      <SettingsCardSheet open={openSheet === 'taxas'} onClose={closeSheet} title="Taxas de pagamento">
        <CardFeesForm />
      </SettingsCardSheet>

      {user?.isOwner && (
        <SettingsCardSheet open={openSheet === 'plano'} onClose={closeSheet} title="Plano e assinatura">
          <BillingPlansContent />
        </SettingsCardSheet>
      )}
    </div>
  )
}
