// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InstallAppBanner } from './install-app-banner'

vi.mock('./use-pwa-install', () => ({
  usePwaInstall: vi.fn(() => ({
    isStandalone: false,
    platform: 'android',
    deferredPrompt: null,
    promptInstall: vi.fn(),
  })),
}))

import { usePwaInstall } from './use-pwa-install'

describe('InstallAppBanner', () => {
  beforeEach(() => {
    localStorage.clear()
    cleanup()
    vi.mocked(usePwaInstall).mockReturnValue({
      isStandalone: false,
      platform: 'android',
      deferredPrompt: null,
      promptInstall: vi.fn(),
    } as any)
  })

  it('não aparece no 1º acesso', () => {
    render(<InstallAppBanner />)
    expect(screen.queryByText(/tela inicial/i)).toBeNull()
    expect(localStorage.getItem('agende:agenda-visits')).toBe('1')
  })

  it('aparece a partir do 2º acesso', () => {
    localStorage.setItem('agende:agenda-visits', '1')
    render(<InstallAppBanner />)
    expect(screen.getByText(/tela inicial/i)).toBeInTheDocument()
  })

  it('não aparece se já instalado (standalone)', () => {
    localStorage.setItem('agende:agenda-visits', '5')
    vi.mocked(usePwaInstall).mockReturnValue({
      isStandalone: true, platform: 'android', deferredPrompt: null, promptInstall: vi.fn(),
    } as any)
    render(<InstallAppBanner />)
    expect(screen.queryByText(/tela inicial/i)).toBeNull()
  })

  it('não aparece se já foi dispensado', () => {
    localStorage.setItem('agende:agenda-visits', '5')
    localStorage.setItem('agende:install-banner-dismissed', '1')
    render(<InstallAppBanner />)
    expect(screen.queryByText(/tela inicial/i)).toBeNull()
  })
})
