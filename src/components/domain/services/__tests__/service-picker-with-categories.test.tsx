// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
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

describe('ServicePickerWithCategories', () => {
  afterEach(() => cleanup())

  it('mostra todos os serviços num único carrossel quando "Todos" está ativo', () => {
    render(
      <ServicePickerWithCategories services={services} categories={categories} onSelect={() => {}} />,
    )
    expect(screen.getByText('Alisamento + Hidratação')).toBeInTheDocument()
    expect(screen.getByText('Selagem')).toBeInTheDocument()
    expect(screen.getByText('Corte Feminino')).toBeInTheDocument()
    expect(screen.getByText('Consultoria de imagem')).toBeInTheDocument()
  })

  it('mostra apenas os serviços da categoria selecionada ao clicar num chip', () => {
    render(
      <ServicePickerWithCategories services={services} categories={categories} onSelect={() => {}} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Corte' }))

    expect(screen.getByText('Corte Feminino')).toBeInTheDocument()
    expect(screen.queryByText('Alisamento + Hidratação')).not.toBeInTheDocument()
    expect(screen.queryByText('Selagem')).not.toBeInTheDocument()
    expect(screen.queryByText('Consultoria de imagem')).not.toBeInTheDocument()
  })

  it('chip "Outros" mostra apenas serviços sem categoria', () => {
    render(
      <ServicePickerWithCategories services={services} categories={categories} onSelect={() => {}} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Outros' }))

    expect(screen.getByText('Consultoria de imagem')).toBeInTheDocument()
    expect(screen.queryByText('Corte Feminino')).not.toBeInTheDocument()
  })

  it('voltar para "Todos" depois de filtrar mostra todos de novo', () => {
    render(
      <ServicePickerWithCategories services={services} categories={categories} onSelect={() => {}} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Corte' }))
    fireEvent.click(screen.getByRole('button', { name: 'Todos' }))

    expect(screen.getByText('Alisamento + Hidratação')).toBeInTheDocument()
    expect(screen.getByText('Corte Feminino')).toBeInTheDocument()
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
