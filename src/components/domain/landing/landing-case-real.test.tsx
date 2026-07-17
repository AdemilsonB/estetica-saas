// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { LandingCaseReal } from './landing-case-real'

afterEach(() => cleanup())

describe('LandingCaseReal', () => {
  it('não renderiza sem depoimento', () => {
    const { container } = render(<LandingCaseReal testimonial={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renderiza a citação em destaque', () => {
    const { getByText } = render(
      <LandingCaseReal
        testimonial={{ authorName: 'Rafael', authorRole: 'Navalha · Curitiba', quote: 'Mudou meu mês.' }}
      />,
    )
    expect(getByText(/Mudou meu mês/)).toBeTruthy()
  })
})
