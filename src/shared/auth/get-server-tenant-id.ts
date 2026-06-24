import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { env } from '@/shared/config/env'

/**
 * Retorna o tenantId da sessão a partir dos cookies do Supabase.
 * Uso exclusivo em Server Components e layouts — não use em API Routes
 * (nesses casos, use getSessionContext(request)).
 */
export async function getServerTenantId(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    })
    const { data: { user } } = await supabase.auth.getUser()
    return user?.app_metadata?.tenantId ?? user?.user_metadata?.tenantId ?? null
  } catch {
    return null
  }
}

/**
 * Retorna tenantId + papel do usuário da sessão.
 * Usado por layouts que precisam decidir se o usuário pode contratar/renovar
 * a assinatura do tenant (apenas o OWNER pode iniciar checkout/trial).
 */
export async function getServerSessionInfo(): Promise<{ tenantId: string | null; isOwner: boolean }> {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    })
    const { data: { user } } = await supabase.auth.getUser()
    const tenantId = user?.app_metadata?.tenantId ?? user?.user_metadata?.tenantId ?? null
    const role = user?.app_metadata?.role ?? user?.user_metadata?.role ?? null
    return { tenantId, isOwner: role === 'OWNER' }
  } catch {
    return { tenantId: null, isOwner: false }
  }
}
