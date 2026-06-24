import { ForbiddenError, RateLimitExceededError } from '@/shared/errors'
import { getSessionContext } from '@/shared/auth/session'
import { supabaseAdmin } from '@/integrations/supabase/admin'
import { checkAdminRateLimit } from '@/shared/rate-limit/admin-rate-limit'
import type { SessionContext } from '@/shared/types/auth'

export async function getAdminContext(request: Request): Promise<SessionContext> {
  const session = await getSessionContext(request)
  const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(session.userId)
  if (!user?.app_metadata?.isSystemAdmin) {
    throw new ForbiddenError('Acesso restrito a administradores do sistema.')
  }

  const { allowed } = await checkAdminRateLimit({ adminUserId: session.userId })
  if (!allowed) {
    throw new RateLimitExceededError()
  }

  return session
}
