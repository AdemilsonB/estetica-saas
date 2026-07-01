// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { VitrineLocationBlock } from './vitrine-location-block'

vi.mock('@/lib/maps-route', () => ({ openRoute: vi.fn() }))

afterEach(() => cleanup())

it('mostra mapa, rota e "Ver no Google" quando há link; selo com rating', () => {
  render(
    <VitrineLocationBlock
      address="Rua Guarapuava, 20, Colombo, PR"
      googleBusinessUrl="https://www.google.com/maps/place/X"
      googleRating={{ rating: 4.8, userRatingCount: 214 }}
      primaryColor="#a855f7"
    />,
  )
  expect(screen.getByTitle(/mapa/i)).toBeInTheDocument()
  expect(screen.getByText(/Rota/i)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Ver no Google/i })).toBeInTheDocument()
  expect(screen.getByText(/4,8/)).toBeInTheDocument()
  expect(screen.getByText(/214/)).toBeInTheDocument()
})

it('sem link do Google não renderiza "Ver no Google" nem selo', () => {
  render(<VitrineLocationBlock address="Rua X, 1" googleBusinessUrl={null} googleRating={null} primaryColor="#000" />)
  expect(screen.queryByRole('link', { name: /Ver no Google/i })).toBeNull()
})
