// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { SubscriptionLockedScreen } from './subscription-locked-screen'

const originalFetch = global.fetch

afterEach(() => {
  cleanup()
  global.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('SubscriptionLockedScreen', () => {
  it('renderiza os benefícios e destaques vindos de /api/public/plans (PublicPlan)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve([
          {
            name: 'PRO',
            displayName: 'Pro',
            price: 89,
            trialDays: 14,
            isPopular: true,
            highlights: ['Destaque'],
            benefits: ['Agenda completa'],
          },
        ]),
    }) as unknown as typeof fetch

    render(<SubscriptionLockedScreen isOwner={true} originalPlan="PRO" />)

    expect(await screen.findByText('Agenda completa')).toBeInTheDocument()
    expect(screen.getByText('Destaque')).toBeInTheDocument()
  })
})
