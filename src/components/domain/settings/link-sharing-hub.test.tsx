// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { LinkSharingHub } from './link-sharing-hub'

beforeAll(() => {
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  })
})

afterEach(() => {
  cleanup()
})

describe('LinkSharingHub', () => {
  const slug = 'barbearia-do-joao'
  const baseUrl = 'http://localhost:3000'
  const url = `${baseUrl}/agendar/${slug}`

  it('exibe o link público do negócio', () => {
    render(<LinkSharingHub slug={slug} baseUrl={baseUrl} />)
    expect(screen.getAllByText(url).length).toBeGreaterThan(0)
  })

  it('botão copiar chama clipboard.writeText com a URL', async () => {
    render(<LinkSharingHub slug={slug} baseUrl={baseUrl} />)
    const btn = screen.getAllByRole('button', { name: /copiar/i })[0]!
    fireEvent.click(btn)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(url)
  })

  it('exibe texto de template whatsapp com a URL', () => {
    render(<LinkSharingHub slug={slug} baseUrl={baseUrl} />)
    expect(screen.getAllByText(/Olá! Agora você pode agendar/).length).toBeGreaterThan(0)
  })
})
