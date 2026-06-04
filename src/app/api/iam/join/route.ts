import { z } from 'zod'
import { iamService } from '@/domains/iam/iam.service'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { handleApiError } from '@/shared/http/handle-api-error'
import { UnauthorizedError, ForbiddenError } from '@/shared/errors'
import { createSupabaseServerClient } from '@/integrations/supabase/server'
import { prisma } from '@/shared/database/prisma'

const joinSchema = z.object({
  userName: z.string().min(2),
})

export async function POST(request: Request) {
  initializeDomainRuntime()
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Token ausente.')
    }
    const token = authHeader.slice(7)
    const supabase = createSupabaseServerClient(token)
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) throw new UnauthorizedError('Sessao invalida.')

    const { id: userId, email, user_metadata } = data.user
    if (!email) throw new UnauthorizedError('Email nao encontrado na sessao.')

    const pendingTenantId = user_metadata?.pendingTenantId as string | undefined

    if (!pendingTenantId) {
      throw new ForbiddenError('Nenhum convite pendente encontrado para este usuario.')
    }

    // Suporta novo formato (pendingRoleId) e legado (pendingRole → busca role pelo nome)
    let pendingRoleId = user_metadata?.pendingRoleId as string | undefined
    if (!pendingRoleId) {
      // fallback: convite antigo sem roleId — busca o cargo Profissional padrão
      const defaultRole = await prisma.role.findFirst({
        where: { tenantId: pendingTenantId, name: 'Profissional' },
        select: { id: true },
      })
      pendingRoleId = defaultRole?.id ?? ''
    }

    if (!pendingRoleId) {
      throw new ForbiddenError('Cargo do convite nao encontrado.')
    }

    const body = await request.json()
    const parsed = joinSchema.safeParse(body)
    const userName = parsed.success ? parsed.data.userName : email.split('@')[0]

    const user = await iamService.joinTenant(userId, email, pendingTenantId, pendingRoleId, userName)

    return Response.json({ tenantId: pendingTenantId, userId: user.id }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
