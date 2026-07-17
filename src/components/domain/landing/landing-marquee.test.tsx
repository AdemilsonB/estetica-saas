// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { LandingMarquee } from './landing-marquee'

afterEach(() => cleanup())

describe('LandingMarquee', () => {
  it('não renderiza nada sem salões', () => {
    const { container } = render(<LandingMarquee salons={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renderiza o nome do salão (duplicado no loop)', () => {
    const { getAllByText } = render(
      <LandingMarquee salons={[{ id: '1', authorName: 'Studio X', authorRole: 'São Paulo · SP' }]} />,
    )
    // set A + set B => aparece 2x
    expect(getAllByText('Studio X')).toHaveLength(2)
  })
})
