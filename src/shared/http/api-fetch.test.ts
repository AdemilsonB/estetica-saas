import { describe, it, expect, vi } from 'vitest'
import { apiFetch, ApiError } from './api-fetch'

describe('apiFetch', () => {
  it('lança ApiError com status e code do corpo quando !ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'PLAN_LIMIT_EXCEEDED', message: 'x', details: { limitType: 'users' } } }), { status: 402 }),
    ))
    await expect(apiFetch('/x')).rejects.toMatchObject({ status: 402, code: 'PLAN_LIMIT_EXCEEDED' })
    vi.unstubAllGlobals()
  })

  it('retorna a Response quando ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })))
    const res = await apiFetch('/x')
    expect(res.status).toBe(200)
    vi.unstubAllGlobals()
  })
})
