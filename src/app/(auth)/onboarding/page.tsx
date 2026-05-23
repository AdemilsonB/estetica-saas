// src/app/(auth)/onboarding/page.tsx
'use client'

import { useEffect, useState } from 'react'
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

      const res = await fetch('/api/iam/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ businessName, userName }),
      })
      if (!res.ok) {
        const body = await res.json()
        toast.error(body.error?.message ?? 'Erro ao configurar sua conta.')
        return
      }
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
