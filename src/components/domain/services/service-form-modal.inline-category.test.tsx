// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

const createCategoryMutate = vi.fn()

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/hooks/scheduling/use-services', () => ({
  useCreateService: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateService: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('@/hooks/scheduling/use-service-categories', () => ({
  useServiceCategories: () => ({ data: [{ id: 'c1', name: 'Cabelo', order: 0, active: true }] }),
  useCreateCategory: () => ({ mutate: createCategoryMutate, isPending: false }),
}))
vi.mock('@/hooks/inventory/use-products', () => ({
  useProducts: () => ({ data: { data: [] } }),
}))

import { ServiceFormModal } from './service-form-modal'

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

afterEach(cleanup)

describe('ServiceFormModal — cadastro inline de categoria', () => {
  beforeEach(() => {
    createCategoryMutate.mockReset()
  })

  it('abre o mini-formulário e chama useCreateCategory ao confirmar', () => {
    render(<ServiceFormModal open onClose={() => {}} />)

    fireEvent.click(screen.getByLabelText('Nova categoria'))
    const input = screen.getByPlaceholderText('Nome da nova categoria')
    fireEvent.change(input, { target: { value: 'Barba' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar categoria' }))

    expect(createCategoryMutate).toHaveBeenCalledTimes(1)
    expect(createCategoryMutate.mock.calls[0][0]).toEqual({ name: 'Barba' })
  })
})
