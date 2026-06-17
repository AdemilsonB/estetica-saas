'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'

type Member = {
  id: string
  name: string
  role: string
  avatarUrl: string | null
  showOnPublicPage: boolean
}

export function TeamVisibilityList() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/iam/users')
      .then((r) => r.json())
      .then((data) => setMembers(data as Member[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleToggle(memberId: string, value: boolean) {
    setPending((s) => new Set(s).add(memberId))
    try {
      const res = await fetch(`/api/iam/users/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showOnPublicPage: value }),
      })
      if (!res.ok) throw new Error()
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, showOnPublicPage: value } : m)),
      )
    } catch {
      toast.error('Falha ao atualizar visibilidade')
    } finally {
      setPending((s) => {
        const n = new Set(s)
        n.delete(memberId)
        return n
      })
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-3">
        Membros visíveis aparecem na seção &quot;Nossa equipe&quot; da sua vitrine online.
      </p>
      {members.map((m) => (
        <div
          key={m.id}
          className="flex items-center justify-between rounded-xl border bg-card px-4 py-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
              {m.name[0]?.toUpperCase()}
            </div>
            <span className="truncate text-sm font-medium">{m.name}</span>
          </div>
          <Switch
            checked={m.showOnPublicPage}
            disabled={pending.has(m.id)}
            onCheckedChange={(v) => handleToggle(m.id, v)}
            aria-label={`Exibir ${m.name} na página pública`}
          />
        </div>
      ))}
    </div>
  )
}
