// src/app/(auth)/onboarding/page.tsx
'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createSupabaseBrowserClient } from '@/integrations/supabase/client'
import { SharedPlanCard, type SharedPlanData } from '@/components/domain/billing/plan-card-shared'

type Mode = 'loading' | 'create' | 'join' | 'plan'
type DocumentType = 'CPF' | 'CNPJ'

function applyCpfMask(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function applyCnpjMask(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

function applyPhoneMask(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function applyCepMask(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

type ApiPlan = {
  name: string
  displayName: string
  price: number
  description: string
  trialDays: number
}

function apiPlanToShared(plan: ApiPlan, isPopular: boolean): SharedPlanData {
  return {
    name: plan.name,
    displayName: plan.displayName,
    price: plan.price,
    trialDays: plan.trialDays,
    isPopular,
    features: plan.description
      ? plan.description.split('\n').map((l) => l.trim()).filter(Boolean)
      : [],
  }
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-slate-400" />
      </div>
    }>
      <OnboardingContent />
    </Suspense>
  )
}

function OnboardingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<Mode>('loading')
  const [pendingTenantId, setPendingTenantId] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [userName, setUserName] = useState('')
  const [documentType, setDocumentType] = useState<DocumentType>('CPF')
  const [document, setDocument] = useState('')
  const [phone, setPhone] = useState('')
  const [cep, setCep] = useState('')
  const [ownerCpf, setOwnerCpf] = useState('')
  const [reuseOwnerCpf, setReuseOwnerCpf] = useState(false)
  const [joinPassword, setJoinPassword] = useState('')
  const [joinConfirmPassword, setJoinConfirmPassword] = useState('')
  const [joinPasswordError, setJoinPasswordError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadingKey, setLoadingKey] = useState<string | null>(null)
  const [primaryColor, setPrimaryColor] = useState('#191919')
  const [backgroundColor, setBackgroundColor] = useState('#f8f8f7')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [plans, setPlans] = useState<ApiPlan[]>([])
  const [plansLoading, setPlansLoading] = useState(false)
  const [showAllPlans, setShowAllPlans] = useState(false)

  // Plano pré-selecionado vindo da landing page
  const prePlan = searchParams.get('plan')
  const hasPaidPrePlan = !!prePlan

  useEffect(() => {
    if (mode !== 'plan') return
    setPlansLoading(true)
    fetch('/api/public/plans')
      .then((r) => r.json())
      .then((data) => setPlans(data as ApiPlan[]))
      .catch(() => toast.error('Erro ao carregar planos.'))
      .finally(() => setPlansLoading(false))
  }, [mode])

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    const stripeResult = searchParams.get('stripe')

    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata

      if (meta?.onboardingStep === 'plan' && stripeResult === 'success') {
        fetch('/api/billing/sync', { method: 'POST' }).catch(() => {})
        supabase.auth.updateUser({ data: { onboardingStep: 'complete' } }).then(() => {
          router.replace('/onboarding/catalogo')
        })
        return
      }

      if (meta?.pendingTenantId) {
        setPendingTenantId(meta.pendingTenantId as string)
        setUserName(meta.full_name ?? meta.name ?? '')
        setMode('join')
      } else if (meta?.onboardingStep === 'plan') {
        setUserName(meta?.full_name ?? meta?.name ?? '')
        setMode('plan')
      } else {
        // Pré-preenche nome do user_metadata se vier do signup enriquecido
        setUserName(meta?.full_name ?? meta?.name ?? '')
        if (typeof meta?.cpf === 'string') setOwnerCpf(meta.cpf)
        if (typeof meta?.phone === 'string') setPhone(applyPhoneMask(meta.phone))
        if (typeof meta?.cep === 'string') setCep(applyCepMask(meta.cep))
        setMode('create')
      }
    })
  }, [searchParams, router])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const documentDigits = document.replace(/\D/g, '')
    const expectedLength = documentType === 'CPF' ? 11 : 14
    if (documentDigits.length !== expectedLength) {
      toast.error(documentType === 'CPF' ? 'CPF incompleto.' : 'CNPJ incompleto.')
      return
    }
    setIsSubmitting(true)
    try {
      const supabase = createSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { toast.error('Sessão expirada.'); router.push('/login'); return }

      let logoUrl: string | null = null
      if (logoFile) {
        const fd = new FormData()
        fd.append('logo', logoFile)
        const uploadRes = await fetch('/api/iam/branding/logo', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: fd,
        })
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json() as { logoUrl: string }
          logoUrl = uploadData.logoUrl
        }
      }

      const res = await fetch('/api/iam/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          businessName,
          userName,
          documentType,
          document: documentDigits,
          ownerPhone: phone.replace(/\D/g, '').length >= 10 ? phone : undefined,
          zipCode: cep.replace(/\D/g, '').length === 8 ? cep : undefined,
          branding: {
            ...(logoUrl ? { logoUrl } : {}),
            primaryColor,
            backgroundColor,
          },
        }),
      })
      if (!res.ok) {
        const body = await res.json()
        toast.error(body.error?.message ?? 'Erro ao configurar sua conta.')
        return
      }

      await supabase.auth.refreshSession()

      // Sempre exibe seleção de plano — o cliente decide (FREE, trial ou assinatura)
      setMode('plan')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSelectPlan(planName: string, skipTrial = false) {
    // Trial gratuito: ativa sem Stripe, usuário configura o catálogo em seguida
    if (!skipTrial) {
      setLoadingKey(`${planName}_trial`)
      try {
        const res = await fetch('/api/billing/start-trial', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planName }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          toast.error(err?.message ?? 'Erro ao iniciar trial. Tente novamente.')
          return
        }
        const supabase = createSupabaseBrowserClient()
        await supabase.auth.updateUser({ data: { onboardingStep: 'complete' } })
        toast.success('Trial iniciado! Vamos configurar seu catálogo.')
        router.push('/onboarding/catalogo')
      } catch {
        toast.error('Erro de conexão. Tente novamente.')
      } finally {
        setLoadingKey(null)
      }
      return
    }

    // Assinar agora: Stripe checkout imediato
    setLoadingKey(`${planName}_direct`)
    try {
      const origin = window.location.origin
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planName,
          skipTrial: true,
          successUrl: `${origin}/onboarding?stripe=success`,
          cancelUrl: `${origin}/onboarding?stripe=cancelled`,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err?.message ?? 'Erro ao iniciar checkout. Tente novamente.')
        return
      }
      const { checkoutUrl } = await res.json()
      // Marca que está aguardando retorno do Stripe para que o useEffect detecte o success
      const supabase = createSupabaseBrowserClient()
      await supabase.auth.updateUser({ data: { onboardingStep: 'plan' } })
      window.location.href = checkoutUrl
    } catch {
      toast.error('Erro de conexão. Tente novamente.')
    } finally {
      setLoadingKey(null)
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setJoinPasswordError('')

    if (joinPassword.length < 8) {
      setJoinPasswordError('Senha deve ter no mínimo 8 caracteres.')
      return
    }
    if (joinPassword !== joinConfirmPassword) {
      setJoinPasswordError('As senhas não conferem.')
      return
    }

    setIsSubmitting(true)
    try {
      const supabase = createSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { toast.error('Sessão expirada.'); router.push('/login'); return }

      const { error: passwordError } = await supabase.auth.updateUser({ password: joinPassword })
      if (passwordError) {
        toast.error('Erro ao definir senha. Tente novamente.')
        return
      }

      const res = await fetch('/api/iam/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userName }),
      })
      if (!res.ok) {
        const body = await res.json()
        toast.error(body.error?.message ?? 'Erro ao ingressar no workspace.')
        return
      }

      await supabase.auth.refreshSession()

      toast.success('Bem-vindo à equipe!')
      router.push('/agenda')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (mode === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-slate-400" />
      </div>
    )
  }

  if (mode === 'plan') {
    const plansToShow = showAllPlans
      ? plans
      : hasPaidPrePlan
        ? plans.filter((p) => p.name === prePlan)
        : plans

    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="w-full max-w-5xl space-y-8">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#191919]">
            <Sparkles className="size-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#191919]">
              {hasPaidPrePlan && !showAllPlans ? 'Confirme sua assinatura' : 'Escolha seu plano'}
            </h1>
            <p className="mt-2 text-sm text-[#787774]">
              {hasPaidPrePlan && !showAllPlans
                ? 'Você pode iniciar com 14 dias grátis ou assinar agora sem trial.'
                : 'Trial gratuito em qualquer plano pago. Cancele a qualquer momento.'}
            </p>
          </div>

          {plansLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-8 animate-spin text-slate-400" />
            </div>
          ) : (
            <>
              <div className={`grid grid-cols-1 gap-6 ${
                plansToShow.length === 1
                  ? 'sm:max-w-xs'
                  : plansToShow.length === 2
                    ? 'sm:grid-cols-2 sm:max-w-xl'
                    : 'sm:grid-cols-2 lg:grid-cols-4'
              }`}>
                {plansToShow.map((plan) => (
                  <SharedPlanCard
                    key={plan.name}
                    plan={apiPlanToShared(
                      plan,
                      hasPaidPrePlan && !showAllPlans ? true : plan.name === 'PRO',
                    )}
                    badge={hasPaidPrePlan && !showAllPlans ? 'Plano selecionado' : undefined}
                    action={{
                      type: 'onboarding',
                      onSelect: handleSelectPlan,
                      loadingKey,
                    }}
                  />
                ))}
              </div>

              {hasPaidPrePlan && !showAllPlans && (
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setShowAllPlans(true)}
                    className="text-sm text-[#787774] underline hover:text-[#191919] transition-colors"
                  >
                    Ver todos os planos
                  </button>
                </div>
              )}
            </>
          )}

          <p className="text-xs text-center text-[#787774]">
            Você pode alterar o plano a qualquer momento em Configurações → Planos.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex size-10 items-center justify-center rounded-xl bg-[#191919]">
          <Sparkles className="size-5 text-white" />
        </div>

        {mode === 'create' ? (
          <>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#191919]">Quase lá!</h1>
              <p className="mt-2 text-sm text-[#787774]">
                Como se chama seu negócio? Você pode alterar isso depois.
              </p>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nome do negócio</Label>
                <Input
                  placeholder="Ex: Barbearia do João"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                  minLength={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label>CPF ou CNPJ do negócio</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={documentType === 'CPF' ? 'default' : 'outline'}
                    className={`h-11 px-4 ${documentType === 'CPF' ? 'bg-[#191919] hover:bg-[#2d2d2d]' : ''}`}
                    onClick={() => { setDocumentType('CPF'); setDocument(reuseOwnerCpf ? applyCpfMask(ownerCpf) : '') }}
                  >
                    CPF
                  </Button>
                  <Button
                    type="button"
                    variant={documentType === 'CNPJ' ? 'default' : 'outline'}
                    className={`h-11 px-4 ${documentType === 'CNPJ' ? 'bg-[#191919] hover:bg-[#2d2d2d]' : ''}`}
                    onClick={() => { setDocumentType('CNPJ'); setDocument(''); setReuseOwnerCpf(false) }}
                  >
                    CNPJ
                  </Button>
                </div>

                {documentType === 'CPF' && ownerCpf && (
                  <label className="flex items-center gap-2 text-sm text-[#191919]">
                    <input
                      type="checkbox"
                      checked={reuseOwnerCpf}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setReuseOwnerCpf(checked)
                        setDocument(checked ? applyCpfMask(ownerCpf) : '')
                      }}
                    />
                    Usar o meu CPF (mesmo do cadastro)
                  </label>
                )}

                <Input
                  className="h-11"
                  inputMode="numeric"
                  placeholder={documentType === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'}
                  value={document}
                  disabled={documentType === 'CPF' && reuseOwnerCpf}
                  onChange={(e) => setDocument(
                    documentType === 'CPF' ? applyCpfMask(e.target.value) : applyCnpjMask(e.target.value),
                  )}
                  required
                />
                <p className="text-xs text-[#787774]">
                  Documento do seu negócio. Autônomo/MEI? Costuma ser o seu próprio CPF.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>CEP do negócio</Label>
                <Input
                  className="h-11"
                  inputMode="numeric"
                  placeholder="00000-000"
                  value={cep}
                  onChange={(e) => setCep(applyCepMask(e.target.value))}
                />
                <p className="text-xs text-[#787774]">
                  Endereço do seu negócio. Você pode ajustar depois em Configurações.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Seu nome</Label>
                <Input
                  placeholder="Nome completo"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  required
                  minLength={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input
                  className="h-11"
                  inputMode="numeric"
                  placeholder="(00) 0 0000-0000"
                  value={phone}
                  onChange={(e) => setPhone(applyPhoneMask(e.target.value))}
                />
              </div>
              {/* Identidade visual opcional */}
              <div className="space-y-4 border-t border-slate-100 pt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-[#787774]">
                  Identidade visual <span className="font-normal normal-case">(opcional)</span>
                </p>

                <div className="space-y-2">
                  <Label className="text-sm">Logo</Label>
                  <div className="flex items-center gap-3">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo" className="h-12 w-12 rounded-lg object-contain border border-slate-200" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 text-slate-300">
                        <span className="text-lg">+</span>
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => logoInputRef.current?.click()}
                    >
                      Enviar imagem
                    </Button>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (!f) return
                        if (f.size > 2 * 1024 * 1024) {
                          toast.error('Imagem muito grande. O tamanho máximo é 2 MB.')
                          e.target.value = ''
                          return
                        }
                        setLogoFile(f)
                        setLogoPreview(URL.createObjectURL(f))
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-11 w-11 sm:h-8 sm:w-8 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                  />
                  <Label className="text-sm text-slate-700">Cor principal</Label>
                  <span className="font-mono text-xs text-slate-500">{primaryColor}</span>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="h-11 w-11 sm:h-8 sm:w-8 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                  />
                  <Label className="text-sm text-slate-700">Cor de fundo</Label>
                  <span className="font-mono text-xs text-slate-500">{backgroundColor}</span>
                </div>

                <p className="text-xs text-[#787774]">
                  Mais opções em <span className="font-medium">Configurações → Layout</span>
                </p>
              </div>

              <Button
                type="submit"
                className="w-full bg-[#191919] text-white hover:bg-[#2d2d2d]"
                disabled={isSubmitting}
              >
                {isSubmitting ? <><Loader2 className="mr-2 size-4 animate-spin" />Configurando...</> : 'Continuar →'}
              </Button>
            </form>
          </>
        ) : (
          <>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#191919]">Você foi convidado!</h1>
              <p className="mt-2 text-sm text-[#787774]">
                Configure seu acesso para entrar na equipe.
              </p>
            </div>
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Seu nome</Label>
                <Input
                  placeholder="Nome completo"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  required
                  minLength={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Criar senha</Label>
                <Input
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={joinPassword}
                  onChange={(e) => setJoinPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Confirmar senha</Label>
                <Input
                  type="password"
                  placeholder="Repita a senha"
                  value={joinConfirmPassword}
                  onChange={(e) => setJoinConfirmPassword(e.target.value)}
                  required
                />
              </div>
              {joinPasswordError && (
                <p className="text-xs text-red-500">{joinPasswordError}</p>
              )}
              <Button
                type="submit"
                className="w-full bg-[#191919] text-white hover:bg-[#2d2d2d]"
                disabled={isSubmitting}
              >
                {isSubmitting ? <><Loader2 className="mr-2 size-4 animate-spin" />Entrando...</> : 'Entrar na equipe →'}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
