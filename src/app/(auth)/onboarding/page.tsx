// src/app/(auth)/onboarding/page.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createSupabaseBrowserClient } from '@/integrations/supabase/client'

type Mode = 'loading' | 'create' | 'join'

export default function OnboardingPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('loading')
  const [pendingTenantId, setPendingTenantId] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [userName, setUserName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [primaryColor, setPrimaryColor] = useState('#191919')
  const [backgroundColor, setBackgroundColor] = useState('#f8f8f7')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata
      if (meta?.pendingTenantId) {
        setPendingTenantId(meta.pendingTenantId as string)
        setUserName(meta.full_name ?? meta.name ?? '')
        setMode('join')
      } else {
        setUserName(meta?.full_name ?? meta?.name ?? '')
        setMode('create')
      }
    })
  }, [])

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
      toast.success('Tudo pronto! Bem-vindo ao workspace.')
      router.push('/dashboard')
      router.refresh()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const supabase = createSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { toast.error('Sessão expirada.'); router.push('/login'); return }

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

      // Atualiza o JWT para incluir tenantId e role em app_metadata
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
                {isSubmitting ? <><Loader2 className="mr-2 size-4 animate-spin" />Configurando...</> : 'Começar →'}
              </Button>
            </form>
          </>
        ) : (
          <>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#191919]">Você foi convidado!</h1>
              <p className="mt-2 text-sm text-[#787774]">
                Como você quer ser chamado pela equipe?
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
