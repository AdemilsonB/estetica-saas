import { createHmac, timingSafeEqual } from 'crypto'

let cachedSecret: string | null = null

// Resolvido de forma lazy (na primeira assinatura/verificação em runtime), nunca no
// carregamento do módulo — do contrário o `next build` quebra ao coletar page data
// em produção sem a env var. O throw fail-closed acontece na primeira requisição real.
function getSessionSecret(): string {
  if (cachedSecret) return cachedSecret
  const secret = process.env.PUBLIC_SESSION_SECRET
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error(
      'PUBLIC_SESSION_SECRET não está configurado. Adicione essa variável de ambiente em produção.',
    )
  }
  cachedSecret = secret ?? 'dev-secret-change-in-production'
  return cachedSecret
}

export const COOKIE_NAME = 'agende_pub_sess'
export const MAX_AGE_SECONDS = 30 * 24 * 60 * 60 // 30 dias

export type PublicCustomerPayload = {
  customerId: string
  tenantId: string
  slug: string
  iat: number
  exp: number
}

function signToken(payload: PublicCustomerPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', getSessionSecret()).update(data).digest('base64url')
  return `${data}.${sig}`
}

export function createPublicSession(
  customerId: string,
  tenantId: string,
  slug: string,
): string {
  const now = Math.floor(Date.now() / 1000)
  return signToken({
    customerId,
    tenantId,
    slug,
    iat: now,
    exp: now + MAX_AGE_SECONDS,
  })
}

export function verifyPublicSession(token: string): PublicCustomerPayload | null {
  try {
    const dotIdx = token.lastIndexOf('.')
    if (dotIdx < 0) return null
    const data = token.slice(0, dotIdx)
    const sig = token.slice(dotIdx + 1)
    const expected = createHmac('sha256', getSessionSecret())
      .update(data)
      .digest('base64url')
    if (
      sig.length !== expected.length ||
      !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    )
      return null
    const payload = JSON.parse(
      Buffer.from(data, 'base64url').toString(),
    ) as PublicCustomerPayload
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}
