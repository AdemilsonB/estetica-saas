import { describe, it, expect, beforeEach } from 'vitest'
import { signImpersonationToken, verifyImpersonationToken } from './impersonation'

describe('impersonation JWT', () => {
  beforeEach(() => {
    process.env.ADMIN_IMPERSONATE_SECRET = 'test-secret-must-be-at-least-32-chars!!'
  })

  it('assina e verifica um token válido', async () => {
    const token = await signImpersonationToken({ tenantId: 'tenant-1', adminId: 'admin-1' })
    expect(typeof token).toBe('string')

    const payload = await verifyImpersonationToken(token)
    expect(payload.tenantId).toBe('tenant-1')
    expect(payload.adminId).toBe('admin-1')
    expect(payload.isImpersonating).toBe(true)
  })

  it('rejeita token inválido', async () => {
    await expect(verifyImpersonationToken('invalid.token.here')).rejects.toThrow()
  })

  it('rejeita token de outra secret', async () => {
    const token = await signImpersonationToken({ tenantId: 'tenant-1', adminId: 'admin-1' })
    process.env.ADMIN_IMPERSONATE_SECRET = 'outra-secret-completamente-diferente!!'
    await expect(verifyImpersonationToken(token)).rejects.toThrow()
  })
})
