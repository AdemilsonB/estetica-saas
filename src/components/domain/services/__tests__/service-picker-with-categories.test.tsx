// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  ServicePickerWithCategories,
  type PickerService,
  type PickerPackage,
  type PickerPromotion,
} from '../service-picker-with-categories'

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

const packages: PickerPackage[] = [
  {
    id: 'p1',
    name: 'Corte com Hidratação',
    price: '230',
    items: [{ service: { id: 's3', name: 'Corte Feminino', duration: 60 } }],
  },
]

const promotions: PickerPromotion[] = [
  {
    id: 'promo1',
    name: 'Mês de Julho OFF',
    discountType: 'PERCENTAGE',
    discountValue: '20',
    items: [
      {
        serviceId: 's1',
        service: { id: 's1', name: 'Alisamento + Hidratação', price: '170', duration: 60 },
      },
    ],
  },
]

describe('ServicePickerWithCategories', () => {
  afterEach(() => cleanup())

  it('mostra todos os serviços numa única listagem quando "Todos" está ativo', () => {
    render(
      <ServicePickerWithCategories services={services} categories={categories} onSelect={() => {}} />,
    )
    expect(screen.getByText('Alisamento + Hidratação')).toBeInTheDocument()
    expect(screen.getByText('Selagem')).toBeInTheDocument()
    expect(screen.getByText('Corte Feminino')).toBeInTheDocument()
    expect(screen.getByText('Consultoria de imagem')).toBeInTheDocument()
  })

  it('em "Todos" mostra apenas serviços — pacotes e promoções ficam escondidos até filtrar', () => {
    render(
      <ServicePickerWithCategories
        services={services}
        categories={categories}
        packages={packages}
        promotions={promotions}
        onSelect={() => {}}
      />,
    )
    expect(screen.getByText('Corte Feminino')).toBeInTheDocument()
    expect(screen.queryByText('Corte com Hidratação')).not.toBeInTheDocument()
    expect(screen.queryByText('Mês de Julho OFF')).not.toBeInTheDocument()
  })

  it('chips seguem a sequência Todos, Pacotes e Promoções e depois categorias', () => {
    render(
      <ServicePickerWithCategories
        services={services}
        categories={categories}
        packages={packages}
        promotions={promotions}
        onSelect={() => {}}
      />,
    )
    const chipLabels = screen.getAllByRole('button').map((btn) => btn.textContent)
    expect(chipLabels.slice(0, 5)).toEqual(['Todos', 'Pacotes e Promoções', 'Alisamento', 'Corte', 'Outros'])
  })

  it('chip "Pacotes e Promoções" mostra só pacotes e promoções juntos, sem serviços avulsos', () => {
    render(
      <ServicePickerWithCategories
        services={services}
        categories={categories}
        packages={packages}
        promotions={promotions}
        onSelect={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Pacotes e Promoções' }))

    expect(screen.getByText('Corte com Hidratação')).toBeInTheDocument()
    expect(screen.getByText('Mês de Julho OFF')).toBeInTheDocument()
    expect(screen.queryByText('Selagem')).not.toBeInTheDocument()
    expect(screen.queryByText('Consultoria de imagem')).not.toBeInTheDocument()
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

  it('busca também encontra pacotes e promoções pelo nome', () => {
    render(
      <ServicePickerWithCategories
        services={services}
        categories={categories}
        packages={packages}
        promotions={promotions}
        onSelect={() => {}}
      />,
    )
    fireEvent.change(screen.getByPlaceholderText('Buscar serviço...'), { target: { value: 'julho' } })

    expect(screen.getByText('Mês de Julho OFF')).toBeInTheDocument()
    expect(screen.queryByText('Corte Feminino')).not.toBeInTheDocument()
  })

  it('mostra mensagem quando a busca não encontra nenhum item', () => {
    render(
      <ServicePickerWithCategories services={services} categories={categories} onSelect={() => {}} />,
    )
    fireEvent.change(screen.getByPlaceholderText('Buscar serviço...'), { target: { value: 'zzz-inexistente' } })
    expect(screen.getByText('Nenhum item encontrado para "zzz-inexistente".')).toBeInTheDocument()
  })

  it('chama onSelect com o serviço clicado', () => {
    const onSelect = vi.fn()
    render(
      <ServicePickerWithCategories services={services} categories={categories} onSelect={onSelect} />,
    )
    fireEvent.click(screen.getByText('Corte Feminino'))
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'service', item: expect.objectContaining({ id: 's3' }) }),
    )
  })

  it('mostra "Nenhum item disponível." quando a lista está vazia', () => {
    render(
      <ServicePickerWithCategories services={[]} categories={categories} onSelect={() => {}} />,
    )
    expect(screen.getByText('Nenhum item disponível.')).toBeInTheDocument()
  })

  it('mostra a duração da promoção no card, junto com os serviços inclusos', () => {
    render(
      <ServicePickerWithCategories
        services={services}
        categories={categories}
        promotions={promotions}
        onSelect={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Pacotes e Promoções' }))

    expect(screen.getByText('Alisamento + Hidratação')).toBeInTheDocument()
    expect(screen.getByText('1h')).toBeInTheDocument()
  })

  it('ícone de olho abre o detalhe completo sem disparar onSelect', () => {
    const onSelect = vi.fn()
    const servicesWithDescription: PickerService[] = [
      { ...services[2]!, description: 'Descrição completa do corte feminino, com todos os detalhes do procedimento.' },
    ]
    render(
      <ServicePickerWithCategories services={servicesWithDescription} categories={categories} onSelect={onSelect} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes de Corte Feminino' }))

    expect(onSelect).not.toHaveBeenCalled()
    const dialog = screen.getByRole('dialog')
    expect(
      within(dialog).getByText('Descrição completa do corte feminino, com todos os detalhes do procedimento.'),
    ).toBeInTheDocument()
  })

  it('botão "Selecionar" do modal de detalhe chama onSelect e fecha o modal', () => {
    const onSelect = vi.fn()
    render(
      <ServicePickerWithCategories services={services} categories={categories} onSelect={onSelect} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes de Corte Feminino' }))
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar' }))

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'service', item: expect.objectContaining({ id: 's3' }) }),
    )
    expect(screen.queryByRole('heading', { name: 'Corte Feminino' })).not.toBeInTheDocument()
  })
})
