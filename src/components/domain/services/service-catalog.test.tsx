// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

const deactivateMutate = vi.fn()
const activateMutate = vi.fn()

vi.mock('@/hooks/scheduling/use-services', () => ({
  useServices: () => ({
    data: [
      { id: 's1', name: 'Corte', duration: 30, price: '50', priceType: 'FIXED', categoryId: null, category: null, active: true, imageUrl: null, imageCropX: null, imageCropY: null, imageCropZoom: null },
      { id: 's2', name: 'Barba', duration: 20, price: '30', priceType: 'FIXED', categoryId: null, category: null, active: false, imageUrl: null, imageCropX: null, imageCropY: null, imageCropZoom: null },
    ],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useDeactivateService: () => ({ mutate: deactivateMutate }),
  useActivateService: () => ({ mutate: activateMutate }),
}))
vi.mock('@/hooks/scheduling/use-service-categories', () => ({ useServiceCategories: () => ({ data: [] }) }))
vi.mock('./service-form-modal', () => ({ ServiceFormModal: () => null }))

import { ServiceCatalog } from './service-catalog'

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

afterEach(cleanup)

describe('ServiceCatalog — confirmação de desativar/reativar', () => {
  it('confirma antes de desativar e explica que é reversível', () => {
    render(<ServiceCatalog />)
    fireEvent.click(screen.getByLabelText('Desativar Corte'))
    expect(screen.getByText(/deixa de aparecer/i)).toBeInTheDocument()
    expect(deactivateMutate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Desativar' }))
    expect(deactivateMutate).toHaveBeenCalledWith('s1')
  })

  it('confirma antes de reativar', () => {
    render(<ServiceCatalog />)
    fireEvent.click(screen.getByLabelText('Reativar Barba'))
    fireEvent.click(screen.getByRole('button', { name: 'Reativar' }))
    expect(activateMutate).toHaveBeenCalledWith('s2')
  })
})
