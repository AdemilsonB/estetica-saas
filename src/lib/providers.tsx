'use client'

import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { useState, type ReactNode } from 'react'
import { ApiError } from '@/shared/http/api-fetch'
import { useUpgradeModal } from '@/stores/upgrade-modal.store'
import { GlobalUpgradeModal } from '@/components/domain/billing/global-upgrade-modal'

const ReactQueryDevtools =
  process.env.NODE_ENV !== 'production'
    ? dynamic(
        () =>
          import('@tanstack/react-query-devtools').then((m) => ({
            default: m.ReactQueryDevtools,
          })),
        { ssr: false },
      )
    : () => null

function handlePlanLimit(error: unknown) {
  if (error instanceof ApiError && error.status === 402 && error.code === 'PLAN_LIMIT_EXCEEDED') {
    const data = (error.data ?? {}) as { limitType?: string }
    useUpgradeModal.getState().openUpgrade({ limitType: data.limitType })
  }
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
        queryCache: new QueryCache({ onError: handlePlanLimit }),
        mutationCache: new MutationCache({ onError: handlePlanLimit }),
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <GlobalUpgradeModal />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
