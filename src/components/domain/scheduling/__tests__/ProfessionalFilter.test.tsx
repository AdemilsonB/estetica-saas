// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ProfessionalFilter } from '../ProfessionalFilter'

vi.mock('@/hooks/iam/use-team', () => ({
  useTeamMembers: () => ({
    data: [
      { id: 'u1', name: 'Ana Silva',      role: 'PROFESSIONAL', email: 'a@t.com', isOwner: false, roleId: 'r1', roleName: 'Profissional', createdAt: '' },
      { id: 'u2', name: 'João Santos',    role: 'PROFESSIONAL', email: 'j@t.com', isOwner: false, roleId: 'r1', roleName: 'Profissional', createdAt: '' },
      { id: 'u3', name: 'Maria Oliveira', role: 'PROFESSIONAL', email: 'm@t.com', isOwner: false, roleId: 'r1', roleName: 'Profissional', createdAt: '' },
    ],
  }),
}))

describe('ProfessionalFilter', () => {
  afterEach(() => cleanup())

  it('exibe "Todos os profissionais" quando nenhum está selecionado', () => {
    render(
      <ProfessionalFilter selectedIds={[]} onChange={() => {}} currentUserId="u1" />,
    )
    expect(screen.getByRole('combobox')).toHaveTextContent('Todos os profissionais')
  })

  it('exibe os nomes quando ≤ 2 profissionais estão selecionados', () => {
    render(
      <ProfessionalFilter selectedIds={['u1', 'u2']} onChange={() => {}} currentUserId="u1" />,
    )
    expect(screen.getByRole('combobox')).toHaveTextContent('Ana Silva, João Santos')
  })

  it('exibe "X profissionais" quando mais de 2 estão selecionados', () => {
    render(
      <ProfessionalFilter selectedIds={['u1', 'u2', 'u3']} onChange={() => {}} currentUserId="u1" />,
    )
    expect(screen.getByRole('combobox')).toHaveTextContent('3 profissionais')
  })

  it('chama onChange ao selecionar um profissional não selecionado', () => {
    const onChange = vi.fn()
    render(
      <ProfessionalFilter selectedIds={['u1']} onChange={onChange} currentUserId="u1" />,
    )
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByText('João Santos'))
    expect(onChange).toHaveBeenCalledWith(['u1', 'u2'])
  })

  it('chama onChange ao desmarcar um profissional já selecionado', () => {
    const onChange = vi.fn()
    render(
      <ProfessionalFilter selectedIds={['u1', 'u2']} onChange={onChange} currentUserId="u1" />,
    )
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByText('João Santos'))
    expect(onChange).toHaveBeenCalledWith(['u1'])
  })

  it('permite desmarcar o próprio usuário logado', () => {
    const onChange = vi.fn()
    render(
      <ProfessionalFilter selectedIds={['u1', 'u2']} onChange={onChange} currentUserId="u1" />,
    )
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByText('Ana Silva'))
    expect(onChange).toHaveBeenCalledWith(['u2'])
  })

  it('clicar em "Todos" quando não estão todos seleciona todos', () => {
    const onChange = vi.fn()
    render(
      <ProfessionalFilter selectedIds={['u1']} onChange={onChange} currentUserId="u1" />,
    )
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByText('Todos'))
    expect(onChange).toHaveBeenCalledWith(['u1', 'u2', 'u3'])
  })

  it('clicar em "Todos" quando todos estão selecionados deseleciona todos', () => {
    const onChange = vi.fn()
    render(
      <ProfessionalFilter selectedIds={['u1', 'u2', 'u3']} onChange={onChange} currentUserId="u1" />,
    )
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByText('Todos'))
    expect(onChange).toHaveBeenCalledWith([])
  })
})
