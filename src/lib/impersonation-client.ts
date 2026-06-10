export interface ImpersonationSession {
  token: string
  tenantId: string
  tenantName: string
}

const STORAGE_KEY = 'impersonation_session'

export function storeImpersonationSession(session: ImpersonationSession): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  patchWindowFetch(session.token)
}

export function getImpersonationSession(): ImpersonationSession | null {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as ImpersonationSession
  } catch {
    return null
  }
}

export function clearImpersonationSession(): void {
  sessionStorage.removeItem(STORAGE_KEY)
  restoreWindowFetch()
}

const ORIGINAL_FETCH = typeof window !== 'undefined' ? window.fetch : null

function patchWindowFetch(token: string): void {
  if (typeof window === 'undefined') return
  window.fetch = (input, init = {}) => {
    const headers = new Headers(init.headers)
    headers.set('X-Impersonate-Token', token)
    return (ORIGINAL_FETCH ?? fetch)(input, { ...init, headers })
  }
}

function restoreWindowFetch(): void {
  if (typeof window === 'undefined' || !ORIGINAL_FETCH) return
  window.fetch = ORIGINAL_FETCH
}
