// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { FeatureLock } from './feature-lock'
import { useCapabilities } from '@/hooks/billing/use-capabilities'
import { useUpgradeModal } from '@/stores/upgrade-modal.store'

vi.mock('@/hooks/billing/use-capabilities')
afterEach(cleanup)

describe('FeatureLock', () => {
  it('renderiza children quando permitido', () => {
    vi.mocked(useCapabilities).mockReturnValue({ data: { reports_advanced: { key: 'reports_advanced', allowed: true, requiredPlan: null, requiredPlanLabel: null } } } as never)
    render(<FeatureLock capability="reports_advanced"><p>Conteúdo</p></FeatureLock>)
    expect(screen.getByText('Conteúdo')).toBeInTheDocument()
    expect(screen.queryByText(/Disponível no plano/)).not.toBeInTheDocument()
  })

  it('bloqueado: mostra selo e abre o modal ao clicar', () => {
    vi.mocked(useCapabilities).mockReturnValue({ data: { reports_advanced: { key: 'reports_advanced', allowed: false, requiredPlan: 'PRO', requiredPlanLabel: 'Pro' } } } as never)
    render(<FeatureLock capability="reports_advanced"><p>Conteúdo</p></FeatureLock>)
    const selo = screen.getByText(/Disponível no plano Pro/)
    expect(selo).toBeInTheDocument()
    fireEvent.click(selo)
    expect(useUpgradeModal.getState().open).toBe(true)
    expect(useUpgradeModal.getState().context?.capabilityKey).toBe('reports_advanced')
    useUpgradeModal.getState().close()
  })
})
