'use client'

import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function applyCpfMask(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

export default function EntrarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const router = useRouter()
  const [cpf, setCpf] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/public/${slug}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: cpf.replace(/\D/g, ''), birthDate }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: { message: string } }
        if (res.status === 429) {
          setError('Muitas tentativas. Aguarde 15 minutos.')
        } else {
          setError(data.error?.message ?? 'Dados não encontrados')
        }
        return
      }
      router.replace(`/${slug}/cliente`)
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-10">
      <div className="space-y-1 mb-8 text-center">
        <h1 className="text-2xl font-semibold">Acesse sua conta</h1>
        <p className="text-sm text-muted-foreground">
          Consulte seu histórico e próximos agendamentos
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="login-cpf">CPF</Label>
          <Input
            id="login-cpf"
            inputMode="numeric"
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(e) => setCpf(applyCpfMask(e.target.value))}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="login-birth">Data de nascimento</Label>
          <Input
            id="login-birth"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full min-h-[48px]" disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : 'Entrar'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Primeira vez?{' '}
        <a href={`/agendar/${slug}`} className="font-medium underline">
          Faça seu primeiro agendamento
        </a>
      </p>
    </div>
  )
}
