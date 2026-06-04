import { UserRole } from '@prisma/client'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { cache } from 'react'

import { getSupabaseSessionFromToken } from '@/integrations/supabase/auth'
import { env, isProduction } from '@/shared/config/env'
import { prisma } from '@/shared/database/prisma'
import { UnauthorizedError } from '@/shared/errors'
import { buildOwnerPermissions } from '@/shared/permissions/nav-registry'
import type { SessionContext } from '@/shared/types/auth'

const permissionsHeaderName = 'x-user-permissions'
const authorizationHeaderName = 'authorization'
const devSessionHeaderName = 'x-auth-mode'

const LEGACY_ROLE_PERMISSIONS: Record<string, Record<string, string[]>> = {
  MANAGER:      { agenda: ['view','create','edit','delete'], servicos: ['view','create','edit','delete'], clientes: ['view','create','edit'], financeiro: ['view','create','edit'], relatorios: ['view'], equipe: ['view'], configuracoes: ['view','edit'] },
  PROFESSIONAL: { agenda: ['view','create'], servicos: ['view'], clientes: ['view'] },
  RECEPTIONIST: { agenda: ['view','create','edit'], servicos: ['view'], clientes: ['view','create','edit'] },
}

function buildLegacyPermissions(role: string): Record<string, string[]> {
  return LEGACY_ROLE_PERMISSIONS[role] ?? {}
}

async function buildSessionFromUserId(userId: string, tenantId: string): Promise<SessionContext> {
  const dbUser = await prisma.user.findFirst({
    where: { id: userId, tenantId },
    select: {
      role: true,
      roleId: true,
      customRole: { select: { permissions: true } },
    },
  })

  if (!dbUser) {
    throw new UnauthorizedError('Usuario nao encontrado no tenant.')
  }

  const isOwner = dbUser.role === UserRole.OWNER

  let permissions: Record<string, string[]>
  if (isOwner) {
    permissions = buildOwnerPermissions()
  } else if (dbUser.customRole?.permissions) {
    permissions = dbUser.customRole.permissions as Record<string, string[]>
  } else {
    // Fallback para usuários sem roleId (período de migração ou tenant sem cargos semeados)
    permissions = buildLegacyPermissions(dbUser.role)
  }

  return { tenantId, userId, isOwner, permissions }
}

export const getSessionContext = cache(async (request: Request): Promise<SessionContext> => {
  // 1. Bearer token
  const accessToken = extractAccessToken(request)
  if (accessToken) {
    const partial = await getSupabaseSessionFromToken(accessToken)
    return buildSessionFromUserId(partial.userId, partial.tenantId)
  }

  // 2. Modo desenvolvimento
  if (!isProduction && request.headers.get(devSessionHeaderName) === 'headers') {
    return getDevelopmentHeaderSession(request)
  }

  // 3. Cookie do @supabase/ssr
  const cookieStore = await cookies()
  const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll() {},
    },
  })

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new UnauthorizedError(
      'Sessao ausente. Envie Bearer token do Supabase ou use o modo de desenvolvimento explicitamente.',
    )
  }

  const tenantId = user.app_metadata?.tenantId ?? user.user_metadata?.tenantId

  if (!tenantId) {
    throw new UnauthorizedError('Tenant ausente na sessao autenticada.')
  }

  return buildSessionFromUserId(user.id, tenantId)
})

async function getDevelopmentHeaderSession(request: Request): Promise<SessionContext> {
  const tenantId = request.headers.get('x-tenant-id')
  const userId = request.headers.get('x-user-id')
  const roleValue = request.headers.get('x-user-role')
  const permissionsValue = request.headers.get(permissionsHeaderName)

  if (!tenantId || !userId || !roleValue) {
    throw new UnauthorizedError('Cabecalhos de autenticacao ausentes.')
  }

  if (!Object.values(UserRole).includes(roleValue as UserRole)) {
    throw new UnauthorizedError('Role invalida.')
  }

  const isOwner = roleValue === UserRole.OWNER

  let permissions: Record<string, string[]>
  if (isOwner) {
    permissions = buildOwnerPermissions()
  } else if (permissionsValue) {
    try {
      permissions = JSON.parse(permissionsValue) as Record<string, string[]>
    } catch {
      permissions = {}
    }
  } else {
    permissions = {}
  }

  return { tenantId, userId, isOwner, permissions }
}

export async function withTenant(request: Request) {
  const session = await getSessionContext(request)
  return session.tenantId
}

function extractAccessToken(request: Request) {
  const authorizationHeader = request.headers.get(authorizationHeaderName)
  if (authorizationHeader?.startsWith('Bearer ')) {
    return authorizationHeader.slice('Bearer '.length).trim()
  }

  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return null

  const cookieMap = new Map(
    cookieHeader.split(';').map((cookie) => {
      const [name, ...rest] = cookie.trim().split('=')
      return [name, rest.join('=')]
    }),
  )

  const cookieToken =
    cookieMap.get('sb-access-token') ??
    cookieMap.get(`${new URL(env.SUPABASE_URL).hostname}-access-token`)

  return cookieToken ? decodeURIComponent(cookieToken) : null
}
