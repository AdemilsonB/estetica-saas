import { SignJWT, jwtVerify } from 'jose'

const ALG = 'HS256'

function getSecret(): Uint8Array {
  const secret = process.env.ADMIN_IMPERSONATE_SECRET
  if (!secret) throw new Error('ADMIN_IMPERSONATE_SECRET não configurada.')
  return new TextEncoder().encode(secret)
}

export type ImpersonationPayload = {
  tenantId: string
  adminId: string
  isImpersonating: true
}

export async function signImpersonationToken(
  payload: Omit<ImpersonationPayload, 'isImpersonating'>,
): Promise<string> {
  return new SignJWT({ ...payload, isImpersonating: true as const })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime('30m')
    .sign(getSecret())
}

export async function verifyImpersonationToken(token: string): Promise<ImpersonationPayload> {
  const { payload } = await jwtVerify(token, getSecret())
  return payload as unknown as ImpersonationPayload
}
