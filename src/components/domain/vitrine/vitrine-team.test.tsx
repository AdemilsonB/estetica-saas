// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, afterEach } from 'vitest'
import { VitrineTeam } from './vitrine-team'
import { VitrineInteractionProvider } from './vitrine-interaction-context'

const team = [
  {
    id: 'prof-1',
    name: 'Ana Souza',
    role: 'PROFESSIONAL',
    avatarUrl: null,
    bio: 'Especialista em coloração há 10 anos.',
    serviceIds: ['srv-1'],
  },
]

const services = [{ id: 'srv-1', name: 'Coloração' }]

afterEach(() => cleanup())

describe('VitrineTeam', () => {
  it('ao clicar num profissional, abre o perfil com bio, serviços e ação de agendar', async () => {
    const user = userEvent.setup()
    render(
      <VitrineInteractionProvider
        slug="salao-teste"
        primaryColor="#7C3AED"
        bookingBaseUrl="/agendar/salao-teste"
        team={team}
        services={services}
      >
        <VitrineTeam members={team} />
      </VitrineInteractionProvider>,
    )

    await user.click(screen.getByRole('button', { name: /ver perfil de ana souza/i }))

    const sheet = within(screen.getByRole('dialog'))
    expect(sheet.getByText('Especialista em coloração há 10 anos.')).toBeInTheDocument()
    expect(sheet.getByText('Coloração')).toBeInTheDocument()
    expect(sheet.getByRole('link', { name: /agendar com ana/i })).toBeInTheDocument()
  })
})
