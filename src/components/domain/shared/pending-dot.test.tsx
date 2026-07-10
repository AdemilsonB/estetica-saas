// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { PendingDot } from './pending-dot'

describe('PendingDot', () => {
  it('renderiza uma bolinha âmbar acessível com label padrão', () => {
    render(<PendingDot />)
    const dot = screen.getByLabelText('Pendente')
    expect(dot).toBeInTheDocument()
    expect(dot.className).toContain('bg-amber-500')
  })

  it('aceita um label customizado', () => {
    render(<PendingDot label="Dados do negócio pendentes" />)
    expect(screen.getByLabelText('Dados do negócio pendentes')).toBeInTheDocument()
  })
})
