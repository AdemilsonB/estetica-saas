// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { LandingBranding } from './landing-branding'

afterEach(() => cleanup())

describe('LandingBranding — seletor de cor', () => {
  it('inicia com a primeira cor (Violeta) marcada', () => {
    render(<LandingBranding />)
    const violeta = screen.getByRole('radio', { name: 'Violeta' })
    expect(violeta).toHaveAttribute('aria-checked', 'true')
  })

  it('só uma cor fica marcada por vez ao selecionar outra', () => {
    render(<LandingBranding />)
    const violeta = screen.getByRole('radio', { name: 'Violeta' })
    const rosa = screen.getByRole('radio', { name: 'Rosa' })

    fireEvent.click(rosa)

    expect(rosa).toHaveAttribute('aria-checked', 'true')
    expect(violeta).toHaveAttribute('aria-checked', 'false')
  })

  it('expõe um radiogroup acessível com todas as cores', () => {
    render(<LandingBranding />)
    expect(screen.getByRole('radiogroup', { name: 'Cor da marca' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(5)
  })
})
