// Fetch compartilhado dos hooks de relatório: converte o 403 de feature de
// plano em erro tipado para a UI exibir upsell em vez de erro genérico.
export class FeatureLockedError extends Error {
  constructor() {
    super('PLAN_FEATURE_REQUIRED')
    this.name = 'FeatureLockedError'
  }
}

export async function fetchReport<T>(url: URL): Promise<T> {
  const res = await fetch(url)
  if (res.status === 403) {
    const body: { error?: { code?: string } } | null = await res.json().catch(() => null)
    if (body?.error?.code === 'PLAN_FEATURE_REQUIRED') throw new FeatureLockedError()
  }
  if (!res.ok) throw new Error('Falha ao carregar relatório')
  return res.json() as Promise<T>
}

// Para useQuery: não adianta re-tentar um bloqueio de plano.
export function retryUnlessLocked(failureCount: number, error: Error): boolean {
  return !(error instanceof FeatureLockedError) && failureCount < 3
}
