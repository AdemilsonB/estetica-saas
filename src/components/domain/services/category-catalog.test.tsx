// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const deleteMutate = vi.fn()
vi.mock('@/hooks/scheduling/use-service-categories', () => ({
  useServiceCategories: () => ({
    data: [{ id: 'c1', name: 'Cabelo', order: 0, active: true }],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useDeleteCategory: () => ({ mutate: deleteMutate }),
  useUpdateCategory: () => ({ mutate: vi.fn() }),
}))
vi.mock('./category-form-modal', () => ({ CategoryFormModal: () => null }))

import { CategoryCatalog } from './category-catalog'

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

afterEach(cleanup)

describe('CategoryCatalog — exclusão com AlertDialog', () => {
  it('abre o AlertDialog ao clicar em excluir e só chama a mutation ao confirmar', () => {
    render(<CategoryCatalog />)

    fireEvent.click(screen.getByLabelText('Excluir categoria Cabelo'))
    // Diálogo de confirmação visível com texto explicativo
    expect(screen.getByText(/Excluir a categoria/i)).toBeInTheDocument()
    expect(deleteMutate).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(deleteMutate).toHaveBeenCalledTimes(1)
    expect(deleteMutate.mock.calls[0][0]).toBe('c1')
  })
})
