// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { SharedPlanCard } from './plan-card-shared'

afterEach(() => cleanup())

describe('SharedPlanCard', () => {
  it('renderiza destaques (tagline) e benefícios com check', () => {
    render(
      <SharedPlanCard
        plan={{
          name: 'STARTER',
          displayName: 'Starter',
          price: 49,
          highlights: ['Ideal para começar'],
          features: ['Agenda completa', 'WhatsApp automático'],
          trialDays: 14,
        }}
        action={{ type: 'navigate', href: '/login?plan=STARTER' }}
      />,
    )
    expect(screen.getByText('Ideal para começar')).toBeInTheDocument()
    expect(screen.getByText('Agenda completa')).toBeInTheDocument()
    expect(screen.getByText('WhatsApp automático')).toBeInTheDocument()
  })

  it('não renderiza bloco de destaques quando highlights está vazio', () => {
    render(
      <SharedPlanCard
        plan={{ name: 'PRO', displayName: 'Pro', price: 89, features: ['Agenda completa'], trialDays: 14 }}
        action={{ type: 'navigate', href: '/login?plan=PRO' }}
      />,
    )
    expect(screen.queryByTestId('plan-highlights')).not.toBeInTheDocument()
  })
})
