import { ForbiddenError } from '@/shared/errors'
import { getSessionContext } from '@/shared/auth/session'
import { supabaseAdmin } from '@/integrations/supabase/admin'
import type { SessionContext } from '@/shared/types/auth'

export async function getAdminContext(request: Request): Promise<SessionContext> {
  const session = await getSessionContext(request)
  const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(session.userId)
  if (!user?.app_metadata?.isSystemAdmin) {
    throw new ForbiddenError('Acesso restrito a administradores do sistema.')
  }
  return session
}
