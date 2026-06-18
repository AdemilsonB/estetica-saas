'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type Props = {
  tenantSlug: string
  onIdentified: (customerId: string, name: string, isNew?: boolean) => void
  onBack: () => void
  primaryColor: string
  gateMode?: boolean
}

function applyCpfMask(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function applyPhoneMask(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return `(${d}`
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export function IdentificationStep({ tenantSlug, onIdentified, onBack, primaryColor, gateMode }: Props) {
  const [sessionName, setSessionName] = useState<string | null>(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [cpf, setCpf] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [newName, setNewName] = useState('')
  const [newCpf, setNewCpf] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newBirthDate, setNewBirthDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch(`/api/public/${tenantSlug}/me`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { name?: string } | null) => {
        if (data?.name) setSessionName(data.name)
      })
      .catch(() => {})
      .finally(() => setLoadingSession(false))
  }, [tenantSlug])

  async function handleLogout() {
    await fetch(`/api/public/${tenantSlug}/auth/logout`, { method: 'POST' }).catch(() => {})
    setSessionName(null)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/public/${tenantSlug}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: cpf.replace(/\D/g, ''), birthDate }),
      })
      const data = (await res.json()) as { id?: string; name?: string; error?: { message: string } }
      if (!res.ok) {
        setError(data.error?.message ?? 'Dados não encontrados')
        return
      }
      onIdentified(data.id ?? '', data.name ?? '', false)
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/public/${tenantSlug}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          cpf: newCpf.replace(/\D/g, ''),
          phone: newPhone.replace(/\D/g, ''),
          email: newEmail,
          birthDate: newBirthDate,
        }),
      })
      const data = (await res.json()) as { id?: string; name?: string; error?: { message: string } }
      if (!res.ok) {
        setError(data.error?.message ?? 'Erro ao cadastrar')
        return
      }
      onIdentified(data.id ?? '', data.name ?? newName, true)
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (loadingSession) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-5 animate-spin text-slate-400" />
      </div>
    )
  }

  if (sessionName) {
    return (
      <div className="space-y-4">
        {!gateMode && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 -ml-1 py-1 px-1 rounded"
          >
            <ChevronLeft className="size-4" />
            Voltar
          </button>
        )}
        <div className="rounded-2xl border bg-white p-5 space-y-4">
          <div>
            <p className="text-sm text-slate-500">Agendando para</p>
            <p className="text-xl font-semibold text-slate-900">{sessionName} 👋</p>
          </div>
          <Button
            className="w-full"
            size="lg"
            style={{ backgroundColor: primaryColor }}
            onClick={() => {
              fetch(`/api/public/${tenantSlug}/me`)
                .then((r) => (r.ok ? r.json() : null))
                .then((data: { id?: string; name?: string } | null) => {
                  if (data?.id) {
                    onIdentified(data.id, data.name ?? sessionName)
                  }
                })
                .catch(() => onIdentified('', sessionName))
            }}
          >
            Continuar
          </Button>
          <button
            className="w-full text-sm text-slate-400 hover:text-slate-600"
            onClick={() => void handleLogout()}
          >
            Não sou eu
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {!gateMode && (
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 -ml-1 py-1 px-1 rounded"
        >
          <ChevronLeft className="size-4" />
          Voltar
        </button>
      )}
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          {gateMode ? 'Bem-vindo! Identifique-se para agendar.' : 'Quem vai ser atendido?'}
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          {gateMode ? 'Entre com sua conta ou cadastre-se.' : 'Identifique-se para continuar.'}
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <Tabs defaultValue="login">
        <TabsList className="w-full">
          <TabsTrigger value="login" className="flex-1">Já sou cliente</TabsTrigger>
          <TabsTrigger value="register" className="flex-1">Primeira vez aqui</TabsTrigger>
        </TabsList>

        <TabsContent value="login">
          <form onSubmit={(e) => void handleLogin(e)} className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <Label htmlFor="id-cpf">CPF</Label>
              <Input
                id="id-cpf"
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(applyCpfMask(e.target.value))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="id-birth">Data de nascimento</Label>
              <Input
                id="id-birth"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : 'Entrar'}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="register">
          <form onSubmit={(e) => void handleRegister(e)} className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <Label htmlFor="reg-name">Nome completo *</Label>
              <Input
                id="reg-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                minLength={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-cpf">CPF *</Label>
              <Input
                id="reg-cpf"
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={newCpf}
                onChange={(e) => setNewCpf(applyCpfMask(e.target.value))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-phone">Telefone/WhatsApp *</Label>
              <Input
                id="reg-phone"
                type="tel"
                inputMode="numeric"
                placeholder="(00) 00000-0000"
                value={newPhone}
                onChange={(e) => setNewPhone(applyPhoneMask(e.target.value))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-email">E-mail *</Label>
              <Input
                id="reg-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-birth">Data de nascimento *</Label>
              <Input
                id="reg-birth"
                type="date"
                value={newBirthDate}
                onChange={(e) => setNewBirthDate(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : 'Cadastrar e continuar'}
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  )
}
