'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/integrations/supabase/client'

export default function CallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()

    async function processCallback() {
      try {
        const hashParams = new URLSearchParams(window.location.hash.slice(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')

        if (accessToken && refreshToken) {
          // Fluxo implícito: convites Supabase enviam tokens no hash
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (error) {
            router.replace('/login')
            return
          }
        } else {
          // Fluxo PKCE: código de autorização na query string
          const code = new URLSearchParams(window.location.search).get('code')
          if (!code) {
            router.replace('/login')
            return
          }
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) {
            router.replace('/login')
            return
          }
        }

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.replace('/login')
          return
        }

        if (user.app_metadata?.isSystemAdmin) {
          router.replace('/admin')
        } else if (user.app_metadata?.tenantId) {
          router.replace('/agenda')
        } else {
          router.replace('/onboarding')
        }
      } catch {
        router.replace('/login')
      }
    }

    processCallback()
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f6f3]">
      <Loader2 className="size-8 animate-spin text-slate-400" />
    </div>
  )
}
