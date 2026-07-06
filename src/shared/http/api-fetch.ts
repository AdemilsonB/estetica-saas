export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly data?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// handleApiError serializa como { error: { code, message, details } }
type ErrorBody = { error?: { code?: string; message?: string; details?: unknown } }

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init)
  if (res.ok) return res
  let body: ErrorBody = {}
  try {
    body = (await res.clone().json()) as ErrorBody
  } catch {
    // corpo não-JSON: mantém body vazio
  }
  throw new ApiError(
    body.error?.message ?? `Erro ${res.status}`,
    res.status,
    body.error?.code,
    body.error?.details,
  )
}
