// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import type { ActivationStatus } from '@/domains/activation/types'

const useEffectiveActivationStatus = vi.fn()
vi.mock('@/hooks/activation/use-effective-activation-status', () => ({
  useEffectiveActivationStatus: () => useEffectiveActivationStatus(),
}))

import { ActivationProgressCard } from './activation-progress-card'

function status(overrides: Partial<ActivationStatus> = {}): ActivationStatus {
  return {
    categorias: true,
    servicos: false,
    clientes: false,
    equipe: false,
    configuracoes: { dadosNegocio: false, horarios: false, branding: false, whatsapp: false, done: false },
    ...overrides,
  }
}

afterEach(cleanup)

describe('ActivationProgressCard', () => {
  beforeEach(() => {
    localStorage.clear()
    useEffectiveActivationStatus.mockReset()
  })

  it('não renderiza nada enquanto o status não carregou', () => {
    useEffectiveActivationStatus.mockReturnValue({ data: undefined })
    const { container } = render(<ActivationProgressCard />)
    expect(container).toBeEmptyDOMElement()
  })

  it('mostra o percentual e os 4 passos quando há pendência', () => {
    useEffectiveActivationStatus.mockReturnValue({ data: status() })
    render(<ActivationProgressCard />)
    expect(screen.getByText(/0%/)).toBeInTheDocument()
    expect(screen.getByText('Cadastre suas categorias e serviços')).toBeInTheDocument()
    expect(screen.getByText('Complete os dados do negócio')).toBeInTheDocument()
  })

  it('esconde ao dispensar e persiste o dismissal', () => {
    useEffectiveActivationStatus.mockReturnValue({ data: status() })
    render(<ActivationProgressCard />)
    fireEvent.click(screen.getByLabelText('Dispensar'))
    expect(screen.queryByText('Cadastre suas categorias e serviços')).not.toBeInTheDocument()
    expect(localStorage.getItem('agende:activation-card-dismissed')).toBe('1')
  })

  it('não renderiza quando dispensado e só os passos não-críticos estão pendentes', () => {
    localStorage.setItem('agende:activation-card-dismissed', '1')
    useEffectiveActivationStatus.mockReturnValue({
      data: status({ servicos: true, clientes: true, categorias: true }),
    })
    const { container } = render(<ActivationProgressCard />)
    expect(container).toBeEmptyDOMElement()
  })
})
