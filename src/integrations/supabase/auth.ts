import { createSupabaseServerClient } from './server'
import { UnauthorizedError } from '@/shared/errors'

export async function getVerifiedUserId(accessToken: string): Promise<string> {
  const supabase = createSupabaseServerClient(accessToken)
  const { data, error } = await supabase.auth.getUser(accessToken)
  if (error || !data.user) {
    throw new UnauthorizedError('Sessao invalida ou expirada.')
  }
  return data.user.id
}

export async function getSupabaseSessionFromToken(
  accessToken: string,
): Promise<{ userId: string; tenantId: string }> {
  const supabase = createSupabaseServerClient(accessToken)
  const { data, error } = await supabase.auth.getUser(accessToken)
  const user = data.user

  if (error || !user) {
    throw new UnauthorizedError('Sessao invalida ou expirada.')
  }

  const tenantId =
    user.app_metadata?.tenantId ?? user.user_metadata?.tenantId

  if (!tenantId) {
    throw new UnauthorizedError('Tenant ausente na sessao autenticada.')
  }

  return { userId: user.id, tenantId }
}
