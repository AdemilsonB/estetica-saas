// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { ServicePickerWithCategories, type PickerService } from '../service-picker-with-categories'

const categories = [
  { id: 'cat-1', name: 'Alisamento' },
  { id: 'cat-2', name: 'Corte' },
]

const services: PickerService[] = [
  { id: 's1', name: 'Alisamento + Hidratação', duration: 60, price: '170', categoryId: 'cat-1' },
  { id: 's2', name: 'Selagem', duration: 180, price: '170', categoryId: 'cat-1' },
  { id: 's3', name: 'Corte Feminino', duration: 60, price: '80', categoryId: 'cat-2' },
  { id: 's4', name: 'Consultoria de imagem', duration: 30, price: '50', categoryId: null },
]

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

describe('ServicePickerWithCategories', () => {
  afterEach(() => cleanup())

  it('agrupa serviços em seções por categoria e mostra "Outros" para sem categoria', () => {
    render(
      <ServicePickerWithCategories services={services} categories={categories} onSelect={() => {}} />,
    )
    expect(screen.getByRole('heading', { name: 'Alisamento' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Corte' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Outros' })).toBeInTheDocument()
    expect(screen.getByText('Consultoria de imagem')).toBeInTheDocument()
  })

  it('exibe os chips "Todos" + categorias quando não há busca ativa', () => {
    render(
      <ServicePickerWithCategories services={services} categories={categories} onSelect={() => {}} />,
    )
    expect(screen.getByRole('button', { name: 'Todos' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Alisamento' }).length).toBeGreaterThan(0)
  })

  it('clicar num chip de categoria rola até a seção correspondente', () => {
    render(
      <ServicePickerWithCategories services={services} categories={categories} onSelect={() => {}} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Corte' }))
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled()
  })

  it('ao digitar na busca, esconde os chips e filtra por nome (ignorando acentos/caixa)', () => {
    render(
      <ServicePickerWithCategories services={services} categories={categories} onSelect={() => {}} />,
    )
    fireEvent.change(screen.getByPlaceholderText('Buscar serviço...'), { target: { value: 'alisamento' } })

    expect(screen.queryByRole('button', { name: 'Todos' })).not.toBeInTheDocument()
    expect(screen.getByText('Alisamento + Hidratação')).toBeInTheDocument()
    expect(screen.queryByText('Corte Feminino')).not.toBeInTheDocument()
  })

  it('mostra mensagem quando a busca não encontra nenhum serviço', () => {
    render(
      <ServicePickerWithCategories services={services} categories={categories} onSelect={() => {}} />,
    )
    fireEvent.change(screen.getByPlaceholderText('Buscar serviço...'), { target: { value: 'zzz-inexistente' } })
    expect(screen.getByText('Nenhum serviço encontrado para "zzz-inexistente".')).toBeInTheDocument()
  })

  it('chama onSelect com o serviço clicado', () => {
    const onSelect = vi.fn()
    render(
      <ServicePickerWithCategories services={services} categories={categories} onSelect={onSelect} />,
    )
    fireEvent.click(screen.getByText('Corte Feminino'))
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 's3' }))
  })

  it('mostra "Nenhum serviço disponível." quando a lista está vazia', () => {
    render(
      <ServicePickerWithCategories services={[]} categories={categories} onSelect={() => {}} />,
    )
    expect(screen.getByText('Nenhum serviço disponível.')).toBeInTheDocument()
  })
})
