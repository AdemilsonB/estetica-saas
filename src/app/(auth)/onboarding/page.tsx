// src/app/(auth)/onboarding/page.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createSupabaseBrowserClient } from '@/integrations/supabase/client'

type Mode = 'loading' | 'create' | 'join' | 'plan'

type ApiPlan = {
  name: string
  displayName: string
  price: number
  description: string
  trialDays: number
}

function formatPrice(price: number) {
  if (price === 0) return 'Grátis'
  return `R$${Math.round(price)}/mês`
}

function planFeatures(plan: ApiPlan): string[] {
  if (!plan.description) return []
  return plan.description.split('\n').map((l) => l.trim()).filter(Boolean)
}

export default function OnboardingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<Mode>('loading')
  const [pendingTenantId, setPendingTenantId] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [userName, setUserName] = useState('')
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
        supabase.auth.updateUser({ data: { onboardingStep: 'complete' } }).then(() => {
          router.replace('/agenda')
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
        setUserName(meta?.full_name ?? meta?.name ?? '')
        setMode('create')
      }
    })
  }, [searchParams, router])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
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
          const data = await uploadRes.json() as { logoUrl: string }
          logoUrl = data.logoUrl
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
      setMode('plan')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSelectPlan(planName: string, skipTrial = false) {
    if (planName === 'FREE') {
      const supabase = createSupabaseBrowserClient()
      await supabase.auth.updateUser({ data: { onboardingStep: 'complete' } })
      toast.success('Tudo pronto! Bem-vindo ao workspace.')
      router.push('/agenda')
      router.refresh()
      return
    }

    const key = skipTrial ? `${planName}_direct` : `${planName}_trial`
    setLoadingKey(key)
    try {
      const origin = window.location.origin
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planName,
          skipTrial,
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
      router.refresh()
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
    const trialDays = plans.find((p) => p.price > 0)?.trialDays ?? 14
    const isPopular = (name: string) => name === 'PRO'

    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="w-full max-w-5xl space-y-8">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#191919]">
            <Sparkles className="size-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#191919]">Escolha seu plano</h1>
            <p className="mt-2 text-sm text-[#787774]">
              {trialDays} dias grátis em qualquer plano pago. Cancele a qualquer momento.
            </p>
          </div>

          {plansLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-8 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {plans.map((plan) => {
                const popular = isPopular(plan.name)
                const features = planFeatures(plan)
                return (
                  <div
                    key={plan.name}
                    className={`relative rounded-xl border bg-white p-5 flex flex-col gap-4
                      ${popular ? 'border-[#191919] shadow-md ring-1 ring-[#191919]' : 'border-slate-200'}`}
                  >
                    {popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="rounded-full bg-[#191919] px-3 py-1 text-xs font-medium text-white">Mais popular</span>
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-[#191919]">{plan.displayName}</p>
                      <p className="text-xl font-bold text-[#191919] mt-1">{formatPrice(plan.price)}</p>
                    </div>
                    <ul className="space-y-1.5 flex-1">
                      {features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                          <Check className="size-4 text-green-500 mt-0.5 shrink-0" />{f}
                        </li>
                      ))}
                    </ul>
                    {plan.name === 'FREE' ? (
                      <Button
                        onClick={() => handleSelectPlan('FREE')}
                        disabled={loadingKey !== null}
                        variant="outline"
                      >
                        Começar grátis
                      </Button>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {plan.trialDays > 0 && (
                          <Button
                            onClick={() => handleSelectPlan(plan.name, false)}
                            disabled={loadingKey !== null}
                            variant={popular ? 'default' : 'outline'}
                            className={popular ? 'bg-[#191919] hover:bg-[#2d2d2d]' : ''}
                          >
                            {loadingKey === `${plan.name}_trial`
                              ? <><Loader2 className="mr-2 size-4 animate-spin" />Redirecionando...</>
                              : `Testar ${plan.trialDays} dias grátis`
                            }
                          </Button>
                        )}
                        <Button
                          onClick={() => handleSelectPlan(plan.name, true)}
                          disabled={loadingKey !== null}
                          variant="ghost"
                          className="text-slate-500 text-sm"
                        >
                          {loadingKey === `${plan.name}_direct`
                            ? <><Loader2 className="mr-2 size-4 animate-spin" />Redirecionando...</>
                            : 'Assinar agora'
                          }
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
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
                <Label>Seu nome</Label>
                <Input
                  placeholder="Nome completo"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  required
                  minLength={2}
                />
              </div>
              {/* Identidade visual opcional */}
              <div className="space-y-4 border-t border-slate-100 pt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-[#787774]">
                  Identidade visual <span className="font-normal normal-case">(opcional)</span>
                </p>

                {/* Logo */}
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
                        if (f && f.size <= 2 * 1024 * 1024) {
                          setLogoFile(f)
                          setLogoPreview(URL.createObjectURL(f))
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Cor principal */}
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-8 w-8 cursor-pointer rounded border border-slate-200"
                  />
                  <Label className="text-sm text-slate-700">Cor principal</Label>
                  <span className="font-mono text-xs text-slate-500">{primaryColor}</span>
                </div>

                {/* Cor de fundo */}
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="h-8 w-8 cursor-pointer rounded border border-slate-200"
                  />
                  <Label className="text-sm text-slate-700">Cor de fundo</Label>
                  <span className="font-mono text-xs text-slate-500">{backgroundColor}</span>
                </div>

                {/* Hint */}
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
