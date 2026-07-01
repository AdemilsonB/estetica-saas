// @vitest-environment jsdom
import { it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { PublicPageForm } from './public-page-form'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

beforeAll(() => {
  // Radix UI Switch usa ResizeObserver internamente — mock necessário para jsdom
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

it('mostra o toggle de WhatsApp e o campo do Google', () => {
  render(
    <PublicPageForm
      initial={{
        bio: null,
        instagramUrl: null,
        coverImageUrl: null,
        phone: '41999999999',
        whatsappContactEnabled: true,
        googleBusinessUrl: null,
      }}
    />,
  )
  expect(screen.getByText(/WhatsApp na página/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/Google Maps/i)).toBeInTheDocument()
})
