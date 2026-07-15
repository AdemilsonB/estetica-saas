import { UserRole } from '@prisma/client'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { cache } from 'react'

import { getSupabaseSessionFromToken } from '@/integrations/supabase/auth'
import { env, isProduction } from '@/shared/config/env'
import { prisma } from '@/shared/database/prisma'
import { TenantBlockedError, UnauthorizedError } from '@/shared/errors'
import { verifyImpersonationToken } from '@/shared/auth/impersonation'
import { buildOwnerPermissions, buildDefaultRolePermissions } from '@/shared/permissions/nav-registry'
import { buildDefaultExtraPermissions } from '@/shared/permissions/extra-permission-registry'
import { expandPermissionsWithDependencies } from '@/shared/permissions/permission-dependencies'
import type { SessionContext } from '@/shared/types/auth'

const permissionsHeaderName = 'x-user-permissions'
const authorizationHeaderName = 'authorization'
const devSessionHeaderName = 'x-auth-mode'

const LEGACY_PRESETS = ['MANAGER', 'PROFESSIONAL', 'RECEPTIONIST'] as const
type LegacyPreset = (typeof LEGACY_PRESETS)[number]

function isLegacyPreset(role: string): role is LegacyPreset {
  return (LEGACY_PRESETS as readonly string[]).includes(role)
}

/**
 * Rede de segurança para usuários sem `roleId` (período de migração ou tenant
 * sem cargos semeados) — nunca deveria ser o caminho real em produção depois
 * do backfill (scripts/backfill-rbac-consistency.ts). Calculado a partir do
 * nav-registry em vez de hardcoded para nunca divergir da matriz de cargos.
 */
function buildLegacyPermissions(role: string): Record<string, string[]> {
  if (!isLegacyPreset(role)) return {}
  const base = {
    ...buildDefaultRolePermissions(role),
    ...buildDefaultExtraPermissions(role),
  }
  return expandPermissionsWithDependencies(base).permissions
}

async function buildSessionFromUserId(
  userId: string,
  tenantId: string,
  isImpersonating = false,
): Promise<SessionContext> {
  const [dbUser, dbTenant] = await Promise.all([
    prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: {
        role: true,
        roleId: true,
        customRole: { select: { permissions: true } },
      },
    }),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { isBlocked: true },
    }),
  ])

  if (dbTenant?.isBlocked) throw new TenantBlockedError()

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

  return { tenantId, userId, isOwner, permissions, isImpersonating }
}

export const getSessionContext = cache(async (request: Request): Promise<SessionContext> => {
  // 0. Impersonação — admin visualizando como dono do tenant
  const impersonateHeader = request.headers.get('x-impersonate-token')
  if (impersonateHeader) {
    const payload = await verifyImpersonationToken(impersonateHeader)

    const [owner, tenant] = await Promise.all([
      prisma.user.findFirst({
        where: { tenantId: payload.tenantId, role: UserRole.OWNER },
        select: { id: true },
      }),
      prisma.tenant.findUnique({
        where: { id: payload.tenantId },
        select: { isBlocked: true },
      }),
    ])

    if (tenant?.isBlocked) throw new TenantBlockedError()
    if (!owner) throw new UnauthorizedError('Owner do tenant não encontrado.')

    return {
      tenantId: payload.tenantId,
      userId: owner.id,
      isOwner: true,
      permissions: buildOwnerPermissions(),
      isImpersonating: true,
    }
  }

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
