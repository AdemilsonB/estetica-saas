'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, X } from 'lucide-react'
import { getImpersonationSession, clearImpersonationSession } from '@/lib/impersonation-client'
import type { ImpersonationSession } from '@/lib/impersonation-client'

export function ImpersonationBanner() {
  const router = useRouter()
  const [session, setSession] = useState<ImpersonationSession | null>(null)

  useEffect(() => {
    setSession(getImpersonationSession())
  }, [])

  if (!session) return null

  const handleExit = () => {
    clearImpersonationSession()
    router.push('/admin/tenants')
  }

  return (
    <div className="flex items-center justify-between bg-amber-400 px-4 py-2 text-sm font-medium text-amber-950">
      <div className="flex items-center gap-2">
        <Eye className="size-4" />
        <span>Visualizando como: <strong>{session.tenantName}</strong></span>
      </div>
      <button
        onClick={handleExit}
        className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-amber-500 transition-colors"
      >
        <X className="size-3.5" />
        Sair da visualização
      </button>
    </div>
  )
}
