// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { ServiceCatalog } from '../service-catalog'

const services = [
  { id: 's1', name: 'Alisamento + Hidratação', duration: 60, price: '170', priceType: 'FIXED', categoryId: 'cat-1', category: { id: 'cat-1', name: 'Alisamento' }, active: true, imageUrl: null },
  { id: 's2', name: 'Corte Feminino', duration: 60, price: '80', priceType: 'FIXED', categoryId: 'cat-2', category: { id: 'cat-2', name: 'Corte' }, active: true, imageUrl: null },
]

const categories = [
  { id: 'cat-1', name: 'Alisamento', order: 0, active: true },
  { id: 'cat-2', name: 'Corte', order: 1, active: true },
  { id: 'cat-3', name: 'Mechas', order: 2, active: true },
]

vi.mock('@/hooks/scheduling/use-services', () => ({
  useServices: () => ({ data: services, isLoading: false, isError: false, refetch: vi.fn() }),
  useActivateService: () => ({ mutate: vi.fn() }),
  useDeactivateService: () => ({ mutate: vi.fn() }),
}))

vi.mock('@/hooks/scheduling/use-service-categories', () => ({
  useServiceCategories: () => ({ data: categories }),
}))

vi.mock('../service-form-modal', () => ({
  ServiceFormModal: () => null,
}))

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
  window.HTMLElement.prototype.hasPointerCapture = vi.fn()
  window.HTMLElement.prototype.releasePointerCapture = vi.fn()
})

describe('ServiceCatalog', () => {
  afterEach(() => cleanup())

  it('lista todos os serviços quando nenhum filtro de categoria está aplicado', () => {
    render(<ServiceCatalog />)
    expect(screen.getByText('Alisamento + Hidratação')).toBeInTheDocument()
    expect(screen.getByText('Corte Feminino')).toBeInTheDocument()
    expect(screen.getByText('2 serviço(s) cadastrado(s)')).toBeInTheDocument()
  })

  it('filtra a lista ao selecionar uma categoria', async () => {
    const user = userEvent.setup()
    render(<ServiceCatalog />)

    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: 'Corte' }))

    expect(screen.getByText('Corte Feminino')).toBeInTheDocument()
    expect(screen.queryByText('Alisamento + Hidratação')).not.toBeInTheDocument()
    expect(screen.getByText('1 serviço(s) cadastrado(s)')).toBeInTheDocument()
  })

  it('mostra mensagem de vazio quando a categoria filtrada não tem serviços', async () => {
    const user = userEvent.setup()
    render(<ServiceCatalog />)

    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: 'Mechas' }))

    expect(screen.getByText('Nenhum serviço encontrado nesta categoria.')).toBeInTheDocument()
  })

  it('volta a mostrar todos ao selecionar "Todas categorias"', async () => {
    const user = userEvent.setup()
    render(<ServiceCatalog />)

    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: 'Corte' }))
    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: 'Todas categorias' }))

    expect(screen.getByText('Alisamento + Hidratação')).toBeInTheDocument()
    expect(screen.getByText('Corte Feminino')).toBeInTheDocument()
  })
})
